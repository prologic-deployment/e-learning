import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { CheckoutService } from '../../../services/checkout.service';
import { formatTnd } from '../../../shared/pricing';
import { categoryColor, categoryIcon } from '../../../shared/categories';
import { environment } from '../../../../environments/environment';

type Brand = 'visa' | 'mastercard' | 'amex' | 'card';

/** Simulated payments: these numbers trigger specific outcomes (any expiry in the future, any CVC) */
export const TEST_CARDS = [
  { number: '4242 4242 4242 4242', label: 'Visa — payment succeeds', ok: true },
  { number: '5555 5555 5555 4444', label: 'Mastercard — payment succeeds', ok: true },
  { number: '4000 0000 0000 0002', label: 'Card declined', ok: false },
  { number: '4000 0000 0000 9995', label: 'Insufficient funds', ok: false },
  { number: '4000 0000 0000 0127', label: 'Incorrect CVC', ok: false }
];

@Component({
  selector: 'app-checkout-page',
  templateUrl: './checkout-page.component.html',
  styleUrls: ['./checkout-page.component.scss']
})
export class CheckoutPageComponent implements OnInit {
  quote: any = null;
  loading = true;
  loadError = '';

  // voucher
  voucherInput = '';
  appliedCode = '';
  voucherError = '';
  voucherLoading = false;

  // card
  card = { number: '', name: '', expiry: '', cvc: '' };
  errors: { [k: string]: string } = {};
  showTestCards = false;
  testCards = TEST_CARDS;

  paying = false;
  payError = '';
  order: any = null;
  invoiceLoading = false;

  fmt = formatTnd;
  color = categoryColor;
  icon = categoryIcon;

  constructor(
    private checkout: CheckoutService,
    private auth: AuthService,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/profile-authentication'], { queryParams: { returnUrl: '/checkout' } });
      return;
    }
    const user = this.auth.getCurrentUser();
    this.card.name = user ? `${user.firstname || ''} ${user.lastname || ''}`.trim() : '';
    this.loadQuote();
  }

  // ------------------------------------------------------------ quote / voucher

  loadQuote(code = this.appliedCode, after?: () => void): void {
    this.checkout.quote(code).subscribe({
      next: (res: any) => {
        this.quote = res.quote;
        this.loading = false;
        after?.();
      },
      error: (err) => {
        this.loading = false;
        this.loadError = err.error?.message || 'Could not load your order.';
      }
    });
  }

  applyVoucher(): void {
    const code = this.voucherInput.trim().toUpperCase();
    if (!code) return;
    this.voucherLoading = true;
    this.voucherError = '';
    this.loadQuote(code, () => {
      this.voucherLoading = false;
      if (this.quote.voucherError) {
        this.voucherError = this.quote.voucherError;
        this.appliedCode = '';
      } else {
        this.appliedCode = code;
        this.voucherInput = '';
      }
    });
  }

  removeVoucher(): void {
    this.appliedCode = '';
    this.voucherError = '';
    this.loadQuote('');
  }

  get free(): boolean { return !!this.quote && this.quote.items.length > 0 && this.quote.total === 0; }
  get savings(): number { return this.quote ? this.quote.saleSavings + this.quote.voucherDiscount : 0; }

  // ------------------------------------------------------------ card input

  get brand(): Brand {
    const n = this.digits(this.card.number);
    if (/^4/.test(n)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(n)) return 'mastercard';
    if (/^3[47]/.test(n)) return 'amex';
    return 'card';
  }

  private digits(v: string): string { return (v || '').replace(/\D/g, ''); }

  onNumber(v: string): void {
    const d = this.digits(v).slice(0, this.brand === 'amex' ? 15 : 19);
    this.card.number = this.brand === 'amex'
      ? [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(' ')
      : (d.match(/.{1,4}/g) || []).join(' ');
    delete this.errors['number'];
  }

  onExpiry(v: string): void {
    let d = this.digits(v).slice(0, 4);
    if (d.length === 1 && Number(d) > 1) d = '0' + d;           // "4" → "04"
    this.card.expiry = d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
    delete this.errors['expiry'];
  }

  onCvc(v: string): void {
    this.card.cvc = this.digits(v).slice(0, this.brand === 'amex' ? 4 : 3);
    delete this.errors['cvc'];
  }

  useTestCard(n: string): void {
    this.onNumber(n);
    if (!this.card.expiry) this.onExpiry('12' + String((new Date().getFullYear() + 3) % 100));
    if (!this.card.cvc) this.card.cvc = '123';
    this.showTestCards = false;
    this.payError = '';
  }

  private luhn(n: string): boolean {
    let sum = 0, dbl = false;
    for (let i = n.length - 1; i >= 0; i--) {
      let d = +n[i];
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d; dbl = !dbl;
    }
    return sum % 10 === 0;
  }

  /** Quick checks for instant feedback — the server validates again */
  private validate(): boolean {
    this.errors = {};
    const n = this.digits(this.card.number);
    if (!this.card.name.trim()) this.errors['name'] = 'Enter the name on the card.';
    if (n.length < 13 || !this.luhn(n)) this.errors['number'] = 'Your card number is invalid.';
    const [mm, yy] = this.card.expiry.split('/').map(s => Number(s.trim()));
    const now = new Date();
    const year = 2000 + (yy || 0);
    if (!mm || mm > 12 || !yy) this.errors['expiry'] = 'Enter the expiry date as MM / YY.';
    else if (year < now.getFullYear() || (year === now.getFullYear() && mm < now.getMonth() + 1)) this.errors['expiry'] = 'Your card has expired.';
    if (this.card.cvc.length !== (this.brand === 'amex' ? 4 : 3)) this.errors['cvc'] = 'Enter the security code.';
    return Object.keys(this.errors).length === 0;
  }

  // ------------------------------------------------------------ pay

  pay(): void {
    if (!this.quote?.items?.length || this.paying) return;
    this.payError = '';
    if (!this.free && !this.validate()) return;

    const [mm, yy] = this.card.expiry.split('/').map(s => s.trim());
    const card = this.free ? null : {
      number: this.digits(this.card.number),
      name: this.card.name.trim(),
      expMonth: Number(mm),
      expYear: 2000 + Number(yy),
      cvc: this.card.cvc
    };

    this.paying = true;
    this.checkout.pay(this.appliedCode || null, card).subscribe({
      next: (res: any) => {
        this.paying = false;
        this.order = res.order;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => {
        this.paying = false;
        const e = err.error || {};
        if (e.field === 'voucher') {
          this.voucherError = e.message;
          this.appliedCode = '';
          this.loadQuote('');
        } else if (e.field && ['number', 'expiry', 'cvc', 'name'].includes(e.field)) {
          this.errors[e.field] = e.message;
          this.payError = e.message;
        } else {
          this.payError = e.message || 'Payment failed. Please try again.';
          this.loadQuote();
        }
      }
    });
  }

  downloadInvoice(): void {
    const id = this.order?.purchases?.[0]?.id;
    if (!id) return;
    this.invoiceLoading = true;
    this.http.get(`${environment.apiUrl}/files/invoice/${id}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.invoiceLoading = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice_${this.order.orderReference}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      },
      error: () => { this.invoiceLoading = false; }
    });
  }
}
