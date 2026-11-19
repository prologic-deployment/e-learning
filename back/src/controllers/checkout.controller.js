const { buildQuote, publicQuote, pay, CheckoutError } = require("../services/checkout.service");
const { invalidateCache } = require("../middlewares/cache.middleware");
const { createNotification } = require("../services/notification.service");

const fail = (res, err) => {
  if (err instanceof CheckoutError) {
    return res.status(err.status).json({ success: false, message: err.message, field: err.field || null, code: err.code || null });
  }
  console.error("checkout error:", err.message);
  return res.status(500).json({ success: false, message: "Server error" });
};

// POST /api/checkout/quote  { voucherCode? } — price the cart (no side effects)
exports.quote = async (req, res) => {
  try {
    const q = await buildQuote(req.user, req.body?.voucherCode);
    res.status(200).json({ success: true, quote: publicQuote(q) });
  } catch (err) {
    fail(res, err);
  }
};

// POST /api/checkout/pay  { voucherCode?, card? } — simulated payment + enrollment
exports.pay = async (req, res) => {
  try {
    const order = await pay(req.user, { voucherCode: req.body?.voucherCode, card: req.body?.card });

    await Promise.all([
      invalidateCache("cache:GET:/api/enrollments:*"),
      ...order.purchases.map(p => invalidateCache(`cache:GET:/api/courses/${p.courseId}:*`))
    ]).catch(() => {});

    createNotification(
      req.user._id,
      "ORDER_CONFIRMED",
      "Order confirmed",
      `Order ${order.orderReference}: ${order.items.length} course(s) added to your learning.`,
      {}
    ).catch(() => {});

    res.status(201).json({ success: true, message: "Payment successful", order });
  } catch (err) {
    fail(res, err);
  }
};
