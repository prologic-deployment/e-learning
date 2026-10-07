# Own-account 2FA for every role

## User entry points
Learners, trainers, managers and administrators can use **Security & 2FA** in the
workspace navigation, or the live-status **Two-factor authentication (2FA)** card
on their dashboard overview. The card also appears on existing profile tabs.
The canonical route remains `/account/security`, protected by login, not by role.

The card reads the signed-in user's status from the real API. It does not assume
2FA is disabled while loading or on an error. Failure has a retry and retains the
link to security settings. The shared page provides password-confirmed setup,
QR/manual-key configuration, six-digit activation, one-time recovery codes, and
password + authenticator/recovery-code protected disabling. Replacing a device
uses the existing disable-and-set-up-again flow; no administrator approval is
required and 2FA is not automatically enabled without user confirmation.

## Security boundary
Existing self-service endpoints resolve the account from authenticated `req.user`,
not caller-provided user IDs. The backend already permitted all four roles; this
feature makes access visible and adds explicit all-role ownership regressions.
An admin cannot use these self-service endpoints to configure someone else's
factor. Enabling invalidates prior sessions and returns a replacement session.
Password login for an enabled account returns a challenge, not a session, until
factor verification succeeds. Authentication responses now explicitly use
`Cache-Control: no-store`, covering setup material, recovery codes and sessions.
Secrets remain encrypted and recovery codes hashed in storage. The frontend does
not persist the authenticator secret or recovery codes in localStorage.

## Deployment requirement
Configure a persistent, securely backed-up `TOTP_ENCRYPTION_KEY` (32 random bytes,
base64 encoded) on the backend as documented in `AUTHENTICATION.md`. Do not rotate
or replace an existing key casually: enrolled accounts depend on it. No production
key was generated, stored, replaced or checked during this change. A missing key
produces a configuration error rather than an insecure fallback.

## Verification (2026-10-07)
- Backend TOTP suites: **21/21 tests passed**. Includes all four roles, anonymous
  rejection, wrong-password rejection, account-ID injection isolation, cross-account
  setup-token rejection, activation, session invalidation, challenged login,
  recovery sign-in and authenticated disable; prior replay/expiry/concurrency tests
  also passed.
- `front/tests/totp-all-roles-live.cjs`: **all four roles passed** against disposable
  real MongoDB/Express, with no mocked API responses. Each role used its dashboard
  card, configured a real TOTP secret, activated with a generated valid code, saw
  recovery codes, reloaded enabled state, received a login challenge and disabled
  with password + unused recovery code. No secret values are printed or screenshotted.
- Existing admin modal/staff/contextual-action and actual-sidebar navigation browser
  regressions passed.
- Development and production builds passed. Production hash `4f9c187ce556a888`,
  initial bundle 2.52 MB. Existing CommonJS optimization warnings remain.

For the live test, run `back/tests/totp-browser-api.cjs` with the development
frontend preview, then `front/tests/totp-all-roles-live.cjs`. The isolated fixture
uses ephemeral keys/in-memory MongoDB and a test-only 100-request authentication
budget because four full account flows share one IP. Deployment limits were not
changed. Initial use of the ordinary fixture hit its real rate limiter; the final
four-role run used the explicit test fixture. All fixture processes were stopped.

No deployment, real account enrollment, mail delivery or production secret
configuration was performed. Physical-device QR scanning is not claimed; the
browser test uses the same manual-key TOTP mechanism.
