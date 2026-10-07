# Backend warnings and frontend ECONNREFUSED

## Cause established from the reported logs
The backend connected to MongoDB, initialized badges and listened on port 5000.
The old “Shutting down…” message was only emitted by its SIGINT handler. That proves
an interrupt reached the Node process, but does not prove who sent it. Ctrl+C, terminal
management or another process can send a signal. The Mongoose warnings did not stop
startup. Once the backend stops, the frontend cannot proxy API or WebSocket traffic.

Both committed proxy entries explicitly target `http://127.0.0.1:5000`; the WebSocket
error's `undefined` text is not evidence of a missing target. No proxy target change
or increased HTTP timeout is needed for the reported default-port setup.

## Changes
- Replaced deprecated Mongoose update options throughout backend source, including
  the badge initializer, authentication, CV, lesson and profile updates. Returned
  documents still contain the post-update values.
- Quiet dotenv initialization, including dependency-triggered banners.
- Explicit SIGINT/SIGTERM shutdown logging, idempotent cleanup, and bounded shutdown.
  Interrupts remain respected—not ignored to conceal the problem.
- Stop/destroy the reminder cron job; close socket/HTTP connections, Redis and MongoDB.
- Explicit IPv4 listening and useful HTTP port-conflict reporting with a failure exit.
- Nodemon watches application source, server.js and .env rather than every file.
- `npm run doctor` checks the configured loopback API and highlights custom-port
  mismatch with the default Angular proxy.

## Windows PowerShell
Pull changes from the repository root. Keep two separate terminals open:

```powershell
# Repository root
cd E:\elearningTest
git switch v1.0
git pull --ff-only origin v1.0

# Terminal 1 — leave running; do not press Ctrl+C to start the frontend
cd E:\elearningTest\back
npm ci
npm run dev
```

```powershell
# Terminal 2
cd E:\elearningTest\front
npm ci
npm start
```

Optional third terminal:

```powershell
cd E:\elearningTest\back
npm run doctor
Test-NetConnection 127.0.0.1 -Port 5000
Invoke-RestMethod http://127.0.0.1:5000/
```

If the backend reports a shutdown signal, restart it and identify what interrupted
its terminal. If `.env` uses a custom `PORT`, align all API/socket/upload targets in
`front/proxy.conf.json` and restart Angular. Never share .env or credentials in logs.
The frontend cannot make a stopped backend available.

## Verification
`node --test back/tests/startup.test.cjs back/tests/totp.integration.test.js
back/tests/cache-loading.test.js`: 24 tests passed (including parent suites).
Startup tests spawn the actual `server.js` against disposable real MongoDB, verify
HTTP availability and absence of Mongoose/dotenv banners, send SIGINT and SIGTERM,
verify clean exit and confirm the port is then unavailable. Authentication and cache
regressions pass with the updated options. Tests ran on Linux; Windows-specific
nodemon/process signal delivery and the user's local MongoDB/Redis were not tested.
