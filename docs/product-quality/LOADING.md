# Loading fixes — incremental evidence

## Optional cache / all cached API consumers

**Root causes:** Redis listeners attached after awaited connection; the wrapper exposed
an offline client; offline operations could queue; startup waited for this optional
service; cache population awaited a write before sending the successful API response.

**Fix:** listeners precede connection; `getClient()` only returns a ready client;
offline queuing is disabled and requests are not retried; short cache-only connection
and command budgets fail over to real handlers; API startup does not await Redis;
cache writes run independently of `res.json`. This is not an increased HTTP timeout.
MongoDB remains a required startup dependency. AI/provider waiting states are separate
and are not claimed fixed by this change.

**Regression evidence:** `node --test back/tests/cache-loading.test.js`: ready-event race,
offline bypass, rejected read fallback, indefinitely unresolved write without blocking
response, and genuine cache hit. Deterministic fault injection in tests only. A live
Redis outage/reconnection staging test remains unverified.

## Other pages

The page-specific findings in `AUDIT.md` are still pending. Do not interpret this
backend fix as completion of all loading, retry, cancellation or skeleton acceptance.
