const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { sendOTPEmail, sendEmail } = require('../services/email.service');
const config = require('../config/env');

const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

// ===== REGISTER =====
exports.register = async (req, res, next) => {
  try {
    // ✅ SECURITY: role is NEVER accepted from the client. Public registration
    // always creates a plain "user". Staff accounts are created by admins via
    // /api/users/create-trainer and /api/users/managers.
    const { firstname, lastname, email, password, dateOfBirth, phone } = req.body;
    const forbiddenRole = req.body.role && req.body.role !== "user";

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const user = new User({
      firstname, lastname, email, password,
      role: "user", // ✅ locked server-side
      dateOfBirth, phone
    });
    await user.save();

    if (forbiddenRole) {
      console.warn(`🚨 Registration attempt with elevated role rejected: ${email}`);
    }

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: { id: user._id, firstname, lastname, email, role }
    });
  } catch (error) {
    next(error);
  }
};

// ===== LOGIN =====
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Vérifier blocage login
    if (user.loginBlockedUntil && user.loginBlockedUntil > Date.now()) {
      const remainingMs = user.loginBlockedUntil - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      return res.status(403).json({
        success: false,
        message: `Account temporarily blocked. Try again in ${remainingMin} minute(s).`
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= 5) {
        user.loginBlockedUntil = new Date(Date.now() + 10 * 60 * 1000);
        user.loginAttempts = 0;
      }
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // ✅ Reset tentatives
    user.loginAttempts = 0;
    user.loginBlockedUntil = null;

    // ✅ Normalize role (legacy accounts may still hold an array)
    const userRole = Array.isArray(user.role) ? user.role[0] : user.role;

    if (Array.isArray(user.role)) {
      await User.findByIdAndUpdate(user._id, { role: userRole });
    }

    // ✅ SECURITY: every role (including admin) goes through OTP — no single-factor
    // bypass for the highest-privilege account.
    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    user.otp = hashedOtp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
    user.otpAttempts = 0;
    user.otpBlockedUntil = null;

    await user.save();

    sendOTPEmail(user.email, otp).catch(err =>
      console.error('❌ OTP email error:', err.message)
    );

    // ✅ DEV TESTING AID: fake @test.com inboxes can't receive OTP emails, so in
    // non-production (and only when DEV_EXPOSE_OTP=true) the code is returned so
    // manual testing can complete the flow. Hard-blocked in production.
    const payload = {
      success: true,
      message: "OTP sent to your email"
    };
    if (config.nodeEnv !== "production" && config.devExposeOtp) {
      payload.devOtp = otp;
    }

    res.status(200).json(payload);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ===== VERIFY OTP =====
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email }).select("+otp");

    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    if (!user.otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    if (user.otpBlockedUntil && user.otpBlockedUntil > Date.now()) {
      return res.status(403).json({
        success: false,
        message: "Too many attempts. Try later."
      });
    }

    const isValidOtp = await bcrypt.compare(otp, user.otp);
    if (!isValidOtp) {
      user.otpAttempts += 1;
      if (user.otpAttempts >= 3) {
        user.otpBlockedUntil = Date.now() + 10 * 60 * 1000;
        user.otpAttempts = 0;
      }
      await user.save();
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    user.otp = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    user.otpBlockedUntil = null;

    // ✅ Normaliser le role
    const userRole = Array.isArray(user.role) ? user.role[0] : user.role;
    if (Array.isArray(user.role)) {
      user.role = userRole;
    }

    await user.save();

    const token = signToken({ _id: user._id, role: userRole, tokenVersion: user.tokenVersion || 0 });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          role: userRole
        }
      }
    });
  } catch (error) {
    console.error("verifyOTP error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===== FORGOT PASSWORD =====
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // ✅ SECURITY: always answer the same way — no account enumeration.
    const genericResponse = { success: true, message: "If that account exists, a reset link has been sent" };

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    // ✅ SECURITY: store only the SHA-256 HASH of the token — a DB leak cannot
    // be replayed as valid reset links.
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

    await user.save();

    const resetLink = `${config.frontendUrl}/reset-password/${resetToken}`;

    // ✅ Envoyer en arrière-plan
    sendEmail({
      to: user.email,
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
          <h2>🔐 Password Reset Request</h2>
          <p>Hello <strong>${user.firstname}</strong>,</p>
          <p>You requested to reset your password. Click the button below :</p>
          <a href="${resetLink}"
            style="background: #667eea; color: white; padding: 12px 24px;
            border-radius: 8px; text-decoration: none;
            display: inline-block; margin: 20px 0;">
            🔑 Reset Password
          </a>
          <p>This link expires in <strong>10 minutes</strong>.</p>
          <p>If you didn't request this, ignore this email.</p>
        </div>
      `
    }).catch(err => console.error('❌ Email error:', err.message));

    res.json(genericResponse);

  } catch (error) {
    console.error('forgotPassword error:', error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ===== RESET PASSWORD =====
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword, password } = req.body;
    const pwd = newPassword || password;

    if (!pwd) {
      return res.status(400).json({ message: "New password is required" });
    }

    // Token is stored hashed — hash the presented token before lookup
    const user = await User.findOne({
      resetPasswordToken: crypto.createHash("sha256").update(token).digest("hex"),
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = pwd;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    // ✅ Invalidate every existing session after a password reset
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    await user.save();

    // ✅ Envoyer en arrière-plan
    sendEmail({
      to: user.email,
      subject: '🔐 Password Changed Successfully',
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
          <h2>🔐 Password Changed</h2>
          <p>Hello <strong>${user.firstname}</strong>,</p>
          <p>Your password has been changed successfully.</p>
          <p>If you didn't make this change, please contact us immediately.</p>
          <div style="background: #f8f9fa; padding: 15px;
            border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;">
              📅 Date: <strong>${new Date().toLocaleString()}</strong>
            </p>
          </div>
        </div>
      `
    }).catch(err => console.error('❌ Email error:', err.message));

    res.json({ success: true, message: "Password updated successfully" });

  } catch (error) {
    console.error('resetPassword error:', error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ===== CHANGE PASSWORD =====
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password incorrect" });
    }

    user.password = newPassword;
    // ✅ Invalidate every existing session after a password change
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // ✅ Envoyer en arrière-plan
    sendEmail({
      to: user.email,
      subject: '🔐 Password Changed Successfully',
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
          <h2>🔐 Password Changed</h2>
          <p>Hello <strong>${user.firstname}</strong>,</p>
          <p>Your password has been changed successfully.</p>
          <p>📅 Date: <strong>${new Date().toLocaleString()}</strong></p>
          <p>If you didn't make this change, please contact us immediately.</p>
        </div>
      `
    }).catch(err => console.error('❌ Email error:', err.message));

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};