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
