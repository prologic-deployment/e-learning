import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';
import { CartService } from '../../../services/cart.service';

@Component({
    selector: 'app-paid-courses-single-page',
    templateUrl: './paid-courses-single-page.component.html',
    styleUrls: ['./paid-courses-single-page.component.scss'],
})
export class PaidCoursesSinglePageComponent implements OnInit {
    enrollment: any = null;
    isLessonDone(id: string) {
        return this.enrollment?.lessonsCompleted?.includes(id) || false;
    }
    course: any = null;
    loading = true;
    error = '';
    isOpen = false;
    apiUrl = environment.apiUrl;

    enrollLoading = false;
    enrollSuccess = '';
    enrollError = '';
    isEnrolled = false;

    cartLoading = false;
    cartSuccess = '';
    cartError = '';

    activeTab = 'overview';

    // ✅ Reviews
    reviews: any[] = [];
    avgRating = 0;
    totalReviews = 0;
    currentUserId = '';
    hasReviewed = false;
    newReview = { rating: 5, comment: '' };
    reviewLoading = false;
    reviewSuccess = '';
    reviewError = '';
    editingReview: any = null;

    // AI Summary
    aiSummary: any = null;
    aiLoading = false;
    aiError = '';
    showAiSummary = false;

    // ✅ NLP par leçon vidéo
    lessonSummaries: { [lessonId: string]: any } = {};
    nlpLoading: string | null = null;
    nlpError = '';
    nlpSuccess = '';
    activeSummaryId: string | null = null;
    showTranscription: { [lessonId: string]: boolean } = {};

    constructor(
        private route: ActivatedRoute,
        private http: HttpClient,
        private authService: AuthService,
        private router: Router,
        private cartService: CartService,
        private cdr: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');

        // ✅ Récupérer currentUserId seulement si connecté
        if (this.authService.isLoggedIn()) {
            const user = this.authService.getCurrentUser();
            this.currentUserId = user?._id?.toString() || user?.id?.toString() || '';
        }

        if (id) this.loadCourse(id);
    }

    // ✅ Helper — vérifier si connecté
    isLoggedIn(): boolean {
        return this.authService.isLoggedIn();
    }

    loadCourse(id: string): void {
        this.loading = true;
        this.http.get(`${this.apiUrl}/courses/${id}`).subscribe({
            next: (data: any) => {
                this.course = data;
                this.loading = false;

                // ✅ Vérifier enrollment seulement si connecté
                if (this.authService.isLoggedIn()) {
                    this.checkEnrollment(id);

                    if (!this.currentUserId) {
                        this.http.get(`${this.apiUrl}/profile`).subscribe({
                            next: (profileData: any) => {
                                this.currentUserId = profileData.user?._id?.toString() || '';
                                this.loadReviews(id);
                                this.cdr.detectChanges();
                            },
                            error: () => {
                                this.loadReviews(id);
                            },
                        });
                    } else {
                        this.loadReviews(id);
                    }
                } else {
                    // ✅ Non connecté — charger les reviews quand même (lecture seule)
                    this.loadReviewsPublic(id);
                }
            },
            error: (err) => {
                this.error = err.error?.message || 'Error loading course';
                this.loading = false;
            },
        });
    }

    checkEnrollment(courseId: string): void {
        this.http.get(`${this.apiUrl}/enrollments/me`).subscribe({
            next: (data: any) => {
                const enrollments = Array.isArray(data) ? data : [];
                this.enrollment = enrollments.find(
                    (e: any) => e.course?._id === courseId || e.course === courseId,
                );
                this.isEnrolled = enrollments.some(
                    (e: any) => e.course?._id === courseId || e.course === courseId,
                );
                this.cdr.detectChanges();
            },
            error: () => {},
        });
    }

    // ✅ Charger les reviews (user connecté)
    loadReviews(courseId: string): void {
        this.http.get(`${this.apiUrl}/reviews/course/${courseId}`).subscribe({
            next: (data: any) => {
                this.reviews = [...(data.reviews || [])];
                this.avgRating = data.avgRating || 0;
                this.totalReviews = data.total || 0;

                this.hasReviewed = this.reviews.some(
                    (r) => r.user?._id?.toString() === this.currentUserId?.toString(),
                );

                this.cdr.detectChanges();
            },
            error: () => {},
        });
    }

    // ✅ Charger les reviews (user non connecté — sans token)
    loadReviewsPublic(courseId: string): void {
        // Appel sans auth — backend doit permettre GET public
        this.http.get(`${this.apiUrl}/reviews/course/${courseId}`).subscribe({
            next: (data: any) => {
                this.reviews = [...(data.reviews || [])];
                this.avgRating = data.avgRating || 0;
                this.totalReviews = data.total || 0;
                this.cdr.detectChanges();
            },
            error: () => {
                // ✅ Si erreur 401 (route protégée) — ignorer
                this.reviews = [];
                this.avgRating = 0;
                this.totalReviews = 0;
            },
        });
    }

