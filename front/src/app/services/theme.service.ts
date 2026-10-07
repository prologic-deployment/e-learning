import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
@Injectable({ providedIn: 'root' })
export class ThemeService {
    private document = inject(DOCUMENT);
    constructor() {
        const stored = localStorage.getItem('lms-theme');
        this.document.documentElement.classList.toggle(
            'dark',
            stored
                ? stored === 'dark'
                : matchMedia('(prefers-color-scheme: dark)').matches,
        );
    }
    get dark() {
        return this.document.documentElement.classList.contains('dark');
    }
    toggle() {
        const dark = !this.dark;
        this.document.documentElement.classList.toggle('dark', dark);
        localStorage.setItem('lms-theme', dark ? 'dark' : 'light');
    }
}
