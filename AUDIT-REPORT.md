# E-Learning Platform — Full Audit & Repair Report

**Date:** 2026-10-06 · **Scope:** backend (Express 5 / Mongoose 9) + frontend (Angular 17) · branch `main`
**Strategy:** root-cause fixes, minimum necessary changes, no rewrites — 13 backend files modified, 1 new controller, test suite added (+186 / −20 source lines).

**Verification summary:** `workflow.e2e.test.js` **35/35** · `audit.probe.test.js` **22/22** · `security.helpers.test.js` **11/11** · Angular production build **exit 0**.

---

## A. Issues Found

| Priority | Module | Problem | Root Cause | Status |
|---|---|---|---|---|
| 🔴 | Auth | `POST /api/auth/register` → 500 `role is not defined` — public registration fully broken | `register()` destructured `role` out of scope but referenced it in the response | ✅ Fixed — literal `"user"` returned (role stays server-locked) |
| 🔴 | Lessons | `GET /api/lessons/course/:id` and `GET /api/lessons/:id` → 500 (circular Socket JSON) | `stripAnswers` exported as plain function but mounted as route middleware — it received `(req,res,next)` and `JSON.stringify(req)` | ✅ Fixed — `wrapStripAnswers` middleware wraps `res.json` and strips the key on the way out |
| 🔴 | Quizzes/Exams | **Every quiz & final-exam submission scored 0 — no learner could ever pass** | `correctAnswer` was made `select:false` in schemas (anti-leak), which also hid it from the *grading engine's own query* | ✅ Fixed — answer key re-included with `.select('+...correctAnswer')` in all 3 grading handlers; responses still never contain it |
| 🔴 | Final Exam | Trainer/admin "Save Final Exam" button 404'd — exams couldn't be created from the UI | No route `POST /api/quiz/final/:courseId` existed (only `/submit`) | ✅ Fixed — route added, `authorize('trainer','admin')` + ownership enforced in controller |
| 🔴 | Final Exam | No server-side prerequisite check — API call could take the exam at 0% progress | Eligibility existed only client-side | ✅ Fixed — 403 gate: every quiz-bearing lesson must be passed (from `lessonsCompleted`, pushed only on passing scores) |
| 🟠 | Course sheet | Exam paper (questions) exposed to anonymous/unenrolled users | `getCourseById` stripped only `correctAnswer` | ✅ Fixed — non-staff/non-enrolled receive metadata only (`questionsCount`, `noteMinimale`) |
| 🟠 | Lesson access | `GET /api/lessons/:id` mis-resolved the param as a *course* id → 404 "Course not found" | `requireCourseAccess` fell back to `req.params.id` | ✅ Fixed — `lessonIdParam` option; resolves parent course from the lesson |
| 🟠 | Missing endpoints | 4 frontend calls 404/500: `GET /purchases/me`, `PUT /profile/update`, `PUT /auth/change-password`, `GET /courses/archived` | Frontend/backend contract drift | ✅ Fixed via backend aliases; `/purchases/me` returns the raw array the dashboard expects |
| 🟠 | Purchases | `GET /purchases/me` → 500 after first wiring (undefined `Purchase` in route handler) | Inline handler referenced an unimported model | ✅ Fixed — moved to `getMyPurchasesArray` in the controller |
| 🟡 | Users | `PUT /users/:id/role` accepted any role string → role poisoning | No enum validation | ✅ Fixed — validated against `user/trainer/manager/admin` + admin self-demote/self-delete blocked |
| 🟡 | Users | `deleteUser` orphaned enrollments, purchases, reviews, certificates, cart; trainer deletion orphaned whole courses | No cascade | ✅ Fixed — full cascade; trainer deletion removes their courses + dependents |
| 🟡 | Courses | `deleteCourse` orphaned lessons, enrollments, purchases, reviews, certificates | No cascade | ✅ Fixed — cascade delete + cache invalidation (verified by E2E) |
| 🟡 | Users | `POST /users/create-trainer` had no route-level `authorize('admin')` | Guard relied on controller check only | ✅ Fixed — `authorize('admin')` added |
| 🔵 | Tests | Probes crashed on reruns (rate limit / attempt counters) | Stateful in-memory limiter; server-side attempt counters | ✅ Probe resets dev counters itself; server run with `RATE_LIMIT_LOGIN_MAX` env (default unchanged) |
| 🔵 | Courses | `/courses/archived` listing would hide archived flag (`select:false` fields) | Fields not re-selected | ✅ Handled in new archived-course controller (`.select('+isArchived +archivedAt')`) |

