# Remaining UI and authoring fixes — completed locally

Date: 2026-10-07. Branch: `v1.0`; `main` was not changed.

## Repository recovery
The restored workspace had 134 modified/untracked entries and lacked the previously
reported commits and the `origin` remote. With explicit user approval, the existing
files were preserved in recovery checkpoint `f3fdfa8`. Subsequent logical changes have
separate local commits. Non-force pushes were attempted after each feature, but all
were blocked by the missing remote. These commits have **not** been published.

## Completed scope
- **Unsaved authoring navigation:** registered router activation/deactivation guards
  cover switching dashboard tabs, leaving the route and changing course identity.
  Movement between steps of the same draft remains uninterrupted. The existing unload
  warning remains. A browser-native confirmation provides Leave/Cancel semantics;
  Cancel preserves edits. Leaving during a save is blocked. Cancelling logout preserves
  both the session and draft. This is protection, not automatic/offline persistence.
- **Sidebar reliability:** stable keys stop newly allocated navigation objects from
  recreating links during change detection and swallowing pointer clicks.
- **Contextual icons:** removed emoji literals from UI copy, assessment/backend system
  messages and badge definitions. Contextual Boxicons replace category, messaging,
  status and action decorations. Ratings retain their numeric values. Existing stored
  badge icon identifiers are rendered as an icon rather than class-name text; older
  system notification and badge text is cleaned at display time, without changing
  user-authored course/review content or bulk-editing stored notifications.
- **Toast consistency:** remaining course enrollment/review/summary/cart and learner
  profile/password successes use the shared outlet; legacy blocking error alerts now
  use error toasts. Removed the duplicate learner realtime toast implementation. Errors
  that explain field validation and persistent security/recovery instructions remain
  inline. Toasts support deduplication, dismissal, live-region semantics, bounded stack,
  focus/hover pause and reduced motion. External callbacks enter Angular's zone so
  notifications and dismissals render reliably.

## Verification actually performed
- **Production build PASS**, including the final source changes: hash
  `9f3b4524db03ca1c`; initial bundle 2.52 MB, estimated transfer 532.05 kB.
  Existing CommonJS optimization warnings remain; no build errors.
- Development compilation PASS during each logical change.
- **16/16 backend regressions PASS:** assessment authoring, staff authorization,
  security helpers, learning progress, cache/loading.
- **Real disposable MongoDB/Express authoring test PASS:** draft, tag pills, lesson,
  20-question mixed/timed quiz, 20-question final, saved-key reload, publication,
  learner timeout 95%, timed retake 100%, exact-set multiple-response final 95%.
  The screenshot was regenerated from that isolated test, not production data.
- `admin-actions.cjs` PASS on both development and final production bundles: role/delete
  dialog lifecycle, staff creation/list refresh, shared toasts and contextual actions.
- `authoring-links.cjs` PASS on the final production bundle: actual first-click sidebar
  navigation prompts; Cancel retains the draft, Leave navigates.
- `authoring-navigation.cjs` PASS on development: router tab changes and cancelled logout
  preserve state/session. This test intentionally uses Angular development inspection.
- `toast-consistency.cjs` PASS on development: shared service/outlet, deduplication,
  success/error live regions and dismissal (uses Angular development inspection).
- `system-presentation.cjs` PASS: AST/template scan for emoji literals, stored system-text
  cleanup, badge icon rendering contract. Source comments are not interface content.
- `legacy-presentation.cjs` PASS on the final production bundle: old badge names and
  notification copy render without emoji and icon identifiers do not appear as text.

Browser unit/regression fixtures are explicitly synthetic. The authoring live test used
an isolated real API and in-memory database, with email diverted to a test sink. That
API was stopped afterward. Production deployment, SMTP delivery, media streaming and
successful-final certificate issuance were not tested by this pass. The backend
regression suite and production build do not constitute a claim that every application
workflow has been exhaustively tested.

## Commits
- `39f2044`: authoring route/tab guards
- `3a21655`: contextual icons/system copy
- `79ca922`: unified feedback
- `98f2579`: safe cancelled logout
- `7ef24bd`: stable sidebar link identity
- `8e6cea0`: legacy notification/badge presentation

The remaining delivery blocker is repository publication: restore a verified remote and
authorized authentication, reconcile the recovered history, then non-force push `v1.0`.
Do not force-push over the missing remote history.
