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
    // Learner sign-ups come back with a session (trainers stay locked until approved)
    return this.http.post(`${this.apiUrl}/auth/register`, data).pipe(
      tap((res: any) => this.storeSession(res))
    );
  }

  private storeSession(res: any): void {
    const token = res?.data?.token || res?.token;
    const user = res?.data?.user || res?.user;
    if (token && user) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      this.currentUserSubject.next(user);
    }
  }

  // Login
  login(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, data).pipe(
      // Single-step login: the session token comes back directly.
      tap((res: any) => this.storeSession(res))
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

  /** Merge fields into the signed-in user (e.g. a new avatar) and notify subscribers */
  updateCurrentUser(patch: any): void {
    const current = this.currentUserSubject.value;
    if (!current) return;
    const next = { ...current, ...patch };
    localStorage.setItem('user', JSON.stringify(next));
    this.currentUserSubject.next(next);
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getRole(): string {
    const user = this.getCurrentUser();
    return user ? user.role : '';
  }
}
