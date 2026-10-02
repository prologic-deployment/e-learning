import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Staff may now BROWSE the storefront (course pages, details, categories…) so
 * trainers and admins can preview their content. Only the homepage still
 * redirects staff to their dashboard, and learner-only areas (cart, CV,
 * recommendations) stay blocked.
 */
@Injectable({ providedIn: 'root' })
export class StaffRedirectGuard implements CanActivate {

  // Routes reserved for learners — staff are still redirected from these
  private learnerOnlyRoutes = ['/cart', '/cv', '/recommendations'];

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const user = this.authService.getCurrentUser();
    if (!user) return true; // pas connecté → laisser passer (AuthGuard gère ça)

    const role = user.role;
    const staffRoles = ['admin', 'trainer', 'manager'];
    if (!staffRoles.includes(role)) return true; // user normal → libre

    // Learner-only areas stay off-limits for staff
    if (this.learnerOnlyRoutes.some(r => state.url.startsWith(r))) {
      this.router.navigate([this.dashboardFor(role)]);
      return false;
    }

    // Homepage → dashboard (courses pages are now freely browsable)
    if (state.url === '/') {
      this.router.navigate([this.dashboardFor(role)]);
      return false;
    }

    return true;
  }

  private dashboardFor(role: string): string {
    const dashboardRoutes: Record<string, string> = {
      admin: '/admin-dashboard',
      trainer: '/trainer-dashboard',
      manager: '/manager-dashboard'
    };
    return dashboardRoutes[role] || '/';
  }
}
