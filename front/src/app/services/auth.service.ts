import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    try {
      const user = localStorage.getItem('user');
      if (user && user !== 'undefined') {
        this.currentUserSubject.next(JSON.parse(user));
      }
    } catch (e) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  }

  // Register
  register(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, data);
  }

  // Login
  login(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, data).pipe(
      tap((res: any) => {
        // Admin -> token direct
        if (res.token && res.user) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('user', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
        }
      })
    );
  }

  verifyOTP(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/verify-otp`, data).pipe(
      tap((res: any) => {
        // Accept both response shapes (data wrapper or flat)
        const token = res.data?.token || res.token;
        const user = res.data?.user || res.user;

        if (token && user) {
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          this.currentUserSubject.next(user);
        }
      })
    );
  }

  // Forgot Password
  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  // Reset Password
  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reset-password/${token}`, { 
      newPassword: password  // ✅ doit s'appeler newPassword
    });
  }

  // Logout
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  // Getters
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getRole(): string {
    const user = this.getCurrentUser();
    const role = Array.isArray(user?.role) ? user.role[0] : user?.role;
    return typeof role === 'string' ? role.toLowerCase() : '';
  }
}