    // ✅ Soumettre un review
    submitReview(): void {
        if (!this.authService.isLoggedIn()) {
            this.router.navigate(['/profile-authentication'], {
                queryParams: { returnUrl: this.router.url },
            });
            return;
        }

        if (!this.newReview.comment.trim()) {
            this.reviewError = 'Please write a comment !';
            return;
        }

        this.reviewLoading = true;
        this.reviewError = '';
        this.reviewSuccess = '';

        this.http
            .post(`${this.apiUrl}/reviews/course/${this.course._id}`, this.newReview)
            .subscribe({
                next: () => {
                    this.reviewLoading = false;
                    this.reviewSuccess = 'Review submitted and pending approval ! ⏳';
                    this.newReview = { rating: 5, comment: '' };
                    this.loadReviews(this.course._id);
                    setTimeout(() => (this.reviewSuccess = ''), 4000);
                },
                error: (err) => {
                    this.reviewLoading = false;
                    this.reviewError = err.error?.message || 'Error adding review';
                },
            });
    }

    editReview(review: any): void {
        this.editingReview = { ...review };
        this.cdr.detectChanges();
    }

    updateReview(): void {
        this.reviewLoading = true;
        this.reviewError = '';

        this.http
            .put(`${this.apiUrl}/reviews/${this.editingReview._id}`, {
                rating: this.editingReview.rating,
                comment: this.editingReview.comment,
            })
            .subscribe({
                next: () => {
                    this.reviewLoading = false;
                    this.reviewSuccess = 'Review updated ! ✅';
                    this.editingReview = null;
                    this.loadReviews(this.course._id);
                    setTimeout(() => (this.reviewSuccess = ''), 3000);
                },
                error: (err) => {
                    this.reviewLoading = false;
                    this.reviewError = err.error?.message || 'Error updating review';
                },
            });
    }

    deleteReview(reviewId: string): void {
        this.http.delete(`${this.apiUrl}/reviews/${reviewId}`).subscribe({
            next: () => {
                this.hasReviewed = false;
                this.loadReviews(this.course._id);
            },
            error: () => {},
        });
    }

    getStars(rating: number): string {
        return '⭐'.repeat(Math.round(rating));
    }

    enrollCourse(): void {
        // ✅ Rediriger vers login si non connecté
        if (!this.authService.isLoggedIn()) {
            this.router.navigate(['/profile-authentication'], {
                queryParams: { returnUrl: this.router.url },
            });
            return;
        }

        this.enrollLoading = true;
        this.enrollError = '';
        this.enrollSuccess = '';

        this.http.post(`${this.apiUrl}/enrollments/${this.course._id}/enroll`, {}).subscribe({
            next: () => {
                this.enrollLoading = false;
                this.enrollSuccess = 'Enrolled successfully ! 🎉';
                this.isEnrolled = true;
            },
            error: (err) => {
                this.enrollLoading = false;
                this.enrollError = err.error?.message || 'Error enrolling';
            },
        });
    }

    addToCart(): void {
        // ✅ Rediriger vers login si non connecté
        if (!this.authService.isLoggedIn()) {
            this.router.navigate(['/profile-authentication'], {
                queryParams: { returnUrl: this.router.url },
            });
            return;
        }

        this.cartLoading = true;
        this.cartError = '';
        this.cartSuccess = '';

        this.cartService.addToCart(this.course._id).subscribe({
            next: () => {
                this.cartLoading = false;
                this.cartSuccess = 'Course added to cart ! 🛒';
                setTimeout(() => (this.cartSuccess = ''), 3000);
            },
            error: (err) => {
                this.cartLoading = false;
                this.cartError = err.error?.message || 'Error adding to cart';
            },
        });
    }

    enrollAndView(): void {
        // ✅ Rediriger vers login si non connecté
        if (!this.authService.isLoggedIn()) {
            this.router.navigate(['/profile-authentication'], {
                queryParams: { returnUrl: this.router.url },
            });
            return;
        }

        this.enrollLoading = true;
        this.enrollError = '';

        this.http.post(`${this.apiUrl}/enrollments/${this.course._id}/enroll`, {}).subscribe({
            next: () => {
                this.enrollLoading = false;
                this.isEnrolled = true;
                this.router.navigate(['/course', this.course._id]);
            },
            error: (err) => {
                this.enrollLoading = false;
                if (err.status === 400 && /already enrolled/i.test(err.error?.message || '')) {
                    this.router.navigate(['/course', this.course._id]);
                } else {
                    this.enrollError = err.error?.message || 'Error enrolling';
                }
            },
        });
    }

