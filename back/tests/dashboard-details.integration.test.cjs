const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = crypto.randomBytes(40).toString("hex");
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
const mongoose = require("mongoose"),
  { MongoMemoryServer } = require("mongodb-memory-server"),
  express = require("express"),
  request = require("supertest");
const User = require("../src/models/User"),
  Course = require("../src/models/Course"),
  Lesson = require("../src/models/Lesson"),
  Enrollment = require("../src/models/Enrollment"),
  Review = require("../src/models/Review"),
  Attempt = require("../src/models/AssessmentAttempt");
const { session } = require("../src/services/session.service");
const { assessmentReview } = require("../src/utils/assessmentReview");
const questions = Array.from({ length: 20 }, (_, i) => ({
  texte: `Original question ${i + 1}`,
  type: i === 1 ? "multiple" : "single",
  options: ["First", "Second", "Third"],
  ...(i === 1 ? { correctAnswers: [0, 2] } : { correctAnswer: 0 }),
  points: i === 0 ? 2 : 1,
  timeLimitSeconds: 0,
}));
test("answer snapshots match exact-set weighted grading without inventing duration", () => {
  const r = assessmentReview({ questions, noteMinimale: 80 }, [
    0,
    [0, 2],
    1,
    null,
  ]);
  assert.equal(r.correct, 2);
  assert.equal(r.wrong, 18);
  assert.equal(r.earnedPoints, 3);
  assert.equal(r.possiblePoints, 21);
  assert.equal(r.durationSeconds, null);
  assert.deepEqual(r.questions[1].studentAnswers, ["First", "Third"]);
  assert.equal(r.questions[2].correct, false);
  assert.equal(r.questions[3].unanswered, true);
  assert.equal(
    assessmentReview({ questions }, [0, [0, 0, 2]]).questions[1].correct,
    false,
  );
});
test(
  "detail APIs: authorization, bounded DTOs, current and historical assessment evidence",
  { timeout: 180000 },
  async (t) => {
    const db = await MongoMemoryServer.create();
    await mongoose.connect(db.getUri());
    try {
      const app = express();
      app.use(express.json());
      app.use("/details", require("../src/routes/detail.routes"));
      app.use("/quiz", require("../src/routes/quiz.routes"));
      app.use("/enrollments", require("../src/routes/enrollment.routes"));
      app.use("/users", require("../src/routes/user.routes"));
      app.use("/courses", require("../src/routes/course.routes"));
      const base = {
        firstname: "Test",
        lastname: "Account",
        password: "TestOnlySecure123!",
        dateOfBirth: "1990-01-01",
      };
      const users = {};
      for (const key of [
        "admin",
        "trainer",
        "otherTrainer",
        "manager",
        "otherManager",
        "user",
        "otherUser",
      ])
        users[key] = await User.create({
          ...base,
          email: key + "@example.test",
          role: key.startsWith("other") ? key.slice(5).toLowerCase() : key,
        });
      await User.updateOne(
        { _id: users.user._id },
        { $set: { manager: users.manager._id } },
      );
      const c = await Course.create({
        title: "Detail test",
        description: "Saved course description",
        trainer: users.trainer._id,
        price: 0,
        isPaid: false,
        isApproved: true,
        finalExam: { questions },
      });
      const otherCourse = await Course.create({
        title: "Outside course",
        description: "Other trainer",
        trainer: users.otherTrainer._id,
        price: 0,
        isApproved: false,
      });
      const lesson = await Lesson.create({
        course: c._id,
        title: "Original lesson",
        order: 1,
        content: "Real lesson content",
        quiz: { questions, noteMinimale: 70 },
        quiz2: { questions },
      });
      const e = await Enrollment.create({
          user: users.user._id,
          course: c._id,
        }),
        otherE = await Enrollment.create({
          user: users.otherUser._id,
          course: otherCourse._id,
        });
      const auth = (r, u) =>
        r.auth(session(users[u]).token, { type: "bearer" });
      const get = (path, u = "admin") => auth(request(app).get(path), u);
      await request(app)
        .get("/details/user/" + users.user.id)
        .expect(401);
      await get("/details/user/not-an-id").expect(400);
      await get("/details/toString/" + c.id).expect(400);
      await t.test(
        "person and enrollment scope for all four roles",
        async () => {
          for (const who of ["admin", "trainer", "manager", "user"]) {
            const r = await get("/details/user/" + users.user.id, who).expect(
              200,
            );
            assert.ok(
              !/password|twoFactor|totp|secret|tokenVersion|dateOfBirth/i.test(
                JSON.stringify(r.body),
              ),
            );
            await get("/details/enrollment/" + e.id, who).expect(200);
          }
          for (const who of ["otherTrainer", "otherManager", "otherUser"]) {
            await get("/details/user/" + users.user.id, who).expect(404);
            await get("/details/enrollment/" + e.id, who).expect(404);
          }
          await get("/details/enrollment/" + otherE.id, "trainer").expect(404);
          await get("/details/course/" + otherCourse.id, "user").expect(404);
          await get("/details/lesson/" + lesson.id, "user").expect(200);
        },
      );
      await t.test(
        "untimed submission snapshots are private and immutable after edits",
        async () => {
          const submitted = await auth(
            request(app).post("/quiz/lesson/" + lesson.id + "/submit"),
            "user",
          )
            .send({ answers: [0, [0, 2], 1, null] })
            .expect(200);
          assert.equal(submitted.body.score, 14);
          assert.ok(!JSON.stringify(submitted.body).includes("correctAnswer"));
          const path =
            "/details/result/" +
            e.id +
            "?assessment=lesson_quiz&lesson=" +
            lesson.id;
          const reviewed = await get(path, "trainer").expect(200);
          assert.equal(reviewed.headers["cache-control"], "no-store");
          assert.equal(reviewed.body.review.correct, 2);
          assert.equal(reviewed.body.review.questions.length, 20);
          await Lesson.updateOne(
            { _id: lesson._id },
            {
              $set: {
                "quiz.questions.0.texte": "Edited after submission",
                "quiz.questions.0.correctAnswer": 1,
              },
            },
          );
          assert.equal(
            (await get(path).expect(200)).body.review.questions[0].text,
            "Original question 1",
          );
          for (const who of ["manager", "user"]) {
            const r = await get(path, who).expect(200);
            assert.equal(r.body.review, null);
            assert.ok(!JSON.stringify(r.body).includes("correctAnswers"));
          }
          await get(path, "otherTrainer").expect(404);
          await get(
            "/details/result/" + e.id + "?assessment=lesson_quiz&lesson=bad",
          ).expect(400);
          await Enrollment.updateOne(
            { _id: e._id },
            {
              $push: {
                quizResults: {
                  lesson: new mongoose.Types.ObjectId(),
                  attempts: 0,
                },
              },
            },
          );
          const summary = await get("/quiz/results/all", "trainer").expect(200);
          assert.equal(summary.body.results.length, 1);
          assert.equal(summary.body.results[0].enrollmentId, e.id);
          assert.ok(!JSON.stringify(summary.body).includes("studentAnswers"));
          const normal = await Enrollment.findById(e.id).lean();
          assert.equal(normal.quizResults[0].review, undefined);
          const own = await get("/enrollments/me", "user").expect(200);
          assert.ok(!JSON.stringify(own.body).includes("studentAnswers"));
        },
      );
      await t.test(
        "legacy quiz2 and final exam evidence is saved without changing scores",
        async () => {
          await auth(
            request(app).post("/quiz/lesson/" + lesson.id + "/submit/quiz2"),
            "user",
          )
            .send({ answers: [1] })
            .expect(200);
          const q2 = await get(
            "/details/result/" +
              e.id +
              "?assessment=lesson_quiz2&lesson=" +
              lesson.id,
          ).expect(200);
          assert.equal(q2.body.review.questions[0].correct, false);
          await Enrollment.updateOne(
            { _id: e._id },
            { $set: { lessonsCompleted: [lesson._id], progress: 100 } },
          );
          await auth(
            request(app).post("/quiz/final/" + c.id + "/submit"),
            "user",
          )
            .send({ answers: [1] })
            .expect(200);
          const final = await get(
            "/details/result/" + e.id + "?assessment=final_exam",
          ).expect(200);
          assert.equal(final.body.review.questions.length, 20);
          const list = await get("/quiz/results/all", "trainer").expect(200);
          assert.equal(list.body.results.length, 3);
          assert.ok(list.body.results.some((r) => r.type === "lesson_quiz2"));
          assert.ok(!JSON.stringify(list.body).includes("studentAnswers"));
        },
      );
      await t.test(
        "summary-only results stay honest; only matching finished timed evidence is recovered",
        async () => {
          await Enrollment.updateOne(
            { _id: e._id },
            { $unset: { "quizResults.0.review": 1 } },
          );
          const path =
            "/details/result/" +
            e.id +
            "?assessment=lesson_quiz&lesson=" +
            lesson.id;
          const historical = await get(path).expect(200);
          assert.equal(historical.body.review, null);
          assert.match(historical.body.notice, /historical/);
          const summary = (await Enrollment.findById(e.id)).quizResults[0];
          const attempt = await Attempt.create({
            user: users.user._id,
            course: c._id,
            target: lesson._id,
            kind: "lesson",
            active: false,
            status: "ready",
            attemptsUsed: summary.attempts,
            paper: { questions, noteMinimale: 70 },
            answers: [0, [0, 2], 1, null],
            result: { score: summary.score, passed: summary.passed },
          });
          assert.equal((await get(path)).body.review, null);
          await Attempt.updateOne(
            { _id: attempt._id },
            { $set: { status: "finished" } },
          );
          assert.equal((await get(path).expect(200)).body.review.correct, 2);
          await Attempt.updateOne(
            { _id: attempt._id },
            { $set: { "paper.questions.0.correctAnswer": 1 } },
          );
          assert.equal(
            (await get(path).expect(200)).body.review,
            null,
            "mismatched historical evidence must not be presented",
          );
          await Attempt.updateOne(
            { _id: attempt._id },
            { $set: { "paper.questions.0.correctAnswer": 0 } },
          );
          await Attempt.updateOne(
            { _id: attempt._id },
            { $set: { attemptsUsed: 99 } },
          );
          assert.equal((await get(path)).body.review, null);
        },
      );
      await t.test(
        "relations are paginated and reviews have independent permissions",
        async () => {
          await Lesson.insertMany(
            Array.from({ length: 22 }, (_, i) => ({
              course: c._id,
              title: `Page lesson ${i}`,
              order: i + 2,
            })),
          );
          const first = await get("/details/course/" + c.id).expect(200);
          const section = first.body.sections.find(
            (s) => s.title === "Curriculum",
          );
          assert.equal(section.items.length, 20);
          assert.equal(section.page.total, 23);
          const second = await get(
            "/details/course/" + c.id + "?lessonsPage=2",
          ).expect(200);
          assert.equal(
            second.body.sections.find((s) => s.title === "Curriculum").items
              .length,
            3,
          );
          await get("/details/course/" + c.id + "?lessonsPage=-1").expect(400);
          const last = await get(
            "/details/course/" + c.id + "?lessonsPage=999",
          ).expect(200);
          assert.equal(
            last.body.sections.find((s) => s.title === "Curriculum").page
              .current,
            2,
          );
          const r = await Review.create({
            user: users.user._id,
            course: c._id,
            rating: 4,
            comment: "Actual review",
          });
          await get("/details/review/" + r.id).expect(200);
          await get("/details/review/" + r.id, "otherUser").expect(404);
        },
      );
      await t.test(
        "paid/archived content boundaries and projected course lists",
        async () => {
          const paid = await Course.create({
            title: "Paid test",
            description: "Access test",
            trainer: users.trainer._id,
            price: 50,
            isPaid: true,
            isApproved: true,
          });
          const paidLesson = await Lesson.create({
            course: paid._id,
            title: "Restricted lesson",
            content: "PRIVATE_LESSON_CONTENT",
            order: 1,
          });
          assert.ok(
            !JSON.stringify(
              (
                await get(
                  "/details/lesson/" + paidLesson.id,
                  "otherUser",
                ).expect(200)
              ).body,
            ).includes("PRIVATE_LESSON_CONTENT"),
          );
          await Enrollment.create({
            user: users.otherUser._id,
            course: paid._id,
          });
          assert.ok(
            JSON.stringify(
              (
                await get(
                  "/details/lesson/" + paidLesson.id,
                  "otherUser",
                ).expect(200)
              ).body,
            ).includes("PRIVATE_LESSON_CONTENT"),
          );
          await Course.updateOne(
            { _id: paid._id },
            { $set: { isArchived: true } },
          );
          assert.ok(
            !JSON.stringify(
              (
                await get(
                  "/details/lesson/" + paidLesson.id,
                  "otherUser",
                ).expect(200)
              ).body,
            ).includes("PRIVATE_LESSON_CONTENT"),
          );
          const library = await get("/courses/trainer/all", "trainer").expect(
            200,
          );
          assert.ok(
            library.body.courses.every(
              (c) => !c.finalExam && !c.enrolledUsers && !c.lessons,
            ),
          );
          await User.updateOne(
            { _id: users.user._id },
            { $set: { manager: users.otherManager._id } },
          );
          await get("/details/enrollment/" + e.id, "manager").expect(404);
          await User.updateOne(
            { _id: users.user._id },
            { $set: { manager: users.manager._id } },
          );
        },
      );
      await t.test(
        "private evidence uses separate bounded documents and follows deletion cascades",
        async () => {
          const Evidence = require("../src/models/AssessmentReview");
          assert.ok(
            (await Evidence.countDocuments({ user: users.user._id })) > 0,
          );
          assert.equal((await Evidence.findOne().lean()).snapshot, undefined);
          await auth(
            request(app).delete("/users/" + users.user.id),
            "admin",
          ).expect(200);
          assert.equal(
            await Evidence.countDocuments({ user: users.user._id }),
            0,
          );
          assert.equal(
            await Enrollment.countDocuments({ user: users.user._id }),
            0,
          );
          const other = await Evidence.create({
            enrollment: otherE._id,
            user: users.otherUser._id,
            course: otherCourse._id,
            snapshot: assessmentReview({ questions }, []),
          });
          await auth(
            request(app).delete("/courses/" + otherCourse.id),
            "admin",
          ).expect(200);
          assert.equal(await Evidence.countDocuments({ _id: other._id }), 0);
        },
      );
    } finally {
      await mongoose.disconnect();
      await db.stop();
    }
  },
);
