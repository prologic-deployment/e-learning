const { gradeSubmission } = require("./assessment");
// Immutable evidence saved at grading time, not reconstructed from a subsequently edited quiz.
function assessmentReview(paper, answers, startedAt) {
  const questions = paper.questions.map((q, index) => {
    const answer = answers?.[index];
    const indexes =
      q.type === "multiple" ? (Array.isArray(answer) ? answer : []) : [answer];
    const valid = indexes.filter(
      (i) => Number.isInteger(i) && i >= 0 && i < q.options.length,
    );
    const correctIndexes =
      q.type === "multiple" ? q.correctAnswers || [] : [q.correctAnswer];
    const correct = gradeSubmission([q], [answer]).correct === 1;
    return {
      number: index + 1,
      text: q.texte,
      type: q.type || "single",
      studentAnswers: valid.map((i) => q.options[i]),
      correctAnswers: correctIndexes.map((i) => q.options[i]),
      correct,
      unanswered: answer == null || (Array.isArray(answer) && !answer.length),
      points: q.points || 1,
      earnedPoints: correct ? q.points || 1 : 0,
      timeLimitSeconds: q.timeLimitSeconds || 0,
      ...(typeof q.explanation === "string"
        ? { explanation: q.explanation }
        : {}),
    };
  });
  const correct = questions.filter((q) => q.correct).length;
  return {
    version: 1,
    questions,
    total: questions.length,
    correct,
    wrong: questions.length - correct,
    unanswered: questions.filter((q) => q.unanswered).length,
    earnedPoints: questions.reduce((n, q) => n + q.earnedPoints, 0),
    possiblePoints: questions.reduce((n, q) => n + q.points, 0),
    passingScore: paper.noteMinimale || 70,
    maxAttempts: paper.maxAttempts || 3,
    durationSeconds: startedAt
      ? Math.max(
          0,
          Math.round((Date.now() - new Date(startedAt).getTime()) / 1000),
        )
      : null,
  };
}
async function saveAssessmentReview(enrollment, paper, answers, startedAt) {
  const record = await require("../models/AssessmentReview").create({
    enrollment: enrollment._id,
    user: enrollment.user,
    course: enrollment.course,
    snapshot: assessmentReview(paper, answers, startedAt),
  });
  return record._id;
}
module.exports = { assessmentReview, saveAssessmentReview };
