import {
    Directive,
    ElementRef,
    Input,
    OnChanges,
    AfterViewInit,
    OnDestroy,
    DoCheck,
    Injector,
    forwardRef,
    Renderer2,
    HostListener,
} from '@angular/core';
import {
    AbstractControl,
    NG_VALIDATORS,
    NgControl,
    NgForm,
    ValidationErrors,
    Validator,
} from '@angular/forms';
import { Subscription } from 'rxjs';
import { fieldIssue } from './input-policy';
import { ValidationFeedbackService } from './validation-feedback.service';
let serial = 0;
@Directive({
    selector:
        'input[ngModel],textarea[ngModel],select[ngModel],input[formControl],textarea[formControl],select[formControl],input[formControlName],textarea[formControlName],select[formControlName]',
    standalone: true,
    providers: [
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => InputValidationDirective),
            multi: true,
        },
    ],
})
export class InputValidationDirective
    implements Validator, OnChanges, AfterViewInit, DoCheck, OnDestroy
{
    @Input() appInputRule = '';
    @Input() appFieldPath = '';
    @Input() appValidationScope = '';
    @Input() appMatches: any = undefined;
    @Input() appDateAfter = '';
    private control: NgControl | null = null;
    private form: NgForm | null = null;
    private feedbackSub?: Subscription;
    private external = '';
    private hint: HTMLElement | null = null;
    private last = '';
    private changed = () => {};
    private errorId = 'input-error-' + ++serial;
    constructor(
        private el: ElementRef<HTMLInputElement>,
        private injector: Injector,
        private renderer: Renderer2,
        private feedback: ValidationFeedbackService,
    ) {}
    validate(control: AbstractControl): ValidationErrors | null {
        const e = this.el.nativeElement,
            v = control.value;
        if (control.disabled || e.disabled) return null;
        let error = this.external;
        if (
            !error &&
            e.required &&
            (v == null ||
                v === '' ||
                (typeof v === 'string' &&
                    !v.trim() &&
                    this.appInputRule !== 'currentPassword') ||
                (e.type === 'checkbox' && !v))
        )
            error = 'This field is required.';
        const rule =
            this.appInputRule ||
            (e.type === 'email'
                ? 'email'
                : e.type === 'number'
                  ? 'number'
                  : e.type === 'date'
                    ? 'date'
                    : '');
        if (!error && rule) error = fieldIssue(rule, v, e.required);
        if (!error && e.validity?.badInput) error = 'Enter a valid value.';
        if (!error && v !== null && v !== undefined && v !== '') {
            if (
                typeof v === 'string' &&
                e.maxLength > 0 &&
                v.length > e.maxLength
            )
                error = `Use no more than ${e.maxLength} characters.`;
            if (e.type === 'number') {
                const n = Number(v);
                if (e.min !== '' && n < Number(e.min))
                    error = `Use a value of at least ${e.min}.`;
                if (e.max !== '' && n > Number(e.max))
                    error = `Use a value no greater than ${e.max}.`;
                const step = e.getAttribute('step');
                if (
                    step &&
                    step !== 'any' &&
                    Math.abs(
                        (n - Number(e.min || 0)) / Number(step) -
                            Math.round((n - Number(e.min || 0)) / Number(step)),
                    ) > 0.000001
                )
                    error = `Use increments of ${step}.`;
            }
            if (e.type === 'date') {
                if (e.min && v < e.min) error = `Choose ${e.min} or later.`;
                if (e.max && v > e.max) error = `Choose ${e.max} or earlier.`;
            }
            if (
                this.appDateAfter &&
                typeof v === 'string' &&
                v < this.appDateAfter
            )
                error = 'End date must be on or after start date.';
            if (this.appMatches !== undefined && v !== this.appMatches)
                error = 'Passwords must match.';
        }
        return error ? { inputPolicy: { message: error } } : null;
    }
    registerOnValidatorChange(fn: () => void) {
        this.changed = fn;
    }
    ngOnChanges() {
        this.changed();
    }
    ngAfterViewInit() {
        this.control = this.injector.get(NgControl, null);
        this.form = this.injector.get(NgForm, null);
        this.feedbackSub = this.feedback.failures.subscribe(
            ({ path, issues }) => {
                if (
                    this.appValidationScope &&
                    !path.split('?')[0].endsWith(this.appValidationScope)
                )
                    return;
                const error = issues[this.appFieldPath];
                if (error) {
                    this.external = error;
                    this.control?.control?.markAsTouched();
                    this.changed();
                    this.render();
                }
            },
        );
    }
    @HostListener('input') input() {
        if (this.external) {
            this.external = '';
            this.changed();
        }
    }
    @HostListener('change') change() {
        this.input();
    }
    ngDoCheck() {
        this.render();
    }
    private render() {
        const c = this.control;
        const visible = !!(c?.touched || this.form?.submitted || this.external);
        const errors = c?.errors;
        let message = visible
            ? errors?.['inputPolicy']?.message || this.external || ''
            : '';
        if (!message && visible && errors) {
            if (errors['required']) message = 'This field is required.';
            else if (errors['email']) message = 'Enter a valid email address.';
            else if (errors['pattern']) message = 'Use the requested format.';
            else if (errors['minlength'])
                message = `Use at least ${errors['minlength'].requiredLength} characters.`;
        }
        if (message === this.last) return;
        this.last = message;
        const e = this.el.nativeElement;
        e.setAttribute('aria-invalid', String(!!message));
        if (e.closest('app-form-field')) return; // Existing field component owns its error region.
        if (!this.hint) {
            this.hint = this.renderer.createElement('small');
            this.renderer.setAttribute(this.hint, 'id', this.errorId);
            this.renderer.setAttribute(this.hint, 'role', 'status');
            this.renderer.addClass(this.hint, 'control-validation-message');
            this.renderer.insertBefore(e.parentNode, this.hint, e.nextSibling);
        }
        this.renderer.setProperty(this.hint, 'textContent', message);
        this.renderer.setProperty(this.hint, 'hidden', !message);
        const ids = (e.getAttribute('aria-describedby') || '')
            .split(' ')
            .filter((id) => id && id !== this.errorId);
        if (message) ids.push(this.errorId);
        if (ids.length) e.setAttribute('aria-describedby', ids.join(' '));
        else e.removeAttribute('aria-describedby');
    }
    ngOnDestroy() {
        this.feedbackSub?.unsubscribe();
        if (this.hint?.parentNode) this.hint.remove();
    }
}
