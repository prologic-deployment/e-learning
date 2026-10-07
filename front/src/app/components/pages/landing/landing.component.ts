import {
    TranslationModule,
    TranslationService,
} from '../../../i18n/translation.module';
import { ThemeService } from '../../../services/theme.service';
import { LandingChatComponent } from '../../common/landing-chat/landing-chat.component';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UiModule } from '../../ui/ui.module';
import { CourseService } from '../../../services/course.service';
import { AuthService } from '../../../services/auth.service';
@Component({
    selector: 'app-landing',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        UiModule,
        TranslationModule,
        LandingChatComponent,
    ],
    templateUrl: './landing.component.html',
    styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements OnInit {
    private destroyRef = inject(DestroyRef);
    private request?: Subscription;
    courses: any[] = [];
    loading = false;
    error = '';
    menuOpen = false;
    year = new Date().getFullYear();
    selectedRole = 0;
    readonly roles = [
        {
            name: 'Learners',
            number: '01',
            title: 'Less searching. More learning.',
            description:
                'Find a course, work through its lessons, and put your knowledge into practice. Your learning workspace keeps your progress, assessments and earned certificates together.',
            features: [
                'A personal learning workspace',
                'Lesson quizzes and final assessments',
                'Progress and earned certificates',
            ],
            icon: 'book-open',
        },
        {
            name: 'Trainers',
            number: '02',
            title: 'Turn what you know into what others can do.',
            description:
                'Build courses from lessons, add quizzes and final exams, and review assessment results. Keep your teaching and course authoring in one content studio.',
            features: [
                'Course and lesson authoring',
                'Quiz and final-exam creation',
                'Assessment results in your studio',
            ],
            icon: 'edit-alt',
        },
        {
            name: 'Managers',
            number: '03',
            title: 'Give your team a clear next step.',
            description:
                'Assign learning to your team and follow their progress. See overdue work and identify where a timely conversation can help someone move forward.',
            features: [
                'Team course assignments',
                'Deadlines and overdue learning',
                'Team progress overview',
            ],
            icon: 'group',
        },
        {
            name: 'Administrators',
            number: '04',
            title: 'Bring the whole learning operation together.',
            description:
                'Manage people and staff access, oversee the course library, and review platform activity. Keep the right tools available to the right roles.',
            features: [
                'People and role management',
                'Course approvals and archives',
                'Platform reporting and oversight',
            ],
            icon: 'grid-alt',
        },
    ];
    readonly journey = [
        {
            title: 'Discover',
            copy: 'Choose a course that fits what you want to learn.',
            icon: 'compass',
        },
        {
            title: 'Learn',
            copy: 'Move through focused lessons at your own pace.',
            icon: 'book-open',
        },
        {
            title: 'Practise',
            copy: 'Use lesson quizzes to check your understanding.',
            icon: 'check-square',
        },
        {
            title: 'Demonstrate',
            copy: 'Complete the final assessment for your course.',
            icon: 'target-lock',
        },
        {
            title: 'Progress',
            copy: 'Track completion and view certificates you earn.',
            icon: 'award',
        },
    ];
    constructor(
        private courseService: CourseService,
        public auth: AuthService,
        public i18n: TranslationService,
        public theme: ThemeService,
        private router: Router,
    ) {}
    ngOnInit() {
        document.documentElement.lang = this.i18n.language();
        this.destroyRef.onDestroy(() => { document.documentElement.lang = 'en'; });
        this.loadCourses();
    }
    goToSection(event: Event, id: string) {
        event.preventDefault();
        this.menuOpen = false;
        this.router.navigate(['/'], { fragment: id }).then(() => {
            const section = document.getElementById(id);
            if (!section) return;
            section.setAttribute('tabindex', '-1');
            section.focus({ preventScroll: true });
            section.scrollIntoView({
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'auto'
                    : 'smooth',
                block: 'start',
            });
        });
    }
    get workspace(): string {
        const role = this.auth.getRole();
        return ['admin', 'manager', 'trainer'].includes(role)
            ? `/${role}-dashboard`
            : '/dashboard';
    }
    get role() {
        return this.roles[this.selectedRole];
    }
    loadCourses() {
        this.request?.unsubscribe();
        this.loading = true;
        this.error = '';
        this.courses = [];
        this.request = this.courseService
            .getAllCourses({ limit: 3, page: 1 })
            .pipe(
                takeUntilDestroyed(this.destroyRef),
                finalize(() => (this.loading = false)),
            )
            .subscribe({
                next: (data) =>
                    (this.courses = (
                        Array.isArray(data?.courses) ? data.courses : []
                    ).slice(0, 3)),
                error: () =>
                    (this.error =
                        'The course library is unavailable right now. Please try again.'),
            });
    }
}
