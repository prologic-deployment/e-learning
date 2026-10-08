// Disposable real database/API fixtures. Never connect this harness to an existing database.
const crypto = require("node:crypto");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
process.env.RATE_LIMIT_LOGIN_MAX = "1000";
process.env.CACHE_ENABLED = "false";
process.env.CORS_ORIGINS = "http://localhost:4200,http://127.0.0.1:4200";
const { MongoMemoryServer } = require("mongodb-memory-server"),
  mongoose = require("mongoose");
(async () => {
  const db = await MongoMemoryServer.create();
  await mongoose.connect(db.getUri());
  const User = require("../src/models/User"),
    Course = require("../src/models/Course"),
    Lesson = require("../src/models/Lesson"),
    Enrollment = require("../src/models/Enrollment"),
    Review = require("../src/models/Review");
  const base = {
      lastname: "Test",
      password: "DashboardTestOnly123!",
      dateOfBirth: "1990-01-01",
    },
    users = {};
  for (const role of ["admin", "trainer", "manager", "user"])
    users[role] = await User.create({
      ...base,
      firstname: role === "user" ? "Sam" : role,
      email: `${role}@dashboard.example.test`,
      role,
    });
  await User.updateOne(
    { _id: users.user._id },
    { $set: { manager: users.manager._id } },
  );
  const paper = {
    noteMinimale: 70,
    maxAttempts: 3,
    questions: Array.from({ length: 20 }, (_, i) => ({
      texte: `Which option is correct for question ${i + 1}?`,
      options: ["First option", "Second option", "Third option"],
      type: i === 1 ? "multiple" : "single",
      ...(i === 1 ? { correctAnswers: [0, 2] } : { correctAnswer: 0 }),
      points: i === 0 ? 2 : 1,
      timeLimitSeconds: 0,
    })),
  };
  const course = await Course.create({
    title: "Evidence-based learning",
    description:
      "A real test course for inspecting enrollment progress and saved assessment answers.",
    trainer: users.trainer._id,
    isApproved: true,
    isPaid: false,
    price: 0,
    category: "Development",
    finalExam: paper,
  });
  const lesson = await Lesson.create({
    course: course._id,
    title: "Practical foundations",
    content: "Read the lesson, then apply what you learned to the assessment.",
    order: 1,
    quiz: paper,
  });
  await Course.updateOne(
    { _id: course._id },
    { $set: { lessons: [lesson._id] } },
  );
  await Lesson.insertMany(
    Array.from({ length: 22 }, (_, i) => ({
      course: course._id,
      title: `Supplementary lesson ${i + 1}`,
      order: i + 2,
      content: "Supplementary reading.",
    })),
  );
  const enrollment = await Enrollment.create({
    user: users.user._id,
    course: course._id,
    progress: 35,
    deadline: new Date(Date.now() - 86400000),
  });
  const response = {
    status(code) {
      if (code !== 200) throw new Error("Fixture submission failed: " + code);
      return this;
    },
    json() {},
  };
  await require("../src/controllers/quiz.controller").submitLessonQuiz(
    {
      user: users.user,
      params: { lessonId: lesson.id },
      body: { answers: [0, [0, 2], 1, null] },
    },
    response,
  );
  const extra = await User.insertMany(
    Array.from({ length: 24 }, (_, i) => ({
      ...base,
      firstname: `Learner ${String(i + 1).padStart(2, "0")}`,
      email: `learner${i}@dashboard.example.test`,
      role: ["user"],
      manager: users.manager._id,
    })),
  );
  await Enrollment.insertMany(
    extra.map((u, i) => ({
      user: u._id,
      course: course._id,
      progress: i * 3,
      deadline: new Date(Date.now() - 86400000),
      quizResults: [
        {
          lesson: lesson._id,
          score: i % 2 ? 80 : 40,
          passed: i % 2 === 1,
          attempts: 1,
          completedAt: new Date(Date.now() - 60000 - i * 1000),
        },
      ],
    })),
  );
  await Course.create({
    title: "Archived learning record",
    description: "Archived test course.",
    trainer: users.trainer._id,
    price: 0,
    isApproved: false,
    isArchived: true,
    archivedAt: new Date(),
  });
  await Review.create({
    user: users.user._id,
    course: course._id,
    rating: 4,
    comment: "Helpful explanations and useful practice.",
    isApproved: false,
  });
  const app = require("../src/app"),
    server = require("node:http").createServer(app);
  // Use the actual authentication middleware for Socket.IO too.
  const { Server } = require("socket.io");
  const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGINS.split(",") },
  });
  io.use(async (socket, next) => {
    try {
      socket.user =
        await require("../src/services/session.service").authenticate(
          socket.handshake.auth?.token,
        );
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });
  io.on("connection", (socket) => socket.join(`account:${socket.user._id}`));
  global.io = io;
  server.listen(5000, "0.0.0.0", () =>
    console.log("Disposable dashboard test API ready on port 5000"),
  );
  const stop = async () => {
    io.close();
    server.close();
    await mongoose.disconnect();
    await db.stop();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
