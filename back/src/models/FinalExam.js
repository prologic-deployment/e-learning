const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  texte: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: Number, required: true },
  points: { type: Number, default: 1 }
});

const finalExamSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  questions: [questionSchema],
  noteMinimale: { type: Number, default: 70 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("FinalExam", finalExamSchema);