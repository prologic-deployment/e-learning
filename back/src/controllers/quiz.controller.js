const Lesson = require("../models/Lesson");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Certificate = require("../models/Certificate");
const { createNotification } = require("../services/notification.service");
const { sendEmail } = require("../services/email.service");
const generateCertificatePDF = require("../utils/generateCertificatePDF");
const { checkCompletionBadges, checkQuizBadges, checkCertificateBadges } = require("../services/badge.service");
const config = require("../config/env");

// Keep lesson-only courses completable, while final exams remain authoritative.
async function refreshLearningState(enrollment, courseId) {
  const { calculateProgress } = require('../utils/learningProgress');
  const lessons = await Lesson.find({ course: courseId }).select('_id').lean();
  const course = await Course.findById(courseId).select('finalExam');
  const state = calculateProgress(lessons, enrollment.lessonsCompleted,
    Boolean(enrollment.finalExamResult?.passed), Boolean(course?.finalExam?.questions?.length));
  enrollment.progress = state.progress;
  enrollment.completed = state.completed;
}

// ============================================================
// ✅ Unified quiz/exam grading engine (replaces quiz + quiz2 duplication)
// ============================================================

const {gradeSubmission,validateAssessment}=require('../utils/assessment');

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

exports.addQuizToLesson = async (req,res)=>{
 try{const lesson=await loadLessonWithOwnership(req,res);if(!lesson)return;
 let quiz;try{quiz=validateAssessment(req.body);}catch(e){return res.status(400).json({message:e.message});}
 if(lesson.quiz2?.questions?.length)return res.status(409).json({message:'A legacy second quiz exists. Remove it before saving the single lesson quiz.'});
 const editing=req.method==='PUT';
 const updated=await Lesson.findOneAndUpdate({_id:lesson._id,'quiz.questions.0':{$exists:editing},'quiz2.questions.0':{$exists:false}},{$set:{quiz}},{returnDocument:'after',runValidators:true});
 if(!updated)return res.status(editing?404:409).json({message:editing?'No quiz exists to update.':'This lesson already has a quiz. Edit it instead.'});
 res.json({message:editing?'Lesson quiz updated.':'Lesson quiz created.'});
 }catch(e){res.status(500).json({message:'Unable to save the lesson quiz.'});}
};
exports.addQuiz2ToLesson=(req,res)=>res.status(409).json({message:'Only one quiz per lesson is supported. Edit the existing lesson quiz.'});

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

    const lessons=await Lesson.find({course:course._id}).select('quiz quiz2');
    if(!lessons.length||lessons.some(l=>(l.quiz?.questions?.length||0)<20||l.quiz2?.questions?.length))return res.status(400).json({message:'Add lessons and complete one 20-question quiz per lesson before the final exam.'});
    try{course.finalExam=validateAssessment(req.body);}catch(e){return res.status(400).json({message:e.message});}
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

    // ✅ GRADING FIX: correctAnswer is select:false (never leave the server —
    // good) but that also hid it from THIS grading query, making every
    // submission score 0. Explicitly re-include it for grading only; the
    // response contains scores, never questions.
    const lesson = await Lesson.findById(lessonId)
      .select("+quiz.questions.correctAnswer +quiz.questions.correctAnswers");
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

    if(lesson.quiz.questions.some(q=>q.timeLimitSeconds>0)&&!req.assessmentAttempt)return res.status(409).json({message:'Start a timed attempt before answering this quiz.'});
    // Attempt limit — enforced server-side
    const maxAttempts = req.assessmentAttempt?.maxAttempts || lesson.quiz.maxAttempts || 3;
    const used = req.assessmentAttempt ? req.assessmentAttempt.attemptsUsed-1 : getAttemptCount(enrollment, lessonId, "quiz");
    if (used >= maxAttempts) return tooManyAttempts(res, maxAttempts);
    if(!req.assessmentAttempt)recordAttempt(enrollment, lessonId, "quiz");

    const { correct, total, score } = gradeSubmission(req.assessmentAttempt?.questions || lesson.quiz.questions, answers);
    const passed = score >= (req.assessmentAttempt?.noteMinimale || lesson.quiz.noteMinimale || 70);

    const existingResult = enrollment.quizResults.find(
      r => r.lesson.toString() === lessonId
    );

    if (existingResult) {
      existingResult.score = score;
      existingResult.passed = passed;
      existingResult.attempts = req.assessmentAttempt?.attemptsUsed || existingResult.attempts+1;
      existingResult.completedAt = new Date();
    } else {
      enrollment.quizResults.push({
        lesson: lessonId,
        score,
        passed,
        attempts: req.assessmentAttempt?.attemptsUsed || 1,
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

      await refreshLearningState(enrollment, lesson.course);

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
      noteMinimale: req.assessmentAttempt?.noteMinimale || lesson.quiz.noteMinimale || 70,
      message: passed ? " Quiz passed !" : " Quiz failed, try again !"
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

    // ✅ Same grading fix as submitLessonQuiz (quiz2 answer key)
    const lesson = await Lesson.findById(lessonId)
      .select("+quiz2.questions.correctAnswer +quiz2.questions.correctAnswers");
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
      existingResult.attempts = req.assessmentAttempt?.attemptsUsed || existingResult.attempts+1;
      existingResult.completedAt = new Date();
    } else {
      if (!enrollment.quiz2Results) enrollment.quiz2Results = [];
      enrollment.quiz2Results.push({
        lesson: lessonId,
        score,
        passed,
        attempts: req.assessmentAttempt?.attemptsUsed || 1,
        completedAt: new Date()
      });
    }

    // Legacy quiz2-only lessons use the same completion rules as primary quizzes.
    if (passed && !lesson.quiz?.questions?.length) {
      if (!enrollment.lessonsCompleted.some(id => String(id) === String(lessonId))) enrollment.lessonsCompleted.push(lessonId);
      await refreshLearningState(enrollment, lesson.course);
    }

    await enrollment.save();

    res.status(200).json({
      score, passed, correct, total,
      attemptsUsed: used + 1,
      maxAttempts,
      noteMinimale: lesson.quiz2.noteMinimale || 70,
      message: passed ? " Quiz 2 passed !" : " Quiz 2 failed, try again !"
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

    // ✅ GRADING FIX: re-include the select:false answer key for grading only
    // (identical to the lesson-quiz fix — responses carry scores only).
    const course = await Course.findById(courseId)
      .select("+finalExam.questions.correctAnswer +finalExam.questions.correctAnswers");
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

    // ✅ ELIGIBILITY GATE: the final exam unlocks only when every lesson of the
    // course is completed — i.e. every quiz-bearing lesson has been PASSED
    // (lessonsCompleted is pushed only on a passing quiz score server-side).
    // The client-side lock is never trusted; this is the authoritative check.
    const courseLessons = await Lesson.find({ course: courseId }).select("_id quiz quiz2").lean();
    const completedIds = (enrollment.lessonsCompleted || []).map(l => l.toString());
    const requiredLessons = courseLessons.filter(
      l => (l.quiz?.questions?.length || 0) > 0 || (l.quiz2?.questions?.length || 0) > 0
    );
    const missing = requiredLessons.filter(l => !completedIds.includes(l._id.toString()));
    if (courseLessons.length === 0 || missing.length > 0) {
      return res.status(403).json({
        success: false,
        message: "Complete all lesson quizzes before taking the final exam."
      });
    }

    if(course.finalExam.questions.some(q=>q.timeLimitSeconds>0)&&!req.assessmentAttempt)return res.status(409).json({message:'Start a timed attempt before answering this exam.'});
    // Attempt limit
    const maxAttempts = req.assessmentAttempt?.maxAttempts || course.finalExam.maxAttempts || 3;
    if (!req.assessmentAttempt && enrollment.finalExamAttempts >= maxAttempts) {
      return tooManyAttempts(res, maxAttempts);
    }
    if(!req.assessmentAttempt)enrollment.finalExamAttempts += 1;

    const { correct, total, score } = gradeSubmission(req.assessmentAttempt?.questions || course.finalExam.questions, answers);
    const passed = score >= (req.assessmentAttempt?.noteMinimale || course.finalExam.noteMinimale || 70);

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
            " Félicitations ! Certificat obtenu !",
            `Vous avez réussi l'examen final du cours "${course.title}" avec un score de ${score}% !`,
            { courseId }
          );

          sendEmail({
            to: user.email,
            subject: " Félicitations ! Certificat obtenu !",
            html: `
              <div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
                <h2>Félicitations ${user.firstname} ! </h2>
                <p>Vous avez réussi l'examen final du cours <strong>${course.title}</strong>
                avec un score de <strong>${score}%</strong> !</p>
                <p>Votre certificat est disponible dans votre dashboard.</p>
                <a href="${config.frontendUrl}/dashboard"
                   style="background:#2c3e50; color:white; padding:10px 20px;
                   text-decoration:none; border-radius:5px;
                   display:inline-block; margin-top:15px;">
                   Voir mon certificat
                </a>
              </div>
            `
          }).catch(err => console.error(' Email error:', err.message));
        } catch (certError) {
          console.error(' Certificate error:', certError.message);
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
      noteMinimale: req.assessmentAttempt?.noteMinimale || course.finalExam.noteMinimale || 70,
      message: passed ? " Exam passed ! Certificate generated !" : " Exam failed, try again !",
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
