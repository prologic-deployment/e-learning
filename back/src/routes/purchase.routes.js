const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const { buyCourse, getMyPurchases } = require("../controllers/purchase.controller");

router.post("/buy", protect, buyCourse);
router.get("/my-purchases", protect, getMyPurchases);

module.exports = router;