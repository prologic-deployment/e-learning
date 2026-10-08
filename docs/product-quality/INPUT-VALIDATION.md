# Input validation and dark controls

## Delivered on v1.0

### Controls and appearance
- The Configure/Manage 2FA action has explicit theme-token foreground/background, hover and keyboard-focus treatment.
- Shared table filtering, sorting and page size use a real Spartan/CDK menu-radio component, not a restyled native popup. Selection, keyboard navigation, focus return and scrolling are retained.
- Native form selects use the active theme palette.

### Input protection
- `front/src/app/validation/input-policy.ts` is the canonical, framework-free contract. `npm run validation:sync` generates the committed Node implementation; `npm run validation:check` detects drift.
- Shared Angular validators support template and reactive input/textarea/select controls. Explicit rules and field paths cover active auth, profile, staff, security, course, lesson, assessment, CV, contact, review, assignment and chat forms. Local search fields are capped at 100 characters.
- Inline feedback, touched/submitted state, `aria-invalid`, described error text, password confirmation and CV date ordering are integrated with the existing FormField primitive.
- A capture-phase form guard marks invalid controls touched, focuses the first invalid control and prevents submission.
- An API interceptor also checks click-based saves and multipart metadata before forwarding requests. Invalid input produces a local `CLIENT_VALIDATION` response; it does not send the request. Server field errors are mapped back to controls.
- Backend write controllers apply the generated contract after existing authentication/authorization middleware and before writes. Bypassing JavaScript therefore does not bypass validation. Existing ownership, enrollment, locked-assessment and scoring rules remain authoritative.

## Rules and compatibility

| Area | Checks |
|---|---|
| Names/text | Required values, whitespace-only required fields, string types, bounded lengths |
| Credentials | Email syntax; existing new-password requirements; confirmation matching |
| Existing passwords | Opaque values, no new strength requirement or whitespace trimming; existing 72-byte backend ceiling retained |
| Dates | Calendar validity, no future birth dates, no past assignment deadlines, CV end date not before start |
| Numbers | Finite decimal values, price bounds/precision, rating integers, assessment bounds and native min/max/step |
| Selections | Allowed role/skill/language/question choices; valid Mongo record IDs |
| Collections | Tag count/length/uniqueness, nested CV sections, assessment question/option/answer structure |
| Chat | Existing user/model alternating history, message/history size limits and supported language values |
| Uploads | Image extension/MIME/size and PNG/JPEG/WebP signature checks; allowed lesson file metadata; rejected uploaded images removed |
| Request size | JSON-form data limited to 1 MB before forwarding |

Images are limited to 5 MB; lesson files retain the 100 MB limit. Malformed multipart and oversized uploads return 400 rather than an unexpected server error.

Optional phone/address/description/contact subject and open-ended CV dates remain optional. File-only lessons and uncategorized legacy courses are supported. Saving CV personal details no longer clears sections omitted from the request.

**Security exception:** factor verification, setup confirmation and disabling retain their existing in-controller proof validation **after** challenge/account attempt accounting. An early generic factor wrapper was found to bypass attempt consumption, removed, and the TOTP regression suites rerun successfully. No password, code, token or secret is added to production logs; old profile upload debug logging was removed.

## Verification on the final implementation

- Development Angular build: **passed**, hash `51b8139660a44c34`.
- Generated policy drift check: **passed**.
- Backend regression run: **60 tests passed**. Includes dashboard detail/performance, assessment authoring, staff, progress, security helpers, TOTP/all-role TOTP, chat and the new validation suite.
- New backend validation suite: **10 tests passed**, including real HTTP failures/valid writes, upload rejection and cleanup, CV section preservation and successful legacy whitespace-password verification.
- Frontend Node tests: **11 passed** (socket/proxy lifecycle, table derivations and profile summary).
- Chromium browser scenarios: **100 passed** with no page runtime errors: dashboard details 19, controls 13, header/account 41, new validation/style 27.
- New browser coverage checks zero outgoing write requests for invalid profile/auth/staff/course/lesson/CV data, corrected valid profile/course/CV saves, dark dropdown/action contrast of at least 4.5:1, actual filtering and keyboard focus return.
- Existing browser regressions include mobile layouts and the 320px account menu. No physical-device or cross-engine claim.

One concurrent test run exhausted sandbox resources (fixture exit 137 / browser crash). The test workloads were then run serially, with a fresh disposable API fixture, and passed without increasing application timeouts.

### Reproduce

Install dependencies in `front` and `back`, then:

```sh
cd front
npm run validation:check
NG_BUILD_MAX_WORKERS=1 NODE_OPTIONS=--max-old-space-size=768 npm run build -- --configuration development
node --test tests/socket-lifecycle.cjs tests/proxy-socket.integration.cjs tests/table-derivations.cjs tests/profile-summary.cjs

cd ../back
npm run test:validation
node --test --test-concurrency=1 tests/dashboard-details.integration.test.cjs tests/dashboard-performance.integration.test.cjs tests/assessment-authoring.integration.test.cjs tests/staff.integration.test.cjs tests/learning-progress.test.js tests/security.helpers.test.js tests/totp.integration.test.js tests/totp-all-roles.integration.test.cjs tests/chatbot.integration.test.cjs tests/input-validation.integration.test.cjs
```

For browser coverage, install Playwright Chromium, start `back/tests/dashboard-browser-api.cjs` from `back`, wait for its ready message, and start `front/tests/serve-dashboard.cjs` from `front`. These are disposable test fixtures, not production data or deployment servers. Then, from `front`, run sequentially:

```sh
node tests/dashboard-details.browser.cjs
node tests/dashboard-controls.browser.cjs
node tests/header-account.browser.cjs
node tests/input-validation.browser.cjs
```

Restart the fixture before repeating the suite: tests intentionally change disposable records.

## Evidence and limits

Screenshots are in `docs/product-quality/input-validation/`: dark filters, dark 2FA button and registration field feedback. They contain test-fixture records only.

This is input validation, not a claim that arbitrary malicious HTTP traffic can be prevented from reaching a server. Image signatures are not full image decoding or malware scanning. Server business-state checks remain necessary even for well-formed client input. Production optimization and legacy Karma tests were not verified; the development build retains existing CommonJS dependency warnings.
