const Category = require("../models/Category");

// ================= GET /api/categories =================
// Public: active categories with their sub-categories, in display order.
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ order: 1, name: 1 })
      .select("name slug description icon color subcategories order -_id")
      .lean();
    res.status(200).json({ categories });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
