const { GoogleGenerativeAI } = require("@google/generative-ai");
const { QdrantClient } = require("@qdrant/js-client-rest");
const crypto = require("crypto");
const Course = require("../models/Course");
const Lesson = require("../models/Lesson");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const COLLECTION_NAME = "elearning_courses";
const VECTOR_SIZE = 3072;

// ✅ RESILIENCE: keyword fallback used when the vector store is unavailable
// (Qdrant down / not indexed / embedding provider failing). Returns results in
// the same shape as ragSearch so callers need no special handling.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'want', 'learn', 'looking', 'course', 'courses',
  'les', 'des', 'une', 'est', 'pour', 'avec', 'dans', 'que', 'qui', 'je', 'tu',
  'veux', 'voudrais', 'cherche', 'trouve', 'trouver', 'propose', 'disponible',
  'tous', 'tout', 'sont', 'quel', 'quelle', 'peux', 'moi', 'sur', 'apprendre'
]);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractKeywords(query) {
  return String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9àâäéèêëïîôöùûüçñ+#.]+/i)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !STOPWORDS.has(w))
    .slice(0, 8);
}

async function keywordSearch(query, nResults = 6) {
  try {
    const keywords = extractKeywords(query);
    const q = String(query || '');
    const wantsFree = /gratuit|free/i.test(q);
    const wantsPaid = /payant|paid|premium/i.test(q);
    if (keywords.length === 0 && !wantsFree && !wantsPaid) return [];

    const regexes = keywords.map(k => ({ $regex: escapeRegex(k), $options: 'i' }));
    const fieldOr = [];
    for (const re of regexes) {
      fieldOr.push(
        { title: re },
        { description: re },
        { category: re },
        { tags: re }
      );
    }
    // ✅ "free/paid courses" ("cours gratuits/payants") match on price too
    if (wantsFree) fieldOr.push({ price: 0 });
    if (wantsPaid) fieldOr.push({ price: { $gt: 0 } });

    const candidates = await Course.find({ isApproved: true, $or: fieldOr })
      .populate('trainer', 'firstname lastname')
      .limit(50)
      .lean();

    const scored = candidates
      .map(c => {
        const title = (c.title || '').toLowerCase();
        const category = (c.category || '').toLowerCase();
        const tags = (c.tags || []).map(t => String(t).toLowerCase());
        const description = (c.description || '').toLowerCase();
        let score = 0;
        // ✅ price-only intents ("cours gratuits/payants") have no textual keyword to match on
        if (wantsFree && c.price === 0) score += 4;
        if (wantsPaid && c.price > 0) score += 4;
        for (const k of keywords) {
          if (title.includes(k)) score += 5;
          if (tags.some(t => t.includes(k))) score += 3;
          if (category.includes(k)) score += 3;
          if (description.includes(k)) score += 1;
        }
        return { course: c, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, nResults);

    return scored.map(({ course: c, score }) => {
      const trainerName = c.trainer
        ? `${c.trainer.firstname} ${c.trainer.lastname}`
        : 'Non spécifié';
      const priceText = c.price === 0 ? 'Gratuit' : `${c.price} TND`;
      return {
        document: `\nTitre du cours: ${c.title}\nCatégorie: ${c.category || 'Non spécifiée'}\nDescription: ${c.description || ''}\nTags: ${c.tags?.join(', ') || 'Aucun'}\nPrix: ${priceText}\nFormateur: ${trainerName}\nStatut: Approuvé et disponible\n      `.trim(),
        metadata: {
          type: 'course',
          courseId: c._id.toString(),
          title: c.title,
          category: c.category || '',
          subCategory: '',
          price: c.price,
          priceText: priceText,
          trainer: trainerName,
          tags: c.tags?.join(', ') || '',
          description: c.description || ''
        },
        score
      };
    });
  } catch (error) {
    console.log(" Keyword search error:", error.message);
    return [];
  }
}

// ✅ Deterministic point IDs — reindexing UPDATES the same points instead of
// accumulating duplicates with incrementing IDs across runs.
const pointIdFor = (type, docId) => {
  const hex = crypto.createHash("md5").update(`${type}:${docId}`).digest("hex").slice(0, 32);
  // Qdrant needs a u32/uuid — build a UUID-shaped string from the hash
  const u = hex.padEnd(32, "0");
  return `${u.slice(0, 8)}-${u.slice(8, 12)}-${u.slice(12, 16)}-${u.slice(16, 20)}-${u.slice(20, 32)}`;
};

let qdrantClient = null;

function getQdrant() {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      checkCompatibility: false
    });
  }
  return qdrantClient;
}

