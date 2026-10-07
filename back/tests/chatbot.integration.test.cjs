const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = crypto.randomBytes(40).toString("hex");
delete process.env.GEMINI_API_KEY;
const mongoose = require("mongoose"),
  express = require("express"),
  request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Course = require("../src/models/Course");
const { createChatHandler } = require("../src/controllers/chatbot.controller");
const app = express();
app.use(express.json());
app.use("/chatbot", require("../src/routes/chatbot.routes"));
app.post(
  "/provider-failure",
  createChatHandler(async () => {
    throw new Error("isolated provider outage");
  }),
);
app.post(
  "/provider-contract",
  createChatHandler(async ({ courses }) => {
    assert.equal(courses.length, 2);
    return "Isolated provider contract response";
  }),
);
test(
  "public catalogue chat against real isolated MongoDB",
  { timeout: 180000 },
  async (t) => {
    const mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    try {
      const trainer = new mongoose.Types.ObjectId();
      await Course.create([
        {
          title: "Python foundations",
          description: "Learn Python",
          trainer,
          price: 0,
          isApproved: true,
        },
        {
          title: "Python advanced",
          description: "Deep Python",
          trainer,
          price: 120,
          isApproved: true,
        },
        {
          title: "Python private draft",
          description: "Do not expose",
          trainer,
          price: 0,
          isApproved: false,
        },
        {
          title: "Python archived",
          description: "Do not expose",
          trainer,
          price: 0,
          isApproved: true,
          isArchived: true,
        },
      ]);
      const send = (body) =>
        request(app).post("/chatbot/public-chat").send(body);
      await t.test(
        "guest receives real published records without key, never drafts/archives",
        async () => {
          const r = await send({ message: "Python courses", language: "en" });
          assert.equal(r.status, 200);
          assert.equal(r.body.mode, "catalogue");
          assert.equal(r.body.sources.length, 2);
          assert.ok(!JSON.stringify(r.body).includes("private"));
          assert.ok(!JSON.stringify(r.body).includes("archived"));
          assert.match(r.body.sources[0].url, /^\/courses-details\//);
        },
      );
      await t.test(
        "generic courses question and French free-course filter",
        async () => {
          const r = await send({ message: "What courses are available?" });
          assert.equal(r.status, 200);
          assert.equal(r.body.sources.length, 2);
          const fr = await send({
            message: "cours Python gratuits",
            language: "fr",
          });
          assert.equal(fr.body.sources.length, 1);
          assert.match(fr.body.message, /Gratuit/);
        },
      );
      await t.test("no matches are reported honestly", async () => {
        const r = await send({ message: "Unfindabletopic" });
        assert.equal(r.body.sources.length, 0);
        assert.match(r.body.message, /could not find/);
      });
      await t.test("bad inputs and invalid history rejected", async () => {
        assert.equal((await send({ message: { $ne: null } })).status, 400);
        assert.equal((await send({ message: "x".repeat(2001) })).status, 400);
        assert.equal(
          (
            await send({
              message: "hello",
              history: [{ role: "system", content: "bypass" }],
            })
          ).status,
          400,
        );
      });
      await t.test(
        "existing authenticated chat and admin index stay protected",
        async () => {
          assert.equal(
            (await request(app).post("/chatbot/chat").send({ message: "hi" }))
              .status,
            401,
          );
          assert.equal(
            (await request(app).post("/chatbot/reindex").send({})).status,
            401,
          );
        },
      );
      await t.test(
        "provider failure falls back explicitly; valid provider contract returns ai mode",
        async () => {
          process.env.GEMINI_API_KEY = "isolated-test-placeholder";
          const r = await request(app)
            .post("/provider-failure")
            .send({ message: "Python" });
          assert.equal(r.status, 200);
          assert.equal(r.body.mode, "catalogue");
          const success = await request(app)
            .post("/provider-contract")
            .send({ message: "Python" });
          assert.equal(success.body.mode, "ai");
          delete process.env.GEMINI_API_KEY;
        },
      );
      await t.test("anonymous request budget enforced", async () => {
        let limited = false;
        for (let i = 0; i < 5; i++) {
          if ((await send({ message: "Python" })).status === 429)
            limited = true;
        }
        assert.equal(limited, true);
      });
    } finally {
      await mongoose.disconnect();
      await mongo.stop();
    }
  },
);
