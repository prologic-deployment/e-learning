const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

/**
 * Invoice PDF (Prologic Academy) — used by GET /api/files/invoice/:purchaseId.
 * Lists every course of the order (purchases sharing an orderReference) with
 * regular price, promotion, voucher and amount paid. Temporary file, deleted
 * right after streaming.
 *
 * @param {object|object[]} purchases  populated with course (title) — one order
 * @param {object} [customer]          { firstname, lastname, email }
 */
const INK = "#0B0D12";
const BLUE = "#1E3A8A";
const TINT = "#EEF2FB";
const MUTED = "#5B6270";
const LINE = "#D6DEF3";
const GREEN = "#15803D";

const money = (n) => `${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2)} TND`;

const generateInvoicePDF = (purchases, customer = null) => {
  const list = (Array.isArray(purchases) ? purchases : [purchases]).filter(Boolean);
  const first = list[0];

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: "Invoice", Author: "Prologic Academy" } });
    const fileName = `invoice_${first._id}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, "../../uploads/invoices", fileName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = doc.page.width;
    const M = 50;

    // ---------- header band ----------
    doc.rect(0, 0, W, 110).fill(INK);
    doc.rect(0, 110, W, 4).fill(BLUE);
    doc.rect(M, 36, 38, 38).fill(BLUE);
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#FFFFFF").text("P", M + 11, 45);
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#FFFFFF").text("PROLOGIC", M + 50, 40);
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#9DB4EE").text("ACADEMY", M + 51, 59, { characterSpacing: 3 });
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#FFFFFF").text("INVOICE", 0, 40, { width: W - M, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor("#C7D2EE")
       .text(first.orderReference || `PUR-${first._id}`, 0, 68, { width: W - M, align: "right" });

    // ---------- parties ----------
    let y = 140;
    const date = new Date(first.createdAt || Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const label = (t, x, yy) => doc.font("Helvetica-Bold").fontSize(7.5).fillColor(BLUE).text(t, x, yy, { characterSpacing: 1.2 });
    label("BILLED TO", M, y);
    label("ISSUED BY", 230, y);
    label("DETAILS", 400, y);
    doc.font("Helvetica").fontSize(10).fillColor(INK);
    const who = customer ? `${customer.firstname || ""} ${customer.lastname || ""}`.trim() : "Customer";
    doc.font("Helvetica-Bold").text(who, M, y + 14, { width: 170 });
    if (customer?.email) doc.font("Helvetica").fillColor(MUTED).text(customer.email, M, doc.y + 2, { width: 170 });
    doc.font("Helvetica-Bold").fillColor(INK).text("Prologic Academy", 230, y + 14, { width: 160 });
    doc.font("Helvetica").fillColor(MUTED).text("2, Rue Apollo XI - 1082\nTunis - Mahrajene\nprologic@prologic.com.tn", 230, doc.y + 2, { width: 160 });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
       .text(`Date: ${date}`, 400, y + 14, { width: W - M - 400 })
       .text(`Status: ${first.paymentStatus === "paid" ? "Paid" : first.paymentStatus}`, 400, doc.y + 2, { width: W - M - 400 });
    const method = first.paymentMethod === "voucher"
      ? "Voucher (fully covered)"
      : first.cardLast4 ? `${(first.cardBrand || "card").toUpperCase()} •••• ${first.cardLast4}` : "Card";
    doc.text(`Payment: ${method}`, 400, doc.y + 2, { width: W - M - 400 });
    if (first.paymentReference) doc.text(`Ref: ${first.paymentReference}`, 400, doc.y + 2, { width: W - M - 400 });

    // ---------- table ----------
    y = 270;
    const cols = [
      { t: "COURSE", x: M, w: 205, a: "left" },
      { t: "PRICE", x: 255, w: 70, a: "right" },
      { t: "PROMOTION", x: 330, w: 75, a: "right" },
      { t: "VOUCHER", x: 410, w: 65, a: "right" },
      { t: "PAID", x: 480, w: W - M - 480, a: "right" }
    ];
    doc.rect(M, y, W - 2 * M, 26).fill(TINT);
    cols.forEach(c => doc.font("Helvetica-Bold").fontSize(7.5).fillColor(BLUE)
      .text(c.t, c.x + (c.a === "left" ? 10 : 0), y + 9, { width: c.w - (c.a === "left" ? 10 : 6), align: c.a, characterSpacing: 1 }));
    y += 26;

    let regular = 0, promo = 0, vouch = 0, paid = 0;
    const codes = new Set();
    for (const p of list) {
      const original = p.originalAmount ?? p.amount;
      regular += original; promo += p.saleDiscount || 0; vouch += p.voucherDiscount || 0; paid += p.amount;
      if (p.voucherCode) codes.add(p.voucherCode);
      const title = p.course?.title || "Course";
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK);
      const h = Math.max(30, doc.heightOfString(title, { width: 195 }) + 16);
      doc.text(title, M + 10, y + 9, { width: 195 });
      const cells = [money(original), p.saleDiscount ? "- " + money(p.saleDiscount) : "—", p.voucherDiscount ? "- " + money(p.voucherDiscount) : "—", money(p.amount)];
      cells.forEach((v, i) => {
        const c = cols[i + 1];
        doc.font(i === 3 ? "Helvetica-Bold" : "Helvetica").fontSize(9.5)
           .fillColor(i === 3 ? INK : (v === "—" ? MUTED : (i === 0 ? INK : GREEN)))
           .text(v, c.x, y + 9, { width: c.w - 6, align: "right" });
      });
      y += h;
      doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.6).stroke(LINE);
    }

    // ---------- totals ----------
    y += 16;
    const tx = 330, tw = W - M - tx;
    const row = (k, v, opts = {}) => {
      doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size || 10).fillColor(opts.color || INK);
      doc.text(k, tx, y, { width: tw / 2 });
      doc.text(v, tx + tw / 2, y, { width: tw / 2 - 6, align: "right" });
      y += (opts.size || 10) + 9;
    };
    row("Subtotal", money(regular));
    if (promo) row("Promotions", "- " + money(promo), { color: GREEN });
    if (vouch) row(`Voucher${codes.size ? " (" + [...codes].join(", ") + ")" : ""}`, "- " + money(vouch), { color: GREEN });
    doc.moveTo(tx, y - 2).lineTo(W - M, y - 2).lineWidth(1).stroke(INK);
    y += 6;
    row("Total paid", money(paid), { bold: true, size: 13 });

    // ---------- footer ----------
    doc.font("Helvetica").fontSize(8).fillColor("#8A909C")
       .text("Prologic Academy · prologic.com.tn — Thank you for learning with us. Payment processed in test mode (simulated).",
             M, doc.page.height - 50, { width: W - 2 * M, align: "center" });

    doc.end();
    stream.on("finish", () => resolve({ fileName, filePath }));
    stream.on("error", reject);
  });
};

module.exports = { generateInvoicePDF };
