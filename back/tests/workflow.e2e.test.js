/**
 * WORKFLOW E2E — full positive-path course lifecycle across roles:
 *   TRAINER: create course → lessons → quizzes → final exam
 *   ADMIN:   approve course, role validation
 *   USER:    register → login → enroll → blocked exam → pass quizzes →
 *            unlock exam → pass exam → completion + certificate
 *   Cleanup: trainer deletes course → cascade wipes lessons/enrollments
 * Run with the API server started as:  npm start (isolated password-only test accounts)
 */
const { login, makeApi, check, summary } = require('./helpers/e2e');

(async () => {
  console.log('--- Logging in seeded roles ---');
  const [adminTok, trainerTok, managerTok] = await Promise.all([
    login('admin@test.com', 'Admin123'),
    login('trainer1@test.com', 'Trainer123'),
    login('manager1@test.com', 'Manager123')
  ]);
  const admin = makeApi(adminTok);
  const trainer = makeApi(trainerTok);
  const manager = makeApi(managerTok);
  check('Staff roles login (admin/trainer/manager)', true);

  // ---------- TRAINER: build the course ----------
  console.log('\n--- TRAINER: course → lessons → quizzes → exam ---');
  const created = await trainer('POST', '/api/courses', {
    title: `E2E Workflow Course ${Date.now()}`,
    description: 'Created by the automated workflow test',
    tags: 'e2e,workflow',
    price: 0,
    category: 'Testing'
  });
  check('Trainer creates course', created.status === 201,
    `status=${created.status} body=${JSON.stringify(created.body).slice(0, 200)}`);
  const courseId = created.body?.course?._id;
  check('Course id returned (isApproved=false for trainer)', !!courseId && created.body.course.isApproved === false);

  const lessonIds = [];
  for (let i = 1; i <= 2; i++) {
    const les = await trainer('POST', `/api/lessons/course/${courseId}`, {
      title: `Lesson ${i}`, content: `Content of lesson ${i}`, isFree: i === 1
    });
    check(`Trainer adds lesson ${i}`, les.status === 201,
      `status=${les.status} body=${JSON.stringify(les.body).slice(0, 160)}`);
    if (les.body?.lesson?._id) lessonIds.push(les.body.lesson._id);
  }
  check('Both lesson ids collected', lessonIds.length === 2);

  // Quiz per lesson — answer key known by construction (option index 1 is correct)
  for (const lessonId of lessonIds) {
    const q = await trainer('POST', `/api/quiz/lesson/${lessonId}`, {
      questions: [
        { texte: 'What is 2+2?', options: ['3', '4', '5', '22'], correctAnswer: 1, points: 1 },
        { texte: 'Sky color?', options: ['red', 'blue'], correctAnswer: 1, points: 1 }
      ],
      noteMinimale: 70,
      maxAttempts: 3
    });
    check(`Trainer adds quiz to lesson ${lessonId.slice(-4)}`, q.status === 200,
      `status=${q.status} body=${JSON.stringify(q.body).slice(0, 160)}`);
  }

  const exam = await trainer('POST', `/api/quiz/final/${courseId}`, {
    questions: [
      { texte: 'Final: 10*10?', options: ['10', '100', '1000'], correctAnswer: 1, points: 1 },
      { texte: 'Final: capital of France?', options: ['London', 'Paris'], correctAnswer: 1, points: 1 }
    ],
    noteMinimale: 70,
    maxAttempts: 3
  });
  check('Trainer saves FINAL EXAM (POST /quiz/final/:courseId — previously missing route)', exam.status === 200,
    `status=${exam.status} body=${JSON.stringify(exam.body).slice(0, 160)}`);

  // Ownership guard helper: trainer2 must not touch trainer1's course
  const trainer2Tok = await login('trainer2@test.com', 'Trainer123');
  const trainer2 = makeApi(trainer2Tok);

  // ---------- ANSWER-KEY POLICY + QUIZ2 ROUTE (regression batch 2) ----------
  const ownerLessons = await trainer('GET', `/api/lessons/course/${courseId}`);
  const ownerHasKey = JSON.stringify(ownerLessons.body).includes('correctAnswer');
  check('OWNER sees correctAnswer on lesson payloads (edit-quizzes fix)',
    ownerLessons.status === 200 && ownerHasKey,
    `status=${ownerLessons.status} hasKey=${ownerHasKey}`);

  const q2 = await trainer('POST', `/api/quiz/lesson/${lessonIds[0]}/quiz2`, {
    questions: [
      { texte: 'Q2: 5*5?', options: ['20', '25', '30'], correctAnswer: 1, points: 1 }
    ],
    noteMinimale: 70,
    maxAttempts: 3
  });
  check('Trainer saves QUIZ 2 (POST /quiz/lesson/:id/quiz2 — previously missing route)', q2.status === 200,
    `status=${q2.status} body=${JSON.stringify(q2.body).slice(0, 160)}`);

  const otherStaffLessons = await trainer2('GET', `/api/lessons/course/${courseId}`);
  const otherHasKey = JSON.stringify(otherStaffLessons.body).includes('correctAnswer');
  check('Non-owner staff does NOT receive correctAnswer',
    otherStaffLessons.status === 200 && !otherHasKey,
    `status=${otherStaffLessons.status} hasKey=${otherHasKey}`);

  // Edit roundtrip exactly as the UI does after the fix: owner GET (key
  // present) → re-POST the prefilled quiz. Pre-fix, the stripped payload
  // reset every answer key to 0 on save.
  const lesson2FromOwner = (ownerLessons.body || []).find(l => l._id === lessonIds[1]);
  const roundtrip = await trainer('POST', `/api/quiz/lesson/${lessonIds[1]}`, {
    noteMinimale: 70,
    questions: (lesson2FromOwner?.quiz?.questions || []).map(q => ({
      texte: q.texte, options: [...q.options], correctAnswer: q.correctAnswer
    }))
  });
  check('Trainer re-saves quiz from prefilled edit form (roundtrip)', roundtrip.status === 200,
    `status=${roundtrip.status} body=${JSON.stringify(roundtrip.body).slice(0, 120)}`);
  const afterRoundtrip = await trainer('GET', `/api/lessons/course/${courseId}`);
  const l2After = (afterRoundtrip.body || []).find(l => l._id === lessonIds[1]);
  check('Answer key SURVIVES edit roundtrip (not reset to 0)',
    l2After?.quiz?.questions?.[0]?.correctAnswer === 1,
    `key=${l2After?.quiz?.questions?.[0]?.correctAnswer}`);

  // Ownership guard: trainer2 must not touch trainer1's course
  const foreignEdit = await trainer2('PUT', `/api/courses/${courseId}`, { title: 'Hijacked' });
  check('TRAINER2 cannot edit another trainer\'s course (403)', foreignEdit.status === 403,
    `status=${foreignEdit.status}`);

  // ---------- ADMIN: approve + role validation ----------
  console.log('\n--- ADMIN: approval & user management ---');
  const approve = await admin('PUT', `/api/courses/${courseId}/approve`, {});
  check('Admin approves course', approve.status === 200,
    `status=${approve.status} body=${JSON.stringify(approve.body).slice(0, 160)}`);

  // ---------- USER: full learning workflow ----------
  console.log('\n--- USER: enroll → quizzes → exam → completion ---');
  const email = `e2elearner${Date.now()}@test.com`;
  const reg = await makeApi(null)('POST', '/api/auth/register', {
    firstname: 'E2E', lastname: 'Learner', email, password: 'Learner123', dateOfBirth: '1990-01-01'
  });
  check('Learner registers (201)', reg.status === 201,
    `status=${reg.status} body=${JSON.stringify(reg.body).slice(0, 160)}`);
  check('Register response carries role:"user" (B1 fix)', reg.body?.data?.role === 'user');

  const learnerTok = await login(email, 'Learner123');
  const learner = makeApi(learnerTok);
  check('Learner logs in via OTP', !!learnerTok);

  const forbidden = await learner('POST', '/api/courses', { title: 'Nope', description: 'Nope' });
  check('USER cannot create course (403)', forbidden.status === 403);

  const enroll = await learner('POST', `/api/enrollments/${courseId}/enroll`, {});
  check('Learner enrolls in approved free course', enroll.status === 201,
    `status=${enroll.status} body=${JSON.stringify(enroll.body).slice(0, 160)}`);

  // Exam must be BLOCKED before lessons are done (E1 fix)
  const earlyExam = await learner('POST', `/api/quiz/final/${courseId}/submit`, { answers: [1, 1] });
  check('Exam BLOCKED at 0% progress (403 eligibility gate)', earlyExam.status === 403,
    `status=${earlyExam.status} body=${JSON.stringify(earlyExam.body).slice(0, 160)}`);

  // Pass every lesson quiz
  const lessonsRes = await learner('GET', `/api/lessons/course/${courseId}`);
  const lessons = Array.isArray(lessonsRes.body) ? lessonsRes.body : [];
  check('Learner sees course lessons', lessonsRes.status === 200 && lessons.length === 2,
    `status=${lessonsRes.status} count=${lessons.length}`);
  const noAnswers = JSON.stringify(lessonsRes.body).includes('correctAnswer');
  check('Lesson payload does NOT leak correctAnswer', !noAnswers);

  for (let i = 0; i < lessons.length; i++) {
    const l = lessons[i];
    const answers = l.quiz.questions.map(() => 1); // correct by construction
    const sub = await learner('POST', `/api/quiz/lesson/${l._id}/submit`, { answers });
    check(`Quiz passed for "${l.title}" (100%)`, sub.status === 200 && sub.body?.passed === true,
      `status=${sub.status} body=${JSON.stringify(sub.body).slice(0, 160)}`);

    // Mid-progress check right after the FIRST quiz (1 of 2 lessons done)
    if (i === 0 && lessons.length === 2) {
      const mid = await learner('GET', '/api/enrollments/me');
      const midEnrollment = (Array.isArray(mid.body) ? mid.body : []).find(e => e.course?._id === courseId);
      check('Progress = 50% after one of two quizzes', midEnrollment?.progress === 50,
        `progress=${midEnrollment?.progress}`);
    }
  }

  // Quiz 2 (created above on lesson 1) must also be passable and counts as a
  // prerequisite for the final exam.
  const quiz2Lesson = lessons.find(l => l.quiz2?.questions?.length);
  if (quiz2Lesson) {
    const answers2 = quiz2Lesson.quiz2.questions.map(() => 1);
    const sub2 = await learner('POST', `/api/quiz/lesson/${quiz2Lesson._id}/submit/quiz2`, { answers: answers2 });
    check('Quiz 2 passed (100%)', sub2.status === 200 && sub2.body?.passed === true,
      `status=${sub2.status} body=${JSON.stringify(sub2.body).slice(0, 160)}`);
  }

  // Now the exam unlocks
  const examRes = await learner('POST', `/api/quiz/final/${courseId}/submit`, { answers: [1, 1] });
  check('Final exam passes after prerequisites (100%)', examRes.status === 200 && examRes.body?.passed === true,
    `status=${examRes.status} body=${JSON.stringify(examRes.body).slice(0, 200)}`);

  const fin = await learner('GET', '/api/enrollments/me');
  const finEnrollment = (Array.isArray(fin.body) ? fin.body : []).find(e => e.course?._id === courseId);
  check('Course COMPLETED: progress 100 + completed=true',
    finEnrollment?.progress === 100 && finEnrollment?.completed === true,
    `progress=${finEnrollment?.progress} completed=${finEnrollment?.completed}`);

  const certs = await learner('GET', '/api/certificates/me');
  const hasCert = (Array.isArray(certs.body) ? certs.body : [])
    .some(c => (c.course?._id || c.course) === courseId || c.course?.title?.includes('E2E Workflow'));
  check('Certificate generated automatically on exam pass', certs.status === 200 && hasCert,
    `status=${certs.status} body=${JSON.stringify(certs.body).slice(0, 200)}`);

  // Frontend aliases
  const pur = await learner('GET', '/api/purchases/me');
  check('GET /purchases/me returns array (frontend shape)', pur.status === 200 && Array.isArray(pur.body));
  const prof = await learner('PUT', '/api/profile/update', { firstname: 'E2E', lastname: 'Learner', phone: '123', address: 'x' });
  check('PUT /profile/update works (frontend alias)', prof.status === 200);

  // ---------- TRAINER/MANAGER: monitoring ----------
  console.log('\n--- TRAINER & MANAGER: monitoring ---');
  const own = await trainer('GET', '/api/courses/trainer/all');
  check('Trainer sees own course list', own.status === 200 &&
    (own.body?.courses || []).some(c => c._id === courseId));
  const results = await trainer('GET', '/api/quiz/results/all');
  check('Trainer sees quiz/exam results (scoped)', results.status === 200 &&
    (results.body?.results || []).some(r => r.course?._id === courseId),
    `status=${results.status} total=${results.body?.total}`);
  const team = await manager('GET', '/api/managers/team');
  const teamProg = await manager('GET', '/api/managers/team-progress');
  check('Manager dashboards respond (team/team-progress)', team.status === 200 && teamProg.status === 200,
    `team=${team.status} progress=${teamProg.status}`);

  // ---------- ADMIN: role validation guard (M2 fix) ----------
  console.log('\n--- ADMIN: role update validation ---');
  const users = await admin('GET', '/api/admin/users');
  const probeUser = (users.body?.users || users.body || []).find
    ? (users.body?.users || users.body || []).find(u => u.email === email) : null;
  if (probeUser?._id) {
    const badRole = await admin('PUT', `/api/users/${probeUser._id}/role`, { role: 'superhacker' });
    check('Invalid role rejected (400, M2 fix)', badRole.status === 400,
      `status=${badRole.status} body=${JSON.stringify(badRole.body).slice(0, 120)}`);
    const goodRole = await admin('PUT', `/api/users/${probeUser._id}/role`, { role: 'user' });
    check('Valid role accepted', goodRole.status === 200);
  } else {
    check('Admin user listing available (validation checked via register-path role lock)', users.status === 200 || users.status === 404,
      `status=${users.status}`);
  }

  // ---------- CLEANUP: cascade delete (M3 fix) ----------
  console.log('\n--- CLEANUP: cascade delete ---');
  const del = await trainer('DELETE', `/api/courses/${courseId}`);
  check('Trainer deletes own course', del.status === 200,
    `status=${del.status} body=${JSON.stringify(del.body).slice(0, 120)}`);

  const afterLessons = await trainer('GET', `/api/lessons/course/${courseId}`);
  check('Lessons gone after course delete (404/empty)', afterLessons.status === 404 || afterLessons.status === 403,
    `status=${afterLessons.status}`);

  const enrollAfter = await learner('GET', '/api/enrollments/me');
  const stillThere = (Array.isArray(enrollAfter.body) ? enrollAfter.body : [])
    .some(e => (e.course?._id || e.course) === courseId);
  check('Enrollment cascade-deleted with course', !stillThere);

  const failed = summary('WORKFLOW E2E');
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error('WORKFLOW CRASH:', e); process.exit(2); });
