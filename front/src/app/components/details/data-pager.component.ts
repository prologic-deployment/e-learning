import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiModule } from '../ui/ui.module';
@Component({
    selector: 'app-data-pager',
    standalone: true,
    imports: [CommonModule, UiModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<nav
        *ngIf="rows.length > size"
        class="data-pager"
        [attr.aria-label]="label + ' pagination'"
    >
        <span>{{ start + 1 }}–{{ end }} of {{ rows.length }} records</span>
        <div>
            <button
                hlmBtn
                variant="outline"
                size="sm"
                [disabled]="current <= 1"
                (click)="page = current - 1"
            >
                Previous</button
            ><span>Page {{ current }} of {{ pages }}</span
            ><button
                hlmBtn
                variant="outline"
                size="sm"
                [disabled]="current >= pages"
                (click)="page = current + 1"
            >
                Next
            </button>
        </div>
    </nav>`,
    styles: [
        `
            .data-pager {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 12px;
                margin: 14px 0;
                font-size: 12px;
                color: #64748b;
            }
            .data-pager > div {
                display: flex;
                align-items: center;
                gap: 12px;
            }
        `,
    ],
})
export class DataPagerComponent {
    @Input() rows: any[] = [];
    @Input() label = 'Records';
    readonly size = 20;
    page = 1;
    get pages() {
        return Math.max(1, Math.ceil(this.rows.length / this.size));
    }
    get current() {
        return Math.min(this.page, this.pages);
    }
    get start() {
        return (this.current - 1) * this.size;
    }
    get end() {
        return Math.min(this.current * this.size, this.rows.length);
    }
    get visible() {
        return this.rows.slice(this.start, this.end);
    }
}
