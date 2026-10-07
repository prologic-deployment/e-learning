const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const { aiLimiter } = require("../middlewares/rateLimiter");
const { chat, reindex } = require("../controllers/chatbot.controller");

// Landing chat exposes only the published catalogue. Existing private routes remain protected.
const rateLimit = require("express-rate-limit");
const publicBudget = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: () => "public-catalogue",
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Public assistant quota reached. Please try later." },
});
const publicPerIp = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});
router.post("/public-chat", publicPerIp, publicBudget, chat);

// ✅ Per-user quota — protects the Gemini API budget
router.post("/chat", protect, aiLimiter, chat);
// ✅ Admin only (was any authenticated user)
router.post("/reindex", protect, authorize("admin"), reindex);

module.exports = router;
