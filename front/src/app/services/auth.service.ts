import { UnsavedAuthoringService } from '../guards/unsaved-authoring.guard';
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

  constructor(private unsavedAuthoring: UnsavedAuthoringService, private http: HttpClient) {
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

  acceptSession(res: any): void {
    if (!res?.token || !res?.user) return;
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    this.currentUserSubject.next(res.user);
  }
  login(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, data).pipe(tap(res => this.acceptSession(res)));
  }
  verifyFactor(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/two-factor/verify`, data).pipe(tap(res => this.acceptSession(res)));
  }
  factorStatus(): Observable<any> { return this.http.get(`${this.apiUrl}/auth/two-factor`); }
  beginSetup(currentPassword: string): Observable<any> { return this.http.post(`${this.apiUrl}/auth/two-factor/setup`, {currentPassword}); }
  confirmSetup(setupToken: string, code: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/two-factor/confirm`, {setupToken, code}).pipe(tap(res => this.acceptSession(res)));
  }
  cancelSetup(): Observable<any> { return this.http.delete(`${this.apiUrl}/auth/two-factor/setup`); }
  disableFactor(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/two-factor/disable`, data).pipe(tap(res => this.acceptSession(res)));
  }

  // Forgot Password
  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  // Reset Password
  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reset-password/${token}`, {
      newPassword: password  //  doit s'appeler newPassword
    });
  }

  // Logout
  logout(): boolean {
    if (!this.unsavedAuthoring.prepareLogout()) return false;
    // Capture the existing bearer token before clearing local state.
    const token = this.getToken();
    if (token) this.http.post(`${this.apiUrl}/auth/logout`, {}, {headers: {Authorization: `Bearer ${token}`}}).subscribe({error: () => {}});
    this.clearSession();
    return true;
  }
  clearSession(): void {
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
