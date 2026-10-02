const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const generateCVPDF = (cv) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });

    const fileName = `cv_${cv.user}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, "../../uploads/cvs", fileName);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ========================================
    // HEADER — Infos personnelles
    // ========================================

    // ✅ Photo si disponible
    if (cv.photo) {
      try {
        const photoPath = path.join(__dirname, "../../", cv.photo);
        if (fs.existsSync(photoPath)) {
          doc.image(photoPath, 450, 40, { width: 80, height: 80 });
        }
      } catch (e) {
        console.log("Photo non trouvée:", e.message);
      }
    }

    doc
      .fillColor("#2c3e50")
      .fontSize(28)
      .font("Helvetica-Bold")
      .text(`${cv.prenom} ${cv.nom}`, { align: "left" });

    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#555")
      .text(`${cv.email} | ${cv.telephone || ""}`, { align: "left" });

    doc.moveDown(0.5);

    // Ligne séparatrice
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .lineWidth(2)
      .stroke("#2c3e50");

    doc.moveDown(0.5);

    // Description
    if (cv.description) {
      doc
        .fontSize(11)
        .fillColor("#555")
        .font("Helvetica")
        .text(cv.description, { align: "justify" });
      doc.moveDown();
    }

    // ========================================
    // FONCTION HELPER — Titre de section
    // ========================================
    const sectionTitle = (title) => {
      doc.moveDown(0.5);
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#2c3e50")
        .text(title.toUpperCase());
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .lineWidth(1)
        .stroke("#C9A84C");
      doc.moveDown(0.5);
    };

    // ========================================
    // EXPÉRIENCES
    // ========================================
    if (cv.experiences && cv.experiences.length > 0) {
      sectionTitle("Expériences Professionnelles");

      cv.experiences.forEach((exp) => {
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .fillColor("#2c3e50")
          .text(exp.titre);

        doc
          .fontSize(11)
          .font("Helvetica")
          .fillColor("#C9A84C")
          .text(exp.entreprise);

        const dateDebut = new Date(exp.dateDebut).toLocaleDateString("fr-FR");
        const dateFin = exp.dateFin
          ? new Date(exp.dateFin).toLocaleDateString("fr-FR")
          : "Présent";

        doc
          .fontSize(10)
          .fillColor("#888")
          .text(`${dateDebut} - ${dateFin}`);

        if (exp.description) {
          doc
            .fontSize(11)
            .fillColor("#555")
            .text(exp.description);
        }

        doc.moveDown(0.5);
      });
    }

    // ========================================
    // FORMATIONS
    // ========================================
    if (cv.formations && cv.formations.length > 0) {
      sectionTitle("Formations");

      cv.formations.forEach((form) => {
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .fillColor("#2c3e50")
          .text(form.diplome);

        doc
          .fontSize(11)
          .font("Helvetica")
          .fillColor("#C9A84C")
          .text(form.etablissement);

        const dateDebut = new Date(form.dateDebut).toLocaleDateString("fr-FR");
        const dateFin = form.dateFin
          ? new Date(form.dateFin).toLocaleDateString("fr-FR")
          : "Présent";

        doc
          .fontSize(10)
          .fillColor("#888")
          .text(`${dateDebut} - ${dateFin}`);

        doc.moveDown(0.5);
      });
    }

    // ========================================
    // COMPÉTENCES
    // ========================================
    if (cv.competences && cv.competences.length > 0) {
      sectionTitle("Compétences");

      cv.competences.forEach((comp) => {
        doc
          .fontSize(11)
          .font("Helvetica")
          .fillColor("#2c3e50")
          .text(`• ${comp.nom}`, { continued: true })
          .fillColor("#888")
          .text(`  — ${comp.niveau}`);
      });

      doc.moveDown();
    }

    // ========================================
    // LANGUES
    // ========================================
    if (cv.langues && cv.langues.length > 0) {
      sectionTitle("Langues");

      cv.langues.forEach((lang) => {
        doc
          .fontSize(11)
          .font("Helvetica")
          .fillColor("#2c3e50")
          .text(`• ${lang.langue}`, { continued: true })
          .fillColor("#888")
          .text(`  — ${lang.niveau}`);
      });

      doc.moveDown();
    }

    // ========================================
    // CERTIFICATIONS
    // ========================================
    if (cv.certifications && cv.certifications.length > 0) {
      sectionTitle("Certifications");

      cv.certifications.forEach((cert) => {
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .fillColor("#2c3e50")
          .text(cert.titre);

        doc
          .fontSize(11)
          .font("Helvetica")
          .fillColor("#555")
          .text(`${cert.organisme} — ${new Date(cert.dateObtention).toLocaleDateString("fr-FR")}`);

        doc.moveDown(0.5);
      });
    }

    // ========================================
    // HOBBIES
    // ========================================
    if (cv.hobbies && cv.hobbies.length > 0) {
      sectionTitle("Centres d'intérêt");

      const hobbiesList = cv.hobbies.map(h => h.nom).join("  •  ");
      doc
        .fontSize(11)
        .font("Helvetica")
        .fillColor("#555")
        .text(hobbiesList);
    }

    doc.end();

    stream.on("finish", () => resolve({ fileName, filePath }));
    stream.on("error", reject);
  });
};

module.exports = generateCVPDF;