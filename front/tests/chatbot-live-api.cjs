// Requires back/tests/chat-browser-api.cjs. Real HTTP + MongoDB; no browser route mocks.
const { chromium } = require("playwright"),
    assert = require("node:assert/strict");
(async () => {
    const browser = await chromium.launch({ args: ["--no-sandbox"] });
    try {
        const page = await browser.newPage({
            viewport: { width: 390, height: 844 },
            reducedMotion: "reduce",
        });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto("http://127.0.0.1:4200/");
        await page
            .getByRole("button", { name: "Open learning assistant" })
            .click();
        await page
            .getByLabel("Your message", { exact: true })
            .fill("Python courses");
        const received = page.waitForResponse((r) =>
            r.url().endsWith("/chatbot/public-chat"),
        );
        await page.getByRole("button", { name: /^Send/ }).click();
        const response = await received;
        assert.equal(response.status(), 200);
        assert.equal((await response.json()).mode, "catalogue");
        await page
            .getByText("AI unavailable — showing live catalogue results.", {
                exact: true,
            })
            .waitFor();
        await page
            .getByRole("link", { name: "TEST ONLY Python foundations ↗" })
            .waitFor();
        assert.equal(
            await page.evaluate(() => localStorage.getItem("token")),
            null,
        );
        assert.equal(await page.getByLabel("Your message").isEnabled(), true);
        await page.getByLabel("Your message").fill("Unfindabletopic");
        await page.getByRole("button", { name: /^Send/ }).click();
        await page
            .getByText(/I could not find any published courses/)
            .waitFor();
        assert.deepEqual(errors, []);
        console.log(
            "PASS real guest browser → existing Express application → isolated MongoDB catalogue → answer and course link; no auth token, no provider key, no mocked response; follow-up and empty results.",
        );
    } finally {
        await browser.close();
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
