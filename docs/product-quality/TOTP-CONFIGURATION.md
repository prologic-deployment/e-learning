# Fixing “Authenticator service is not configured”

This is a backend configuration error, not a role restriction. Setup encrypts the
new authenticator secret with `TOTP_ENCRYPTION_KEY`: it must decode from base64 to
exactly 32 bytes. Learners, trainers, managers and admins use the same setting.

## On the machine/container running the backend
1. From `back/`, run `npm run auth:check` using the same environment as the running
   API. The command prints validity only, never the key. A valid key does not prove
   that it is the original key used for existing enrollments.
2. **If any accounts have enabled or pending authenticators:** restore the original
   key from your secrets manager/backup. Do not generate a replacement, reset users,
   or reseed to work around this error. A new key cannot decrypt their old secrets.
3. **If no authenticators have ever been configured:** put the correct `MONGO_URI`
   in `back/.env` (or the command's environment), then run `npm run auth:configure`.
   It checks the database, refuses if stored factor material exists, and writes a
   new persistent key to `back/.env` with mode 0600. It does not print the key, and
   it refuses to replace an invalid existing key. Empty declarations are supported.
   Back up the resulting key securely. Use `AUTH_ENV_FILE` only when intentionally
   targeting a different environment file; ensure your API loads that same file.
4. Restart the API/process manager/container, then retry setup under Security & 2FA.
   For Docker/managed secrets, supply the key through the deployment environment;
   a file on the host is not automatically available inside a container. All API
   replicas must use the same persistent value. Do not leave an invalid environment
   override shadowing a valid `.env` value.

The API now reads its own `back/.env` independent of the launch directory. Production,
staging and preprod startup fail with an actionable error when the TOTP key is
missing/invalid; development warns so the problem is visible before setup. There is
no ephemeral, JWT-derived or hardcoded fallback. Setup validates configuration before
creating pending state. Provisioning is an operator command, never an HTTP endpoint.
Run it during a maintenance window with setup traffic stopped, especially with
multiple replicas. It validates format and checks for stored factor material; it
cannot locate a lost historical key.

Verification: 25 tests passed across configuration/provisioning, startup and both TOTP
suites. Tests cover persistence, no key logging, file permissions, refusal to overwrite
invalid or enrolled/pending keys, fail-fast production configuration, all-role setup,
login challenge gating, recovery, replay protection and disabling. Temporary files and
isolated databases only. No production environment was inspected or changed.

## Invalid key on Windows (follow-up)
The original provisioning command repeated the generic API error when a non-empty
invalid key (for example a placeholder) was present. It now identifies the source
without printing its value. For an invalid FILE setting, use:

```powershell
npm run auth:configure -- --replace-invalid
```

This flag still checks MongoDB and refuses replacement when ANY enabled or pending
factor exists. A valid existing key is never rotated by the flag. If a PROCESS
variable overrides the file, the command refuses to edit the file and explains how
to clear a stale PowerShell override with `Remove-Item Env:TOTP_ENCRYPTION_KEY`.
Only clear a stale value; restore the original secret for existing factors.
`AUTH_ENV_FILE` is now honored by the server and the check command as well as the
provisioner. On Windows, restrict the file using NTFS ACLs; Unix mode 0600 alone is
not a Windows access-control guarantee. Restart the API after configuration.
