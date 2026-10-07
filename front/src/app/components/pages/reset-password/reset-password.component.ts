import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../services/auth.service';
@Component({selector:'app-reset-password',templateUrl:'./reset-password.component.html',styleUrls:['../../forms/recovery.scss']})
export class ResetPasswordComponent implements OnInit {
  private destroyRef=inject(DestroyRef);
  token='';newPassword='';confirmPassword='';loading=false;success='';error='';validLink=false;
  constructor(private route:ActivatedRoute,private auth:AuthService) {}
  ngOnInit(){
    this.token=this.route.snapshot.paramMap.get('token')||'';this.validLink=/^[a-f0-9]{64}$/.test(this.token);
    if(!this.validLink)this.error='This reset link is incomplete or invalid. Request a new link below.';
    this.destroyRef.onDestroy(()=>{this.token='';this.newPassword='';this.confirmPassword='';});
  }
  resetPassword(){
    if(this.loading||!this.validLink)return;
    this.error='';
    if(this.newPassword!==this.confirmPassword){this.error='The passwords do not match. Enter the same password in both fields.';return;}
    this.loading=true;
    this.auth.resetPassword(this.token,this.newPassword).pipe(takeUntilDestroyed(this.destroyRef),finalize(()=>this.loading=false)).subscribe({
      next:()=>{this.newPassword='';this.confirmPassword='';this.success='Your password has been changed. Sign in again on each of your devices.';},
      error:err=>this.error=err.error?.message||'We could not reset your password. Check your connection or request a new link.'
    });
  }
}
