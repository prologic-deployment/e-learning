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
