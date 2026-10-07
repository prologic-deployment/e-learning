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
