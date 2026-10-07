const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/role.middleware");
const {
  addReview,
  getCourseReviews,
  updateReview,
  deleteReview,
  getAllReviews,
  approveReview,
  rejectReview
} = require("../controllers/review.controller");

router.get("/all", protect, authorize("admin"), getAllReviews);           //
router.get("/course/:courseId", getCourseReviews);                        //  public
router.post("/course/:courseId", protect, addReview);
router.put("/:reviewId", protect, updateReview);
router.delete("/:reviewId", protect, deleteReview);
router.patch("/:reviewId/approve", protect, authorize("admin"), approveReview);
router.patch("/:reviewId/reject", protect, authorize("admin"), rejectReview);

module.exports = router;
