const express = require("express");
const router = express.Router();
const upload = require("../config/multer");

const { protect, authorize } = require("../middlewares/auth.middleware");
const role = require("../middlewares/role.middleware");

const {
  updateProfile,
  updateUserRole,
  deleteUser,
  createTrainer,
  createManager
} = require("../controllers/user.controller");

// ---------------- SELF-SERVICE ----------------
router.put("/me", protect, updateProfile);

router.get("/me", protect, (req, res) => {
  res.status(200).json({ user: req.user });
});

// ---------------- ADMIN ONLY ----------------
router.put("/:id/role", protect, authorize("admin"), updateUserRole);
router.delete("/:id", protect, authorize("admin"), deleteUser);

router.post("/create-trainer", protect, createTrainer);
router.post("/managers", protect, authorize("admin"), createManager);


module.exports = router;