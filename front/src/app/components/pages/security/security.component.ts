import { PageHeadingComponent } from '../../layout/page-heading.component';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../services/auth.service';
import { UiModule } from '../../ui/ui.module';
import { FormFieldComponent } from '../../forms/form-field.component';
@Component({
    selector: 'app-security',
    standalone: true,
    imports: [
        PageHeadingComponent,
        CommonModule,
        FormsModule,
        RouterModule,
        UiModule,
        FormFieldComponent,
    ],
    templateUrl: './security.component.html',
    styleUrls: ['./security.component.scss'],
})
export class SecurityComponent implements OnInit {
    private destroyRef = inject(DestroyRef);
    status: any = null;
    setup: any = null;
    recoveryCodes: string[] = [];
    password = '';
    code = '';
    loading = false;
    error = '';
    success = '';
    recoveryMode = false;
    disabling = false;
    constructor(public auth: AuthService) {}
    ngOnInit() {
        this.refresh();
        this.destroyRef.onDestroy(() => {
            this.setup = null;
            this.recoveryCodes = [];
            this.password = '';
            this.code = '';
        });
    }
    run(request: Observable<any>, done: (res: any) => void) {
        if (this.loading) return;
        this.loading = true;
        this.error = '';
        this.success = '';
        request
            .pipe(
                takeUntilDestroyed(this.destroyRef),
                finalize(() => (this.loading = false)),
            )
            .subscribe({
                next: done,
                error: (err) => {
                    this.password = '';
                    this.code = '';
                    this.error =
                        err.error?.message ||
                        'Unable to reach account security. Check your connection and try again.';
                },
            });
    }
    refresh() {
        this.run(this.auth.factorStatus(), (res) => (this.status = res));
    }
    begin() {
        this.run(this.auth.beginSetup(this.password), (res) => {
            this.setup = res;
            this.password = '';
            this.code = '';
        });
    }
    confirm() {
        this.run(
            this.auth.confirmSetup(this.setup.setupToken, this.code),
            (res) => {
                this.setup = null;
                this.code = '';
                this.recoveryCodes = res.recoveryCodes;
                this.status = {
                    enabled: true,
                    recoveryCodesRemaining: res.recoveryCodes.length,
                };
                this.success =
                    'Authenticator enabled. Save your recovery codes now.';
            },
        );
    }
    cancel() {
        this.run(this.auth.cancelSetup(), () => {
            this.setup = null;
            this.code = '';
            this.password = '';
        });
    }
    disable() {
        this.run(
            this.auth.disableFactor({
                currentPassword: this.password,
                ...(this.recoveryMode
                    ? { recoveryCode: this.code }
                    : { code: this.code }),
            }),
            () => {
                this.disabling = false;
                this.status = { enabled: false, recoveryCodesRemaining: 0 };
                this.password = '';
                this.code = '';
                this.success =
                    'Authenticator disabled. Other sessions have been signed out.';
            },
        );
    }
    downloadCodes() {
        const blob = new Blob(
            [
                'FormaPath recovery codes\nStore offline and privately. Each code works only once.\n\n' +
                    this.recoveryCodes.join('\n'),
            ],
            { type: 'text/plain' },
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'formapath-recovery-codes.txt';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
