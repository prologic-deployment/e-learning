const cron = require("node-cron");
const Enrollment = require("../models/Enrollment");
const { notifyDeadlineReminder } = require("../services/notification.service");

const startDeadlineReminderJob = () => {
  // Exécuter tous les jours à 8h00
  cron.schedule("0 8 * * *", async () => {
    console.log("⏰ Cron Job: Vérification des délais cours...");

    try {
      const now = new Date();

      // Trouver les enrollments avec deadline dans 3 jours
      const threeDaysFromNow = new Date(now);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const enrollments = await Enrollment.find({
        deadline: {
          $gte: now,
          $lte: threeDaysFromNow
        },
        completed: false,
        reminderSent: false
      }).populate("user", "email firstname")
        .populate("course", "title");

      console.log(`📋 ${enrollments.length} rappels à envoyer`);

      for (const enrollment of enrollments) {
        const daysLeft = Math.ceil(
          (new Date(enrollment.deadline) - now) / (1000 * 60 * 60 * 24)
        );

        // Envoyer la notification
        await notifyDeadlineReminder(
          enrollment.user._id,
          enrollment.course,
          daysLeft
        );

        // Marquer comme envoyé
        enrollment.reminderSent = true;
        await enrollment.save();

        console.log(`✅ Rappel envoyé à ${enrollment.user.email} pour "${enrollment.course.title}"`);
      }

    } catch (error) {
      console.error("❌ Cron Job erreur:", error.message);
    }
  });

  console.log("✅ Cron Job démarré — Rappels délais actifs");
};

module.exports = startDeadlineReminderJob;