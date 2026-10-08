const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const errors = [];
  let checks = 0;
  const login = async (context, role) => {
    const r = await context.request.post(
      "http://127.0.0.1:4200/api/auth/login",
      {
        data: {
          email: role + "@dashboard.example.test",
          password: "DashboardTestOnly123!",
        },
      },
    );
    assert.equal(r.status(), 200);
    const body = await r.json();
    await context.addInitScript(
      (s) => {
        localStorage.setItem("token", s.token);
        localStorage.setItem("user", JSON.stringify(s.user));
      },
      body,
    );
    return context.newPage();
  };
  const journeyOf = async (page) => {
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const heading = dialog.getByRole("heading", {
      name: "Course journey",
      exact: true,
    });
    await heading.waitFor();
    const events = dialog.locator(".journey-event");
    const count = await events.count();
    assert.ok(count >= 4, "journey lists every recorded event, got " + count);
    const titles = await dialog
      .locator(".journey-event h4")
      .allTextContents();
    const times = await dialog
      .locator(".journey-event time")
      .allTextContents();
    assert.ok(times.every((t) => t.trim().length > 4), "every event is dated");
    const order = await events.evaluateAll((rows) =>
      rows.map((r) => new Date(r.querySelector("time").dateTime).getTime()),
    );
    assert.deepEqual(order, [...order].sort((a, b) => a - b), "chronological");
    checks++;
    return { titles, count };
  };
  try {
    // Administrator: people table -> person -> enrollment -> journey.
    let context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    let page = await login(context, "admin");
    page.on("pageerror", (e) => errors.push("admin: " + e.message));
    await page.goto("http://127.0.0.1:4200/admin-dashboard?tab=users");
    await page
      .getByRole("searchbox", { name: /Search records/i })
      .fill("Sam");
    await page
      .locator('.detail-record-row[data-record-kind="user"]')
      .filter({ hasText: "Sam Test" })
      .first()
      .click();
    let dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await dialog
      .getByRole("button", { name: /^View details/ })
      .first()
      .click();
    let journey = await journeyOf(page);
    assert.ok(
      journey.titles.includes("Enrolled in the course"),
      "enrollment event",
    );
    assert.ok(
      journey.titles.includes("Lesson quiz result saved"),
      "saved result event",
    );
    assert.ok(
      journey.titles.includes("Course review posted"),
      "review event",
    );
    assert.equal(
      journey.titles.at(-1),
      "Current progress state",
      "current state closes the journey",
    );
    const saved = dialog
      .locator(".journey-event")
      .filter({ hasText: "Lesson quiz result saved" });
    assert.match(await saved.innerText(), /Score/);
    assert.match(await saved.innerText(), /Passed|Not passed/);
    checks++;
    // From the journey-bearing enrollment to the answer comparison.
    await dialog
      .locator(".related-record")
      .filter({ hasText: "Lesson quiz" })
      .first()
      .getByRole("button", { name: /^View details/ })
      .click();
    await dialog
      .getByRole("button", { name: /View answers/ })
      .waitFor();
    await dialog.getByRole("button", { name: /View answers/ }).click();
    await dialog.locator(".answer-review .question-card").first().waitFor();
    const card = dialog.locator(".question-card").first();
    assert.ok(
      (await card.locator(".student-answer").innerText()).length > 5 &&
        (await card.locator(".correct-answer").innerText()).length > 5,
      "student and correct answers are compared",
    );
    checks++;
    await context.close();

    // Trainer: assessment results -> result -> enrollment journey.
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await login(context, "trainer");
    page.on("pageerror", (e) => errors.push("trainer: " + e.message));
    await page.goto("http://127.0.0.1:4200/trainer-dashboard?tab=quiz-results");
    await page
      .locator('.detail-record-row[data-record-kind="result"]')
      .first()
      .click();
    dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await dialog
      .locator(".related-record")
      .filter({ hasText: "Enrollment and progress" })
      .getByRole("button", { name: /^View details/ })
      .click();
    journey = await journeyOf(page);
    assert.ok(journey.titles.includes("Enrolled in the course"));
    await context.close();

    // Learner: own enrollment shows the same journey, without answer keys.
    context = await browser.newContext({ viewport: { width: 375, height: 720 } });
    page = await login(context, "user");
    page.on("pageerror", (e) => errors.push("user: " + e.message));
    await page.goto("http://127.0.0.1:4200/dashboard?tab=history");
    await page
      .locator('.detail-record-row[data-record-kind="enrollment"]')
      .first()
      .click();
    journey = await journeyOf(page);
    assert.ok(journey.titles.includes("Enrolled in the course"));
    assert.ok(
      !(await page.getByRole("dialog").innerText()).includes("correctAnswer"),
      "no answer keys leak into the dialog",
    );
    checks++;
    await context.close();

    assert.deepEqual(errors, []);
    console.log(
      "PASS: " + checks + " journey timeline checks across admin, trainer and learner",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
