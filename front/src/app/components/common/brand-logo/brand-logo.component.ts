import { Component, Input } from '@angular/core';

/**
 * Prologic Academy logo — black & dark blue.
 *
 * Mark: a dark-blue square with a white blocky "P" whose bowl holds a
 * play-arrow notch. Wordmark: "PROLOGIC" in black, "ACADEMY" in dark blue,
 * set in the site heading font. Only the height is set, the width always
 * follows, so the logo can never be stretched.
 *
 *   <app-brand-logo></app-brand-logo>                 for light backgrounds (default)
 *   <app-brand-logo theme="dark"></app-brand-logo>    for dark backgrounds
 *   <app-brand-logo [markOnly]="true"></app-brand-logo>
 */
@Component({
  selector: 'app-brand-logo',
  template: `
    <span class="brand" [class.brand--dark]="theme === 'dark'" [style.height.px]="height"
          role="img" aria-label="Prologic Academy">
      <svg class="brand__mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <rect width="40" height="40" fill="#1E3A8A"/>
        <!-- blocky P: stem + bowl, with a play-triangle counter -->
        <path fill="#FFFFFF" d="M9 7h15a9 9 0 0 1 0 18h-7v8H9V7z"/>
        <path fill="#1E3A8A" d="M17 11.5v9l7-4.5z"/>
      </svg>
      <span class="brand__text" *ngIf="!markOnly">
        <span class="brand__name">PROLOGIC</span>
        <span class="brand__sub">ACADEMY</span>
      </span>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; line-height: 1; }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      user-select: none;
    }
    .brand__mark { height: 100%; width: auto; aspect-ratio: 1 / 1; display: block; flex: none; }
    .brand__text { display: inline-flex; flex-direction: column; justify-content: center; gap: 3px; }
    .brand__name {
      font-family: 'Space Grotesk', 'Inter', sans-serif;
      font-weight: 700;
      font-size: 19px;
      letter-spacing: 0.02em;
      line-height: 1;
      color: #0B0D12;
    }
    .brand__sub {
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      font-size: 9.5px;
      letter-spacing: 0.42em;
      line-height: 1;
      color: #1E3A8A;
    }
    .brand--dark .brand__name { color: #FFFFFF; }
    .brand--dark .brand__sub { color: #9DB4EE; }
  `]
})
export class BrandLogoComponent {
  /** 'light' = for light backgrounds (black text); 'dark' = for dark backgrounds */
  @Input() theme: 'dark' | 'light' = 'light';
  /** Logo height in px; width follows automatically */
  @Input() height = 38;
  @Input() markOnly = false;
}
