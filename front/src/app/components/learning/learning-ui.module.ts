import { Component, Input, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UiModule } from '../ui/ui.module';
@Component({
    selector: 'app-learning-progress',
    standalone: true,
    imports: [UiModule],
    template: `<brn-progress
        hlm
        [value]="safeValue"
        [attr.aria-label]="label"
        class="learning-progress"
        ><brn-progress-indicator hlm
    /></brn-progress>`,
})
export class LearningProgressComponent {
    @Input() value: any = 0;
    @Input() label = 'Course progress';
    get safeValue() {
        return Math.min(100, Math.max(0, Number(this.value) || 0));
    }
}
@Component({
    selector: 'app-empty-state',
    standalone: true,
    imports: [UiModule, CommonModule, RouterModule],
    template: `<section hlmCard class="empty-state">
        <div class="empty-illustration" aria-hidden="true">
            <i [class]="'bx bx-' + icon"></i><span></span>
        </div>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
        <a *ngIf="link" hlmBtn [routerLink]="link"
            >{{ action }} <span aria-hidden="true">↗</span></a
        ><ng-content />
    </section>`,
})
export class EmptyStateComponent {
    @Input() title = 'Your next chapter starts here';
    @Input() description = 'Explore the library and find something you would love to learn.';
    @Input() link = '';
    @Input() action = 'Browse courses';
    @Input() icon = 'book-open';
}
@Component({
    selector: 'app-learning-skeleton',
    standalone: true,
    imports: [UiModule, CommonModule],
    template: `<div
        class="learning-skeleton"
        role="status"
        aria-label="Fetching your learning workspace"
        aria-busy="true"
    >
        <hlm-skeleton class="block h-10 w-64 mb-4" /><hlm-skeleton class="block h-52 w-full mb-6" />
        <div class="course-grid">
            <hlm-skeleton *ngFor="let n of [1, 2, 3]" class="block h-40 w-full" />
        </div>
    </div>`,
})
export class LearningSkeletonComponent {}
@Component({
    selector: 'app-learning-card',
    standalone: true,
    imports: [UiModule, CommonModule, RouterModule, LearningProgressComponent],
    template: `<article hlmCard class="learning-card">
        <div class="course-art" aria-hidden="true">
            <span>{{ enrollment.course?.category || 'LEARNING' }}</span
            ><i class="bx bx-book-open"></i>
            <div class="art-rings"></div>
        </div>
        <div class="learning-card-body">
            <div class="section-row">
                <span hlmBadge variant="secondary">{{
                    enrollment.completed ? 'Completed' : 'In progress'
                }}</span
                ><span class="small-muted" *ngIf="enrollment.deadline"
                    >Due {{ enrollment.deadline | date: 'MMM d' }}</span
                >
            </div>
            <h3>{{ enrollment.course?.title || 'Course unavailable' }}</h3>
            <p>
                {{ enrollment.course?.trainer?.firstname }}
                {{ enrollment.course?.trainer?.lastname }}
            </p>
            <app-learning-progress [value]="enrollment.progress" />
            <div class="section-row card-footer-row">
                <span>{{ enrollment.progress || 0 }}% complete</span
                ><a
                    *ngIf="enrollment.course?._id"
                    hlmBtn
                    variant="ghost"
                    size="sm"
                    [routerLink]="['/course', enrollment.course._id]"
                    >{{ enrollment.completed ? 'Review' : 'Continue' }}
                    <span aria-hidden="true">→</span></a
                >
            </div>
        </div>
    </article>`,
})
export class LearningCardComponent {
    @Input() enrollment: any;
}
const components = [
    LearningProgressComponent,
    EmptyStateComponent,
    LearningSkeletonComponent,
    LearningCardComponent,
];
@NgModule({ imports: components, exports: components })
export class LearningUiModule {}
