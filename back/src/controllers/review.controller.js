const Review = require("../models/Review");
const Enrollment = require("../models/Enrollment");
const { checkReviewBadges } = require("../services/badge.service");

// ✅ Ajouter un avis
exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const courseId = req.params.courseId;

    const enrollment = await Enrollment.findOne({
      user: req.user._id,
      course: courseId
    });

    if (!enrollment) {
      return res.status(400).json({ message: "You must be enrolled to leave a review" });
    }

    const existing = await Review.findOne({
      user: req.user._id,
      course: courseId
    });

    if (existing) {
      return res.status(400).json({ message: "You already reviewed this course" });
    }

    const review = await Review.create({
      user: req.user._id,
      course: courseId,
      rating,
      comment,
      isApproved: false //  en attente d'approbation
    });

    checkReviewBadges(req.user._id).catch(console.error);

    await review.populate("user", "firstname lastname avatar");

    // ✅ Notifier le user que son review est en attente
    const { createNotification } = require("../services/notification.service");
    await createNotification(
      req.user._id,
      "REVIEW_PENDING",
      " Review submitted !",
      "Your review is pending admin approval.",
      { courseId }
    );

    res.status(201).json({
      message: "Review submitted and pending approval ! ",
      review
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Récupérer les avis d'un cours
exports.getCourseReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
      course: req.params.courseId,
      isApproved: true  //  seulement approuvés
    })
      .populate("user", "firstname lastname avatar")
      .sort({ createdAt: -1 });

    const avgRating = reviews.length > 0
      ? Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length * 10) / 10
      : 0;

    res.status(200).json({ reviews, avgRating, total: reviews.length });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Modifier son avis
exports.updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    review.rating = rating || review.rating;
    review.comment = comment || review.comment;
    await review.save();

    // ✅ Vérifier badges après update review
    checkReviewBadges(req.user._id).catch(console.error);

    await review.populate("user", "firstname lastname avatar");

    res.status(200).json({ message: "Review updated", review });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Supprimer un avis
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;

    if (userRole !== "admin" && review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    await Review.findByIdAndDelete(req.params.reviewId);
    res.status(200).json({ message: "Review deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("user", "firstname lastname email avatar")
      .populate("course", "title category")
      .sort({ createdAt: -1 });

    res.status(200).json({ reviews, total: reviews.length });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Admin — approuver un review
exports.approveReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    review.isApproved = true;
    await review.save();

    // ✅ Notifier le user que son review est approuvé
    const { createNotification } = require("../services/notification.service");
    await createNotification(
      review.user,
      "REVIEW_APPROVED",
      " Your review has been approved !",
      "Your review is now visible to everyone.",
      { courseId: review.course }
    );

    res.status(200).json({ message: "Review approved", review });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Admin — rejeter un review
exports.rejectReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    await Review.findByIdAndDelete(req.params.reviewId);

    res.status(200).json({ message: "Review rejected and deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
