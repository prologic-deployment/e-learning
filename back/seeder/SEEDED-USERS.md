# Seeded users — full reference

Every account created by the seeder in `back/` (`npm run seed`, `npm run seed:fresh`,
`npm run seed:users`). Source of truth: [`data/users.js`](data/users.js).

**13 users** — 1 admin, 2 managers, 3 trainers, 7 learners. All accounts are
`isActive: true`.

## How to log in

Every account — including the admin — goes through the **two-step OTP login**, there is no
password-only bypass:

1. `POST /api/auth/login` with `{ "email": "…", "password": "…" }`
2. `POST /api/auth/verify-otp` with `{ "email": "…", "otp": "…" }` → JWT

With `DEV_EXPOSE_OTP=true` in `back/.env` (development only), step 1 also returns
`devOtp` in the response, because the `@test.com` inboxes can't receive real email.
The OTP expires after 5 minutes; 3 wrong attempts lock the account for 10 minutes.

> ⚠️ **Test credentials only.** These passwords live in plain text in the seed data on
> purpose. Never reuse them anywhere real.

---

## 👑 Admin (1)

| First / Last | Email | Password | Phone | Address | Date of birth |
|---|---|---|---|---|---|
| Super Admin | `admin@test.com` | `Admin123` | +21610000001 | Tunis, Tunisia | 1988-03-15 |

Can approve pending courses, moderate reviews, inspect cache stats, create trainers/managers.

## 🧑‍💼 Managers (2)

| First / Last | Email | Password | Phone | Address | Date of birth |
|---|---|---|---|---|---|
| Ahmed Manager | `manager1@test.com` | `Manager123` | +21620000001 | Sousse, Tunisia | 1985-05-10 |
| Sami Ben Salah | `manager2@test.com` | `Manager123` | +21620000002 | Monastir, Tunisia | 1982-11-20 |

Team assignments: `manager1` → 3 members, `manager2` → 3 members.

## 👨‍🏫 Trainers (3)

| First / Last | Email | Password | Specialty | Experience | Phone | Address | Date of birth |
|---|---|---|---|---|---|---|---|
| Nadia Trainer | `trainer1@test.com` | `Trainer123` | MERN Stack | 8 yrs | +21630000001 | Nabeul, Tunisia | 1990-03-12 |
| Youssef Mansouri | `trainer2@test.com` | `Trainer123` | Cloud / DevOps | 6 yrs | +21630000002 | Sfax, Tunisia | 1989-08-22 |
| Ines Karoui | `trainer3@test.com` | `Trainer123` | Data Science / ML | 5 yrs | +21630000003 | Tunis, Tunisia | 1992-01-05 |

Each also gets a `trainerProfile.biographie`:

- **Nadia** — senior full-stack developer, 8 years building MERN applications for startups and enterprises.
- **Youssef** — cloud & DevOps engineer, AWS certified, specializes in Docker, Kubernetes and CI/CD pipelines.
- **Ines** — data scientist with a background in applied statistics, teaches ML from first principles.

All three have `disponibilite: true`.

## 🎓 Learners (7)

All seven use the password **`User1234`** and the role `user`. Phones run
`+2164000000X` in the same order as the emails.

| First / Last | Email | Phone | Address | Date of birth | Education | Field of study | Learning goal |
|---|---|---|---|---|---|---|---|
| Mohamed Ben Ali | `user1@test.com` | +21640000001 | Tunis, Tunisia | 1998-01-15 | Bac+3 | Computer Science | Become a Full Stack Developer |
| Amira Trabelsi | `user2@test.com` | +21640000002 | Sousse, Tunisia | 1999-04-20 | Bac+5 | Software Engineering | Learn Node.js and system design |
| Yassine Gharbi | `user3@test.com` | +21640000003 | Sfax, Tunisia | 2000-07-10 | Bac+2 | Networks | Master backend development |
| Sarra Jlassi | `user4@test.com` | +21640000004 | Nabeul, Tunisia | 1997-09-28 | Doctorat | Artificial Intelligence | Learn machine learning in depth |
| Karim Haddad | `user5@test.com` | +21640000005 | Bizerte, Tunisia | 1996-12-03 | Bac | Information Technology | Web development career switch |
| Rania Mejri | `user6@test.com` | +21640000006 | Ariana, Tunisia | 2001-02-18 | Bac+3 | Business Intelligence | Data analysis and dashboards |
| Hatem Sassi | `user7@test.com` | +21640000007 | Gabes, Tunisia | 1994-06-30 | Bac+5 | Electrical Engineering | Explore DevOps practices |

---

## Scenario each learner was seeded for

| User | Scenario |
|---|---|
| `user1@test.com` | **completed** the Node.js course → owns a certificate; **bought** the Docker course |
| `user2@test.com` | midway through the Node.js course; **bought** the ML course |
| `user3@test.com` | **overdue** deadline — shows up on the manager dashboards and in cron reminders |
| `user4@test.com` | **completed** the ML course → owns a certificate |
| `user5@test.com` | midway through the paid Docker course — use for **paywall** tests (403 on enroll without buying) |
| `user6@test.com` | midway through the Node.js course; wrote a **pending review** (moderation queue) |
| `user7@test.com` | deliberately **teamless** — tests the "not in your team" negative case for managers |

## Related seeded data

| Collection | Count | Notes |
|---|---|---|
| Teams | 2 | manager1 → 3 members, manager2 → 3 members |
| Badges | 13 | auto-initialized from `badge.service` definitions |
| Courses | 4 | 2 free, 2 paid, **1 pending approval** (admin approval flow) |
| Lessons | 12 | each with a scored quiz (answers stored with `select:false`) |
| Enrollments | 9 | completed / midway / just-started / deadline-soon / overdue |
| Purchases | 2 | paid-course enrollments |
| Certificates | 2 | serial + HMAC verification code |
| Reviews | 5 | 3 approved, 2 pending |
| Notifications | 12 | NEW_COURSE / DEADLINE_REMINDER / BADGE_EARNED |
| CVs | 3 | powers the recommendation engine |

> Gotcha: `/api/courses` responses are cached in Redis (TTL up to 30 min, keyed per
> URL + user). After reseeding, flush it or the browser keeps serving stale lists:
> `cd back && node -e "const r=require('./src/config/redis.config');(async()=>{const c=await r.connect();await c.flushall();await r.disconnect();console.log('flushed')})()"`.
