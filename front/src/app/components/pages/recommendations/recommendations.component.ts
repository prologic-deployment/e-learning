import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
@Component({
    selector: 'app-recommendations',
    templateUrl: './recommendations.component.html',
    styleUrls: ['./recommendations.component.scss'],
})
export class RecommendationsComponent implements OnInit {
    private destroy = inject(DestroyRef);
    private request?: Subscription;
    recommendations: any[] = [];
    loading = true;
    error = '';
    userProfile: any = null;
    constructor(private http: HttpClient) {}
    ngOnInit() {
        this.loadRecommendations();
    }
    loadRecommendations() {
        this.request?.unsubscribe();
        this.loading = true;
        this.error = '';
        this.request = this.http
            .get<any>(`${environment.apiUrl}/recommendations`)
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: (data) => {
                    this.recommendations = data.recommendations || [];
                    this.userProfile = data.user_profile;
                    this.loading = false;
                },
                error: () => {
                    this.error =
                        'Your recommendations are unavailable right now. Please try again.';
                    this.loading = false;
                },
            });
    }
}
