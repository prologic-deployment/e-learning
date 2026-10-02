const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { protect, requireCourseAccess } = require("../middlewares/auth.middleware");
const Lesson = require("../models/Lesson");

/**
 * ✅ AUTHENTICATED FILE DELIVERY — replaces the old public /uploads static mount.
 * Every request is checked against enrollment/purchase/staff rules, with
 * HTTP Range support so video seek works.
 */

const MIME_BY_EXT = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".pdf": "application/pdf"
};

const safeJoin = (relativePath) => {
  const uploadsRoot = path.resolve(__dirname, "../../uploads");
  const resolved = path.resolve(uploadsRoot, relativePath);
  if (!resolved.startsWith(uploadsRoot + path.sep)) return null; // path traversal
  return resolved;
};

const streamFile = (req, res, absolutePath, downloadName) => {
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ success: false, message: "File not found" });
  }

  const stat = fs.statSync(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] || "application/octet-stream";

  if (downloadName) {
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  }

  // ✅ HTTP Range support (video seek)
  const range = req.headers.range;
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      let start = match[1] ? parseInt(match[1], 10) : 0;
      let end = match[2] ? parseInt(match[2], 10) : stat.size - 1;

      // Cap each chunk at 5 MB to keep memory predictable
      const MAX_CHUNK = 5 * 1024 * 1024;
      if (end - start + 1 > MAX_CHUNK) {
        end = start + MAX_CHUNK - 1;
      }
      if (start >= stat.size || end >= stat.size || start > end) {
        res.setHeader("Content-Range", `bytes */${stat.size}`);
        return res.status(416).end();
      }

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": mime,
        "Cache-Control": "private, no-store"
      });
      return fs.createReadStream(absolutePath, { start, end }).pipe(res);
    }
  }

  res.writeHead(200, {
    "Content-Length": stat.size,
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store"
  });
  fs.createReadStream(absolutePath).pipe(res);
};

// GET /api/files/lesson/:lessonId — lesson video/PDF, access-checked
router.get("/lesson/:lessonId", protect, requireCourseAccess(), async (req, res) => {
  try {
    const lesson = req.lesson || (await Lesson.findById(req.params.lessonId));
    if (!lesson || !lesson.contentFile) {
      return res.status(404).json({ success: false, message: "Content not found" });
    }

    const relative = lesson.contentFile.replace(/\\/g, "/").replace(/^uploads\//, "");
    const absolute = safeJoin(relative);
    if (!absolute) {
      return res.status(400).json({ success: false, message: "Invalid file path" });
    }

    const ext = path.extname(absolute).toLowerCase();
    const download = req.query.download === "1";
    const name = download
      ? `${lesson.title || "content"}${ext}`.replace(/[^\w.\-]/g, "_")
      : undefined;

    streamFile(req, res, absolute, name);
  } catch (error) {
    console.error("file.route error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/files/certificate/:id — own certificate or staff
router.get("/certificate/:id", protect, async (req, res) => {
  try {
    const Certificate = require("../models/Certificate");
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate || !certificate.certificateUrl) {
      return res.status(404).json({ success: false, message: "Certificate not found" });
    }

    // Revoked certificates cannot be downloaded
    if (!certificate.isValid) {
      return res.status(403).json({ success: false, message: "Certificate revoked" });
    }

    const role = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    const isOwner = certificate.user.toString() === req.user._id.toString();
    const isStaff = role === "admin" || role === "manager";
    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const relative = certificate.certificateUrl.replace(/\\/g, "/").replace(/^\/?uploads\//, "");
    const absolute = safeJoin(relative);
    if (!absolute) return res.status(400).json({ success: false, message: "Invalid file path" });

    streamFile(req, res, absolute, "certificate.pdf");
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/files/invoice/:purchaseId — own invoice or staff (PDF generated on demand)
router.get("/invoice/:purchaseId", protect, async (req, res) => {
  try {
    const Purchase = require("../models/Purchase");
    const purchase = await Purchase.findById(req.params.purchaseId)
      .populate("course", "title price");
    if (!purchase) return res.status(404).json({ success: false, message: "Purchase not found" });

    const role = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    const isOwner = purchase.user.toString() === req.user._id.toString();
    if (!isOwner && role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { generateInvoicePDF } = require("../utils/generateInvoicePDF");
    const { filePath } = await generateInvoicePDF(purchase);
    streamFile(req, res, filePath, `invoice_${purchase._id}.pdf`);
  } catch (error) {
    console.error("invoice error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
