import os

# ✅ Portable ffmpeg PATH: append well-known locations instead of a hardcoded
# personal Windows path. Set FFMPEG_DIR in the environment if ffmpeg lives elsewhere.
for candidate in [os.environ.get("FFMPEG_DIR"), "/usr/local/bin", "/usr/bin"]:
    if candidate and os.path.isdir(candidate) and candidate not in os.environ["PATH"]:
        os.environ["PATH"] = candidate + os.pathsep + os.environ["PATH"]

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import pickle
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import whisper
import tempfile
import traceback

app = Flask(__name__)

# ✅ SECURITY: this service performs expensive CPU work (Whisper) and holds the
# recommendation model. It must only be reachable by the Node backend.
# Bind to 127.0.0.1 and require a shared secret header on every request.
from functools import wraps

INTERNAL_API_TOKEN = os.environ.get("INTERNAL_API_TOKEN", "")


def require_internal_token(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if INTERNAL_API_TOKEN:
            provided = request.headers.get("X-Internal-Token", "")
            if provided != INTERNAL_API_TOKEN:
                return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


# CORS restricted to the Node backend origin only
CORS(app, origins=[os.environ.get("BACKEND_ORIGIN", "http://localhost:5000")])

# ✅ Upload cap: Whisper transcribes long files slowly — reject absurd uploads
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024  # 200 MB

# ==========================================
# ✅ CHARGEMENT DES MODÈLES
# ==========================================

# ✅ Charger Whisper
print("🔄 Loading Whisper model...")
whisper_model = whisper.load_model("base")
print("✅ Whisper model loaded!")

# ✅ Charger le modèle de recommandation
print("📦 Loading recommender model...")
df_kaggle = pd.read_csv('courses_processed.csv')

with open('tfidf_model.pkl', 'rb') as f:
    tfidf = pickle.load(f)

print(f"✅ Recommender model loaded — {len(df_kaggle)} Kaggle courses")

# ==========================================
# ✅ MAPPINGS
# ==========================================

CATEGORY_MAPPING = {
    'Development': 'Web Development',
    'Business': 'Business Finance',
    'Finance': 'Business Finance',
    'IT & Software': 'Web Development',
    'Design': 'Graphic Design',
    'Marketing': 'Business Finance',
    'Data Science': 'Web Development'
}

LEVEL_MAPPING = {
    'Débutant': 'Beginner Level',
    'Intermédiaire': 'Intermediate Level',
    'Avancé': 'Expert Level',
    'All Levels': 'All Levels'
}

# ==========================================
# ✅ HELPERS RECOMMANDATION
# ==========================================

def build_user_profile(cv_skills, cv_experiences, enrolled_categories, five_star_subjects):
    profile_parts = []

    if cv_skills:
        profile_parts.extend(cv_skills)

    if cv_experiences:
        profile_parts.extend(cv_experiences)

    for cat in enrolled_categories:
        udemy_subject = CATEGORY_MAPPING.get(cat, '')
        if udemy_subject:
            profile_parts.append(udemy_subject)

    for sub in five_star_subjects:
        udemy_subject = CATEGORY_MAPPING.get(sub, '')
        if udemy_subject:
            profile_parts.append(udemy_subject)
            profile_parts.append(udemy_subject)  # double weight

    return ' '.join(profile_parts)


def score_platform_course(course, user_profile_vector, enrolled_categories, five_star_subjects):
    course_features = (
        f"{course.get('title', '')} "
        f"{CATEGORY_MAPPING.get(course.get('category', ''), '')} "
        f"{course.get('description', '')[:200]} "
        f"{' '.join(course.get('tags', []))}"
    )

    try:
        course_vector = tfidf.transform([course_features])
        cv_score = float(cosine_similarity(user_profile_vector, course_vector)[0][0])
    except:
        cv_score = 0

    category_score = 0
    course_category = course.get('category', '')
    if course_category in enrolled_categories:
        category_score += 0.6
    if course_category in five_star_subjects:
        category_score += 0.4
    category_score = min(category_score, 1.0)

    num_enrollments = course.get('num_enrollments', 0)
    avg_rating = course.get('avg_rating', 0)
    popularity_score = min((num_enrollments / 100) * 0.5 + (avg_rating / 5) * 0.5, 1.0)

    hybrid_score = (
        0.40 * cv_score +
        0.35 * category_score +
        0.25 * popularity_score
    )

    return {
        'cv_score': round(cv_score, 3),
        'category_score': round(category_score, 3),
        'popularity_score': round(popularity_score, 3),
        'hybrid_score': round(hybrid_score, 3)
    }

# ==========================================
# ✅ ROUTES HEALTH
# ==========================================

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'services': {
            'whisper': 'loaded',
            'recommender': 'loaded'
        },
        'kaggle_courses': len(df_kaggle)
    })

