const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const { buyCourse, getMyPurchases, getMyPurchasesArray } = require("../controllers/purchase.controller");

router.post("/buy", protect, buyCourse);
router.get("/my-purchases", protect, getMyPurchases);
// ✅ Alias matching the frontend (user-dashboard calls GET /purchases/me) —
// returns the array directly, which is what the dashboard expects.
router.get("/me", protect, getMyPurchasesArray);

module.exports = router;