import { AfterContentChecked, Component, ContentChild, ElementRef, Input, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgControl, NgForm } from '@angular/forms';
import { UiModule } from '../ui/ui.module';
let nextId = 0;
@Component({
  selector: 'app-form-field', standalone: true, imports: [CommonModule, UiModule],
  template: `<label hlmLabel [for]="id">{{label}} <span *ngIf="required" aria-hidden="true">*</span></label>
    <ng-content></ng-content><p class="field-hint" [id]="id + '-hint'" *ngIf="hint">{{hint}}</p>
    <p class="field-error" [id]="id + '-error'" *ngIf="error" role="alert">{{error}}</p>`,
  styles: [':host{display:grid;gap:.5rem;min-width:0;margin-bottom:1.15rem}.field-hint,.field-error{font-size:.82rem;margin:0;line-height:1.5}.field-hint{color:var(--muted-foreground,#596579)}.field-error{color:#bb2637}']
})
export class FormFieldComponent implements AfterContentChecked {
  @Input() label = ''; @Input() hint = ''; @Input() required = false;
  id = `field-${++nextId}`;
  @ContentChild(NgControl) control?: NgControl;
  constructor(private element: ElementRef<HTMLElement>, @Optional() private form: NgForm) {}
  get error(): string {
    const c = this.control;
    if (!c?.invalid || !(c.touched || this.form?.submitted)) return '';
    if (c.errors?.['required']) return `${this.label} is required.`;
    if (c.errors?.['email']) return 'Enter a valid email address.';
    if (c.errors?.['minlength']) return `Use at least ${c.errors['minlength'].requiredLength} characters.`;
    if (c.errors?.['min']) return `Use a value of at least ${c.errors['min'].min}.`;
    if (c.errors?.['max']) return `Use a value no greater than ${c.errors['max'].max}.`;
    return this.hint || `Check ${this.label.toLowerCase()}.`;
  }
  ngAfterContentChecked() {
    const input = this.element.nativeElement.querySelector('input,select,textarea');
    if (!input) return;
    input.id = this.id;
    input.setAttribute('aria-invalid', String(!!this.error));
    input.setAttribute('aria-describedby', [this.hint ? `${this.id}-hint` : '', this.error ? `${this.id}-error` : ''].filter(Boolean).join(' '));
    if (this.required) input.setAttribute('aria-required', 'true');
  }
}