**Frontend audit (no code changes needed):** all routes/guards resolve; 404 page present; auth interceptor 401→logout; storefront, dashboards, viewer render — the four broken calls above were backend contract gaps, now aliased server-side.

---

## B. Routes Fixed

| Route | Fix |
|---|---|
| `POST /api/auth/register` | 500 → 201 (B1) |
| `GET /api/lessons/course/:courseId` | 500 → 200 (+ content-gate 403 when unenrolled) |
| `GET /api/lessons/:id` | 500/404 → 200 (stripAnswers wrapper + lesson-param resolution) |
| `POST /api/quiz/final/:courseId` | **new** — exam creation from trainer/admin UI (was 404) |
| `GET /api/courses/archived` | **new** — admin backoffice listing (was 404) |
| `GET /api/purchases/me` | **new** — array shape for user dashboard (was 404) |
| `PUT /api/profile/update` | **new** — alias of `PUT /api/profile` (was 404) |
| `PUT /api/auth/change-password` | **new** — alias of `POST` (was 404) |

---

## C. Features Fixed

- Public registration (role-locked to `user`).
- Lesson content delivery for enrolled learners (list + detail, answers never exposed).
- Quiz & quiz2 taking, grading, attempt limits, retry, progress updates.
- Final exam creation (trainer/admin), eligibility gating, submission, scoring, retry.
- Automatic certificate generation on exam pass (verified E2E).
- Course completion: progress = 100, `completed = true`, single source of truth server-side.
- Learner purchase history + profile update from dashboards.
- Admin archived-courses backoffice listing.
- Cascade integrity for course/user deletion.

---

## D. Workflows Fixed (all verified end-to-end)

| Workflow | Result |
|---|---|
| **Course** create → configure → publish(approve) → enrollment → deletion | ✅ `E2E Workflow Course` lifecycle incl. ownership guard (trainer2 403) |
| **Lesson** add → order → visibility → access gating → cascade removal | ✅ |
| **Quiz** create → questions/answers → attempt → server-side scoring → pass → progress | ✅ 100% scored server-side; attempt counters reset test |
| **Final exam** configure → **block until prerequisites** → unlock → pass → completion + certificate | ✅ 403 at 0% → 100% after all quizzes |
| **Enrollment** free enroll after admin approval; purchase paths paywalled | ✅ |
| **Progress** 0% → 50% after 1 of 2 quizzes → 100% + completed | ✅ |
| **Roles** user / trainer / manager / admin separation incl. cross-trainer IDOR | ✅ |

---

## E. Security Fixes

1. **Registration role lock** — response no longer crashes; role always `"user"` server-side.
2. **Answer-key hardening completed correctly** — `correctAnswer` never leaves the server (lesson list/detail, course sheet, quiz2, exam paper), while grading reads it server-side only. Verified by payload scans in both test suites.
3. **Server-side exam eligibility** — direct API calls at 0% progress get 403; the frontend lock is no longer the only gate.
4. **Exam paper no longer public** — anonymous/unenrolled users get metadata only.
5. **Content gates fixed, not bypassed** — unenrolled users blocked with 403 on lessons (previously a 500 masked it).
6. **`create-trainer` route** now has route-level `authorize('admin')` (defense-in-depth).
7. **Role enum validation** on `PUT /users/:id/role`; **admin self-demotion / self-deletion blocked**.
8. **IDOR re-verified** — trainer2 cannot edit trainer1's course (403); user cannot create courses/quizzes (403); manager cannot approve (403); bad token → 401.
9. **Cascading deletes** — no orphaned PII/records remain after user/course deletion.

---

## F. Database Fixes

| Issue | Fix |
|---|---|
| `correctAnswer` invisible to grading engine (`select:false` side effect) | Explicit `.select('+quiz.questions.correctAnswer')` in the 3 grading queries (diagnosed with a temporary probe against the local DB) |
| Orphans from `deleteCourse` | Cascade: lessons, enrollments, purchases, reviews, certificates |
| Orphans from `deleteUser` | Cascade: enrollments, purchases, reviews, certificates, cart, notifications; trainers' courses + their dependents |
| Invalid role values persisted on users | Enum whitelist before save |
| `/courses/archived` misses `select:false` flags | `.select('+isArchived +archivedAt')` |

