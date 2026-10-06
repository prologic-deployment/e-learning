// Shared rules: clients never supply percentages or quiz completion.
const hasAssessment = lesson => Boolean(lesson.quiz?.questions?.length || lesson.quiz2?.questions?.length);
function calculateProgress(lessons, completedIds, finalExamPassed, hasFinalExam) {
  const completed = new Set(completedIds.map(String));
  const count = lessons.filter(l => completed.has(String(l._id))).length;
  const allLessonsCompleted = lessons.length > 0 && count === lessons.length;
  const examCompleted = Boolean(hasFinalExam && finalExamPassed);
  return {
    progress: examCompleted ? 100 : lessons.length ? Math.round(count / lessons.length * 100) : 0,
    completed: examCompleted || (allLessonsCompleted && !hasFinalExam),
    allLessonsCompleted
  };
}
module.exports = { hasAssessment, calculateProgress };