# ==========================================
# ✅ ROUTES WHISPER / TRANSCRIPTION
# ==========================================

@app.route('/transcribe', methods=['POST'])
@require_internal_token
def transcribe():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    tmp_path = None
    try:
        suffix = os.path.splitext(file.filename)[1] or '.mp4'
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        print(f"🎬 Transcribing: {file.filename}")

        result = whisper_model.transcribe(tmp_path)

        return jsonify({
            "text": result["text"],
            "language": result.get("language", "fr"),
            "segments": result.get("segments", []),
            "duration": result.get("duration", 0)
        })

    except Exception as e:
        print(f"❌ Transcription error: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

# ==========================================
# ✅ ROUTES RECOMMANDATION
# ==========================================

@app.route('/recommend', methods=['POST'])
@require_internal_token
def recommend():
    try:
        data = request.json

        cv_skills = data.get('cv_skills', [])
        cv_experiences = data.get('cv_experiences', [])
        enrolled_categories = data.get('enrolled_categories', [])
        five_star_subjects = data.get('five_star_subjects', [])
        platform_courses = data.get('platform_courses', [])
        top_n = data.get('top_n', 4)

        print(f"🔍 Recommending for:")
        print(f"   CV Skills: {cv_skills}")
        print(f"   Enrolled Categories: {enrolled_categories}")
        print(f"   Platform Courses: {len(platform_courses)}")

        # ✅ Construire le profil utilisateur
        user_profile = build_user_profile(
            cv_skills, cv_experiences,
            enrolled_categories, five_star_subjects
        )

        if not user_profile.strip():
            user_profile = ' '.join([
                CATEGORY_MAPPING.get(cat, 'Web Development')
                for cat in enrolled_categories
            ]) or 'Web Development Programming'

        # ✅ Vectoriser
        user_profile_vector = tfidf.transform([user_profile])

        # ✅ Scorer chaque cours
        scored_courses = []
        for course in platform_courses:
            scores = score_platform_course(
                course,
                user_profile_vector,
                enrolled_categories,
                five_star_subjects
            )
            scored_courses.append({
                **course,
                'scores': scores
            })

        # ✅ Trier par score hybride
        scored_courses.sort(
            key=lambda x: x['scores']['hybrid_score'],
            reverse=True
        )

        recommendations = scored_courses[:top_n]

        return jsonify({
            'success': True,
            'recommendations': recommendations,
            'user_profile': {
                'skills': cv_skills,
                'enrolled_categories': enrolled_categories,
                'five_star_subjects': five_star_subjects,
                'profile_text': user_profile
            }
        })

    except Exception as e:
        print(f"❌ Recommender error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

# ==========================================

if __name__ == '__main__':
    print("🚀 Flask Services (Whisper + Recommender) running on 127.0.0.1:5001")
    # ✅ SECURITY: localhost only — never expose this service to the network
    app.run(host='127.0.0.1', port=5001, debug=False)