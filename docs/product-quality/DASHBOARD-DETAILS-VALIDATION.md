# Dashboard performance and record details

## Scope and architecture

Audited against published `v1.0` commit `9cc6e52` before implementation; see
[DASHBOARD-DETAILS-AUDIT.md](DASHBOARD-DETAILS-AUDIT.md). No main-branch changes.

One application-level `RecordDetailComponent` uses the existing real Spartan dialog,
CDK focus management, cards, badges, buttons and skeleton components. `DetailRowDirective`
provides click/Enter/Space access while retaining table semantics and ignoring buttons,
links, inputs, selects, labels and action cells. Related-record navigation supports Back.
The dialog cancels its client subscription on close/replacement/navigation, never caches
private responses, and provides immediate loading, error/retry and unavailable states.
There is no per-row detail prefetch and no static/demo data in the application.

Covered entity tables:

| Area | Detail target |
| --- | --- |
| Shared people/staff table | Account and authorized enrollments, courses taught or team |
| Shared course library | Course, instructor, curriculum, assessment metadata, scoped enrollments |
| Admin operations table | Popular course |
| Trainer operations table | Owned course |
| Manager operations table | Team member |
| Admin archive | Archived course |
| Admin assignment roster | Account |
| Admin review moderation | Review and related course/reviewer |
| Admin/trainer assessment results | Saved assessment result and permitted answer review |
| Manager overdue table | Enrollment and results |
| Learner history | Own enrollment and results |

Lesson details are available through curriculum/result relationships. Categories and
question/lesson authoring use cards/editors rather than data tables. The un-routed legacy
product specification table is presentation, not a backend entity table.

Existing CRUD handlers, filters and exports remain in place. Previously unbounded native
table rendering now uses 20-row pages; shared tables retain their existing pagination.
Existing list APIs still return complete **summary** lists for current export behavior;
they are not newly server-paginated. Dialog relationship lists are server-paginated, 20
items per section, with totals and independent page parameters. Large-list network
pagination beyond these detail relationships remains a possible future improvement.

## Measured performance

The regression test executes baseline controller fixtures copied verbatim from `9cc6e52`
and the new controllers against the same disposable MongoDB dataset. It counts MongoDB
driver `find`/`aggregate`/`count`/`distinct` commands, including populate queries. Counts
exclude the common HTTP authentication middleware. These are query-count measurements,
**not claims about production response times**.

| Operation | Before | After |
| --- | ---: | ---: |
| Trainer statistics, 2 courses | 6 | 3 |
| Trainer statistics, 25 courses | 52 | 3 |
| Admin statistics | 14 | 5 |
| Manager statistics | 7 | 3 |
| Team progress, 8 members | 17 | 3 |

Trainer business metrics, admin overview/monthly counts, manager overview/member/overdue
metrics and the team-progress response were compared with the baseline. Trainer aggregation
replaces per-course reads; admin facets/parallel operations share scans; manager data is
queried once and grouped rather than repeatedly filtered and populated.

Browser-observed request checks:
- No detail request before a row is opened; one detail request for the initial open.
- Direct admin assignment load requests the user list once; managers are derived locally.
- Direct non-stat admin tabs do not fetch unrelated statistics.
- Learner overview: zero unused profile requests, one enrollment request.
- Learner notifications tab: one notification request.

Course/archive list responses now project table metadata, not complete assessment papers
or enrollment arrays. Shared table filtering/sorting and staff/result filtering reuse
component-local derived values. The shared tables use OnPush; this is not an authenticated
HTTP cache. Learner overlapping reads are shared only while in flight, within that
component's lifetime, and are discarded on completion/error/destruction.

## Assessment evidence and permissions

New lesson, legacy quiz2 and final-exam submissions retain immutable, server-generated
answer-review evidence using the same exact-set/weighted grading helper. Evidence records
live in the private `AssessmentReview` collection; enrollments hold only hidden references.
This avoids growing a curriculum's enrollment document toward MongoDB's 16 MB limit.
Existing course/user deletion cascades remove this evidence; the fresh seeder discovers
models dynamically and also clears it.

The review includes question text/type, the submitted and correct answer labels,
correct/incorrect/unanswered states, earned/possible points, passing score, attempt
metadata, and genuinely recorded timed duration. Explanations render only when saved in
the evidence; the existing question schema does not currently author explanations.
Untimed duration is not invented. Result metadata includes available student/email,
course/description, lesson, date, percentage, status and question counts.

The UI lists the latest saved result per assessment, not a complete attempt history.
Summary-only historical records explicitly show that answer-level evidence is unavailable.
Older timed evidence is recovered only from a finished attempt with matching identity,
assessment, attempt number, score/pass state and close completion timestamp, a complete
answer key, and a recomputed score matching the saved result. Current, edited questions
are never substituted for historical evidence. Ungraded/null result stubs are not listed.

