const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true
    },
    title: {
      type: String,
      required: true
    },
    content: {
      type: String
    },
    contentFile: {
      type: String
    },
    contentType: {
      type: String,
      enum: ["pdf", "video"],
      default: "pdf"
    },
    order: {
      type: Number,
      required: true
    },
    isFree: {
      type: Boolean,
      default: false
    },

    // ✅ Quiz 1
    quiz: {
      questions: [{
        texte: { type: String, required: true },
        options: [{ type: String }],
        correctAnswer: { type: Number, select: false },
        points: { type: Number, default: 1 }
      }],
      noteMinimale: { type: Number, default: 70 },
      maxAttempts: { type: Number, default: 3 } // ✅ anti-bruteforce sur les réponses
    },

    // ✅ Quiz 2 (deprecated — merged into `quiz`, kept for data compatibility)
    quiz2: {
      questions: [{
        texte: { type: String },
        options: [{ type: String }],
        correctAnswer: { type: Number, select: false },
        points: { type: Number, default: 1 }
      }],
      noteMinimale: { type: Number, default: 70 },
      maxAttempts: { type: Number, default: 3 }
    }



  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Lesson", lessonSchema);