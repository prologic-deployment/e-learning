import { Component, Input } from '@angular/core';
import { priceView, formatTnd, PriceView } from '../../../shared/pricing';

/**
 * Course price: "Free", or the price — with the old price struck through and
 * a "-x%" badge when a promotion is running.
 *
 *   <app-price [course]="course"></app-price>
 *   <app-price [course]="course" size="lg" [showEnds]="true"></app-price>
 */
@Component({
  selector: 'app-price',
  template: `
    <span class="pt" [ngClass]="'pt--' + size" *ngIf="v as p">
      <span class="pt__now" [class.free]="p.free">{{ p.free ? 'Free' : fmt(p.finalPrice) }}</span>
      <ng-container *ngIf="p.onSale">
        <s class="pt__old" [attr.aria-label]="'Regular price ' + fmt(p.price)">{{ fmt(p.price) }}</s>
        <span class="pt__off">-{{ p.discountPercent }}%</span>
      </ng-container>
      <span class="pt__ends" *ngIf="p.onSale && showEnds && p.saleEndsAt">
        <i class="bx bx-time-five"></i> {{ endsLabel(p.saleEndsAt) }}
      </span>
    </span>
  `,
  styles: [`
    :host { display: inline-block; }
    .pt { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; }
    .pt__now { font-weight: 800; color: var(--ink, #0B0D12); }
    .pt__now.free { color: #15803D; }
    .pt__old { color: var(--text-muted, #5B6270); font-weight: 500; text-decoration-thickness: 1.5px; }
    .pt__off { align-self: center; padding: 1px 6px; font-size: 11px; font-weight: 800; line-height: 1.5;
               color: #fff; background: var(--brand, #1E3A8A); }
    .pt__ends { flex-basis: 100%; font-size: 12px; font-weight: 600; color: #B45309; }
    .pt--sm .pt__now { font-size: 15px; } .pt--sm .pt__old { font-size: 12px; }
    .pt--md .pt__now { font-size: 17px; } .pt--md .pt__old { font-size: 13px; }
    .pt--lg .pt__now { font-size: 32px; font-family: var(--fontDisplay, 'Space Grotesk', sans-serif); font-weight: 700; }
    .pt--lg .pt__old { font-size: 17px; }
    .pt--lg .pt__off { font-size: 12px; padding: 2px 8px; }
  `]
})
export class PriceTagComponent {
  @Input() set course(c: any) { this.v = c ? priceView(c) : null; }
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() showEnds = false;
  v: PriceView | null = null;

  fmt = formatTnd;

  endsLabel(iso: string): string {
    const ms = new Date(iso).getTime() - Date.now();
    const days = Math.floor(ms / 864e5);
    if (days >= 2) return `Offer ends in ${days} days`;
    const hours = Math.max(1, Math.round(ms / 36e5));
    return days === 1 ? 'Offer ends tomorrow' : `Offer ends in ${hours} h`;
  }
}
