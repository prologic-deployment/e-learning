const Notification = require("../models/Notification");
const User = require("../models/User");
const { sendEmail } = require("./email.service");
const config = require("../config/env");

// ✅ Single implementation (was defined twice — the Socket.io version silently
// replaced the plain one). Creates the row then pushes realtime when online.
exports.createNotification = async (userId, type, title, message, data = {}) => {
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
      data
    });

    if (global.io && global.userSockets) {
      const socketId = global.userSockets.get(userId.toString());
      if (socketId) {
        global.io.to(socketId).emit("notification", {
          _id: notification._id,
          type,
          title,
          message,
          data,
          createdAt: notification.createdAt,
          isRead: false
        });
      }
    }

    return notification;
  } catch (error) {
    console.error("Notification error:", error.message);
    return null;
  }
};

/**
 * ✅ Batched email sender — limited concurrency so bulk notifications no longer
 * block the request for minutes.
 */
const sendEmailsInBatches = async (recipients, buildEmail, batchSize = 10) => {
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    await Promise.all(
      batch.map(user =>
        sendEmail(buildEmail(user)).catch(err =>
          console.error(`❌ Email to ${user.email} failed:`, err.message)
        )
      )
    );
  }
};

// Nouveau cours disponible → notifier tous les users
exports.notifyNewCourse = async (course) => {
  try {
    const users = await User.find({ role: "user", isActive: true }).select("_id email firstname");

    // In-app notifications first (fast)
    await Promise.all(
      users.map(user =>
        exports.createNotification(
          user._id,
          "NEW_COURSE",
          "Nouveau cours disponible ! 🎓",
          `Le cours "${course.title}" est maintenant disponible.`,
          { courseId: course._id }
        )
      )
    );

    // Emails in background batches
    sendEmailsInBatches(users, (user) => ({
      to: user.email,
      subject: "🎓 Nouveau cours disponible !",
      html: `
        <h2>Bonjour ${user.firstname} ! 👋</h2>
        <p>Un nouveau cours est disponible sur la plateforme :</p>
        <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin:20px 0;">
          <h3 style="color:#2c3e50;">📚 ${course.title}</h3>
          <p>${course.description || ''}</p>
          <p><strong>Prix :</strong> ${course.price === 0 ? 'Gratuit 🆓' : course.price + ' TND'}</p>
        </div>
        <a href="${config.frontendUrl}/courses-grid"
           style="background:#2c3e50;color:white;padding:12px 25px;text-decoration:none;border-radius:5px;display:inline-block;">
          🚀 Voir le cours
        </a>
        <br><br>
        <small style="color:#888;">Plateforme E-Learning — Bonne formation !</small>
      `
    })).catch(err => console.error("notifyNewCourse emails error:", err.message));

    console.log(`✅ ${users.length} users notified for the new course`);
  } catch (error) {
    console.error("notifyNewCourse error:", error.message);
  }
};

// Badge obtenu → notifier le user
exports.notifyBadgeEarned = async (userId, badge) => {
  try {
    const user = await User.findById(userId).select("email firstname");

    await exports.createNotification(
      userId,
      "BADGE_EARNED",
      "Félicitations ! Badge obtenu 🏅",
      `Vous avez obtenu le badge "${badge.name}".`,
      { badgeId: badge._id }
    );

    await sendEmail({
      to: user.email,
      subject: "Félicitations ! Badge obtenu 🏅",
      html: `
        <h2>Bravo ${user.firstname} !</h2>
        <p>Vous avez obtenu le badge <strong>${badge.name}</strong> !</p>
        <p>${badge.description}</p>
      `
    });
  } catch (error) {
    console.error("notifyBadgeEarned error:", error.message);
  }
};

// Rappel délai cours → notifier le user
exports.notifyDeadlineReminder = async (userId, course, daysLeft) => {
  try {
    const user = await User.findById(userId).select("email firstname");

    await exports.createNotification(
      userId,
      "DEADLINE_REMINDER",
      `⏰ Rappel : ${daysLeft} jour(s) restant(s)`,
      `Il vous reste ${daysLeft} jour(s) pour terminer le cours "${course.title}".`,
      { courseId: course._id }
    );

    await sendEmail({
      to: user.email,
      subject: `⏰ Rappel délai - ${course.title}`,
      html: `
        <h2>Bonjour ${user.firstname} !</h2>
        <p>Il vous reste <strong>${daysLeft} jour(s)</strong> pour terminer le cours
        <strong>${course.title}</strong>.</p>
        <p>Connectez-vous maintenant pour continuer votre progression.</p>
      `
    });
  } catch (error) {
    console.error("notifyDeadlineReminder error:", error.message);
  }
};
