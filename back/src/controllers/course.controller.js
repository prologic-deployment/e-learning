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
    const { title, description, tags, price, category, subCategory } = req.body;

    // ✅ Normaliser le role
    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    const isApproved = userRole === "admin";

    const course = new Course({
      title,
      description,
      tags: tags ? tags.split(",") : [],
      price: price || 0,
      category: category || '',
      subCategory: subCategory || '',
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
    // ✅ PUBLIC CATALOGUE: approved courses only, for everyone.
    // This route is unauthenticated (req.user is never set), so the old
    // "admin sees everything" branch could never run — pending courses never
    // reached the admin dashboard. Back-office lists use the authenticated
    // GET /api/courses/trainer/all (getAllCoursesForTrainer) instead.
    let filter = { isApproved: true };

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

    // ✅ Filtrage par sous-catégorie (échappé, ancré)
    if (req.query.subCategory) {
      const safeSub = String(req.query.subCategory).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 100);
      filter.subCategory = { $regex: `^${safeSub}$`, $options: 'i' };
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

    // ✅ Tri (liste blanche — aucune clé arbitraire passée à Mongo)
    const SORTS = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_asc: { price: 1, createdAt: -1 },
      price_desc: { price: -1, createdAt: -1 },
      title: { title: 1 }
    };
    const sort = SORTS[req.query.sort] || SORTS.newest;

    const courses = await Course.find(filter)
      .populate("trainer", "firstname lastname") // ✅ no trainer email in listings
      .sort(sort)
      .skip(skip)
      .limit(limit)
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

// ================= GET COURSE FACETS =================
// Public: counts of approved courses per category / sub-category / price,
// used by the catalogue filter sidebar.
exports.getCourseFacets = async (req, res) => {
  try {
    const [byCategory, bySubCategory, byPrice] = await Promise.all([
      Course.aggregate([
        { $match: { isApproved: true } },
        { $group: { _id: "$category", count: { $sum: 1 } } }
      ]),
      Course.aggregate([
        { $match: { isApproved: true, subCategory: { $nin: [null, ""] } } },
        { $group: { _id: { category: "$category", subCategory: "$subCategory" }, count: { $sum: 1 } } }
      ]),
      Course.aggregate([
        { $match: { isApproved: true } },
        { $group: { _id: { $cond: [{ $gt: ["$price", 0] }, "paid", "free"] }, count: { $sum: 1 } } }
      ])
    ]);

    const categories = {};
    for (const c of byCategory) if (c._id) categories[c._id] = c.count;

    const subCategories = {};
    for (const s of bySubCategory) {
      const cat = s._id.category || "";
      (subCategories[cat] = subCategories[cat] || {})[s._id.subCategory] = s.count;
    }

    const price = { free: 0, paid: 0 };
    for (const p of byPrice) price[p._id] = p.count;

    res.status(200).json({
      total: price.free + price.paid,
      categories,
      subCategories,
      price
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ================= GET COURSE BY ID =================
// Public-safe: anonymous users get the course sheet without content/answers.
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("trainer", "firstname lastname") // ✅ never expose trainer email
      // ✅ Public curriculum outline only — titles/type/order, never content or quizzes
      .populate({ path: "lessons", select: "title contentType order isFree", options: { sort: { order: 1 } } });

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

    const strip = (questions) => {
      if (!Array.isArray(questions)) return;
      questions.forEach(q => { delete q.correctAnswer; });
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
    const { title, description, tags, price, category, subCategory, isApproved } = req.body;

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
    if (subCategory !== undefined) course.subCategory = subCategory;
    // ✅ Only admins flip approval, and non-admin price changes require re-approval
    if (isApproved !== undefined && userRole === "admin") course.isApproved = isApproved;
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
    // ✅ DATA LEAK FIX: trainers only see their own courses (admin sees all,
    // approved AND pending — this is the admin's approval queue)
    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    const filter = userRole === "admin"
      ? { isArchived: { $ne: true } }      // archived courses have their own tab
      : { trainer: req.user._id };

    // Optional search (escaped, case-insensitive) on title / description / tags
    if (req.query.search) {
      const safe = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 100);
      const re = new RegExp(safe, "i");
      filter.$or = [{ title: re }, { description: re }, { tags: re }];
    }

    const courses = await Course.find(filter)
      .populate("trainer", "firstname lastname _id")
      .sort({ isApproved: 1, createdAt: -1 });   // pending first, newest first

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