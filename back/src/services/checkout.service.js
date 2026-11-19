/**
 * Checkout — cart pricing (promotions + voucher), simulated card payment
 * and order creation (one Purchase per course, all sharing an order reference).
 *
 * Payment is SIMULATED: no card data leaves the server and nothing is stored
 * except the card brand and its last 4 digits. Test cards (see TEST_CARDS)
 * trigger the usual decline cases so the checkout UI can be exercised.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Course = require("../models/Course");
const Purchase = require("../models/Purchase");
const Enrollment = require("../models/Enrollment");
const Voucher = require("../models/Voucher");
const { round2, priceInfo } = require("../utils/pricing");

class CheckoutError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

// ---------------------------------------------------------------- cards

/** Luhn-valid numbers that simulate a failure; any other valid number is accepted */
const TEST_CARDS = {
  "4000000000000002": { code: "card_declined", message: "Your card was declined." },
  "4000000000009995": { code: "insufficient_funds", message: "Your card has insufficient funds." },
  "4000000000000069": { code: "expired_card", message: "Your card has expired." },
  "4000000000000127": { code: "incorrect_cvc", message: "Your card's security code is incorrect." }
};

function luhnValid(num) {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = num.charCodeAt(i) - 48;
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function cardBrand(num) {
  if (/^4/.test(num)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(num)) return "mastercard";
  if (/^3[47]/.test(num)) return "amex";
  return "card";
}

/** Throws CheckoutError(400/402) with { field } on invalid or declined cards */
function chargeCard(card, amount) {
  const c = card || {};
  const number = String(c.number || "").replace(/[\s-]/g, "");
  const name = String(c.name || "").trim();
  const month = Number(c.expMonth);
  const year = Number(String(c.expYear || "").length === 2 ? "20" + c.expYear : c.expYear);
  const cvc = String(c.cvc || "").trim();

  if (!name || name.length < 2) throw new CheckoutError(400, "Enter the name on the card.", { field: "name" });
  if (!/^\d{13,19}$/.test(number) || !luhnValid(number)) {
    throw new CheckoutError(400, "Your card number is invalid.", { field: "number" });
  }
  const brand = cardBrand(number);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    throw new CheckoutError(400, "Enter a valid expiry date.", { field: "expiry" });
  }
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1) || year > now.getFullYear() + 20) {
    throw new CheckoutError(400, "Your card has expired.", { field: "expiry" });
  }
  if (!(brand === "amex" ? /^\d{4}$/ : /^\d{3}$/).test(cvc)) {
    throw new CheckoutError(400, "Your card's security code is invalid.", { field: "cvc" });
  }
  const test = TEST_CARDS[number];
  if (test) throw new CheckoutError(402, test.message, { field: test.code === "incorrect_cvc" ? "cvc" : "number", code: test.code });

  return {
    brand,
    last4: number.slice(-4),
    reference: "PAY-" + crypto.randomBytes(6).toString("hex").toUpperCase(),
    amount
  };
}

// ---------------------------------------------------------------- vouchers

/** Returns an error message when the voucher cannot be used by this user, null when OK */
function voucherProblem(v, user, now = new Date()) {
  if (!v || !v.active) return "This voucher code is not valid.";
  if (v.startsAt && v.startsAt > now) return "This voucher is not active yet.";
  if (v.expiresAt && v.expiresAt <= now) return "This voucher has expired.";
  if (v.maxUses && v.usedCount >= v.maxUses) return "This voucher has reached its usage limit.";
  if (v.emailDomain) {
    const domain = String(user.email || "").split("@")[1]?.toLowerCase();
    if (domain !== v.emailDomain) return "This voucher is reserved for another organisation.";
  }
  if (v.perUserLimit) {
    const mine = (v.redemptions || []).filter(r => String(r.user) === String(user._id)).length;
    if (mine >= v.perUserLimit) return "You have already used this voucher.";
  }
  return null;
}

function voucherDiscountFor(v, unitPrice) {
  const d = v.type === "percent" ? unitPrice * (v.value / 100) : v.value;
  return round2(Math.min(unitPrice, Math.max(0, d)));
}

/** Atomically count one use (respects maxUses and perUserLimit under concurrency) */
async function redeemVoucher(v, user, orderReference, discount) {
  const userId = new mongoose.Types.ObjectId(String(user._id));
  const and = [];
  if (v.maxUses) and.push({ $expr: { $lt: ["$usedCount", "$maxUses"] } });
  if (v.perUserLimit) {
    and.push({
      $expr: {
        $lt: [
          { $size: { $filter: { input: "$redemptions", cond: { $eq: ["$$this.user", userId] } } } },
          "$perUserLimit"
        ]
      }
    });
  }
  const filter = { _id: v._id, active: true, ...(and.length ? { $and: and } : {}) };
  const updated = await Voucher.findOneAndUpdate(
    filter,
    { $inc: { usedCount: 1 }, $push: { redemptions: { user: userId, orderReference, discount } } },
    { new: true }
  );
  if (!updated) throw new CheckoutError(409, "This voucher can no longer be used.", { field: "voucher" });
}

async function releaseVoucher(v, orderReference) {
  await Voucher.updateOne(
    { _id: v._id },
    { $inc: { usedCount: -1 }, $pull: { redemptions: { orderReference } } }
  ).catch(() => {});
}

// ---------------------------------------------------------------- quote

/**
 * Price the user's cart. Owned courses (already bought or enrolled) are
 * listed separately and never charged.
 * @returns {Promise<object>} quote — `voucher` is the Voucher doc when applied
 */
