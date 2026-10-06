const Lesson = require("../models/Lesson");
const Course = require("../models/Course");
const path = require("path");

// Ajouter une leçon à un cours
exports.addLesson = async (req, res) => {
  try {
    const { title, content, order, isFree } = req.body;
    const courseId = req.params.courseId;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // ✅ Vérifier que c'est le trainer du cours ou un admin (role normalisé)
    const role = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    if (course.trainer.toString() !== req.user._id.toString() && role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    let contentFile = null;
    let contentType = null;

    if (req.file) {
      contentFile = req.file.path.replace(/\\/g, '/');
      const ext = path.extname(req.file.originalname).toLowerCase();
      contentType = ['.mp4', '.mov', '.avi', '.mkv'].includes(ext) ? 'video' : 'pdf';
    }

    // Compter les leçons existantes pour l'ordre automatique
    const lessonsCount = await Lesson.countDocuments({ course: courseId });

    const lesson = await Lesson.create({
      course: courseId,
      title,
      content,
      contentFile,
      contentType,
      order: order || lessonsCount + 1,
      isFree: isFree || false
    });

    // Ajouter la leçon au cours
    await Course.findByIdAndUpdate(courseId, {
      $push: { lessons: lesson._id }
    });

    res.status(201).json({ message: "Lesson added successfully", lesson });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Obtenir les leçons d'un cours — access gated by middleware (enrollment/purchase)
// Answers stripped via route-level middleware; file paths removed for non-owners.
exports.getLessonsByCourse = async (req, res) => {
  try {
    const role = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    const isOwner = req.course && req.course.trainer.toString() === req.user._id.toString();
    const isStaff = role === "admin" || role === "manager" || isOwner;

    // ✅ ANSWER KEY POLICY: only the course OWNER or an admin receives
    // correctAnswer (needed to edit quizzes). It is select:false in the schema,
    // so it must be explicitly re-selected here; wrapStripAnswers middleware
    // re-strips it for everyone else as a second layer.
    let query = Lesson.find({ course: req.params.courseId });
    if (role === "admin" || isOwner) {
      query = query.select("+quiz.questions.correctAnswer +quiz2.questions.correctAnswer");
    }
    const lessons = await query.sort({ order: 1 });

    // ✅ Non-staff never receive content file paths (delivered via /api/files)
    const safe = lessons.map(l => {
      const plain = l.toObject();
      if (!isStaff) {
        delete plain.contentFile;
      }
      return plain;
    });

    res.status(200).json(safe);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Obtenir une leçon par ID
exports.getLessonById = async (req, res) => {
  try {
    const role = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    const isOwner = req.course && req.course.trainer.toString() === req.user._id.toString();
    const isStaff = role === "admin" || role === "manager" || isOwner;

    // ✅ Same answer-key policy as getLessonsByCourse (owner/admin only)
    let query = Lesson.findById(req.params.id);
    if (role === "admin" || isOwner) {
      query = query.select("+quiz.questions.correctAnswer +quiz2.questions.correctAnswer");
    }
    const lesson = await query;
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const plain = lesson.toObject();
    if (!isStaff) delete plain.contentFile;

    res.status(200).json(plain);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Modifier une leçon
exports.updateLesson = async (req, res) => {
  try {
    const { title, content, order, isFree } = req.body;
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    // ✅ IDOR fix: only the owning trainer or an admin may edit
    const parentCourse = await Course.findById(lesson.course);
    const role = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    if (!parentCourse || (parentCourse.trainer.toString() !== req.user._id.toString() && role !== "admin")) {
      return res.status(403).json({ message: "Access denied" });
    }

    let contentFile = lesson.contentFile;
    let contentType = lesson.contentType;

    if (req.file) {
      contentFile = req.file.path.replace(/\\/g, '/');
      const ext = path.extname(req.file.originalname).toLowerCase();
      contentType = ['.mp4', '.mov', '.avi', '.mkv'].includes(ext) ? 'video' : 'pdf';
    }

    const updated = await Lesson.findByIdAndUpdate(
      req.params.id,
      { title, content, contentFile, contentType, order, isFree },
      { new: true }
    );

    res.status(200).json({ message: "Lesson updated", lesson: updated });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Supprimer une leçon
exports.deleteLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    // ✅ IDOR fix: only the owning trainer or an admin may delete
    const parentCourse = await Course.findById(lesson.course);
    const role = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    if (!parentCourse || (parentCourse.trainer.toString() !== req.user._id.toString() && role !== "admin")) {
      return res.status(403).json({ message: "Access denied" });
    }

    await Lesson.findByIdAndDelete(req.params.id);

    // Retirer la leçon du cours
    await Course.findByIdAndUpdate(lesson.course, {
      $pull: { lessons: lesson._id }
    });

    res.status(200).json({ message: "Lesson deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};