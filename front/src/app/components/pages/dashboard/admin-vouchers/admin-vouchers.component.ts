import { Component, OnInit } from '@angular/core';
import { CheckoutService } from '../../../../services/checkout.service';
import { CourseService } from '../../../../services/course.service';
import { formatTnd, priceView } from '../../../../shared/pricing';

const emptyForm = () => ({
  code: '',
  description: '',
  course: '',            // '' = every paid course
  type: 'percent' as 'percent' | 'fixed',
  value: 20 as number | null,
  maxUses: null as number | null,
  perUserLimit: 1 as number | null,
  emailDomain: '',
  startsAt: '',
  expiresAt: ''
});

/** Admin — vouchers (codes) and course promotions (old price → new price) */
@Component({
  selector: 'app-admin-vouchers',
  templateUrl: './admin-vouchers.component.html',
  styleUrls: ['./admin-vouchers.component.scss']
})
export class AdminVouchersComponent implements OnInit {
  section: 'vouchers' | 'promotions' = 'vouchers';

  vouchers: any[] = [];
  loading = true;
  courses: any[] = [];              // paid courses (for scope + promotions)

  showForm = false;
  form = emptyForm();
  saving = false;
  formError = '';
  notice = '';
  expanded: string | null = null;
  copied = '';

  // promotions
  promoSearch = '';
  promoEdit: { [id: string]: { salePrice: number | null; saleEndsAt: string; saving?: boolean; error?: string } } = {};

  fmt = formatTnd;
  pv = priceView;

  constructor(private checkout: CheckoutService, private courseService: CourseService) {}

  ngOnInit(): void {
    this.loadVouchers();
    this.loadCourses();
  }

  // ------------------------------------------------------------ data
  loadVouchers(): void {
    this.loading = true;
    this.checkout.listVouchers().subscribe({
      next: (res: any) => { this.vouchers = res.vouchers || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  loadCourses(): void {
    this.courseService.getManagedCourses().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : (res.courses || res.data || []);
        this.courses = list.filter((c: any) => c.price > 0 && c.isApproved)
          .sort((a: any, b: any) => a.title.localeCompare(b.title));
        for (const c of this.courses) this.resetPromo(c);
      }
    });
  }

  // ------------------------------------------------------------ vouchers
  openForm(preset?: 'staff'): void {
    this.form = emptyForm();
    if (preset === 'staff') {
      Object.assign(this.form, {
        code: 'STAFF-' + new Date().getFullYear(),
        description: 'Internal staff — free access to every course',
        type: 'percent', value: 100, perUserLimit: null, emailDomain: 'prologic.com.tn'
      });
    }
    this.formError = '';
    this.showForm = true;
  }

  save(): void {
    this.formError = '';
    const f = this.form;
    if (!f.value || f.value <= 0) { this.formError = 'Enter the discount value.'; return; }
    if (f.type === 'percent' && f.value > 100) { this.formError = 'A percentage cannot exceed 100.'; return; }
    if (f.startsAt && f.expiresAt && f.expiresAt <= f.startsAt) { this.formError = 'The expiry must be after the start date.'; return; }
    this.saving = true;
    this.checkout.createVoucher({
      ...f,
      course: f.course || null,
      startsAt: f.startsAt || null,
      expiresAt: f.expiresAt ? f.expiresAt + 'T23:59:59' : null
    }).subscribe({
      next: (res: any) => {
        this.saving = false;
        this.showForm = false;
        this.vouchers = [res.voucher, ...this.vouchers];
        this.flash(`Voucher ${res.voucher.code} created.`);
      },
      error: (err) => { this.saving = false; this.formError = err.error?.message || 'Could not create the voucher.'; }
    });
  }

  toggle(v: any): void {
    this.checkout.updateVoucher(v._id, { active: !v.active }).subscribe({
      next: (res: any) => this.replace(res.voucher),
      error: (err) => this.flash(err.error?.message || 'Update failed')
    });
  }

  remove(v: any): void {
    const msg = v.usedCount > 0
      ? `${v.code} has been used ${v.usedCount} time(s). It will be deactivated (kept for the order history). Continue?`
      : `Delete voucher ${v.code}?`;
    if (!confirm(msg)) return;
    this.checkout.deleteVoucher(v._id).subscribe({
      next: (res: any) => {
        if (res.deleted) this.vouchers = this.vouchers.filter(x => x._id !== v._id);
        else { v.active = false; v.status = 'inactive'; }
        this.flash(res.deleted ? `${v.code} deleted.` : `${v.code} deactivated.`);
      }
    });
  }

  copy(code: string): void {
    navigator.clipboard?.writeText(code).then(() => {
      this.copied = code;
      setTimeout(() => this.copied = '', 1500);
    });
  }

  private replace(v: any): void {
    this.vouchers = this.vouchers.map(x => x._id === v._id ? { ...x, ...v, redemptions: x.redemptions } : x);
  }

  private flash(m: string): void {
    this.notice = m;
    setTimeout(() => this.notice = '', 3500);
  }

  discountLabel(v: any): string {
    if (v.type === 'percent') return v.value === 100 ? 'Free (100%)' : `${v.value}% off`;
    return `${this.fmt(v.value)} off`;
  }

  // ------------------------------------------------------------ promotions
  get promoCourses(): any[] {
    const q = this.promoSearch.trim().toLowerCase();
    return q ? this.courses.filter(c => c.title.toLowerCase().includes(q)) : this.courses;
  }

  get activePromotions(): number {
    return this.courses.filter(c => this.pv(c).onSale).length;
  }

  private resetPromo(c: any): void {
    this.promoEdit[c._id] = {
      salePrice: this.pv(c).onSale ? c.salePrice : null,
      saleEndsAt: c.saleEndsAt && this.pv(c).onSale ? String(c.saleEndsAt).slice(0, 10) : ''
    };
  }

  previewPct(c: any): number | null {
    const s = this.promoEdit[c._id]?.salePrice;
    if (s === null || s === undefined || (s as any) === '' || s >= c.price || s < 0) return null;
    return Math.round((1 - s / c.price) * 100);
  }

  savePromo(c: any, clear = false): void {
    const e = this.promoEdit[c._id];
    e.error = '';
    const price = clear || e.salePrice === null || (e.salePrice as any) === '' ? null : Number(e.salePrice);
    if (price !== null && (price < 0 || price >= c.price)) { e.error = `Between 0 and ${c.price} TND (excluded).`; return; }
    e.saving = true;
    this.checkout.setSale(c._id, price, price !== null && e.saleEndsAt ? e.saleEndsAt + 'T23:59:59' : null).subscribe({
      next: (res: any) => {
        e.saving = false;
        Object.assign(c, { salePrice: res.course.salePrice, saleEndsAt: res.course.saleEndsAt });
        this.resetPromo(c);
        this.flash(price === null ? `Promotion removed from “${c.title}”.` : `“${c.title}” now ${this.fmt(price)} instead of ${this.fmt(c.price)}.`);
      },
      error: (err) => { e.saving = false; e.error = err.error?.message || 'Could not save.'; }
    });
  }
}
