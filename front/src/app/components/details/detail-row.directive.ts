import {
    Directive,
    ElementRef,
    HostBinding,
    HostListener,
    Input,
} from '@angular/core';
import { DetailRef, DetailService } from './detail.service';
@Directive({ selector: '[appDetailRow]', standalone: true })
export class DetailRowDirective {
    @Input() appDetailRow!: DetailRef;
    @HostBinding('class.detail-record-row') readonly rowClass = true;
    @HostBinding('attr.data-record-kind') get kind() {
        return this.appDetailRow?.kind;
    }
    @HostBinding('attr.tabindex') get tabIndex() {
        return this.appDetailRow?.id ? 0 : null;
    }
    @HostBinding('attr.aria-haspopup') readonly popup = 'dialog';
    @HostBinding('attr.title') readonly hint =
        'View record details · Enter or Space';
    constructor(
        private details: DetailService,
        private host: ElementRef<HTMLElement>,
    ) {}
    @HostListener('click', ['$event']) click(event: MouseEvent) {
        if (this.isControl(event.target) || window.getSelection()?.toString())
            return;
        this.host.nativeElement.focus({ preventScroll: true });
        this.details.open(this.appDetailRow);
    }
    @HostListener('keydown', ['$event']) key(event: KeyboardEvent) {
        if (
            event.target !== this.host.nativeElement ||
            !['Enter', ' '].includes(event.key)
        )
            return;
        event.preventDefault();
        this.details.open(this.appDetailRow);
    }
    private isControl(target: EventTarget | null) {
        return (
            target instanceof Element &&
            !!target.closest(
                'button,a,input,select,textarea,label,[role="button"],[role="checkbox"],[role="combobox"],[contenteditable="true"],[data-row-action],.actions-cell',
            )
        );
    }
}