No schema changes, no migrations, no production data touched (all runs against local dev DB `elearning_pfe`).

---

## G. Remaining Issues (not fixed, with reasons)

| Item | Why left |
|---|---|
| Prod backend (e-learning-backend.prologic.com.tn:3501) runs **older code** and its TLS cert is broken (`curl -k` needed) | Infrastructure/deployment — outside this repo's code; needs redeploy of this code + cert renewal. User instructed to ignore the cert earlier. |
| `quiz2` legacy duplicate quizzes | Kept for data compatibility (existing lessons carry quiz2 data); grading unified on one engine. Removal would require a data migration — out of "minimum changes" scope. |
| Trainers see **only their own** courses in storefront listings (`getAllCourses` trainer filter) | Pre-existing design decision; changing the browse semantics is a product call, not a defect. Flagged for owner. |
| `deleteLesson` leaves stale entries in `enrollment.lessonsCompleted/quizResults` | Harmless (completion math uses lesson list ∩ completed), noted in earlier audit; full scrub adds churn without behavior change. |
| No browser-driven UI e2e | Backend E2E covers every workflow through the same HTTP contract the Angular app uses; production build passes. UI pixel-testing left to the owner. |
| Rate limiter is in-memory | Restarts reset counts; fine for single-instance dev. Redis-backed store would be needed for multi-instance prod. |
| Commit/push | Not requested for this task — all changes left uncommitted in the working tree. |

---

## H. Testing Results

| Test | Result |
|---|---|
| USER workflow (register→enroll→lessons→quizzes→exam→completion→certificate) | **PASS** (35/35 E2E) |
| TRAINER workflow (create course→lessons→quizzes→exam→view learners/results) | **PASS** |
| MANAGER workflow (team, team-progress, stats dashboards) | **PASS** |
| ADMIN workflow (approve, role mgmt with validation, archived courses) | **PASS** |
| Course workflow | **PASS** |
| Lesson workflow | **PASS** |
| Quiz workflow | **PASS** |
| Final exam workflow | **PASS** |
| Authentication (OTP login all roles, tokenVersion, bad token 401) | **PASS** |
| Authorization (4-role matrix, IDOR, privilege escalation attempts) | **PASS** |
| Direct URL / direct API access (exam bypass, unenrolled content, answers leak) | **PASS** — blocked server-side |
| Refresh/navigation (frontend routes, guards, 404 page; prod build exit 0) | **PASS** |
| `security.helpers.test.js` | **PASS** 11/11 |
| `audit.probe.test.js` | **PASS** 22/22 |
| `workflow.e2e.test.js` | **PASS** 35/35 |
| Angular production build | **PASS** exit 0 |

### How to re-verify
```bash
cd back
DEV_EXPOSE_OTP=true RATE_LIMIT_LOGIN_MAX=100 node server.js   # terminal 1
node tests/audit.probe.test.js                                 # terminal 2 (22 checks)
node tests/workflow.e2e.test.js                                # terminal 2 (35 checks)
node tests/security.helpers.test.js                            # 11 unit tests, no server needed
cd ../front && ./node_modules/.bin/ng build --configuration production
```

**Files changed:** [auth.controller.js](back/src/controllers/auth.controller.js) · [quiz.controller.js](back/src/controllers/quiz.controller.js) · [course.controller.js](back/src/controllers/course.controller.js) · [user.controller.js](back/src/controllers/user.controller.js) · [purchase.controller.js](back/src/controllers/purchase.controller.js) · [auth.middleware.js](back/src/middlewares/auth.middleware.js) · [auth.routes.js](back/src/routes/auth.routes.js) · [quiz.routes.js](back/src/routes/quiz.routes.js) · [course.routes.js](back/src/routes/course.routes.js) · [lesson.routes.js](back/src/routes/lesson.routes.js) · [purchase.routes.js](back/src/routes/purchase.routes.js) · [profile.routes.js](back/src/routes/profile.routes.js) · [user.routes.js](back/src/routes/user.routes.js) · [archived-course.controller.js](back/src/controllers/archived-course.controller.js) (new) · tests: [workflow.e2e.test.js](back/tests/workflow.e2e.test.js), [audit.probe.test.js](back/tests/audit.probe.test.js), [helpers/e2e.js](back/tests/helpers/e2e.js)
