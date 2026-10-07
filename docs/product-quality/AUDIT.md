# Product-quality audit — baseline e148b75, branch v1.0

Branch verified; remote pulled fast-forward; working tree clean before implementation.

## Form inventory (static source scan + handler review)

Includes routed screens, reusable components and legacy/unrouted templates. Counts are
controls in the template, not unique API workflows. Inline component forms are also
reviewed: course-details-form, learning compositions, and management tables.

| Template | Controls | Model bindings |
|---|---:|---|
| `front/src/app/components/analytics/operations-overview.component.html` | 2 | `query, sort` |
| `front/src/app/components/layout/workspace-shell.component.html` | 1 | `query` |
| `front/src/app/components/management/record-table.component.html` | 4 | `query, filter, sort, proposedRole` |
| `front/src/app/components/pages/contact-page-one/contact-page-one.component.html` | 5 | `contactForm.name, contactForm.email, contactForm.subject, contactForm.phone, contactForm.message` |
| `front/src/app/components/pages/contact-page-two/contact-page-two.component.html` | 5 | `contactForm.name, contactForm.email, contactForm.subject, contactForm.phone, contactForm.message` |
| `front/src/app/components/pages/course-viewer/course-viewer.component.html` | 4 | `newReview.rating, newReview.comment, editingReview.rating, editingReview.comment` |
| `front/src/app/components/pages/courses-basic-grid-page/courses-basic-grid-page.component.html` | 3 | `searchQuery, selectedCategory, selectedType` |
| `front/src/app/components/pages/courses-left-sidebar-page/courses-left-sidebar-page.component.html` | 1 | `` |
| `front/src/app/components/pages/courses-list-sidebar-page/courses-list-sidebar-page.component.html` | 1 | `` |
| `front/src/app/components/pages/courses-modern-grid-page/courses-modern-grid-page.component.html` | 1 | `` |
| `front/src/app/components/pages/courses-right-sidebar-page/courses-right-sidebar-page.component.html` | 1 | `` |
| `front/src/app/components/pages/courses-wide-grid-page/courses-wide-grid-page.component.html` | 1 | `` |
| `front/src/app/components/pages/cv-page/cv-page.component.html` | 20 | `cvInfo.prenom, cvInfo.nom, cvInfo.email, cvInfo.telephone, cvInfo.description, newExperience.titre, newExperience.entreprise, newExperience.dateDebut, newExperience.dateFin, newExperience.description, newFormation.diplome, newFormation.etablissement, newFormation.dateDebut, newFormation.dateFin, newCompetence.nom, newCompetence.niveau, newLangue.langue, newLangue.niveau, newHobby.nom` |
| `front/src/app/components/pages/forgot-password-page/forgot-password-page.component.html` | 1 | `email` |
| `front/src/app/components/pages/free-courses-single-page/free-courses-single-page.component.html` | 9 | `` |
| `front/src/app/components/pages/paid-courses-single-page/paid-courses-single-page.component.html` | 4 | `newReview.rating, newReview.comment, editingReview.rating, editingReview.comment` |
| `front/src/app/components/pages/product-details-page/product-details-page.component.html` | 10 | `inputnumber` |
| `front/src/app/components/pages/products-page/products-page.component.html` | 1 | `` |
| `front/src/app/components/pages/profile-authentication-page/otp-popup.component.html` | 1 | `` |
| `front/src/app/components/pages/profile-authentication-page/profile-authentication-page.component.html` | 9 | `loginData.email, loginData.password, otpCode, registerData.firstname, registerData.lastname, registerData.email, registerData.dateOfBirth, registerData.phone, registerData.password` |
| `front/src/app/components/pages/reset-password/reset-password.component.html` | 2 | `newPassword, confirmPassword` |
| `front/src/app/components/pages/remote-training-demo/rtd-banner/rtd-banner.component.html` | 1 | `` |
| `front/src/app/components/pages/dashboard/admin-dashboard/admin-dashboard.component.html` | 20 | `searchQuery, newQuiz.noteMinimale, newQuiz2.noteMinimale, newLesson.title, newLesson.content, newFinalExam.noteMinimale, assignUserId, assignManagerId, newStaff.firstname, newStaff.lastname, newStaff.email, newStaff.password, newStaff.dateOfBirth` |
| `front/src/app/components/pages/dashboard/manager-dashboard/manager-dashboard.component.html` | 12 | `selectedCourseId, assignDeadline, selectedDeadline, profileData.firstname, profileData.lastname, profileData.phone, profileData.address, passwordData.currentPassword, passwordData.newPassword, passwordData.confirmPassword` |
| `front/src/app/components/pages/dashboard/trainer-dashboard/trainer-dashboard.component.html` | 20 | `newQuiz.noteMinimale, newQuiz2.noteMinimale, newLesson.title, newLesson.content, newFinalExam.noteMinimale, profileData.firstname, profileData.lastname, profileData.phone, profileData.address, passwordData.currentPassword, passwordData.newPassword, passwordData.confirmPassword` |
| `front/src/app/components/pages/dashboard/user-dashboard/user-dashboard.component.html` | 10 | `courseQuery, courseStatus, profileData.firstname, profileData.lastname, profileData.phone, profileData.address, passwordData.currentPassword, passwordData.newPassword, passwordData.confirmPassword` |
| `front/src/app/components/common/chatbot/chatbot.component.html` | 1 | `message` |
| `front/src/app/components/common/navbar/navbar.component.html` | 1 | `searchQuery` |