    generateSummary(): void {
        // ✅ Rediriger vers login si non connecté
        if (!this.authService.isLoggedIn()) {
            this.router.navigate(['/profile-authentication'], {
                queryParams: { returnUrl: this.router.url },
            });
            return;
        }

        this.aiLoading = true;
        this.aiError = '';
        this.showAiSummary = true;

        this.http
            .post(`${this.apiUrl}/nlp/summarize`, {
                courseId: this.course._id,
            })
            .subscribe({
                next: (data: any) => {
                    this.aiSummary = data;
                    this.aiLoading = false;
                },
                error: (err) => {
                    this.aiLoading = false;
                    this.aiError = err.error?.message || 'Error generating AI summary';
                },
            });
    }

    getCategoryIcon(category: string): string {
        const icons: any = {
            Development: '💻',
            Business: '💼',
            Finance: '💰',
            'IT & Software': '🖥️',
            Design: '🎨',
            Marketing: '📣',
            'Data Science': '📊',
        };
        return icons[category] || '📚';
    }

    getCourseColor(category: string): string {
        const colors: any = {
            Development: 'linear-gradient(135deg, #457B9D, #1D3557)',
            Business: 'linear-gradient(135deg, #f093fb, #f5576c)',
            Finance: 'linear-gradient(135deg, #4facfe, #00f2fe)',
            'IT & Software': 'linear-gradient(135deg, #43e97b, #38f9d7)',
            Design: 'linear-gradient(135deg, #fa709a, #fee140)',
            Marketing: 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
            'Data Science': 'linear-gradient(135deg, #ffecd2, #fcb69f)',
        };
        return colors[category] || 'linear-gradient(135deg, #457B9D, #1D3557)';
    }

    // ✅ Résumer une leçon vidéo
    summarizeLesson(lessonId: string, force: boolean = false): void {
        if (!this.authService.isLoggedIn()) {
            this.router.navigate(['/profile-authentication']);
            return;
        }

        this.nlpLoading = lessonId;
        this.nlpError = '';
        this.nlpSuccess = '';

        const url = force
            ? `${this.apiUrl}/nlp/lesson/${lessonId}/summarize?force=true`
            : `${this.apiUrl}/nlp/lesson/${lessonId}/summarize`;

        this.http.post<any>(url, {}).subscribe({
            next: (res) => {
                this.nlpLoading = null;
                this.nlpSuccess = res.cached
                    ? '✅ Résumé déjà disponible !'
                    : '✅ Résumé généré avec succès !';

                // ✅ Sauvegarder dans la map locale
                this.lessonSummaries[lessonId] = {
                    summary: res.summary,
                    transcription: res.transcription,
                    keyPoints: res.keyPoints || [],
                    language: res.language,
                    summarizedAt: res.summarizedAt,
                };

                // ✅ Mettre à jour la leçon dans le cours
                if (this.course?.lessons) {
                    const lesson = this.course.lessons.find((l: any) => l._id === lessonId);
                    if (lesson) {
                        lesson.summary = res.summary;
                        lesson.transcription = res.transcription;
                        lesson.keyPoints = res.keyPoints;
                        lesson.language = res.language;
                        lesson.summarizedAt = res.summarizedAt;
                    }
                }

                this.activeSummaryId = lessonId;
                this.cdr.detectChanges();
                setTimeout(() => (this.nlpSuccess = ''), 4000);
            },
            error: (err) => {
                this.nlpLoading = null;
                if (err.status === 503) {
                    this.nlpError =
                        '⚠️ Service Whisper non disponible. Lancez Flask sur le port 5001.';
                } else {
                    this.nlpError = err.error?.message || 'Erreur lors de la génération du résumé';
                }
                setTimeout(() => (this.nlpError = ''), 5000);
            },
        });
    }

    // ✅ Afficher/masquer résumé
    toggleLessonSummary(lessonId: string): void {
        this.activeSummaryId = this.activeSummaryId === lessonId ? null : lessonId;
        this.cdr.detectChanges();
    }

    // ✅ XSS FIX: escape HTML before markdown conversion (same as chatbot)
    formatSummary(summary: string): string {
        if (!summary) return '';
        const safe = summary
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        return safe
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(
                /^#{1,3} (.+)$/gm,
                '<h6 style="font-weight:700;color:#457B9D;margin-top:12px;">$1</h6>',
            )
            .replace(/^- (.+)$/gm, '<li style="margin:4px 0;">$1</li>')
            .replace(/\n/g, '<br>');
    }

    // ✅ Récupérer résumé d'une leçon (depuis map locale ou leçon)
    getLessonSummary(lesson: any): any {
        return this.lessonSummaries[lesson._id] || (lesson.summary ? lesson : null);
    }

    openPopup(): void {
        this.isOpen = true;
    }
    closePopup(): void {
        this.isOpen = false;
    }
}
