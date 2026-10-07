# Isolated test accounts

Use the seeder only in a disposable development database. Never seed production.
Password-only fixture accounts receive a session from `POST /api/auth/login`.
Accounts that enable an authenticator must complete the normal second-factor flow.
There is no development factor bypass. See `docs/product-quality/AUTHENTICATION.md`.

Current fixture counts, explicit write/fresh safeguards, and synthetic login credentials
are documented in `README.md`. Normal reruns preserve passwords and enabled 2FA. A
missing TOTP encryption key must be configured/restored separately; seeding does not
bypass authenticator protection or repair a lost key.
