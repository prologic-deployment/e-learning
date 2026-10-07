# FormaPath application design unification

## 1. Shared application foundations
A single PublicHeader/PublicFooter/Brand composition now serves the landing and every
public page, replacing the unrelated legacy navigation/footer templates. It includes
real Spartan controls, the language picker, persisted theme, mobile menu, course links,
and correct role workspace links. Removed the legacy navbar's unused suggestions,
local notification counters and its nested chatbot mount; actual notifications remain
in the existing app service/workspaces. A single assistant is mounted globally on
non-authentication pages.

A shared workspace route boundary keeps `/courses-grid` and public course details in
the same catalogue layout for guests and all roles; previously the substring `course`
in the shell regex unexpectedly switched signed-in visitors to another layout. Learner,
trainer, manager and admin continue to use role-specific workspace navigation. All
four use the same FormaPath brand, ThemeService, semantic surfaces, editorial headings,
buttons and quiet rail styling. Navigation/permissions/endpoints were not weakened.

Tests: development build and `front/tests/shared-design.cjs` PASS. Public landing,
index, details, about/contact chrome, all four client-role shell states, dark preference,
mobile bounds, and one assistant instance. The role checks use explicit client-state
fixtures and API failures; they do not establish backend authorization or all workflows.

## Remaining acceptance boundaries
This is shared design architecture, not a claim that every legacy form has been
individually rewritten or that every business workflow was end-to-end tested.
Catalogue rebuild and further workspace surface review are recorded below as completed.

## 2. Course library composition and request lifecycle
Rebuilt `/courses-grid` with the landing's open editorial introduction, italic accent,
compact search, horizontal access/subject filters, removable filter chips, course cover
system, consistent typography/cards, and a quieter pagination/footer transition.
Controls use actual Spartan button, input, label, badge, card and skeleton primitives.
No fabricated application courses, reviews or statistics: all cards/counts/prices and
ratings come from the existing backend APIs. Cover artwork is decorative, not a claim
of a course-provided thumbnail. EN/FR UI copy is included; course content stays original.

Filters and pagination live in URL query parameters, support browser back/deep links,
and reset page on filter changes. `switchMap` aborts superseded catalogue requests;
review subscriptions are cleaned up separately. Skeleton, error/retry, empty and loaded
states are distinct. All five old catalogue layout URLs redirect to this single library.
Shared header retains landing anchors and mobile Escape restores focus. Shared footer
retains back-to-top. Removed landing's competing scroll-offset/locale reset hooks.

PASS: development build; catalogue-design, shared-design, language-switcher,
landing-controls, landing-browser and landing-polish browser tests. Catalogue covers
filters, browser back, pagination, stale responses, failure/retry/empty, EN/FR, theme,
320/390/768/1440 widths and alias redirects. Light/dark screenshots are explicitly
labelled test-response fixtures, not production catalogue data. Light screenshot
visually inspected. No live backend data or complete purchase/learning workflow tested.

## 3. Workspace and public-page composition
Introduced PageHeading, a reusable projected-content composition used by all four role
dashboards and rebuilt About/Contact pages. Auth, registration and both recovery pages
now use the actual shared Brand component rather than different hand-written logos.
About now explains existing product capabilities rather than displaying unverified
company statistics/client lists. Legacy category routes preserve query parameters while
opening the library, no-ID detail demos open the library, and contact-2 opens contact.

Contact previously simulated sending with a timer. It now uses real Spartan fields,
validation and an explicitly labelled email-draft action with the existing Prologic
address. It does not claim delivery or promise a response time; no messaging backend
was added and no email was sent in tests.

PASS: app-composition browser test: all four role headings, About/Contact 320–1440,
contact validation, auth/recovery shared brand, aliases and preserved category query.
Role/API fixtures deliberately exercise loading failures, not live operational metrics.
A condition-based post-resize wait verifies final document bounds (workspace transitions
can briefly retain the previous viewport width). Trainer screenshot documents API-error
state. Legacy nested management/CV forms are not all rewritten by this composition pass.

## 4. Learner supporting workspaces
Recomposed cart as a course list and summary, recommendations as interest context plus
quiet course cards with expandable real score explanations, and CV as section navigation
plus six semantic forms. CV uses FormField/Spartan inputs, selects, labels, cards and
buttons; submitted required/email validation, date-order checks, pending mutations,
visible API errors and component-destroy cleanup were added. Security uses PageHeading.
All existing CV endpoints and PDF download remain; all recommendation scores still
come from the backend. No invented progress, reviews, skill matching or payments.

Cart GET failures no longer masquerade as an empty cart. Mutations expose pending/error
states. Recommendations clear stale errors on retry and cancel superseded requests.
Fixed an existing narrow-screen workspace-topbar overflow caused by global padding on
Spartan buttons. Textareas now retain useful editing height and heading actions no
longer compress into wrapped labels.

Important pre-existing limitation found: `/checkout` does not exist and the backend only
registers a simulated payment provider. Replaced the dead payment link with an explicit
unavailable-payment notice and contact action. This change does NOT implement payments
or silently simulate a purchase; the payment backend was not changed.

PASS: development build and learner-composition browser test: cart error/empty/clear,
recommendation error/retry/API scores, all six CV forms' labels and required validation,
CV multipart save contract, security heading, theme and 320/390/768/1440 bounds. Tests
use controlled API fixtures, not production mutations. CV and dark catalogue screenshots
visually inspected. Full live authorization, payment, certificate/exam and every nested
management-form workflow remain unverified. Nested staff forms retain existing structure.

## 5. Staff editor integration and final route sweep
Trainer, manager and administrator nested editors now use the existing real Spartan
button/input/select/textarea/card directives and reusable FormField where simple adjacent
labels permitted safe migration. Their role-specific lesson/quiz/exam/team/staff/review
structures, event handlers and conditional rendering are preserved. Hard-coded white,
gradient and text colors in those panels now resolve through shared theme tokens,
including selected row/answer surfaces. This is a design/control integration, not a claim
that every staff form's validation and mutation lifecycle has been rewritten.

Found and fixed a manager assignment checkbox bug: its click stopped bubbling to the
row but never updated the selected-user list. Added change handling and an accessible
member-specific label, preserving row click behavior.

PASS: development build and staff-composition browser test. Fifteen staff destinations
checked at 390/1440, both themes and label/control associations. Trainer course creation
verified against an explicit mock API contract and its resulting curriculum surface;
manager checkbox verified checked/unchecked counts. No real courses/accounts were
created. Full backend authorization and all lesson/assessment mutations remain untested
in this design pass; existing backend security logic was not modified.

### Final regression result
At the final source state: development build PASS; all nine browser suites PASS:
landing-browser, landing-controls, landing-polish, language-switcher, shared-design,
catalogue-design, app-composition, learner-composition, staff-composition. The landing
suite also checks 2560px full-bleed behavior. Build retains existing CommonJS warnings.
Production build, screen-reader audit and a live all-role end-to-end business-workflow
suite were not run. Screenshots contain labelled test data or explicit test API failures.
