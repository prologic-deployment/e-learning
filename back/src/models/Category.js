const mongoose = require("mongoose");

/**
 * Course category (e.g. "DevOps") with its sub-categories ("Docker",
 * "Kubernetes", …). Seeded in every environment by `npm run seed:prod`
 * and served to the frontend by GET /api/categories.
 *
 * Courses reference categories by name (Course.category / subCategory).
 */
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", trim: true },
    icon: { type: String, default: "bx bx-book-open", trim: true },   // Boxicons class
    color: { type: String, default: "#1E3A8A", trim: true },          // thumbnail colour
    subcategories: [{ type: String, trim: true }],
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
