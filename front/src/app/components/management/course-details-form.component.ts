import {TagInputComponent} from './tag-input.component';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiModule } from '../ui/ui.module';
@Component({
    selector: 'app-course-details-form',
    standalone: true,
    imports: [CommonModule, FormsModule, UiModule,TagInputComponent],
    template: ` <form (ngSubmit)="save()" class="course-editor">
        <section hlmCard class="surface editor-main">
            <span class="eyebrow">01 / THE LEARNING EXPERIENCE</span>
            <h2>{{ editing ? 'Refine your course' : 'Start with a great idea.' }}</h2>
            <p>Tell learners what they will explore and why it matters.</p>
            <label hlmLabel for="editor-title">Course title *</label
            ><input
                hlmInput
                id="editor-title"
                name="title"
                [(ngModel)]="model.title"
                required
                maxlength="200"
                placeholder="A clear, specific title"
                [attr.aria-invalid]="attempted && !model.title?.trim()"
            /><small *ngIf="attempted && !model.title?.trim()" class="field-error"
                >Give your course a title.</small
            >
            <label hlmLabel for="editor-description">What will learners discover? *</label
            ><textarea
                hlmInput
                id="editor-description"
                name="description"
                [(ngModel)]="model.description"
                required
                rows="6"
                placeholder="Describe the skills and outcomes learners can expect."
                [attr.aria-invalid]="attempted && !model.description?.trim()"
            ></textarea
            ><small *ngIf="attempted && !model.description?.trim()" class="field-error"
                >Describe what this course covers.</small
            >
            <label hlmLabel for="editor-tags">Topics & tags</label><app-tag-input name="tags" [(ngModel)]="model.tags" [disabled]="busy"/>
        </section>
        <aside hlmCard class="surface editor-settings">
            <span class="eyebrow">02 / COURSE SETTINGS</span>
            <h2>Give it a home.</h2>
            <label hlmLabel for="editor-category">Subject *</label
            ><input
                hlmInput
                id="editor-category"
                name="category"
                list="course-categories"
                [(ngModel)]="model.category"
                required
                placeholder="Choose or enter a subject"
            /><datalist id="course-categories">
                <option *ngFor="let c of categories" [value]="c"></option></datalist
            ><small *ngIf="attempted && !model.category?.trim()" class="field-error"
                >Choose a subject.</small
            >
            <ng-container *ngIf="allowSubcategory"
                ><label hlmLabel for="editor-subcategory">Subcategory</label
                ><input
                    hlmInput
                    id="editor-subcategory"
                    name="subcategory"
                    [(ngModel)]="model.subCategory"
                    list="course-subcategories"
                    placeholder="Optional specialization" /><datalist id="course-subcategories">
                    <option *ngFor="let c of subcategories" [value]="c"></option></datalist
            ></ng-container>
            <label hlmLabel for="editor-price">Price in TND *</label
            ><input
                hlmInput
                id="editor-price"
                type="number"
                name="price"
                min="0"
                step="0.01"
                [(ngModel)]="model.price"
                required
            /><small class="field-help">Enter 0 to make this course free.</small
            ><small *ngIf="attempted && !validPrice" class="field-error"
                >Enter a price of 0 or more.</small
            >
            <div class="editor-note">
                <i class="bx bx-info-circle"></i>
                <p>
                    Save the course details first. Then build your curriculum with lessons and
                    assessments.
                </p>
            </div>
            <button hlmBtn type="submit" [disabled]="busy">
                {{ busy ? 'Saving…' : editing ? 'Save course details' : 'Create course' }} →</button
            ><button
                *ngIf="editing && allowStartNew"
                hlmBtn
                variant="ghost"
                type="button"
                [disabled]="busy"
                (click)="startNew.emit()"
            >
                Start a new course
            </button>
        </aside>
        <div *ngIf="error || success" class="product-alert editor-message" aria-live="polite">
            {{ error || success }}
        </div>
    </form>`,
    styles: [
        `
            .course-editor {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 290px;
                gap: 24px;
                margin-bottom: 30px;
            }
            .course-editor h2 {
                font-size: 21px;
                margin: 12px 0;
            }
            .course-editor label {
                font-size: 12px;
                margin-top: 24px;
            }
            .course-editor textarea {
                height: auto;
                min-height: 170px;
                resize: vertical;
                font-size: 13px;
            }
            .field-error {
                display: block;
                color: hsl(var(--destructive));
                font-size: 11px;
                margin: 7px 0;
            }
            .field-help {
                font-size: 11px;
                color: hsl(var(--muted-foreground));
                display: block;
                margin-top: 9px;
            }
            .editor-settings {
                align-self: start;
            }
            .editor-note {
                display: flex;
                gap: 10px;
                border-top: 1px solid hsl(var(--border));
                padding-top: 20px;
                margin-top: 24px;
            }
            .editor-note p {
                font-size: 11px;
                line-height: 1.8;
            }
            .editor-settings button {
                width: 100%;
                font-size: 12px;
                margin-top: 12px;
            }
            .editor-message {
                grid-column: 1/-1;
            }
            @media (max-width: 900px) {
                .course-editor {
                    grid-template-columns: 1fr;
                }
                .editor-settings button {
                    width: auto;
                    margin-right: 12px;
                }
            }
        `,
    ],
})
export class CourseDetailsFormComponent {
    @Input() model: any;
    @Input() categories: string[] = [];
    @Input() subcategories: string[] = [];
    @Input() allowSubcategory = false;
    @Input() editing = false;
    @Input() allowStartNew = false;
    @Input() busy = false;
    @Input() error = '';
    @Input() success = '';
    @Output() submitDetails = new EventEmitter<void>();
    @Output() startNew = new EventEmitter<void>();
    attempted = false;
    get validPrice() {
        return (
            this.model?.price !== null &&
            this.model?.price !== '' &&
            Number.isFinite(Number(this.model?.price)) &&
            Number(this.model.price) >= 0
        );
    }
    save() {
        this.attempted = true;
        if (
            !this.busy &&
            this.model?.title?.trim() &&
            this.model?.description?.trim() &&
            this.model?.category?.trim() &&
            this.validPrice
        )
            this.submitDetails.emit();
    }
}
