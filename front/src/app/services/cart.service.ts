import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CartService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getCart(): Observable<any> {
    return this.http.get(`${this.apiUrl}/cart`);
  }

  addToCart(courseId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/cart/add`, { courseId });
  }

  removeFromCart(courseId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/cart/remove/${courseId}`);
  }

  clearCart(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/cart/clear`);
  }
}