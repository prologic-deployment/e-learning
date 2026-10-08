const { chromium } = require("playwright"),
    assert = require("node:assert/strict"),
    fs = require("node:fs");
(async () => {
    const browser = await chromium.launch({
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const errors = [];
    let scenarios = 0;
    try {
        for (const role of ["admin", "trainer", "manager", "user"]) {
            const context = await browser.newContext({
                viewport: { width: 1440, height: 1000 },
            });
            const login = await context.request.post(
                "http://127.0.0.1:4200/api/auth/login",
                {
                    data: {
                        email: `${role}@dashboard.example.test`,
                        password: "DashboardTestOnly123!",
                    },
                },
            );
            assert.equal(login.status(), 200);
            const session = await login.json();
            await context.addInitScript((s) => {
                localStorage.setItem("token", s.token);
                localStorage.setItem("user", JSON.stringify(s.user));
            }, session);
            const page = await context.newPage();
            page.on("pageerror", (e) => errors.push(e.message));
            const base =
                "http://127.0.0.1:4200" +
                (role === "user" ? "/dashboard" : `/${role}-dashboard`);
            if (process.env.DASHBOARD_PRODUCTION_BUILD === "1")
                await page.route(
                    "https://e-learning-backend.prologic.com.tn:3501/**",
                    async (route) => {
                        try {
                            await route.fulfill({
                                response: await route.fetch({
                                    url: route
                                        .request()
                                        .url()
                                        .replace(
                                            "https://e-learning-backend.prologic.com.tn:3501",
                                            "http://127.0.0.1:4200",
                                        ),
                                }),
                            });
                        } catch {
                            await route.abort().catch(() => {});
                        }
                    },
                );
            if (role === "admin") {
                await page.goto(base + "?tab=users");
                await page.locator(".detail-record-row").first().waitFor();
                await page.getByRole("button", {name:"Filter Role",exact:true}).click();
                await page.getByRole("menuitemradio", {name:"Manager",exact:true}).click();
                assert.equal(
                    await page.locator(".detail-record-row").count(),
                    1,
                );
                await page
                    .getByRole("searchbox", { name: "Search records" })
                    .fill("Sam");
                await page
                    .getByRole("heading", { name: "No matching records" })
                    .waitFor();
                await page
                    .getByRole("button", { name: "Clear all filters" })
                    .click();
                assert.equal(
                    await page.locator(".detail-record-row").count(),
                    20,
                );
                scenarios++;
                await page.goto(base + '?tab=archived');
                await page.locator('.detail-record-row').first().waitFor();
                await page.locator('.detail-record-row').first().getByRole('button',{name:'Delete',exact:true}).click();
                await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
                assert.equal(await page.locator('.detail-record-row').count(),1);
                await page.locator('.detail-record-row').first().getByRole('button',{name:'Delete',exact:true}).click();
                await page.getByRole('dialog').getByRole('button',{name:'Delete permanently',exact:true}).click();
                await page.getByRole('heading',{name:'No records yet'}).waitFor();scenarios++;
                await page.goto(base + "?tab=quiz-results");
                await page.locator(".detail-record-row").first().waitFor();
                assert.equal(await page.getByRole('spinbutton').count(), 0);
                await page.getByRole('button', {name:'Filter Score', exact:true}).click();
                await page.getByRole('menuitemradio', {name:'90%–100%', exact:true}).click();
                await page
                    .getByRole("button", { name: /Reset filters/ })
                    .click();
                await page
                    .getByLabel("Completed from", { exact: true })
                    .fill("2099-01-01");
                await page
                    .getByLabel("Completed to", { exact: true })
                    .fill("2020-01-01");
                await page
                    .getByRole("alert")
                    .filter({ hasText: "Start date" })
                    .waitFor();
                await page
                    .getByRole("button", { name: /Reset filters/ })
                    .click();
                await page.getByRole("button", {name:"Rows per page",exact:true}).click();
                await page.getByRole("menuitemradio", {name:"10",exact:true}).click();
                assert.equal(
                    await page.locator(".detail-record-row").count(),
                    10,
                );
                scenarios++;
                fs.mkdirSync("../docs/product-quality/unified-tables", {
                    recursive: true,
                });
                await page.screenshot({
                    path: "../docs/product-quality/unified-tables/assessment-filters-desktop.png",
                    fullPage: true,
                });
                await page.setViewportSize({ width: 390, height: 844 });
                await page.waitForTimeout(350);
                assert.ok(
                    await page.evaluate(
                        () =>
                            document.documentElement.scrollWidth <=
                            innerWidth + 2,
                    ),
                );
                await page.screenshot({
                    path: "../docs/product-quality/unified-tables/assessment-filters-mobile.png",
                    fullPage: true,
                });
                scenarios++;
            } else {
                const profileLoaded = page.waitForResponse(r => r.url().endsWith('/api/profile') && r.request().method() === 'GET');
                await page.goto(base + "?tab=profile");
                assert.equal((await profileLoaded).status(), 200);
                const avatar = page.locator("app-avatar-picker");
                await avatar
                    .getByRole("button", { name: "Change profile photo" })
                    .waitFor();
                assert.equal(
                    await avatar.locator("input[type=file]").isVisible(),
                    false,
                );
                const png = Buffer.from(
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6k0AAAAASUVORK5CYII=",
                    "base64",
                );
                const chooser = page.waitForEvent("filechooser");
                await avatar.getByRole("button", { name: "Change profile photo" }).press("Enter");
                await (
                    await chooser
                ).setFiles({
                    name: "avatar.png",
                    mimeType: "image/png",
                    buffer: png,
                });
                await avatar
                    .getByRole("button", { name: "Save photo", exact: true })
                    .waitFor();
                await avatar
                    .getByRole("button", { name: "Cancel", exact: true })
                    .click();
                assert.equal(
                    await avatar
                        .getByRole("button", {
                            name: "Save photo",
                            exact: true,
                        })
                        .count(),
                    0,
                );
                scenarios++;
                const input = avatar.locator("input[type=file]");
                await input.setInputFiles({
                    name: "bad.txt",
                    mimeType: "text/plain",
                    buffer: Buffer.from("bad"),
                });
                await avatar
                    .getByRole("alert")
                    .filter({ hasText: "Choose a JPG" })
                    .waitFor();
                await input.setInputFiles({
                    name: "large.png",
                    mimeType: "image/png",
                    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
                });
                await avatar
                    .getByRole("alert")
                    .filter({ hasText: "smaller than 5 MB" })
                    .waitFor();
                scenarios++;
                await input.setInputFiles({
                    name: "avatar-fixture.png",
                    mimeType: "image/png",
                    buffer: png,
                });
                await page.route("**/api/profile/avatar", (r) => r.abort());
                await avatar
                    .getByRole("button", { name: "Save photo", exact: true })
                    .click();
                await avatar
                    .getByRole("alert")
                    .filter({ hasText: "Unable to save" })
                    .waitFor();
                await page.unroute("**/api/profile/avatar");
                const saved = page.waitForResponse(
                    (r) =>
                        r.url().endsWith("/api/profile/avatar") &&
                        r.request().method() === "PUT",
                );
                await avatar
                    .getByRole("button", { name: "Save photo", exact: true })
                    .click();
                assert.equal((await saved).status(), 200);
                await page.reload();
                await avatar.locator('img[src*="/uploads/avatars/"]').waitFor();
                assert.ok(
                    await avatar
                        .locator("img")
                        .evaluate(
                            (img) => img.complete && img.naturalWidth > 0,
                        ),
                );
                scenarios++;
                if (role === "user")
                    await page.screenshot({
                        path: "../docs/product-quality/unified-tables/clickable-profile-photo.png",
                        fullPage: true,
                    });
            }
            await context.close();
        }
        assert.deepEqual(errors, []);
        console.log(
            `PASS: ${scenarios} new control scenarios; no runtime errors`,
        );
    } finally {
        await browser.close();
    }
})().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
