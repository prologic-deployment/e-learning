const express = require("express");
const router = express.Router();
const { protect, authorize, stripAnswers } = require("../middlewares/auth.middleware");
const { cacheConfig } = require("../middlewares/cache.middleware");
const upload = require("../config/multer");
const {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  approveCourse,
  getAllCoursesForTrainer,
  enrollCourse,
  archiveCourse,
  restoreCourse
} = require("../controllers/course.controller");

// ✅ single definition (was registered twice before — first one won and leaked data)
router.get("/", cacheConfig.medium, getAllCourses);
router.get("/trainer/all", protect, authorize("trainer", "admin"), getAllCoursesForTrainer);

// ✅ PUBLIC course sheet — anonymous storefront works (safe fields only)
router.get("/:id", cacheConfig.short, getCourseById);
router.get("/:id/full", protect, authorize("trainer", "admin"), getCourseById);

router.post("/", protect, authorize("trainer", "admin"), upload.single("contentFile"), createCourse);

router.put("/:id", protect, authorize("trainer", "admin"), updateCourse);

router.delete("/:id", protect, authorize("trainer", "admin"), deleteCourse);

router.put("/:id/approve", protect, authorize("admin"), approveCourse);

router.post("/:id/enroll", protect, authorize("user"), enrollCourse);

router.patch('/:id/archive', protect, authorize('admin'), archiveCourse);
router.patch('/:id/restore', protect, authorize('admin'), restoreCourse);

module.exports = router;