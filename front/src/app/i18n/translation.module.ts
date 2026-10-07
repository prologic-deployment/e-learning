import {
    Injectable,
    NgModule,
    Pipe,
    PipeTransform,
    inject,
    signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FR } from './fr';
export type Language = 'en' | 'fr';
@Injectable({ providedIn: 'root' })
export class TranslationService {
    private document = inject(DOCUMENT);
    readonly language = signal<Language>(
        localStorage.getItem('formapath-language') === 'fr' ? 'fr' : 'en',
    );
    constructor() {
        this.document.documentElement.lang = this.language();
    }
    setLanguage(value: string) {
        if (value !== 'en' && value !== 'fr') return;
        this.language.set(value);
        this.document.documentElement.lang = value;
        localStorage.setItem('formapath-language', value);
    }
    translate(value: string | null | undefined): string {
        const text = value || '';
        return this.language() === 'fr'
            ? FR[text.replace(/\s+/g, ' ').trim()] || text
            : text;
    }
}
@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
    private translations = inject(TranslationService);
    transform(value: string | null | undefined) {
        return this.translations.translate(value);
    }
}
@NgModule({ imports: [TranslatePipe], exports: [TranslatePipe] })
export class TranslationModule {}
