const User = require("../models/User");
const bcrypt = require("bcrypt");
const { sendEmail } = require("../services/email.service");
const config = require("../config/env");

// ================= UPDATE SON PROFIL (self-service) =================
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id; // depuis auth middleware
    const { firstname, lastname, email } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (firstname) user.firstname = firstname;
    if (lastname) user.lastname = lastname;
    if (email) user.email = email;

    // ✅ SECURITY FIX: profile updates no longer accept a password. Password
    // changes go through /api/auth/change-password which requires the current
    // password (this endpoint was a privilege side-channel).
    if (req.body.password) {
      return res.status(400).json({
        message: "Use /api/auth/change-password to change your password"
      });
    }

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ================= UPDATE ROLE / STATUS (admin only) =================
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    res.status(200).json({
      message: "User role/status updated successfully",
      user: {
        id: user._id,
        role: user.role,
        isActive: user.isActive
      }
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ================= DELETE USER (admin only) =================
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await User.findByIdAndDelete(id);

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.createTrainer = async (req, res) => {
  try {
    // ✅ Defense-in-depth: route also has authorize("admin") but normalize here too
    const role = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    if (role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { firstname, lastname, email, password, dateOfBirth } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const trainer = new User({
      firstname, lastname, email, password,
      role: "trainer", dateOfBirth
    });

    await trainer.save();

    // 📧 Email credentials — link instead of raw password when possible
    await sendEmail({
      to: email,
      subject: "🎓 Bienvenue — Vos identifiants Trainer",
      html: `
        <h2>Bienvenue ${firstname} ${lastname} ! 👋</h2>
        <p>Votre compte <strong>Trainer</strong> a été créé sur la plateforme E-Learning.</p>
        <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin:20px 0;">
          <h3>🔐 Vos identifiants de connexion</h3>
          <p><strong>Email :</strong> ${email}</p>
          <p><strong>Mot de passe temporaire :</strong> ${password}</p>
        </div>
        <p style="color:red;">⚠️ Ce mot de passe est temporaire — changez-le dès la première connexion !</p>
        <a href="${config.frontendUrl}/profile-authentication" 
           style="background:#2c3e50;color:white;padding:12px 25px;text-decoration:none;border-radius:5px;display:inline-block;">
          🚀 Se connecter
        </a>
      `
    });

    res.status(201).json({
      message: "Trainer created successfully",
      trainer: {
        id: trainer._id, firstname: trainer.firstname,
        lastname: trainer.lastname, email: trainer.email, role: trainer.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.createManager = async (req, res) => {
  try {
    const role = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    if (role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { firstname, lastname, email, password, dateOfBirth } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const manager = new User({
      firstname, lastname, email, password,
      role: "manager", dateOfBirth
    });

    await manager.save();

    // 📧 Email credentials — link instead of raw password when possible
    await sendEmail({
      to: email,
      subject: "🎓 Bienvenue — Vos identifiants Manager",
      html: `
        <h2>Bienvenue ${firstname} ${lastname} ! 👋</h2>
        <p>Votre compte <strong>Manager</strong> a été créé sur la plateforme E-Learning.</p>
        <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin:20px 0;">
          <h3>🔐 Vos identifiants de connexion</h3>
          <p><strong>Email :</strong> ${email}</p>
          <p><strong>Mot de passe temporaire :</strong> ${password}</p>
        </div>
        <p style="color:red;">⚠️ Ce mot de passe est temporaire — changez-le dès la première connexion !</p>
        <a href="${config.frontendUrl}/profile-authentication" 
           style="background:#2c3e50;color:white;padding:12px 25px;text-decoration:none;border-radius:5px;display:inline-block;">
          🚀 Se connecter
        </a>
      `
    });

    res.status(201).json({
      message: "Manager created successfully",
      manager: {
        id: manager._id, firstname: manager.firstname,
        lastname: manager.lastname, email: manager.email, role: manager.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    await User.findByIdAndUpdate(req.user._id, { avatar: avatarUrl });

    res.status(200).json({ message: "Avatar updated", avatarUrl });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
