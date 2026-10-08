const { chromium } = require("playwright"),
    assert = require("node:assert/strict"),
    fs = require("node:fs");
(async () => {
    const browser = await chromium.launch({
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const errors = [],
        passed = [];
    const evidence = "../docs/product-quality/input-validation";
    fs.mkdirSync(evidence, { recursive: true });
    async function account(role) {
        const c = await browser.newContext({
            viewport: { width: 1440, height: 1000 },
            reducedMotion: "reduce",
        });
        if (role) {
            const r = await c.request.post(
                "http://127.0.0.1:4200/api/auth/login",
                {
                    data: {
                        email: `${role}@dashboard.example.test`,
                        password: "DashboardTestOnly123!",
                    },
                },
            );
            assert.equal(r.status(), 200);
            await c.addInitScript(
                (s) => {
                    localStorage.setItem("token", s.token);
                    localStorage.setItem("user", JSON.stringify(s.user));
                },
                await r.json(),
            );
        }
        const p = await c.newPage();
        p.on("pageerror", (e) => errors.push(e.message));
        const writes = [];
        p.on("request", (r) => {
            if (
                ["POST", "PUT", "PATCH"].includes(r.method()) &&
                r.url().includes("/api/")
            )
                writes.push(new URL(r.url()).pathname);
        });
        return { c, p, writes };
    }
    async function noWrites(a, action, label) {
        a.writes.length = 0;
        await action();
        await a.p.waitForTimeout(150);
        assert.deepEqual(a.writes, [], label);
        passed.push(label);
    }
    function contrast(a, b) {
        const luminance = (c) => {
            const v = c
                .match(/[\d.]+/g)
                .slice(0, 3)
                .map(Number)
                .map((n) => n / 255)
                .map((n) =>
                    n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4,
                );
            return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
        };
        const x = luminance(a),
            y = luminance(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }
    try {
        const a = await account("admin");
        await a.p.goto("http://127.0.0.1:4200/admin-dashboard?tab=users");
        await a.p.locator(".detail-record-row").first().waitFor();
        await a.p
            .getByRole("button", { name: "Use dark theme", exact: true })
            .click();
        await a.p
            .getByRole("button", { name: "Filter Role", exact: true })
            .click();
        const dropdown = a.p.locator(".filter-menu");
        await dropdown.waitFor();
        const style = await dropdown.evaluate((e) => {
            const s = getComputedStyle(e);
            return { fg: s.color, bg: s.backgroundColor };
        });
        assert.ok(contrast(style.fg, style.bg) >= 4.5);
        await a.p.screenshot({
            path: evidence + "/dark-filters.png",
            clip: { x: 260, y: 280, width: 1160, height: 650 },
        });
        await a.p
            .getByRole("menuitemradio", { name: "Manager", exact: true })
            .click();
        assert.equal(await a.p.locator(".detail-record-row").count(), 1);
        passed.push("dark dropdown contrast, selection and real filtering");
        await a.p
            .getByRole("button", { name: "Filter Role", exact: true })
            .focus();
        await a.p.keyboard.press("Enter");
        await dropdown.waitFor();
        await a.p.keyboard.press("ArrowDown");
        await a.p.keyboard.press("Escape");
        assert.equal(
            await a.p
                .getByRole("button", { name: "Filter Role", exact: true })
                .evaluate((e) => e === document.activeElement),
            true,
        );
        passed.push("filter keyboard navigation and focus return");
        await a.p.goto("http://127.0.0.1:4200/admin-dashboard?tab=create");
        await a.p.locator("#editor-title").waitFor();
        await a.p.locator("#editor-title").fill("Test validation");
        await a.p
            .locator("#editor-description")
            .fill("A real validation fixture");
        await a.p.locator("#editor-category").fill("Development");
        await a.p.locator("#editor-price").fill("-10");
        await noWrites(
            a,
            () => a.p.getByRole("button", { name: /Create course/ }).click(),
            "negative course price blocked before network",
        );
        assert.equal(
            await a.p.locator("#editor-price").getAttribute("aria-invalid"),
            "true",
        );
        await a.p.locator("#editor-price").fill("1.234");
        await noWrites(
            a,
            () => a.p.getByRole("button", { name: /Create course/ }).click(),
            "excess currency precision blocked",
        );
        await a.p.locator("#editor-price").fill("10");
        await a.p.locator("#editor-title").fill("   ");
        await noWrites(
            a,
            () => a.p.getByRole("button", { name: /Create course/ }).click(),
            "whitespace course title blocked",
        );
        await a.p.locator("#editor-title").fill("Validated course");
        const courseSaved = a.p.waitForResponse(
            (r) =>
                r.url().endsWith("/api/courses") &&
                r.request().method() === "POST",
        );
        await a.p.getByRole("button", { name: /Create course/ }).click();
        assert.equal((await courseSaved).status(), 201);
        passed.push("valid course creation remains functional");
        await a.p.locator("input[name=title]").waitFor();
        await a.p.locator("input[name=title]").fill("  ");
        await noWrites(
            a,
            () =>
                a.p
                    .getByRole("button", { name: "Add lesson", exact: true })
                    .click(),
            "blank lesson title blocked",
        );
        await a.p.goto("http://127.0.0.1:4200/admin-dashboard?tab=staff");
        await a.p.locator("input[name=firstname]").fill("Staff");
        await a.p.locator("input[name=lastname]").fill("Test");
        await a.p.locator("input[name=email]").fill("broken");
        await a.p.locator("input[name=password]").fill("weak");
        await a.p.locator("input[name=birth]").fill("2099-01-01");
        await noWrites(
            a,
            () => a.p.locator("form button[type=submit]").click(),
            "staff email, password and birth date blocked",
        );
        await a.c.close();
        for (const role of ["trainer", "manager", "user"]) {
            const x = await account(role),
                url =
                    "http://127.0.0.1:4200" +
                    (role === "user" ? "/dashboard" : `/${role}-dashboard`);
            await x.p.goto(url + "?tab=profile");
            const first =
                role === "user"
                    ? x.p.locator("#first-name")
                    : x.p.getByPlaceholder("First Name", { exact: true });
            await first.waitFor();
            const save =
                role === "user"
                    ? x.p.getByRole("button", {
                          name: "Save changes",
                          exact: true,
                      })
                    : x.p.getByRole("button", {
                          name: "Save Changes",
                          exact: true,
                      });
            await first.fill("   ");
            await noWrites(
                x,
                () => save.click(),
                role + ": whitespace profile name blocked",
            );
            assert.equal(await first.getAttribute("aria-invalid"), "true");
            await first.fill(role === "user" ? "Sam" : role);
            const phone = x.p.locator('[appFieldPath="phone"]');
            await phone.fill("letters only");
            await noWrites(
                x,
                () => save.click(),
                role + ": malformed phone blocked",
            );
            await phone.fill("+216 22 123 456");
            const saved = x.p.waitForResponse(
                (r) =>
                    r.url().includes("/api/profile") &&
                    r.request().method() === "PUT",
            );
            await save.click();
            assert.equal((await saved).status(), 200);
            passed.push(role + ": corrected valid profile saved");
            await x.p
                .getByRole("button", { name: "Use dark theme", exact: true })
                .click();
            const security = x.p.getByRole("link", {
                name: "Configure my 2FA",
                exact: true,
            });
            await security.waitFor();
            const s = await security.evaluate((e) => ({
                fg: getComputedStyle(e).color,
                bg: getComputedStyle(e).backgroundColor,
            }));
            assert.ok(contrast(s.fg, s.bg) >= 4.5);
            if (role === "user")
                await security.screenshot({
                    path: evidence + "/dark-2fa-button.png",
                });
            passed.push(role + ": 2FA button dark contrast");
            await security.click();
            await x.p.waitForURL("**/account/security");
            await x.c.close();
        }

        const cv = await account("user");
        await cv.p.goto("http://127.0.0.1:4200/cv");
        await cv.p.locator("[name=cvInfo_prenom]").fill("Sam");
        await cv.p.locator("[name=cvInfo_nom]").fill("Test");
        await cv.p.locator("[name=cvInfo_email]").fill("bad");
        await noWrites(
            cv,
            () => cv.p.locator("form button[type=submit]").click(),
            "CV email blocked before network",
        );
        await cv.p.locator("[name=cvInfo_email]").fill("cv@validation.test");
        const cvSaved = cv.p.waitForResponse(
            (r) =>
                r.url().endsWith("/api/cv") && r.request().method() === "POST",
        );
        await cv.p.locator("form button[type=submit]").click();
        assert.equal((await cvSaved).status(), 200);
        passed.push("valid CV details saved");
        await cv.p.getByRole("button", { name: /Expériences/ }).click();
        await cv.p.locator("[name=newExperience_titre]").fill("Developer");
        await cv.p.locator("[name=newExperience_entreprise]").fill("Team");
        await cv.p.locator("[name=newExperience_dateDebut]").fill("2024-02-01");
        await cv.p.locator("[name=newExperience_dateFin]").fill("2024-01-01");
        await noWrites(
            cv,
            () => cv.p.locator("form button[type=submit]").click(),
            "CV reversed date range blocked",
        );
        await cv.p.locator("[name=newExperience_dateFin]").fill("2024-03-01");
        const experienceSaved = cv.p.waitForResponse(
            (r) =>
                r.url().endsWith("/api/cv/experience") &&
                r.request().method() === "POST",
        );
        await cv.p.locator("form button[type=submit]").click();
        assert.equal((await experienceSaved).status(), 200);
        passed.push("corrected CV date range saved");
        await cv.c.close();
        const anon = await account();
        await anon.p.goto("http://127.0.0.1:4200/profile-authentication");
        await anon.p.locator("input[name=email]").fill("not-email");
        await anon.p.locator("input[name=password]").fill("legacy");
        await noWrites(
            anon,
            () =>
                anon.p
                    .getByRole("button", { name: "Sign in", exact: true })
                    .click(),
            "malformed login email blocked without imposing new password strength",
        );
        await anon.p
            .locator("input[name=email]")
            .fill("legacy@validation.test");
        await anon.p.locator("input[name=password]").fill("        ");
        const legacy = anon.p.waitForResponse((r) =>
            r.url().endsWith("/api/auth/login"),
        );
        await anon.p
            .getByRole("button", { name: "Sign in", exact: true })
            .click();
        assert.equal((await legacy).status(), 400);
        passed.push(
            "legacy whitespace password is submitted to credential verification, not rejected by a new strength rule",
        );
        await anon.p
            .getByRole("button", { name: "Create an account", exact: true })
            .click();
        await anon.p.locator("input[name=firstname]").fill("   ");
        await anon.p.locator("input[name=lastname]").fill("Test");
        await anon.p.locator("input[name=email]").fill("valid@validation.test");
        await anon.p.locator("input[name=dateOfBirth]").fill("2099-01-01");
        await anon.p.locator("input[name=password]").fill("weak");
        await noWrites(
            anon,
            () =>
                anon.p.getByRole("button", { name: /^Create account/ }).click(),
            "registration name, future birth date and weak password blocked",
        );
        assert.ok((await anon.p.locator("[aria-invalid=true]").count()) >= 3);
        await anon.p.screenshot({
            path: evidence + "/registration-validation.png",
            fullPage: true,
        });
        await anon.c.close();
        assert.deepEqual(errors, []);
        console.log(passed.join("\n"));
        console.log(
            "PASS: " +
                passed.length +
                " validation/style browser scenarios; no runtime errors",
        );
    } finally {
        await browser.close();
    }
})().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
