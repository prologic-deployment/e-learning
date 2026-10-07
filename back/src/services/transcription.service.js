const axios = require('axios');
const path = require('path');
const fs = require('fs');

const FLASK_URL = process.env.FLASK_URL || 'http://127.0.0.1:5001';
// ✅ Shared secret — must match INTERNAL_API_TOKEN on the Flask side
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || '';

// ✅ Transcription vidéo via Flask/Whisper
exports.transcribeVideo = async (videoPath) => {
  try {
    // ✅ Vérifier que le fichier existe
    const fullPath = path.resolve(videoPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Video file not found: ${fullPath}`);
    }

    console.log(` Transcribing: ${fullPath}`);

    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(fullPath));

    const response = await axios.post(`${FLASK_URL}/transcribe`, form, {
      headers: {
        ...form.getHeaders(),
        // ✅ Authenticate to the internal service
        ...(INTERNAL_API_TOKEN ? { 'X-Internal-Token': INTERNAL_API_TOKEN } : {})
      },
      timeout: 300000 // 5 minutes
    });

    return {
      text: response.data.text,
      language: response.data.language || 'fr',
      duration: response.data.duration || 0,
      segments: response.data.segments || []
    };
  } catch (error) {
    console.error(' Transcription error:', error.message);
    throw new Error(`Transcription failed: ${error.message}`);
  }
};

// ✅ Vérifier si Flask/Whisper est disponible
exports.checkWhisperHealth = async () => {
  try {
    const response = await axios.get(`${FLASK_URL}/health`, {
      timeout: 5000,
      headers: INTERNAL_API_TOKEN ? { 'X-Internal-Token': INTERNAL_API_TOKEN } : {}
    });
    return response.data.status === 'ok';
  } catch {
    return false;
  }
};
