import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
export interface DetailRef {
    kind: 'user' | 'course' | 'lesson' | 'enrollment' | 'result' | 'review';
    id: string;
    query?: Record<string, string | number>;
}
export interface DetailField {
    label: string;
    value: string | number | boolean;
}
export interface DetailEvent {
    at: string;
    type: string;
    title: string;
    subtitle?: string;
    fields?: DetailField[];
}
export interface DetailSection {
    title: string;
    fields?: DetailField[];
    items?: {
        title: string;
        subtitle?: string;
        fields?: DetailField[];
        detail?: DetailRef;
    }[];
    timeline?: DetailEvent[];
    page?: { key: string; current: number; total: number; pages: number };
}
export interface QuestionReview {
    number: number;
    text: string;
    type: string;
    studentAnswers: string[];
    correctAnswers: string[];
    correct: boolean;
    unanswered: boolean;
    points: number;
    earnedPoints: number;
    timeLimitSeconds: number;
    explanation?: string;
}
export interface RecordDetail {
    title: string;
    subtitle?: string;
    notice?: string;
    sections: DetailSection[];
    review?: {
        questions: QuestionReview[];
        total: number;
        correct: number;
        wrong: number;
        unanswered: number;
        earnedPoints: number;
        possiblePoints: number;
    };
}
@Injectable({ providedIn: 'root' })
export class DetailService {
    private readonly requests = new Subject<DetailRef>();
    readonly opened = this.requests.asObservable();
    open(record: DetailRef) {
        if (record?.id) this.requests.next(record);
    }
}
