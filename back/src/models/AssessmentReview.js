const mongoose = require("mongoose");
// Keep immutable answer evidence out of hot enrollment documents. A large curriculum
// must not approach MongoDB's 16 MB document limit or slow every progress update.
const schema = new mongoose.Schema(
  {
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enrollment",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      select: false,
    },
  },
  { timestamps: true },
);
module.exports = mongoose.model("AssessmentReview", schema);
