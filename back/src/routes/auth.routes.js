const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const { loginLimiter } = require("../middlewares/rateLimiter");

const {
  register,
  login,
  verifyOTP,
  forgotPassword,
  resetPassword,
  changePassword
} = require("../controllers/auth.controller");

// ✅ RATE LIMITED: brute-force protection on all credential endpoints
router.post("/register", loginLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/verify-otp", loginLimiter, verifyOTP);
router.post('/forgot-password', loginLimiter, forgotPassword);
router.post('/reset-password/:token', loginLimiter, resetPassword);

router.post("/change-password", protect, changePassword);

module.exports = router;
