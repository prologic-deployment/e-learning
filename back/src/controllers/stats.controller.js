const User = require("../models/User");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Purchase = require("../models/Purchase");
const Certificate = require("../models/Certificate");
const percent = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const sumIf = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });
const months = (since) => [
  { $match: { createdAt: { $gte: since } } },
  {
    $group: {
      _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
      count: { $sum: 1 },
    },
  },
  { $sort: { "_id.year": 1, "_id.month": 1 } },
];
exports.getAdminStats = async (req, res) => {
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - 6);
    const hasRole = (r) => ({
      $in: [r, { $cond: [{ $isArray: "$role" }, "$role", ["$role"]] }],
    });
    // Five independent database operations; facets share each collection scan.
    const [users, courses, enrollments, purchases, totalCertificates] =
      await Promise.all([
        User.aggregate([
          {
            $facet: {
              overview: [
                {
                  $group: {
                    _id: null,
                    totalUsers: sumIf(hasRole("user")),
                    totalTrainers: sumIf(hasRole("trainer")),
                    totalManagers: sumIf(hasRole("manager")),
                  },
                },
              ],
              months: months(since),
            },
          },
        ]),
        Course.aggregate([
          {
            $group: {
              _id: null,
              totalCourses: { $sum: 1 },
              approvedCourses: sumIf({ $eq: ["$isApproved", true] }),
              pendingCourses: sumIf({ $eq: ["$isApproved", false] }),
            },
          },
        ]),
        Enrollment.aggregate([
          {
            $facet: {
              overview: [
                {
                  $group: {
                    _id: null,
                    totalEnrollments: { $sum: 1 },
                    completedEnrollments: sumIf({ $eq: ["$completed", true] }),
                  },
                },
              ],
              months: months(since),
              top: [
                { $group: { _id: "$course", count: { $sum: 1 } } },
                { $sort: { count: -1, _id: 1 } },
                { $limit: 5 },
                {
                  $lookup: {
                    from: "courses",
                    localField: "_id",
                    foreignField: "_id",
                    pipeline: [{ $project: { title: 1 } }],
                    as: "course",
                  },
                },
                { $unwind: "$course" },
                {
                  $project: {
                    _id: 0,
                    courseId: "$_id",
                    courseTitle: "$course.title",
                    enrollments: "$count",
                  },
                },
              ],
            },
          },
        ]),
        Purchase.aggregate([
          { $match: { paymentStatus: "paid" } },
          {
            $group: {
              _id: null,
              totalPurchases: { $sum: 1 },
              totalRevenue: { $sum: "$amount" },
            },
          },
        ]),
        Certificate.countDocuments({ isValid: true }),
      ]);
    const u = users[0]?.overview[0] || {},
      c = courses[0] || {},
      e = enrollments[0]?.overview[0] || {},
      p = purchases[0] || {};
    res.json({
      overview: {
        totalUsers: u.totalUsers || 0,
        totalTrainers: u.totalTrainers || 0,
        totalManagers: u.totalManagers || 0,
        totalCourses: c.totalCourses || 0,
        approvedCourses: c.approvedCourses || 0,
        pendingCourses: c.pendingCourses || 0,
        totalEnrollments: e.totalEnrollments || 0,
        completedEnrollments: e.completedEnrollments || 0,
        completionRate: percent(e.completedEnrollments, e.totalEnrollments),
        totalPurchases: p.totalPurchases || 0,
        totalRevenue: p.totalRevenue || 0,
        totalCertificates,
      },
      topCourses: enrollments[0]?.top || [],
      enrollmentsByMonth: enrollments[0]?.months || [],
      usersByMonth: users[0]?.months || [],
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to load statistics." });
  }
};
exports.getManagerStats = async (req, res) => {
  try {
    const team = await User.find({ manager: req.user._id, role: "user" })
      .select("firstname lastname email avatar")
      .lean();
    const members = new Map(team.map((u) => [String(u._id), u]));
    const teamEnrollments = team.length
      ? await Enrollment.find({ user: { $in: team.map((u) => u._id) } })
          .select("user course progress completed deadline createdAt")
          .populate("course", "title")
          .lean()
      : [];
    const buckets = new Map(
      team.map((u) => [
        String(u._id),
        {
          user: u,
          totalCourses: 0,
          completedCourses: 0,
          progress: 0,
          enrollments: [],
        },
      ]),
    );
    const overdueEnrollments = [];
    let completedEnrollments = 0,
      progress = 0;
    const now = new Date();
    for (const e of teamEnrollments) {
      const key = String(e.user),
        bucket = buckets.get(key);
      e.user = members.get(key);
      bucket.totalCourses++;
      bucket.completedCourses += e.completed ? 1 : 0;
      bucket.progress += e.progress || 0;
      bucket.enrollments.push(e);
      completedEnrollments += e.completed ? 1 : 0;
      progress += e.progress || 0;
      if (e.deadline && e.deadline < now && e.completed === false)
        overdueEnrollments.push(e);
    }
    const totalEnrollments = teamEnrollments.length;
    res.json({
      overview: {
        teamSize: team.length,
        totalEnrollments,
        completedEnrollments,
        completionRate: percent(completedEnrollments, totalEnrollments),
        averageProgress: totalEnrollments
          ? Math.round(progress / totalEnrollments)
          : 0,
      },
      memberStats: [...buckets.values()].map(({ progress, ...m }) => ({
        ...m,
        averageProgress: m.totalCourses
          ? Math.round(progress / m.totalCourses)
          : 0,
      })),
      overdueEnrollments,
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to load statistics." });
  }
};
exports.getTrainerStats = async (req, res) => {
  try {
    const courses = await Course.find({ trainer: req.user._id })
      .select("title isApproved")
      .lean();
    const ids = courses.map((c) => c._id);
    const [enrollments, purchases] = await Promise.all([
      Enrollment.aggregate([
        { $match: { course: { $in: ids } } },
        {
          $group: {
            _id: "$course",
            totalEnrollments: { $sum: 1 },
            completedEnrollments: sumIf({ $eq: ["$completed", true] }),
            progress: { $sum: "$progress" },
          },
        },
      ]),
      Purchase.aggregate([
        { $match: { course: { $in: ids }, paymentStatus: "paid" } },
        { $group: { _id: "$course", revenue: { $sum: "$amount" } } },
      ]),
    ]);
    const byCourse = new Map(enrollments.map((e) => [String(e._id), e])),
      revenue = new Map(purchases.map((p) => [String(p._id), p.revenue]));
    let totalEnrollments = 0,
      completedEnrollments = 0;
    const courseStats = courses.map((c) => {
      const e = byCourse.get(String(c._id)) || {};
      totalEnrollments += e.totalEnrollments || 0;
      completedEnrollments += e.completedEnrollments || 0;
      return {
        course: { id: c._id, title: c.title, isApproved: c.isApproved },
        totalEnrollments: e.totalEnrollments || 0,
        completedEnrollments: e.completedEnrollments || 0,
        averageProgress: e.totalEnrollments
          ? Math.round(e.progress / e.totalEnrollments)
          : 0,
        revenue: revenue.get(String(c._id)) || 0,
      };
    });
    res.json({
      overview: {
        totalCourses: courses.length,
        approvedCourses: courses.filter((c) => c.isApproved).length,
        totalEnrollments,
        completedEnrollments,
        completionRate: percent(completedEnrollments, totalEnrollments),
      },
      courseStats,
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to load statistics." });
  }
};