async function initCollection() {
  try {
    const qdrant = getQdrant();
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (!exists) {
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: { size: VECTOR_SIZE, distance: "Cosine" }
      });
      console.log(" Qdrant collection created !");
    } else {
      console.log(" Qdrant collection already exists !");
    }
  } catch (error) {
    console.log(" Qdrant init error:", error.message);
  }
}

async function generateEmbedding(text) {
  const embeddingModel = genAI.getGenerativeModel({
    model: "gemini-embedding-001"
  });
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

async function indexCourses() {
  try {
    const qdrant = getQdrant();
    await initCollection();

    const courses = await Course.find({ isApproved: true })
      .populate("trainer", "firstname lastname email");

    const lessons = await Lesson.find()
      .populate("course", "title category subCategory");

    const points = [];

    // ✅ Indexer les cours avec toutes les métadonnées
    for (const course of courses) {
      const trainerName = course.trainer
        ? `${course.trainer.firstname} ${course.trainer.lastname}`
        : 'Non spécifié';

      const priceText = course.price === 0 ? 'Gratuit' : `${course.price} TND`;

      const text = `
Titre du cours: ${course.title}
Catégorie: ${course.category}${course.subCategory ? ' > ' + course.subCategory : ''}
Description: ${course.description}
Tags: ${course.tags?.join(', ') || 'Aucun'}
Prix: ${priceText}
Formateur: ${trainerName}
Statut: Approuvé et disponible
      `.trim();

      try {
        const embedding = await generateEmbedding(text);
        points.push({
          id: pointIdFor('course', course._id.toString()),
          vector: embedding,
          payload: {
            type: 'course',
            courseId: course._id.toString(),
            title: course.title,
            category: course.category || '',
            subCategory: course.subCategory || '',
            price: course.price,
            priceText: priceText,
            trainer: trainerName,
            // ✅ PRIVACY: trainer emails are no longer indexed into the vector DB
            tags: course.tags?.join(', ') || '',
            description: course.description || '',
            content: text
          }
        });
        console.log(` Indexed course: ${course.title}`);
      } catch (e) {
        console.log(` Skip course ${course.title}:`, e.message);
      }
    }

    // ✅ Indexer les leçons avec référence au cours
    for (const lesson of lessons) {
      const text = `
Leçon: ${lesson.title}
Contenu: ${lesson.content || ''}
Cours parent: ${lesson.course?.title || ''}
Catégorie: ${lesson.course?.category || ''}
      `.trim();

      try {
        const embedding = await generateEmbedding(text);
        points.push({
          id: pointIdFor('lesson', lesson._id.toString()),
          vector: embedding,
          payload: {
            type: 'lesson',
            lessonId: lesson._id.toString(),
            courseId: lesson.course?._id?.toString() || '',
            courseTitle: lesson.course?.title || '',
            title: lesson.title,
            content: text
          }
        });
        console.log(` Indexed lesson: ${lesson.title}`);
      } catch (e) {
        console.log(` Skip lesson ${lesson.title}:`, e.message);
      }
    }

    if (points.length > 0) {
      // ✅ Upserter par batches de 50 pour éviter les timeouts
      const batchSize = 50;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        await qdrant.upsert(COLLECTION_NAME, { wait: true, points: batch });
        console.log(` Batch ${Math.floor(i / batchSize) + 1} upserted (${batch.length} points)`);
      }
      console.log(` Total: ${points.length} documents indexed in Qdrant !`);
    }

  } catch (error) {
    console.log(" Indexing error:", error.message);
  }
}

async function ragSearch(query, nResults = 6) {
  try {
    const qdrant = getQdrant();
    const queryEmbedding = await generateEmbedding(query);

    const results = await qdrant.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit: nResults,
      with_payload: true,
      score_threshold: 0.3  //  filtre les résultats peu pertinents
    });

    return results.map(r => ({
      document: r.payload.content,
      metadata: {
        type: r.payload.type,
        courseId: r.payload.courseId,
        title: r.payload.title,
        category: r.payload.category,
        subCategory: r.payload.subCategory,
        price: r.payload.price,
        priceText: r.payload.priceText,
        trainer: r.payload.trainer,
        tags: r.payload.tags,
        description: r.payload.description,
        courseTitle: r.payload.courseTitle  // pour les leçons
      },
      score: r.score
    }));

  } catch (error) {
    console.log(" RAG search error:", error.message);
    return [];
  }
}

module.exports = { initCollection, indexCourses, ragSearch, keywordSearch };
