const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ragSearch, keywordSearch, indexCourses } = require("../services/rag.service");
const config = require("../config/env");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const FRONTEND_URL = config.frontendUrl;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

exports.chat = async (req, res) => {
  try {
    const { message, history, userId } = req.body;

    let ragResults = await ragSearch(message, 6);

    // ✅ RESILIENCE: the vector store may be down, unindexed, or unreachable
    // (e.g. Qdrant not running → "fetch failed"). Fall back to a keyword search
    // over MongoDB so EduBot keeps finding courses that actually exist.
    if (!ragResults.length) {
      console.log("ℹ️ Vector search empty/unavailable — using MongoDB keyword fallback");
      ragResults = await keywordSearch(message, 6);
    }

    // ✅ Construire le contexte RAG avec URLs
    const ragContext = ragResults.length > 0
      ? ragResults.map(r => {
          const meta = r.metadata || {};
          const courseUrl = meta.courseId
            ? `${FRONTEND_URL}/courses-details/${meta.courseId}`
            : null;
          return `
📚 Cours: ${meta.title || 'N/A'}
👨‍🏫 Formateur: ${meta.trainer || 'N/A'}
🏷️ Catégorie: ${meta.category || 'N/A'} ${meta.subCategory ? '> ' + meta.subCategory : ''}
💰 Prix: ${meta.price === 0 ? 'Gratuit' : (meta.price + ' TND') || 'N/A'}
⭐ Note: ${meta.rating || 'N/A'}
📝 Description: ${r.document || 'N/A'}
🔗 URL: ${courseUrl || 'Non disponible'}
---`;
        }).join('\n')
      : "Aucun cours trouvé pour cette recherche.";

    const systemPrompt = `Tu es EduBot, l'assistant IA officiel d'une plateforme e-learning tunisienne professionnelle.
Tu es expert en formation en ligne, pédagogie et orientation professionnelle.
Tu réponds en français ou anglais selon la langue utilisée par l'utilisateur.

=== COURS DISPONIBLES SUR LA PLATEFORME ===
${ragContext}
============================================

=== TES RESPONSABILITÉS ===
1. ORIENTATION : Aide les utilisateurs à trouver le cours qui correspond à leurs besoins
2. INFORMATIONS : Fournis des infos précises sur les cours (prix, formateur, contenu)
3. URLS : Donne toujours le lien direct vers le cours quand disponible
4. CONSEILS : Donne des conseils pédagogiques professionnels
5. SUPPORT : Aide avec les questions sur la plateforme

=== RÈGLES DE RÉPONSE ===
- Réponds UNIQUEMENT sur la base du contexte fourni ci-dessus
- Si l'utilisateur demande un lien/URL d'un cours, fournis le lien complet : ${FRONTEND_URL}/courses-details/[ID]
- Si l'info n'est pas disponible, dis poliment : "Je n'ai pas cette information pour le moment"
- Sois TOUJOURS professionnel, bienveillant et précis
- Structure tes réponses avec des emojis pour la lisibilité
- Propose des alternatives si le cours demandé n'existe pas
- Mentionne toujours le prix (gratuit ou en TND)
- Si plusieurs cours correspondent, liste-les tous avec leurs liens
- Ne jamais inventer d'informations non présentes dans le contexte

=== FORMAT DE RÉPONSE POUR UN COURS ===
Quand tu présentes un cours, utilise ce format :
📚 **[Titre du cours]**
👨‍🏫 Formateur : [Nom]
💰 Prix : [Prix]
🔗 Accéder au cours : [URL complète]
📝 [Brève description]

=== EXEMPLES DE QUESTIONS FRÉQUENTES ===
- "Quel est le lien du cours X ?" → Donne l'URL directe
- "Combien coûte le cours Y ?" → Donne le prix exact
- "Je veux apprendre Python" → Liste les cours Python disponibles
- "Qui enseigne le cours Z ?" → Donne le nom du formateur
- "Est-ce qu'il y a des cours gratuits ?" → Liste les cours gratuits`;

    let response = null;
    let lastError = null;

    for (let i = 0; i < 3; i++) {
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction: systemPrompt,
          generationConfig: {
            temperature: 0.3,      // ✅ Moins créatif = plus précis
            topP: 0.8,
            maxOutputTokens: 1024
          }
        });

        const chatHistory = (history || []).map((msg) => ({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({ history: chatHistory });
        const result = await chat.sendMessage(message);
        response = result.response.text();
        break;
      } catch (error) {
        lastError = error;
        if (error.message.includes('503') || error.message.includes('429')) {
          console.log(`⚠️ Gemini rate limit, waiting ${(i + 1) * 5}s...`);
          await sleep((i + 1) * 5000);
        } else {
          throw error;
        }
      }
    }

    if (!response) throw lastError;

    res.status(200).json({
      message: response,
      role: 'model',
      sources: ragResults.map(r => ({
        title: r.metadata?.title || '',
        url: r.metadata?.courseId
          ? `${FRONTEND_URL}/courses-details/${r.metadata.courseId}`
          : null,
        price: r.metadata?.price === 0 ? 'Gratuit' : `${r.metadata?.price} TND`
      })).filter(s => s.title)
    });

  } catch (error) {
    console.error('❌ Chatbot error:', error.message);
    res.status(500).json({ message: "Chatbot error" });
  }
};

exports.reindex = async (req, res) => {
  try {
    await indexCourses();
    res.json({ message: "Re-indexing done !" });
  } catch (error) {
    res.status(500).json({ message: "Re-indexing failed" });
  }
};