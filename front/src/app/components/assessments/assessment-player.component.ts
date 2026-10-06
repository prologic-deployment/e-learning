import { Component, EventEmitter, Input, Output, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiModule } from '../ui/ui.module';
import { LearningUiModule } from '../learning/learning-ui.module';
@Component({
    selector: 'app-assessment-player',
    standalone: true,
    imports: [CommonModule, FormsModule, UiModule, LearningUiModule],
    templateUrl: './assessment-player.component.html',
    styleUrls: ['./assessment-player.component.scss'],
})
export class AssessmentPlayerComponent {
    @Input() title = 'Knowledge check';
    @Input() exam = false;
    @Input() questions: any[] = [];
    @Input() answers: number[] = [];
    @Input() passingScore = 70;
    @Input() busy = false;
    @Input() error = '';
    @Input() result: any = null;
    @Output() submitAnswers = new EventEmitter<void>();
    @Output() retry = new EventEmitter<void>();
    @Output() leave = new EventEmitter<void>();
    @ViewChild('questionHeading') questionHeading?: ElementRef<HTMLElement>;
    index = 0;
    get answered() {
        return this.answers.filter((a) => a >= 0).length;
    }
    get retryAllowed() {
        return (
            this.result && !this.result.passed && this.result.attemptsUsed < this.result.maxAttempts
        );
    }
    go(index: number) {
        this.index = index;
        setTimeout(() => this.questionHeading?.nativeElement.focus());
    }
    restart() {
        this.index = 0;
        this.retry.emit();
    }
}
