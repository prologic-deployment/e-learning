# Seeder alignment with current models — 2026-10-07

The npm seeder is `back/seeder/seed.js`. This pass reviewed all 17 current model
modules, the assessment validator/grader, progress calculator, certificate HMAC
verification, badge definitions and auth endpoints before changing fixture writes.

## Corrections
- **User:** create through Mongoose save hooks so passwords are hashed and PII uses
  the normal encryption setters. Respect role arrays, manager references and current
  profile fields. New fixtures start with 2FA disabled. Insert-only reruns preserve
  existing password hashes, 2FA material, tokenVersion and lockout fields. Passwords
  are not printed. Normal seeding is not an account-reset operation.
- **Course / Lesson:** tags are arrays; category values match the authoring choices;
  price/isPaid agree. New courses are drafts until their lessons are wired. Twelve
  embedded lesson quizzes and four embedded final exams each pass the same 20–200
  question validator as authoring. Single/multiple keys, points and timing are explicit.
  There is one quiz per lesson and no newly populated quiz2. Existing incomplete
  fixture courses are left untouched with an actionable error, not silently migrated.
- **Enrollment:** shared progress rules, matching lesson results and attempt counters,
  current lesson position, deadlines and final-exam outcomes. Synthetic completed
  scores are computed from fixture answer keys, not arbitrary percentages.
- **Purchase:** all four paid enrollment scenarios have a matching paid simulated
  purchase. Previously only two did. No real payment provider is contacted.
- **Certificate:** only completed/passed enrollments receive metadata; unique serial
  and verification HMAC use the production verification contract. No PDF is fabricated.
- **Review:** enrolled fixture users, actual course references, valid ratings and
  moderation states; user/course uniqueness is preserved on rerun.
- **Badge / Notification:** reuse all 13 built-in definitions, add earned references
  without duplication, populate relevant course/badge identifiers and issue deadline
  samples only for actual deadline scenarios. System copy has no emoji decorations.
- **CV / Cart:** current embedded experience/skill/language schemas and encrypted
  contact fields; a cart references a real unpurchased paid course with a matching total.
- **AuthChallenge / AssessmentAttempt:** do not manufacture active login challenges or
  unfinished timed sessions. Confirmed fresh cleanup now removes these records.
- **Quiz / Question / QuizResult / FinalExam:** legacy standalone models are deliberately
  not populated; current authoring uses embedded assessments. Confirmed fresh cleanup
  clears legacy records so they cannot point to removed users/courses.

## Operational safeguards
`seed:check` validates fixtures without a database connection. Writes require explicit
`SEED_ALLOW_WRITE=true`, development/test mode, a named database and stable encryption/
JWT keys. Fresh cleanup additionally requires the exact database name via `--confirm-db`.
It clears modeled collections, not unrelated collections. Run one seeder at a time;
this is not a transactional migration. The environment file is anchored to `back/`.

## Executed verification
The combined seeder, TOTP configuration, TOTP/all-role, startup, assessment authoring
and staff regression run passed **35/35 tests** against isolated MongoDB instances.
The seeder integration tests validated counts/references, all paper schemas and answer
keys, purchase eligibility, grades/progress, certificate signatures and encrypted CV
fields. A seeded admin enabled 2FA through the real auth API, then a normal rerun
preserved that factor, a changed password and token version. Tests also covered unsafe
write refusal, preservation of legacy incomplete papers and explicit fresh cleanup of
runtime/legacy records while leaving an unrelated collection intact.

`npm run seed:check` also passed independently: 13 users, 4 courses, 12 lessons and
16 valid assessments. No production database was seeded. No frontend code changed
in this pass; no new frontend-build claim is made. Configuration instructions for the
reported admin setup error are in `TOTP-CONFIGURATION.md`; the deployment must retain
or restore its own persistent TOTP key independently of seeding.
