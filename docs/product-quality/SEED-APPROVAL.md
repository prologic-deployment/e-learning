# Seeder and administrator approval update

## Implementation
- Full fresh seed: 5 courses, 13 lessons/quizzes, 5 finals; 18 assessments and 405 question entries. Lesson quizzes contain 20, 22 or 24 questions; all finals contain 25.
- Original topic banks enlarged instead of cycling entries. Generated answer positions vary deterministically, and correct indices remain consistent. Single/multiple response and weighted/timed examples remain supported.
- Added an API Security draft with 25 contextual security questions (20 in the lesson quiz), covering credentials, authorization, TOTP, recovery, server validation and assessment integrity.
- Two fresh review drafts: React Fundamentals and API Security. The three existing published fixtures retain their linked activity scenarios.
- Shared publication validator used by seed preflight, new seeded course creation, existing full-seed curriculum checks and the real admin approval endpoint. It validates course/lesson input contracts, curriculum references, archive state, one quiz per lesson and complete assessment definitions, including answer keys.
- Publication uses a conditional update. Repeated approval does not re-send notifications; changed course metadata requires re-review. This is not a multi-document transaction across course and lesson writes.
- Answer keys loaded for validation are not returned by approval/public course responses.

## Safe operation
`npm run seed:check` validates without connecting to a database. With a **development/test** database and persistent JWT/encryption configuration, `SEED_ALLOW_WRITE=true npm run seed:review` inserts missing review drafts, accounts and badge definitions. It does not create enrollments, purchases or grades, and it preserves existing drafts, approved courses and account security.

Existing quizzes are **not rewritten in place**. Review mode can run alongside legacy incomplete courses; those existing courses remain unchanged. The full scenario seed still refuses incomplete existing scenario courses rather than corrupting learner histories. Repair those through authoring, or deliberately use a confirmed fresh seed only for a disposable database. Review mode cannot be combined with fresh/users-only mode.

## Validation performed
- Seeder dry-run passed with current schemas and shared request/publication contracts.
- 68 backend tests passed: seeder integration, dashboard details/performance, assessment authoring, staff, progress, security helpers, TOTP/all roles, chat and input validation.
- Seeder tests include real HTTP authentication/authorization and approval, learner/trainer denial, negative price rejection, malformed answer index rejection, incomplete final rejection, archived course rejection, inconsistent lesson references, legacy second quizzes, valid publication, no answer-key leakage and no repeated notification.
- External new-course notification delivery is stubbed in the approval test; no real emails are sent.
- Tests also cover idempotency, preservation of passwords/TOTP/token versions/progress/admin approval, review-only insertion and reruns, unsafe-write/fresh guards, and legacy collection cleanup.
- All writes during verification used disposable MongoDB databases. No existing deployment database was seeded. No frontend code changed and no new browser verification is claimed for this update.
