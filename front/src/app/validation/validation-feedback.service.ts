import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Issues } from './input-policy';
@Injectable({ providedIn: 'root' })
export class ValidationFeedbackService {
    readonly failures = new Subject<{ path: string; issues: Issues }>();
    report(path: string, issues: Issues) {
        this.failures.next({ path, issues });
    }
}
