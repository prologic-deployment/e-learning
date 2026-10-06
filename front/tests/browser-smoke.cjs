// Public UI smoke checks. No API mocks, seeded records, or fabricated authentication.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:4200/');
    await page.waitForURL('**/profile-authentication');
    await page.getByRole('heading', { name: 'Welcome back.', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^Sign in/ }).isDisabled(), true);
    await page.getByLabel('Email address', { exact: true }).fill('invalid');
    await page.getByLabel('Password', { exact: true }).fill('test');
    assert.equal(await page.getByRole('button', { name: /^Sign in/ }).isDisabled(), true);
    await page.getByRole('button', { name: 'Show password', exact: true }).click();
    assert.equal(await page.locator('#login-password').getAttribute('type'), 'text');
    await page.getByRole('button', { name: 'Hide password', exact: true }).click();
    await page.locator('#login-email').fill('');
    await page.locator('#login-password').fill('');
    await page.screenshot({
        path: '../docs/screenshots/auth-desktop.png',
        fullPage: true,
        animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Switch color theme' }).click();
    assert.equal(await page.locator('html').evaluate((e) => e.classList.contains('dark')), true);
    await page.reload();
    await page.getByRole('heading', { name: 'Welcome back.', exact: true }).waitFor();
    assert.equal(await page.locator('html').evaluate((e) => e.classList.contains('dark')), true);
    await page.screenshot({
        path: '../docs/screenshots/auth-dark.png',
        fullPage: true,
        animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Switch color theme' }).click();
    await page.getByRole('button', { name: 'Create an account', exact: true }).click();
    assert.equal(
        await page
            .getByRole('button', { name: 'Create learner account', exact: false })
            .isDisabled(),
        true,
    );
    await page.screenshot({
        path: '../docs/screenshots/register-desktop.png',
        fullPage: true,
        animations: 'disabled',
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        'mobile registration must not overflow',
    );
    await page.screenshot({
        path: '../docs/screenshots/register-mobile.png',
        fullPage: true,
        animations: 'disabled',
    });
    await page.goto('http://127.0.0.1:4200/dashboard');
    await page.waitForURL('**/profile-authentication**');
    await page.screenshot({
        path: '../docs/screenshots/auth-mobile.png',
        fullPage: true,
        animations: 'disabled',
    });
    await page.goto('http://127.0.0.1:4200/courses-grid');
    await page.getByRole('heading', { name: /Follow your curiosity/ }).waitFor();
    assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        'mobile catalogue must not overflow',
    );
    await page.screenshot({
        path: '../docs/screenshots/catalogue-mobile.png',
        fullPage: true,
        animations: 'disabled',
    });
    assert.deepEqual(errors, []);
    console.log(
        'PASS: auth rendering, invalid/empty submit guards, password visibility, dark persistence, registration, mobile overflow, protected route redirect, catalogue rendering, no runtime exceptions.',
    );
    await browser.close();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
