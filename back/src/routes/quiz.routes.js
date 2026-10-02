const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const { aiLimiter } = require("../middlewares/rateLimiter");
const {
  addQuizToLesson,
  submitLessonQuiz,
  addFinalExam,
  submitFinalExam,
  submitLessonQuiz2,
  getAllQuizResults,
  deleteQuizFromLesson,
  deleteQuiz2FromLesson,
  deleteFinalExam
} = require("../controllers/quiz.controller");

router.post("/lesson/:lessonId", protect, authorize("trainer", "admin"), addQuizToLesson);
router.post("/lesson/:lessonId/submit", protect, aiLimiter, submitLessonQuiz);
router.post("/lesson/:lessonId/submit/quiz2", protect, aiLimiter, submitLessonQuiz2);
router.post("/final/:courseId/submit", protect, aiLimiter, submitFinalExam);
router.get("/results/all", protect, authorize("admin", "trainer"), getAllQuizResults);
router.delete("/lesson/:lessonId/delete", protect, authorize("trainer", "admin"), deleteQuizFromLesson);
router.delete("/lesson/:lessonId/quiz2/delete", protect, authorize("trainer", "admin"), deleteQuiz2FromLesson);
router.delete("/final/:courseId/delete", protect, authorize("trainer", "admin"), deleteFinalExam);

module.exports = router;