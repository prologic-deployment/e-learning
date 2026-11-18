import { Component, Input } from '@angular/core';

/**
 * Prologic Academy logo.
 *
 * The mark is pure SVG geometry (a blocky "P" cut out of an orange square,
 * with a play-arrow notch) and the wordmark is live text in the site
 * heading font — so it is crisp at any size and can never be stretched:
 * only the height is set, the width always follows.
 *
 *   <app-brand-logo theme="dark"></app-brand-logo>   light text, for dark bars
 *   <app-brand-logo theme="light"></app-brand-logo>  dark text, for light pages
 *   <app-brand-logo [markOnly]="true"></app-brand-logo>
 */
@Component({
  selector: 'app-brand-logo',
  template: `
    <span class="brand" [class.brand--dark]="theme === 'dark'" [style.height.px]="height"
          role="img" aria-label="Prologic Academy">
      <svg class="brand__mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <rect width="40" height="40" fill="#FF5A1F"/>
        <!-- blocky P: stem + bowl, with a play-triangle counter -->
        <path fill="#0B0D12" d="M9 7h15a9 9 0 0 1 0 18h-7v8H9V7z"/>
        <path fill="#FF5A1F" d="M17 11.5v9l7-4.5z"/>
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
      color: #0B0D12;
      text-decoration: none;
      user-select: none;
    }
    .brand--dark { color: #F4F5F7; }
    .brand__mark { height: 100%; width: auto; aspect-ratio: 1 / 1; display: block; flex: none; }
    .brand__text { display: inline-flex; flex-direction: column; justify-content: center; gap: 3px; }
    .brand__name {
      font-family: 'Space Grotesk', 'Inter', sans-serif;
      font-weight: 700;
      font-size: 19px;
      letter-spacing: 0.02em;
      line-height: 1;
    }
    .brand__sub {
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: 9.5px;
      letter-spacing: 0.42em;
      line-height: 1;
      color: #FF5A1F;
    }
  `]
})
export class BrandLogoComponent {
  /** 'dark' = for dark backgrounds (light text); 'light' = for light backgrounds */
  @Input() theme: 'dark' | 'light' = 'light';
  /** Logo height in px; width follows automatically */
  @Input() height = 38;
  @Input() markOnly = false;
}
