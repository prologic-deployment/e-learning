# FormaPath landing page

## Delivered
- `/` now opens the new lazy-loaded standalone landing component, not authentication.
- `/welcome` redirects to `/`; neither route forces signed-in staff to a dashboard.
- Sign-in remains at `/profile-authentication`. Get started opens registration.
  Signed-in visitors receive a role-appropriate workspace link instead.
- Dedicated landing header/footer suppress the legacy public chrome only on this page.
- Editorial hero with illustrative learning cards, a five-step learning journey,
  interactive learner/trainer/manager/admin sections, live course previews, reporting
  and authenticator feature explanations, final CTA, and useful footer links.
- Actual existing Spartan Button/Card/Badge/Skeleton components. Role selection uses
  native buttons with aria-pressed; it is not presented as a new tabs primitive.
- Preserved navy/mist/teal/steel/red palette, responsive layouts, keyboard focus/skip
  link, labeled mobile navigation, finite entrance motion, hover effects and reduced
  motion support. No additional runtime dependency or generated stock image.
- FormaPath document metadata and SVG favicon. Existing non-landing legacy branding
  is outside this feature; this is not a claim of complete application rebranding.

## Data integrity
The preview calls CourseService.getAllCourses({limit:3,page:1}), the existing public
course endpoint. Titles/descriptions/categories/trainers are API values. Cover artwork
is decorative, not a claimed course photograph. No invented enrollment statistics,
ratings, testimonials, completion percentages or dashboard screenshots. The hero
cards illustrate learning concepts, not user records. Empty, pending and error states
are explicit, with a real retry action. Requests are canceled on navigation and old
requests canceled before retry; finalize clears pending state.

## Verified
- One-worker Angular development build: PASS; existing CommonJS warnings remain.
- `cd front && node tests/landing-browser.cjs`: PASS.
- Root first visit and welcome alias, metadata, role switching, registration CTA,
  mobile navigation, no horizontal overflow at 320/390/768/1440 pixels, reduced motion,
  no browser page errors, and workspace-link mapping for four client role states.
- Course API contract success/empty/error/retry/pending/navigation cancellation tested
  with isolated Playwright response injection; never shipped as application data.
  Client-role injection tests route affordances, not server authorization.
- Desktop/mobile screenshots capture the actual preview API-unavailable state without
  course fixtures. This workspace had no live production backend; production course
  availability is not claimed. Start the backend to load your actual published courses.
- Production-optimized build and assistive-technology audit not run for this change.

## Local use
Pull v1.0, run npm ci in front if necessary, and start the backend and frontend in
separate terminals. Open http://localhost:4200/ to see the landing page first.

## Navigation, translation, theme and assistant follow-up

- Section links now explicitly navigate with an Angular fragment and focus/scroll the
  matching section. Removed the root component's unconditional scroll-to-top handler,
  which conflicted with fragment navigation. Router anchor scrolling and back/forward
  scroll restoration are enabled. Desktop, mobile, hero, skip and footer anchors use
  the same behavior and respect reduced motion.
- Added a reusable `TranslationModule`, `TranslationService` and `t` pipe with English
  fallback and French UI copy. Landing sections, role descriptions, navigation, labels,
  error/empty states and the assistant UI switch immediately. Locale persists in
  `formapath-language`; document language follows the landing selection. Course data
  and conversation content are not falsely presented as translated. Other application
  pages have not been translated by this feature.
- Light/dark control persists using the existing `lms-theme` preference. The landing
  previously used fixed light surfaces; its sections, navigation, cards, typography,
  controls and chat panel now have appropriate dark surfaces and readable contrast.
- A standalone, fixed bottom-right assistant opens a nonmodal, named chat dialog.
  Escape closes it and restores launcher focus. It fits mobile visual layout, uses a
  scrolling conversation log, and provides clear/send/cancel/error/retry states.
- Uses the existing protected `POST /api/chatbot/chat` contract (message plus history).
  Guest visitors see a sign-in CTA with returnUrl=/; no authentication or quota bypass
  was introduced. No chat contents are written to localStorage. Responses are rendered
  as text, not trusted HTML; source links only accept HTTP(S), with noopener/noreferrer.
  Pending requests are bounded and canceled on navigation; cancellation preserves
  the draft. Backend/provider failure preserves the message for retry.

### Follow-up verification
`front/tests/landing-controls.cjs` passed: actual section scroll positions/fragments,
EN/FR persistence, light/dark persistence, French mobile menu, no overflow at
320/390/768/1440, fixed launcher during scrolling, panel viewport bounds, guest sign-in,
Escape/focus, request/history format, failure/retry, quota feedback, cancellation,
unsafe HTML/link handling, and no browser page errors. Chat responses in these tests
are explicitly isolated fixtures: a live Gemini/RAG answer was NOT verified, and still
requires the backend's AI configuration and a signed-in account. Existing landing
browser regressions and the Angular development build also passed. Production build
and full-screen-reader verification remain outside this test run.

### Full-width and sticky-header polish
Replaced the native select with an actual Spartan/CDK menu, bundled SVG flags,
English/Français names and a current-language checkmark. Fixed the global product-page
1440px canvas cap only for the landing page; content remains readable and centered,
while light/dark surfaces now cover the full viewport. Header is sticky and full-width.
ResizeObserver plus Angular ViewportScroller offset account for its responsive height;
without the Angular offset, the router's later scroll could cover section headings.
The chat launcher has finite welcome motion, hover feedback and reduced-motion support.
`front/tests/landing-polish.cjs` and Angular development build passed: menu selection,
Escape, no gutters/overflow at 320/390/768/1440/1920/2560, sticky position and correct
section offsets. Chat backend functionality is tracked separately below.

### Chat behavior update (supersedes the earlier guest sign-in limitation)
The landing assistant now accepts guest messages using a new limited public-catalogue
endpoint. Existing protected chat/reindex endpoints remain protected. The panel can
return actual published-course answers and source links even without Gemini, with an
explicit catalogue-mode label. See `CHATBOT.md` for provider requirements, anonymous
budgets, private-data boundaries and real HTTP/MongoDB/browser verification.