## Authentication audit
Password login currently creates a bcrypt-hashed email code; duplicate model methods use
field encryption instead. An email-code route issues the final JWT. A development flag
can return the second factor in a response. Remove both implementations, the popup,
resend flow, flag, generator, delivery template and code-specific fields. Keep hashed
password reset links and certificate verification (neither is login verification).

Session middleware currently reads tokenVersion without selecting the hidden field.
Socket handshakes verify signatures but not current account activation/tokenVersion.
Password reset/change must explicitly select and atomically increment the real version.
Existing localStorage JWT storage predates this change; new setup keys, challenge tokens,
and recovery codes must never be stored there. Sign-in challenges will be opaque,
expiring, attempt-limited database records, not authenticated JWTs.

## Loading audit
- Redis ready/error listeners attach after awaited connect; offline clients remain
  usable via getClient and queue operations. Cache middleware awaits cache writes before
  sending responses. Optional cache therefore stalls otherwise valid API operations.
- Learner route subscription calls setTab, which navigates and reloads; initialization
  separately loads profile. Missing subscription teardown and repeated requests.
- Course viewer starts enrollment and lesson loads concurrently; route snapshot-only
  initialization can retain previous-course state; enrollment errors are swallowed.
- Course detail without an ID stays loading forever. Several legacy aliases reach it.
- Catalogue requests race on rapid filters; old responses overwrite new filters.
- CV/recommendations swallow errors and show empty/stale state; mutation failures need
  explicit reset/feedback. Staff stats errors are not cleared before retry.
- No route resolvers found. Guards are synchronous; HTTP interceptor currently attaches
  credentials too broadly and lacks a consistent safe client-facing error vocabulary.

## Product context
Current user-facing names are Edla and E-Learning. Palette and Spartan primitives are
already present. Proposed identity: **FormaPath** — formation + a visible learning path.
This is a product naming decision, not a claim of trademark/domain clearance.
No organization-wide metrics will be exposed publicly. Public showcases may render
actual public catalogue records; unavailable/empty data must remain truthful. Role and
workflow illustrations must be explicitly schematic, not invented product statistics.

## Verification strategy
Real temporary MongoDB for isolated integration tests with test-only accounts; no test
fixtures in the public application. Test password-only/TOTP login, replay/concurrency,
recovery consumption, setup/disable, token revocation, authorization and safe serialization.
Browser checks exercise real endpoints when possible, and isolated fault injection for
loading regression tests is labeled as testing, never application data.
