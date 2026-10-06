const express = require("express");
const router = express.Router();
const { protect, authorize, requireCourseAccess, wrapStripAnswers } = require("../middlewares/auth.middleware");
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
router.get("/course/:courseId", protect, requireCourseAccess(), wrapStripAnswers, getLessonsByCourse);
// :id here is a LESSON id — tell the access middleware so it resolves the
// parent course correctly (it used to mis-read :id as a course id → 404).
router.get("/:id", protect, requireCourseAccess({ lessonIdParam: "id" }), wrapStripAnswers, getLessonById);
router.post("/course/:courseId", protect, authorize("trainer", "admin"), upload.single("contentFile"), addLesson);
router.put("/:id", protect, authorize("trainer", "admin"), upload.single("contentFile"), updateLesson);
router.delete("/:id", protect, authorize("trainer", "admin"), deleteLesson);

module.exports = router;