async function buildQuote(user, voucherCode) {
  const cart = await Cart.findOne({ user: user._id })
    .populate({ path: "items.course", select: "title price salePrice saleEndsAt category subCategory isApproved trainer", populate: { path: "trainer", select: "firstname lastname" } });

  const raw = (cart?.items || []).filter(i => i.course && i.course.isApproved && i.course.price > 0);
  const ids = raw.map(i => i.course._id);
  const [paid, enrolled] = await Promise.all([
    Purchase.find({ user: user._id, course: { $in: ids }, paymentStatus: "paid" }).select("course").lean(),
    Enrollment.find({ user: user._id, course: { $in: ids } }).select("course").lean()
  ]);
  const owned = new Set([...paid, ...enrolled].map(p => String(p.course)));

  const now = new Date();
  const items = [];
  const ownedItems = [];
  for (const i of raw) {
    const c = i.course;
    const info = priceInfo(c, now);
    const line = {
      courseId: String(c._id),
      title: c.title,
      category: c.category || null,
      subCategory: c.subCategory || null,
      trainer: c.trainer ? `${c.trainer.firstname} ${c.trainer.lastname}` : null,
      price: info.price,
      finalPrice: info.finalPrice,
      onSale: info.onSale,
      discountPercent: info.discountPercent,
      saleEndsAt: info.saleEndsAt,
      saleDiscount: round2(info.price - info.finalPrice),
      voucherDiscount: 0,
      total: info.finalPrice
    };
    (owned.has(line.courseId) ? ownedItems : items).push(line);
  }

  let voucher = null;
  let voucherError = null;
  const code = String(voucherCode || "").trim().toUpperCase();
  if (code) {
    const v = await Voucher.findOne({ code });
    voucherError = voucherProblem(v, user, now);
    if (!voucherError) {
      const eligible = items.filter(l => !v.course || String(v.course) === l.courseId);
      if (!eligible.length) {
        voucherError = "This voucher does not apply to the courses in your cart.";
      } else {
        for (const l of eligible) {
          l.voucherDiscount = voucherDiscountFor(v, l.finalPrice);
          l.total = round2(l.finalPrice - l.voucherDiscount);
        }
        voucher = v;
      }
    }
  }

  const sum = (k) => round2(items.reduce((s, l) => s + l[k], 0));
  return {
    items,
    ownedItems,
    subtotal: sum("price"),
    saleSavings: sum("saleDiscount"),
    voucherDiscount: sum("voucherDiscount"),
    total: sum("total"),
    currency: "TND",
    voucher,
    voucherError
  };
}

/** Client-safe view of a quote */
function publicQuote(q) {
  const { voucher, ...rest } = q;
  return {
    ...rest,
    voucher: voucher ? {
      code: voucher.code,
      description: voucher.description,
      type: voucher.type,
      value: voucher.value,
      courseWide: !voucher.course
    } : null
  };
}

// ---------------------------------------------------------------- pay

function newOrderReference() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `ORD-${ymd}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function pay(user, { voucherCode, card } = {}) {
  const q = await buildQuote(user, voucherCode);
  if (q.voucherError) throw new CheckoutError(400, q.voucherError, { field: "voucher" });
  if (!q.items.length) {
    throw new CheckoutError(400, q.ownedItems.length
      ? "You already own every course in your cart."
      : "Your cart is empty.");
  }

  // Charge first (simulated, no side effects), then count the voucher use
  const charge = q.total > 0 ? chargeCard(card, q.total) : null;
  const orderReference = newOrderReference();
  if (q.voucher) await redeemVoucher(q.voucher, user, orderReference, q.voucherDiscount);

  const created = [];
  try {
    for (const l of q.items) {
      const purchase = await Purchase.create({
        user: user._id,
        course: l.courseId,
        amount: l.total,
        originalAmount: l.price,
        saleDiscount: l.saleDiscount,
        voucherCode: l.voucherDiscount > 0 ? q.voucher.code : null,
        voucherDiscount: l.voucherDiscount,
        paymentStatus: "paid",
        paymentProvider: "simulated",
        paymentMethod: l.total > 0 ? "card" : "voucher",
        paymentReference: charge?.reference || null,
        cardBrand: l.total > 0 ? charge.brand : null,
        cardLast4: l.total > 0 ? charge.last4 : null,
        orderReference
      });
      created.push(purchase);
      await Enrollment.updateOne(
        { user: user._id, course: l.courseId },
        { $setOnInsert: { user: user._id, course: l.courseId } },
        { upsert: true }
      );
    }
  } catch (err) {
    await Purchase.deleteMany({ _id: { $in: created.map(p => p._id) } }).catch(() => {});
    if (q.voucher) await releaseVoucher(q.voucher, orderReference);
    throw err;
  }

  // Bought and already-owned courses leave the cart
  const done = [...q.items, ...q.ownedItems].map(l => l.courseId);
  const cart = await Cart.findOne({ user: user._id });
  if (cart) {
    cart.items = cart.items.filter(i => !done.includes(String(i.course)));
    cart.totalPrice = round2(cart.items.reduce((s, i) => s + (i.price || 0), 0));
    await cart.save();
  }

  return {
    orderReference,
    paymentReference: charge?.reference || null,
    paymentMethod: charge ? "card" : "voucher",
    card: charge ? { brand: charge.brand, last4: charge.last4 } : null,
    ...publicQuote(q),
    purchases: created.map(p => ({ id: p._id, courseId: String(p.course), amount: p.amount }))
  };
}

module.exports = {
  CheckoutError,
  TEST_CARDS,
  luhnValid,
  cardBrand,
  chargeCard,
  voucherProblem,
  buildQuote,
  publicQuote,
  pay
};
