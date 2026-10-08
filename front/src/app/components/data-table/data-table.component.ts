import {
    ChangeDetectionStrategy,
    Component,
    Input,
    TemplateRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiModule } from '../ui/ui.module';
import { memoLast } from '../management/memo-last';
import { TableColumn, TablePreset, filterRecords } from './table-model';
@Component({
    selector: 'app-data-table',
    standalone: true,
    imports: [CommonModule, FormsModule, UiModule],
    templateUrl: './data-table.component.html',
    styleUrls: ['./data-table.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent {
    @Input() records: any[] = [];
    @Input() preset!: TablePreset;
    @Input() actions: TemplateRef<any> | null = null;
    query = '';
    choices: Record<string, string> = {};
    from = '';
    to = '';
    min = '';
    max = '';
    sort = '';
    page = 1;
    size = 20;
    private derive = memoLast<any[]>();
    private deriveOptions = memoLast<Record<string, string[]>>();
    get filtered() {
        return this.derive(
            [
                this.records,
                this.preset,
                this.query,
                JSON.stringify(this.choices),
                this.from,
                this.to,
                this.min,
                this.max,
                this.sort,
            ],
            () =>
                this.rangeError
                    ? []
                    : filterRecords(this.records, this.preset, {
                          search: this.query,
                          choices: this.choices,
                          from: this.from,
                          to: this.to,
                          min: this.min,
                          max: this.max,
                          sort: this.sort,
                      }),
        );
    }
    get options() {
        return this.deriveOptions([this.records, this.preset], () =>
            Object.fromEntries(
                this.preset.columns
                    .filter((c) => c.filter)
                    .map((c) => [
                        c.key,
                        [
                            ...new Set(
                                this.records
                                    .map((r) => String(c.get(r) ?? ''))
                                    .filter(Boolean),
                            ),
                        ].sort((a, b) => a.localeCompare(b)),
                    ]),
            ),
        );
    }
    get dateColumn() {
        return this.preset.columns.find((c) => c.type === 'date');
    }
    get rangeColumn() {
        return this.preset.columns.find((c) => c.range);
    }
    get rangeError() {
        return this.from && this.to && this.from > this.to
            ? 'Start date must be on or before end date.'
            : this.min !== '' &&
                this.max !== '' &&
                Number(this.min) > Number(this.max)
              ? 'Minimum must be less than or equal to maximum.'
              : '';
    }
    get activeFilters() {
        return (
            Number(!!this.query.trim()) +
            Object.values(this.choices).filter(Boolean).length +
            Number(!!(this.from || this.to)) +
            Number(this.min !== '' || this.max !== '')
        );
    }
    get pages() {
        return Math.max(1, Math.ceil(this.filtered.length / this.size));
    }
    get current() {
        return Math.min(this.page, this.pages);
    }
    get start() {
        return (this.current - 1) * this.size;
    }
    get end() {
        return Math.min(this.current * this.size, this.filtered.length);
    }
    get visible() {
        return this.filtered.slice(this.start, this.end);
    }
    reset() {
        this.query = '';
        this.choices = {};
        this.from = '';
        this.to = '';
        this.min = '';
        this.max = '';
        this.page = 1;
    }
    toggleSort(column: TableColumn) {
        this.sort =
            this.sort === column.key + ':asc'
                ? column.key + ':desc'
                : column.key + ':asc';
        this.page = 1;
    }
    sortDirection(column: TableColumn) {
        return this.sort === column.key + ':asc'
            ? 'ascending'
            : this.sort === column.key + ':desc'
              ? 'descending'
              : 'none';
    }
    display(value: any) {
        return value == null || value === ''
            ? 'Not recorded'
            : typeof value === 'object'
              ? 'Not recorded'
              : String(value);
    }
    dateValue(value: any) {
        return value && !Number.isNaN(new Date(value).getTime()) ? value : null;
    }
    numeric(value: any) {
        return value != null && value !== '' && Number.isFinite(Number(value));
    }
    trackColumn = (_: number, c: TableColumn) => c.key;
    trackRow = (_: number, r: any) =>
        r._id || r.id || `${r.enrollmentId}:${r.type}:${r.lessonId || ''}`;
}
