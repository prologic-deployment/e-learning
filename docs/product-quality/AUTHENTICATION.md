# FormaPath authenticator authentication

## Deployment (read before release)

This change intentionally signs out old sessions: signed session tokens now have a
mandatory issuer, audience, purpose, algorithm and tokenVersion. Deploy the backend
and frontend together. Existing accounts become **password-only** until they explicitly
enable an authenticator; the old emailed-code mechanism is removed, not silently
converted into TOTP. Tell users about this change before release.

1. Back up MongoDB and test restoration.
2. Install backend dependencies with `cd back && npm ci` and frontend with
   `cd front && npm ci`. Keep the committed lockfiles.
3. Configure a **stable, independent, 32-byte base64 `TOTP_ENCRYPTION_KEY`** using your
   secret manager. Generate once with a cryptographically secure generator (for example
   `openssl rand -base64 32`). Do not commit it, send it in chat, or regenerate on restart.
   Every backend instance must use the same key. Keep encrypted backups of that key
   separately from the database. Existing `JWT_SECRET`, database, PII encryption and
   SMTP settings still apply. TOTP setup/verification fail closed when the key is absent.
4. Run `node scripts/remove-legacy-login-fields.cjs` from `back` with the intended
   `MONGO_URI` explicitly configured. Review the count; after backup, repeat with
   `--apply`. This only removes obsolete login-code fields. It never changes passwords
   or existing authenticator settings. No automatic destructive migration runs at boot.
5. Remove the obsolete email-code exposure variable from deployment configuration.
6. Use HTTPS, synchronize server/device clocks with NTP, and retain the account-wide
   attempt budget. Set Express trusted-proxy configuration only for known proxies;
   never blindly trust arbitrary forwarded IP headers. The existing deployment's
   reverse proxy requires operator verification.
7. Run the tests below and perform an actual authenticator-app scan in staging.

Key rotation is NOT automatic. Rotate through a controlled decrypt/re-encrypt migration
with access to both keys; changing the environment value alone strands enabled users.
There is deliberately no password-reset or administrator API that bypasses TOTP. Lost
both device and recovery list: use an organization's verified identity recovery process;
an automated support recovery workflow is not included in this feature.

## Implemented contracts

- `POST /auth/login`: password-only accounts receive a final session; enabled accounts
  receive only an opaque five-minute challenge. Challenge hashes—not raw values—are
  stored in MongoDB, with TTL cleanup and explicit expiry enforcement.
- `POST /auth/two-factor/verify`: authenticator code OR unused recovery code, plus challenge.
  Five attempts per challenge; five account-wide factor attempts before a ten-minute
  block. This database budget applies across API workers and newly issued challenges.
- `GET /auth/two-factor`: enabled flag and remaining recovery-code count only.
- `POST /auth/two-factor/setup`: requires session and current password. Returns setup
  token, manual base32 key, standard otpauth URI, and locally generated PNG QR data URI.
  Pending key is encrypted, expires in ten minutes, and cannot be retrieved via GET.
- `POST /auth/two-factor/confirm`: requires session, setup token and valid six-digit code.
  Atomically enables protection, revokes old sessions, returns replacement session and
  ten recovery codes once. Pending material is removed.
- `DELETE /auth/two-factor/setup`: cancels an unfinished setup.
- `POST /auth/two-factor/disable`: requires session, current password AND a fresh
  authenticator code or unused recovery code. Wipes factor material, invalidates other
  sessions, and returns a replacement session.
- `POST /auth/logout`: revokes all sessions and challenges for this account.
- Password reset links remain hashed and single-use, revoke sessions and unfinished
  setup, and **never** remove an enabled authenticator.

All paths above are relative to `/api`. Authentication responses use `Cache-Control:
no-store`. Six-digit SHA-1 TOTP uses 30-second steps and ±1-step drift; consumed steps
cannot replay. Secrets use AES-256-GCM with random IVs and account-ID additional data.
Recovery codes contain 128 random bits each and only SHA-256 digests are persisted.
Consumption and credential changes use conditional atomic MongoDB operations.

Secret/setup/challenge/recovery material is kept only in component memory, cleared on
navigation, and never placed in localStorage or logged. The explicit recovery download
is initiated by the user. Existing session JWT localStorage storage remains; migration
to HttpOnly secure cookies is outside this feature and remains an XSS exposure concern.
REST and Socket.IO share current-user/version/active checks; credential changes also
disconnect active account sockets. Actual socket transport E2E remains to be run.

## UI and primitives

Login, registration, authenticator verification/recovery, setup confirmation and secure
disable were rebuilt. Account security is reachable for every role at `/account/security`
from workspace navigation and the account menu. Reusable `FormFieldComponent` composes
actual Spartan Label/Input primitives with control labels, hints, required markers,
validation messages and ARIA relationships. It is an application component, not an
invented claim that a Spartan Form primitive was installed. Cards, badges, skeletons,
buttons and menus are existing vendored Spartan components. Async operations use
`finalize` plus `takeUntilDestroyed`; secrets and passwords are cleared appropriately.

## Executed verification

- `npm run test:auth` in back: isolated real MongoDB integration tests (no production
  database and no public fixture data). See `tests/totp.integration.test.js` for cases.
- `node tests/security.helpers.test.js`: 10 helper tests passed.
- `node --test tests/learning-progress.test.js`: 7 existing learning regressions passed.
- Angular development build with one worker and 1024 MB heap: passed.
- Start `node tests/browser-api.cjs` in back; build front and start
  `node scripts/preview.cjs`; run `node tests/authenticator-browser.cjs` in front.
  Chromium passed registration → password login → QR/manual setup → invalid/valid
  confirmation → one-time recovery display → logout → second-factor challenge →
  recovery login → secure disable. Desktop 1440 and mobile 390 had no horizontal
  overflow; no browser page errors. Screenshots contain no credentials/secrets.
- Browser testing found an unhandled reset on the preview server's WebSocket socket;
  connection errors now destroy that socket rather than crash the preview process.

Not established by these tests: a physical phone scanning the QR; full live Socket.IO
transport; production optimized build; reverse-proxy/multi-instance staging; every
course/lesson/quiz/final-exam end-to-end workflow; full assistive-technology testing.

## Remaining major-pass work

This is the authentication feature, NOT completion of the entire redesign request.
All other forms, loading findings, premium landing, complete branding rollout, and
comprehensive role/workflow acceptance remain tracked in `AUDIT.md`.
