const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const {
  createBadge,
  getAllBadges,
  getMyBadges,
  awardBadge
} = require("../controllers/badge.controller");

router.post("/", protect, authorize("admin"), createBadge);
router.get("/", protect, getAllBadges);
router.get("/my-badges", protect, getMyBadges);
router.post("/award", protect, authorize("admin"), awardBadge);

module.exports = router;