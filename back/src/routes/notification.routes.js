const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} = require("../controllers/notification.controller");

router.get("/", protect, getMyNotifications);
router.patch("/:id/read", protect, markAsRead);
router.patch("/read-all", protect, markAllAsRead);
router.delete("/:id", protect, deleteNotification);

module.exports = router;