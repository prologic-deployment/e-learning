import { Injectable, inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';

/** Registered only while the authoring workspace exists. */
@Injectable({ providedIn: 'root' })
export class UnsavedAuthoringService {
  check: ((url: string) => boolean) | null = null;
  private approvedNavigation: number | undefined;
  private router = inject(Router);

  /** Check before clearing the session; decline must preserve both session and draft. */
  prepareLogout(): boolean {
    if (this.check && !this.check('/profile-authentication')) return false;
    this.check = null;
    return true;
  }

  allow(url: string): boolean {
    const id = this.router.getCurrentNavigation()?.id;
    if (id !== undefined && id === this.approvedNavigation) return true;
    if (!this.check || this.check(url)) {
      this.approvedNavigation = id;
      return true;
    }
    return false;
  }
}
export const authoringActivateGuard: CanActivateFn = (_, state) =>
  inject(UnsavedAuthoringService).allow(state.url);
export const authoringDeactivateGuard: CanDeactivateFn<unknown> = (_, __, ___, next) =>
  inject(UnsavedAuthoringService).allow(next.url);
