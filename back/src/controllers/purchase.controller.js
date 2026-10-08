const Purchase = require("../models/Purchase");
const Enrollment = require("../models/Enrollment");
const Course = require("../models/Course");

// Acheter un cours
exports.buyCourse = async (req, res) => {
  try {
    const { courseId, paymentMethod = "card" } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (course.price === 0) {
      return res.status(400).json({ message: "This course is free, use enrollment instead" });
    }

    // Vérifier si déjà acheté
    const existingPurchase = await Purchase.findOne({
      user: req.user._id,
      course: courseId,
      paymentStatus: "paid"
    });

    if (existingPurchase) {
      return res.status(400).json({ message: "Course already purchased" });
    }

    // Créer le paiement
    const purchase = await Purchase.create({
      user: req.user._id,
      course: courseId,
      amount: course.price,
      paymentMethod,
      paymentStatus: "paid", // simulation paiement réussi
      inscriptionStatus: "active"
    });

    // ✅ Inscription automatique après paiement
    await Enrollment.create({
      user: req.user._id,
      course: courseId
    });

    res.status(201).json({
      message: "Course purchased and enrolled successfully",
      purchase
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Historique des achats
exports.getMyPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find({ user: req.user._id })
      .populate("course", "title description price image");

    res.status(200).json({ purchases });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Shape matching the frontend user-dashboard (expects a raw array)
exports.getMyPurchasesArray = async (req, res) => {
  try {
    const purchases = await Purchase.find({ user: req.user._id })
      .populate("course", "title description price image");

    res.status(200).json(purchases);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// Shared browser/server input contract. Route guards still run first.
for (const name of ["buyCourse"]) {
  exports[name] = require("../validation/validate-input").withInputValidation(exports[name]);
}
