import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiModule } from '../../ui/ui.module';
import {
    TranslationModule,
    TranslationService,
} from '../../../i18n/translation.module';
import { ThemeService } from '../../../services/theme.service';
@Component({
    selector: 'app-language-switcher',
    standalone: true,
    imports: [CommonModule, UiModule, TranslationModule],
    templateUrl: './language-switcher.component.html',
    styleUrls: ['./language-switcher.component.scss'],
})
export class LanguageSwitcherComponent {
    readonly languages = [
        {
            code: 'en' as const,
            name: 'English',
            description: 'Interface in English',
        },
        {
            code: 'fr' as const,
            name: 'Français',
            description: 'Interface in French',
        },
    ];
    constructor(
        public i18n: TranslationService,
        public theme: ThemeService,
    ) {}
    get current() {
        return this.languages.find(
            (language) => language.code === this.i18n.language(),
        )!;
    }
}
