import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';

/**
 * Public certificate verification — opened by the QR code printed on every
 * certificate (/verify/<serial>), or used manually from /verify.
 */
@Component({
  selector: 'app-verify-certificate',
  templateUrl: './verify-certificate.component.html',
  styleUrls: ['./verify-certificate.component.scss']
})
export class VerifyCertificateComponent implements OnInit, OnDestroy {
  serialInput = '';
  loading = false;
  searched = false;
  notFound = false;
  error = '';
  result: any = null;
  private sub?: Subscription;

  constructor(private route: ActivatedRoute, private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe(p => {
      const serial = p.get('serial');
      if (serial) {
        this.serialInput = serial;
        this.lookup(serial);
      } else {
        this.reset();
      }
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  submit(): void {
    const serial = this.serialInput.trim().toUpperCase();
    if (!serial) return;
    this.router.navigate(['/verify', serial]);
  }

  private reset(): void {
    this.searched = false;
    this.notFound = false;
    this.error = '';
    this.result = null;
  }

  private lookup(serial: string): void {
    this.reset();
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/certificates/public/${encodeURIComponent(serial.trim())}`).subscribe({
      next: res => { this.loading = false; this.searched = true; this.result = res; },
      error: err => {
        this.loading = false;
        this.searched = true;
        if (err.status === 404) this.notFound = true;
        else this.error = 'The verification service is unavailable. Please try again later.';
      }
    });
  }

  get statusLabel(): string {
    switch (this.result?.status) {
      case 'valid': return 'Valid certificate';
      case 'revoked': return 'Certificate revoked';
      default: return 'Certificate not authentic';
    }
  }

  get statusText(): string {
    switch (this.result?.status) {
      case 'valid': return 'This certificate was issued by Prologic Academy and is currently valid.';
      case 'revoked': return 'This certificate was issued by Prologic Academy but has since been revoked.';
      default: return 'The record does not match its signature. Do not rely on this certificate.';
    }
  }

  get statusIcon(): string {
    return this.result?.status === 'valid' ? 'bx-check-shield'
      : this.result?.status === 'revoked' ? 'bx-block' : 'bx-error';
  }
}
