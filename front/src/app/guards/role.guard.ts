import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const expectedRoles: string[] = route.data['roles'];
    const userRole = this.authService.getRole();

    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/profile-authentication']);
      return false;
    }

    if (expectedRoles && !expectedRoles.includes(userRole)) {
      // ✅ Rediriger vers le bon dashboard selon le rôle
      switch (userRole) {
        case 'admin':
          this.router.navigate(['/admin-dashboard']);
          break;
        case 'manager':
          this.router.navigate(['/manager-dashboard']);
          break;
        case 'trainer':
          this.router.navigate(['/trainer-dashboard']);
          break;
        default:
          this.router.navigate(['/dashboard']);
      }
      return false;
    }

    return true;
  }
}