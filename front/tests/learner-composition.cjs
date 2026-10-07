const { chromium } = require("playwright"),
    assert = require("node:assert/strict");
(async () => {
    const b = await chromium.launch({ args: ["--no-sandbox"] });
    try {
        const p = await b.newPage({
            viewport: { width: 1440, height: 1000 },
            reducedMotion: "reduce",
        });
        let mode = "error",
            cartItems = [
                {
                    price: 49,
                    course: {
                        _id: "test-course",
                        title: "UI fixture course",
                        description: "Test-only course response",
                        category: "Design",
                    },
                },
            ],
            writes = [];
        const errors = [];
        p.on("pageerror", (e) => errors.push(e.message));
        await p.route("**/api/**", (r) => {
            let u = new URL(r.request().url()),
                method = r.request().method();
            if (method !== "GET")
                writes.push({ path: u.pathname, body: r.request().postData() });
            if (mode === "error")
                return r.fulfill({
                    status: 503,
                    json: { message: "Test failure" },
                });
            if (u.pathname === "/api/cart/clear") {
                cartItems = [];
                return r.fulfill({ json: {} });
            }
            if (u.pathname === "/api/cart")
                return r.fulfill({
                    json: {
                        items: cartItems,
                        totalPrice: cartItems.length ? 49 : 0,
                    },
                });
            if (u.pathname === "/api/cv/me")
                return r.fulfill({
                    json: {
                        nom: "Fixture",
                        prenom: "Test",
                        email: "test@example.com",
                        experiences: [],
                        formations: [],
                        competences: [],
                        langues: [],
                        hobbies: [],
                    },
                });
            if (u.pathname.startsWith("/api/cv"))
                return r.fulfill({ json: { message: "Saved" } });
            if (u.pathname === "/api/recommendations")
                return r.fulfill({
                    json: {
                        user_profile: { skills: ["Test skill"] },
                        recommendations: [
                            {
                                _id: "test-course",
                                title: "UI fixture recommendation",
                                price: 0,
                                category: "Design",
                                trainer: "Test trainer",
                                scores: {
                                    hybrid_score: 0.8,
                                    cv_score: 0.7,
                                    category_score: 0.9,
                                    popularity_score: 0.6,
                                },
                            },
                        ],
                    },
                });
            return r.fulfill({
                status: 503,
                json: { message: "Other API failure" },
            });
        });
        await p.goto("http://127.0.0.1:4200/");
        await p.evaluate(() => {
            localStorage.setItem("token", "test-only");
            localStorage.setItem(
                "user",
                JSON.stringify({
                    role: "user",
                    firstname: "Test",
                    id: "test-user",
                }),
            );
        });
        await p.goto("http://127.0.0.1:4200/cart");
        await p
            .getByRole("alert")
            .filter({ hasText: "Your cart could not be loaded" })
            .waitFor();
        assert.equal(
            await p
                .getByRole("heading", { name: "Make room for something new." })
                .count(),
            0,
        );
        mode = "loaded";
        await p.getByRole("button", { name: "Try again" }).click();
        await p.getByRole("heading", { name: "UI fixture course" }).waitFor();
        assert.equal(await p.locator('a[href="/checkout"]').count(), 0);
        assert.ok(
            await p
                .getByText("Online payment is not available", { exact: false })
                .isVisible(),
        );
        await p.getByRole("button", { name: "Clear cart" }).click();
        await p
            .getByRole("heading", { name: "Make room for something new." })
            .waitFor();
        assert.ok(writes.some((w) => w.path === "/api/cart/clear"));
        mode = "error";
        await p.goto("http://127.0.0.1:4200/recommendations");
        await p
            .getByRole("alert")
            .filter({ hasText: "Your recommendations" })
            .waitFor();
        assert.equal(
            await p
                .getByRole("heading", { name: "A fresh starting point." })
                .count(),
            0,
        );
        mode = "loaded";
        await p.getByRole("button", { name: "Try again" }).click();
        await p
            .getByRole("heading", { name: "UI fixture recommendation" })
            .waitFor();
        await p.getByText("Why this recommendation?").click();
        await p.getByText("CV skill match", { exact: true }).waitFor();
        await p.getByText("70%", { exact: true }).waitFor();
        await p.goto("http://127.0.0.1:4200/cv");
        await p.getByLabel("Prénom", { exact: false }).waitFor();
        await p.getByLabel("Prénom", { exact: false }).fill("");
        let before = writes.length;
        await p.getByRole("button", { name: "Sauvegarder" }).click();
        await p.getByText("Prénom is required.", { exact: true }).waitFor();
        assert.equal(writes.length, before);
        await p.getByLabel("Prénom", { exact: false }).fill("Changed test");
        await p.getByRole("button", { name: "Sauvegarder" }).click();
        await p
            .getByRole("status")
            .filter({ hasText: "CV info saved" })
            .waitFor();
        assert.ok(
            writes.some(
                (w) => w.path === "/api/cv" && w.body.includes("Changed test"),
            ),
        );
        for (let label of [
            "Expériences",
            "Formation",
            "Compétences",
            "Langues",
            "Centres d’intérêt",
        ]) {
            let actual = label.replace("’", "'");
            await p
                .locator(".cv-sections")
                .getByRole("button", { name: actual, exact: false })
                .click();
            assert.equal(await p.locator("form").count(), 1);
            await p.locator('form button[type="submit"]').click();
            assert.ok(
                (await p.locator(".field-error").count()) > 0,
                label + " required validation",
            );
        }
        for (let path of [
            "/cart",
            "/cv",
            "/recommendations",
            "/account/security",
        ]) {
            await p.goto("http://127.0.0.1:4200" + path);
            await p.locator("app-page-heading h1").waitFor();
            for (let width of [320, 390, 768, 1440]) {
                await p.setViewportSize({ width, height: 1000 });
                await p
                    .waitForFunction(
                        () =>
                            document.documentElement.scrollWidth <= innerWidth,
                        {},
                        { timeout: 2500 },
                    )
                    .catch(async (e) => {
                        console.log(
                            path,
                            width,
                            await p.evaluate(() =>
                                [...document.querySelectorAll("body *")]
                                    .filter(
                                        (e) =>
                                            e.getBoundingClientRect().right >
                                            innerWidth + 1,
                                    )
                                    .map((e) => ({
                                        tag: e.tagName,
                                        cls: e.className,
                                        width: e.getBoundingClientRect().width,
                                        right: e.getBoundingClientRect().right,
                                    }))
                                    .slice(0, 15),
                            ),
                        );
                        throw e;
                    });
            }
            await p.getByRole("button", { name: "Use dark theme" }).click();
            assert.equal(
                await p
                    .locator("html")
                    .evaluate((e) => e.classList.contains("dark")),
                true,
            );
            await p.getByRole("button", { name: "Use light theme" }).click();
            if (path === "/cv")
                await p.screenshot({
                    path: "../docs/product-quality/cv-workspace.png",
                    fullPage: true,
                });
        }
        assert.deepEqual(errors, []);
        console.log(
            "PASS learner compositions: cart failure/empty/clear API, honest checkout state; recommendation failure/retry/scores; all six CV forms labelled and validated, multipart save contract; 320–1440px, light/dark and security heading. Controlled fixtures; no live payments/profile changes.",
        );
    } finally {
        await b.close();
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
