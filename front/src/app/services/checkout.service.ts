import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CardInput {
  number: string;
  name: string;
  expMonth: number;
  expYear: number;
  cvc: string;
}

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** Price the cart (promotions + optional voucher) — no side effects */
  quote(voucherCode?: string): Observable<any> {
    return this.http.post(`${this.api}/checkout/quote`, { voucherCode: voucherCode || undefined });
  }

  /** Simulated payment; card can be omitted when a voucher covers everything */
  pay(voucherCode: string | null, card: CardInput | null): Observable<any> {
    return this.http.post(`${this.api}/checkout/pay`, { voucherCode: voucherCode || undefined, card: card || undefined });
  }

  // ----- admin
  listVouchers(): Observable<any> { return this.http.get(`${this.api}/vouchers`); }
  createVoucher(v: any): Observable<any> { return this.http.post(`${this.api}/vouchers`, v); }
  updateVoucher(id: string, v: any): Observable<any> { return this.http.patch(`${this.api}/vouchers/${id}`, v); }
  deleteVoucher(id: string): Observable<any> { return this.http.delete(`${this.api}/vouchers/${id}`); }
  setSale(courseId: string, salePrice: number | null, saleEndsAt: string | null): Observable<any> {
    return this.http.patch(`${this.api}/courses/${courseId}/sale`, { salePrice, saleEndsAt });
  }
}
