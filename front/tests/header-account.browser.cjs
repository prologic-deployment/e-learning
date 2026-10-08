// Real local authentication/profile API; fixtures live only in the disposable database.
const { chromium } = require("playwright"),
    assert = require("node:assert/strict"),
    fs = require("node:fs");
(async () => {
    const browser = await chromium.launch({
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const errors = [],
        checks = [];
    const evidence = "../docs/product-quality/header-account";
    fs.mkdirSync(evidence, { recursive: true });
    try {
        for (const role of ["admin", "trainer", "manager", "user"]) {
            const context = await browser.newContext({
                viewport: { width: 1440, height: 1000 },
                reducedMotion: "reduce",
            });
            const credentials = {
                email: `${role}@dashboard.example.test`,
                password: "DashboardTestOnly123!",
            };
            const response = await context.request.post(
                "http://127.0.0.1:4200/api/auth/login",
                { data: credentials },
            );
            assert.equal(response.status(), 200);
            const session = await response.json();
            assert.ok(Object.hasOwn(session.user, "avatar"));
            await context.addInitScript((s) => {
                if (!sessionStorage.getItem("header-test-seeded")) {
                    localStorage.setItem("token", s.token);
                    localStorage.setItem("user", JSON.stringify(s.user));
                    sessionStorage.setItem("header-test-seeded", "yes");
                }
            }, session);
            const page = await context.newPage();
            page.on("pageerror", (e) => errors.push(e.message));
            const base =
                "http://127.0.0.1:4200" +
                (role === "user" ? "/dashboard" : `/${role}-dashboard`);
            const trigger = page.locator(".profile-trigger"),
                menu = page.locator(".account-panel");
            const open = async () => {
                await trigger.click();
                await menu.waitFor();
            };
            const close = async () => {
                await page.keyboard.press("Escape");
                await menu.waitFor({ state: "hidden" });
            };
            await page.goto(base);
            await trigger.waitFor();
            await open();
            assert.equal(await menu.getByRole("group").count(), 3);
            assert.equal(
                await menu
                    .getByRole("menuitem", { name: "My profile", exact: true })
                    .count(),
                role === "admin" ? 0 : 1,
            );
            assert.equal(
                await menu
                    .getByRole("menuitem", {
                        name: "People & access",
                        exact: true,
                    })
                    .count(),
                role === "admin" ? 1 : 0,
            );
            assert.equal(
                await menu
                    .getByRole("menuitem", {
                        name: "Notifications",
                        exact: true,
                    })
                    .count(),
                role === "user" ? 1 : 0,
            );
            assert.ok(
                (await menu.locator(".account-copy").textContent()).includes(
                    credentials.email,
                ),
            );
            checks.push(
                `${role}: identity, grouped menu and role-appropriate destinations`,
            );
            if (role === "admin")
                await page.screenshot({
                    path: evidence + "/account-desktop.png",
                    clip: { x: 900, y: 0, width: 540, height: 850 },
                });
            await close();
            assert.equal(
                await trigger.evaluate((e) => document.activeElement === e),
                true,
            );
            await trigger.focus();
            await page.keyboard.press("Enter");
            await menu.waitFor();
            await page.keyboard.press("ArrowDown");
            assert.equal(
                await page.evaluate(() =>
                    document.activeElement.getAttribute("role"),
                ),
                "menuitem",
            );
            await close();
            checks.push(
                `${role}: keyboard opening, navigation, Escape and focus return`,
            );
            await open();
            await menu
                .getByRole("menuitem", { name: "Security & 2FA", exact: true })
                .click();
            await page.waitForURL("**/account/security");
            await menu.waitFor({ state: "hidden" });
            checks.push(
                `${role}: security route and menu closes on navigation`,
            );
            await page
                .getByRole("button", { name: "Language", exact: true })
                .click();
            await page
                .getByRole("menuitemradio", { name: "Français", exact: true })
                .click();
            await page
                .getByRole("button", {
                    name: "Ouvrir le menu du compte",
                    exact: true,
                })
                .waitFor();
            assert.equal(await page.locator("html").getAttribute("lang"), "fr");
            await open();
            await menu
                .getByRole("menuitem", { name: "Se déconnecter", exact: true })
                .waitFor();
            await close();
            await page.reload();
            await page
                .getByRole("button", { name: "Langue", exact: true })
                .waitFor();
            assert.equal(await page.locator("html").getAttribute("lang"), "fr");
            checks.push(
                `${role}: French header/menu/navigation and persisted language`,
            );
            await page
                .locator(".workspace-rail")
                .getByRole("link", {
                    name: "Sécurité et double authentification",
                    exact: true,
                })
                .waitFor();
            await page
                .getByRole("button", { name: /Rechercher une page/ })
                .click();
            await page
                .getByLabel("Rechercher dans la navigation", { exact: true })
                .fill("sécurité");
            await page
                .locator('.search-results a[href="/account/security"]')
                .waitFor();
            await page.keyboard.press("Escape");
            await page.getByRole("dialog").waitFor({ state: "hidden" });
            checks.push(
                `${role}: translated sidebar and localized navigation search`,
            );

            await open();
            await menu
                .getByRole("menuitem", {
                    name: "Activer le mode sombre",
                    exact: true,
                })
                .click();
            assert.ok(
                (await page.locator("html").getAttribute("class")).includes(
                    "dark",
                ),
            );
            await open();
            await menu
                .getByRole("menuitem", {
                    name: "Activer le mode clair",
                    exact: true,
                })
                .waitFor();
            const darkBackground = await menu.evaluate(
                (e) => getComputedStyle(e).backgroundColor,
            );
            assert.notEqual(darkBackground, "rgba(0, 0, 0, 0)");
            if (role === "admin")
                await page.screenshot({
                    path: evidence + "/account-dark-french.png",
                    clip: { x: 900, y: 0, width: 540, height: 850 },
                });
            await menu
                .getByRole("menuitem", {
                    name: "Activer le mode clair",
                    exact: true,
                })
                .click();
            checks.push(`${role}: working appearance control and dark menu`);
            await page.setViewportSize({ width: 320, height: 740 });
            await open();
            // CDK repositions connected overlays asynchronously after viewport resize.
            await page.waitForFunction(() => {
                const r = document.querySelector('.account-panel')?.getBoundingClientRect();
                return r && r.x >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
            }, undefined, {timeout: 5000});
            const rect = await menu.boundingBox();
            assert.ok(
                rect.x >= 0 &&
                    rect.x + rect.width <= 321 &&
                    rect.y + rect.height <= 741,
            );
            assert.ok(
                await page.evaluate(
                    () =>
                        document.documentElement.scrollWidth <= innerWidth + 2,
                ),
            );
            await menu
                .getByRole("menuitem", { name: "Se déconnecter", exact: true })
                .scrollIntoViewIfNeeded();
            if (role === "user")
                await page.screenshot({
                    path: evidence + "/account-mobile-french.png",
                });
            await close();
            await page.setViewportSize({ width: 1440, height: 1000 });
            checks.push(`${role}: 320px menu bounds and accessible scrolling`);
            await page
                .getByRole("button", { name: "Langue", exact: true })
                .click();
            await page
                .getByRole("menuitemradio", { name: "English", exact: true })
                .click();
            if (role !== "admin") {
                await open();
                await menu
                    .getByRole("menuitem", { name: "My profile", exact: true })
                    .click();
                await page.waitForURL("**?tab=profile");
                const editor = page.locator("app-avatar-picker");
                await editor.waitFor();
                await page.waitForFunction(() =>
                    document.querySelector("app-avatar-picker .photo-button"),
                );
                const input = editor.locator("input[type=file]"),
                    png = Buffer.from(
                        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6k0AAAAASUVORK5CYII=",
                        "base64",
                    );
                const old = await trigger
                    .locator("img")
                    .evaluateAll(
                        (imgs) => imgs[0]?.getAttribute("src") || null,
                    );
                await input.setInputFiles({
                    name: "header-sync.png",
                    mimeType: "image/png",
                    buffer: png,
                });
                await editor
                    .getByRole("button", { name: "Cancel", exact: true })
                    .click();
                assert.equal(
                    await trigger
                        .locator("img")
                        .evaluateAll(
                            (imgs) => imgs[0]?.getAttribute("src") || null,
                        ),
                    old,
                );
                await input.setInputFiles({
                    name: "header-sync.png",
                    mimeType: "image/png",
                    buffer: png,
                });
                await page.route("**/api/profile/avatar", (r) => r.abort());
                await editor
                    .getByRole("button", { name: "Save photo", exact: true })
                    .click();
                await editor
                    .getByRole("alert")
                    .filter({ hasText: "Unable to save" })
                    .waitFor();
                assert.equal(
                    await trigger
                        .locator("img")
                        .evaluateAll(
                            (imgs) => imgs[0]?.getAttribute("src") || null,
                        ),
                    old,
                );
                await page.unroute("**/api/profile/avatar");
                const saved = page.waitForResponse(
                    (r) =>
                        r.url().endsWith("/api/profile/avatar") &&
                        r.request().method() === "PUT",
                );
                await editor
                    .getByRole("button", { name: "Save photo", exact: true })
                    .click();
                const upload = await saved;
                assert.equal(upload.status(), 200);
                const photo = (await upload.json()).user.avatar;
                await page.waitForFunction(
                    (p) =>
                        document
                            .querySelector(".profile-trigger img")
                            ?.getAttribute("src") === p,
                    photo,
                );
                await open();
                assert.equal(
                    await menu.locator("img").getAttribute("src"),
                    photo,
                );
                await close();
                assert.equal(
                    await page.evaluate(
                        () => JSON.parse(localStorage.getItem("user")).avatar,
                    ),
                    photo,
                );
                assert.equal(
                    await page.evaluate(
                        () => JSON.parse(localStorage.getItem("user")).role,
                    ),
                    role,
                );
                await page.reload();
                await trigger.locator(`img[src="${photo}"]`).waitFor();
                const again = await context.request.post(
                    "http://127.0.0.1:4200/api/auth/login",
                    { data: credentials },
                );
                assert.equal((await again.json()).user.avatar, photo);
                checks.push(
                    `${role}: cancel/failure isolation; saved photo synchronizes immediately, persists and survives new login`,
                );
                const firstName =
                    role === "user"
                        ? page.locator("#first-name")
                        : page.getByPlaceholder("First Name", { exact: true });
                await firstName.fill("Updated");
                const saveName =
                    role === "user"
                        ? page.getByRole("button", {
                              name: "Save changes",
                              exact: true,
                          })
                        : page
                              .getByRole("button", {
                                  name: /Save Changes|Save changes|Update Profile|Update profile/,
                              })
                              .first();
                await saveName.click();
                await page.waitForFunction(
                    () =>
                        document
                            .querySelector(".profile-trigger .profile-name")
                            ?.textContent?.trim() === "Updated",
                );
                await open();
                assert.ok(
                    (
                        await menu.locator(".account-copy strong").textContent()
                    ).includes("Updated"),
                );
                await close();
                checks.push(
                    `${role}: profile name updates in the header and dropdown`,
                );
                await page.route("**" + photo, (r) => r.abort());
                await page.reload();
                await page.waitForFunction(
                    () =>
                        !!document.querySelector(
                            ".profile-trigger app-profile-avatar span",
                        ),
                );
                assert.equal(await trigger.locator("img").count(), 0);
                await page.unroute("**" + photo);
                checks.push(
                    `${role}: failed image falls back to real initials`,
                );
            }
            await open();
            await menu
                .getByRole("menuitem", { name: "Sign out", exact: true })
                .click();
            await page.waitForURL("**/profile-authentication");
            assert.equal(
                await page.evaluate(() => localStorage.getItem("token")),
                null,
            );
            assert.equal(
                await page.evaluate(() => localStorage.getItem("user")),
                null,
            );
            checks.push(
                `${role}: real logout clears session and routes to sign-in`,
            );
            await context.close();
        }
        assert.deepEqual(errors, []);
        console.log(checks.join("\n"));
        console.log(
            `PASS: ${checks.length} header scenarios; no page runtime errors`,
        );
    } finally {
        await browser.close();
    }
})().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
