import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiModule } from '../ui/ui.module';
import { LearningUiModule } from '../learning/learning-ui.module';
@Component({
    selector: 'app-record-table',
    standalone: true,
    imports: [CommonModule, FormsModule, UiModule, LearningUiModule],
    templateUrl: './record-table.component.html',
    styleUrls: ['./record-table.component.scss'],
})
export class RecordTableComponent {
    @Input() records: any[] = [];
    @Input() kind: 'people' | 'courses' = 'courses';
    @Input() loading = false;
    @Input() error = '';
    @Input() busy = false;
    @Input() currentUserId = '';
    @Output() refresh = new EventEmitter<void>();
    @Output() edit = new EventEmitter<any>();
    @Output() remove = new EventEmitter<string>();
    @Output() roleChange = new EventEmitter<{ id: string; role: string }>();
    query = '';
    filter = 'all';
    sort = 'name';
    page = 1;
    proposedRole = 'user';
    name(r: any) {
        return this.kind === 'people' ? `${r.firstname || ''} ${r.lastname || ''}` : r.title || '';
    }
    status(r: any) {
        return this.kind === 'people'
            ? Array.isArray(r.role)
                ? r.role[0]
                : r.role
            : r.isApproved
              ? 'Published'
              : 'Pending';
    }
    get filtered() {
        return this.records
            .filter(
                (r) =>
                    (this.name(r) + ' ' + (r.email || '') + ' ' + (r.category || ''))
                        .toLowerCase()
                        .includes(this.query.toLowerCase()) &&
                    (this.filter === 'all' || this.status(r) === this.filter),
            )
            .sort((a, b) =>
                this.sort === 'name'
                    ? this.name(a).localeCompare(this.name(b))
                    : this.sort === 'reverse'
                      ? this.name(b).localeCompare(this.name(a))
                      : new Date(b.updatedAt || b.createdAt || 0).getTime() -
                        new Date(a.updatedAt || a.createdAt || 0).getTime(),
            );
    }
    get pages() {
        return Math.max(1, Math.ceil(this.filtered.length / 8));
    }
    get currentPage() {
        return Math.min(this.page, this.pages);
    }
    get rows() {
        return this.filtered.slice((this.currentPage - 1) * 8, this.currentPage * 8);
    }
    canManage(r: any) {
        return (
            this.kind === 'people' ||
            !this.currentUserId ||
            (r.trainer?._id || r.trainer) === this.currentUserId
        );
    }
}
