const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true
  },
  trainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  date: { type: Date, default: Date.now },
  certificateUrl: { type: String },
  // ✅ Integrity: unique serial + HMAC verification code (anti-forgery)
  serial: { type: String, unique: true, sparse: true },
  verificationCode: { type: String, default: null },
  // final exam score (%) printed on the certificate; null when the course has no exam
  score: { type: Number, default: null },
  isValid: { type: Boolean, default: true }
}, { timestamps: true });

// Un seul certificat par user par cours
certificateSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model("Certificate", certificateSchema);