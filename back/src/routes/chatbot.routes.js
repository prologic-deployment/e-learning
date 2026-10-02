const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const { aiLimiter } = require("../middlewares/rateLimiter");
const { chat, reindex } = require("../controllers/chatbot.controller");

// ✅ Per-user quota — protects the Gemini API budget
router.post("/chat", protect, aiLimiter, chat);
// ✅ Admin only (was any authenticated user)
router.post("/reindex", protect, authorize("admin"), reindex);

module.exports = router;