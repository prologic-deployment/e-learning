
const Enrollment = require("../models/Enrollment");
const Purchase = require("../models/Purchase");
const Course = require("../models/Course");  
const { invalidateCache } = require("../middlewares/cache.middleware");  
const { checkEnrollmentBadges } = require("../services/badge.service");





exports.getMyEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ user: req.user._id })
      .populate({ path: "course", select: "title description category trainer", populate: { path: "trainer", select: "firstname lastname" } })
      .exec();

    res.status(200).json(enrollments);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.updateProgress = async (req, res) => {
  try {
    const { id } = req.params;

    const enrollment = await Enrollment.findById(id);
    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    if (enrollment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    // ✅ ANTI-FORGERY: progress is recomputed server-side from completed lessons.
    // Client-sent progress values are ignored — certificates can no longer be
    // obtained by sending { progress: 100 }.
    const Lesson = require("../models/Lesson");
    const { hasAssessment, calculateProgress } = require('../utils/learningProgress');
    const lessons = await Lesson.find({ course: enrollment.course }).select('_id quiz quiz2').lean();
    // Only non-assessed lessons may be explicitly marked read. Quiz-bearing
    // lessons are completed exclusively by the server grading endpoints.
    if (req.body.lessonId) {
      const lesson = lessons.find(l => String(l._id) === String(req.body.lessonId));
      if (!lesson) return res.status(404).json({ message: 'Lesson not found in this course' });
      if (hasAssessment(lesson)) return res.status(403).json({ message: 'Pass the lesson assessment to complete it' });
      if (!enrollment.lessonsCompleted.some(id => String(id) === String(lesson._id))) {
        enrollment.lessonsCompleted.push(lesson._id);
      }
    }
    const course = await Course.findById(enrollment.course).select('finalExam');
    const state = calculateProgress(lessons, enrollment.lessonsCompleted,
      Boolean(enrollment.finalExamResult?.passed), Boolean(course?.finalExam?.questions?.length));
    enrollment.progress = state.progress;
    enrollment.completed = state.completed;

    await enrollment.save();
    checkEnrollmentBadges(req.user._id).catch(console.error);

    await invalidateCache('cache:GET:/api/enrollments:*');

    res.status(200).json({
      message: "Progress updated",
      enrollment
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};


exports.enrollInCourse = async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId } = req.params;

    // Vérifier cours existant et approuvé
    const course = await Course.findOne({
      _id: courseId,
      isApproved: true
    });

    if (!course) {
      return res.status(404).json({
        message: "Course not found or not approved"
      });
    }

    
    if (course.price > 0) {
      const purchase = await Purchase.findOne({
        user: userId,
        course: courseId,
        paymentStatus: "paid"
      });

      if (!purchase) {
        return res.status(403).json({
          message: "You must purchase this course before enrolling"
        });
      }
    }

    const enrollment = await Enrollment.create({
      user: userId,
      course: courseId
    });

   
    await Promise.all([
      invalidateCache('cache:GET:/api/enrollments:*'),
      invalidateCache('cache:GET:/api/courses:*')  
    ]);

    res.status(201).json({
      message: "Enrolled successfully",
      enrollment
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Already enrolled in this course"
      });
    }

    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// Définir une deadline (Manager/Admin)
exports.setDeadline = async (req, res) => {
  try {
    const { enrollmentId, deadline } = req.body;

    const enrollment = await Enrollment.findById(enrollmentId)
      .populate("user", "firstname email manager")
      .populate("course", "title");

    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    // ✅ SCOPING FIX: managers may only set deadlines inside their own team
    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    if (userRole === "manager") {
      const memberManagerId = enrollment.user.manager?.toString();
      if (memberManagerId !== req.user._id.toString()) {
        return res.status(403).json({ message: "This learner is not in your team" });
      }
    }

    enrollment.deadline = new Date(deadline);
    enrollment.reminderSent = false;
    await enrollment.save();

    res.status(200).json({ message: "Deadline set successfully", enrollment });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
// Shared browser/server input contract. Route guards still run first.
for (const name of ["updateProgress", "enrollInCourse", "setDeadline"]) {
  exports[name] = require("../validation/validate-input").withInputValidation(exports[name]);
}
