const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

/**
 * ✅ Invoice PDF generator — used by GET /api/files/invoice/:purchaseId.
 * Temporary file, deleted right after streaming.
 */
const generateInvoicePDF = (purchase) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });

    const fileName = `invoice_${purchase._id}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, "../../uploads/invoices", fileName);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc
      .fontSize(24)
      .fillColor("#2c3e50")
      .font("Helvetica-Bold")
      .text("FACTURE", { align: "left" });

    doc
      .fontSize(10)
      .fillColor("#888")
      .font("Helvetica")
      .text(`Facture N° ${purchase._id}`, { align: "left" })
      .text(`Date : ${new Date(purchase.createdAt).toLocaleDateString("fr-FR")}`, { align: "left" });

    doc.moveDown(1.5);

    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .lineWidth(2)
      .strokeColor("#2c3e50")
      .stroke();

    doc.moveDown(1);

    // Details
    doc.fontSize(12).fillColor("#333").font("Helvetica");
    doc.text(`Cours : ${purchase.course?.title || "Formation"}`, { continued: false });
    doc.text(`Montant : ${purchase.amount} TND`);
    doc.text(`Statut : ${purchase.paymentStatus === "paid" ? "Payé" : purchase.paymentStatus}`);
    doc.text(`Référence paiement : ${purchase.paymentReference || "—"}`);

    doc.moveDown(2);

    doc
      .fontSize(9)
      .fillColor("#888")
      .text(
        "Document généré automatiquement par la plateforme E-Learning. Merci de votre confiance.",
        { align: "center" }
      );

    doc.end();

    stream.on("finish", () => resolve({ fileName, filePath }));
    stream.on("error", reject);
  });
};

module.exports = { generateInvoicePDF };
