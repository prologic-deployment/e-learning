# Dashboard/detail audit (before implementation)

Branch synchronized with origin/v1.0 at 9cc6e52; main unchanged. Restored workspace
files matched the published tree before the branch reference was reconciled.

Roles: admin, trainer, manager, user. Active routes audited in app-routing.module.ts.
Reusable primitives: UiModule's real Spartan/CDK dialog/table/card/badge/progress,
RecordTableComponent, OperationsOverviewComponent, existing root feedback outlets.

Entity tables: shared people/staff and course library; operations overview (admin
popular courses, trainer courses, manager team); admin archive, manager assignment,
review moderation and assessment results; trainer assessment results; manager overdue
enrollments; learner enrollment history. The product-details-page specification table
is static legacy presentation with no active product route or backend entity; it is
not a data-record table. Categories redirect to the library; lessons/questions use
builder editors/cards rather than tables.

Observed code-level latency sources:
- trainer stats: 2 initial queries + 2 queries per course, with complete documents;
- manager stats: full enrollments and repeated user/course populations, an additional
  overdue query, and O(team size * enrollments) member filtering;
- admin stats: several independent aggregate requests awaited sequentially;
- learner ngOnInit + overview both request profile, tab clicks mutate state and then
  query-param subscriptions load the same tab again; notifications similarly overlap;
- admin assignment fetches all users twice to derive managers;
- stats are fetched even when landing directly on unrelated authoring/profile tabs;
- trainer course-load failure falls back to a second, differently scoped public API;
- table getters repeatedly sort/filter arrays within each change detection pass.

Assessment source of truth: embedded Enrollment quizResults/quiz2Results/finalExamResult
store latest summary per assessment. AssessmentAttempt retains timed paper + answers;
untimed submissions currently discard answers. Standalone QuizResult/Question/Quiz/
FinalExam are legacy and are not the active grading pipeline. Never reconstruct a
historical student's answers from today's mutable quiz or infer them from a score.

Implementation boundaries: retain grading/attempt/eligibility rules, do not expose
answer keys through learner lists, scope result reviews to admins and course owners,
limit manager details to their team, retain table action controls and exports. Detail
responses must use explicit DTOs/projections, never raw user/enrollment serialization.
