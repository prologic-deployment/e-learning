// ✅ src/controllers/course.controller.js
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Purchase = require("../models/Purchase");
const { invalidateCache } = require("../middlewares/cache.middleware");
const { notifyNewCourse } = require("../services/notification.service");
const config = require("../config/env");

// ================= CREATE COURSE =================
exports.createCourse = async (req, res) => {
  try {
    const { title, description, tags, price, category } = req.body;

    // ✅ Normaliser le role
    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    const isApproved = false; // Drafts are published explicitly after curriculum review.

    const course = new Course({
      title,
      description,
      tags: Array.isArray(tags) ? [...new Set(tags.map(t=>String(t).trim()).filter(Boolean))].slice(0,20) : tags ? tags.split(",").map(t=>t.trim()).filter(Boolean).slice(0,20) : [],
      price: price || 0,
      category: category || '',
      trainer: req.user._id,
      isApproved
    });

    await course.save();

    await invalidateCache('cache:GET:/api/courses:*');

    if (isApproved) {
      await notifyNewCourse(course);
    }

    res.status(201).json({ message: "Course created successfully", course });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.getAllCourses = async (req, res) => {
  try {
    let filter = {};

    // ✅ Filtre par rôle
    if (!req.user) {
      filter = { isApproved: true };
    } else if (req.user.role === "user") {
      filter = { isApproved: true };
    } else if (req.user.role === "trainer") {
      filter = { trainer: req.user._id };
    }
    // admin et manager voient tout → filter reste {}

    // ✅ Recherche par titre, description et tags — user input escaped (ReDoS + 500 fix)
    if (req.query.search) {
      const safe = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 100);
      filter.$or = [
        { title: { $regex: safe, $options: "i" } },
        { description: { $regex: safe, $options: "i" } },
        { tags: { $in: [new RegExp(safe, 'i')] } }
      ];
    }

    // ✅ Filtrage par tag avec regex échappée
    if (req.query.tag) {
      const safeTag = String(req.query.tag).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 100);
      filter.tags = { $in: [new RegExp(safeTag, 'i')] };
    }

    // ✅ Filtrage par catégorie (échappé, ancré)
    if (req.query.category) {
      const safeCat = String(req.query.category).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 100);
      filter.category = { $regex: `^${safeCat}$`, $options: 'i' };
    }

    // ✅ Filtrage par prix
    if (req.query.type === "free") {
      filter.price = 0;
    } else if (req.query.type === "paid") {
      filter.price = { $gt: 0 };
    }

    // ✅ Filtrage par formateur
    if (req.query.trainer) {
      filter.trainer = req.query.trainer;
    }

    // ✅ Pagination (limit plafonné pour éviter les extractions massives)
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const total = await Course.countDocuments(filter);

    const courses = await Course.find(filter)
      .populate("trainer", "firstname lastname") //  no trainer email in listings
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    res.status(200).json({
      courses,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ================= GET COURSE BY ID =================
// Public-safe: anonymous users get the course sheet without content/answers.
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .select(req.user ? "+isArchived +finalExam.questions.correctAnswer +finalExam.questions.correctAnswers" : "+isArchived")
      .populate("trainer", "firstname lastname"); //  never expose trainer email

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const plain = course.toObject();

    const userRole = Array.isArray(req.user?.role) ? req.user.role[0] : req.user?.role;
    // ✅ ANSWER KEY POLICY: kept ONLY for its author (course owner) or an admin —
    // they need it to edit the exam from their dashboards. Learners, managers
    // and anonymous visitors get it stripped.
    const isOwnerOrAdmin = !!req.user && (
      userRole === "admin" ||
      course.trainer._id.toString() === req.user._id.toString()
    );

    if((!course.isApproved||course.isArchived)&&!isOwnerOrAdmin)return res.status(404).json({message:'Course not available.'});
    delete plain.isArchived;
    const strip = (questions) => {
      if (!Array.isArray(questions)) return;
      questions.forEach(q => { delete q.correctAnswer; delete q.correctAnswers; });
    };
    if (!isOwnerOrAdmin) strip(plain.finalExam?.questions);

    // Anonymous visitor — public storefront sheet
    if (!req.user) {
      delete plain.contentFile;
      if (plain.finalExam) {
        // ✅ LEAK FIX: exam paper (questions) is course content — anonymous
        // visitors only get existence metadata, never the questions.
        plain.finalExam = {
          questionsCount: Array.isArray(plain.finalExam.questions)
            ? plain.finalExam.questions.length : 0,
          noteMinimale: plain.finalExam.noteMinimale
        };
      }
      return res.status(200).json({ ...plain, isPurchased: false, isEnrolled: false });
    }

    const isStaff = userRole === "admin" || userRole === "manager" ||
      course.trainer._id.toString() === req.user._id.toString();

    if (isStaff) {
      return res.status(200).json({ ...plain, isPurchased: true, isEnrolled: true });
    }

    const enrolled = !!(await Enrollment.findOne({ user: req.user._id, course: course._id }));

    // ✅ LEAK FIX: unenrolled users must not receive the exam paper either.
    // Enrolled learners keep the questions (answer key already stripped above).
    if (!enrolled && plain.finalExam) {
      plain.finalExam = {
        questionsCount: Array.isArray(plain.finalExam.questions)
          ? plain.finalExam.questions.length : 0,
        noteMinimale: plain.finalExam.noteMinimale
      };
    }

    // Si cours payant → vérifier l'achat
    if (course.price > 0) {
      const purchase = await Purchase.findOne({
        user: req.user._id,
        course: course._id,
        paymentStatus: "paid"
      });

      if (!purchase) {
        return res.status(200).json({
          ...plain,
          contentFile: null,
          isPurchased: false,
          isEnrolled: enrolled
        });
      }

      return res.status(200).json({ ...plain, isPurchased: true, isEnrolled: enrolled });
    }

    res.status(200).json({
      ...plain,
      contentFile: plain.price > 0 ? plain.contentFile : null,
      isPurchased: true,
      isEnrolled: enrolled
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ================= UPDATE COURSE =================
exports.updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, tags, price, category, isApproved } = req.body;

    // ✅ Prevent un-approved edits from publishing content changes silently
    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;

    const course = await Course.findById(id);
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (userRole !== "admin" && req.user._id.toString() !== course.trainer.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (title) course.title = title;
    if (description) course.description = description;
    if (tags) course.tags = typeof tags === 'string' ? tags.split(",") : tags;
    if (price !== undefined) course.price = price;
    if (category) course.category = category;
    // ✅ Only admins flip approval, and non-admin price changes require re-approval
    if (isApproved !== undefined && userRole === "admin") {
      if (typeof isApproved !== 'boolean') return res.status(400).json({message:'isApproved must be a boolean.'});
      if (isApproved) return res.status(400).json({message:'Use the course approval action to publish after curriculum validation.'});
      course.isApproved = false;
    }
    if (userRole !== "admin" && (title || description || tags || price !== undefined || category)) {
      course.isApproved = false;
    }

    await course.save();

    await Promise.all([
      invalidateCache('cache:GET:/api/courses:*'),
      invalidateCache(`cache:GET:/api/courses/${id}:*`)
    ]);

    res.status(200).json({ message: "Course updated successfully", course });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ================= DELETE COURSE =================
exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findById(id);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    if (userRole !== "admin" && req.user._id.toString() !== course.trainer.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    // ✅ DATA INTEGRITY: cascade-delete dependent records so the platform
    // never keeps orphaned lessons/enrollments/purchases/reviews/certificates.
    const Lesson = require("../models/Lesson");
    const Review = require("../models/Review");
    const Certificate = require("../models/Certificate");

    await Lesson.deleteMany({ course: id });
    await require('../models/AssessmentReview').deleteMany({course:id});
    await Enrollment.deleteMany({ course: id });
    await Purchase.deleteMany({ course: id });
    await Review.deleteMany({ course: id });
    await Certificate.deleteMany({ course: id });

    await Course.findByIdAndDelete(id);

    // 🗑️ INVALIDER LE CACHE
    await Promise.all([
      invalidateCache('cache:GET:/api/courses:*'),
      invalidateCache(`cache:GET:/api/courses/${id}:*`),
      invalidateCache('cache:GET:/api/enrollments:*')  // Les enrollments peuvent être affectés
    ]);

    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ================= APPROVE COURSE (ADMIN) =================


exports.approveCourse = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Normaliser le role
    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    if (userRole !== "admin") return res.status(403).json({ message: "Access denied" });

    const course = await Course.findById(id);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const lessons=await require('../models/Lesson').find({course:id}).select('quiz quiz2');
    if(!lessons.length || lessons.some(l=>(l.quiz?.questions?.length||0)<20 || l.quiz2?.questions?.length) || (course.finalExam?.questions?.length||0)<20)return res.status(400).json({message:'Complete the lessons, one 20-question quiz per lesson, and the final exam before publishing.'});
    course.isApproved = true;
    await course.save();

    await Promise.all([
      invalidateCache('cache:GET:/api/courses:*'),
      invalidateCache(`cache:GET:/api/courses/${id}:*`)
    ]);

    notifyNewCourse(course);

    res.status(200).json({ message: "Course approved successfully", course });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ================= ENROLL COURSE =================
// ⚠️ DEPRECATED endpoint — kept for backward compatibility but now enforces the
// same rules as POST /api/enrollments/:courseId/enroll (approval + payment).
exports.enrollCourse = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ PAYWALL FIX: approved courses only, paid courses require purchase
    const course = await Course.findOne({ _id: id, isApproved: true });
    if (!course) {
      return res.status(404).json({ message: "Course not found or not approved" });
    }

    if (course.price > 0) {
      const purchase = await Purchase.findOne({
        user: req.user._id,
        course: id,
        paymentStatus: "paid"
      });

      if (!purchase) {
        return res.status(403).json({ message: "You must purchase this course before enrolling" });
      }
    }

    const enrollment = new Enrollment({
      user: req.user._id,
      course: id
    });

    await enrollment.save();

    // 🗑️ INVALIDER LE CACHE
    // (car les stats du cours peuvent changer : nombre d'inscrits, etc.)
    await Promise.all([
      invalidateCache('cache:GET:/api/courses:*'),
      invalidateCache(`cache:GET:/api/courses/${id}:*`),
      invalidateCache('cache:GET:/api/enrollments:*')
    ]);

    res.status(201).json({
      message: "Enrolled successfully",
      enrollment
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Already enrolled" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.getAllCoursesForTrainer = async (req, res) => {
  try {
    // ✅ DATA LEAK FIX: trainers only see their own courses (admin sees all)
    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    const filter = userRole === "admin" ? {} : { trainer: req.user._id };

    const courses = await Course.find(filter)
      .select('title description category tags price trainer isApproved isPaid createdAt updatedAt')
      .populate("trainer", "firstname lastname _id")
      .sort({ createdAt: -1 }).lean();

    res.status(200).json({ courses });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.restoreCourse = async (req, res) => {
  try {
  await Course.findByIdAndUpdate (req.params.id, {
  isArchived: false,
  archivedAt: null
  });
  res.status(200).json({ message: 'Cours restauré' });
  } catch (error) {
  res.status(500).json({ message: config.prodLike ? 'Server error' : error.message });
  }
};

exports.archiveCourse = async (req, res) => {
  try {
    await Course.findByIdAndUpdate(req.params.id, {
      isArchived: true,
      isApproved: false,
      archivedAt: new Date()
    });
    res.status(200).json({ message: 'Cours archivé' });
  } catch (error) {
    res.status(500).json({ message: config.prodLike ? 'Server error' : error.message });
  }
};

// Shared browser/server input contract. Route guards still run first.
for (const name of ["createCourse", "updateCourse", "deleteCourse", "approveCourse", "enrollCourse", "archiveCourse", "restoreCourse"]) {
  exports[name] = require("../validation/validate-input").withInputValidation(exports[name]);
}
