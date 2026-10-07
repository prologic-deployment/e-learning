import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../services/auth.service';
@Component({ selector: 'app-profile-authentication-page', templateUrl: './profile-authentication-page.component.html', styleUrls: ['./profile-authentication-page.component.scss'] })
export class ProfileAuthenticationPageComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  activeTab = 'login'; passwordVisible = false;
  loginData = {email: '', password: ''};
  registerData = {firstname: '', lastname: '', email: '', password: '', dateOfBirth: '', phone: ''};
  loading = false; error = ''; success = ''; challenge = ''; code = ''; recoveryMode = false;
  today = new Date().toISOString().slice(0, 10);
  constructor(private auth: AuthService, private router: Router, private route: ActivatedRoute) {}
  ngOnInit() {
    if (this.auth.isLoggedIn()) { this.redirectByRole(); return; }
    this.activeTab = this.route.snapshot.queryParams['tab'] === 'register' ? 'register' : 'login';
    this.destroyRef.onDestroy(() => { this.challenge = ''; this.code = ''; this.loginData.password = ''; this.registerData.password = ''; });
  }
  toggleTheme() { const dark = !document.documentElement.classList.contains('dark'); document.documentElement.classList.toggle('dark', dark); localStorage.setItem('lms-theme', dark ? 'dark' : 'light'); }
  switchTab(tab: string) { if (this.loading) return; this.activeTab = tab; this.error = ''; this.success = ''; this.challenge = ''; this.code = ''; }
  startAgain() { this.challenge = ''; this.code = ''; this.error = ''; this.recoveryMode = false; }
  onLogin() {
    if (this.loading) return;
    this.loading = true; this.error = '';
    this.auth.login(this.loginData).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false)).subscribe({
      next: res => { this.loginData.password = ''; if (res.requiresTwoFactor) { this.challenge = res.challenge; setTimeout(() => document.querySelector<HTMLInputElement>('input[autocomplete=one-time-code]')?.focus()); } else this.redirectByRole(); },
      error: err => { this.error = err.error?.message || 'Sign-in is unavailable. Check your connection and try again.'; }
    });
  }
  verify() {
    if (this.loading) return;
    this.loading = true; this.error = '';
    this.auth.verifyFactor({challenge: this.challenge, ...(this.recoveryMode ? {recoveryCode: this.code} : {code: this.code})}).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false)).subscribe({
      next: () => { this.challenge = ''; this.code = ''; this.redirectByRole(); },
      error: err => { this.code = ''; this.error = err.error?.message || 'Verification is unavailable. Please try again.'; }
    });
  }
  onRegister() {
    if (this.loading) return;
    this.loading = true; this.error = '';
    this.auth.register(this.registerData).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false)).subscribe({
      next: () => { this.loginData.email = this.registerData.email; this.registerData.password = ''; this.activeTab = 'login'; this.success = 'Your account is ready. Sign in to begin.'; },
      error: err => this.error = err.error?.message || 'Registration is unavailable. Please try again.'
    });
  }
  redirectByRole() {
    const url = this.route.snapshot.queryParams['returnUrl'];
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.includes('\\') && !url.startsWith('/profile-authentication')) { this.router.navigateByUrl(url); return; }
    const role = this.auth.getRole();
    this.router.navigate([role === 'user' ? '/dashboard' : `/${role}-dashboard`]);
  }
}
