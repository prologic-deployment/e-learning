const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["NEW_COURSE", "DEADLINE_REMINDER", "BADGE_EARNED"],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  data: {
    // Données supplémentaires selon le type
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    badgeId: { type: mongoose.Schema.Types.ObjectId, ref: "Badge" }
  }
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);