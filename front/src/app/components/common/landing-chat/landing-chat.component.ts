import {
    Component,
    DestroyRef,
    ElementRef,
    ViewChild,
    inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription, finalize, timeout } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UiModule } from '../../ui/ui.module';
import { TranslationModule } from '../../../i18n/translation.module';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';
interface ChatMessage {
    role: 'user' | 'model';
    content: string;
    sources?: { title: string; url: string }[];
}
@Component({
    selector: 'app-landing-chat',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        UiModule,
        TranslationModule,
    ],
    templateUrl: './landing-chat.component.html',
    styleUrls: ['./landing-chat.component.scss'],
})
export class LandingChatComponent {
    private destroyRef = inject(DestroyRef);
    @ViewChild('launcher') launcher?: ElementRef<HTMLButtonElement>;
    @ViewChild('input') input?: ElementRef<HTMLTextAreaElement>;
    @ViewChild('panel') panel?: ElementRef<HTMLElement>;
    @ViewChild('log') log?: ElementRef<HTMLElement>;
    open = false;
    draft = '';
    loading = false;
    error = '';
    messages: ChatMessage[] = [];
    private request?: Subscription;
    private pending = '';
    constructor(
        private http: HttpClient,
        public auth: AuthService,
    ) {}
    toggle() {
        this.open ? this.close() : this.show();
    }
    show() {
        this.open = true;
        setTimeout(() => {
            (this.input?.nativeElement || this.panel?.nativeElement)?.focus();
            this.scroll();
        });
    }
    close() {
        this.open = false;
        this.launcher?.nativeElement.focus();
    }
    clear() {
        if (!this.loading) {
            this.messages = [];
            this.error = '';
            this.draft = '';
        }
    }
    cancel() {
        this.request?.unsubscribe();
        this.restoreDraft();
    }
    private restoreDraft() {
        if (this.pending) {
            this.messages.pop();
            this.draft = this.pending;
            this.pending = '';
        }
    }
    private scroll() {
        setTimeout(() => {
            const log = this.log?.nativeElement;
            if (log) log.scrollTop = log.scrollHeight;
        });
    }
    safeUrl(value: unknown): string | null {
        if (typeof value !== 'string') return null;
        try {
            const url = new URL(value, window.location.origin);
            return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
        } catch {
            return null;
        }
    }
    send() {
        const text = this.draft.trim();
        if (!text || this.loading || !this.auth.isLoggedIn()) return;
        if (text.length > 2000) {
            this.error = 'Message must be 2,000 characters or fewer.';
            return;
        }
        const history = this.messages
            .slice(-20)
            .map(({ role, content }) => ({ role, content }));
        this.error = '';
        this.pending = text;
        this.messages.push({ role: 'user', content: text });
        this.draft = '';
        this.loading = true;
        this.scroll();
        this.request = this.http
            .post<any>(`${environment.apiUrl}/chatbot/chat`, {
                message: text,
                history,
            })
            .pipe(
                timeout(45000),
                takeUntilDestroyed(this.destroyRef),
                finalize(() => (this.loading = false)),
            )
            .subscribe({
                next: (response) => {
                    if (
                        typeof response?.message !== 'string' ||
                        !response.message.trim()
                    ) {
                        this.restoreDraft();
                        this.error =
                            'The assistant is unavailable. Your message has been kept; please try again.';
                        return;
                    }
                    const sources = (
                        Array.isArray(response.sources) ? response.sources : []
                    )
                        .filter(
                            (s: any) =>
                                typeof s?.title === 'string' &&
                                this.safeUrl(s.url),
                        )
                        .map((s: any) => ({
                            title: s.title,
                            url: this.safeUrl(s.url)!,
                        }));
                    this.messages.push({
                        role: 'model',
                        content: response.message,
                        sources,
                    });
                    this.pending = '';
                    this.scroll();
                },
                error: (error) => {
                    this.restoreDraft();
                    this.error =
                        error.status === 429
                            ? 'Too many requests. Please try again later.'
                            : 'The assistant is unavailable. Your message has been kept; please try again.';
                    this.scroll();
                },
            });
    }
}
