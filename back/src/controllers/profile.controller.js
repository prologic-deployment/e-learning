const fs = require("fs");
const path = require("path");
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Purchase = require("../models/Purchase");

// Voir mon profil
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select(
      "firstname lastname email phone address avatar createdAt role"
    );

    const purchases = await Purchase.find({
      user: userId,
      paymentStatus: "paid"
    }).populate("course", "title price");

    const enrollments = await Enrollment.find({
      user: userId
    }).populate("course", "title");

    let averageProgress = 0;
    let completedCourses = 0;

    if (enrollments.length > 0) {
      const totalProgress = enrollments.reduce(
        (acc, curr) => acc + curr.progress, 0
      );
      averageProgress = totalProgress / enrollments.length;
      completedCourses = enrollments.filter(e => e.completed === true).length;
    }

    res.status(200).json({
      user,
      stats: {
        totalPurchasedCourses: purchases.length,
        totalEnrolledCourses: enrollments.length,
        completedCourses,
        averageProgress: Math.round(averageProgress)
      },
      purchasedCourses: purchases,
      enrolledCourses: enrollments
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Mettre à jour mon profil
exports.updateProfile = async (req, res) => {
  try {
    const { firstname, lastname, phone, address } = req.body;

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { firstname, lastname, phone, address },
      { new: true }
    ).select("firstname lastname email phone address avatar");

    res.status(200).json({ message: "Profile updated", user: updated });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Mettre à jour mon avatar
const AVATAR_DIR = path.join(__dirname, "../../uploads/avatars");
const AVATAR_TYPES = [".jpg", ".jpeg", ".png", ".webp"];

exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // only images go to uploads/avatars (multer routes other types elsewhere)
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!AVATAR_TYPES.includes(ext) || !String(req.file.mimetype || "").startsWith("image/")) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: "Avatar must be a JPG, PNG or WEBP image" });
    }
    if (req.file.size > 5 * 1024 * 1024) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: "Avatar must be 5 MB or less" });
    }

    const previous = await User.findById(req.user._id).select("avatar");
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true }
    ).select("firstname lastname email avatar");

    // remove the old file (only files we own inside uploads/avatars)
    const old = previous?.avatar;
    if (old && old !== avatarUrl && old.startsWith("/uploads/avatars/")) {
      fs.unlink(path.join(AVATAR_DIR, path.basename(old)), () => {});
    }

    res.status(200).json({ message: "Avatar updated", user: updated });
  } catch (error) {
    console.error("updateAvatar:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
