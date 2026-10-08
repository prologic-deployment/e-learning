const { GoogleGenerativeAI } = require("@google/generative-ai");
const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const natural = require("natural");
const nlp = require("compromise");
const transcriptionService = require('../services/transcription.service');
const config = require('../config/env');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ Liste de modèles fallback
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

// ✅ Retry automatique avec fallback de modèles
async function generateWithRetry(prompt, maxRetries = 3) {
  for (let modelIndex = 0; modelIndex < MODELS.length; modelIndex++) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const model = genAI.getGenerativeModel({ model: MODELS[modelIndex] });
        const result = await model.generateContent(prompt);
        console.log(` Used model: ${MODELS[modelIndex]}`);
        return result.response.text();
      } catch (error) {
        if ((error.message.includes('503') || error.message.includes('overloaded'))
            && i < maxRetries - 1) {
          console.log(` ${MODELS[modelIndex]} busy, retry ${i + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        } else if (error.message.includes('503') && i === maxRetries - 1) {
          console.log(` Switching to next model: ${MODELS[modelIndex + 1] || 'none'}...`);
          break;
        } else {
          throw error;
        }
      }
    }
  }
  throw new Error("All models are currently unavailable. Please try again later.");
}

// ✅ Chunking du texte
function chunkText(text, chunkSize = 500, overlap = 50) {
  const words = text.split(' ');
  const chunks = [];
  let i = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    chunks.push(chunk);
    i += chunkSize - overlap;
  }

  return chunks;
}

// ✅ Extraction de mots clés par fréquence TF-IDF
function extractKeywords(text, topN = 10) {
  const TfIdf = natural.TfIdf;
  const tfidf = new TfIdf();
  const tokenizer = new natural.WordTokenizer();

  const stopwords = [
    'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en',
    'est', 'que', 'qui', 'dans', 'pour', 'sur', 'avec', 'par', 'au',
    'the', 'a', 'an', 'is', 'in', 'of', 'to', 'and', 'for', 'on',
    'are', 'this', 'that', 'it', 'be', 'as', 'at', 'or', 'but',
    'from', 'not', 'you', 'he', 'she', 'we', 'they', 'can', 'will',
    'ce', 'se', 'il', 'elle', 'nous', 'vous', 'ils', 'leur', 'plus'
  ];

  tfidf.addDocument(text);
  const tokens = tokenizer.tokenize(text.toLowerCase());

  const wordFreq = {};
  tokens.forEach(token => {
    if (token.length > 3 && !stopwords.includes(token)) {
      wordFreq[token] = (wordFreq[token] || 0) + 1;
    }
  });

  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

// ✅ Extraction d'entités NLP avec compromise
function extractEntities(text) {
  const doc = nlp(text);
  return {
    topics: doc.nouns().out('array').slice(0, 10),
    verbs: doc.verbs().out('array').slice(0, 5)
  };
}

// ✅ Résumé extractif simple (TextRank-like)
function extractiveSummary(text, numSentences = 3) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length <= numSentences) return text;

  const tokenizer = new natural.WordTokenizer();
  const wordFreq = {};

  sentences.forEach(sentence => {
    tokenizer.tokenize(sentence.toLowerCase()).forEach(word => {
      if (word.length > 3) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
  });

  const scoredSentences = sentences.map((sentence, index) => {
    const words = tokenizer.tokenize(sentence.toLowerCase());
    const score = words.reduce((sum, word) => sum + (wordFreq[word] || 0), 0);
    return { sentence, score, index };
  });

  return scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, numSentences)
    .sort((a, b) => a.index - b.index)
    .map(s => s.sentence)
    .join(' ');
}

exports.summarizeCourse = async (req, res) => {
  try {
    const { courseId } = req.body;

    // ✅ Récupérer le cours + leçons
    const course = await Course.findById(courseId)
      .populate("trainer", "firstname lastname");
    const lessons = await Lesson.find({ course: courseId });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // ✅ Construire le texte complet
    const fullText = `
      ${course.title}. ${course.description}.
      ${lessons.map(l => `${l.title}. ${l.content || ''}`).join('. ')}
    `.trim();

    // ✅ Chunking
    const chunks = chunkText(fullText, 300, 30);
    console.log(` ${chunks.length} chunks created`);

    // ✅ NLP classique local
    const keywords = extractKeywords(fullText, 10);
    const entities = extractEntities(fullText);
    const extractiveSumm = extractiveSummary(fullText, 3);

    // ✅ Résumé de chaque chunk avec Gemini + retry + fallback
    const chunkSummaries = [];
    for (const chunk of chunks.slice(0, 5)) {
      const text = await generateWithRetry(
        `Résume ce texte en 1-2 phrases courtes en français:\n${chunk}`
      );
      chunkSummaries.push(text);
    }

    // ✅ Résumé global avec Gemini + retry + fallback
    const globalPrompt = `
Tu es un expert pédagogique. Génère une analyse complète de ce cours.

Cours: ${course.title}
Catégorie: ${course.category}
Résumés des sections: ${chunkSummaries.join(' | ')}
Mots clés extraits: ${keywords.join(', ')}
Leçons: ${lessons.map(l => l.title).join(', ')}

Génère UNIQUEMENT un JSON valide sans backticks avec cette structure:
{
  "summary": "Résumé global complet en 3-4 phrases",
  "chunkSummaries": ${JSON.stringify(chunkSummaries)},
  "keywords": ${JSON.stringify(keywords)},
  "concepts": [
    {"title": "Concept 1", "description": "description courte"},
    {"title": "Concept 2", "description": "description courte"},
    {"title": "Concept 3", "description": "description courte"}
  ],
  "level": "Débutant ou Intermédiaire ou Avancé",
  "duration": "X heures estimées",
  "prerequisites": ["prérequis1", "prérequis2"],
  "objectives": ["objectif1", "objectif2", "objectif3"],
  "targetAudience": "Description du public cible",
  "extractiveSummary": "${extractiveSumm.replace(/"/g, "'")}"
}
    `;

    const globalText = await generateWithRetry(globalPrompt);

    const cleanJson = globalText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanJson);

    res.status(200).json({
      ...parsed,
      nlpStats: {
        totalChunks: chunks.length,
        totalWords: fullText.split(' ').length,
        totalLessons: lessons.length,
        entities: entities.topics.slice(0, 8)
      }
    });

  } catch (error) {
    console.log(' NLP error:', error.message);
    res.status(500).json({ message: "NLP error", error: error.message });
  }
};

// ✅ Résumer une leçon vidéo
exports.summarizeLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const force = req.query.force === 'true';

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: 'Leçon introuvable' });
    }

    if (lesson.contentType !== 'video') {
      return res.status(400).json({ message: 'Cette leçon ne contient pas de vidéo' });
    }

    // ✅ Si résumé déjà existant et pas de force
    if (lesson.summary && !force) {
      return res.status(200).json({
        cached: true,
        summary: lesson.summary,
        transcription: lesson.transcription,
        keyPoints: lesson.keyPoints,
        language: lesson.language,
        summarizedAt: lesson.summarizedAt
      });
    }

    // ✅ Vérifier Flask
    const whisperOk = await transcriptionService.checkWhisperHealth();
    if (!whisperOk) {
      return res.status(503).json({
        message: ' Service Whisper non disponible. Assurez-vous que Flask tourne sur le port 5001.'
      });
    }

    // ✅ Chemin de la vidéo
    const videoPath = lesson.contentFile.startsWith('uploads/')
    ? lesson.contentFile
    : `uploads/${lesson.contentFile}`;
    console.log(` Starting transcription: ${videoPath}`);

    // ✅ Transcription
    const transcriptionResult = await transcriptionService.transcribeVideo(videoPath);
    const transcription = transcriptionResult.text;
    const language = transcriptionResult.language;

    console.log(` Transcription done: ${transcription.substring(0, 100)}...`);

    // ✅ Génération du résumé avec Gemini
    const prompt = `
Tu es un expert pédagogique. Analyse cette transcription de leçon vidéo.

Titre de la leçon: ${lesson.title}
Langue détectée: ${language}
Transcription: ${transcription.substring(0, 3000)}

Génère UNIQUEMENT un JSON valide sans backticks:
{
  "summary": "Résumé clair et structuré de la leçon en 3-5 phrases",
  "keyPoints": ["point clé 1", "point clé 2", "point clé 3", "point clé 4", "point clé 5"],
  "concepts": ["concept 1", "concept 2", "concept 3"],
  "language": "${language}"
}
    `;

    const summaryText = await generateWithRetry(prompt);
    const cleanJson = summaryText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanJson);

    // ✅ Sauvegarder dans la leçon
    lesson.transcription = transcription;
    lesson.summary = parsed.summary;
    lesson.keyPoints = parsed.keyPoints || [];
    lesson.language = parsed.language || language;
    lesson.summarizedAt = new Date();
    await lesson.save();

    console.log(` Summary saved for lesson: ${lesson.title}`);

    res.status(200).json({
      cached: false,
      summary: lesson.summary,
      transcription: lesson.transcription,
      keyPoints: lesson.keyPoints,
      language: lesson.language,
      summarizedAt: lesson.summarizedAt
    });

  } catch (error) {
    console.error(' NLP summarizeLesson error:', error.message);
    res.status(500).json({
      message: 'Erreur lors du résumé',
      error: error.message
    });
  }
};

// ✅ Récupérer le résumé d'une leçon
exports.getLessonSummary = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const lesson = await Lesson.findById(lessonId)
      .select('title summary transcription keyPoints language summarizedAt contentType');

    if (!lesson) {
      return res.status(404).json({ message: 'Leçon introuvable' });
    }

    if (!lesson.summary) {
      return res.status(404).json({ message: 'Aucun résumé disponible pour cette leçon' });
    }

    res.status(200).json({
      title: lesson.title,
      summary: lesson.summary,
      transcription: lesson.transcription,
      keyPoints: lesson.keyPoints,
      language: lesson.language,
      summarizedAt: lesson.summarizedAt
    });

  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// ✅ Statut de Whisper
exports.whisperStatus = async (req, res) => {
  try {
    const isAvailable = await transcriptionService.checkWhisperHealth();
    res.status(200).json({
      available: isAvailable,
      message: isAvailable
        ? ' Whisper est disponible'
        : ' Whisper non disponible — lancez Flask sur le port 5001'
    });
  } catch (error) {
    res.status(500).json({ available: false, message: config.prodLike ? 'Server error' : error.message });
  }
};

// Shared browser/server input contract. Route guards still run first.
for (const name of ["summarizeCourse", "summarizeLesson"]) {
  exports[name] = require("../validation/validate-input").withInputValidation(exports[name]);
}
