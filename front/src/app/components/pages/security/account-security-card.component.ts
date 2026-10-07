import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../services/auth.service';
import { UiModule } from '../../ui/ui.module';

@Component({
    selector: 'app-account-security-card',
    standalone: true,
    imports: [CommonModule, RouterModule, UiModule],
    template: `
        <section hlmCard class="account-security" aria-label="Your two-factor authentication" [attr.aria-busy]="loading">
            <i class="bx bx-shield-quarter" aria-hidden="true"></i>
            <div class="copy">
                <h2>Two-factor authentication (2FA)</h2>
                <p>Add an authenticator app to your own account. No administrator approval needed.</p>
                <span *ngIf="loading" role="status">Checking your protection…</span>
                <span *ngIf="status && !loading" hlmBadge [variant]="status.enabled ? 'default' : 'secondary'">
                    {{ status.enabled ? 'Enabled' : 'Not enabled' }}
                </span>
                <p *ngIf="error" role="alert">{{ error }}
                    <button hlmBtn variant="link" [disabled]="loading" (click)="refresh()">Retry</button>
                </p>
            </div>
            <a hlmBtn variant="outline" routerLink="/account/security">
                {{ status?.enabled ? 'Manage my 2FA' : 'Configure my 2FA' }}
            </a>
        </section>
    `,
    styles: [`
        :host { display:block; margin:0 0 24px; }
        .account-security { display:flex; align-items:center; gap:20px; padding:24px; }
        .account-security > i { font-size:28px; color:hsl(var(--primary)); }
        .copy { flex:1; min-width:0; }
        h2 { font-size:16px; margin:0 0 6px; }
        p { font-size:13px; color:hsl(var(--muted-foreground)); margin:0 0 10px; }
        @media(max-width:600px) { .account-security { flex-wrap:wrap; gap:14px; } .account-security > a { width:100%; } }
    `],
})
export class AccountSecurityCardComponent implements OnInit {
    private auth = inject(AuthService);
    private destroy = inject(DestroyRef);
    status: { enabled: boolean; recoveryCodesRemaining: number } | null = null;
    loading = false;
    error = '';

    ngOnInit(): void { this.refresh(); }

    refresh(): void {
        if (this.loading) return;
        this.loading = true;
        this.error = '';
        this.auth.factorStatus().pipe(
            takeUntilDestroyed(this.destroy),
            finalize(() => this.loading = false),
        ).subscribe({
            next: status => this.status = status,
            error: () => this.error = 'Could not check your 2FA status. You can still open security settings.',
        });
    }
}
