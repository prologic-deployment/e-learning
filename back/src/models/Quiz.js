const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
  titre: { type: String, required: true },
  description: { type: String },
  duree: { type: Number, default: 30 }, // en minutes
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true
  },
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lesson"
  },
  questions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question"
    }
  ],
  scoreMinimum: { type: Number, default: 50 } // % minimum pour réussir
}, { timestamps: true });

module.exports = mongoose.model("Quiz", quizSchema);