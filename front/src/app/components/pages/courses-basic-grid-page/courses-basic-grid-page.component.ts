import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import {
    combineLatest,
    defer,
    of,
    Subject,
    Subscription,
    forkJoin,
} from 'rxjs';
import {
    catchError,
    finalize,
    startWith,
    switchMap,
    map,
} from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CourseService } from '../../../services/course.service';
import { environment } from '../../../../environments/environment';
@Component({
    selector: 'app-courses-basic-grid-page',
    templateUrl: './courses-basic-grid-page.component.html',
    styleUrls: ['./courses-basic-grid-page.component.scss'],
})
export class CoursesBasicGridPageComponent implements OnInit {
    private destroy = inject(DestroyRef);
    private refresh = new Subject<void>();
    private reviews?: Subscription;
    courses: any[] = [];
    loading = true;
    error = '';
    searchQuery = '';
    selectedCategory = '';
    selectedType = '';
    selectedTag = '';
    currentPage = 1;
    totalPages = 1;
    totalCourses = 0;
    reviewsMap: Record<string, { avgRating: number; total: number } | null> =
        {};
    categories = [
        'Development',
        'Business',
        'Finance',
        'IT & Software',
        'Design',
        'Marketing',
        'Data Science',
    ];
    constructor(
        private service: CourseService,
        private http: HttpClient,
        private route: ActivatedRoute,
        private router: Router,
    ) {}
    ngOnInit() {
        combineLatest([
            this.route.queryParamMap,
            this.refresh.pipe(startWith(undefined)),
        ])
            .pipe(
                switchMap(([params]) =>
                    defer(() => {
                        this.reviews?.unsubscribe();
                        this.reviewsMap = {};
                        this.loading = true;
                        this.error = '';
                        this.courses = [];
                        this.searchQuery = params.get('search') || '';
                        this.selectedCategory = params.get('category') || '';
                        this.selectedTag = params.get('tag') || '';
                        this.selectedType = ['free', 'paid'].includes(
                            params.get('type') || '',
                        )
                            ? params.get('type')!
                            : '';
                        this.currentPage = Math.max(
                            1,
                            Math.min(
                                10000,
                                Math.floor(Number(params.get('page'))) || 1,
                            ),
                        );
                        return this.service
                            .getAllCourses({
                                search: this.searchQuery,
                                category: this.selectedCategory,
                                tag: this.selectedTag,
                                type: this.selectedType,
                                page: this.currentPage,
                                limit: 9,
                            })
                            .pipe(
                                map((data) => {
                                    if (
                                        !Array.isArray(data?.courses) ||
                                        !data.pagination
                                    )
                                        throw new Error(
                                            'Invalid catalogue response',
                                        );
                                    return data;
                                }),
                                catchError(() => {
                                    this.error =
                                        'The course library is unavailable right now. Please try again.';
                                    return of(null);
                                }),
                                finalize(() => (this.loading = false)),
                            );
                    }),
                ),
                takeUntilDestroyed(this.destroy),
            )
            .subscribe((data) => {
                if (!data) return;
                this.courses = data.courses;
                this.totalCourses = Math.max(
                    0,
                    Number(data.pagination.total) || 0,
                );
                this.totalPages = Math.max(
                    1,
                    Number(data.pagination.pages) || 1,
                );
                this.loadReviews();
            });
    }
    private loadReviews() {
        if (!this.courses.length) return;
        this.reviews = forkJoin(
            this.courses.map((c) =>
                this.http
                    .get<any>(`${environment.apiUrl}/reviews/course/${c._id}`)
                    .pipe(
                        map((r) => ({
                            id: c._id,
                            value:
                                typeof r.avgRating === 'number' &&
                                typeof r.total === 'number'
                                    ? { avgRating: r.avgRating, total: r.total }
                                    : null,
                        })),
                        catchError(() => of({ id: c._id, value: null })),
                    ),
            ),
        )
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe((rows) =>
                rows.forEach((r) => (this.reviewsMap[r.id] = r.value)),
            );
    }
    loadCourses() {
        this.refresh.next();
    }
    search() {
        this.navigate(1);
    }
    filterByType(value: string) {
        this.selectedType = value;
        this.search();
    }
    filterByCategory(value: string) {
        this.selectedCategory = value;
        this.search();
    }
    reset() {
        this.searchQuery = '';
        this.selectedType = '';
        this.selectedCategory = '';
        this.selectedTag = '';
        this.search();
    }
    removeFilter(kind: string) {
        if (kind === 'search') this.searchQuery = '';
        if (kind === 'category') this.selectedCategory = '';
        if (kind === 'tag') this.selectedTag = '';
        if (kind === 'type') this.selectedType = '';
        this.search();
    }
    get hasFilters() {
        return !!(
            this.searchQuery ||
            this.selectedCategory ||
            this.selectedTag ||
            this.selectedType
        );
    }
    private navigate(page: number) {
        this.router
            .navigate(['/courses-grid'], {
                queryParams: {
                    search: this.searchQuery.trim() || null,
                    category: this.selectedCategory || null,
                    type: this.selectedType || null,
                    tag: this.selectedTag || null,
                    page: page > 1 ? page : null,
                },
            })
            .then((changed) => {
                if (!changed) this.refresh.next();
            });
    }
    goToPage(page: number) {
        if (page < 1 || page > this.totalPages || this.loading) return;
        this.navigate(page);
    }
    trackCourse(_index: number, course: any) {
        return course._id;
    }
}
