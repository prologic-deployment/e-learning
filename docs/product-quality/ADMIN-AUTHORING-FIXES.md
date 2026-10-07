# Administration and authoring workflow fixes

## Feature 1 — dialogs, staff creation, shared feedback, contextual actions
- A single record-table confirmation dialog now lives outside rows/loading state. Cancel,
  X, Escape, confirmation and failure are browser-tested; dialog destruction tears down
  its overlay/timer. Close buttons have explicit non-submit semantics.
- Added one root ToastService/outlet, with semantic line icons, light/dark tokens,
  dismissal, bounded queue, live announcements and hover/focus pause. Socket messages
  use it. Existing page success bindings migrate through a shared feedback directive;
  field validation and persistent load failures stay inline rather than disappearing.
- Staff form now validates fields, calls an admin-only `/users/staff` endpoint respecting
  the selected manager/trainer/admin role, clears the form, opens a staff-only list and
  refreshes users after creation. No password is returned or emailed by this endpoint.
  Previously every selection called a manager-only endpoint.
- Header actions are contextual. Course library creates courses; staff actions appear
  only in people/staff views. Admin library uses the reusable themed record table and
  authenticated staff-course endpoint, retaining edit/publish/archive/delete actions.

PASS: Angular development build; admin-actions browser suite (controlled API contracts);
real isolated-Mongo staff integration test (unauthenticated/non-admin denial, all three
roles, duplicates, invalid roles, no password disclosure). No production mutations.

## Feature 2 — authoritative assessment rules and timing
- Shared validated question schema supports single response, exact-set multiple response,
  weighted points and optional 10–600 second per-question deadlines. New/saved quizzes
  and exams require 20–200 valid questions, distinct options, valid keys and bounded
  pass/attempt settings. Existing shorter assessments remain readable/playable.
- Lesson quiz POST is create-only and atomic; PUT edits the existing quiz. New quiz2
  creation is rejected. Legacy quiz2 remains readable/deletable, not silently destroyed.
  Final exam authoring requires lessons with one complete 20-question quiz each.
- Timed attempts are persisted, reserve a bounded attempt at start, resume without
  resetting deadlines, reject stale/duplicate answers, and grade expired answers as
  unanswered. The server supplies timestamps; direct timed-submit bypass is blocked.
  Snapshot grading retains the assessment as it existed when the attempt began.
- Author-only reads include both answer-key formats; learner responses recursively
  strip both. Fixed the response wrapper previously ignoring its sanitizer's return.
  Course tags accept an array as well as the old comma-separated payload.

PASS: real isolated MongoDB integration tests for ownership denial, min questions,
create/update semantics, concurrent single-quiz creation, legacy second-quiz rejection,
author/learner answer-key visibility, deadline expiry, replay, resume, attempt caps,
exact-set grading and final-exam eligibility; existing ten security helper tests PASS.
No live exam data was migrated. A new partial unique active-attempt index is required;
normal Mongoose initialization builds it. Interrupted preparing/grading locks can be
recovered after two minutes; no active timeout is restarted on browser reload.

## Feature 3 — shared course builder and learner assessment UI
- Replaced both administrator/trainer creation screens with one four-stage CourseBuilder:
  details → lessons → one quiz per lesson → final exam. Saved course ID/stage live in
  the URL, so drafts reopen through authenticated author reads. Lessons can be added,
  edited and removed; optional existing media is preserved when no replacement is uploaded.
- Topics/tags use a real ControlValueAccessor pill input: Enter/comma, paste, deduplication,
  keyboard removal, named remove actions and limits. Payload is an array.
- Shared AssessmentEditor exposes single/multiple responses, answer keys, optional
  per-question deadlines, points, passing score and attempts. Completeness feedback and
  question navigation keep 20-question papers manageable. Legacy second quizzes require
  explicit removal; no stored assessment is silently erased.
- New courses start as drafts, including admin-created courses. Publication checks a
  complete curriculum/lesson quizzes/final exam. Library actions remain role scoped.
- Learner player supports multiple responses and a separate persisted timed-attempt UI.
  Tested a real expired answer, retake, and exact-set final-exam grading. Discovered the
  viewer used an anonymous course-sheet endpoint, so final exam questions were absent;
  added an authenticated learning endpoint with answer-key stripping and draft/archive
  access checks. Public course sheets remain metadata-only.
- Save each resource before leaving: in-memory edits survive step changes, not navigation
  away; refresh/unload warns about unsaved state. This is not offline autosave.

PASS: development build, admin-actions regression, assessment integration tests and
`course-authoring-live.cjs` against a disposable real MongoDB/Express API. The browser
created a course and lesson, entered two 20-question papers, reloaded answer keys, published
as admin, enrolled as learner, received 95% after timed expiry, 100% on a timed retake,
and 95% for a non-exact multiple-response final answer. 390/768/1440 bounds and dark table
hover checked. Screenshot is explicitly test content, visually inspected. Test emails
are diverted to a test sink; SMTP, media upload/streaming and passing-certificate generation
were not verified by this run. No production data was changed.

### Publication and dirty-state hardening
Direct metadata updates can no longer publish a course: admins must use the approval
endpoint with curriculum validation. Non-boolean approval values are rejected. A real
API regression confirms an incomplete draft remains unpublished after a bypass attempt.
Dirty baselines are now per resource; saving metadata, a quiz or an exam no longer clears
other resources' unsaved warnings. Selected lesson files also trigger unload protection.
There is still no SPA navigation guard; save before leaving the builder through app links.

Latest hardening regression: 16/16 tests passed across assessment authoring, staff,
security helpers, learning progress and cache/loading suites. Development compilation
passed. The production build did NOT complete: the process reported `Killed` during
bundle setup in this sandbox. No production-build success is claimed.
Push status: builder feature 2d705a8 reached origin/v1.0; the subsequent hardening push
failed because HTTPS credentials were unavailable. Emoji/icon cleanup and the remaining
toast audit are not complete. No SPA leave guard has been implemented.

## Latest continuation — prior open items superseded
The emoji/contextual-icon and toast passes, authoring navigation/logout protection,
and optimized production build are now complete locally. See `REMAINING-FIXES.md`
for the exact test scope, recovery history and publication blocker. Earlier statements
above about an absent SPA guard and a killed production build describe previous runs,
not the final state. The remote is currently missing, so the continuation commits
remain local on v1.0.