Authorization for `GET /api/details/:kind/:id`:
- Admin: authorized account/course/enrollment/review/result records.
- Trainer: private enrollment/result information only for owned courses; related people
  only when they have an enrollment in those courses. Public course metadata remains public.
- Manager: private people/enrollment/result summaries restricted to the manager's team.
- Learner: own people/enrollment/result summaries only.
- Full answer reviews/keys: admin or the course's trainer only, preserving the existing
  learner/manager answer-key policy. No active-attempt review is exposed.
- Lesson content follows existing course access; archived/draft history is metadata-only
  for non-staff. Related lists are scoped before paging.

DTOs use explicit fields, never raw user serialization. No password, TOTP secret, recovery
code, session token or private upload path is included. Detail responses are `no-store`;
malformed references return 400 and missing/out-of-scope records return 404.

## Validation results

- Backend regression: **53 tests passed** across dashboard details/performance,
  assessment authoring/timed attempts, staff permissions, progress/security helpers,
  TOTP/configuration, startup and seeder tests.
- Final targeted dashboard/assessment run: **12/12 passed** (included above; not 12
  additional unique tests).
- Frontend derived-table and socket/proxy checks: **6/6 passed**.
- Browser: **19 scenarios passed**, both development and production builds. Chromium,
  desktop 1440×1000 and mobile emulation 390×844; no browser runtime errors.
- Browser checks cover every listed dashboard table context, on-demand requests,
  action isolation, search/sort/pagination, focus restoration/trapping, Escape/Enter,
  loading, closing a pending request, network failure/retry, immutable answer cards,
  historical empty states, related-record paging/drill-in/Back, manager date-input
  isolation, full-data trainer/manager Excel exports, and request counts above.
- Production build succeeded: hash `50135abdf4f14d5b`, initial bundle **2.55 MB**,
  estimated transfer **538.78 kB**. No bundle-size reduction is claimed.
- `git diff --check` passed.

Production-build browser tests proxy the deployment-configured API/WebSocket URLs into
the disposable local API. They do not contact or modify the production deployment.
Screenshots under `docs/screenshots/dashboard-details/` contain test-fixture records only.

Warnings/limits:
- Existing CommonJS optimization warnings remain (primarily jsPDF/canvg dependencies).
- The first high-memory build was killed by the sandbox. A one-worker/768 MB heap build
  succeeded. The final production build took 207 seconds; the original timed-out command
  was allowed to finish and was verified, not started a second time.
- `npm test -- --watch=false --browsers=ChromeHeadless` cannot initialize because
  `front/tsconfig.spec.json` is missing, also absent at the baseline commit. The legacy
  Karma suite is not reported as passing. No lint target/script is configured.
- Chromium mobile emulation is not a physical-device, Safari, Firefox or native-Windows
  test. Production database latency and deployment configuration were not measured.

## Reproduce

From `back`:

```sh
npm ci
npm run test:dashboards
node --test --test-concurrency=1 tests/dashboard-details.integration.test.cjs tests/dashboard-performance.integration.test.cjs tests/assessment-authoring.integration.test.cjs tests/staff.integration.test.cjs tests/learning-progress.test.js tests/security.helpers.test.js tests/totp.integration.test.js tests/totp-all-roles.integration.test.cjs tests/totp-configuration.test.cjs tests/startup.test.cjs tests/seeder.integration.test.cjs
```

From `front`:

```sh
npm ci
npm run test:tables
npm run test:socket
npm run build -- --configuration production
```

For a memory-constrained build, set `NG_BUILD_MAX_WORKERS=1` and
`NODE_OPTIONS=--max-old-space-size=768` in the current shell. In PowerShell use
`$env:NG_BUILD_MAX_WORKERS='1'` and `$env:NODE_OPTIONS='--max-old-space-size=768'`.

Browser fixture (isolated MongoDB; never point the harness at an existing database):
1. In `back`, run `npm run test:dashboard-api` and wait for the ready message.
2. In `front`, install Chromium with `npx playwright install chromium`; Linux may also
   require `npx playwright install-deps chromium`.
3. Build with `npm run build -- --configuration development`, then run `npm run preview`.
4. In another `front` terminal, run `npm run test:details:browser`.
5. To test the production build instead, build production and set
   `DASHBOARD_PRODUCTION_BUILD=1` for the browser-test process. The harness forwards actual
   local API responses; it does not fabricate records or statistics.
6. Stop both fixture processes when finished. No fixture runs in normal application startup.

Supporting indexes are declared on Enrollment (course/user + creation time), Course
(trainer), Lesson (course/order), User (manager/role), and Purchase (course/payment status).
For deployments with automatic index creation disabled, provision the declared indexes
with `Model.createIndexes()` during an appropriate maintenance window. Do not use
`syncIndexes()` to drop unrelated production indexes. No historical-answer backfill or
production database migration was executed.
