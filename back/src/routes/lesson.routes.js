const express = require("express");
const router = express.Router();
const { protect, authorize, requireCourseAccess, stripAnswers } = require("../middlewares/auth.middleware");
const upload = require("../config/multer");
const {
  addLesson,
  getLessonsByCourse,
  getLessonById,
  updateLesson,
  deleteLesson
} = require("../controllers/lessonController");

// ✅ CONTENT GATE: lessons require enrollment/purchase (staff & free previews pass).
// ✅ ANSWERS STRIPPED: correctAnswer never leaves the server on these routes.
router.get("/course/:courseId", protect, requireCourseAccess(), stripAnswers, getLessonsByCourse);
router.get("/:id", protect, requireCourseAccess(), stripAnswers, getLessonById);
router.post("/course/:courseId", protect, authorize("trainer", "admin"), upload.single("contentFile"), addLesson);
router.put("/:id", protect, authorize("trainer", "admin"), upload.single("contentFile"), updateLesson);
router.delete("/:id", protect, authorize("trainer", "admin"), deleteLesson);

module.exports = router;