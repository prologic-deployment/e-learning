const User = require("../models/User");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Purchase = require("../models/Purchase");
const Certificate = require("../models/Certificate");

// ========================================
// DASHBOARD ADMIN
// ========================================
exports.getAdminStats = async (req, res) => {
  try {
    // Compteurs généraux
    const [
      totalUsers,
      totalTrainers,
      totalManagers,
      totalCourses,
      approvedCourses,
      pendingCourses,
      totalEnrollments,
      completedEnrollments,
      totalPurchases,
      totalCertificates
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "trainer" }),
      User.countDocuments({ role: "manager" }),
      Course.countDocuments(),
      Course.countDocuments({ isApproved: true }),
      Course.countDocuments({ isApproved: false }),
      Enrollment.countDocuments(),
      Enrollment.countDocuments({ completed: true }),
      Purchase.countDocuments({ paymentStatus: "paid" }),
      Certificate.countDocuments({ isValid: true })
    ]);

    // Revenus totaux
    const revenueResult = await Purchase.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // Top 5 cours les plus populaires
    const topCourses = await Enrollment.aggregate([
      { $group: { _id: "$course", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "courses",
          localField: "_id",
          foreignField: "_id",
          as: "course"
        }
      },
      { $unwind: "$course" },
      {
        $project: {
          _id: 0,
          courseTitle: "$course.title",
          enrollments: "$count"
        }
      }
    ]);

    // Inscriptions par mois (6 derniers mois)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const enrollmentsByMonth = await Enrollment.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Nouveaux users par mois (6 derniers mois)
    const usersByMonth = await User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    res.status(200).json({
      overview: {
        totalUsers,
        totalTrainers,
        totalManagers,
        totalCourses,
        approvedCourses,
        pendingCourses,
        totalEnrollments,
        completedEnrollments,
        completionRate: totalEnrollments > 0
          ? Math.round((completedEnrollments / totalEnrollments) * 100)
          : 0,
        totalPurchases,
        totalRevenue,
        totalCertificates
      },
      topCourses,
      enrollmentsByMonth,
      usersByMonth
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ========================================
// DASHBOARD MANAGER
// ========================================
exports.getManagerStats = async (req, res) => {
  try {
    // Récupérer l'équipe du manager
    const team = await User.find({
      manager: req.user._id,
      role: "user"
    }).select("firstname lastname email avatar");

    const teamIds = team.map(u => u._id);

    // Enrollments de l'équipe
    const teamEnrollments = await Enrollment.find({
      user: { $in: teamIds }
    }).populate("course", "title")
      .populate("user", "firstname lastname email avatar");

    // Stats globales équipe
    const totalEnrollments = teamEnrollments.length;
    const completedEnrollments = teamEnrollments.filter(e => e.completed).length;
    const averageProgress = totalEnrollments > 0
      ? Math.round(
          teamEnrollments.reduce((acc, e) => acc + e.progress, 0) / totalEnrollments
        )
      : 0;

    // Progression par membre
    const memberStats = team.map(member => {
      const memberEnrollments = teamEnrollments.filter(
        e => e.user._id.toString() === member._id.toString()
      );

      const completed = memberEnrollments.filter(e => e.completed).length;
      const avgProgress = memberEnrollments.length > 0
        ? Math.round(
            memberEnrollments.reduce((acc, e) => acc + e.progress, 0) /
            memberEnrollments.length
          )
        : 0;

      return {
        user: member,
        totalCourses: memberEnrollments.length,
        completedCourses: completed,
        averageProgress: avgProgress,
        enrollments: memberEnrollments
      };
    });

    // Cours avec deadline dépassée
    const overdueEnrollments = await Enrollment.find({
      user: { $in: teamIds },
      deadline: { $lt: new Date() },
      completed: false
    }).populate("user", "firstname lastname email")
      .populate("course", "title");

    res.status(200).json({
      overview: {
        teamSize: team.length,
        totalEnrollments,
        completedEnrollments,
        completionRate: totalEnrollments > 0
          ? Math.round((completedEnrollments / totalEnrollments) * 100)
          : 0,
        averageProgress
      },
      memberStats,
      overdueEnrollments
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ========================================
// DASHBOARD TRAINER
// ========================================
exports.getTrainerStats = async (req, res) => {
  try {
    // Cours du trainer
    const courses = await Course.find({ trainer: req.user._id });
    const courseIds = courses.map(c => c._id);

    // Enrollments pour ses cours
    const enrollments = await Enrollment.find({
      course: { $in: courseIds }
    });

    const completedEnrollments = enrollments.filter(e => e.completed).length;

    // Stats par cours
    const courseStats = await Promise.all(
      courses.map(async (course) => {
        const courseEnrollments = await Enrollment.find({ course: course._id });
        const completed = courseEnrollments.filter(e => e.completed).length;
        const avgProgress = courseEnrollments.length > 0
          ? Math.round(
              courseEnrollments.reduce((acc, e) => acc + e.progress, 0) /
              courseEnrollments.length
            )
          : 0;

        // Revenus du cours
        const purchases = await Purchase.find({
          course: course._id,
          paymentStatus: "paid"
        });
        const revenue = purchases.reduce((acc, p) => acc + p.amount, 0);

        return {
          course: { id: course._id, title: course.title, isApproved: course.isApproved },
          totalEnrollments: courseEnrollments.length,
          completedEnrollments: completed,
          averageProgress: avgProgress,
          revenue
        };
      })
    );

    res.status(200).json({
      overview: {
        totalCourses: courses.length,
        approvedCourses: courses.filter(c => c.isApproved).length,
        totalEnrollments: enrollments.length,
        completedEnrollments,
        completionRate: enrollments.length > 0
          ? Math.round((completedEnrollments / enrollments.length) * 100)
          : 0
      },
      courseStats
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};