const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const {
  generateCertificate,
  getMyCertificates,
  getCertificatesByUser,
  verifyCertificate,
  revokeCertificate
} = require("../controllers/certificate.controller");

router.post("/generate", protect, generateCertificate);
router.get("/me", protect, getMyCertificates);
router.get("/verify/:id", verifyCertificate);
router.get("/user/:userId", protect, authorize("admin", "manager"), getCertificatesByUser);
router.patch("/revoke/:id", protect, authorize("admin"), revokeCertificate);

module.exports = router;