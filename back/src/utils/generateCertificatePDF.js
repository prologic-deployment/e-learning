/**
 * Certificate of completion — Prologic Academy brand (dark blue + black).
 *
 * A4 landscape PDF written to back/uploads/certificates/<file>.pdf.
 * Layout: dark ink side band (logo + verification details) with a blue edge,
 * and a white main area (holder name, course, details, signatures, seal).
 *
 * Fonts are the PDF built-ins (Helvetica family) so no font files are needed.
 */
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const INK = "#0B0D12";
const BLUE = "#1E3A8A";
const BLUE_SOFT = "#EEF2FB";
const MUTED = "#5B6270";
const LINE = "#D6DEF3";

const CERT_DIR = path.join(__dirname, "../../uploads/certificates");

/** The Prologic Academy mark (blue square, white "P" with a play notch) */
function drawMark(doc, x, y, size) {
  const k = size / 40;
  doc.save();
  doc.rect(x, y, size, size).fill(BLUE);
  // P: stem + bowl  (same geometry as the website logo SVG, 40×40 grid)
  doc.path(`M${x + 9 * k} ${y + 7 * k} h${15 * k} a${9 * k} ${9 * k} 0 0 1 0 ${18 * k} h${-7 * k} v${8 * k} h${-8 * k} Z`)
     .fill("#FFFFFF");
  // play-triangle counter
  doc.polygon([x + 17 * k, y + 11.5 * k], [x + 17 * k, y + 20.5 * k], [x + 24 * k, y + 16 * k]).fill(BLUE);
  doc.restore();
}

/** Round seal with a check mark */
function drawSeal(doc, cx, cy, r) {
  doc.save();
  doc.circle(cx, cy, r).fill(BLUE);
  doc.circle(cx, cy, r - 6).lineWidth(1).stroke("#FFFFFF");
  doc.lineWidth(5).lineCap("round").lineJoin("round")
     .moveTo(cx - r * 0.38, cy + r * 0.02)
     .lineTo(cx - r * 0.1, cy + r * 0.3)
     .lineTo(cx + r * 0.42, cy - r * 0.28)
     .stroke("#FFFFFF");
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#FFFFFF")
     .text("VERIFIED", cx - r, cy + r * 0.48, { width: r * 2, align: "center", characterSpacing: 1.5 });
  doc.restore();
}

/**
 * @param {object} d
 * @param {string} d.name            holder full name
 * @param {string} d.courseTitle
 * @param {string} [d.category]
 * @param {string} [d.subCategory]
 * @param {string} [d.trainerName]
 * @param {number} [d.lessonsCount]
 * @param {number|null} [d.score]   final exam score (%), null when the course has no exam
 * @param {Date}   d.date
 * @param {string} d.serial
 * @param {string} d.verificationCode
 * @param {string} [d.verifyUrl]       public page the QR code opens
 * @returns {Promise<{fileName: string, filePath: string}>}
 */
