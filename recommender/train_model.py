import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler
import pickle

print("📦 Loading dataset...")
df = pd.read_csv('udemy_courses.csv')

# ✅ Preprocessing
df = df.dropna(subset=['course_title', 'subject'])
df['level'] = df['level'].fillna('All Levels')
df['subject'] = df['subject'].fillna('General')
df['num_reviews'] = df['num_reviews'].fillna(0)
df['num_subscribers'] = df['num_subscribers'].fillna(0)

# ✅ Feature Engineering
df['features'] = (
    df['course_title'] + ' ' +
    df['subject'] + ' ' +
    df['level']
)

# ✅ Popularity score basé sur reviews et subscribers
scaler = MinMaxScaler()
df['popularity_score'] = scaler.fit_transform(
    df[['num_subscribers']]
).flatten()

df['review_score'] = scaler.fit_transform(
    df[['num_reviews']]
).flatten()

# ✅ TF-IDF
print("🔄 Training TF-IDF model...")
tfidf = TfidfVectorizer(
    max_features=5000,
    stop_words='english',
    ngram_range=(1, 2)
)
tfidf_matrix = tfidf.fit_transform(df['features'])
print(f"✅ TF-IDF matrix: {tfidf_matrix.shape}")

# ✅ Cosine Similarity
print("🔄 Computing cosine similarity...")
cosine_sim = cosine_similarity(tfidf_matrix, tfidf_matrix)
print(f"✅ Similarity matrix: {cosine_sim.shape}")

# ✅ Sauvegarder
with open('tfidf_model.pkl', 'wb') as f:
    pickle.dump(tfidf, f)

with open('cosine_sim.pkl', 'wb') as f:
    pickle.dump(cosine_sim, f)

df.to_csv('courses_processed.csv', index=False)
print("✅ Model trained and saved!")
print(f"📊 Subjects: {df['subject'].unique()}")
print(f"📊 Levels: {df['level'].unique()}")