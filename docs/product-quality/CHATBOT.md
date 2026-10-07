# Working landing assistant

## What changed
The landing panel previously required sign-in and every answer depended on Gemini and
retrieval services. The project already contained Gemini integration, but failures
ended in a generic 500 and generic “available courses” questions could return no
keyword matches. The new handler reuses the existing Gemini SDK, configured key,
default model and response contract, with current, explicitly projected public
MongoDB course context. It no longer requires Qdrant or an embedding request for chat.
The existing vector indexing code remains available to authorized administrators;
other RAG consumers have not been removed.

- Guests use `/api/chatbot/public-chat`; signed-in users retain `/api/chatbot/chat`.
- Authenticated chat and admin-only reindex remain protected. The new guest endpoint
  is intentionally limited to published, non-archived course facts and public help.
  It never returns lesson bodies, exam answers, enrollment lists or user contact data.
- Anonymous requests: 10 per IP/hour and 60 total/hour per API process, applied before
  model execution. Signed-in requests retain existing per-user quotas. For multiple
  API instances, use shared limiter storage/edge budgets; the current limiter store is
  in-memory, not a cross-cluster guarantee. Configure trusted proxies narrowly when
  deploying behind a proxy. Anonymous AI use can consume configured provider quota.
- Input: 2,000-character message limit, bounded/validated alternating history, no-store
  responses, literal-escaped search terms and bounded database query work.
- Generic course lists and EN/FR free/paid filters query real published records. Course
  URLs are relative to the app instead of assuming the operator's localhost URL.
- `mode: ai` means a Gemini answer. `mode: catalogue` means a deterministic response
  from real database results; the UI visibly labels it as AI-unavailable catalogue
  mode. Missing key, provider rejection or timeout falls back without invented facts.
  No matching records is reported honestly. A database failure returns a retryable
  503, not fabricated courses or a misleading empty-success result.
- Provider calls use a 12-second SDK timeout and disconnect cancellation instead of
  serial retry sleeps. Provider URLs/errors/keys and conversations are not logged.
- Landing conversation keeps recent bounded history; failed/canceled drafts survive
  for retry. Existing legacy chat history was bounded too and labels catalogue mode.

## Local configuration
Keep the backend running with MongoDB configured. The live catalogue fallback needs no
AI key and no Qdrant. For generated answers, keep the project's valid `GEMINI_API_KEY`
in `back/.env` (never commit it). Optional `GEMINI_CHAT_MODEL` defaults to
`gemini-2.5-flash`; availability depends on the provider/account. Restart the backend
when configuration changes. No credentials were created or configured by this change.

## Executed tests
- `npm run test:chat` in back: real disposable MongoDB test. Published vs draft/archive
  filtering, actual price/free filtering, generic lists, French, no-match, input/history
  validation, protected legacy endpoints, anonymous quota. Injected provider success
  and failure test the response contract/fallback; they do NOT establish live Gemini
  access. Seven subtests plus their parent passed.
- Together with authentication and cache suites: 29 tests passed.
- `node tests/chatbot-live-api.cjs` in front while the **test-only** backend
  `node tests/chat-browser-api.cjs` runs: passed real guest browser → HTTP → Express →
  MongoDB → course answer/source → subsequent no-match. No browser response mocks or
  auth tokens. One isolated TEST ONLY record is created by this harness, not by the
  application, seeder, or normal server startup. Test API was stopped after verification.
- Landing controls, existing landing regression and full-width/sticky menu browser
  suites passed. Angular development build passed.
- Actual Gemini generation with an operator account was not tested. Production build,
  multi-instance rate limiting and exhaustive AI-answer quality are not claimed.
