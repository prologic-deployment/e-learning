import { Component, DestroyRef, inject } from '@angular/core';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../services/auth.service';
@Component({selector:'app-forgot-password',templateUrl:'./forgot-password-page.component.html',styleUrls:['../../forms/recovery.scss']})
export class ForgotPasswordComponent {
  private destroyRef=inject(DestroyRef);
  email='';loading=false;success='';error='';
  constructor(private auth:AuthService) {}
  sendResetLink() {
    if(this.loading)return;
    this.loading=true;this.error='';this.success='';
    this.auth.forgotPassword(this.email).pipe(takeUntilDestroyed(this.destroyRef),finalize(()=>this.loading=false)).subscribe({
      next:()=>this.success='If an account exists for this email, a reset link has been sent. Check your inbox and spam folder.',
      error:err=>this.error=err.error?.message||'We could not request a reset link. Check your connection and try again.'
    });
  }
}
