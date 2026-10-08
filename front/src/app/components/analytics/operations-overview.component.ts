import { DataTableComponent } from '../data-table/data-table.component';
import { operationsPreset } from '../data-table/table-presets';
import { TablePreset } from '../data-table/table-model';
import { memoLast } from '../management/memo-last';
import {
    ChangeDetectionStrategy,
    Component,
    Input,
    Output,
    EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiModule } from '../ui/ui.module';
import { LearningUiModule } from '../learning/learning-ui.module';
@Component({
    selector: 'app-operations-overview',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DataTableComponent,
        CommonModule,
        FormsModule,
        UiModule,
        LearningUiModule,
    ],
    templateUrl: './operations-overview.component.html',
    styleUrls: ['./operations-overview.component.scss'],
})
export class OperationsOverviewComponent {
    private presetMemo = memoLast<TablePreset>();
    get tablePreset() {
        return this.presetMemo([this.role], () => operationsPreset(this.role));
    }
    @Input() role = 'trainer';
    @Input() stats: any;
    @Input() loading = false;
    @Input() error = '';
    @Output() navigate = new EventEmitter<string>();
    @Output() refresh = new EventEmitter<void>();
    get metrics() {
        const s = this.stats?.overview;
        if (!s) return [];
        return this.role === 'manager'
            ? [
                  { label: 'Team members', value: s.teamSize },
                  { label: 'Assigned courses', value: s.totalEnrollments },
                  { label: 'Completed', value: s.completedEnrollments },
                  {
                      label: 'Average progress',
                      value: s.averageProgress,
                      suffix: '%',
                  },
              ]
            : this.role === 'admin'
              ? [
                    { label: 'Learners', value: s.totalUsers },
                    { label: 'Published courses', value: s.approvedCourses },
                    { label: 'Enrollments', value: s.totalEnrollments },
                    {
                        label: 'Completion rate',
                        value: s.completionRate,
                        suffix: '%',
                    },
                ]
              : [
                    { label: 'Your courses', value: s.totalCourses },
                    { label: 'Published', value: s.approvedCourses },
                    { label: 'Enrollments', value: s.totalEnrollments },
                    {
                        label: 'Completion rate',
                        value: s.completionRate,
                        suffix: '%',
                    },
                ];
    }
    private derive = memoLast<any[]>();
    get rows() {
        return this.derive([this.stats, this.role], () => {
            if (!this.stats) return [];
            const rows =
                this.role === 'manager'
                    ? (this.stats.memberStats || []).map((r: any) => ({
                          id: r.user._id,
                          name: `${r.user.firstname} ${r.user.lastname}`,
                          detail: r.user.email,
                          total: r.totalCourses,
                          completed: r.completedCourses,
                          progress: r.averageProgress,
                          status: 'Team member',
                      }))
                    : this.role === 'admin'
                      ? (this.stats.topCourses || []).map((r: any) => ({
                            id: r.courseId,
                            name: r.courseTitle,
                            detail: 'Course enrollments',
                            total: r.enrollments,
                            status: 'Popular course',
                        }))
                      : (this.stats.courseStats || []).map((r: any) => ({
                            id: r.course.id,
                            name: r.course.title,
                            detail: 'Your course',
                            total: r.totalEnrollments,
                            completed: r.completedEnrollments,
                            progress: r.averageProgress,
                            status: r.course.isApproved
                                ? 'Published'
                                : 'Pending approval',
                        }));
            return rows.sort((a: any, b: any) => a.name.localeCompare(b.name));
        });
    }
    get chart() {
        return this.role === 'admin'
            ? (this.stats?.enrollmentsByMonth || []).map((r: any) => ({
                  label: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
                  value: r.count,
              }))
            : this.rows
                  .slice(0, 5)
                  .map((r: any) => ({ label: r.name, value: r.progress || 0 }));
    }
    barWidth(value: number) {
        const max =
            this.role === 'admin'
                ? Math.max(1, ...this.chart.map((r: any) => r.value))
                : 100;
        return Math.max(0, Math.min(100, (value / max) * 100));
    }
}
