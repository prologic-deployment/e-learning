const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const {
  getAdminStats,
  getManagerStats,
  getTrainerStats
} = require("../controllers/stats.controller");

router.get("/admin", protect, authorize("admin"), getAdminStats);
router.get("/manager", protect, authorize("manager"), getManagerStats);
router.get("/trainer", protect, authorize("trainer"), getTrainerStats);

module.exports = router;