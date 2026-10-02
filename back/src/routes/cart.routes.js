const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const {
  getCart,
  addToCart,
  removeFromCart,
  clearCart
} = require("../controllers/cart.controller");

router.get("/", protect, getCart);
router.post("/add", protect, addToCart);
router.delete("/remove/:courseId", protect, removeFromCart);
router.delete("/clear", protect, clearCart);

module.exports = router;