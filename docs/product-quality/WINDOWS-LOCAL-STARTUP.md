# Local startup, proxy and authenticator recovery (PowerShell)

## What the reported errors mean
- `ECONNRESET`: an existing connection was closed/reset (for example a backend restart).
- `ECONNREFUSED`: nothing accepted the connection at the configured backend address/port.
- HPM 2.x explicitly logs an undefined target in some WebSocket error paths. This does
  not establish that the proxy target is missing. The old config already targeted
  `http://127.0.0.1:5000`; Angular compiling does not start the API or MongoDB.
- The old `auth:configure` called the generic key validator for an invalid non-empty
  key and repeated the API error. It now diagnoses file values versus inherited
  environment overrides and supports guarded replacement of an invalid file value.

## Update, then configure the backend
From the repository root, update `v1.0` without discarding local work. In a backend
PowerShell terminal:

```powershell
cd E:\elearningTest\back
npm ci
npm run auth:check
npm run auth:configure -- --replace-invalid
npm run auth:check
npm run dev
```

The provisioner requires the correct `MONGO_URI` and a reachable MongoDB. It will
create/replace a missing/invalid FILE key only when no enabled/pending authenticators
exist. It never replaces a valid key. If authenticators exist, restore the original
key from backup/secret storage; do not reset users or run fresh seeding to fix it.
If the error identifies a stale PowerShell process override, remove that stale
variable before retrying:

```powershell
Remove-Item Env:TOTP_ENCRYPTION_KEY
npm run auth:configure -- --replace-invalid
```

Do not remove a correct deployment secret or share its value in chat/logs. Restrict
the resulting environment file using Windows ACLs and back up the persistent key.
Use the same value across replicas and restarts. `AUTH_ENV_FILE`, when explicitly
set, is honored by configuration, checking, server startup and doctor commands.
Keep `npm run dev` running. If it exits, inspect its error first: missing secrets,
MongoDB connectivity and port conflicts must be resolved at the backend.

In a second backend terminal, run `npm run doctor`. It checks key format, API/database
readiness and the Socket.IO transport (not a replacement for application JWT auth).
In the frontend terminal:

```powershell
cd E:\elearningTest\front
npm ci
$env:API_PROXY_TARGET = "http://127.0.0.1:5000"
npm start
```

If `back/.env` uses a different `PORT`, use that port in `API_PROXY_TARGET`. Restart
Angular after changing it. The new `front/proxy.conf.cjs` prints the effective target
and gives actionable connection errors, returning HTTP 503 instead of pretending
requests succeeded. No special host-check bypass is needed for normal localhost use.

## Socket lifecycle changes
The frontend probes `/api/health` before creating a socket and keeps only one probe
or socket alive. It starts on sign-in for every role, authenticates with the current
session token, uses polling with WebSocket upgrade, and replaces the socket when the
session changes. Logout cancels pending probes and disconnects the socket.

After a failure/disconnect, automatic WebSocket retries do not flood the proxy.
A visible offline message offers **Retry notifications**. After fixing/restarting
the backend, use Retry or reload the page. Failed HTTP requests still correctly
report backend unavailability; these changes do not hide or repair a stopped server.

## Seeders and existing short papers
The previously blocked seeder commit is now published in `v1.0`. New seed data uses
20 questions for every lesson quiz and final exam, validated by the application's
assessment rules (single/multiple answers, points and timing). Validate with:

```powershell
cd E:\elearningTest\back
npm run seed:check
$env:SEED_ALLOW_WRITE = "true"
npm run seed
```

Existing data is preserved. If old fixture papers contain fewer than 20 questions,
the seeder refuses to silently overwrite them. Complete them through authoring or,
ONLY for a disposable database, explicitly recreate it:

```powershell
npm run seed:fresh -- --confirm-db YOUR_DISPOSABLE_DATABASE_NAME
```

The confirmation must exactly match `MONGO_URI`'s database name. Fresh cleanup deletes
all modeled data, including users and 2FA enrollments; never use it on a live database.
Stable JWT/encryption configuration and development/test mode are also required.

## Verification
- 35 backend tests passed: seeder, configuration/provisioning, all-role TOTP, startup,
  assessment authoring and staff authorization. Invalid-file replacement, invalid
  environment override, valid-key preservation and enabled/pending-key refusal covered.
- 3 socket/proxy tests passed: actual backend + isolated MongoDB through HPM, anonymous
  Socket.IO rejection, authenticated polling/WebSocket upgrade, doctor success, backend
  shutdown/503 response; lifecycle duplication/cancellation/refresh cases.
- Actual `ng serve` loaded the CJS config and compiled. Playwright with the API stopped
  verified one readiness request per attempt, an honest retry UI, no application
  WebSocket loop and no page exceptions. Existing admin-actions and sidebar-navigation
  browser regressions also passed.
- Production build passed: `0cc057beaf8ea3c8`, initial bundle 2.52 MB. Existing CommonJS
  warnings remain. An initial dev-server test process was killed with exit 137 in
  this memory-limited sandbox while tooling was installed; the lower-memory restart
  compiled and passed the real browser test. No test services remain running.

Tests ran in the Linux sandbox, not native Windows. PowerShell guidance and the
process-override branch were reviewed/tested without exposing credentials; Windows
ACL behavior itself is not claimed as tested. No production database, deployment
secrets or user machine was modified.
