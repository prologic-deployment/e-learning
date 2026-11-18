const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const { cacheConfig } = require("../middlewares/cache.middleware");
const {
  getPublicStats,
  getAdminStats,
  getManagerStats,
  getTrainerStats
} = require("../controllers/stats.controller");

// ✅ Public: landing-page totals (cached 5 min when Redis is enabled)
router.get("/public", cacheConfig.short, getPublicStats);

router.get("/admin", protect, authorize("admin"), getAdminStats);
router.get("/manager", protect, authorize("manager"), getManagerStats);
router.get("/trainer", protect, authorize("trainer"), getTrainerStats);

module.exports = router;