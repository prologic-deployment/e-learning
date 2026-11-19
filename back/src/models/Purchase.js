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
    paymentMethod: { type: String, default: "card" },   // card | voucher (fully covered)

    // ✅ Checkout breakdown (amount = what was actually paid for this course)
    orderReference: { type: String, default: null, index: true },
    originalAmount: { type: Number, default: null },   // regular course price
    saleDiscount: { type: Number, default: 0 },        // promotion (old → new price)
    voucherCode: { type: String, default: null },
    voucherDiscount: { type: Number, default: 0 },
    // card: never stored in full — brand + last 4 digits only
    cardBrand: { type: String, default: null },
    cardLast4: { type: String, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Purchase", purchaseSchema);
