const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs"),
  Module = require("node:module");
process.env.ENCRYPTION_KEY = require("node:crypto")
  .randomBytes(32)
  .toString("hex");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = require("node:crypto").randomBytes(40).toString("hex");
const mongoose = require("mongoose"),
  { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../src/models/User"),
  Course = require("../src/models/Course"),
  Enrollment = require("../src/models/Enrollment"),
  Purchase = require("../src/models/Purchase");
const stats = require("../src/controllers/stats.controller"),
  manager = require("../src/controllers/manager.controller");
function baseline(name) {
  const filename = path.resolve(
      __dirname,
      `../src/controllers/${name}.before.cjs`,
    ),
    m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  m._compile(
    fs.readFileSync(
      path.join(__dirname, `fixtures/${name}.before-9cc6e52.cjs`),
      "utf8",
    ),
    filename,
  );
  return m.exports;
}
const before = baseline("stats"),
  oldManager = baseline("manager");
test(
  "measured baseline/current query counts and unchanged dashboard business metrics",
  { timeout: 180000 },
  async () => {
    const db = await MongoMemoryServer.create();
    await mongoose.connect(db.getUri(), { monitorCommands: true });
    try {
      const base = {
        firstname: "Query",
        lastname: "Test",
        password: "TestOnlySecure123!",
        dateOfBirth: "1990-01-01",
      };
      const trainer = await User.create({
          ...base,
          email: "trainer@example.test",
          role: "trainer",
        }),
        lead = await User.create({
          ...base,
          email: "manager@example.test",
          role: "manager",
        });
      const members = await User.insertMany(
        Array.from({ length: 8 }, (_, i) => ({
          ...base,
          email: `member${i}@example.test`,
          role: ["user"],
          manager: lead._id,
        })),
      );
      // Keep index building out of measured command counts.
      await Promise.all([
        User.init(),
        Course.init(),
        Enrollment.init(),
        Purchase.init(),
        require("../src/models/Certificate").init(),
      ]);
      const measure = async (fn, user) => {
        let count = 0,
          body;
        const listener = (e) => {
          if (
            ["find", "aggregate", "count", "distinct"].includes(e.commandName)
          )
            count++;
        };
        mongoose.connection.getClient().on("commandStarted", listener);
        try {
          await fn(
            { user },
            {
              json: (v) => {
                body = v;
              },
              status(n) {
                assert.equal(n, 200);
                return this;
              },
            },
          );
        } finally {
          mongoose.connection.getClient().off("commandStarted", listener);
        }
        return { count, body: JSON.parse(JSON.stringify(body)) };
      };
      for (const total of [2, 25]) {
        const existing = await Course.countDocuments();
        for (let i = existing; i < total; i++) {
          const c = await Course.create({
            title: `Course ${i}`,
            description: "Performance fixture",
            trainer: trainer._id,
            price: 10,
            isApproved: i % 2 === 0,
          });
          await Enrollment.insertMany(
            members.map((u, j) => ({
              user: u._id,
              course: c._id,
              progress: j * 10,
              completed: j === 7,
              deadline: j === 0 ? new Date(Date.now() - 86400000) : null,
            })),
          );
          await Purchase.create({
            user: members[0]._id,
            course: c._id,
            amount: 10,
            paymentStatus: "paid",
          });
        }
        const old = await measure(before.getTrainerStats, trainer),
          next = await measure(stats.getTrainerStats, trainer);
        assert.deepEqual(next.body, old.body);
        assert.equal(old.count, 2 + 2 * total);
        assert.equal(next.count, 3);
        console.log(
          `Trainer ${total} courses: ${old.count} -> ${next.count} database commands; all business metrics equal`,
        );
      }
      const oldAdmin = await measure(before.getAdminStats, trainer),
        newAdmin = await measure(stats.getAdminStats, trainer);
      assert.deepEqual(newAdmin.body.overview, oldAdmin.body.overview);
      assert.deepEqual(
        newAdmin.body.enrollmentsByMonth,
        oldAdmin.body.enrollmentsByMonth,
      );
      assert.deepEqual(newAdmin.body.usersByMonth, oldAdmin.body.usersByMonth);
      assert.ok(newAdmin.body.topCourses.every((c) => c.courseId));
      assert.equal(oldAdmin.count, 14);
      assert.equal(newAdmin.count, 5);
      console.log(
        `Admin: ${oldAdmin.count} -> ${newAdmin.count} database commands; overview/monthly metrics equal`,
      );
      const oldLead = await measure(before.getManagerStats, lead),
        newLead = await measure(stats.getManagerStats, lead);
      assert.deepEqual(newLead.body.overview, oldLead.body.overview);
      const memberMetrics = (data) =>
        data.memberStats.map((m) => ({
          id: m.user._id,
          total: m.totalCourses,
          completed: m.completedCourses,
          progress: m.averageProgress,
        }));
      assert.deepEqual(
        memberMetrics(newLead.body),
        memberMetrics(oldLead.body),
      );
      assert.deepEqual(
        newLead.body.overdueEnrollments.map((e) => e._id),
        oldLead.body.overdueEnrollments.map((e) => e._id),
      );
      assert.equal(oldLead.count, 7);
      assert.equal(newLead.count, 3);
      console.log(
        `Manager: ${oldLead.count} -> ${newLead.count} database commands; team/overdue metrics equal`,
      );
      const oldProgress = await measure(oldManager.getTeamProgress, lead),
        newProgress = await measure(manager.getTeamProgress, lead);
      assert.deepEqual(newProgress.body, oldProgress.body);
      assert.equal(oldProgress.count, 17);
      assert.equal(newProgress.count, 3);
      console.log(
        `Team progress, 8 members: ${oldProgress.count} -> ${newProgress.count} database commands; responses equal`,
      );
      const outsider = await User.create({
        ...base,
        email: "outsider@example.test",
        role: "trainer",
      });
      assert.equal(
        (await measure(stats.getTrainerStats, outsider)).body.overview
          .totalEnrollments,
        0,
      );
      assert.equal(
        (await measure(stats.getManagerStats, outsider)).body.overview.teamSize,
        0,
      );
    } finally {
      await mongoose.disconnect();
      await db.stop();
    }
  },
);
