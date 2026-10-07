/**
 * AUDIT PROBE — empirically confirms suspected bugs before fixing them.
 * Run with the API server started as:  npm start (isolated password-only test accounts)
 */
const { login, makeApi, check, summary } = require('./helpers/e2e');

(async () => {
  console.log('--- Logging in all roles ---');
  let admin, trainer, manager, user;
  try {
    const [a, t, m, u] = await Promise.all([
      login('admin@test.com', 'Admin123'),
      login('trainer1@test.com', 'Trainer123'),
      login('manager1@test.com', 'Manager123'),
      login('user1@test.com', 'User1234')
    ]);
    admin = makeApi(a);
    trainer = makeApi(t);
    manager = makeApi(m);
    user = makeApi(u);
    check('All 4 roles can login via OTP', true);
  } catch (e) {
    console.log('❌ Login failed:', e.message);
    process.exit(1);
  }

  // Reset the server-side attempt counters for user1 so repeated probe runs
  // don't trip the max-attempts guard (local dev DB only; progress kept).
  console.log('\n--- Reset attempt counters (dev DB) ---');
  try {
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elearning_pfe');
    const u1 = await mongoose.connection.db.collection('users').findOne({ email: 'user1@test.com' });
    if (u1) {
      await mongoose.connection.db.collection('enrollments').updateMany(
        { user: u1._id },
        { $set: { quizAttemptCounts: [], finalExamAttempts: 0 } }
      );
    }
    await mongoose.disconnect();
    check('Attempt counters reset for user1', true);
  } catch (e) {
    console.log('   (reset skipped:', e.message + ')');
  }

  console.log('\n--- A. Registration (ReferenceError suspect) ---');
  const email = `probe${Date.now()}@test.com`;
  const reg = await user('POST', '/api/auth/register', {
    firstname: 'Probe', lastname: 'Tester', email,
    password: 'Probe1234', dateOfBirth: '1995-05-05'
  });
  check('Register returns 201', reg.status === 201,
    `status=${reg.status} body=${JSON.stringify(reg.body)}`);

  // Fresh user = guaranteed ZERO enrollments/purchases → deterministic
  // content-gate checks (seeded user1 may legitimately own seeded courses).
  let fresh;
  try {
    fresh = makeApi(await login(email, 'Probe1234'));
  } catch {
    check('Fresh probe user can login', false, 'login failed');
  }

  console.log('\n--- B. Lesson routes (stripAnswers middleware suspect) ---');
  const courses = await user('GET', '/api/courses?limit=5');
  const approved = (courses.body?.courses || []).filter(c => c.isApproved);
  console.log(`   approved courses visible: ${approved.length}`);
  const target = approved[0];
  if (target) {
    const lessons = await (fresh || user)('GET', `/api/lessons/course/${target._id}`);
    // ✅ Content-gate policy: PAID courses block unenrolled users with 403
    // (the old code 500'd here due to the broken stripAnswers middleware);
    // FREE courses allow preview (existing product design) but must never
    // include the answer key in the payload.
    const expectedGate = target.price > 0 ? 403 : 200;
    const gateOk = lessons.status === expectedGate;
    const noLeak = expectedGate === 200
      ? !JSON.stringify(lessons.body).includes('correctAnswer')
      : true;
    check('GET /lessons/course/:id unenrolled → content-gate enforced', gateOk && noLeak,
      `price=${target.price} status=${lessons.status} (expected ${expectedGate}) leak=${!noLeak}`);
    if (lessons.status === 200 && Array.isArray(lessons.body) && lessons.body[0]) {
      const one = await user('GET', `/api/lessons/${lessons.body[0]._id}`);
      check('GET /lessons/:id returns 200', one.status === 200,
        `status=${one.status} body=${JSON.stringify(one.body).slice(0, 200)}`);
      // Check answer leakage through list route
      const leaked = JSON.stringify(lessons.body).includes('correctAnswer');
      check('Lesson list does NOT leak correctAnswer', !leaked, 'correctAnswer found in payload');
    }

    console.log('\n--- B2. Lesson routes with ENROLLED course ---');
  const mine = await user('GET', '/api/enrollments/me');
  const myEnrollments = Array.isArray(mine.body) ? mine.body : [];
  console.log(`   user1 enrollments: ${myEnrollments.length}`);
  const enrolledCourse = myEnrollments[0]?.course;
  if (enrolledCourse?._id) {
    const lessons = await user('GET', `/api/lessons/course/${enrolledCourse._id}`);
    check('GET /lessons/course/:id (enrolled) returns 200', lessons.status === 200,
      `status=${lessons.status} body=${JSON.stringify(lessons.body).slice(0, 200)}`);
    if (lessons.status === 200 && Array.isArray(lessons.body) && lessons.body.length) {
      const leaked = JSON.stringify(lessons.body).includes('correctAnswer');
      check('Lesson list does NOT leak correctAnswer', !leaked, 'correctAnswer present in payload');
      const one = await user('GET', `/api/lessons/${lessons.body[0]._id}`);
      check('GET /lessons/:id (enrolled) returns 200', one.status === 200,
        `status=${one.status} body=${JSON.stringify(one.body).slice(0, 200)}`);
      const quizLesson = lessons.body.find(l => l.quiz?.questions?.length);
      if (quizLesson) {
        const quizAnswers = new Array(quizLesson.quiz.questions.length).fill(0);
        const sub = await user('POST', `/api/quiz/lesson/${quizLesson._id}/submit`, { answers: quizAnswers });
        check('Quiz submit (enrolled) returns 200', sub.status === 200,
          `status=${sub.status} body=${JSON.stringify(sub.body).slice(0, 200)}`);
        console.log(`   quiz submit score: ${sub.body?.score} (all answers=0)`);
      }
      // exam flow on enrolled course
      const examCourse = await user('GET', `/api/courses/${enrolledCourse._id}`);
      const examN = examCourse.body?.finalExam?.questions?.length || 0;
      if (examN) {
        const examAttempt = await user('POST', `/api/quiz/final/${enrolledCourse._id}/submit`,
          { answers: new Array(examN).fill(0) });
        check('Exam submit before completing lessons is rejected (4xx)', examAttempt.status >= 400,
          `status=${examAttempt.status} body=${JSON.stringify(examAttempt.body).slice(0, 150)}`);
      }
    } else if (lessons.status === 500) {
      check('GET /lessons/:id works', false, '500 — stripAnswers middleware suspected');
    }
  } else {
    console.log('   (user1 has no enrollments — skipping B2)');
  }

  console.log('\n--- C. Final exam eligibility bypass (0% progress) ---');
    // try submitting exam without having completed anything
    const hasExam = await user('GET', `/api/courses/${target._id}`);
    const examQs = hasExam.body?.finalExam?.questions?.length || 0;
    console.log(`   course "${target.title}" exam questions exposed to user: ${examQs}`);
    const answers = new Array(examQs || 1).fill(0);
    const examAttempt = await user('POST', `/api/quiz/final/${target._id}/submit`, { answers });
    check('Exam submit at 0% progress is rejected (4xx)', examAttempt.status >= 400,
      `status=${examAttempt.status} body=${JSON.stringify(examAttempt.body).slice(0, 200)}`);
  }

  console.log('\n--- D. Missing/broken frontend-called endpoints ---');
  check('GET /courses/archived exists (admin)', (await admin('GET', '/api/courses/archived')).status === 200);
  check('GET /purchases/me exists (user)', (await user('GET', '/api/purchases/me')).status === 200);
  check('PUT /profile/update exists (trainer)', (await trainer('PUT', '/api/profile/update', { firstname: 'T1' })).status === 200);
  check('PUT /auth/change-password exists (trainer)', (await trainer('PUT', '/api/auth/change-password', { currentPassword: 'x', newPassword: 'y' })).status !== 404);

  console.log('\n--- E. Role security ---');
  check('USER cannot create course (403)', (await user('POST', '/api/courses', { title: 'X', description: 'Y' })).status === 403);
  check('USER cannot list trainer courses (403)', (await user('GET', '/api/courses/trainer/all')).status === 403);
  check('USER cannot submit quiz-create (403)', (await user('POST', '/api/quiz/lesson/000000000000000000000000', {})).status === 403);
  check('MANAGER cannot approve course (403)', (await manager('PUT', `/api/courses/${target?._id || 'x'}/approve`, {})).status === 403);
  check('TRAINER cannot see admin stats (403)', (await trainer('GET', '/api/stats/admin')).status === 403);
  const noauth = makeApi('invalid.token.here');
  check('Bad token rejected 401', (await noauth('GET', '/api/enrollments/me')).status === 401);

  console.log('\n--- F. Manager endpoints sanity ---');
  check('GET /managers/team (manager)', (await manager('GET', '/api/managers/team')).status === 200);
  check('GET /managers/team-progress (manager)', (await manager('GET', '/api/managers/team-progress')).status === 200);
  check('GET /stats/manager (manager)', (await manager('GET', '/api/stats/manager')).status === 200);

  const failed = summary('AUDIT PROBE');
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error('PROBE CRASH:', e); process.exit(2); });
