import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  Input,
  Output,
  EventEmitter
} from '@angular/core';

@Component({
  selector: 'app-otp-popup',
  templateUrl: './otp-popup.component.html',
  styleUrls: ['./otp-popup.component.scss']
})
export class OtpPopupComponent implements OnInit {

  @ViewChild('otpInput') otpInput!: ElementRef<HTMLInputElement>;

  // The 6-digit code to display, passed in by the parent page
  @Input() devOtp = '';

  // Emitted when the user taps Verify (or presses Enter)
  @Output() verified = new EventEmitter<string>();

  // Emitted when the popup should be dismissed (× button or Verify)
  @Output() closed = new EventEmitter<void>();

  otpCode = '';
  copied = false;

  ngOnInit(): void {
    this.otpCode = this.devOtp || '';
    // Focus + select the code as soon as the popup opens
    setTimeout(() => this.otpInput?.nativeElement.select(), 0);
  }

  onKeydown($event: KeyboardEvent): void {
    if ($event.key === 'Enter' && this.otpCode.trim().length === 6) {
      this.verify();
    }
  }

  verify(): void {
    const code = this.otpCode.trim();
    if (code.length !== 6) return;
    this.verified.emit(code);
    this.close();
  }

  close(): void {
    this.copied = false;
    this.closed.emit();
  }

  copyCode(): void {
    const code = this.otpCode.trim();
    if (!code) return;

    const markCopied = () => {
      this.copied = true;
      setTimeout(() => { this.copied = false; }, 1500);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code)
        .then(markCopied)
        .catch(() => { this.fallbackCopy(code); markCopied(); });
    } else {
      // Non-HTTPS or unsupported browsers (e.g. old mobile WebViews)
      this.fallbackCopy(code);
      markCopied();
    }
  }

  // Legacy copy path for contexts where the async Clipboard API is unavailable
  private fallbackCopy(code: string): void {
    const input = this.otpInput?.nativeElement;
    if (!input) return;
    input.select();
    try {
      document.execCommand('copy');
    } catch {
      // Clipboard blocked: the code stays visible so the user can copy manually
    }
  }
}
