import {
    Directive,
    ElementRef,
    Optional,
    Self,
    OnDestroy,
} from '@angular/core';
import { NgForm, FormGroupDirective } from '@angular/forms';
@Directive({ selector: 'form', standalone: true })
export class ValidFormDirective implements OnDestroy {
    private block = (event: Event) => {
        const control = this.form?.control || this.reactive?.control;
        if (control?.invalid || !this.el.nativeElement.checkValidity()) {
            event.preventDefault();
            event.stopImmediatePropagation();
            control?.markAllAsTouched();
            const first = this.el.nativeElement.querySelector<HTMLElement>(
                'input.ng-invalid:not([disabled]),textarea.ng-invalid:not([disabled]),select.ng-invalid:not([disabled]),input:invalid,textarea:invalid,select:invalid',
            );
            first?.focus();
        }
    };
    constructor(
        private el: ElementRef<HTMLFormElement>,
        @Optional() @Self() private form: NgForm,
        @Optional() @Self() private reactive: FormGroupDirective,
    ) {
        el.nativeElement.addEventListener('submit', this.block, true);
    }
    ngOnDestroy() {
        this.el.nativeElement.removeEventListener('submit', this.block, true);
    }
}
