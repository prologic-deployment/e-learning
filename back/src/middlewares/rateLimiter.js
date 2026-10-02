const rateLimit = require("express-rate-limit");
const config = require("../config/env");

const base = {
  standardHeaders: true,
  legacyHeaders: false
};

// Bruteforce on credentials endpoints
const loginLimiter = rateLimit({
  ...base,
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.loginMax,
  message: { success: false, message: "Too many attempts. Please try again later." }
});

// Global API budget per IP
const apiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: config.rateLimit.apiMax,
  message: { success: false, message: "Too many requests, slow down." }
});

// AI endpoints are expensive (Gemini API bill + Whisper CPU) — per user
const aiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  max: config.rateLimit.aiMax,
  keyGenerator: (req) => req.user?.id?.toString() || req.user?._id?.toString() || req.ip,
  message: { success: false, message: "AI feature quota exceeded for this hour. Try again later." }
});

module.exports = { loginLimiter, apiLimiter, aiLimiter };
