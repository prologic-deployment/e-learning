const Badge = require("../models/Badge");
const User = require("../models/User");
const { notifyBadgeEarned } = require("../services/notification.service");

exports.createBadge = async (req, res) => {
  try {
    const { name, description, icon, color, condition } = req.body;
    const badge = await Badge.create({ name, description, icon, color, condition });
    res.status(201).json({ message: "Badge created", badge });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAllBadges = async (req, res) => {
  try {
    const badges = await Badge.find();
    res.status(200).json(badges);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getMyBadges = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("badges.badge");
    res.status(200).json(user.badges || []);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.awardBadge = async (req, res) => {
  try {
    const { userId, badgeId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const alreadyHas = user.badges?.find(
      b => b.badge.toString() === badgeId
    );
    if (alreadyHas) {
      return res.status(400).json({ message: "Badge already awarded" });
    }

    const badge = await Badge.findById(badgeId);
    if (!badge) return res.status(404).json({ message: "Badge not found" });

    user.badges = user.badges || [];
    user.badges.push({ badge: badgeId, earnedAt: new Date() });
    await user.save();

    notifyBadgeEarned(userId, badge);
    res.status(200).json({ message: "Badge awarded successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};