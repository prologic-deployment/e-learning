const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const upload = require("../config/multer");
const {
  getUserProfile,
  updateProfile,
  updateAvatar
} = require("../controllers/profile.controller");

router.get("/", protect, getUserProfile);
router.put("/", protect, updateProfile);
router.put("/avatar", protect, upload.single("avatar"), updateAvatar);

module.exports = router;