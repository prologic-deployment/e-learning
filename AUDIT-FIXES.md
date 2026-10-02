# E-Learning Platform — Security Remediation Applied

All five phases of the approved audit plan have been implemented. This document lists
every change and what you must do before deploying.

---

## 1. Critical fixes

| Threat | Fix |
|---|---|
| **Anyone could register as admin** | `register` now hardcodes `role: "user"` and logs attempts with elevated roles. Staff accounts only via admin-only endpoints. |
| **Admin skipped OTP** | Removed the bypass — every role now completes OTP (all accounts are 2-factor). |
| **Paywall bypass** (`POST /courses/:id/enroll`) | Now enforces `isApproved` + purchase for paid courses (same rules as the canonical enrollment route). |
| **Paid content public** | New `requireCourseAccess` middleware gates lessons, NLP summaries, and file downloads on enrollment/purchase/free-preview/staff. |
| **`/uploads` served publicly** | Public static mount removed. Content is streamed through `GET /api/files/lesson/:id` (JWT + access check + HTTP Range for video seek). Only avatars stay public. |
| **Quiz/exam answers shipped to clients** | `correctAnswer` is `select: false` in schemas AND stripped by `stripAnswers` middleware on every lesson/course response. Grading is server-side only. |
| **Certificate forgery via `{progress: 100}`** | `updateProgress` recomputes progress server-side from `lessonsCompleted`; client values are ignored. |
| **IDOR between trainers** | Ownership checks added on lesson update/delete and all quiz/final-exam CRUD. |
| **No rate limiting** | `loginLimiter` on all credential endpoints, global API limiter, per-user AI quota (`aiLimiter`) on chatbot/NLP/quiz submission. |
| **Socket identity spoofing** | Socket.io handshake requires a valid JWT; `register` userId must match the token subject. |
| **XSS via chatbot / lesson summaries** | All AI/RAG output is HTML-escaped before markdown conversion, links get `rel="noopener noreferrer"`. |

## 2. Authentication & session hardening

- **tokenVersion**: JWTs embed a version that is bumped on every password
  change/reset — password changes now instantly kill all existing sessions.
- **Reset tokens stored hashed** (SHA-256); forgot-password responds identically for
  unknown emails (no account enumeration).
- **`PUT /users/me` no longer accepts `password`** — changes must go through
  `/auth/change-password` with the current password.
- **JWT expiry reduced 1d → 8h** (`JWT_EXPIRES_IN`), signed via central config.
- OTP generation is now cryptographically secure (`crypto.randomInt`).

## 3. Data protection

- **AES-256-CBC → AES-256-GCM** (authenticated encryption). Legacy ciphertext still
  decryptable for migration; new writes use the `v2:` format.
- **No hardcoded fallback key** in production — the server refuses to boot without a
  real `ENCRYPTION_KEY`/`JWT_SECRET` when `NODE_ENV=production` (dev auto-generates
  ephemeral keys with a warning).
- **CV `email`/`telephone` encrypted at rest** (matching User phone/address).
- **Trainer emails removed** from public course listings and Qdrant payloads.
- **Public certificate verification** now returns only validity + holder name +
  course + serial (no email), backed by an HMAC authenticity check.
- **OTP codes / quiz answers / token fragments no longer logged.**
- Error handlers no longer leak `err.message` in production.
- `uploads/` gitignored; `NODE_ENV=production` blocks the destructive seeder.

## 4. Commerce readiness

- **`payment.service.js`** — provider abstraction (`simulated` today; add
  Stripe/Konnect/Paymob implementations without touching controllers).
- **Transactional purchase** — Purchase + Enrollment created in one MongoDB
  transaction; double-purchase and already-enrolled checks.
- **Cart is cleared** of purchased items; invoice download via
  `GET /api/files/invoice/:purchaseId` (PDF, owner/admin only).
- **Certificate serial + HMAC verification code** printed on the PDF and stored.

## 5. UX fixes

- **Anonymous users can browse course details** (`GET /courses/:id` is public, safe fields only).
- **Production environment fixed** — `environment.prod.ts` now has `apiUrl`/`backendUrl`.
- **OTP screen** — resend button with 60s cooldown counter.
- **404 page** for unknown routes (`**` wildcard).
- **Staff can browse the storefront** (homepage still redirects; cart/CV/recommendations stay learner-only).
- Page title/lang fixed; font weights trimmed (18 → 6 variants) for faster first paint.

## 6. Architecture cleanup

- Quiz1/Quiz2 unified on one grading engine with server-side attempt limits
  (`maxAttempts`, default 3, per quiz and final exam; 429 when exhausted).
- Duplicate `/courses/trainer/all` route removed (the duplicate leaked all courses).
- Duplicate `createNotification` removed; bulk emails now batched (10 concurrent).
- `isArchived`/`archivedAt` added to Course schema (archive/restore actually works now).
- RAG: deterministic point IDs (reindex updates instead of duplicating), auto-scales.
- Flask: binds `127.0.0.1`, optional `X-Internal-Token` shared secret, 200 MB upload
  cap, portable ffmpeg PATH (no personal Windows path).
- Dependencies: `chart.js`, `ng2-charts`, `chromadb`, `crypto-js` removed from backend.

## 7. Verification

```
cd back  && npm test:security        # 11/11 security tests pass
cd back  && npm start                # boots; validates env
cd front && ng build --production    # builds clean
```

---

## ⚠️ Required .env additions (before deploy)

```env
# Strong secrets (32+ chars) — server refuses production boot without them
JWT_SECRET=<node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
ENCRYPTION_KEY=<same generator, different value>
NODE_ENV=production

# URLs used in emails, sockets and file delivery
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://api.your-domain.com
CORS_ORIGINS=https://your-domain.com

# Rate limits (defaults shown)
RATE_LIMIT_WINDOW_MS=600000
RATE_LIMIT_LOGIN_MAX=10
RATE_LIMIT_API_MAX=600
RATE_LIMIT_AI_MAX=20

# Optional: authenticate the internal Flask service
INTERNAL_API_TOKEN=<random hex>          # same value in recommender/.env
PAYMENT_PROVIDER=simulated               # swap when a real gateway is integrated
JWT_EXPIRES_IN=8h
```

## Known follow-ups (recommended next)

1. Real payment gateway integration (the abstraction is ready).
2. Migrate existing encrypted fields: re-save users/CVs once to upgrade old CBC
   ciphertext to GCM (reads work either way in the meantime).
3. Route-level lazy loading (`loadChildren`) — bundle is still a single chunk.
4. E2E suite (Playwright) covering manager → employee → certificate flow.
5. Existing users have `tokenVersion: 0` — their sessions stay valid until next
   password change; force a rotation for admins if desired.
