const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const { quote, pay } = require("../controllers/checkout.controller");

router.post("/quote", protect, quote);
router.post("/pay", protect, pay);

module.exports = router;