async function generateCertificatePDF(d) {
  const qr = d.verifyUrl
    ? await QRCode.toBuffer(d.verifyUrl, { errorCorrectionLevel: "M", margin: 1, width: 360, color: { dark: INK, light: "#FFFFFF" } })
    : null;
  return new Promise((resolve, reject) => {
    fs.mkdirSync(CERT_DIR, { recursive: true });
    const fileName = `certificate_${d.serial}.pdf`;
    const filePath = path.join(CERT_DIR, fileName);

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 0,
      info: {
        Title: `Certificate of completion — ${d.courseTitle}`,
        Author: "Prologic Academy",
        Subject: `${d.name} — ${d.courseTitle}`
      }
    });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = doc.page.width;   // 841.89
    const H = doc.page.height;  // 595.28
    const BAND = 232;
    const date = new Date(d.date || Date.now());
    const dateText = date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

    // ---------- background ----------
    doc.rect(0, 0, W, H).fill("#FFFFFF");

    // ---------- side band (ink) ----------
    doc.rect(0, 0, BAND, H).fill(INK);
    doc.rect(BAND, 0, 6, H).fill(BLUE);
    // faint grid in the band
    doc.save().opacity(0.06);
    for (let gx = 24; gx < BAND; gx += 24) doc.moveTo(gx, 0).lineTo(gx, H).lineWidth(0.5).stroke("#FFFFFF");
    for (let gy = 24; gy < H; gy += 24) doc.moveTo(0, gy).lineTo(BAND, gy).lineWidth(0.5).stroke("#FFFFFF");
    doc.restore();

    // logo
    drawMark(doc, 36, 44, 46);
    doc.font("Helvetica-Bold").fontSize(17).fillColor("#FFFFFF").text("PROLOGIC", 92, 52, { characterSpacing: 0.6 });
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#9DB4EE").text("ACADEMY", 93, 73, { characterSpacing: 3.6 });

    // verification block
    const vx = 36, vw = BAND - 64;
    let vy = 214;
    const label = (t) => { doc.font("Helvetica-Bold").fontSize(7).fillColor("#9DB4EE").text(t, vx, vy, { width: vw, characterSpacing: 1.6 }); vy += 12; };
    const value = (t, size = 10) => { doc.font("Helvetica").fontSize(size).fillColor("#FFFFFF").text(t, vx, vy, { width: vw }); vy = doc.y + 12; };
    label("CERTIFICATE NO.");   value(d.serial);
    label("VERIFICATION CODE"); value(d.verificationCode);
    label("ISSUED ON");         value(dateText);
    if (qr) {
      // QR code → public verification page with the certificate details
      const qs = 96, qy = Math.max(vy + 4, 392);
      doc.rect(vx, qy, qs + 12, qs + 12).fill("#FFFFFF");
      doc.image(qr, vx + 6, qy + 6, { width: qs, height: qs, link: d.verifyUrl });
      const cy = qy + qs + 22;
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#9DB4EE")
         .text("SCAN TO VERIFY", vx, cy, { width: vw, characterSpacing: 1.6, lineBreak: false });
      doc.font("Helvetica").fontSize(7.5).fillColor("#C7D2EE")
         .text("Opens this certificate's status and details.", vx, cy + 12, { width: vw, lineBreak: false });
    }

    // ---------- main area ----------
    const X = BAND + 64;
    const MW = W - X - 60;

    doc.rect(X, 64, 34, 4).fill(BLUE);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BLUE)
       .text("CERTIFICATE OF COMPLETION", X, 80, { characterSpacing: 3 });

    doc.font("Helvetica").fontSize(13).fillColor(MUTED).text("This certifies that", X, 126);

    // holder name (shrinks to fit one line)
    let nameSize = 40;
    doc.font("Helvetica-Bold");
    while (nameSize > 22 && doc.fontSize(nameSize).widthOfString(d.name) > MW) nameSize -= 2;
    doc.fontSize(nameSize).fillColor(INK).text(d.name, X, 148, { width: MW, lineBreak: false });
    doc.moveTo(X, 148 + nameSize + 10).lineTo(X + MW, 148 + nameSize + 10).lineWidth(1).stroke(LINE);

    doc.font("Helvetica").fontSize(13).fillColor(MUTED)
       .text("has successfully completed the course", X, 148 + nameSize + 26);

    // course title (up to two lines)
    doc.font("Helvetica-Bold").fontSize(22).fillColor(BLUE)
       .text(d.courseTitle, X, 148 + nameSize + 48, { width: MW, height: 60, ellipsis: true, lineGap: 2 });

    // ---------- details row ----------
    const details = [
      ["CATEGORY", [d.category, d.subCategory].filter(Boolean).join(" · ") || "IT training"],
      ["LESSONS", d.lessonsCount ? `${d.lessonsCount} completed` : "All completed"],
      ["FINAL EXAM", d.score != null ? `${d.score}%  passed` : "Not required"],
      ["COMPLETED ON", dateText]
    ];
    const rowY = 352;
    const colW = MW / details.length;
    doc.rect(X, rowY - 14, MW, 62).fill(BLUE_SOFT);
    details.forEach(([k, v], i) => {
      const cx = X + 16 + i * colW;
      doc.font("Helvetica-Bold").fontSize(7).fillColor(BLUE).text(k, cx, rowY, { width: colW - 24, characterSpacing: 1.4 });
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(INK).text(v, cx, rowY + 14, { width: colW - 24, height: 28, ellipsis: true });
    });

    // ---------- signatures ----------
    const sy = 480;
    const sigW = 170;
    doc.moveTo(X, sy).lineTo(X + sigW, sy).lineWidth(1).stroke(INK);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(d.trainerName || "Course trainer", X, sy + 8, { width: sigW });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Trainer", X, sy + 24, { width: sigW });

    const s2 = X + sigW + 36;
    doc.moveTo(s2, sy).lineTo(s2 + sigW, sy).lineWidth(1).stroke(INK);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Prologic Academy", s2, sy + 8, { width: sigW });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Training director", s2, sy + 24, { width: sigW });

    drawSeal(doc, X + MW - 46, sy + 6, 44);

    // footer note
    doc.font("Helvetica").fontSize(7.5).fillColor("#8A909C")
       .text("Prologic Academy · prologic.com.tn — Scan the QR code or enter the certificate number on the verification page.",
             X, H - 36, { width: MW });

    doc.end();
    stream.on("finish", () => resolve({ fileName, filePath }));
    stream.on("error", reject);
  });
}

module.exports = generateCertificatePDF;
module.exports.CERT_DIR = CERT_DIR;
