const mongoose = require("mongoose");

const badgeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, default: '🏅' },
  color: { type: String, default: '#667eea' },
  condition: {
    type: String,
    enum: [
      "first_course",
      "courses_3",
      "courses_5",
      "courses_10",
      "first_completed",
      "completed_5",
      "completed_10",
      "quiz_perfect",
      "fast_learner",
      "first_review",
      "reviews_5",
      "first_certificate",
      "streak_month"
    ],
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Badge", badgeSchema);