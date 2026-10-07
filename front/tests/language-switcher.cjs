const { chromium } = require("playwright"),
    assert = require("node:assert/strict");
(async () => {
    const browser = await chromium.launch({ args: ["--no-sandbox"] });
    try {
        const page = await browser.newPage({
            viewport: { width: 1440, height: 1000 },
            reducedMotion: "reduce",
        });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto("http://127.0.0.1:4200/");
        const trigger = page.getByRole("button", {
            name: "Language",
            exact: true,
        });
        await trigger.click();
        const english = page.getByRole("menuitemradio", {
                name: "English",
                exact: true,
            }),
            french = page.getByRole("menuitemradio", {
                name: "Français",
                exact: true,
            });
        assert.equal(await english.getAttribute("aria-checked"), "true");
        assert.equal(await french.getAttribute("aria-checked"), "false");
        assert.equal(
            await page
                .getByRole("menu")
                .evaluate((e) => getComputedStyle(e).backgroundColor),
            "rgb(251, 252, 248)",
        );
        await page.screenshot({
            path: "../docs/product-quality/language-light.png",
            clip: { x: 750, y: 0, width: 650, height: 430 },
            animations: "disabled",
        });
        await english.focus();
        await page.keyboard.press("ArrowDown");
        assert.equal(
            await french.evaluate((e) => e === document.activeElement),
            true,
        );
        await page.keyboard.press("Enter");
        await page.getByRole("heading", { name: /La curiosité/ }).waitFor();
        assert.equal(await page.getByRole("menu").count(), 0);
        await page.reload();
        assert.equal(await page.locator("html").getAttribute("lang"), "fr");
        await page
            .getByRole("button", { name: "Activer le mode sombre" })
            .click();
        await page.getByRole("button", { name: "Langue", exact: true }).click();
        assert.equal(
            await page
                .getByRole("menu")
                .evaluate((e) => getComputedStyle(e).backgroundColor),
            "rgb(23, 42, 62)",
        );
        assert.equal(
            await page
                .getByRole("menuitemradio", { name: "Français", exact: true })
                .getAttribute("aria-checked"),
            "true",
        );
        await page.screenshot({
            path: "../docs/product-quality/language-dark.png",
            clip: { x: 750, y: 0, width: 650, height: 430 },
            animations: "disabled",
        });
        await page.keyboard.press("Escape");
        assert.equal(
            await page
                .getByRole("button", { name: "Langue", exact: true })
                .evaluate((e) => e === document.activeElement),
            true,
        );
        for (const width of [320, 390, 768]) {
            await page.setViewportSize({ width, height: 844 });
            await page
                .getByRole("button", { name: "Langue", exact: true })
                .click();
            await page.waitForFunction(
                () => {
                    const menu = document.querySelector(".locale-panel");
                    if (!menu) return false;
                    const r = menu.getBoundingClientRect();
                    return r.x >= 0 && r.right <= innerWidth && r.y >= 0;
                },
                {},
                { timeout: 3000 },
            );
            const panel = await page.getByRole("menu").boundingBox();
            assert.ok(
                panel.x >= 0 && panel.x + panel.width <= width && panel.y >= 0,
            );
            assert.equal(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
                true,
            );
            await page.keyboard.press("Escape");
        }
        assert.deepEqual(errors, []);
        console.log(
            "PASS: themed menu styling, radio selection, arrow/Enter/Escape keyboard control, focus restoration, locale persistence, and 320/390/768px overlay bounds.",
        );
    } finally {
        await browser.close();
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
