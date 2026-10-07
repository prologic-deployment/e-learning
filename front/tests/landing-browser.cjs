// Fixtures below are isolated browser tests only; the application always calls the real course API.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4200";
(async () => {
    const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    try {
        const page = await browser.newPage({
            viewport: { width: 1440, height: 1000 },
        });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(base + "/");
        await page
            .getByRole("heading", { name: "Curiosity. Meet direction." })
            .waitFor();
        assert.equal(new URL(page.url()).pathname, "/");
        assert.equal(await page.locator("app-navbar,app-footer").count(), 0);
        assert.match(await page.title(), /FormaPath/);
        await page.getByRole("button", { name: /Trainers/ }).click();
        await page
            .getByRole("heading", {
                name: "Turn what you know into what others can do.",
            })
            .waitFor();
        await page.getByRole("button", { name: /Managers/ }).click();
        await page
            .getByRole("heading", { name: "Give your team a clear next step." })
            .waitFor();
        await page.getByRole("button", { name: /Administrators/ }).click();
        await page
            .getByRole("heading", {
                name: "Bring the whole learning operation together.",
            })
            .waitFor();
        await page.getByRole("button", { name: /Learners/ }).click();
        await page.goto(base + "/welcome");
        await page.waitForURL(base + "/");
        // Screenshot the actual API state (no course fixtures).
        await page
            .getByRole("heading", { name: "Curiosity. Meet direction." })
            .waitFor();
        await page.screenshot({
            path: "../docs/product-quality/landing-desktop.png",
            fullPage: true,
            animations: "disabled",
        });
        for (const width of [320, 390, 768, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            assert.equal(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
                true,
                `overflow at ${width}`,
            );
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole("button", { name: "Toggle navigation" }).click();
        await page
            .locator("#landing-mobile-nav")
            .getByRole("link", { name: "The experience" })
            .click();
        assert.equal(await page.locator("#landing-mobile-nav").count(), 0);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
            path: "../docs/product-quality/landing-mobile.png",
            fullPage: true,
            animations: "disabled",
        });
        await page.getByRole("button", { name: "Toggle navigation" }).click();
        await page
            .locator("#landing-mobile-nav")
            .getByRole("link", { name: "Create an account" })
            .click();
        await page.waitForURL("**/profile-authentication?tab=register");
        await page
            .getByRole("heading", { name: "Your path starts here." })
            .waitFor();
        // Controlled failure, retry, empty and success responses are test-only fault injection.
        let mode = "error";
        let release;
        await page.route("**/api/courses?*", async (route) => {
            if (mode === "slow") {
                await new Promise((resolve) => (release = resolve));
                try {
                    await route.fulfill({ json: { courses: [] } });
                } catch {}
                return;
            }
            if (mode === "error")
                return route.fulfill({
                    status: 503,
                    json: { message: "isolated test outage" },
                });
            return route.fulfill({
                json: {
                    courses:
                        mode === "empty"
                            ? []
                            : [
                                  {
                                      _id: "test-course-id",
                                      title: "TEST ONLY course",
                                      description:
                                          "Isolated response-contract fixture",
                                      category: "Test category",
                                      trainer: {
                                          firstname: "Test",
                                          lastname: "Author",
                                      },
                                  },
                              ],
                },
            });
        });
        await page.goto(base + "/");
        await page
            .getByRole("button", { name: "Try again", exact: true })
            .waitFor();
        mode = "empty";
        await page
            .getByRole("button", { name: "Try again", exact: true })
            .click();
        await page
            .getByRole("heading", { name: "Room for what comes next." })
            .waitFor();
        mode = "success";
        await page.reload();
        await page.getByRole("heading", { name: "TEST ONLY course" }).waitFor();
        assert.equal(
            await page.locator(".preview-card-link").getAttribute("href"),
            "/courses-details/test-course-id",
        );
        mode = "slow";
        await page.reload();
        await page
            .getByRole("status", { name: "Loading course previews" })
            .waitFor();
        await page.getByRole("link", { name: /Find your next course/ }).click();
        await page.waitForURL("**/courses-grid");
        release?.();
        await page.unroute("**/api/courses?*");
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(base + "/");
        assert.equal(
            await page
                .locator(".visual-star")
                .evaluate((e) => getComputedStyle(e).animationName),
            "none",
        );
        // Route/UI affordance checks only, not a claim of authenticated role authorization.
        for (const role of ["user", "trainer", "manager", "admin"]) {
            await page.evaluate((role) => {
                localStorage.setItem("token", "test-only-route-state");
                localStorage.setItem(
                    "user",
                    JSON.stringify({ firstname: "Test", role }),
                );
            }, role);
            await page.reload();
            await page
                .getByRole("heading", { name: "Curiosity. Meet direction." })
                .waitFor();
            assert.equal(
                await page
                    .locator(".header-actions .small-cta")
                    .getAttribute("href"),
                role === "user" ? "/dashboard" : `/${role}-dashboard`,
            );
        }
        await page.evaluate(() => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
        });
        assert.deepEqual(errors, []);
        console.log(
            "PASS: default landing, welcome alias, roles, CTA, responsive 320/390/768/1440, menu, metadata, loading/error/retry/empty/success/cancellation, reduced motion, signed-in route affordances; no page errors.",
        );
    } finally {
        await browser.close();
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
