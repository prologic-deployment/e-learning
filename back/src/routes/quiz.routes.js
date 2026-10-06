const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const { aiLimiter } = require("../middlewares/rateLimiter");
const {
  addQuizToLesson,
  addQuiz2ToLesson,
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
// ✅ MISSING ROUTE FIX: trainer & admin dashboards call POST /quiz/lesson/:id/quiz2
// to create "Quiz 2" — the controller existed but was never wired to a route,
// so quiz2 creation from the UI returned 404 ("Route introuvable").
router.post("/lesson/:lessonId/quiz2", protect, authorize("trainer", "admin"), addQuiz2ToLesson);
router.post("/lesson/:lessonId/submit", protect, aiLimiter, submitLessonQuiz);
router.post("/lesson/:lessonId/submit/quiz2", protect, aiLimiter, submitLessonQuiz2);
router.post("/final/:courseId/submit", protect, aiLimiter, submitFinalExam);
// ✅ MISSING ROUTE FIX: trainer & admin dashboards call POST /quiz/final/:courseId
// to create/save the final exam — previously only the submit route existed,
// so exam creation from the UI 404'd.
router.post("/final/:courseId", protect, authorize("trainer", "admin"), addFinalExam);
router.get("/results/all", protect, authorize("admin", "trainer"), getAllQuizResults);
router.delete("/lesson/:lessonId/delete", protect, authorize("trainer", "admin"), deleteQuizFromLesson);
router.delete("/lesson/:lessonId/quiz2/delete", protect, authorize("trainer", "admin"), deleteQuiz2FromLesson);
router.delete("/final/:courseId/delete", protect, authorize("trainer", "admin"), deleteFinalExam);

module.exports = router;