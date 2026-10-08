# Model-aligned development seeder

**Synthetic test data only. Never use this on a production or staging database.**
The seeder does not enable 2FA for anyone or configure the deployment encryption key.

## Safe usage

From `back/`, configure an explicit disposable `MONGO_URI`, `NODE_ENV=development`
(or `test`), and persistent `JWT_SECRET` / `ENCRYPTION_KEY` in the environment. Stable
keys are needed because fixture phone/CV fields are encrypted and certificate
metadata is signed. `.env` is loaded from `back/`, independent of your current directory.

```bash
npm run seed:check                           # validate fixtures; no connection or writes
SEED_ALLOW_WRITE=true npm run seed           # insert missing records; keep existing data
SEED_ALLOW_WRITE=true npm run seed:review    # insert missing approval drafts; preserve existing courses
SEED_ALLOW_WRITE=true npm run seed:users     # users/teams and built-in badges only
```

Normal reruns are idempotent. Existing passwords, role changes, 2FA settings, token
versions, profiles, manager assignments, course content and progress are preserved.
Team assignments apply only to newly created fixture users. Built-in badge definitions
are refreshed through the existing badge initializer. Existing incomplete/legacy,
archived or unpublished fixture courses needed by the scenarios cause a clear error
rather than silent replacement/publication. This is a fixture seeder, **not a migration**.

To deliberately recreate a disposable database (example database name only):

```bash
SEED_ALLOW_WRITE=true npm run seed:fresh -- --confirm-db elearning_dev
```

`--confirm-db` must match the database named in `MONGO_URI`. **This removes all records
in every collection represented by a backend model**, not just seed records, including
users, authenticator challenges, timed attempts, and legacy quiz collections. A fresh
users-only run still clears those collections; `--users` controls what gets recreated.
Unrelated collections are not dropped. There is no production/staging override.
Do not run parallel seed processes. Writes are not wrapped in a database transaction;
a failed run can be retried after addressing the error. No passwords, keys, tokens,
connection URIs or user documents are printed by the seeder.

## Review-ready courses on an existing development database

Use `SEED_ALLOW_WRITE=true npm run seed:review` to add missing draft courses without
requiring legacy activity fixtures to be complete. It prepares missing accounts and
badge definitions, then inserts only missing React and API Security review drafts.
It does not create enrollments, purchases, grades or certificates. Repeating it leaves
existing courses untouched, including administrator approval decisions. `--review`
cannot be combined with `--fresh` or `--users`.

The default full seed still refuses incomplete existing scenario courses instead of
rewriting assessments under learner histories. Neither command upgrades existing
quiz contents in place. Use authoring to repair those courses; use a confirmed fresh
seed **only** when intentionally replacing a disposable database.

In the admin course-management screen, review and approve:
- **React Fundamentals — Components, Hooks & State**: two quizzes (20 and 22 questions), final 25.
- **API Security — Authentication and Access Control**: one 20-question quiz, final 25; passing score 80%.

The real approval endpoint checks role authorization, course/lesson field contracts,
matching lesson references, one valid quiz per lesson, complete valid final exam,
answer indices/options, points, timers, passing scores and attempt limits. Archived
courses must be restored first. Invalid papers remain unpublished. Answer keys used
for validation are not included in the approval response. Repeated approval does not
send a second new-course notification; publication uses a conditional state update.

## Current fixture graph

| Collection | Fresh full count | Contract |
|---|---:|---|
| User | 13 | 1 admin, 2 managers, 3 trainers, 7 learners; hashed passwords; 2FA off initially |
| Badge | 13 | Current definitions; earned badge references assigned to fixture learners |
| Course | 5 | 3 published, 2 review-ready drafts; tags as arrays, correct price/isPaid, lesson references |
| Lesson | 13 | One embedded quiz each; no second quiz |
| Embedded assessments | 18 | 13 quizzes of 20–24 questions + 5 finals of 25 questions; 405 questions total, hidden answer keys |
| Enrollment | 9 | Shared progress calculation, matching quiz results/counters, 2 completed finals |
| Purchase | 4 | Every paid enrollment has a matching simulated paid purchase |
| Certificate | 2 | Unique serials and valid HMAC metadata for completed courses only |
| Review | 5 | Existing enrolled learners; approved and pending moderation |
| Notification | 10 | Real fixture course/badge/deadline references; no emoji in system copy |
| CV | 3 | Current embedded schemas and encrypted email/phone fields |
| Cart | 1 | Teamless learner; unpurchased paid course and matching total |
| AuthChallenge / AssessmentAttempt | 0 | Runtime records are created by real sign-in/assessment flows, not pre-seeded |
| Quiz / Question / QuizResult / FinalExam | 0 | Legacy standalone models; active assessments are embedded in Lesson/Course |

Questions retain the original lesson-specific content and add an explicit course-wide
practice bank to reach 20, 22 or 24 questions per lesson and 25 per final, without cycling bank entries. Answer positions rotate deterministically. The new API Security draft contains 25 contextual security questions, with 20 in its lesson quiz. Banks exercise single response, multiple response, weighted
points and a 30-second timed item in each original course's first lesson quiz. The API Security lesson is untimed. Finals are untimed.
These are development fixtures, not a production curriculum or real learner activity.
Completed scores are calculated from correct fixture answers. Certificates are signed
metadata only; no PDF/media files, payment-provider transactions, emails or AI calls are
created. Completed fixture histories need no active timed attempt records.

## Accounts and 2FA

| Email(s) | Development-only password | Role |
|---|---|---|
| admin@test.com | Admin123 | admin |
| manager1@test.com, manager2@test.com | Manager123 | manager |
| trainer1@test.com … trainer3@test.com | Trainer123 | trainer |
| user1@test.com … user7@test.com | User1234 | user |

These are public synthetic credentials, never safe for deployment. Normal reruns do
not restore these passwords after a user changes them. There is no OTP bypass or shared
TOTP secret. To exercise admin setup, configure a persistent `TOTP_ENCRYPTION_KEY`, sign
in as the seeded admin, then use **Security & 2FA**. Missing-key recovery instructions:
`../../docs/product-quality/TOTP-CONFIGURATION.md`. Never use `--fresh` to fix a missing
production 2FA key. The original key must be restored for existing authenticators.

`npm run test:seed` uses a disposable in-memory MongoDB and checks the complete graph,
API-based admin enrollment in 2FA, preservation on rerun, legacy-course refusal,
explicit fresh cleanup, purchase eligibility, keys, grades and certificate signatures.
