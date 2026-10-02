import { Component } from '@angular/core';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password-page.component.html', // ✅ nom correct
  styleUrls: ['./forgot-password-page.component.scss']
})
export class ForgotPasswordComponent {
  email = '';
  loading = false;
  success = '';
  error = '';

  constructor(private authService: AuthService) {}

  sendResetLink(): void {
    if (!this.email) {
      this.error = 'Please enter your email !';
      return;
    }
    this.loading = true;
    this.error = '';
    this.success = '';

    this.authService.forgotPassword(this.email).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Reset link sent ! Check your email.';
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Error sending reset link';
      }
    });
  }
}