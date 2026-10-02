const express = require("express");
const router = express.Router();

const { protect, authorize } = require("../middlewares/auth.middleware");
const { cacheConfig } = require("../middlewares/cache.middleware");

const {
  updateProgress,
  getMyEnrollments,
  enrollInCourse,
  setDeadline
} = require("../controllers/enrollment.controller");

// User — mes enrollments
router.get("/me", protect, getMyEnrollments);

// User — mettre à jour la progression
router.put("/:id/progress", protect, updateProgress);

// User — s'inscrire à un cours
router.post("/:courseId/enroll", protect, enrollInCourse);

// Manager/Admin — définir une deadline
router.patch("/deadline", protect, authorize("manager", "admin"), setDeadline);

module.exports = router;