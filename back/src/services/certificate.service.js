/**
 * Certificate issuing — the single place that decides eligibility, creates
 * the Certificate record and renders the branded PDF into
 * back/uploads/certificates.
 *
 * Eligibility: every lesson of the course completed AND, when the course
 * has a final exam, that exam passed.
 *
 * Integrity: serial + HMAC verification code over "serial|holder|course"
 * (same formula verified by GET /api/certificates/verify/:id).
 */
const crypto = require("crypto");
const Certificate = require("../models/Certificate");
const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const User = require("../models/User");
const config = require("../config/env");
const generateCertificatePDF = require("../utils/generateCertificatePDF");
const { createNotification } = require("./notification.service");
const { sendEmail } = require("./email.service");
const { checkCertificateBadges } = require("./badge.service");

const hasFinalExam = (course) => (course?.finalExam?.questions?.length || 0) > 0;

/**
 * Is this enrollment allowed to receive a certificate for this course?
 *
 * Lessons count as completed server-side only when their quiz is passed, so
 * "all lessons completed" means every quiz-bearing lesson passed — the same
 * rule as the final-exam gate in quiz.controller. A course without any
 * lesson quiz cannot be verified as completed and never qualifies.
 */
async function isEligible(enrollment, course) {
  if (!enrollment || !course) return false;
  const lessons = await Lesson.find({ course: course._id }).select("_id quiz quiz2").lean();
  const required = lessons.filter(
    l => (l.quiz?.questions?.length || 0) > 0 || (l.quiz2?.questions?.length || 0) > 0
  );
  const done = new Set((enrollment.lessonsCompleted || []).map(id => id.toString()));
  const lessonsDone = required.length > 0 && required.every(l => done.has(l._id.toString()));
  const examOk = !hasFinalExam(course) || enrollment.finalExamResult?.passed === true;
  return lessonsDone && examOk;
}

/**
 * Called after any progress event (lesson quiz passed, final exam passed,
 * progress refresh): marks the enrollment completed and issues the
 * certificate when the course is finished. Saves the enrollment.
 */
async function completeIfEligible(enrollment) {
  const course = await Course.findById(enrollment.course).select("title trainer finalExam");
  if (!course || !(await isEligible(enrollment, course))) return null;
  if (!enrollment.completed) {
    enrollment.completed = true;
    enrollment.progress = 100;
    await enrollment.save();
  }
  const score = hasFinalExam(course) ? (enrollment.finalExamResult?.score ?? null) : null;
  const { certificate } = await issueCertificate({ userId: enrollment.user, courseId: course._id, score });
  return certificate;
}

function signature(serial, holder, courseTitle) {
  const secret = process.env.JWT_SECRET || "dev-only-secret";
  return crypto.createHmac("sha256", secret)
    .update(`${serial}|${holder}|${courseTitle}`)
    .digest("hex").substring(0, 16).toUpperCase();
}

const PDF_VERSION = 2;

/** Public page opened by the QR code */
function verifyPageUrl(serial) {
  return `${config.frontendUrl}/verify/${encodeURIComponent(serial)}`;
}

function newSerial(date = new Date()) {
  return `CERT-${date.getFullYear()}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

/** Render (or re-render) the PDF of an existing certificate and store its URL */
async function renderPdf(certificate, { score = null } = {}) {
  const [user, course] = await Promise.all([
    User.findById(certificate.user).select("firstname lastname"),
    Course.findById(certificate.course).populate("trainer", "firstname lastname")
  ]);
  if (!user || !course) throw new Error("Certificate holder or course not found");

  const holder = `${user.firstname} ${user.lastname}`;
  if (!certificate.serial) certificate.serial = newSerial(certificate.date || new Date());
  certificate.verificationCode = signature(certificate.serial, holder, course.title);

  const lessonsCount = await Lesson.countDocuments({ course: course._id });
  const { fileName } = await generateCertificatePDF({
    name: holder,
    courseTitle: course.title,
    category: course.category,
    subCategory: course.subCategory,
    trainerName: course.trainer ? `${course.trainer.firstname} ${course.trainer.lastname}` : "",
    lessonsCount,
    score: hasFinalExam(course) ? (score ?? certificate.score ?? null) : null,
    date: certificate.date || new Date(),
    serial: certificate.serial,
    verificationCode: certificate.verificationCode,
    verifyUrl: verifyPageUrl(certificate.serial)
  });

  certificate.certificateUrl = `/uploads/certificates/${fileName}`;
  certificate.pdfVersion = PDF_VERSION;
  if (score != null) certificate.score = score;
  await certificate.save();
  return certificate;
}

/**
 * Issue the certificate for (user, course) if not issued yet.
 * Returns { certificate, created }. Throws only on real failures.
 * Notification, email and badges are best-effort.
 */
async function issueCertificate({ userId, courseId, score = null, notify = true }) {
  const existing = await Certificate.findOne({ user: userId, course: courseId });
  if (existing) {
    // Older records (e.g. seeded) may have no PDF yet — render it now
    if (!existing.certificateUrl) await renderPdf(existing, { score });
    return { certificate: existing, created: false };
  }

  const course = await Course.findById(courseId).select("title trainer");
  if (!course) throw new Error("Course not found");

  let certificate;
  try {
    certificate = await Certificate.create({
      user: userId,
      course: courseId,
      trainer: course.trainer,
      date: new Date(),
      serial: newSerial(),
      score,
      isValid: true
    });
  } catch (e) {
    // Unique (user, course) index: a concurrent request already issued it
    if (e.code === 11000) {
      return { certificate: await Certificate.findOne({ user: userId, course: courseId }), created: false };
    }
    throw e;
  }

  try {
    await renderPdf(certificate, { score });
  } catch (e) {
    // Never leave a certificate record without its file
    await Certificate.deleteOne({ _id: certificate._id });
    throw e;
  }

  if (notify) notifyIssued(userId, course, score).catch(() => {});
  return { certificate, created: true };
}

async function notifyIssued(userId, course, score) {
  const user = await User.findById(userId).select("firstname email");
  checkCertificateBadges(userId).catch(() => {});
  await createNotification(
    userId,
    "BADGE_EARNED",
    "Certificate earned",
    score != null
      ? `You passed the final exam of "${course.title}" with ${score}% — your certificate is ready.`
      : `You completed "${course.title}" — your certificate is ready.`,
    { courseId: course._id }
  );
  if (user?.email) {
    await sendEmail({
      to: user.email,
      subject: `Your certificate for "${course.title}"`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0B0D12;">
          <div style="background:#0B0D12; padding:18px 24px; border-left:6px solid #1E3A8A;">
            <span style="color:#fff; font-weight:700; letter-spacing:1px;">PROLOGIC</span>
            <span style="color:#9DB4EE; font-size:11px; letter-spacing:3px; margin-left:6px;">ACADEMY</span>
          </div>
          <div style="padding:24px;">
            <h2 style="margin:0 0 12px;">Congratulations ${user.firstname}!</h2>
            <p>You completed <strong>${course.title}</strong>${score != null ? ` with a final exam score of <strong>${score}%</strong>` : ""}.</p>
            <p>Your certificate is available in your dashboard.</p>
            <a href="${config.frontendUrl}/dashboard?tab=certificates"
               style="display:inline-block; margin-top:12px; background:#1E3A8A; color:#fff; padding:12px 20px; text-decoration:none; font-weight:700;">
              View my certificate
            </a>
          </div>
        </div>`
    });
  }
}

module.exports = {
  PDF_VERSION,
  verifyPageUrl, isEligible, completeIfEligible, issueCertificate, renderPdf, hasFinalExam, signature };
