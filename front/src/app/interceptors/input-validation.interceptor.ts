import { Injectable } from '@angular/core';
import {
    HttpInterceptor,
    HttpRequest,
    HttpHandler,
    HttpErrorResponse,
} from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { validateRequest, UploadInfo } from '../validation/input-policy';
import { ValidationFeedbackService } from '../validation/validation-feedback.service';
import { ToastService } from '../services/toast.service';
@Injectable()
export class InputValidationInterceptor implements HttpInterceptor {
    constructor(
        private feedback: ValidationFeedbackService,
        private toast: ToastService,
    ) {}
    intercept(req: HttpRequest<any>, next: HttpHandler) {
        const api =
            req.url === environment.apiUrl ||
            req.url.startsWith(environment.apiUrl + '/');
        if (!api || !['POST', 'PUT', 'PATCH'].includes(req.method))
            return next.handle(req);
        let body = req.body ?? {};
        const files: UploadInfo[] = [];
        if (body instanceof FormData) {
            const plain: Record<string, any> = {};
            body.forEach((value: any, key: string) => {
                if (value instanceof File)
                    files.push({
                        fieldname: key,
                        name: value.name,
                        size: value.size,
                        type: value.type,
                    });
                else plain[key] = value;
            });
            body = plain;
        }
        const errors = validateRequest(req.method, req.url, body, files);
        if (Object.keys(errors).length) {
            this.feedback.report(req.url, errors);
            const message = 'Check your entries. ' + Object.values(errors)[0];
            this.toast.show(message, 'error', 'Review your form');
            return throwError(
                () =>
                    new HttpErrorResponse({
                        status: 422,
                        url: req.url,
                        error: { code: 'CLIENT_VALIDATION', message, errors },
                    }),
            );
        }
        return next.handle(req).pipe(
            catchError((error: HttpErrorResponse) => {
                if (
                    error.error?.code === 'VALIDATION_ERROR' &&
                    error.error?.errors
                )
                    this.feedback.report(req.url, error.error.errors);
                return throwError(() => error);
            }),
        );
    }
}
