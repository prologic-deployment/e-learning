# 🌱 Database Seeder

Injects consistent, realistic test data for manual testing. All data lives in
`seeder/data/` (plain JS modules — edit freely), the orchestrator is
`seeder/seed.js`.

## Usage

From `back/`:

```bash
npm run seed          # add data, keep existing (fails on duplicate emails)
npm run seed:fresh    # WIPE everything, then seed  ← recommended for testing
npm run seed:users    # users + teams only (fast, for auth testing)
```

⚠️ Refuses to run when `NODE_ENV=production`.
Requires `MONGO_URI` in `back/.env` and a running MongoDB.

## What gets seeded

| Collection | Count | Notes |
|---|---|---|
| Users | 13 | 1 admin, 2 managers, 3 trainers, 7 learners |
| Teams | 2 | manager1 → 3 members, manager2 → 3 members (user7 teamless on purpose) |
| Badges | 13 | auto-initialized from badge.service definitions |
| Courses | 4 | 2 free, 2 paid; **1 pending approval** (tests admin approval flow) |
| Lessons | 12 | each with a scored quiz (answers stored, `select:false`) |
| Enrollments | 9 | mixed states: completed / midway / just-started / deadline-soon / overdue |
| Purchases | 2 | with payment references (paid course enrollments) |
| Certificates | 2 | with serial + HMAC verification codes |
| Reviews | 5 | 3 approved, 2 pending (tests the moderation queue) |
| Notifications | 12 | NEW_COURSE / DEADLINE_REMINDER / BADGE_EARNED samples |
| CVs | 3 | powers the recommendation engine |

## Test account matrix

| Email | Password | Role | Scenario highlights |
|---|---|---|---|
| admin@test.com | Admin123 | admin | approve pending course, moderate reviews, cache stats |
| manager1@test.com | Manager123 | manager | team of 3; user3 has an **overdue deadline** |
| manager2@test.com | Manager123 | manager | team of 3; try assigning a course to user7 → must fail (not your team) |
| trainer1@test.com | Trainer123 | trainer | owns Node (free) + React (pending) courses |
| trainer2@test.com | Trainer123 | trainer | owns Docker course (149 TND, approved) |
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
