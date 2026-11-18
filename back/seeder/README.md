# 🌱 Database Seeder

Two seeds, one entry point (`seeder/index.js`). Run them from `back/`.

| Command | Use it for | Deletes data? | Allowed when `NODE_ENV=production` / `preprod` |
|---|---|---|---|
| `npm run seed:prod` | Every environment, incl. production — reference data | **No**, never | ✅ yes |
| `npm run seed:test` | Development & QA — full demo data set | **Yes**, wipes first | 🚫 refused |
| `npm run seed:test -- --users` | Auth testing — users & teams only | **Yes**, wipes first | 🚫 refused |

`npm run seed` alone prints the usage. Both seeds need `MONGO_URI` in
`back/.env` and a running MongoDB.

## Production seed — `npm run seed:prod`

Idempotent: safe to run on every deploy, as many times as you like.

1. **Categories & sub-categories** — upserted by name from
   `seeder/data/categories.js` (7 tech categories: Development, Systems,
   Networking, DevOps, Cloud, Cybersecurity, Data & AI). Re-running updates
   icons, colours, descriptions and sub-category lists; nothing is duplicated
   or deleted. The frontend loads them from `GET /api/categories`.
2. **Badges** — the 13 badge definitions.
3. **Admin account** — created from `back/.env` **only if it does not exist**.
   An existing account is never modified (no password reset).

```env
ADMIN_EMAIL=admin@yourcompany.tn     # required the first time
ADMIN_PASSWORD=ChangeMe2026          # ≥ 8 chars, 1 uppercase, 1 digit
ADMIN_FIRSTNAME=Platform             # optional
ADMIN_LASTNAME=Admin                 # optional
ADMIN_DATE_OF_BIRTH=1990-01-01       # optional
ADMIN_PHONE=+216...                  # optional
```

If no admin exists and these are not set, the seed stops with a clear error.
Remove `ADMIN_PASSWORD` from `.env` after the first sign-in.

## Test seed — `npm run seed:test`

**Destructive**: wipes users, courses, lessons, enrollments, purchases,
reviews, certificates, notifications, carts, CVs, categories and badges, then
loads the reference data above plus the demo data set below. Test passwords
are public — never run it against a database with real users (it refuses
`NODE_ENV=production` and `preprod`).

Files: `seeder/test.js` (orchestration), `seeder/data/*.js` (plain data —
edit freely), `seeder/production.js`, `seeder/lib/common.js`.

## What the test seed loads

| Collection | Count | Notes |
|---|---|---|
| Categories | 7 | same as the production seed (with sub-categories) |
| Users | 13 | 1 admin, 2 managers, 3 trainers, 7 learners |
| Teams | 2 | manager1 → 3 members, manager2 → 3 members (user7 teamless on purpose) |
| Badges | 13 | auto-initialized from badge.service definitions |
| Courses | 7 | tech-only categories (Development, Systems, Networking, DevOps, Cybersecurity, Data & AI); 3 free, 4 paid; **1 pending approval** (tests admin approval flow) |
| Lessons | 21 | each with a scored quiz (answers stored, `select:false`) |
| Enrollments | 9 | mixed states: completed / midway / just-started / deadline-soon / overdue |
| Purchases | 2 | with payment references (paid course enrollments) |
| Certificates | 2 | with serial + HMAC verification codes |
| Reviews | 5 | 3 approved, 2 pending (tests the moderation queue) |
| Notifications | 12 | NEW_COURSE / DEADLINE_REMINDER / BADGE_EARNED samples |
| CVs | 3 | powers the CV builder |

## Test account matrix

| Email | Password | Role | Scenario highlights |
|---|---|---|---|
| admin@test.com | Admin123 | admin | approve pending course, moderate reviews, cache stats |
| manager1@test.com | Manager123 | manager | team of 3; user3 has an **overdue deadline** |
| manager2@test.com | Manager123 | manager | team of 3; try assigning a course to user7 → must fail (not your team) |
| trainer1@test.com | Trainer123 | trainer | owns Node (free), React (pending) + Cybersecurity (free) courses |
| trainer2@test.com | Trainer123 | trainer | owns Docker (149 TND), Linux (79 TND) + Networking/CCNA (119 TND) courses |
| trainer3@test.com | Trainer123 | trainer | owns ML course (99 TND, approved) |
| user1@test.com | User1234 | user | **completed** Node course → has certificate; bought Docker |
| user2@test.com | User1234 | user | midway Node, bought ML |
| user3@test.com | User1234 | user | **overdue** deadline — shows in manager dashboards |
| user4@test.com | User1234 | user | completed ML course + certificate |
| user5@test.com | User1234 | user | midway Docker (paid) |
| user6@test.com | User1234 | user | midway Node; wrote a pending review |
| user7@test.com | User1234 | user | **teamless** — for negative manager tests |

Passwords appear plain in `data/users.js` (test only) and are bcrypt-hashed by
the User model hook at seed time.

## Manual test checklist

1. **Anonymous browsing** — open `/courses-details/:id` logged out → public course sheet.
2. **Paywall** — log in as `user5@test.com`, try enrolling in the ML course without buying → 403.
3. **Answers hidden** — DevTools → Network → load lessons → no `correctAnswer` in payloads.
4. **Quiz attempts** — fail a quiz 3 times → 429 "Maximum attempts reached".
5. **Progress forgery** — `PUT /api/enrollments/:id/progress` with `{progress:100}` → recomputed server-side.
6. **Deadline alerts** — manager1 dashboard shows user3's overdue enrollment.
7. **Approval flow** — admin approves React course → it appears publicly.
8. **Moderation** — admin approves/rejects user5 & user6's pending reviews.
