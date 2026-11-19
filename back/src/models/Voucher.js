const mongoose = require("mongoose");

/**
 * Discount / free-access code managed by admins.
 *
 * - course: null → valid on every paid course, otherwise only on that course
 * - type "percent" with value 100 → the course is free (internal staff codes)
 * - emailDomain: restricts the code to accounts of that domain
 *   (e.g. "prologic.com.tn" for internal users)
 * - maxUses: total orders that may use it (null = unlimited)
 * - perUserLimit: orders per user (null = unlimited)
 */
const voucherSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9_-]{3,32}$/
    },
    description: { type: String, default: "", maxlength: 200 },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
    type: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true, min: 0 },
    maxUses: { type: Number, default: null, min: 1 },
    perUserLimit: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0 },
    emailDomain: { type: String, default: null, lowercase: true, trim: true },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    redemptions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        orderReference: String,
        discount: Number,
        at: { type: Date, default: Date.now }
      }
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

voucherSchema.path("value").validate(function (v) {
  return this.type !== "percent" || (v > 0 && v <= 100);
}, "A percentage must be between 1 and 100");

module.exports = mongoose.model("Voucher", voucherSchema);
