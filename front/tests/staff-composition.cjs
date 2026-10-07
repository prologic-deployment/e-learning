const { chromium } = require("playwright"),
    assert = require("node:assert/strict");
(async () => {
    const b = await chromium.launch({ args: ["--no-sandbox"] });
    try {
        const p = await b.newPage({
                viewport: { width: 1440, height: 1000 },
                reducedMotion: "reduce",
            }),
            errors = [];
        p.on("pageerror", (e) => errors.push(e.message));
        let writes = [];
        await p.route("**/api/**", (r) => {
            let path = new URL(r.request().url()).pathname,
                method = r.request().method();
            if (method === "POST" && path === "/api/courses") {
                writes.push(r.request().postDataJSON());
                return r.fulfill({
                    json: {
                        course: {
                            _id: "test-course",
                            title: "Test only course",
                        },
                    },
                });
            }
            if (path.startsWith("/api/lessons/course/"))
                return r.fulfill({ json: [] });
            if (path === "/api/profile")
                return r.fulfill({
                    json: {
                        firstname: "Test",
                        lastname: "Fixture",
                        email: "test@example.com",
                        dateOfBirth: "1990-01-01",
                    },
                });
            if (path === "/api/managers/team")
                return r.fulfill({
                    json: [
                        {
                            _id: "test-person",
                            firstname: "Test",
                            lastname: "Member",
                            email: "test@example.com",
                        },
                    ],
                });
            return r.fulfill({
                status: 503,
                json: { message: "Isolated API failure" },
            });
        });
        await p.goto("http://127.0.0.1:4200/");
        for (let role of ["trainer", "manager", "admin"]) {
            await p.evaluate((role) => {
                localStorage.setItem("token", "test-role-only");
                localStorage.setItem(
                    "user",
                    JSON.stringify({
                        id: "test-person",
                        firstname: "Test",
                        role,
                    }),
                );
            }, role);
            const tabs =
                role === "trainer"
                    ? ["courses", "create", "quiz-results", "profile"]
                    : role === "manager"
                      ? ["assign", "overdue", "profile"]
                      : [
                            "users",
                            "courses",
                            "archived",
                            "create",
                            "assign",
                            "staff",
                            "reviews",
                            "quiz-results",
                        ];
            for (let tab of tabs) {
                await p.goto(
                    `http://127.0.0.1:4200/${role}-dashboard?tab=${tab}`,
                );
                await p.locator("app-page-heading h1").waitFor();
                for (let width of [390, 1440]) {
                    await p.setViewportSize({ width, height: 1000 });
                    await p.waitForFunction(
                        () =>
                            document.documentElement.scrollWidth <= innerWidth,
                        {},
                        { timeout: 2500 },
                    );
                }
                await p.getByRole("button", { name: "Use dark theme" }).click();
                for (let f of await p
                    .locator(".legacy-management-panels app-form-field")
                    .all()) {
                    let control = f.locator("input,select,textarea").first();
                    assert.equal(
                        await f.locator("label").getAttribute("for"),
                        await control.getAttribute("id"),
                    );
                }
                await p
                    .getByRole("button", { name: "Use light theme" })
                    .click();
            }
            if (role === "trainer") {
                await p.goto(
                    "http://127.0.0.1:4200/trainer-dashboard?tab=create",
                );
                await p.getByLabel("Course title").fill("Test only course");
                await p
                    .getByLabel("What will learners discover?", {
                        exact: false,
                    })
                    .fill(
                        "Test-only description for the create-course UI contract.",
                    );
                await p.getByLabel("Subject", { exact: false }).fill("Design");
                await p
                    .getByRole("button", {
                        name: "Create course",
                        exact: false,
                    })
                    .click();
                await p
                    .getByText("Course draft created. Add your lessons next.", {
                        exact: false,
                    })
                    .waitFor();
                assert.equal(writes.length, 1);
                assert.equal(writes[0].title, "Test only course");
                assert.ok(
                    (await p
                        .locator(".legacy-management-panels app-form-field")
                        .count()) > 0,
                );
                await p.setViewportSize({ width: 390, height: 1000 });
                await p.waitForFunction(
                    () => document.documentElement.scrollWidth <= innerWidth,
                    {},
                    { timeout: 2500 },
                );
            }
            if (role === "manager") {
                await p.goto(
                    "http://127.0.0.1:4200/manager-dashboard?tab=assign",
                );
                const c = p.getByRole("checkbox", {
                    name: "Select Test Member",
                });
                await c.waitFor();
                await c.check();
                await p
                    .getByText("1 member(s) selected", { exact: false })
                    .waitFor();
                await c.uncheck();
                await p
                    .getByText("0 member(s) selected", { exact: false })
                    .waitFor();
            }
        }
        assert.deepEqual(errors, []);
        console.log(
            "PASS 15 staff destinations, mobile bounds, both themes, shared field associations; trainer course-create API contract and curriculum surface; manager checkbox updates selection. Controlled fixtures, not full authorization/assessment coverage.",
        );
    } finally {
        await b.close();
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
