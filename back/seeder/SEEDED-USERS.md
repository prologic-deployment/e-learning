# Isolated test accounts

Use the seeder only in a disposable development database. Never seed production.
Password-only fixture accounts receive a session from `POST /api/auth/login`.
Accounts that enable an authenticator must complete the normal second-factor flow.
There is no development factor bypass. See `docs/product-quality/AUTHENTICATION.md`.
