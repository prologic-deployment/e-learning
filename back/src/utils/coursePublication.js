const {validateAssessment} = require('./assessment');
const {validateRequest} = require('../validation/input-policy');
/** Shared by admin publishing and seed preflight; answer keys are needed for validation only. */
function validateCourseForPublication(course, lessons) {
  if (course.isArchived) throw new Error('Restore the archived course before publishing.');
  const details = validateRequest('POST', '/api/courses', {title:course.title,description:course.description,price:course.price,category:course.category,tags:course.tags});
  if (Object.keys(details).length) throw new Error('Course details: '+Object.values(details)[0]);
  if (!lessons.length) throw new Error('Add at least one lesson before publishing.');
  const ids = (course.lessons || []).map(String);
  if (new Set(ids).size !== ids.length || ids.length !== lessons.length || lessons.some(l => !ids.includes(String(l._id))))
    throw new Error('Course lesson references must match its curriculum before publishing.');
  for (const [index, lesson] of lessons.entries()) {
    const fields = validateRequest('POST', '/api/lessons/course/'+course._id, {title:lesson.title,content:lesson.content,order:lesson.order});
    if (Object.keys(fields).length) throw new Error(`Lesson ${index + 1}: ${Object.values(fields)[0]}`);
    if (lesson.quiz2?.questions?.length) throw new Error(`Lesson ${index + 1}: remove the legacy second quiz before publishing.`);
    try { validateAssessment(lesson.quiz || {}); }
    catch (error) { throw new Error(`Lesson ${index + 1}: ${error.message}`); }
  }
  try { validateAssessment(course.finalExam || {}); }
  catch (error) { throw new Error(`Final exam: ${error.message}`); }
}
module.exports = {validateCourseForPublication};
