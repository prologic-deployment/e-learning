const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  fs = require("node:fs");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = crypto.randomBytes(40).toString("hex");
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
process.env.CACHE_ENABLED = "false";
const {
  validateRequest,
  fieldIssue,
} = require("../src/validation/input-policy");
const id = "123456789012345678901234";
test("policy rejects malformed types, whitespace, calendar dates and nonfinite numbers", () => {
  for (const [rule, value] of [
    ["email", "broken@"],
    ["name", "  "],
    ["name", {}],
    ["birth", "2099-01-01"],
    ["date", "2025-02-29"],
    ["date", "2024-13-01"],
    ["price", -1],
    ["price", NaN],
    ["price", "Infinity"],
    ["price", 1.123],
    ["price", "0x10"],
    ["rating", 2.5],
    ["password", "a".repeat(72)],
    ["password", "É".repeat(40) + "A1"],
  ])
    assert.ok(fieldIssue(rule, value, true), rule + ": " + String(value));
  assert.equal(fieldIssue("currentPassword", "        ", true), "");
  assert.equal(fieldIssue("currentPassword", "legacy", true), "");
  assert.equal(fieldIssue("name", "Élodie O’Neill", true), "");
  assert.equal(fieldIssue("phone", "+216 22 123 456"), "");
  assert.equal(fieldIssue("price", "12.50", true), "");
  assert.equal(fieldIssue("date", "2024-02-29", true), "");
});
test("all principal write contracts reject bad user data without mutation", () => {
  const cases = [
    [
      "/auth/register",
      {
        firstname: " ",
        lastname: "X",
        email: "bad",
        password: "123",
        dateOfBirth: "2099-01-01",
      },
    ],
    ["/auth/login", { email: { $ne: null }, password: "x" }],
    ["/profile", { firstname: "" }],
    ["/users/staff", { role: "root" }],
    ["/courses", { title: " ", description: "x", price: -1 }],
    ["/lessons/course/" + id, { title: [] }],
    ["/managers/assign-course", { courseId: id, userIds: [] }],
    ["/enrollments/deadline", { enrollmentId: id, deadline: "2025-02-31" }],
    ["/reviews/course/" + id, { rating: 9, comment: "x" }],
    [
      "/cv/experience",
      {
        titre: "X",
        entreprise: "Y",
        dateDebut: "2024-02-01",
        dateFin: "2023-01-01",
      },
    ],
    ["/cv", { nom: "X", prenom: "Y", email: "bad" }],
    ["/cv/langue", { langue: "French", niveau: "not-a-level" }],
    ["/quiz/lesson/" + id, { questions: [] }],
    ["/quiz/attempts/" + id + "/answer", { index: 0, answer: [0, 0] }],
    [
      "/chatbot/chat",
      { message: "x", history: [{ role: "model", content: "bad-order" }] },
    ],
    ["/cart/add", { courseId: "no" }],
    ["/purchases/buy", { courseId: {} }],
  ];
  for (const [path, body] of cases) {
    const before = JSON.stringify(body);
    assert.ok(
      Object.keys(validateRequest("POST", "/api" + path, body)).length,
      path,
    );
    assert.equal(JSON.stringify(body), before);
  }
  assert.deepEqual(
    validateRequest("POST", "/api/chatbot/chat", {
      message: "help",
      history: [
        { role: "user", content: "Hi" },
        { role: "model", content: "Welcome" },
      ],
    }),
    {},
  );
  assert.deepEqual(
    validateRequest("POST", "/api/quiz/attempts/" + id + "/answer", {
      index: 0,
      answer: null,
    }),
    {},
  );
});
test("oversized JSON is rejected before any write", () => {
  assert.ok(
    validateRequest("POST", "/api/courses", {
      description: "💡".repeat(300000),
    }).form,
  );
});
test("multipart metadata restrictions are shared", () => {
  for (const f of [
    { fieldname: "avatar", name: "a.pdf", size: 100, type: "application/pdf" },
    {
      fieldname: "photo",
      name: "a.png",
      size: 5 * 1024 * 1024 + 1,
      type: "image/png",
    },
    {
      fieldname: "contentFile",
      name: "a.png.exe",
      size: 10,
      type: "image/png",
    },
    { fieldname: "avatar", name: "a.png", size: 0, type: "image/png" },
  ])
    assert.ok(
      Object.keys(validateRequest("PUT", "/api/profile/avatar", {}, [f]))
        .length,
    );
  assert.deepEqual(
    validateRequest("PUT", "/api/profile/avatar", {}, [
      { fieldname: "avatar", name: "a.png", size: 68, type: "image/png" },
    ]),
    {},
  );
});
test(
  "real API rejects invalid writes, preserves valid workflows and cleans rejected image uploads",
  { timeout: 180000 },
  async (t) => {
    const mongoose = require("mongoose"),
      { MongoMemoryServer } = require("mongodb-memory-server"),
      request = require("supertest");
    const db = await MongoMemoryServer.create();
    await mongoose.connect(db.getUri());
    try {
      const app = require("../src/app"),
        User = require("../src/models/User"),
        Course = require("../src/models/Course"),
        CV = require("../src/models/CV"),
        { session } = require("../src/services/session.service");
      const base = {
        firstname: "Test",
        lastname: "Only",
        password: "ValidationOnly123!",
        dateOfBirth: "1990-01-01",
      };
      const user = await User.create({
          ...base,
          email: "user@validation.test",
          role: "user",
        }),
        trainer = await User.create({
          ...base,
          email: "trainer@validation.test",
          role: "trainer",
        }),
        admin = await User.create({
          ...base,
          email: "admin@validation.test",
          role: "admin",
        });
      const send = (actor, method, path, body) =>
        request(app)
          [method]("/api" + path)
          .auth(session(actor).token, { type: "bearer" })
          .send(body);
      await t.test(
        "profile and staff invalid fields return structured 400 without writes",
        async () => {
          for (const body of [
            { firstname: "" },
            { lastname: "   " },
            { phone: "not a phone" },
            { firstname: { $ne: null } },
            { firstname: "x".repeat(101) },
          ]) {
            const r = await send(user, "put", "/profile", body).expect(400);
            assert.equal(r.body.code, "VALIDATION_ERROR");
            assert.ok(r.body.errors);
          }
          assert.equal((await User.findById(user.id)).firstname, "Test");
          await send(admin, "post", "/users/staff", {
            ...base,
            email: "invalid",
            role: "trainer",
          }).expect(400);
          await send(user, "put", "/profile", {
            firstname: "Élodie",
            lastname: "O’Neill",
            phone: "+216 22 123 456",
            address: "",
          }).expect(200);
          await request(app).post("/api/users/staff").send({}).expect(401);
        },
      );
      let course;
      await t.test(
        "course and assignment bounds reject invalid input and allow valid decimal price",
        async () => {
          for (const price of [-1, 1.234, "Infinity", {}])
            await send(trainer, "post", "/courses", {
              title: "Valid title",
              description: "Description",
              price,
            }).expect(400);
          assert.equal(await Course.countDocuments(), 0);
          const r = await send(trainer, "post", "/courses", {
            title: "Valid title",
            description: "Description",
            price: 12.5,
            category: "Development",
            tags: ["one", "two"],
          }).expect(201);
          course = r.body.course;
          await send(trainer, "post", "/lessons/course/" + course._id, {
            title: " ",
          }).expect(400);
          await send(trainer, "post", "/lessons/course/" + course._id, {
            title: "Valid lesson",
            content: "Text",
          }).expect(201);
          await send(admin, "patch", "/enrollments/deadline", {
            enrollmentId: course._id,
            deadline: "2024-02-31",
          }).expect(400);
          await send(user, "post", "/reviews/course/" + course._id, {
            rating: 6,
            comment: "Review",
          }).expect(400);
        },
      );
      await t.test(
        "CV validates nested entries and preserves saved sections during profile edits",
        async () => {
          await send(user, "post", "/cv", {
            nom: "Only",
            prenom: "Test",
            email: "cv@validation.test",
          }).expect(200);
          await send(user, "post", "/cv/experience", {
            titre: "Developer",
            entreprise: "Team",
            dateDebut: "2024-01-01",
            dateFin: "2023-01-01",
          }).expect(400);
          await send(user, "post", "/cv/experience", {
            titre: "Developer",
            entreprise: "Team",
            dateDebut: "2024-01-01",
            dateFin: "",
          }).expect(200);
          await send(user, "post", "/cv", {
            nom: "Only",
            prenom: "Updated",
            email: "cv@validation.test",
          }).expect(200);
          assert.equal(
            (await CV.findOne({ user: user.id })).experiences.length,
            1,
          );
          await send(user, "post", "/cv", {
            nom: "Only",
            prenom: "Test",
            email: "cv@validation.test",
            experiences: "not-json",
          }).expect(400);
          assert.equal(
            (await CV.findOne({ user: user.id })).experiences.length,
            1,
          );
        },
      );
      await t.test(
        "legacy whitespace-only passwords still reach existing credential verification",
        async () => {
          await User.updateOne(
            { _id: user.id },
            {
              $set: { password: await require("bcrypt").hash("        ", 10) },
            },
          );
          const r = await request(app)
            .post("/api/auth/login")
            .send({ email: user.email, password: "        " })
            .expect(200);
          assert.ok(r.body.token);
        },
      );
      await t.test(
        "image size/type/signature checks reject fake files; valid image uploads",
        async () => {
          const before = new Set(fs.readdirSync("uploads/avatars"));
          await request(app)
            .put("/api/profile/avatar")
            .auth(session(user).token, { type: "bearer" })
            .attach("avatar", Buffer.from("not an image"), {
              filename: "fake.png",
              contentType: "image/png",
            })
            .expect(400);
          assert.deepEqual(new Set(fs.readdirSync("uploads/avatars")), before);
          await request(app)
            .put("/api/profile/avatar")
            .auth(session(user).token, { type: "bearer" })
            .attach("avatar", Buffer.alloc(5 * 1024 * 1024 + 1), {
              filename: "large.png",
              contentType: "image/png",
            })
            .expect(400);
          const png = Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6k0AAAAASUVORK5CYII=",
            "base64",
          );
          const r = await request(app)
            .put("/api/profile/avatar")
            .auth(session(user).token, { type: "bearer" })
            .attach("avatar", png, {
              filename: "valid.png",
              contentType: "image/png",
            })
            .expect(200);
          assert.ok(r.body.user.avatar.startsWith("/uploads/avatars/"));
          fs.unlinkSync("." + r.body.user.avatar);
        },
      );
    } finally {
      await mongoose.disconnect();
      await db.stop();
    }
  },
);
