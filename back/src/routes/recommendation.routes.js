const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const { getRecommendations } = require("../controllers/recommendation.controller");

router.get("/", protect, getRecommendations);

module.exports = router;