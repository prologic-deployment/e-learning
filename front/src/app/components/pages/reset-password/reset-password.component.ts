import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html'
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  newPassword = '';
  confirmPassword = '';
  loading = false;
  success = '';
  error = '';

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) {
      this.error = 'Invalid reset link !';
    }
  }

  resetPassword(): void {
    if (!this.newPassword || !this.confirmPassword) {
      this.error = 'Please fill all fields !';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match !';
      return;
    }
    if (this.newPassword.length < 8) {
      this.error = 'Password must be at least 8 characters !';
      return;
    }

    this.loading = true;
    this.error = '';

    this.authService.resetPassword(this.token, this.newPassword).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Password reset successfully !';
        setTimeout(() => {
          this.router.navigate(['/profile-authentication']);
        }, 3000);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Error resetting password';
      }
    });
  }
}