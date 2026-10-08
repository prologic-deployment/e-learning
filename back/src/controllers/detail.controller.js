const mongoose = require("mongoose");
const User = require("../models/User");
const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const Enrollment = require("../models/Enrollment");
const Review = require("../models/Review");
const AssessmentAttempt = require("../models/AssessmentAttempt");
const { assessmentReview } = require("../utils/assessmentReview");
const { gradeSubmission } = require("../utils/assessment");

const same = (a, b) =>
  a != null && b != null && String(a._id || a) === String(b._id || b);
const role = (req) =>
  Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
const staff = (req, c) =>
  role(req) === "admin" ||
  (role(req) === "trainer" && same(c.trainer, req.user._id));
const fail = () => {
  const error = new Error(
    "This record is unavailable or you do not have access.",
  );
  error.status = 404;
  throw error;
};
const field = (label, value) => ({
  label,
  value: value == null || value === "" ? "Not recorded" : value,
});
const fields = (obj) => Object.entries(obj).map(([k, v]) => field(k, v));
const name = (u) =>
  u
    ? [u.firstname, u.lastname].filter(Boolean).join(" ") || "Unnamed account"
    : "Deleted account";
const ref = (kind, id, query) =>
  id
    ? { kind, id: String(id._id || id), ...(query ? { query } : {}) }
    : undefined;
