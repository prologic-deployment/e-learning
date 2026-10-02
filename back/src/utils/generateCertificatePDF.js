const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const generateCertificatePDF = (employeeName, courseName, date) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      layout: "landscape",
      size: "A4"
    });

    const fileName = `certificate_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, "../../uploads/certificates", fileName);

    // ✅ Integrity: unique serial + HMAC code so certificates can be verified
    // as genuinely issued by this platform (verification endpoint checks the HMAC).
    const serial = `CERT-${new Date(date).getFullYear()}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const secret = process.env.JWT_SECRET || "dev-only-secret";
    const verificationCode = crypto
      .createHmac("sha256", secret)
      .update(`${serial}|${employeeName}|${courseName}`)
      .digest("hex")
      .substring(0, 16)
      .toUpperCase();

    // Créer le dossier si n'existe pas
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ========== DESIGN DU CERTIFICAT ==========

    // Fond
    doc.rect(0, 0, doc.page.width, doc.page.height).fill("#f9f6f0");

    // Bordure dorée
    doc
      .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
      .lineWidth(4)
      .stroke("#C9A84C");

    // Bordure intérieure
    doc
      .rect(30, 30, doc.page.width - 60, doc.page.height - 60)
      .lineWidth(1)
      .stroke("#C9A84C");

    // Titre
    doc
      .font("Helvetica-Bold")
      .fontSize(40)
      .fillColor("#2c3e50")
      .text("CERTIFICAT DE COMPLETION", 0, 80, { align: "center" });

    // Ligne décorative
    doc
      .moveTo(100, 140)
      .lineTo(doc.page.width - 100, 140)
      .lineWidth(2)
      .stroke("#C9A84C");

    // Texte principal
    doc
      .font("Helvetica")
      .fontSize(18)
      .fillColor("#555")
      .text("Ce certificat est décerné à", 0, 170, { align: "center" });

    // Nom de l'employé
    doc
      .font("Helvetica-Bold")
      .fontSize(36)
      .fillColor("#C9A84C")
      .text(employeeName, 0, 210, { align: "center" });

    // Ligne décorative sous le nom
    doc
      .moveTo(200, 260)
      .lineTo(doc.page.width - 200, 260)
      .lineWidth(1)
      .stroke("#C9A84C");

    // Texte cours
    doc
      .font("Helvetica")
      .fontSize(18)
      .fillColor("#555")
      .text("pour avoir complété avec succès le cours", 0, 280, { align: "center" });

    // Nom du cours
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor("#2c3e50")
      .text(courseName, 0, 315, { align: "center" });

    // Date
    doc
      .font("Helvetica")
      .fontSize(14)
      .fillColor("#888")
      .text(`Délivré le : ${new Date(date).toLocaleDateString("fr-FR")}`, 0, 375, { align: "center" });

    // ✅ Serial + verification code printed on the certificate
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#888")
      .text(`N° ${serial} — Code de vérification : ${verificationCode}`, 0, 398, { align: "center" });

    // Ligne signature
    doc
      .moveTo(150, 430)
      .lineTo(350, 430)
      .lineWidth(1)
      .stroke("#2c3e50");

    doc
      .moveTo(doc.page.width - 350, 430)
      .lineTo(doc.page.width - 150, 430)
      .lineWidth(1)
      .stroke("#2c3e50");

    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#555")
      .text("Signature du Formateur", 150, 440)
      .text("Signature du Directeur", doc.page.width - 350, 440);

    // ==========================================

    doc.end();

    stream.on("finish", () => resolve({ fileName, filePath, serial, verificationCode }));
    stream.on("error", reject);
  });
};

module.exports = generateCertificatePDF;