const Lesson = require("../models/Lesson");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Certificate = require("../models/Certificate");
const { createNotification } = require("../services/notification.service");
const { sendEmail } = require("../services/email.service");
const generateCertificatePDF = require("../utils/generateCertificatePDF");
const { checkCompletionBadges, checkQuizBadges, checkCertificateBadges } = require("../services/badge.service");
const config = require("../config/env");

// ============================================================
// ✅ Unified quiz/exam grading engine (replaces quiz + quiz2 duplication)
// ============================================================

const gradeSubmission = (questions, answers) => {
  const total = questions.length;
  let correct = 0;

  questions.forEach((q, index) => {
    const userAnswer = parseInt(answers?.[index]);
    if (isNaN(userAnswer) || userAnswer < 0 || userAnswer >= q.options.length) return;
    const selectedOption = q.options[userAnswer];
    if (!selectedOption || String(selectedOption).trim() === '') return;
    if (userAnswer === parseInt(q.correctAnswer)) correct++;
  });

  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, total, score };
};

// Server-side attempt counter — client cannot reset it
const recordAttempt = (enrollment, lessonId, quizKey) => {
  if (!Array.isArray(enrollment.quizAttemptCounts)) enrollment.quizAttemptCounts = [];
  let entry = enrollment.quizAttemptCounts.find(
    a => a.lesson.toString() === lessonId.toString() && a.quizKey === quizKey
  );
  if (!entry) {
    enrollment.quizAttemptCounts.push({ lesson: lessonId, quizKey, count: 0 });
    entry = enrollment.quizAttemptCounts[enrollment.quizAttemptCounts.length - 1];
  }
  entry.count += 1;
  return entry.count;
};

const getAttemptCount = (enrollment, lessonId, quizKey) => {
  const entry = (enrollment.quizAttemptCounts || []).find(
    a => a.lesson?.toString() === lessonId?.toString() && a.quizKey === quizKey
  );
  return entry?.count || 0;
};

const tooManyAttempts = (res, maxAttempts) => {
  return res.status(429).json({
    success: false,
    message: `Maximum number of attempts reached (${maxAttempts}). Contact your trainer to reset.`
  });
};

// ============================================================
// QUIZ CRUD (trainer of the course or admin only)
// ============================================================

const loadLessonWithOwnership = async (req, res) => {
  const lesson = await Lesson.findById(req.params.lessonId);
  if (!lesson) {
    res.status(404).json({ success: false, message: "Lesson not found" });
    return null;
  }
  const course = await Course.findById(lesson.course);
  if (!course) {
    res.status(404).json({ success: false, message: "Parent course not found" });
    return null;
  }
  const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
  if (userRole !== "admin" && course.trainer.toString() !== req.user._id.toString()) {
    res.status(403).json({ success: false, message: "You do not own this course." });
    return null;
  }
  return lesson;
};

const normalizeQuestions = (questions) => {
  if (!Array.isArray(questions)) return [];
  return questions.map(q => ({
    texte: String(q.texte || ''),
    options: (q.options || []).map(o => String(o)),
    correctAnswer: Number(q.correctAnswer) || 0,
    points: Number(q.points) || 1
  }));
};

