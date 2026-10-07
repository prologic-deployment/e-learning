// Controlled response fixtures test the UI/API contract, not availability of an AI provider.
const { chromium } = require("playwright"),
    assert = require("node:assert/strict");
(async () => {
    const browser = await chromium.launch({
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    try {
        const page = await browser.newPage({
            viewport: { width: 1440, height: 1000 },
            reducedMotion: "reduce",
        });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route("**/api/courses?*", (r) =>
            r.fulfill({ json: { courses: [] } }),
        );
        await page.goto("http://127.0.0.1:4200/");
        for (const [name, id] of [
            ["The experience", "how-it-works"],
            ["For your team", "for-every-role"],
            ["Course library", "course-library"],
        ]) {
            await page
                .locator(".desktop-nav")
                .getByRole("link", { name, exact: true })
                .click();
            await page.waitForFunction((id) => {
                const y = document
                        .getElementById(id)
                        .getBoundingClientRect().top,
                    h = document
                        .querySelector(".site-header")
                        .getBoundingClientRect().bottom;
                return y >= h && y < h + 40;
            }, id);
            assert.equal(new URL(page.url()).hash, "#" + id);
        }
        await page.getByRole("link", { name: "Back to top ↑" }).click();
        await page.waitForFunction(() => scrollY < 150);
        await page
            .getByRole("button", { name: "Language", exact: true })
            .click();
        await page
            .getByRole("menuitemradio", { name: "Français", exact: true })
            .click();
        await page.getByRole("heading", { name: /La curiosité/ }).waitFor();
        assert.equal(await page.locator("html").getAttribute("lang"), "fr");
        await page
            .getByRole("button", { name: "Activer le mode sombre" })
            .click();
        assert.equal(
            await page
                .locator("html")
                .evaluate((e) => e.classList.contains("dark")),
            true,
        );
        assert.equal(
            await page
                .locator(".landing")
                .evaluate((e) => getComputedStyle(e).backgroundColor),
            "rgb(16, 29, 48)",
        );
        await page.reload();
        await page.getByRole("heading", { name: /La curiosité/ }).waitFor();
        assert.equal(
            await page
                .locator("html")
                .evaluate((e) => e.classList.contains("dark")),
            true,
        );
        await page
            .getByRole("button", { name: "Ouvrir l’assistant pédagogique" })
            .click();
        await page.getByRole("dialog").waitFor();
        await page.getByLabel("Votre message", { exact: true }).waitFor();
        assert.equal(await page.locator("textarea").count(), 1);
        await page.keyboard.press("Escape");
        assert.equal(await page.getByRole("dialog").count(), 0);
        assert.equal(
            await page
                .getByRole("button", { name: "Ouvrir l’assistant pédagogique" })
                .evaluate((e) => e === document.activeElement),
            true,
        );
        for (const width of [320, 390, 768, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            assert.equal(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
                true,
                `overflow ${width}`,
            );
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page
            .getByRole("button", { name: "Ouvrir ou fermer la navigation" })
            .click();
        await page
            .locator("#public-mobile-nav")
            .getByRole("link", { name: "Pour votre équipe" })
            .click();
        await page.waitForFunction(() => {
            const y = document
                    .getElementById("for-every-role")
                    .getBoundingClientRect().top,
                h = document
                    .querySelector(".site-header")
                    .getBoundingClientRect().bottom;
            return y >= h && y < h + 40;
        });
        const before = await page.locator(".chat-launcher").boundingBox();
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        const after = await page.locator(".chat-launcher").boundingBox();
        assert.equal(Math.round(before.y), Math.round(after.y));
        await page
            .getByRole("button", { name: "Ouvrir l’assistant pédagogique" })
            .click();
        const panel = await page.getByRole("dialog").boundingBox();
        assert.ok(
            panel.x >= 0 &&
                panel.y >= 0 &&
                panel.x + panel.width <= 390 &&
                panel.y + panel.height <= 844,
        );
        await page.screenshot({
            path: "../docs/product-quality/landing-controls-mobile.png",
            animations: "disabled",
        });
        await page
            .getByRole("dialog")
            .getByRole("button", { name: "Fermer la discussion" })
            .click();
        await page.evaluate(() => {
            localStorage.setItem("token", "isolated-client-state");
            localStorage.setItem(
                "user",
                JSON.stringify({ firstname: "Test", role: "user" }),
            );
        });
        await page.reload();
        await page.getByRole("button", { name: "Langue", exact: true }).click();
        await page
            .getByRole("menuitemradio", { name: "English", exact: true })
            .click();
        let mode = "error",
            calls = 0,
            lastBody,
            release;
        await page.route("**/api/chatbot/chat", async (r) => {
            calls++;
            lastBody = r.request().postDataJSON();
            if (mode === "slow") {
                await new Promise((resolve) => (release = resolve));
                try {
                    await r.fulfill({ json: { message: "Cancelled" } });
                } catch {}
                return;
            }
            if (mode === "quota") return r.fulfill({ status: 429, json: {} });
            if (mode === "error")
                return r.fulfill({
                    status: 503,
                    json: { message: "test outage" },
                });
            return r.fulfill({
                json: {
                    message: "Test-only reply <img src=x onerror=alert(1)>",
                    sources: [
                        { title: "Unsafe", url: "javascript:alert(1)" },
                        {
                            title: "Course reference",
                            url: "https://example.test/course",
                        },
                    ],
                },
            });
        });
        await page
            .getByRole("button", { name: "Open learning assistant" })
            .click();
        await page
            .getByLabel("Your message", { exact: true })
            .fill("What courses can I take?");
        await page.getByRole("button", { name: /^Send/ }).click();
        await page
            .getByRole("alert")
            .filter({ hasText: "The assistant is unavailable" })
            .waitFor();
        assert.equal(
            await page.getByLabel("Your message").inputValue(),
            "What courses can I take?",
        );
        mode = "success";
        await page.getByRole("button", { name: /^Send/ }).click();
        await page
            .getByText("Test-only reply <img src=x onerror=alert(1)>", {
                exact: true,
            })
            .waitFor();
        assert.equal(calls, 2);
        assert.equal(lastBody.message, "What courses can I take?");
        assert.deepEqual(lastBody.history, []);
        assert.equal(await page.locator(".chat-log img").count(), 0);
        assert.equal(
            await page.getByRole("link", { name: /Unsafe/ }).count(),
            0,
        );
        await page.getByRole("button", { name: "Clear conversation" }).click();
        assert.equal(await page.locator(".chat-message").count(), 0);
        mode = "quota";
        await page.getByLabel("Your message").fill("Quota test");
        await page.getByRole("button", { name: /^Send/ }).click();
        await page
            .getByText("Too many requests. Please try again later.", {
                exact: true,
            })
            .waitFor();
        mode = "slow";
        await page.getByRole("button", { name: /^Send/ }).click();
        await page.getByRole("button", { name: "Cancel request" }).waitFor();
        assert.equal(await page.getByLabel("Your message").isDisabled(), true);
        await page.getByRole("button", { name: "Cancel request" }).click();
        assert.equal(
            await page.getByLabel("Your message").inputValue(),
            "Quota test",
        );
        assert.equal(await page.locator(".chat-message").count(), 0);
        release?.();
        await page
            .getByRole("dialog")
            .getByRole("button", { name: "Close chat" })
            .click();
        await page
            .getByRole("button", { name: "Switch to light mode" })
            .click();
        assert.equal(
            await page
                .locator(".landing")
                .evaluate((e) => getComputedStyle(e).backgroundColor),
            "rgb(247, 250, 245)",
        );
        assert.deepEqual(errors, []);
        console.log(
            "PASS: section positions and fragments, EN/FR persistence, light/dark persistence, mobile menu/overflow, fixed chat position, guest composer, escape/focus, real API request contract with test responses, error retry/history and safe rendering.",
        );
    } finally {
        await browser.close();
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
