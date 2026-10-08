/** Canonical, framework-free policy. Generate the Node copy with npm run validation:sync. */
export type Issues = Record<string, string>;
export interface UploadInfo {
    fieldname: string;
    name: string;
    size: number;
    type: string;
}
const empty = (v: any) => v === undefined || v === null || v === '';
const object = (v: any) => !!v && typeof v === 'object' && !Array.isArray(v);
const utf8 = (v: string) => new TextEncoder().encode(v).length;
export function fieldIssue(rule: string, value: any, required = false): string {
    if (empty(value)) return required ? 'This field is required.' : '';
    if (rule === 'number' || rule === 'price' || rule === 'rating') {
        if (
            (typeof value !== 'number' && typeof value !== 'string') ||
            (typeof value === 'string' &&
                !/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(
                    value.trim(),
                )) ||
            !Number.isFinite(Number(value))
        )
            return 'Enter a finite number.';
        const n = Number(value);
        if (
            rule === 'price' &&
            (n < 0 ||
                n > 1000000 ||
                Math.abs(n * 100 - Math.round(n * 100)) > 0.00001)
        )
            return 'Use a price from 0 to 1,000,000 with at most two decimal places.';
        if (rule === 'rating' && (!Number.isInteger(n) || n < 1 || n > 5))
            return 'Choose a whole-number rating from 1 to 5.';
        return '';
    }
    if (typeof value !== 'string') return 'Enter text, not a structured value.';
    // Existing passwords are opaque: do not add strength or whitespace rules to login.
    if (rule === 'currentPassword')
        return utf8(value) > 72
            ? 'Password must not exceed 72 UTF-8 bytes.'
            : '';
    if (!value.trim())
        return required ||
            [
                'name',
                'title',
                'email',
                'password',
                'currentPassword',
                'id',
                'birth',
                'date',
                'deadline',
            ].includes(rule)
            ? 'This field cannot contain only spaces.'
            : '';
    const lengths: Record<string, number> = {
        name: 100,
        title: 200,
        email: 320,
        phone: 40,
        address: 500,
        text: 2000,
        description: 10000,
        content: 100000,
        message: 4000,
        chat: 2000,
        search: 100,
        option: 1000,
        question: 2000,
        category: 100,
        currentPassword: 1024,
        recovery: 48,
        code: 6,
    };
    if (lengths[rule] && value.length > lengths[rule])
        return `Use no more than ${lengths[rule]} characters.`;
    if (rule === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
        return 'Enter a valid email address.';
    if (
        (rule === 'phone' && !/^\+?[0-9\s().-]{6,40}$/.test(value)) ||
        (rule === 'phone' && value.replace(/\D/g, '').length < 6)
    )
        return 'Enter a valid phone number (digits, spaces, +, parentheses or hyphens).';
    if (
        rule === 'password' &&
        (value.length < 8 ||
            utf8(value) > 72 ||
            !/[A-Z]/.test(value) ||
            !/[0-9]/.test(value))
    )
        return 'Use at least 8 characters, an uppercase letter and a number (maximum 72 UTF-8 bytes).';
    if (rule === 'id' && !/^[a-f\d]{24}$/i.test(value))
        return 'Choose a valid record.';
    if (rule === 'code' && !/^\d{6}$/.test(value))
        return 'Enter the six-digit authenticator code.';
    if (
        rule === 'recovery' &&
        !/^[a-f0-9]{32}$/i.test(value.replace(/[-\s]/g, ''))
    )
        return 'Enter a complete recovery code.';
    if (['date', 'birth', 'deadline'].includes(rule)) {
        if (
            !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) ||
            !Number.isFinite(Date.parse(value)) ||
            new Date(value.slice(0, 10) + 'T00:00:00Z')
                .toISOString()
                .slice(0, 10) !== value.slice(0, 10)
        )
            return 'Enter a valid calendar date.';
        const today = new Date().toISOString().slice(0, 10);
        if (rule === 'birth' && value.slice(0, 10) > today)
            return 'Birth date cannot be in the future.';
        if (rule === 'deadline' && value.slice(0, 10) < today)
            return 'Choose today or a future deadline.';
    }
    return '';
}
export function validateRequest(
    method: string,
    rawPath: string,
    body: any,
    files: UploadInfo[] = [],
): Issues {
    const issues: Issues = {};
    if (!['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) return issues;
    const path = rawPath
        .split('?')[0]
        .replace(/^.*?\/api(?=\/|$)/, '')
        .replace(/\/$/, '');
    if (!object(body)) return { form: 'Submit a valid form object.' };
    try {
        if (utf8(JSON.stringify(body)) > 1024 * 1024)
            return {
                form: 'Keep form data under 1 MB. Upload larger lesson material as a file.',
            };
    } catch {
        return { form: 'Submit serializable form values.' };
    }
    const field = (
        key: string,
        rule: string,
        required = false,
        source: any = body,
        prefix = '',
    ) => {
        const error = fieldIssue(
            rule,
            source?.[key],
            required ||
                (source?.[key] !== undefined &&
                    ['name', 'title', 'email', 'price'].includes(rule)),
        );
        if (error) issues[prefix + key] = error;
    };
    const integer = (
        key: string,
        min: number,
        max: number,
        source: any = body,
        prefix = '',
        required = false,
    ) => {
        const v = source?.[key];
        if (empty(v)) {
            if (required) issues[prefix + key] = 'This field is required.';
            return;
        }
        if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
            issues[prefix + key] = `Use a whole number from ${min} to ${max}.`;
    };
    const choice = (
        key: string,
        values: any[],
        required = false,
        source: any = body,
        prefix = '',
    ) => {
        if (empty(source?.[key]) && !required) return;
        if (!values.includes(source?.[key]))
            issues[prefix + key] = 'Choose an available option.';
    };
    const names = (required = false) => {
        field('firstname', 'name', required);
        field('lastname', 'name', required);
    };
    const credentials = (required = true) => {
        names(required);
        field('email', 'email', required);
        field('password', 'password', required);
        field('dateOfBirth', 'birth', required);
        field('phone', 'phone');
    };
    const proof = () => {
        if (body.recoveryCode !== undefined)
            field('recoveryCode', 'recovery', true);
        else field('code', 'code', true);
    };
    if (path === '/auth/register') credentials();
    if (path === '/auth/login') {
        field('email', 'email', true);
        field('password', 'currentPassword', true);
    }
    if (path === '/auth/forgot-password') field('email', 'email', true);
    if (path.startsWith('/auth/reset-password/'))
        field(
            body.newPassword !== undefined ? 'newPassword' : 'password',
            'password',
            true,
        );
    if (path === '/auth/change-password') {
        field('currentPassword', 'currentPassword', true);
        field('newPassword', 'password', true);
    }
    if (
        path === '/auth/two-factor/setup' ||
        path === '/auth/two-factor/disable'
    )
        field('currentPassword', 'currentPassword', true);
    if (
        path === '/auth/two-factor/verify' ||
        path === '/auth/two-factor/disable'
    )
        proof();
    if (path === '/auth/two-factor/confirm') field('code', 'code', true);
    if (
        body.confirmPassword !== undefined &&
        body.confirmPassword !== (body.newPassword ?? body.password)
    )
        issues['confirmPassword'] = 'Passwords must match.';
    if (
        ['/users/staff', '/users/create-trainer', '/users/managers'].includes(
            path,
        )
    ) {
        credentials();
        if (path === '/users/staff')
            choice('role', ['admin', 'trainer', 'manager'], true);
    }
    if (/^\/users\/[^/]+\/role$/.test(path)) {
        choice('role', ['admin', 'trainer', 'manager', 'user'], true);
        if (body.isActive !== undefined) choice('isActive', [true, false]);
    }
    if (['/profile', '/profile/update', '/users/me'].includes(path)) {
        names();
        field('email', 'email');
        field('phone', 'phone');
        field('address', 'address');
        if (body.password !== undefined)
            issues['password'] = 'Use the password change form.';
    }
    if (path === '/courses' || /^\/courses\/[^/]+$/.test(path)) {
        field('title', 'title', method === 'POST');
        field(
            'description',
            'description',
            method === 'POST' || body.description !== undefined,
        );
        field('category', 'category');
        field('subCategory', 'category');
        field('price', 'price');
        if (body.tags !== undefined) {
            const tags =
                typeof body.tags === 'string'
                    ? body.tags.split(',').filter((v: string) => v.trim())
                    : body.tags;
            if (
                !Array.isArray(tags) ||
                tags.length > 20 ||
                tags.some(
                    (v: any) =>
                        typeof v !== 'string' || !v.trim() || v.length > 50,
                ) ||
                (Array.isArray(tags) &&
                    new Set(
                        tags.map((v: any) =>
                            typeof v === 'string' ? v.trim().toLowerCase() : v,
                        ),
                    ).size !== tags.length)
            )
                issues['tags'] =
                    'Use up to 20 distinct tags of 1–50 characters.';
        }
    }
    if (/^\/lessons\/(course\/)?[^/]+$/.test(path)) {
        field('title', 'title', method === 'POST');
        field('content', 'content');
        if (body.order !== undefined) {
            const n = Number(body.order);
            if (!Number.isInteger(n) || n < 0 || n > 10000)
                issues['order'] =
                    'Use a whole-number lesson order from 0 to 10000.';
        }
        choice('isFree', [true, false, 'true', 'false']);
    }
    if (path === '/managers/assign-user') {
        field('userId', 'id', true);
        field('managerId', 'id', true);
    }
    if (path === '/managers/assign-course') {
        field('courseId', 'id', true);
        field('deadline', 'deadline');
        if (
            !Array.isArray(body.userIds) ||
            !body.userIds.length ||
            body.userIds.length > 1000 ||
            body.userIds.some((v: any) => !!fieldIssue('id', v, true)) ||
            new Set(body.userIds).size !== body.userIds.length
        )
            issues['userIds'] = 'Choose 1–1000 distinct learners.';
    }
    if (path === '/enrollments/deadline') {
        field('enrollmentId', 'id', true);
        field('deadline', 'deadline', true);
    }
    if (/^\/enrollments\/[^/]+\/progress$/.test(path)) field('lessonId', 'id');
    if (['/cart/add', '/purchases/buy', '/nlp/summarize'].includes(path))
        field('courseId', 'id', true);
    if (/^\/reviews\/(course\/)?[^/]+$/.test(path)) {
        field('rating', 'rating', true);
        field('comment', 'text', true);
    }
    const cvItem = (kind: string, item: any, prefix: string) => {
        if (!object(item)) {
            issues[prefix] = 'Enter a valid CV entry.';
            return;
        }
        const f = (key: string, rule: string, required = false) =>
            field(key, rule, required, item, prefix);
        if (kind === 'experience') {
            f('titre', 'title', true);
            f('entreprise', 'title', true);
            f('description', 'description');
        }
        if (kind === 'formation') {
            f('diplome', 'title', true);
            f('etablissement', 'title', true);
        }
        if (kind === 'certification') {
            f('titre', 'title', true);
            f('organisme', 'title', true);
            f('dateObtention', 'date', true);
        }
        if (kind === 'experience' || kind === 'formation') {
            f('dateDebut', 'date', true);
            f('dateFin', 'date');
            if (item.dateDebut && item.dateFin && item.dateFin < item.dateDebut)
                issues[prefix + 'dateFin'] =
                    'End date must be on or after start date.';
        }
        if (kind === 'competence' || kind === 'hobby') f('nom', 'name', true);
        if (kind === 'langue') f('langue', 'name', true);
        if (kind === 'competence')
            choice(
                'niveau',
                ['Débutant', 'Intermédiaire', 'Avancé', 'Expert'],
                false,
                item,
                prefix,
            );
        if (kind === 'langue')
            choice(
                'niveau',
                ['Débutant', 'Intermédiaire', 'Avancé', 'Bilingue', 'Natif'],
                false,
                item,
                prefix,
            );
    };
    if (path === '/cv') {
        field('nom', 'name', true);
        field('prenom', 'name', true);
        field('email', 'email', true);
        field('telephone', 'phone');
        field('description', 'description');
        for (const kind of [
            'experience',
            'formation',
            'certification',
            'competence',
            'langue',
            'hobby',
        ]) {
            const key = kind === 'hobby' ? 'hobbies' : kind + 's';
            if (body[key] === undefined) continue;
            let entries = body[key];
            if (typeof entries === 'string') {
                try {
                    entries = JSON.parse(entries);
                } catch {
                    issues[key] = 'Enter a valid list of CV entries.';
                    continue;
                }
            }
            if (!Array.isArray(entries) || entries.length > 100) {
                issues[key] = 'Use a list with no more than 100 entries.';
                continue;
            }
            entries.forEach((entry: any, index: number) =>
                cvItem(kind, entry, key + '.' + index + '.'),
            );
        }
    }
    const cvMatch = path.match(
        /^\/cv\/(experience|formation|competence|langue|hobby)$/,
    );
    if (cvMatch) cvItem(cvMatch[1], body, '');
    if (/^\/chatbot\/(public-chat|chat)$/.test(path)) {
        field('message', 'chat', true);
        choice('language', ['en', 'fr']);
        if (
            body.history !== undefined &&
            (!Array.isArray(body.history) ||
                body.history.length > 20 ||
                body.history.length % 2 ||
                body.history.some(
                    (m: any, i: number) =>
                        !object(m) ||
                        m.role !== (i % 2 === 0 ? 'user' : 'model') ||
                        typeof m.content !== 'string' ||
                        !m.content.trim() ||
                        m.content.length > 8000,
                ) ||
                body.history.reduce(
                    (n: number, m: any) => n + m.content.length,
                    0,
                ) > 24000)
        )
            issues['history'] =
                'Use up to 20 alternating user/model messages (8,000 characters each; 24,000 total).';
    }
    if (/^\/quiz\/(lesson\/[^/]+(?:\/quiz2)?|final\/[^/]+)$/.test(path)) {
        integer('noteMinimale', 1, 100);
        integer('maxAttempts', 1, 20);
        if (
            !Array.isArray(body.questions) ||
            body.questions.length < 20 ||
            body.questions.length > 200
        )
            issues['questions'] = 'Use 20–200 complete questions.';
        else
            body.questions.forEach((q: any, i: number) => {
                const p = `questions.${i}.`;
                if (!object(q)) {
                    issues[p] = 'Enter a valid question.';
                    return;
                }
                field('texte', 'question', true, q, p);
                const options = q.options;
                if (
                    !Array.isArray(options) ||
                    options.length < 2 ||
                    options.length > 8 ||
                    options.some((o: any) => !!fieldIssue('option', o, true)) ||
                    new Set(
                        options.map((v: any) =>
                            typeof v === 'string' ? v.trim().toLowerCase() : v,
                        ),
                    ).size !== options.length
                ) {
                    issues[p + 'options'] =
                        'Use 2–8 distinct non-empty options.';
                    return;
                }
                const valid = (v: any) =>
                    Number.isInteger(v) && v >= 0 && v < options.length;
                choice('type', ['single', 'multiple'], false, q, p);
                if (q.type === 'multiple') {
                    if (
                        !Array.isArray(q.correctAnswers) ||
                        q.correctAnswers.length < 2 ||
                        q.correctAnswers.some((v: any) => !valid(v)) ||
                        new Set(q.correctAnswers).size !==
                            q.correctAnswers.length
                    )
                        issues[p + 'correctAnswers'] =
                            'Choose at least two distinct correct options.';
                } else if (!valid(q.correctAnswer))
                    issues[p + 'correctAnswer'] = 'Choose a correct option.';
                integer('points', 1, 100, q, p);
                integer('timeLimitSeconds', 0, 600, q, p);
                if (q.timeLimitSeconds > 0 && q.timeLimitSeconds < 10)
                    issues[p + 'timeLimitSeconds'] = 'Use 0 or 10–600 seconds.';
            });
    }
    // Submitted answers can legitimately be null/unanswered. The server remains the grading authority.
    if (/^\/quiz\/attempts\/[^/]+\/answer$/.test(path)) {
        integer('index', 0, 199, body, '', true);
        const a = body.answer;
        if (
            a !== null &&
            a !== undefined &&
            !(Number.isInteger(a) && a >= 0 && a < 8) &&
            !(
                Array.isArray(a) &&
                a.length <= 8 &&
                a.every((n) => Number.isInteger(n) && n >= 0 && n < 8) &&
                new Set(a).size === a.length
            )
        )
            issues['answer'] = 'Choose valid answer options.';
    }
    for (const file of files) {
        const image = ['avatar', 'photo'].includes(file.fieldname);
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const types: Record<string, string[]> = {
            jpg: ['image/jpeg'],
            jpeg: ['image/jpeg'],
            png: ['image/png'],
            webp: ['image/webp'],
            pdf: ['application/pdf'],
            mp4: ['video/mp4'],
            mov: ['video/quicktime'],
            avi: ['video/x-msvideo', 'video/avi'],
            mkv: ['video/x-matroska'],
        };
        if (
            !types[ext] ||
            (image && !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) ||
            (file.type && !types[ext]?.includes(file.type))
        )
            issues[file.fieldname] = image
                ? 'Choose a JPG, PNG or WebP image.'
                : 'Choose a PDF or supported video/image file.';
        if (
            !Number.isFinite(file.size) ||
            file.size <= 0 ||
            file.size > (image ? 5 : 100) * 1024 * 1024
        )
            issues[file.fieldname] = image
                ? 'Choose a non-empty image up to 5 MB.'
                : 'Choose a non-empty file up to 100 MB.';
    }
    return issues;
}
