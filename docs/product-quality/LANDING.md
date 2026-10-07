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
