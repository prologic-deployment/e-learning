const Certificate = require("../models/Certificate");
const Enrollment = require("../models/Enrollment");
const Course = require("../models/Course");
const User = require("../models/User");
const generateCertificatePDF = require("../utils/generateCertificatePDF");
const { createNotification } = require("../services/notification.service");
const { sendEmail } = require("../services/email.service");
const { checkCertificateBadges } = require("../services/badge.service");
const config = require("../config/env");

// Générer un certificat
exports.generateCertificate = async (req, res) => {
  try {
    const { courseId } = req.body;

    const enrollment = await Enrollment.findOne({
      user: req.user._id,
      course: courseId,
      completed: true
    });

    if (!enrollment) {
      return res.status(400).json({
        message: "You must complete the course 100% before getting a certificate"
      });
    }

    const existing = await Certificate.findOne({
      user: req.user._id,
      course: courseId
    });

    if (existing) {
      return res.status(400).json({
        message: "Certificate already generated",
        certificate: existing
      });
    }

    const user = await User.findById(req.user._id).select("firstname lastname email");
    const course = await Course.findById(courseId).populate("trainer", "email");

    const employeeName = `${user.firstname} ${user.lastname}`;
    const courseName = course.title;

    const { fileName, serial, verificationCode } = await generateCertificatePDF(
      employeeName,
      courseName,
      new Date()
    );

    const certificateUrl = `/uploads/certificates/${fileName}`;

    const certificate = await Certificate.create({
      user: req.user._id,
      course: courseId,
      trainer: course.trainer._id,
      date: new Date(),
      certificateUrl,
      serial,
      verificationCode,
      isValid: true
    });

    // 🔔 Notification in-app
    await createNotification(
      req.user._id,
      "BADGE_EARNED",
      " Félicitations ! Certificat obtenu !",
      `Vous avez complété le cours "${courseName}" et obtenu votre certificat !`,
      { courseId }
    );

    // 📧 Email
    await sendEmail({
      to: user.email,
      subject: " Félicitations ! Certificat obtenu !",
      html: `
        <h2>Félicitations ${user.firstname} ! </h2>
        <p>Vous avez complété avec succès le cours <strong>${courseName}</strong>.</p>
        <p>Votre certificat est maintenant disponible dans votre dashboard.</p>
        <br>
        <a href="${config.frontendUrl}/dashboard"
           style="background:#2c3e50;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
          Voir mon certificat
        </a>
      `
    });

    res.status(201).json({
      message: "Certificate generated successfully ",
      certificate,
      downloadUrl: certificateUrl
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
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
      .populate("user", "firstname lastname") //  NO email exposed publicly
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
