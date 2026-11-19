const Certificate = require("../models/Certificate");
const Enrollment = require("../models/Enrollment");
const Course = require("../models/Course");
const User = require("../models/User");
const { isEligible, issueCertificate, hasFinalExam } = require("../services/certificate.service");
const { createNotification } = require("../services/notification.service");
const { sendEmail } = require("../services/email.service");
const { checkCertificateBadges } = require("../services/badge.service");
const config = require("../config/env");

// Générer / récupérer son certificat (POST /api/certificates/generate)
// ✅ Same eligibility rule as automatic issuing: all quiz lessons passed AND
// the final exam passed when the course has one.
exports.generateCertificate = async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ message: "courseId is required" });

    const [enrollment, course] = await Promise.all([
      Enrollment.findOne({ user: req.user._id, course: courseId }),
      Course.findById(courseId).select("title trainer finalExam")
    ]);
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (!(await isEligible(enrollment, course))) {
      return res.status(400).json({
        message: hasFinalExam(course)
          ? "Complete every lesson and pass the final exam to get your certificate"
          : "Complete every lesson to get your certificate"
      });
    }

    const score = hasFinalExam(course) ? (enrollment.finalExamResult?.score ?? null) : null;
    const { certificate, created } = await issueCertificate({ userId: req.user._id, courseId, score });

    res.status(created ? 201 : 200).json({
      message: created ? "Certificate generated successfully" : "Certificate already issued",
      certificate,
      downloadUrl: `/api/files/certificate/${certificate._id}`
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Mes certificats
exports.getMyCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.find({ user: req.user._id })
      .populate("course", "title description")
      .populate("trainer", "firstname lastname");

    res.status(200).json(certificates);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Certificats d'un user (Admin/Manager)
exports.getCertificatesByUser = async (req, res) => {
  try {
    const certificates = await Certificate.find({ user: req.params.userId })
      .populate("course", "title description")
      .populate("user", "firstname lastname email");

    res.status(200).json(certificates);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Vérifier la validité d'un certificat — public, sans données personnelles
exports.verifyCertificate = async (req, res) => {
  try {
    const crypto = require("crypto");
    const certificate = await Certificate.findById(req.params.id)
      .populate("user", "firstname lastname") // ✅ NO email exposed publicly
      .populate("course", "title");

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    // ✅ Recompute the HMAC to prove this certificate was issued by this platform
    let authentic = false;
    if (certificate.serial && certificate.verificationCode) {
      const secret = process.env.JWT_SECRET || "dev-only-secret";
      const expected = crypto
        .createHmac("sha256", secret)
        .update(`${certificate.serial}|${certificate.user.firstname} ${certificate.user.lastname}|${certificate.course.title}`)
        .digest("hex")
        .substring(0, 16)
        .toUpperCase();
      authentic = expected === certificate.verificationCode;
    }

    // ✅ Public response: validity + holder name + course + serial — nothing else
    res.status(200).json({
      isValid: certificate.isValid && authentic,
      certificate: {
        serial: certificate.serial,
        holder: `${certificate.user.firstname} ${certificate.user.lastname}`,
        course: certificate.course.title,
        date: certificate.date,
        authentic
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Révoquer un certificat (Admin)
exports.revokeCertificate = async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    certificate.isValid = false;
    await certificate.save();
    checkCertificateBadges(req.user._id).catch(console.error);

    res.status(200).json({ message: "Certificate revoked", certificate });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// ✅ PUBLIC — certificate details by serial (the QR code on the PDF opens the
// /verify/<serial> page, which calls this). Serials are random (48 bits), and
// the response holds only what is printed on the certificate itself.
exports.getPublicCertificate = async (req, res) => {
  try {
    const { signature } = require("../services/certificate.service");
    const serial = String(req.params.serial || "").trim().toUpperCase();
    if (!/^CERT-\d{4}-[0-9A-F]{6,24}$/.test(serial)) {
      return res.status(404).json({ found: false, message: "Certificate not found" });
    }

    const certificate = await Certificate.findOne({ serial })
      .populate("user", "firstname lastname")
      .populate({ path: "course", select: "title category subCategory finalExam.questions trainer", populate: { path: "trainer", select: "firstname lastname" } });

    if (!certificate || !certificate.user || !certificate.course) {
      return res.status(404).json({ found: false, message: "Certificate not found" });
    }

    const holder = `${certificate.user.firstname} ${certificate.user.lastname}`;
    const authentic = !!certificate.verificationCode &&
      signature(certificate.serial, holder, certificate.course.title) === certificate.verificationCode;
    const status = !authentic ? "invalid" : certificate.isValid ? "valid" : "revoked";
    const trainer = certificate.course.trainer;

    res.set("Cache-Control", "no-store");
    res.status(200).json({
      found: true,
      status,                       // valid | revoked | invalid
      isValid: status === "valid",
      certificate: {
        serial: certificate.serial,
        verificationCode: certificate.verificationCode,
        holder,
        course: certificate.course.title,
        category: certificate.course.category || null,
        subCategory: certificate.course.subCategory || null,
        trainer: trainer ? `${trainer.firstname} ${trainer.lastname}` : null,
        score: certificate.score ?? null,
        issuedAt: certificate.date,
        issuer: "Prologic Academy"
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
