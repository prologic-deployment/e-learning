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
const ALLOWED_ROLES = ["user", "trainer", "manager", "admin"];

exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive } = req.body;

    // ✅ SECURITY: validate the role against the platform enum — an invalid
    // value would otherwise be stored and poison every role check.
    if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Allowed values: ${ALLOWED_ROLES.join(", ")}`
      });
    }

    // ✅ SAFETY: an admin cannot demote/lock their own account (would lock
    // the whole platform out of the admin backoffice).
    if (req.user._id.toString() === id &&
        ((role !== undefined && role !== "admin") || isActive === false)) {
      return res.status(400).json({ message: "Admins cannot change their own role or lock their own account" });
    }

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

    if (req.user._id.toString() === id) {
      return res.status(400).json({ message: "Admins cannot delete their own account" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const role = Array.isArray(user.role) ? user.role[0] : user.role;

    // ✅ DATA INTEGRITY: cascade-delete everything owned by this user so no
    // orphaned enrollments/purchases/reviews/certificates remain.
    const Enrollment = require("../models/Enrollment");
    const Purchase = require("../models/Purchase");
    const Review = require("../models/Review");
    const Certificate = require("../models/Certificate");
    const Cart = require("../models/Cart");
    const Notification = require("../models/Notification");

    if (role === "trainer") {
      // Deleting a trainer removes their courses and all dependent records.
      const Course = require("../models/Course");
      const Lesson = require("../models/Lesson");
      const ownCourses = await Course.find({ trainer: id }).select("_id");
      const courseIds = ownCourses.map(c => c._id);

      await Lesson.deleteMany({ course: { $in: courseIds } });
      await Enrollment.deleteMany({ course: { $in: courseIds } });
      await Purchase.deleteMany({ course: { $in: courseIds } });
      await Review.deleteMany({ course: { $in: courseIds } });
      await Certificate.deleteMany({ course: { $in: courseIds } });
      await Course.deleteMany({ _id: { $in: courseIds } });
    }

    await Promise.all([
      Enrollment.deleteMany({ user: id }),
      Purchase.deleteMany({ user: id }),
      Review.deleteMany({ user: id }),
      Certificate.deleteMany({ user: id }),
      Cart.deleteMany({ user: id }),
      Notification.deleteMany({ user: id }).catch(() => {})
    ]);

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

// Unified, admin-only staff creation. Never email or return the password.
exports.createStaff = async (req,res) => {
  const {firstname,lastname,password,dateOfBirth,role}=req.body;
  const email=typeof req.body.email==='string'?req.body.email.trim().toLowerCase():'';
  if(!['manager','trainer','admin'].includes(role)||!firstname?.trim()||!lastname?.trim()||!email||typeof password!=='string'||password.length<8||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||Buffer.byteLength(password)>72){return res.status(400).json({message:'Provide valid staff details and a strong password.'});}
  try{
    const staff=await User.create({firstname:firstname.trim(),lastname:lastname.trim(),email,password,dateOfBirth,role});
    res.status(201).json({message:'Staff account created.',user:{_id:staff._id,firstname:staff.firstname,lastname:staff.lastname,email:staff.email,role:staff.role}});
  }catch(error){res.status(error.code===11000?409:400).json({message:error.code===11000?'An account with this email already exists.':'Staff details could not be saved. Check the required fields.'});}
};
