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
      { returnDocument: 'after' }
    ).select("firstname lastname email phone address avatar");

    res.status(200).json({ message: "Profile updated", user: updated });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Mettre à jour mon avatar
exports.updateAvatar = async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { returnDocument: 'after' }
    ).select("firstname lastname email avatar");


    res.status(200).json({ message: "Avatar updated", user: updated });
  } catch (error) {
    console.error(' Error:', error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Shared browser/server input contract. Route guards still run first.
for (const name of ["updateProfile", "updateAvatar"]) {
  exports[name] = require("../validation/validate-input").withInputValidation(exports[name]);
}