exports.addQuizToLesson = async (req, res) => {
  try {
    const lesson = await loadLessonWithOwnership(req, res);
    if (!lesson) return;

    const { questions, noteMinimale, maxAttempts } = req.body;
    lesson.quiz = {
      questions: normalizeQuestions(questions),
      noteMinimale: noteMinimale || 70,
      maxAttempts: Math.max(1, Number(maxAttempts) || 3)
    };
    await lesson.save();

    res.status(200).json({ success: true, message: "Quiz added to lesson" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Legacy quiz2 endpoints — kept for data compatibility, same engine
exports.addQuiz2ToLesson = async (req, res) => {
  try {
    const lesson = await loadLessonWithOwnership(req, res);
    if (!lesson) return;

    const { questions, noteMinimale, maxAttempts } = req.body;
    lesson.quiz2 = {
      questions: normalizeQuestions(questions),
      noteMinimale: noteMinimale || 70,
      maxAttempts: Math.max(1, Number(maxAttempts) || 3)
    };
    await lesson.save();

    res.status(200).json({ success: true, message: "Quiz 2 added to lesson" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteQuizFromLesson = async (req, res) => {
  try {
    const lesson = await loadLessonWithOwnership(req, res);
    if (!lesson) return;
    lesson.quiz = { questions: [], noteMinimale: 70, maxAttempts: 3 };
    await lesson.save();
    res.status(200).json({ success: true, message: "Quiz deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteQuiz2FromLesson = async (req, res) => {
  try {
    const lesson = await loadLessonWithOwnership(req, res);
    if (!lesson) return;
    lesson.quiz2 = { questions: [], noteMinimale: 70, maxAttempts: 3 };
    await lesson.save();
    res.status(200).json({ success: true, message: "Quiz 2 deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.addFinalExam = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    if (userRole !== "admin" && course.trainer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "You do not own this course." });
    }

    const { questions, noteMinimale, maxAttempts } = req.body;
    course.finalExam = {
      questions: normalizeQuestions(questions),
      noteMinimale: noteMinimale || 70,
      maxAttempts: Math.max(1, Number(maxAttempts) || 3)
    };
    await course.save();

    res.status(200).json({ success: true, message: "Final exam added" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteFinalExam = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    if (userRole !== "admin" && course.trainer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "You do not own this course." });
    }

    course.finalExam = { questions: [], noteMinimale: 70, maxAttempts: 3 };
    await course.save();
    res.status(200).json({ success: true, message: "Final exam deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================================
// SUBMISSIONS (enrolled users — answers never sent to clients)
// ============================================================

exports.submitLessonQuiz = async (req, res) => {
  try {
    const { answers } = req.body;
    const lessonId = req.params.lessonId;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson || !lesson.quiz || !lesson.quiz.questions?.length) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    const enrollment = await Enrollment.findOne({
      user: req.user._id,
      course: lesson.course
    });

    if (!enrollment) {
      return res.status(403).json({ success: false, message: "You are not enrolled in this course" });
    }

    // ✅ Attempt limit — enforced server-side
    const maxAttempts = lesson.quiz.maxAttempts || 3;
    const used = getAttemptCount(enrollment, lessonId, "quiz");
    if (used >= maxAttempts) return tooManyAttempts(res, maxAttempts);
    recordAttempt(enrollment, lessonId, "quiz");

    const { correct, total, score } = gradeSubmission(lesson.quiz.questions, answers);
    const passed = score >= (lesson.quiz.noteMinimale || 70);

    const existingResult = enrollment.quizResults.find(
      r => r.lesson.toString() === lessonId
    );

    if (existingResult) {
      existingResult.score = score;
      existingResult.passed = passed;
      existingResult.attempts += 1;
      existingResult.completedAt = new Date();
    } else {
      enrollment.quizResults.push({
        lesson: lessonId,
        score,
        passed,
        attempts: 1,
        completedAt: new Date()
      });
    }

    if (passed) {
      const alreadyCompleted = enrollment.lessonsCompleted
        .map(l => l.toString())
        .includes(lessonId.toString());

      if (!alreadyCompleted) {
        enrollment.lessonsCompleted.push(lessonId);
      }

      // ✅ Single source of truth: progress is computed server-side
      const totalLessons = await Lesson.countDocuments({ course: lesson.course });
      if (totalLessons > 0) {
        enrollment.progress = Math.round(
          (enrollment.lessonsCompleted.length / totalLessons) * 100
        );
      }

      checkQuizBadges(req.user._id, score).catch(console.error);
    }

    await enrollment.save();

    res.status(200).json({
      score,
      passed,
      correct,
      total,
      attemptsUsed: used + 1,
      maxAttempts,
      noteMinimale: lesson.quiz.noteMinimale || 70,
      message: passed ? "✅ Quiz passed !" : "❌ Quiz failed, try again !"
    });
  } catch (error) {
    console.error('submitLessonQuiz error:', error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.submitLessonQuiz2 = async (req, res) => {
  try {
    const { answers } = req.body;
    const lessonId = req.params.lessonId;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson || !lesson.quiz2 || !lesson.quiz2.questions?.length) {
      return res.status(404).json({ success: false, message: "Quiz 2 not found" });
    }

    const enrollment = await Enrollment.findOne({
      user: req.user._id,
      course: lesson.course
    });

    if (!enrollment) {
      return res.status(403).json({ success: false, message: "You are not enrolled in this course" });
    }

    const maxAttempts = lesson.quiz2.maxAttempts || 3;
    const used = getAttemptCount(enrollment, lessonId, "quiz2");
    if (used >= maxAttempts) return tooManyAttempts(res, maxAttempts);
    recordAttempt(enrollment, lessonId, "quiz2");

    const { correct, total, score } = gradeSubmission(lesson.quiz2.questions, answers);
    const passed = score >= (lesson.quiz2.noteMinimale || 70);

    const existingResult = (enrollment.quiz2Results || []).find(
      r => r.lesson.toString() === lessonId
    );

    if (existingResult) {
      existingResult.score = score;
      existingResult.passed = passed;
      existingResult.attempts += 1;
      existingResult.completedAt = new Date();
    } else {
      if (!enrollment.quiz2Results) enrollment.quiz2Results = [];
      enrollment.quiz2Results.push({
        lesson: lessonId,
        score,
        passed,
        attempts: 1,
        completedAt: new Date()
      });
    }

    await enrollment.save();

    res.status(200).json({
      score, passed, correct, total,
      attemptsUsed: used + 1,
      maxAttempts,
      noteMinimale: lesson.quiz2.noteMinimale || 70,
      message: passed ? "✅ Quiz 2 passed !" : "❌ Quiz 2 failed, try again !"
    });
  } catch (error) {
    console.error('submitLessonQuiz2 error:', error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.submitFinalExam = async (req, res) => {
  try {
    const { answers } = req.body;
    const courseId = req.params.courseId;

    const course = await Course.findById(courseId);
    if (!course || !course.finalExam || !course.finalExam.questions?.length) {
      return res.status(404).json({ success: false, message: "Final exam not found" });
    }

    const enrollment = await Enrollment.findOne({
      user: req.user._id,
      course: courseId
    });

    if (!enrollment) {
      return res.status(403).json({ success: false, message: "You are not enrolled in this course" });
    }

    // ✅ Attempt limit
    const maxAttempts = course.finalExam.maxAttempts || 3;
    if (enrollment.finalExamAttempts >= maxAttempts) {
      return tooManyAttempts(res, maxAttempts);
    }
    enrollment.finalExamAttempts += 1;

    const { correct, total, score } = gradeSubmission(course.finalExam.questions, answers);
    const passed = score >= (course.finalExam.noteMinimale || 70);

    enrollment.finalExamResult = {
      score,
      passed,
      attempts: enrollment.finalExamAttempts,
      completedAt: new Date()
    };

    if (passed) {
      enrollment.completed = true;
      enrollment.progress = 100;

      checkCompletionBadges(req.user._id, enrollment).catch(console.error);
      checkQuizBadges(req.user._id, score).catch(console.error);

      const User = require("../models/User");
      const user = await User.findById(req.user._id).select("firstname lastname email");

      const existing = await Certificate.findOne({
        user: req.user._id,
        course: courseId
      });

      if (!existing) {
        try {
          const { fileName, serial, verificationCode } = await generateCertificatePDF(
            `${user.firstname} ${user.lastname}`,
            course.title,
            new Date()
          );

          const certificateUrl = `/uploads/certificates/${fileName}`;

          await Certificate.create({
            user: req.user._id,
            course: courseId,
            trainer: course.trainer,
            date: new Date(),
            certificateUrl,
            serial,
            verificationCode,
            isValid: true
          });

          checkCertificateBadges(req.user._id).catch(console.error);

          await createNotification(
            req.user._id,
            "BADGE_EARNED",
            "🎓 Félicitations ! Certificat obtenu !",
            `Vous avez réussi l'examen final du cours "${course.title}" avec un score de ${score}% !`,
            { courseId }
          );

          sendEmail({
            to: user.email,
            subject: "🎓 Félicitations ! Certificat obtenu !",
            html: `
              <div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
                <h2>Félicitations ${user.firstname} ! 🎓</h2>
                <p>Vous avez réussi l'examen final du cours <strong>${course.title}</strong>
                avec un score de <strong>${score}%</strong> !</p>
                <p>Votre certificat est disponible dans votre dashboard.</p>
                <a href="${config.frontendUrl}/dashboard"
                   style="background:#2c3e50; color:white; padding:10px 20px;
                   text-decoration:none; border-radius:5px;
                   display:inline-block; margin-top:15px;">
                  🏅 Voir mon certificat
                </a>
              </div>
            `
          }).catch(err => console.error('❌ Email error:', err.message));
        } catch (certError) {
          console.error('⚠️ Certificate error:', certError.message);
        }
      }
    }

    await enrollment.save();

    res.status(200).json({
      score,
      passed,
      correct,
      total,
      attemptsUsed: enrollment.finalExamAttempts,
      maxAttempts,
      noteMinimale: course.finalExam.noteMinimale || 70,
      message: passed ? "🎓 Exam passed ! Certificate generated !" : "❌ Exam failed, try again !",
      certificate: passed ? "generated" : null
    });
  } catch (error) {
    console.error('submitFinalExam error:', error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Trainer/admin — results scoped to their own courses
exports.getAllQuizResults = async (req, res) => {
  try {
    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;

    // ✅ Trainers only see results for THEIR courses
    let courseFilter = {};
    if (userRole === "trainer") {
      const ownCourses = await Course.find({ trainer: req.user._id }).select("_id");
      courseFilter = { course: { $in: ownCourses.map(c => c._id) } };
    }

    const enrollments = await Enrollment.find({
      ...courseFilter,
      $or: [
        { 'quizResults.0': { $exists: true } },
        { 'finalExamResult.score': { $exists: true } }
      ]
    })
      .populate('user', 'firstname lastname email')
      .populate('course', 'title category trainer')
      .populate('quizResults.lesson', 'title');

    const results = [];

    enrollments.forEach(enrollment => {
      enrollment.quizResults.forEach(qr => {
        results.push({
          user: enrollment.user,
          course: enrollment.course,
          lessonTitle: qr.lesson?.title || 'Lesson Quiz',
          type: 'lesson_quiz',
          score: qr.score,
          passed: qr.passed,
          attempts: qr.attempts,
          completedAt: qr.completedAt
        });
      });

      if (enrollment.finalExamResult?.score !== undefined) {
        results.push({
          user: enrollment.user,
          course: enrollment.course,
          lessonTitle: 'Final Exam',
          type: 'final_exam',
          score: enrollment.finalExamResult.score,
          passed: enrollment.finalExamResult.passed,
          attempts: enrollment.finalExamResult.attempts,
          completedAt: enrollment.finalExamResult.completedAt
        });
      }
    });

    results.sort((a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    res.status(200).json({ results, total: results.length });
  } catch (error) {
    console.error('getAllQuizResults error:', error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
