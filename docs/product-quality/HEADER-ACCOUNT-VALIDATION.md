# Header account menu and profile synchronization

## Integrated changes
- Saved avatars and profile names update `AuthService.currentUser$` immediately and persist in the existing session-user storage. Header trigger and dropdown identity use the same reusable `ProfileAvatarComponent`, including image-error initials fallback. Preview/cancel/upload failure never publish an unsaved photo.
- The shared backend session DTO now includes the saved avatar for fresh sign-ins and completed factor verification; no extra header profile fetch is required. Session/TOTP rules are unchanged.
- Profile summary merges are restricted to display fields and require the same account ID. Late responses after logout or account switching cannot resurrect a session or replace role/token claims.
- The account menu uses the actual Spartan/CDK menu primitives, with identity, role badge, Your account, Your workspace, Preferences & help, and sign-out sections. Profile, security, role-aware shortcuts, theme switching, contact and logout route to existing working destinations. Admin is not given a link to a nonexistent profile editor.
- The existing English/French language switcher is now in the workspace header. Header, account menu, sidebar and navigation search use the shared translation service and persisted preference. API/user content is not translated; this does not claim full translation of every legacy dashboard form.
- Menu includes keyboard navigation, Escape/focus return, decorative-icon hiding, dark/light palettes, mobile width/height limits and scrollable content. Fixed a security-page badge wrapping issue exposed by navigation at 320px.
- No fake counts, new placeholder destinations or demo data in application components.

## Actual validation
Final development build: `f0c1ab18a041652b`, with one Angular worker and a 768 MB Node heap. Build passes with the existing CommonJS optimization warnings. Production optimization was not rerun in this pass; no new optimized-production-build or deployment claim.

- **41 header browser scenarios passed** against the disposable real Express/Mongo fixture: all four roles, grouped/authorized menu content, keyboard opening/navigation/Escape/focus, security route/menu close, persisted French/English choice, translated sidebar/search, theme actions, 320px bounds/scrolling, logout; plus preview cancellation, failed upload/retry, immediate header and menu photo update, reload and fresh-login persistence, profile name updates, and broken-image fallback in all three existing profile editors.
- **19 detail browser regressions passed**: scoped/lazy dialogs, row actions, evidence, exports, request deduplication, focus and retry.
- **13 table/avatar browser regressions passed**: filters, pagination, archive actions and real uploads. The keyboard chooser test now waits for the profile response and presses Enter on the locator instead of relying on a focus/delay race.
- **11 frontend Node tests passed**: four profile-summary/URL tests plus existing table, socket lifecycle and real proxy tests.
- **17 backend tests passed** from `security.helpers.test.js` and `totp.integration.test.js` after adding avatar to the session DTO.
- No page runtime errors in the passing browser suites. No production database or physical-device testing; Chromium at desktop and mobile viewport sizes only.

## Reproduction
Run `npm ci` in `front/` and `back/`. From `front/`, build with:

```
NG_BUILD_MAX_WORKERS=1 NODE_OPTIONS=--max-old-space-size=768 npm run build -- --configuration development
```

Build before starting the memory-server fixture on constrained machines. Start `node tests/dashboard-browser-api.cjs` in `back/`, then `node tests/serve-dashboard.cjs` in `front/`. In `front/`, run:

```
npm run test:details:browser
npm run test:controls:browser
npm run test:header:browser
node --test tests/profile-summary.cjs tests/table-derivations.cjs tests/socket-lifecycle.cjs tests/proxy-socket.integration.cjs
```

The browser suites modify only disposable fixture records. Restart the fixture before repeating the full sequence. The header test waits for CDK overlay repositioning after resize rather than asserting transient coordinates. Screenshots in `header-account/` use fixture accounts, not production users.

Backend validation from `back/`:

```
node --test --test-concurrency=1 tests/security.helpers.test.js tests/totp.integration.test.js
```

The synchronization feature was committed and normally pushed as `15837ae`. The menu, translations, integration fixes, tests and evidence form the next logical commit on `v1.0`; `main` is untouched.
