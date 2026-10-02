const mongoose = require("mongoose");

const quizResultSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Quiz",
    required: true
  },
  score: { type: Number, required: true },
  total: { type: Number, required: true },
  percentage: { type: Number, required: true },
  passed: { type: Boolean, default: false },
  reponses: [
    {
      question: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question"
      },
      reponseChoisie: [String] // pour MULTI et SINGLE
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model("QuizResult", quizResultSchema);