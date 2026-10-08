import { TablePreset, TableColumn } from './table-model';
const name = (u: any) =>
    u
        ? [u.firstname, u.lastname].filter(Boolean).join(' ') ||
          'Unnamed account'
        : 'Deleted account';
const roleName = (r: any) =>
    (
        ({
            user: 'Learner',
            admin: 'Administrator',
            trainer: 'Trainer',
            manager: 'Manager',
        }) as Record<string, string>
    )[Array.isArray(r.role) ? r.role[0] : r.role] || 'Not recorded';
const courseName = (c: any) => c?.title || 'Deleted course';
const student: TableColumn = {
    key: 'student',
    label: 'Student',
    get: (r) => name(r.user),
    sub: (r) => r.user?.email || '',
};
const course: TableColumn = {
    key: 'course',
    label: 'Course',
    get: (r) => courseName(r.course),
    filter: true,
};
const progress: TableColumn = {
    key: 'progress',
    label: 'Progress',
    get: (r) => r.progress ?? 0,
    type: 'progress',
    range: true,
};
const date: TableColumn = {
    key: 'date',
    label: 'Date',
    get: (r) => r.createdAt,
    type: 'date',
};
export const TABLES: Record<string, TablePreset> = {
    people: {
        label: 'People',
        detail: (r) => ({ kind: 'user', id: r._id }),
        columns: [
            {
                key: 'name',
                label: 'Person',
                get: name,
                sub: (r) => r.email || '',
            },
            {
                key: 'role',
                label: 'Role',
                get: roleName,
                type: 'badge',
                filter: true,
            },
            {
                key: 'account',
                label: 'Account',
                get: (r) => (r.isActive ? 'Active' : 'Inactive'),
                type: 'badge',
                filter: true,
            },
            { ...date, label: 'Joined' },
        ],
    },
    courses: {
        label: 'Courses',
        detail: (r) => ({ kind: 'course', id: r._id }),
        columns: [
            { key: 'name', label: 'Course', get: (r) => r.title },
            {
                key: 'category',
                label: 'Category',
                get: (r) => r.category || 'Uncategorized',
                filter: true,
            },
            {
                key: 'instructor',
                label: 'Instructor',
                get: (r) => name(r.trainer),
                filter: true,
            },
            {
                key: 'status',
                label: 'Status',
                get: (r) => (r.isApproved ? 'Published' : 'Pending'),
                type: 'badge',
                filter: true,
            },
            {
                key: 'access',
                label: 'Access',
                get: (r) => (r.price > 0 ? 'Paid' : 'Free'),
                filter: true,
            },
            {
                key: 'price',
                label: 'Price',
                get: (r) => r.price,
                type: 'money',
                range: true,
            },
            { ...date, label: 'Created' },
        ],
    },
    archived: {
        label: 'Archived courses',
        detail: (r) => ({ kind: 'course', id: r._id }),
        columns: [
            { key: 'name', label: 'Course', get: (r) => r.title },
            {
                key: 'category',
                label: 'Category',
                get: (r) => r.category || 'Uncategorized',
                filter: true,
            },
            {
                key: 'instructor',
                label: 'Instructor',
                get: (r) => name(r.trainer),
                filter: true,
            },
            { ...date, label: 'Archived', get: (r) => r.archivedAt },
        ],
    },
    assignments: {
        label: 'Team assignments',
        detail: (r) => ({ kind: 'user', id: r._id }),
        columns: [
            {
                key: 'name',
                label: 'Person',
                get: name,
                sub: (r) => r.email || '',
            },
            {
                key: 'manager',
                label: 'Manager',
                get: (r) =>
                    r.manager
                        ? typeof r.manager === 'object'
                            ? name(r.manager)
                            : 'Assigned'
                        : 'Unassigned',
                filter: true,
            },
            {
                key: 'status',
                label: 'Assignment',
                get: (r) => (r.manager ? 'Assigned' : 'Unassigned'),
                type: 'badge',
                filter: true,
            },
            { key: 'role', label: 'Role', get: roleName, filter: true },
        ],
    },
    reviews: {
        label: 'Reviews',
        detail: (r) => ({ kind: 'review', id: r._id }),
        columns: [
            { ...student, label: 'Reviewer' },
            course,
            {
                key: 'rating',
                label: 'Rating / 5',
                get: (r) => r.rating,
                type: 'number',
                range: true,
            },
            { key: 'comment', label: 'Comment', get: (r) => r.comment },
            {
                key: 'status',
                label: 'Status',
                get: (r) => (r.isApproved ? 'Approved' : 'Pending'),
                type: 'badge',
                filter: true,
            },
            date,
        ],
    },
    results: {
        label: 'Assessment results',
        detail: (r) => ({
            kind: 'result',
            id: r.enrollmentId,
            query: { assessment: r.type, lesson: r.lessonId },
        }),
        columns: [
            student,
            course,
            {
                key: 'assessment',
                label: 'Assessment',
                get: (r) => r.lessonTitle,
            },
            {
                key: 'type',
                label: 'Type',
                get: (r) =>
                    r.type === 'final_exam'
                        ? 'Final exam'
                        : r.type === 'lesson_quiz2'
                          ? 'Legacy quiz'
                          : 'Lesson quiz',
                filter: true,
            },
            {
                key: 'score',
                label: 'Score',
                get: (r) => r.score,
                type: 'progress',
                range: true,
            },
            {
                key: 'status',
                label: 'Result',
                get: (r) => (r.passed ? 'Passed' : 'Failed'),
                type: 'badge',
                filter: true,
            },
            {
                key: 'attempts',
                label: 'Attempts',
                get: (r) => r.attempts,
                type: 'number',
            },
            { ...date, label: 'Completed', get: (r) => r.completedAt },
        ],
    },
    overdue: {
        label: 'Overdue enrollments',
        detail: (r) => ({ kind: 'enrollment', id: r._id }),
        columns: [
            { ...student, label: 'Member' },
            course,
            progress,
            { ...date, label: 'Deadline', get: (r) => r.deadline },
        ],
    },
    history: {
        label: 'Learning history',
        detail: (r) => ({ kind: 'enrollment', id: r._id }),
        columns: [
            course,
            progress,
            {
                key: 'status',
                label: 'Status',
                get: (r) => (r.completed ? 'Completed' : 'In progress'),
                type: 'badge',
                filter: true,
            },
            { ...date, label: 'Enrolled' },
        ],
    },
};
export function operationsPreset(role: string): TablePreset {
    return {
        label: role === 'manager' ? 'Team progress' : 'Course performance',
        detail: (r) => ({
            kind: role === 'manager' ? 'user' : 'course',
            id: r.id,
        }),
        columns: [
            {
                key: 'name',
                label: role === 'manager' ? 'Learner' : 'Course',
                get: (r) => r.name,
                sub: (r) => r.detail,
            },
            {
                key: 'status',
                label: 'Status',
                get: (r) => r.status,
                type: 'badge',
                filter: true,
            },
            {
                key: 'total',
                label: role === 'manager' ? 'Courses' : 'Enrollments',
                get: (r) => r.total,
                type: 'number',
            },
            ...(role === 'admin'
                ? []
                : [
                      progress,
                      {
                          key: 'completed',
                          label: 'Completed',
                          get: (r: any) => r.completed,
                          type: 'number',
                      } as TableColumn,
                  ]),
        ],
    };
}
