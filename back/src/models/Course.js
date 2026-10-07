const {questionSchema}=require('../utils/assessment');
const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    category: {
      type: String,
      default: ''
    },
    // ✅ contentFile gardé pour compatibilité mais on utilise les lessons
    contentFile: {
      type: String,
      default: null
    },
    isApproved: {
      type: Boolean,
      default: false
    },
    enrolledUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    price: {
      type: Number,
      required: true,
      default: 0
    },
    deadline: {
      type: Date,
      default: null
    },
    isPaid: {
      type: Boolean,
      default: true
    },
    // ✅ Chapitres/Leçons du cours
    lessons: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lesson"
      }
    ],
    // ✅ Examen final
    finalExam: {
      questions: [questionSchema],
      noteMinimale: { type: Number, default: 70 },
      maxAttempts: { type: Number, default: 3 }
    },

    // ✅ Archive fields (were referenced by controllers but missing from the schema)
    isArchived: { type: Boolean, default: false, select: false },
    archivedAt: { type: Date, default: null, select: false }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Course", courseSchema);