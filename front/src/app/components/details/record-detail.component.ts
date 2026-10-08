import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    DestroyRef,
    ViewChild,
    inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { BrnDialogComponent } from '@spartan-ng/ui-dialog-brain';
import { UiModule } from '../ui/ui.module';
import { TranslationModule } from '../../i18n/translation.module';
import { DetailRef, DetailEvent, DetailService, RecordDetail } from './detail.service';
import { TranslationService } from '../../i18n/translation.module';
import { environment } from '../../../environments/environment';
@Component({
    selector: 'app-record-detail',
    standalone: true,
    imports: [CommonModule, UiModule, TranslationModule],
    templateUrl: './record-detail.component.html',
    styleUrls: ['./record-detail.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordDetailComponent {
    @ViewChild('scrollBody') scrollBody?: ElementRef<HTMLElement>;
    scrollToAnswers() {
        this.scrollBody?.nativeElement
            .querySelector('.answer-review')
            ?.scrollIntoView({ block: 'start' });
    }
    @ViewChild('dialog') dialog?: BrnDialogComponent;
    data: RecordDetail | null = null;
    loading = false;
    error = '';
    record: DetailRef | null = null;
    history: DetailRef[] = [];
    private request?: Subscription;
    private readonly destroyRef = inject(DestroyRef);
    constructor(
        details: DetailService,
        private http: HttpClient,
        private change: ChangeDetectorRef,
        router: Router,
        public i18n: TranslationService,
    ) {
        details.opened
            .pipe(takeUntilDestroyed())
            .subscribe((record) => this.open(record));
        router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
            if (e instanceof NavigationStart) {
                this.dialog?.close(0);
                this.closed();
            }
        });
        this.destroyRef.onDestroy(() => this.request?.unsubscribe());
    }
    open(record: DetailRef) {
        if (this.dialog?.state() === 'open' && this.record)
            this.history.push(this.record);
        else this.history = [];
        this.record = record;
        this.load();
        if (this.dialog?.state() !== 'open') this.dialog?.open();
    }
    back() {
        const previous = this.history.pop();
        if (previous) {
            this.record = previous;
            this.load();
        }
    }
    paginate(key: string, page: number) {
        if (this.record) {
            this.record = {
                ...this.record,
                query: { ...this.record.query, [key]: page },
            };
            this.load();
        }
    }
    load() {
        this.request?.unsubscribe();
        this.data = null;
        this.error = '';
        this.loading = true;
        this.change.markForCheck();
        if (!this.record) return;
        let params = new HttpParams();
        for (const [key, value] of Object.entries(this.record.query || {})) {
            if (value != null) params = params.set(key, String(value));
        }
        this.request = this.http
            .get<RecordDetail>(
                `${environment.apiUrl}/details/${encodeURIComponent(this.record.kind)}/${encodeURIComponent(this.record.id)}`,
                { params },
            )
            .subscribe({
                next: (data) => {
                    this.data = data;
                    this.loading = false;
                    this.change.markForCheck();
                },
                error: (error) => {
                    this.error =
                        error.status === 404
                            ? 'This record is unavailable or you no longer have access.'
                            : error.status === 401
                              ? 'Your session has expired. Please sign in again.'
                              : 'We couldn’t load these details. Check your connection and try again.';
                    this.loading = false;
                    this.change.markForCheck();
                },
            });
    }
    closed() {
        this.request?.unsubscribe();
        this.data = null;
        this.record = null;
        this.history = [];
        this.error = '';
        this.loading = false;
        this.change.markForCheck();
    }
    display(value: unknown): string {
        if (value == null || value === '') return 'Not recorded';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value !== 'string' && typeof value !== 'number')
            return 'Not recorded';
        if (
            typeof value === 'string' &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
        )
            return Number.isNaN(new Date(value).getTime())
                ? value
                : this.formatEventDate(value);
        return String(value);
    }
    private get locale() {
        return this.i18n.language() === 'fr' ? 'fr-FR' : 'en-GB';
    }
    formatEventDate(value: string): string {
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? value
            : new Intl.DateTimeFormat(this.locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
              }).format(date);
    }
    eventIcon(type: string): string {
        return (
            {
                purchase: 'bx-cart',
                enrollment: 'bx-user-plus',
                assessment_started: 'bx-play-circle',
                assessment_submitted: 'bx-check-circle',
                assessment_in_progress: 'bx-loader-circle',
                result_saved: 'bx-badge-check',
                certificate: 'bx-award',
                review: 'bx-message-square-detail',
                current_state: 'bx-pulse',
            }[type] || 'bx-dot'
        );
    }
    trackSection = (_: number, s: { title: string }) => s.title;
    trackEvent = (_: number, e: DetailEvent) => e.type + ':' + e.at;
    trackQuestion = (_: number, q: { number: number }) => q.number;
}
