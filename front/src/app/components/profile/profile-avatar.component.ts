import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { profilePhotoUrl } from '../../services/profile-summary';
@Component({
    selector: 'app-profile-avatar', standalone: true, imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<img *ngIf="src && !failed; else initials" [src]="src" alt="" (error)="failed=true"><ng-template #initials><span>{{letters}}</span></ng-template>`,
    styles: [`:host{display:grid;place-items:center;flex-shrink:0;width:var(--avatar-size,34px);height:var(--avatar-size,34px);overflow:hidden;border-radius:50%;background:hsl(var(--accent));color:hsl(var(--accent-foreground));font-size:13px;font-weight:650;border:1px solid hsl(var(--border))}img{width:100%;height:100%;object-fit:cover}span{text-transform:uppercase}`],
})
export class ProfileAvatarComponent implements OnChanges {
    @Input() user: any;
    src = ''; failed = false;
    get letters() { return [this.user?.firstname, this.user?.lastname].map(s=>s?.trim()?.charAt(0)||'').join('') || '?'; }
    ngOnChanges() {
        const next = profilePhotoUrl(this.user?.avatar, environment.backendUrl);
        if (next !== this.src) this.failed = false;
        this.src = next;
    }
}
