const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
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
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  isApproved: { type: Boolean, default: false }
}, { timestamps: true });

// Un user peut laisser qu'un seul avis par cours
reviewSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);