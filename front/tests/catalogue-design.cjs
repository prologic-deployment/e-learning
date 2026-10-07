const { chromium } = require("playwright"),
    assert = require("node:assert/strict");
(async () => {
    const b = await chromium.launch({ args: ["--no-sandbox"] });
    try {
        const p = await b.newPage({
            viewport: { width: 1440, height: 1100 },
            reducedMotion: "reduce",
        });
        const errors = [];
        p.on("pageerror", (e) => errors.push(e.message));
        let mode = "loaded",
            requests = [];
        await p.route("**/api/reviews/course/*", (r) =>
            r.fulfill({ json: { avgRating: 4.5, total: 2 } }),
        );
        await p.route("**/api/courses?*", async (r) => {
            let u = new URL(r.request().url());
            requests.push(u.search);
            if (mode === "error")
                return r.fulfill({
                    status: 503,
                    json: { message: "Unavailable" },
                });
            if (u.searchParams.get("search") === "older")
                await new Promise((resolve) => setTimeout(resolve, 650));
            let courses =
                mode === "empty"
                    ? []
                    : Array.from({ length: 6 }, (_, i) => ({
                          _id: "course-" + i,
                          title:
                              (u.searchParams.get("search") || "UI fixture") +
                              [
                                  " — Designing for people",
                                  " — A fresh look at data",
                                  " — Learning to lead",
                              ][i % 3],
                          category: ["Design", "Data Science", "Business"][
                              i % 3
                          ],
                          price: i % 2 ? 49 : 0,
                          description:
                              "Test-only response fixture to verify real API rendering, filtering and navigation. Not application content.",
                          trainer: { firstname: "Test", lastname: "Trainer" },
                      }));
            await r
                .fulfill({
                    json: {
                        courses,
                        pagination: {
                            total: courses.length ? 18 : 0,
                            pages: courses.length ? 2 : 0,
                            page: Number(u.searchParams.get("page")) || 1,
                        },
                    },
                })
                .catch(() => {});
        });
        await p.goto("http://127.0.0.1:4200/courses-grid");
        await p.locator(".catalogue-card").first().waitFor();
        assert.equal(await p.locator(".catalogue-card").count(), 6);
        assert.equal(
            await p
                .locator(".catalogue-card h3 a")
                .first()
                .getAttribute("href"),
            "/courses-details/course-0",
        );
        await p
            .getByRole("button", { name: "Paid courses", exact: true })
            .click();
        await p.waitForURL(/type=paid/);
        assert.ok(requests.some((x) => x.includes("type=paid")));
        await p.getByLabel("Subject", { exact: true }).selectOption("Design");
        await p.waitForURL(/category=Design/);
        await p.getByRole("button", { name: "Next", exact: false }).click();
        await p.waitForURL(/page=2/);
        await p.getByRole("button", { name: "Clear all" }).click();
        await p.waitForURL("**/courses-grid");
        await p.goBack();
        await p.waitForURL(/page=2/);
        assert.equal(
            await p.getByLabel("Subject", { exact: true }).inputValue(),
            "Design",
        );
        await p.getByLabel("Search courses", { exact: true }).fill("older");
        await p.getByRole("button", { name: "Find a course" }).click();
        await p.waitForURL(/search=older/);
        await p.getByLabel("Search courses", { exact: true }).fill("newer");
        await p.getByRole("button", { name: "Find a course" }).click();
        await p.waitForURL(/search=newer/);
        await p
            .getByRole("heading", { name: "newer — Designing for people" })
            .first()
            .waitFor();
        await p.waitForTimeout(750);
        assert.equal(
            await p.getByRole("heading", { name: /older —/ }).count(),
            0,
        );
        mode = "empty";
        await p.reload();
        await p
            .getByRole("heading", { name: "A different direction, perhaps?" })
            .waitFor();
        mode = "error";
        await p.reload();
        await p
            .getByRole("alert")
            .filter({ hasText: "A brief pause" })
            .waitFor();
        mode = "loaded";
        await p.getByRole("button", { name: "Try again", exact: true }).click();
        await p.locator(".catalogue-card").first().waitFor();
        await p.getByRole("button", { name: "Clear all" }).click();
        await p.locator(".catalogue-card").first().waitFor();
        for (let width of [320, 390, 768, 1440]) {
            await p.setViewportSize({ width, height: 1100 });
            await p.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, {}, {timeout:2500});
            assert.equal(
                await p.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
                true,
                "overflow at " + width,
            );
        }
        await p.screenshot({
            path: "../docs/product-quality/catalogue-light.png",
            fullPage: true,
        });
        await p.getByRole("button", { name: "Switch to dark mode" }).click();
        await p.screenshot({
            path: "../docs/product-quality/catalogue-dark.png",
            fullPage: true,
        });
        await p.getByRole("button", { name: "Language", exact: true }).click();
        await p
            .getByRole("menuitemradio", { name: "Français", exact: true })
            .click();
        await p
            .getByRole("heading", { name: "Suivez votre curiosité." })
            .waitFor();
        for (let path of [
            "courses-grid-2",
            "courses-wide-grid",
            "courses-left-sidebar",
            "courses-right-sidebar",
            "courses-list",
        ]) {
            await p.goto("http://127.0.0.1:4200/" + path);
            await p.waitForURL("**/courses-grid");
        }
        assert.deepEqual(errors, []);
        console.log(
            "PASS catalogue: API cards, URL filters, back navigation, pagination, stale-request cancellation, empty/error/retry, EN/FR, light/dark, 320–1440px bounds, old library URL redirects. Screenshots use clearly labelled test fixtures.",
        );
    } finally {
        await b.close();
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
