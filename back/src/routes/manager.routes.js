const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");
const User = require("../models/User");
const {
  assignUserToManager,
  assignCourseToUsers,
  getTeamProgress
} = require("../controllers/manager.controller");

router.post("/assign-user", protect, roleMiddleware("admin"), assignUserToManager);

router.post("/assign-course", protect, roleMiddleware("manager"), assignCourseToUsers);

router.get("/team-progress", protect, roleMiddleware("manager"), getTeamProgress);

// GET /managers/team — membres de l'équipe
router.get("/team", protect, roleMiddleware("manager"), async (req, res) => {
  try {
    const team = await User.find({ 
      manager: req.user._id,
      role: "user"
    }).select("firstname lastname email avatar");

    res.status(200).json(team);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
