const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config/env");

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided."
      });
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await User.findById(decoded.id).select("-password");

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User not found or inactive."
      });
    }

    // ✅ SECURITY: reject tokens issued before the last password change/reset.
    // tokenVersion is incremented on every credential change.
    if (
      typeof decoded.tokenVersion === "number" &&
      decoded.tokenVersion !== (user.tokenVersion || 0)
    ) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please sign in again."
      });
    }

    // Normalize legacy array roles
    if (Array.isArray(user.role)) {
      user.role = user.role[0];
      await User.findByIdAndUpdate(decoded.id, { role: user.role });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed."
    });
  }
};

// ===== ROLE AUTHORIZATION =====
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden."
      });
    }

    req.user.role = userRole;
    next();
  };
};

// ===== COURSE OWNERSHIP — trainer-of-course OR admin =====
const isCourseOwnerOrAdmin = (getCourse) => {
  return async (req, res, next) => {
    try {
      const course = await getCourse(req);
      if (!course) {
        return res.status(404).json({ success: false, message: "Course not found" });
      }

      const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;

      if (
        userRole !== "admin" &&
        course.trainer.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not own this course."
        });
      }

      req.course = course;
      next();
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
};

// ===== PAID-CONTENT ACCESS — enrolled OR purchased OR free-preview OR staff =====
const requireCourseAccess = (options = {}) => {
  const { allowFreePreview = true, allowStaff = true, lessonIdParam = null } = options;
  const Course = require("../models/Course");
  const Enrollment = require("../models/Enrollment");
  const Purchase = require("../models/Purchase");
  const Lesson = require("../models/Lesson");

  return async (req, res, next) => {
    try {
      const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;

      // Resolve the course from a course, lesson (:lessonId), or explicit
      // lesson-id param (used by GET /api/lessons/:id where :id IS a lesson).
      let courseId = req.params.courseId || req.params.id;
      let lesson = null;
      const lessonParam = req.params.lessonId || (lessonIdParam ? req.params[lessonIdParam] : null);
      if (lessonParam) {
        lesson = await Lesson.findById(lessonParam);
        if (!lesson) return res.status(404).json({ success: false, message: "Lesson not found" });
        req.lesson = lesson;
        courseId = lesson.course.toString();
      }

      const course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ success: false, message: "Course not found" });
      req.course = course;

      // Staff (admin or the course's own trainer) always has access
      if (allowStaff && (userRole === "admin" || course.trainer.toString() === req.user._id.toString())) {
        return next();
      }

      // Managers supervise their teams — allow course overview access
      if (userRole === "manager") {
        return next();
      }

      const enrolled = await Enrollment.exists({ user: req.user._id, course: course._id });
      if (enrolled) return next();

      const purchased = await Purchase.exists({
        user: req.user._id,
        course: course._id,
        paymentStatus: "paid"
      });
      if (purchased) return next();

      // Free preview: a free course OR an explicitly free preview lesson
      if (allowFreePreview && (course.price === 0 || (lesson && lesson.isFree))) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: "Enroll in this course to access its content."
      });
    } catch (error) {
      console.error("requireCourseAccess error:", error.message);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
};

// Strip correctAnswer from quiz/exam questions before sending to any client
const stripAnswers = (obj) => {
  if (!obj) return obj;
  const o = JSON.parse(JSON.stringify(obj));
  const clean = (questions) => {
    if (!Array.isArray(questions)) return;
    questions.forEach(q => { delete q.correctAnswer; });
  };
  if (o.quiz) clean(o.quiz.questions);
  if (o.quiz2) clean(o.quiz2.questions);
  if (o.finalExam) clean(o.finalExam.questions);
  return o;
};

// ✅ Express middleware wrapper — usable directly in a route chain
// (the previous raw function crashed as middleware: as (req,res,next) it
// tried to JSON.stringify(req) which contains a circular Socket −> 500).
// Staff exception: the course OWNER or an admin receives the answer key —
// they authored it and need it to edit quizzes. Learners/anonymous never do
// (requireCourseAccess runs first and sets req.course).
const wrapStripAnswers = (req, res, next) => {
  const role = Array.isArray(req.user?.role) ? req.user.role[0] : req.user?.role;
  const isOwnerOrAdmin = req.user && (
    role === "admin" ||
    (req.course && req.course.trainer?.toString() === req.user._id.toString())
  );
  if (isOwnerOrAdmin) return next();

  const json = res.json.bind(res);
  res.json = (data) => {
    res.json = json;
    try {
      const o = JSON.parse(JSON.stringify(data));
      stripAnswers(o);
      return json(o);
    } catch {
      return json(data);
    }
  };
  next();
};

module.exports = {
  protect,
  authorize,
  isCourseOwnerOrAdmin,
  requireCourseAccess,
  stripAnswers,
  wrapStripAnswers
};
