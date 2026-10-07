const Badge = require("../models/Badge");
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Review = require("../models/Review");
const Certificate = require("../models/Certificate");
const { notifyBadgeEarned } = require("./notification.service");

// ✅ Définition des badges
const BADGE_DEFINITIONS = [
  {
    condition: "first_course",
    name: "First Step ",
    description: "Enrolled in your first course !",
    icon: "bx bx-target-lock",
    color: "#43e97b"
  },
  {
    condition: "courses_3",
    name: "Curious ",
    description: "Enrolled in 3 courses !",
    icon: "bx bx-book-open",
    color: "#667eea"
  },
  {
    condition: "courses_5",
    name: "Dedicated ",
    description: "Enrolled in 5 courses !",
    icon: "bx bx-trending-up",
    color: "#f093fb"
  },
  {
    condition: "courses_10",
    name: "Expert ",
    description: "Enrolled in 10 courses !",
    icon: "bx bx-star",
    color: "#f5a623"
  },
  {
    condition: "first_completed",
    name: "Achiever ",
    description: "Completed your first course !",
    icon: "bx bx-check-circle",
    color: "#43e97b"
  },
  {
    condition: "completed_5",
    name: "Champion ",
    description: "Completed 5 courses !",
    icon: "bx bx-trophy",
    color: "#f5a623"
  },
  {
    condition: "completed_10",
    name: "Master ",
    description: "Completed 10 courses !",
    icon: "bx bx-diamond",
    color: "#764ba2"
  },
  {
    condition: "quiz_perfect",
    name: "Perfectionist ",
    description: "Got 100% on a quiz !",
    icon: "bx bx-check-double",
    color: "#f093fb"
  },
  {
    condition: "fast_learner",
    name: "Fast Learner ",
    description: "Completed a course in less than 7 days !",
    icon: "bx bx-bolt-circle",
    color: "#4facfe"
  },
  {
    condition: "first_review",
    name: "Reviewer ",
    description: "Left your first review !",
    icon: "bx bx-edit",
    color: "#43e97b"
  },
  {
    condition: "reviews_5",
    name: "Top Reviewer ",
    description: "Left 5 reviews !",
    icon: "bx bx-star",
    color: "#f5a623"
  },
  {
    condition: "first_certificate",
    name: "Scholar ",
    description: "Earned your first certificate !",
    icon: "bx bx-graduation",
    color: "#667eea"
  },
  {
    condition: "streak_month",
    name: "On Fire ",
    description: "Completed 3 courses in 1 month !",
    icon: "bx bx-trending-up",
    color: "#f5576c"
  }
];

// ✅ Initialiser les badges en DB
async function initBadges() {
  try {
    for (const def of BADGE_DEFINITIONS) {
      await Badge.findOneAndUpdate(
        { condition: def.condition },
        { ...def },
        { upsert: true, returnDocument: 'after' }
      );
    }
    console.log(" Badges initialized !");
  } catch (error) {
    console.log(" Badge init error:", error.message);
  }
}

// ✅ Attribuer un badge si pas déjà attribué
async function awardBadgeIfEligible(userId, condition) {
  try {
    const badge = await Badge.findOne({ condition });
    if (!badge) return;

    const user = await User.findById(userId);
    if (!user) return;

    const alreadyHas = user.badges?.some(
      b => b.badge.toString() === badge._id.toString()
    );

    if (!alreadyHas) {
      user.badges = user.badges || [];
      user.badges.push({ badge: badge._id, earnedAt: new Date() });
      await user.save();
      notifyBadgeEarned(userId, badge);
      console.log(` Badge "${badge.name}" awarded to user ${userId}`);
    }
  } catch (error) {
    console.log(" Badge award error:", error.message);
  }
}

// ✅ Vérifier et attribuer les badges après enrollment
async function checkEnrollmentBadges(userId) {
  try {
    const enrollments = await Enrollment.find({ user: userId });
    const count = enrollments.length;

    if (count >= 1) await awardBadgeIfEligible(userId, "first_course");
    if (count >= 3) await awardBadgeIfEligible(userId, "courses_3");
    if (count >= 5) await awardBadgeIfEligible(userId, "courses_5");
    if (count >= 10) await awardBadgeIfEligible(userId, "courses_10");
  } catch (error) {
    console.log(" Enrollment badge check error:", error.message);
  }
}

// ✅ Vérifier et attribuer les badges après completion
async function checkCompletionBadges(userId, enrollment) {
  try {
    const completed = await Enrollment.find({ user: userId, completed: true });
    const count = completed.length;

    if (count >= 1) await awardBadgeIfEligible(userId, "first_completed");
    if (count >= 5) await awardBadgeIfEligible(userId, "completed_5");
    if (count >= 10) await awardBadgeIfEligible(userId, "completed_10");

    // ✅ Fast learner — complété en moins de 7 jours
    if (enrollment?.createdAt) {
      const days = (new Date() - new Date(enrollment.createdAt)) / (1000 * 60 * 60 * 24);
      if (days < 7) await awardBadgeIfEligible(userId, "fast_learner");
    }

    // ✅ Streak — 3 cours complétés dans le même mois
    const now = new Date();
    const thisMonth = completed.filter(e => {
      const d = new Date(e.updatedAt);
      return d.getMonth() === now.getMonth() &&
             d.getFullYear() === now.getFullYear();
    });
    if (thisMonth.length >= 3) await awardBadgeIfEligible(userId, "streak_month");

  } catch (error) {
    console.log(" Completion badge check error:", error.message);
  }
}

// ✅ Vérifier les badges après review
async function checkReviewBadges(userId) {
  try {
    const reviews = await Review.find({ user: userId });
    const count = reviews.length;

    if (count >= 1) await awardBadgeIfEligible(userId, "first_review");
    if (count >= 5) await awardBadgeIfEligible(userId, "reviews_5");
  } catch (error) {
    console.log(" Review badge check error:", error.message);
  }
}

// ✅ Vérifier les badges après certificat
async function checkCertificateBadges(userId) {
  try {
    const certs = await Certificate.find({ user: userId });
    if (certs.length >= 1) await awardBadgeIfEligible(userId, "first_certificate");
  } catch (error) {
    console.log(" Certificate badge check error:", error.message);
  }
}

// ✅ Vérifier les badges après quiz parfait
async function checkQuizBadges(userId, score) {
  try {
    if (score === 100) await awardBadgeIfEligible(userId, "quiz_perfect");
  } catch (error) {
    console.log(" Quiz badge check error:", error.message);
  }
}

module.exports = {
  initBadges,
  checkEnrollmentBadges,
  checkCompletionBadges,
  checkReviewBadges,
  checkCertificateBadges,
  checkQuizBadges
};
