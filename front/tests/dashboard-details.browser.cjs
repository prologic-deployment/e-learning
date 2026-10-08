// Real Angular + isolated Express/Mongo API. Delays/aborts test failures, never mocked data.
const { chromium } = require("playwright"),
    assert = require("node:assert/strict"),
    fs = require("node:fs");
(async () => {
    const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const evidence = [],
        errors = [];
    async function account(role) {
        const context = await browser.newContext({
            viewport: { width: 1440, height: 1000 },
            reducedMotion: "reduce",
        });
        const response = await context.request.post(
            "http://127.0.0.1:4200/api/auth/login",
            {
                data: {
                    email: `${role}@dashboard.example.test`,
                    password: "DashboardTestOnly123!",
                },
            },
        );
        assert.equal(response.status(), 200);
        const login = await response.json();
        assert.ok(login.token);
        await context.addInitScript((session) => {
            localStorage.setItem("token", session.token);
            localStorage.setItem("user", JSON.stringify(session.user));
        }, login);
        const page = await context.newPage();
        // Test the deployed build without contacting the deployment: proxy real API/WS
        // traffic into this disposable fixture. No response payloads are synthesized.
        if (process.env.DASHBOARD_PRODUCTION_BUILD === "1") {
            const origin = "https://e-learning-backend.prologic.com.tn:3501";
            await page.route(origin + "/**", async (route) => {
                try {
                    const response = await route.fetch({
                        url: route
                            .request()
                            .url()
                            .replace(origin, "http://127.0.0.1:4200"),
                    });
                    await route.fulfill({ response });
                } catch {
                    await route.abort("failed").catch(() => {});
                }
            });
            await page.routeWebSocket(
                "wss://e-learning-backend.prologic.com.tn:3501/**",
                (socket) =>
                    socket.connectToServer(
                        socket
                            .url()
                            .replace(
                                "wss://e-learning-backend.prologic.com.tn:3501",
                                "ws://127.0.0.1:4200",
                            ),
                    ),
            );
        }

        page.on("pageerror", (e) => errors.push(e.message));
        const requests = [];
        page.on("request", (r) => {
            if (r.url().includes("/api/"))
                requests.push(new URL(r.url()).pathname);
        });
        const route = role === "user" ? "/dashboard" : `/${role}-dashboard`;
        const goto = async (tab) => {
            requests.length = 0;
            await page.goto(
                "http://127.0.0.1:4200" + route + (tab ? "?tab=" + tab : ""),
            );
            // A live Socket.IO long poll is not an unfinished dashboard load.
            if (tab === "overview")
                await page.locator(".metric-strip .metric").first().waitFor();
            else if (tab === "notifications") {
                await page
                    .getByRole("heading", {
                        name: "Your activity",
                        exact: true,
                    })
                    .waitFor();
                await page
                    .locator("app-learning-skeleton")
                    .waitFor({ state: "hidden" });
            } else await page.locator(".detail-record-row").first().waitFor();
        };
        return { context, page, requests, goto };
    }
    async function close(page) {
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
    }
    async function openRow(page, kind, index = 0) {
        const row = page
            .locator(`.detail-record-row[data-record-kind="${kind}"]`)
            .nth(index);
        await row.waitFor();
        await row.click();
        await page.getByRole("dialog").waitFor();
        await page
            .getByRole("dialog")
            .locator(".detail-section")
            .first()
            .waitFor();
        return row;
    }
    try {
        const admin = await account("admin"),
            { page, requests, goto } = admin;
        for (const [tab, kind] of [
            ["stats", "course"],
            ["courses", "course"],
            ["users", "user"],
            ["archived", "course"],
            ["assign", "user"],
            ["reviews", "review"],
        ]) {
            await goto(tab);
            assert.equal(
                requests.filter((p) => p.startsWith("/api/details/")).length,
                0,
                tab + " must not preload details",
            );
            if (tab === "assign")
                assert.equal(
                    requests.filter((p) => p === "/api/admin/users").length,
                    1,
                    "assignment must fetch users once",
                );
            if (tab !== "stats")
                assert.equal(
                    requests.filter((p) => p === "/api/stats/admin").length,
                    0,
                    "no unrelated stats load",
                );
            const row = await openRow(page, kind);
            assert.equal(
                requests.filter((p) => p.startsWith("/api/details/")).length,
                1,
            );
            await close(page);
            assert.equal(
                await row.evaluate((e) => e === document.activeElement),
                true,
                "focus restored to " + tab + " row",
            );
            evidence.push(`admin/${tab}: lazy detail, Escape, focus return`);
        }
        await goto("users");
        const first = page.locator(".detail-record-row").first();
        await first.getByRole("button", { name: "Change role" }).click();
        await page.getByRole("dialog").waitFor();
        assert.equal(
            requests.filter((p) => p.startsWith("/api/details/")).length,
            0,
            "row action must not open details",
        );
        await close(page);
        const search = page.getByRole("searchbox", { name: "Search records" });
        await search.fill("Sam");
        assert.equal(await page.locator(".detail-record-row").count(), 1);
        await search.fill("");
        const beforeNames = await page
            .locator(".detail-record-row")
            .allTextContents();
        await page.getByLabel("Sort records").selectOption("name:desc");
        assert.notDeepEqual(
            await page.locator(".detail-record-row").allTextContents(),
            beforeNames,
        );
        await page
            .locator(".pagination-row")
            .getByRole("button", { name: /Next/ })
            .click();
        assert.equal(await page.locator(".detail-record-row").count(), 8);
        evidence.push(
            "shared table: search, sort, pagination; actions do not trigger details",
        );
        await goto("quiz-results");
        assert.equal(await page.locator(".detail-record-row").count(), 20);
        const pager = page.locator("app-data-table .pagination-row");
        await pager.getByRole("button", { name: "Next" }).click();
        assert.equal(await page.locator(".detail-record-row").count(), 5);
        await pager.getByRole("button", { name: "Previous" }).click();
        const resultRow = page
            .locator(".detail-record-row")
            .filter({ hasText: "Sam" });
        await resultRow.focus();
        await page.keyboard.press("Enter");
        await page
            .getByRole("heading", { name: "Question-by-question review" })
            .waitFor();
        assert.equal(await page.locator(".question-card").count(), 20);
        assert.match(
            await page.locator(".question-card").nth(1).innerText(),
            /Multiple response/,
        );
        assert.match(
            await page.locator(".question-card").nth(1).innerText(),
            /Third option/,
        );
        assert.match(
            await page.locator(".question-card").nth(2).innerText(),
            /Incorrect/,
        );
        assert.match(
            await page.locator(".question-card").nth(3).innerText(),
            /Unanswered/,
        );
        assert.ok(
            !/\[object Object\]|\bundefined\b|\bnull\b/.test(
                await page.getByRole("dialog").innerText(),
            ),
        );
        fs.mkdirSync("../docs/product-quality/unified-tables/details", {
            recursive: true,
        });
        await page.screenshot({
            path: "../docs/product-quality/unified-tables/details/result-overview.png",
        });
        await page.getByRole("button", { name: /View answers/ }).click();
        assert.ok(
            (await page.locator(".question-card").first().boundingBox()).y <
                900,
        );
        await page.screenshot({
            path: "../docs/product-quality/unified-tables/details/assessment-desktop.png",
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForFunction(() => {
            const r = document
                .querySelector(".record-detail-dialog")
                .getBoundingClientRect();
            return r.width <= innerWidth && r.height <= innerHeight;
        });
        const bounds = await page
            .locator(".record-detail-dialog")
            .boundingBox();
        assert.ok(bounds.width <= 390 && bounds.height <= 844);
        assert.ok(bounds.x >= 0 && bounds.y >= 0);
        for (let i = 0; i < 12; i++) {
            await page.keyboard.press("Tab");
            assert.equal(
                await page.evaluate(
                    () => !!document.activeElement.closest('[role="dialog"]'),
                ),
                true,
                "focus stays inside dialog",
            );
        }
        await page.getByRole("button", { name: /View answers/ }).click();
        await page
            .getByRole("dialog")
            .getByRole("button", { name: "Close", exact: true })
            .click({ trial: true });
        await page.screenshot({
            path: "../docs/product-quality/unified-tables/details/assessment-mobile.png",
        });
        await close(page);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.locator(".detail-record-row").nth(1).click();
        await page.getByText(/Answer-level review is unavailable/).waitFor();
        assert.equal(await page.locator(".question-card").count(), 0);
        await close(page);
        evidence.push(
            "assessment: pagination, Enter, immutable answer cards, multiple/wrong/unanswered, historical empty state, mobile sizing/focus trap",
        );
        await page.route("**/api/details/**", async (route) => {
            await new Promise((r) => setTimeout(r, 700));
            await route.fallback().catch(() => {});
        });
        await resultRow.click();
        await page.getByText("Loading details…", { exact: true }).waitFor();
        await close(page);
        await page.unroute("**/api/details/**");
        let aborted = false;
        await page.route("**/api/details/**", async (route) => {
            if (!aborted) {
                aborted = true;
                await route.abort("failed");
            } else await route.fallback();
        });
        await resultRow.click();
        await page
            .getByRole("heading", { name: "Unable to open this record" })
            .waitFor();
        await page
            .getByRole("dialog")
            .getByRole("button", { name: "Retry", exact: true })
            .click();
        await page
            .getByRole("heading", { name: "Question-by-question review" })
            .waitFor();
        await close(page);
        await page.unroute("**/api/details/**");
        evidence.push(
            "immediate loading, close during pending fetch, network error and real-API retry",
        );
        await goto("stats");
        await openRow(page, "course");
        const curriculum = () =>
            page
                .getByRole("dialog")
                .locator(".detail-section")
                .filter({
                    has: page.getByRole("heading", {
                        name: "Curriculum",
                        exact: true,
                    }),
                });
        assert.equal(await curriculum().locator(".related-record").count(), 20);
        await curriculum()
            .getByRole("button", { name: "Next", exact: true })
            .click();
        await page
            .getByRole("dialog")
            .getByText("Page 2 of 2", { exact: true })
            .first()
            .waitFor();
        assert.equal(await curriculum().locator(".related-record").count(), 3);
        await page
            .getByRole("dialog")
            .getByRole("button", { name: /View details: Supplementary lesson/ })
            .first()
            .click();
        await page
            .getByRole("dialog")
            .getByRole("heading", { name: "Lesson", exact: true })
            .waitFor();
        await page
            .getByRole("dialog")
            .getByRole("button", { name: /Back/ })
            .click();
        await page
            .getByRole("dialog")
            .getByRole("heading", { name: "Curriculum", exact: true })
            .waitFor();
        await close(page);
        evidence.push("course relation paging, lesson drill-in and Back");
        await admin.context.close();
        for (const [role, tabs] of [
            [
                "trainer",
                [
                    ["stats", "course"],
                    ["courses", "course"],
                    ["quiz-results", "result"],
                ],
            ],
            [
                "manager",
                [
                    ["stats", "user"],
                    ["overdue", "enrollment"],
                ],
            ],
            ["user", [["history", "enrollment"]]],
        ]) {
            const a = await account(role);
            for (const [tab, kind] of tabs) {
                await a.goto(tab);
                assert.equal(
                    a.requests.filter((p) => p.startsWith("/api/details/"))
                        .length,
                    0,
                );
                await openRow(a.page, kind);
                if (role === "trainer" && tab === "quiz-results")
                    await a.page
                        .getByRole("heading", {
                            name: "Question-by-question review",
                        })
                        .waitFor();
                await close(a.page);
                if (tab === "stats" && ["trainer", "manager"].includes(role)) {
                    const download = a.page.waitForEvent("download");
                    await a.page
                        .getByRole("button", {
                            name: "Export Excel",
                            exact: true,
                        })
                        .click();
                    const file = await (await download).path();
                    const book = require("xlsx").read(fs.readFileSync(file));
                    assert.ok(book.SheetNames.length);
                    if (role === "manager") {
                        const rows = book.SheetNames.flatMap((name) =>
                            require("xlsx").utils.sheet_to_json(
                                book.Sheets[name],
                                { header: 1 },
                            ),
                        );
                        assert.ok(
                            rows.length > 20,
                            "Export retains all records, not the visible table page",
                        );
                    }
                    evidence.push(role + " full-data Excel export");
                }
                if (role === "manager" && tab === "overdue") {
                    const n = a.requests.filter((p) =>
                        p.startsWith("/api/details/"),
                    ).length;
                    await a.page
                        .locator(".detail-record-row input[type=date]")
                        .first()
                        .fill("2027-01-01");
                    assert.equal(
                        a.requests.filter((p) => p.startsWith("/api/details/"))
                            .length,
                        n,
                    );
                }
                evidence.push(`${role}/${tab}: scoped lazy detail`);
            }
            if (role === "user") {
                await a.goto("overview");
                assert.equal(
                    a.requests.filter((p) => p === "/api/profile").length,
                    0,
                );
                assert.equal(
                    a.requests.filter((p) => p === "/api/enrollments/me")
                        .length,
                    1,
                );
                await a.goto("notifications");
                assert.equal(
                    a.requests.filter((p) => p === "/api/notifications").length,
                    1,
                );
                evidence.push(
                    "learner overview: 0 unused profile calls, 1 enrollment call; notifications: 1 call",
                );
            }
            await a.context.close();
        }
        assert.deepEqual(errors, [], "No runtime errors");
        console.log(evidence.join("\n"));
        console.log(
            "PASS: " + evidence.length + " scenarios; no runtime errors",
        );
    } finally {
        await browser.close();
    }
})().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
