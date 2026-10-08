const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
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
    amount: {
      type: Number,
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending"
    },
    // ✅ E-commerce readiness: provider tracking + invoice reference
    paymentProvider: { type: String, default: "simulated" },
    paymentReference: { type: String, default: null },
    paymentMethod: { type: String, default: "card" }
  },
  { timestamps: true }
);

purchaseSchema.index({ course: 1, paymentStatus: 1 });

module.exports = mongoose.model("Purchase", purchaseSchema);