const section = (title, obj) => ({ title, fields: fields(obj) });
const LIMIT = 20;
function page(req, key) {
  const raw = req.query[key] || "1";
  if (!/^\d{1,6}$/.test(String(raw)) || Number(raw) < 1) {
    const e = new Error("Invalid page.");
    e.status = 400;
    throw e;
  }
  return Number(raw);
}
async function list(req, Model, filter, select, populates, key, title, mapper) {
  const requested = page(req, key),
    total = await Model.countDocuments(filter);
  const current = Math.min(requested, Math.max(1, Math.ceil(total / LIMIT)));
  let query = Model.find(filter)
    .select(select)
    .sort({ createdAt: -1, _id: -1 })
    .skip((current - 1) * LIMIT)
    .limit(LIMIT);
  for (const p of populates) query = query.populate(p);
  const records = await query.lean();
  return {
    title,
    items: records.map(mapper),
    page: { key, current, total, pages: Math.max(1, Math.ceil(total / LIMIT)) },
  };
}
async function person(req, id) {
  const u = await User.findById(id)
    .select("firstname lastname email role manager createdAt isActive")
    .lean();
  if (!u) fail();
  if (role(req) === "admin" || same(u, req.user._id)) return u;
  if (
    role(req) === "manager" &&
    same(u.manager, req.user._id) &&
    (u.role || []).includes("user")
  )
    return u;
  if (role(req) === "trainer") {
    const owned = await Course.find({ trainer: req.user._id })
      .select("_id")
      .lean();
    if (
      await Enrollment.exists({
        user: u._id,
        course: { $in: owned.map((c) => c._id) },
      })
    )
      return u;
  }
  fail();
}
async function course(req, id) {
  const c = await Course.findById(id)
    .select(
      "title description trainer category tags price isPaid isApproved deadline createdAt +isArchived +archivedAt",
    )
    .lean();
  if (!c) fail();
  if (staff(req, c) || (c.isApproved && !c.isArchived)) return c;
  // Existing enrollment history remains readable after a course is archived.
  if (await Enrollment.exists({ course: c._id, user: req.user._id })) return c;
  if (role(req) === "manager") {
    const team = await User.find({ manager: req.user._id, role: "user" })
      .select("_id")
      .lean();
    if (
      await Enrollment.exists({
        course: c._id,
        user: { $in: team.map((u) => u._id) },
      })
    )
      return c;
  }
  fail();
}
async function enrollment(req, id) {
  const e = await Enrollment.findById(id)
    .select(
      "user course progress completed deadline createdAt quizResults.lesson quizResults.score quizResults.passed quizResults.attempts quizResults.completedAt quiz2Results.lesson quiz2Results.score quiz2Results.passed quiz2Results.attempts quiz2Results.completedAt finalExamResult.lesson finalExamResult.score finalExamResult.passed finalExamResult.attempts finalExamResult.completedAt lessonsCompleted",
    )
    .lean();
  if (!e) fail();
  const c = await Course.findById(e.course)
    .select("title description trainer")
    .lean();
  if (!c) fail();
  if (!staff(req, c) && !same(e.user, req.user._id)) {
    if (
      role(req) !== "manager" ||
      !(await User.exists({ _id: e.user, manager: req.user._id, role: "user" }))
    )
      fail();
  }
  e.course = c;
  e.user = await User.findById(e.user)
    .select("firstname lastname email")
    .lean();
  return e;
}
const enrollmentItem = (e) => ({
  title: e.course?.title || "Deleted course",
  subtitle: name(e.user),
  fields: fields({
    Progress: `${e.progress || 0}%`,
    Status: e.completed ? "Completed" : "In progress",
    Enrolled: e.createdAt,
    Deadline: e.deadline,
  }),
  detail: ref("enrollment", e),
});
async function userDetail(req, id) {
  const u = await person(req, id),
    filter = { user: u._id };
  if (role(req) === "trainer" && !same(u, req.user._id)) {
    filter.course = {
      $in: (
        await Course.find({ trainer: req.user._id }).select("_id").lean()
      ).map((c) => c._id),
    };
  }
  const enrollments = await list(
    req,
    Enrollment,
    filter,
    "course progress completed deadline createdAt",
    [{ path: "course", select: "title" }],
    "enrollmentsPage",
    "Enrollments",
    (e) => enrollmentItem({ ...e, user: u }),
  );
  const sections = [
    section("Account", {
      Name: name(u),
      Email: u.email,
      Role: Array.isArray(u.role) ? u.role.join(", ") : u.role,
      Status: u.isActive ? "Active" : "Inactive",
      Joined: u.createdAt,
    }),
    enrollments,
  ];
  if (
    (u.role || []).includes("trainer") &&
    (role(req) === "admin" || same(u, req.user._id))
  ) {
    sections.push(
      await list(
        req,
        Course,
        { trainer: u._id },
        "title isApproved createdAt",
        [],
        "coursesPage",
        "Courses taught",
        (c) => ({
          title: c.title,
          fields: fields({ Status: c.isApproved ? "Published" : "Pending" }),
          detail: ref("course", c),
        }),
      ),
    );
  }
  if (
    (u.role || []).includes("manager") &&
    (role(req) === "admin" || same(u, req.user._id))
  ) {
    sections.push(
      await list(
        req,
        User,
        { manager: u._id, role: "user" },
        "firstname lastname email",
        [],
        "teamPage",
        "Team",
        (m) => ({ title: name(m), subtitle: m.email, detail: ref("user", m) }),
      ),
    );
  }
  return { title: name(u), subtitle: "Account details", sections };
}
async function courseDetail(req, id) {
  const c = await course(req, id),
    canReview = staff(req, c);
  const trainer = await User.findById(c.trainer)
    .select("firstname lastname")
    .lean();
  let filter = { course: c._id };
  if (!canReview)
    filter.user =
      role(req) === "manager"
        ? {
            $in: (
              await User.find({ manager: req.user._id, role: "user" })
                .select("_id")
                .lean()
            ).map((u) => u._id),
          }
        : req.user._id;
  const requested = page(req, "lessonsPage");
  const total = await Lesson.countDocuments({ course: c._id });
  const current = Math.min(requested, Math.max(1, Math.ceil(total / LIMIT)));
  const [lessons, enrollments, exam] = await Promise.all([
    Lesson.aggregate([
      { $match: { course: c._id } },
      { $sort: { order: 1, _id: 1 } },
      { $skip: (current - 1) * LIMIT },
      { $limit: LIMIT },
      {
        $project: {
          title: 1,
          order: 1,
          contentType: 1,
          questionCount: { $size: { $ifNull: ["$quiz.questions", []] } },
          quiz2Count: { $size: { $ifNull: ["$quiz2.questions", []] } },
        },
      },
    ]),
    list(
      req,
      Enrollment,
      filter,
      "user progress completed deadline createdAt",
      [{ path: "user", select: "firstname lastname email" }],
      "enrollmentsPage",
      canReview
        ? "Enrollments"
        : role(req) === "manager"
          ? "Your team’s enrollments"
          : "Your enrollment",
      (e) => enrollmentItem({ ...e, course: c }),
    ),
    Course.aggregate([
      { $match: { _id: c._id } },
      {
        $project: {
          count: { $size: { $ifNull: ["$finalExam.questions", []] } },
          passingScore: "$finalExam.noteMinimale",
          maxAttempts: "$finalExam.maxAttempts",
        },
      },
    ]),
  ]);
  return {
    title: c.title,
    subtitle: "Course details",
    sections: [
      section("Overview", {
        Description: c.description,
        Category: c.category,
        Instructor: name(trainer),
        Status: c.isArchived
          ? "Archived"
          : c.isApproved
            ? "Published"
            : "Pending approval",
        Access: c.isPaid ? "Paid" : "Free",
        Price: c.price,
        Tags: c.tags?.join(", "),
        Created: c.createdAt,
        Deadline: c.deadline,
        Archived: c.archivedAt,
      }),
      {
        title: "Curriculum",
        items: lessons.map((l) => ({
          title: l.title,
          fields: fields({
            Order: l.order,
            "Content type": l.contentType,
            "Quiz questions": l.questionCount,
            "Legacy quiz questions": l.quiz2Count,
          }),
          detail: ref("lesson", l),
        })),
        page: {
          key: "lessonsPage",
          current,
          total,
          pages: Math.max(1, Math.ceil(total / LIMIT)),
        },
      },
      section("Final assessment", {
        Questions: exam[0]?.count || 0,
        "Passing score": `${exam[0]?.passingScore || 70}%`,
        "Maximum attempts": exam[0]?.maxAttempts || 3,
      }),
      enrollments,
    ],
  };
}
async function lessonDetail(req, id) {
  const l = await Lesson.findById(id)
    .select(
      "course title content contentType order isFree quiz.noteMinimale quiz.maxAttempts quiz2.noteMinimale quiz2.maxAttempts",
    )
    .lean();
  if (!l) fail();
  const c = await course(req, l.course);
  // Match existing content access; archived/draft history is metadata-only for non-staff.
  let hasContent = staff(req, c);
  if (!hasContent && c.isApproved && !c.isArchived) {
    hasContent =
      role(req) === "manager" ||
      c.price === 0 ||
      l.isFree ||
      !!(await Enrollment.exists({ user: req.user._id, course: c._id })) ||
      !!(await require("../models/Purchase").exists({
        user: req.user._id,
        course: c._id,
        paymentStatus: "paid",
      }));
  }
  const [counts] = await Lesson.aggregate([
    { $match: { _id: l._id } },
    {
      $project: {
        quiz: { $size: { $ifNull: ["$quiz.questions", []] } },
        quiz2: { $size: { $ifNull: ["$quiz2.questions", []] } },
      },
    },
  ]);
  return {
    title: l.title,
    subtitle: c.title,
    sections: [
      section("Lesson", {
        Order: l.order,
        "Content type": l.contentType,
        Preview: l.isFree ? "Yes" : "No",
        Content: hasContent
          ? l.content
          : "Open this lesson through the course player after gaining access.",
      }),
      {
        title: "Course",
        items: [{ title: c.title, detail: ref("course", c) }],
      },
      section("Assessments", {
        "Quiz questions": counts?.quiz || 0,
        "Passing score": `${l.quiz?.noteMinimale || 70}%`,
        "Maximum attempts": l.quiz?.maxAttempts || 3,
        "Legacy quiz questions": counts?.quiz2 || 0,
      }),
    ],
  };
}
function resultItems(e) {
  return [
    ...(e.quizResults || []).map((r) => ({ ...r, type: "lesson_quiz" })),
    ...(e.quiz2Results || []).map((r) => ({ ...r, type: "lesson_quiz2" })),
    ...(typeof e.finalExamResult?.score === "number"
      ? [{ ...e.finalExamResult, type: "final_exam" }]
      : []),
  ].filter((r) => typeof r.score === "number");
}
async function enrollmentDetail(req, id) {
  const e = await enrollment(req, id),
    results = resultItems(e);
  const lessons = await Lesson.find({
    _id: { $in: results.map((r) => r.lesson).filter(Boolean) },
  })
    .select("title")
    .lean();
  const titles = new Map(lessons.map((l) => [String(l._id), l.title]));
  const current = Math.min(
    page(req, "resultsPage"),
    Math.max(1, Math.ceil(results.length / LIMIT)),
  );
  return {
    title: e.course.title,
    subtitle: `Enrollment · ${name(e.user)}`,
    notice:
      "Results show the latest saved result for each assessment, not a complete attempt history.",
    sections: [
      section("Progress", {
        Student: name(e.user),
        Email: e.user?.email,
        Enrolled: e.createdAt,
        Progress: `${e.progress || 0}%`,
        Status: e.completed ? "Completed" : "In progress",
        "Completed lessons": e.lessonsCompleted?.length || 0,
        Deadline: e.deadline,
      }),
      {
        title: "Related records",
        items: [
          { title: e.course.title, detail: ref("course", e.course) },
          ...(e.user
            ? [
                {
                  title: name(e.user),
                  subtitle: e.user.email,
                  detail: ref("user", e.user),
                },
              ]
            : []),
        ],
      },
      {
        title: "Assessment results",
        items: results
          .slice((current - 1) * LIMIT, current * LIMIT)
          .map((r) => ({
            title:
              r.type === "final_exam"
                ? "Final exam"
                : titles.get(String(r.lesson)) || "Deleted lesson",
            subtitle:
              r.type === "lesson_quiz2"
                ? "Legacy lesson quiz"
                : r.type === "final_exam"
                  ? "Final exam"
                  : "Lesson quiz",
            fields: fields({
              Score: `${r.score}%`,
              Status: r.passed ? "Passed" : "Not passed",
              Completed: r.completedAt,
              Attempt: r.attempts,
            }),
            detail: ref("result", e, {
              assessment: r.type,
              ...(r.lesson ? { lesson: String(r.lesson) } : {}),
            }),
          })),
        page: {
          key: "resultsPage",
          current,
          total: results.length,
          pages: Math.max(1, Math.ceil(results.length / LIMIT)),
        },
      },
    ],
  };
}
async function resultDetail(req, id) {
  const e = await enrollment(req, id),
    type = req.query.assessment;
  if (!["lesson_quiz", "lesson_quiz2", "final_exam"].includes(type)) {
    const error = new Error("Invalid assessment type.");
    error.status = 400;
    throw error;
  }
  if (
    type !== "final_exam" &&
    !mongoose.isObjectIdOrHexString(req.query.lesson)
  ) {
    const error = new Error("Invalid lesson.");
    error.status = 400;
    throw error;
  }
  const key =
    type === "final_exam"
      ? "finalExamResult"
      : type === "lesson_quiz2"
        ? "quiz2Results"
        : "quizResults";
  const pick = (doc) =>
    type === "final_exam"
      ? doc?.finalExamResult
      : doc?.[key]?.find((r) => same(r.lesson, req.query.lesson));
  const summary = pick(e);
  if (!summary || typeof summary.score !== "number") fail();
  const lesson =
    type === "final_exam"
      ? null
      : await Lesson.findById(req.query.lesson).select("title").lean();
  let review = null,
    evidence = "";
  if (staff(req, e.course)) {
    const evidenceDoc = await Enrollment.findById(id)
      .select(`+${key}.review`)
      .lean();
    const snapshotId = pick(evidenceDoc)?.review;
    if (snapshotId)
      review =
        (
          await require("../models/AssessmentReview")
            .findOne({ _id: snapshotId, enrollment: e._id })
            .select("+snapshot")
            .lean()
        )?.snapshot || null;
    if (review) evidence = "Saved at grading time";
    // Only finished, matching timed evidence is eligible; never use the current paper.
    if (!review && e.user && type !== "lesson_quiz2") {
      const attempt = await AssessmentAttempt.findOne({
        user: e.user?._id,
        course: e.course._id,
        target: type === "final_exam" ? e.course._id : req.query.lesson,
        kind: type === "final_exam" ? "final" : "lesson",
        status: "finished",
        attemptsUsed: summary.attempts,
        "result.score": summary.score,
        "result.passed": summary.passed,
      })
        .select("+paper")
        .sort({ createdAt: -1 })
        .lean();
      const paper = attempt?.paper;
      const completeKey =
        paper?.questions?.length &&
        paper.questions.every(
          (q) =>
            Array.isArray(q.options) &&
            (q.type === "multiple"
              ? Array.isArray(q.correctAnswers) &&
                q.correctAnswers.length > 0 &&
                q.correctAnswers.every(
                  (i) => Number.isInteger(i) && i >= 0 && i < q.options.length,
                )
              : Number.isInteger(q.correctAnswer) &&
                q.correctAnswer >= 0 &&
                q.correctAnswer < q.options.length),
        );
      if (
        completeKey &&
        gradeSubmission(paper.questions, attempt.answers).score ===
          summary.score &&
        summary.completedAt &&
        Math.abs(new Date(attempt.updatedAt) - new Date(summary.completedAt)) <
          60000
      ) {
        review = assessmentReview(attempt.paper, attempt.answers);
        review.durationSeconds = Math.max(
          0,
          Math.round(
            (new Date(attempt.updatedAt) - new Date(attempt.createdAt)) / 1000,
          ),
        );
        evidence = "Recovered from the matching finished timed attempt";
      }
    }
  }
  const sections = [
    section("Result", {
      Student: name(e.user),
      Email: e.user?.email,
      Course: e.course.title,
      "Course description": e.course.description,
      Lesson:
        lesson?.title ||
        (type === "final_exam" ? "Not applicable" : "Deleted lesson"),
      Assessment:
        type === "final_exam"
          ? "Final exam"
          : type === "lesson_quiz2"
            ? "Legacy lesson quiz"
            : "Lesson quiz",
      Completed: summary.completedAt,
      Score: `${summary.score}%`,
      Status: summary.passed ? "Passed" : "Not passed",
      Attempt: summary.attempts,
      "Maximum attempts": review?.maxAttempts,
      Questions: review?.total,
      Correct: review?.correct,
      Wrong: review?.wrong,
      Unanswered: review?.unanswered,
      Points: review
        ? `${review.earnedPoints} / ${review.possiblePoints}`
        : null,
      "Passing score": review ? `${review.passingScore}%` : null,
      Duration:
        review?.durationSeconds != null
          ? `${review.durationSeconds} seconds`
          : null,
    }),
    {
      title: "Related records",
      items: [
        { title: e.course.title, detail: ref("course", e.course) },
        { title: "Enrollment and progress", detail: ref("enrollment", e) },
        ...(lesson
          ? [{ title: lesson.title, detail: ref("lesson", lesson) }]
          : []),
      ],
    },
  ];
  return {
    title:
      type === "final_exam"
        ? "Final exam result"
        : `${lesson?.title || "Lesson"} · quiz result`,
    subtitle: name(e.user),
    sections,
    review,
    notice: review
      ? `${evidence}. This is the latest saved result; previous attempts are not listed.`
      : staff(req, e.course)
        ? "Answer-level review is unavailable for this historical result. Only its summary was saved; answers and question counts cannot be inferred from a score."
        : "Answer keys and per-question reviews are restricted to the course instructor and administrators.",
  };
}
async function reviewDetail(req, id) {
  const r = await Review.findById(id)
    .select("user course rating comment isApproved createdAt updatedAt")
    .lean();
  if (!r || (role(req) !== "admin" && !same(r.user, req.user._id))) fail();
  const [u, c] = await Promise.all([
    User.findById(r.user).select("firstname lastname email").lean(),
    Course.findById(r.course).select("title").lean(),
  ]);
  return {
    title: "Course review",
    subtitle: c?.title || "Deleted course",
    sections: [
      section("Review", {
        Reviewer: name(u),
        Email: u?.email,
        Rating: `${r.rating} / 5`,
        Comment: r.comment,
        Moderation: r.isApproved ? "Approved" : "Pending",
        Submitted: r.createdAt,
        Updated: r.updatedAt,
      }),
      {
        title: "Related records",
        items: [
          ...(c ? [{ title: c.title, detail: ref("course", c) }] : []),
          ...(u ? [{ title: name(u), detail: ref("user", u) }] : []),
        ],
      },
    ],
  };
}
const handlers = {
  user: userDetail,
  course: courseDetail,
  lesson: lessonDetail,
  enrollment: enrollmentDetail,
  result: resultDetail,
  review: reviewDetail,
};
exports.getDetail = async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (
    !Object.hasOwn(handlers, req.params.kind) ||
    !mongoose.isObjectIdOrHexString(req.params.id)
  )
    return res.status(400).json({ message: "Invalid record." });
  try {
    return res.json(await handlers[req.params.kind](req, req.params.id));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.status
        ? error.message
        : "Unable to load record details. Please try again.",
    });
  }
};
