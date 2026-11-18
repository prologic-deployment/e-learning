const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { aiLimiter } = require('../middlewares/rateLimiter');
const { summarizeCourse } = require('../controllers/nlp.controller');

// ✅ Analyse cours entier — coût Gemini protégé par quota
router.post('/summarize', protect, aiLimiter, summarizeCourse);

module.exports = router;
