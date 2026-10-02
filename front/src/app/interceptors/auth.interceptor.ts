import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  // Routes where a 401 must NOT trigger a forced logout (anonymous browsing)
  private publicRoutes = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/verify-otp',
    '/api/auth/forgot-password',
    '/api/auth/reset-password'
  ];

  constructor(private authService: AuthService, private router: Router) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();

    if (token) {
      request = request.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          const isPublicRoute = this.publicRoutes.some(route =>
            request.url.includes(route)
          );

          if (!isPublicRoute) {
            // ✅ Any 401 on a protected route = invalid/expired/revoked session.
            // (Server-side tokenVersion revocation is now authoritative — no
            // more fragile string-matching on error messages.)
            this.authService.logout();
            this.router.navigate(['/profile-authentication'], {
              queryParams: { returnUrl: this.router.url }
            });
          }
        }

        return throwError(() => error);
      })
    );
  }
}