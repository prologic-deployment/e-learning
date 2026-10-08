# Unified dashboard tables and clickable profile photos

## Delivered
- A single standalone `DataTableComponent` built from the actual vendored Spartan table, input, button and badge primitives. Entity presets configure columns and filtering; projected templates retain authorized row actions. No additional UI framework dependency.
- Migrated people/staff, course management, archived courses, manager assignments, reviews, assessment results, overdue enrollments, learner history, and the admin/trainer/manager performance tables. Removed the superseded pager. Dashboard templates no longer contain independent native/Spartan entity tables.
- Shared search, column sorting (including accessible sortable headers), reset, result counts, empty states, 10/20/50-row pagination, responsive horizontal scrolling, categorical filters and applicable inclusive local-calendar date/numeric ranges.
- Filters include role/account; course category/instructor/publication/access/price; archive date; assigned manager/status; review rating/moderation; assessment course/type/result/score/completion date; enrollment progress/deadline/status/date. Choices come from actual loaded records.
- Filtering operates on each authorized API response in memory. It does not expand access or claim to search records the API has not loaded. Statistics and existing full-data Excel exports remain unfiltered.
- Kept lazy row-detail dialogs, keyboard interaction, role/course actions and exports. Added archived deletion confirmation using Spartan, and corrected stale archived rows after deletion. Archive/restore updates replace arrays for OnPush. Deadline edits now have independent per-enrollment drafts.
- Shared clickable photo editor replaces visible file inputs in trainer, manager and learner profiles. Native button supports keyboard file selection; hidden chooser, preview, Save/Cancel, busy/error/retry, object-URL cleanup and existing authenticated upload API. Client validation accepts JPG/PNG/WebP up to 5 MB. Admin had no equivalent photo upload form and was not given a new profile workflow.

## Validation on final development build
- Angular development build passed: `NG_BUILD_MAX_WORKERS=1 NODE_OPTIONS=--max-old-space-size=768 npm run build -- --configuration development`; hash `351514170451f2c4`.
- 7 Node tests passed: table derivation/filter intersections, inclusive date and numeric boundaries, invalid ranges/reset, immutable sort/cache reuse and pagination clamping; existing socket lifecycle and real proxy integration.
- 19 existing browser scenarios passed against a disposable real Express/Mongo API: lazy and scoped details, actions, paging, immutable assessment evidence, retry/cancellation, focus trapping/return, full-data Excel exports, and request deduplication.
- 13 additional Chromium scenarios passed: composed filters/no-match/reset, invalid numeric/date ranges, page size, 390px layout, archive deletion confirmation/cancellation/real deletion and row refresh, keyboard photo chooser/preview/cancel, MIME/size rejection, failed-upload retry, and persisted real upload after reload for all three profile roles. No page runtime errors in either browser suite.
- Screenshots are under `unified-tables/`; all data in evidence is disposable test-fixture data, not a production dataset.
- `git diff --check` passed.

## Reproduction
1. Install dependencies with `npm ci` in `front/` and `back/`.
2. Build the frontend as above. Run build separately from the fixture server on memory-constrained machines.
3. Start `node tests/dashboard-browser-api.cjs` in `back/` (creates its own disposable Mongo database).
4. Start `node tests/serve-dashboard.cjs` in `front/` (built app on port 4200, proxy to fixture API 5000).
5. In `front/`, run `npm run test:details:browser`, then `npm run test:controls:browser`. The controls suite deletes the disposable archived course; restart the fixture before repeating the suites.
6. Run `node --test tests/table-derivations.cjs tests/socket-lifecycle.cjs tests/proxy-socket.integration.cjs` from `front/`.

## Limits / publication
- Production optimization was attempted but stalled and made the sandbox unresponsive; it was terminated. A 512 MB development attempt also exhausted the Node heap; the final 768 MB development build passed after stopping the fixture API. No successful production-build claim for this change set.
- No deployment, production-database, Firefox/Safari or physical-device validation. Backend avatar upload limits are unchanged; the 5 MB constraint is client-side, not new server hardening.
- The features were originally committed as `81e1133` and `ad7e13e`; their pushes were blocked by missing authentication. The next workspace snapshot retained the source and evidence but omitted both commit objects. These changes are preserved together in a recovery commit for normal publication to `v1.0`. The validation above records the previous turn; tests were not rerun solely for this history recovery. No force push and no changes to `main`.
