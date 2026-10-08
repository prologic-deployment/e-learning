const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    deadline: {
      type: Date,
      default: null
    },
    reminderSent: {
      type: Boolean,
      default: false
    },
    completed: {
      type: Boolean,
      default: false
    },

    // ✅ Progression par chapitre
    currentLesson: {
      type: Number,
      default: 0
    },
    lessonsCompleted: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lesson"
      }
    ],

    // ✅ Résultats des quiz par leçon
    quizResults: [
      {
        lesson: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Lesson"
        },
        review: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentReview', select: false },
        score: { type: Number },
        passed: { type: Boolean },
        attempts: { type: Number, default: 1 },
        completedAt: { type: Date, default: Date.now }
      }
    ],

    // ✅ Résultats des quiz 2 par leçon
    quiz2Results: [
      {
        lesson: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Lesson"
        },
        review: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentReview', select: false },
        score: { type: Number },
        passed: { type: Boolean },
        attempts: { type: Number, default: 0 },
        completedAt: { type: Date, default: Date.now }
      }
    ],

    // ✅ Résultat de l'examen final
    finalExamResult: {
      review: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentReview', select: false },
      score: { type: Number, default: null },
      passed: { type: Boolean, default: false },
      attempts: { type: Number, default: 0 },
      completedAt: { type: Date, default: null }
    },

    // ✅ SECURITY: server-side quiz attempt counters (client cannot reset these)
    quizAttemptCounts: [{
      lesson: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" },
      quizKey: { type: String, enum: ["quiz", "quiz2"], default: "quiz" },
      count: { type: Number, default: 0 }
    }],
    finalExamAttempts: { type: Number, default: 0 }

  },
  {
    timestamps: true
  }
);

enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

enrollmentSchema.index({ course: 1, createdAt: -1 });
enrollmentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Enrollment", enrollmentSchema);