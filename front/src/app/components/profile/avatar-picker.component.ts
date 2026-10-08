import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    DestroyRef,
    EventEmitter,
    Input,
    Output,
    inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UiModule } from '../ui/ui.module';
import { ToastService } from '../../services/toast.service';
import { environment } from '../../../environments/environment';
@Component({
    selector: 'app-avatar-picker',
    standalone: true,
    imports: [CommonModule, UiModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<div class="photo-editor" [attr.aria-busy]="busy">
        <input
            #picker
            type="file"
            hidden
            tabindex="-1"
            aria-label="Choose profile photo"
            accept="image/jpeg,image/png,image/webp"
            (change)="choose($event)"
            [disabled]="busy"
        />
        <button
            type="button"
            class="photo-button"
            (click)="picker.click()"
            [disabled]="busy"
            aria-label="Change profile photo"
            title="Change profile photo"
        >
            <img
                *ngIf="image && !imageFailed; else initials"
                [src]="image"
                alt="Your profile photo"
                (error)="imageError()"
            /><ng-template #initials
                ><span class="initials"
                    >{{ user?.firstname?.charAt(0) || '?'
                    }}{{ user?.lastname?.charAt(0) || '' }}</span
                ></ng-template
            >
            <span class="camera" aria-hidden="true"
                ><i class="bx bx-camera"></i
            ></span>
        </button>
        <p>
            {{
                busy
                    ? 'Saving photo…'
                    : file
                      ? 'Preview — save to update your photo'
                      : 'Click your photo to change it'
            }}
        </p>
        <small>JPG, PNG or WebP · Up to 5 MB</small>
        <p *ngIf="error" role="alert" class="photo-error">{{ error }}</p>
        <div class="photo-actions" *ngIf="file">
            <button
                hlmBtn
                type="button"
                size="sm"
                [disabled]="busy"
                (click)="save()"
            >
                {{ busy ? 'Saving…' : 'Save photo' }}</button
            ><button
                hlmBtn
                type="button"
                size="sm"
                variant="outline"
                [disabled]="busy"
                (click)="cancel()"
            >
                Cancel
            </button>
        </div>
    </div>`,
    styles: [
        `
            :host {
                display: block;
            }
            .photo-editor {
                text-align: center;
            }
            .photo-button {
                position: relative;
                display: block;
                margin: 0 auto 16px;
                padding: 0;
                width: 112px;
                height: 112px;
                border: 3px solid hsl(var(--border));
                border-radius: 50%;
                background: hsl(var(--muted));
                color: hsl(var(--foreground));
                cursor: pointer;
            }
            .photo-button:hover {
                border-color: hsl(var(--ring));
            }
            .photo-button:focus-visible {
                outline: 3px solid hsl(var(--ring));
                outline-offset: 4px;
            }
            .photo-button:disabled {
                cursor: wait;
                opacity: 0.6;
            }
            .photo-button img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 50%;
            }
            .initials {
                font-size: 30px;
                font-weight: 600;
            }
            .camera {
                position: absolute;
                bottom: 0;
                right: -2px;
                display: grid;
                place-items: center;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: hsl(var(--primary));
                color: hsl(var(--primary-foreground));
                border: 2px solid hsl(var(--card));
                font-size: 18px;
            }
            .photo-editor p {
                font-size: 13px;
                margin: 6px 0;
            }
            .photo-editor small {
                color: hsl(var(--muted-foreground));
                font-size: 11px;
            }
            .photo-actions {
                display: flex;
                justify-content: center;
                gap: 8px;
                margin-top: 14px;
            }
            .photo-error {
                color: hsl(var(--destructive)) !important;
            }
            [hidden] {
                display: none !important;
            }
        `,
    ],
})
export class AvatarPickerComponent {
    @Input() user: any;
    @Output() saved = new EventEmitter<void>();
    file: File | null = null;
    preview = '';
    busy = false;
    error = '';
    imageFailed = false;
    private destroyRef = inject(DestroyRef);
    constructor(
        private http: HttpClient,
        private change: ChangeDetectorRef,
        private toast: ToastService,
    ) {
        this.destroyRef.onDestroy(() => this.releasePreview());
    }
    get image() {
        const path = this.preview || this.user?.avatar;
        return !path
            ? ''
            : /^(https?:|blob:)/.test(path)
              ? path
              : environment.backendUrl + path;
    }
    choose(event: Event) {
        const input = event.target as HTMLInputElement,
            file = input.files?.[0];
        input.value = '';
        if (!file || this.busy) return;
        this.error = '';
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            this.error = 'Choose a JPG, PNG or WebP image.';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            this.error = 'Choose an image smaller than 5 MB.';
            return;
        }
        this.releasePreview();
        this.file = file;
        this.preview = URL.createObjectURL(file);
        this.imageFailed = false;
    }
    imageError() {
        this.imageFailed = true;
        if (this.file) {
            this.file = null;
            this.releasePreview();
            this.error =
                'This image could not be opened. Please choose another image.';
        }
    }
    cancel() {
        if (this.busy) return;
        this.releasePreview();
        this.file = null;
        this.error = '';
        this.imageFailed = false;
    }
    private releasePreview() {
        if (this.preview) URL.revokeObjectURL(this.preview);
        this.preview = '';
    }
    save() {
        if (!this.file || this.busy) return;
        this.busy = true;
        this.error = '';
        const body = new FormData();
        body.append('avatar', this.file);
        this.http
            .put<any>(`${environment.apiUrl}/profile/avatar`, body)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (response) => {
                    this.user = { ...this.user, ...response.user };
                    this.busy = false;
                    this.cancel();
                    this.toast.show('Profile photo updated.');
                    this.change.markForCheck();
                    this.saved.emit();
                },
                error: () => {
                    this.busy = false;
                    this.error = 'Unable to save your photo. Please try again.';
                    this.change.markForCheck();
                },
            });
    }
}
