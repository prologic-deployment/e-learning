const express = require('express');
const router = express.Router();
const { protect, authorize, requireCourseAccess } = require('../middlewares/auth.middleware');
const { aiLimiter } = require('../middlewares/rateLimiter');
const {
  summarizeCourse,
  summarizeLesson,
  getLessonSummary,
  whisperStatus
} = require('../controllers/nlp.controller');

// ✅ Analyse cours entier — coût Gemini protégé par quota + accès contenu vérifié
router.post('/summarize', protect, aiLimiter, summarizeCourse);

// ✅ Résumé leçon — réservé aux inscrits/acheteurs/staff ( DATA LEAK FIX )
router.post('/lesson/:lessonId/summarize', protect, requireCourseAccess(), aiLimiter, summarizeLesson);
router.get('/lesson/:lessonId/summary', protect, requireCourseAccess(), getLessonSummary);

// ✅ Statut Whisper — admin seulement
router.get('/whisper/status', protect, authorize('admin'), whisperStatus);

module.exports = router;