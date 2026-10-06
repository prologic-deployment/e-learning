import { Subscription } from 'rxjs';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-course-viewer',
    templateUrl: './course-viewer.component.html',
    styleUrls: ['./course-viewer.component.scss'],
})
export class CourseViewerComponent implements OnInit {
    get activeQuiz() {
        return this.currentLesson?.quiz?.questions?.length
            ? this.currentLesson.quiz
            : this.currentLesson?.quiz2;
    }
    certificateLoading = false;
    certificateError = '';
    get quizAttemptsExhausted() {
        const key = this.currentLesson?.quiz?.questions?.length ? 'quiz' : 'quiz2';
        const count =
            this.enrollment?.quizAttemptCounts?.find(
                (r: any) =>
                    String(r.lesson?._id || r.lesson) === String(this.currentLesson?._id) &&
                    r.quizKey === key,
            )?.count || 0;
        return count >= (this.activeQuiz?.maxAttempts || 3);
    }
    get examAttemptsExhausted() {
        return (
            (this.enrollment?.finalExamAttempts || 0) >= (this.course?.finalExam?.maxAttempts || 3)
        );
    }
    claimCertificate() {
        if (!this.courseCompleted || this.certificateLoading) return;
        this.certificateLoading = true;
        this.certificateError = '';
        this.http
            .post(`${this.apiUrl}/certificates/generate`, { courseId: this.course._id })
            .subscribe({
                next: () => {
                    this.certificateLoading = false;
                    this.router.navigate(['/dashboard'], { queryParams: { tab: 'certificates' } });
                },
                error: (err) => {
                    this.certificateLoading = false;
                    if (err.error?.certificate)
                        this.router.navigate(['/dashboard'], {
                            queryParams: { tab: 'certificates' },
                        });
                    else
                        this.certificateError =
                            err.error?.message || 'Unable to prepare your certificate.';
                },
            });
    }
    lessonError = '';
    mediaError = '';
    mediaLoading = false;
    completionLoading = false;
    completionError = '';
    enrollment: any = null;
    private mediaSubscription?: Subscription;
    private objectUrl = '';
    get learningProgress() {
        return this.enrollment?.progress || 0;
    }
    reloadCourse() {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) this.loadCourse(id);
    }
    private syncEligibility() {
        this.allLessonsCompleted =
            this.lessons.length > 0 &&
            this.lessons.every(
                (l) =>
                    this.completedLessons.includes(l._id) ||
                    !(l.quiz?.questions?.length || l.quiz2?.questions?.length),
            );
    }
    ngOnDestroy() {
        this.mediaSubscription?.unsubscribe();
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    }
    loadMedia() {
        this.mediaSubscription?.unsubscribe();
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
        this.contentUrl = '';
        this.safeContentUrl = '';
        this.mediaError = '';
        this.mediaLoading = false;
        if (!this.currentLesson?.contentFile) return;
        this.mediaLoading = true;
        this.mediaSubscription = this.http
            .get(`${this.apiUrl}/files/lesson/${this.currentLesson._id}`, { responseType: 'blob' })
            .subscribe({
                next: (blob) => {
                    this.objectUrl = URL.createObjectURL(blob);
                    this.contentUrl = this.objectUrl;
                    this.safeContentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
                        this.objectUrl,
                    );
                    this.mediaLoading = false;
                },
                error: () => {
                    this.mediaError =
                        'We could not open this material. Check your access and try again.';
                    this.mediaLoading = false;
                },
            });
    }
    course: any = null;
    loading = true;
    error = '';
    apiUrl = environment.apiUrl;
    backendUrl = environment.backendUrl;

    isEnrolled = false;
    isPurchased = false;
    contentUrl = '';
    safeContentUrl: SafeResourceUrl = '';
    isVideo = false;
    isPDF = false;

    enrollLoading = false;
    enrollSuccess = '';
    enrollError = '';

    lessons: any[] = [];
    currentLesson: any = null;
    currentLessonIndex: number = 0;
    lessonsLoading = false;

    quizResult: any = null;
    examResult: any = null;
    showQuiz = false;
    quizAnswers: number[] = [];
    quizSubmitted = false;
    quizScore = 0;
    quizPassed = false;
    quizLoading = false;
    quizError = '';
    completedLessons: string[] = [];

    showFinalExam = false;
    finalExamAnswers: number[] = [];
    finalExamSubmitted = false;
    finalExamScore = 0;
    finalExamPassed = false;
    finalExamLoading = false;
    finalExamError = '';
    allLessonsCompleted = false;
    courseCompleted = false;

    reviews: any[] = [];
    avgRating = 0;
    totalReviews = 0;
    newReview = { rating: 5, comment: '' };
    reviewLoading = false;
    reviewSuccess = '';
    reviewError = '';
    editingReview: any = null;
    currentUserId = '';
    hasReviewed = false;

    // ✅ NLP
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
        private sanitizer: DomSanitizer,
        public router: Router,
        private cdr: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        const user = this.authService.getCurrentUser();
        this.currentUserId = user?._id?.toString() || user?.id?.toString() || '';
        console.log('👤 currentUserId from localStorage:', this.currentUserId);
        if (id) this.loadCourse(id);
    }

    loadCourse(id: string): void {
        this.loading = true;
        this.error = '';
        this.http.get(`${this.apiUrl}/courses/${id}`).subscribe({
            next: (data: any) => {
                this.course = data;
                this.isPurchased = data.isPurchased;
                this.loading = false;
                this.loadLessons(id);
                this.checkEnrollment(id);

                // ✅ S'assurer que currentUserId est défini avant de charger les reviews
                if (!this.currentUserId) {
                    this.http.get(`${this.apiUrl}/profile`).subscribe({
                        next: (profileData: any) => {
                            this.currentUserId = profileData.user?._id?.toString() || '';
                            console.log('✅ currentUserId from profile:', this.currentUserId);
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
            },
            error: (err) => {
                this.error = err.error?.message || 'Error loading course';
                this.loading = false;
            },
        });
    }

    loadLessons(courseId: string): void {
        this.lessonError = '';
        this.lessonsLoading = true;
        this.http.get(`${this.apiUrl}/lessons/course/${courseId}`).subscribe({
            next: (data: any) => {
                this.lessons = Array.isArray(data) ? data : [];
                this.syncEligibility();
                if (this.lessons.length > 0) this.selectLesson(0);
                this.lessonsLoading = false;
            },
            error: () => {
                this.lessonError = 'Unable to retrieve the curriculum.';
                this.lessonsLoading = false;
            },
        });
    }

    selectLesson(index: number): void {
        if (index < 0 || index >= this.lessons.length || this.quizLoading || this.finalExamLoading)
            return;
        this.currentLessonIndex = index;
        this.currentLesson = this.lessons[index];
        this.showQuiz = false;
        this.quizSubmitted = false;
        this.quizAnswers = [];
        this.quizResult = null;
        this.completionError = '';
        this.showFinalExam = false;

        this.isVideo = this.currentLesson?.contentType === 'video';
        this.isPDF = this.currentLesson?.contentType === 'pdf';
        this.loadMedia();
    }

    checkEnrollment(courseId: string): void {
        this.http.get(`${this.apiUrl}/enrollments/me`).subscribe({
            next: (data: any) => {
                const enrollments = Array.isArray(data) ? data : [];
                const enrollment = enrollments.find(
                    (e: any) => e.course?._id === courseId || e.course === courseId,
                );
                this.isEnrolled = !!enrollment;
                this.enrollment = enrollment;

                if (enrollment) {
                    this.completedLessons = enrollment.lessonsCompleted || [];
                    this.courseCompleted = !!enrollment.completed;
                    this.syncEligibility();
                }
                this.cdr.detectChanges();
            },
            error: () => {},
        });
    }

    enrollCourse(): void {
        this.enrollLoading = true;
        this.enrollError = '';
        this.enrollSuccess = '';

        this.http.post(`${this.apiUrl}/enrollments/${this.course._id}/enroll`, {}).subscribe({
            next: () => {
                this.enrollLoading = false;
                this.enrollSuccess = 'Enrolled successfully ! 🎉';
                this.isEnrolled = true;
                this.checkEnrollment(this.course._id);
                this.loadLessons(this.course._id);
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.enrollLoading = false;
                if (err.status === 400 && /already enrolled/i.test(err.error?.message || '')) {
                    this.checkEnrollment(this.course._id);
                } else {
                    this.enrollError = err.error?.message || 'Error enrolling';
                }
            },
        });
    }

    // ========== QUIZ ==========
    openQuiz(): void {
        this.quizResult = null;
        if (!this.isEnrolled || this.quizAttemptsExhausted) return;
        if (!this.activeQuiz?.questions?.length) return;
        this.showQuiz = true;
        this.quizSubmitted = false;
        this.quizScore = 0;
        this.quizPassed = false;
        this.quizError = '';
        this.quizAnswers = new Array(this.activeQuiz.questions.length).fill(-1);
    }

    submitQuiz(): void {
        if (this.quizLoading || this.quizSubmitted) return;
        if (this.quizAnswers.includes(-1)) {
            this.quizError = 'Please answer all questions !';
            return;
        }

        this.quizLoading = true;
        this.quizError = '';

        this.http
            .post(
                `${this.apiUrl}/quiz/lesson/${this.currentLesson._id}/submit${this.currentLesson?.quiz?.questions?.length ? '' : '/quiz2'}`,
                {
                    answers: this.quizAnswers,
                },
            )
            .subscribe({
                next: (res: any) => {
                    this.quizLoading = false;
                    this.quizSubmitted = true;
                    this.checkEnrollment(this.course._id);
                    this.quizResult = res;
                    this.quizScore = res.score;
                    this.quizPassed = res.passed;

                    if (res.passed) {
                        if (!this.completedLessons.includes(this.currentLesson._id)) {
                            this.completedLessons.push(this.currentLesson._id);
                        }
                        this.allLessonsCompleted = this.lessons.every(
                            (l) =>
                                this.completedLessons.includes(l._id) || !l.quiz?.questions?.length,
                        );
                    }
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    this.quizLoading = false;
                    this.quizError = err.error?.message || 'Error submitting quiz';
                },
            });
    }

    isLessonCompleted(lessonId: string): boolean {
        return this.completedLessons.includes(lessonId);
    }

    canGoNext(): boolean {
        if (!this.activeQuiz?.questions?.length) return true;
        return this.isLessonCompleted(this.currentLesson._id);
    }

    // ========== FINAL EXAM ==========
    openFinalExam(): void {
        this.examResult = null;
        if (!this.isEnrolled || !this.allLessonsCompleted || this.examAttemptsExhausted) return;
        if (!this.course?.finalExam?.questions?.length) return;
        this.showFinalExam = true;
        this.finalExamSubmitted = false;
        this.finalExamScore = 0;
        this.finalExamPassed = false;
        this.finalExamError = '';
        this.finalExamAnswers = new Array(this.course.finalExam.questions.length).fill(-1);
        this.showQuiz = false;
    }

    submitFinalExam(): void {
        if (this.finalExamLoading || this.finalExamSubmitted) return;
        if (this.finalExamAnswers.includes(-1)) {
            this.finalExamError = 'Please answer all questions !';
            return;
        }

        this.finalExamLoading = true;
        this.finalExamError = '';

        this.http
            .post(`${this.apiUrl}/quiz/final/${this.course._id}/submit`, {
                answers: this.finalExamAnswers,
            })
            .subscribe({
                next: (res: any) => {
                    this.finalExamLoading = false;
                    this.finalExamSubmitted = true;
                    this.checkEnrollment(this.course._id);
                    this.examResult = res;
                    this.finalExamScore = res.score;
                    this.finalExamPassed = res.passed;
                    if (res.passed) this.courseCompleted = true;
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    this.finalExamLoading = false;
                    this.finalExamError = err.error?.message || 'Error submitting final exam';
                },
            });
    }

    // ========== REVIEWS ==========
    loadReviews(courseId: string): void {
        this.http.get(`${this.apiUrl}/reviews/course/${courseId}`).subscribe({
            next: (data: any) => {
                this.reviews = [...(data.reviews || [])];
                this.avgRating = data.avgRating || 0;
                this.totalReviews = data.total || 0;

                // ✅ Recalculer hasReviewed
                this.hasReviewed = this.reviews.some(
                    (r) => r.user?._id?.toString() === this.currentUserId?.toString(),
                );

                console.log('📝 currentUserId:', this.currentUserId);
                console.log('📝 hasReviewed:', this.hasReviewed);
                console.log(
                    '📝 reviews:',
                    this.reviews.map((r) => ({
                        userId: r.user?._id,
                        match: r.user?._id?.toString() === this.currentUserId?.toString(),
                    })),
                );

                this.cdr.detectChanges();
            },
            error: () => {},
        });
    }

    submitReview(): void {
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
                    this.reviewSuccess = 'Review added ! ✅';
                    this.newReview = { rating: 5, comment: '' };
                    this.loadReviews(this.course._id);
                    setTimeout(() => (this.reviewSuccess = ''), 3000);
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

    isMyReview(review: any): boolean {
        if (!this.currentUserId) return false;
        const reviewUserId =
            review.user?._id?.toString() ||
            review.user?.id?.toString() ||
            review.user?.toString() ||
            '';
        return reviewUserId === this.currentUserId.toString();
    }

    getStars(rating: number): string {
        return '⭐'.repeat(Math.round(rating));
    }

    downloadContent(): void {
        const link = document.createElement('a');
        link.href = this.contentUrl;
        link.download = `${this.currentLesson?.title || this.course.title}.${this.isPDF ? 'pdf' : 'mp4'}`;
        link.target = '_blank';
        link.click();
    }

    canAccessContent(): boolean {
        if (this.course?.price === 0) return true;
        return this.isPurchased || this.isEnrolled;
    }

    // ✅ Progress is computed server-side now; the client only signals completion
    // of the current lesson — no more fabricated { progress: 100 } calls.
    updateProgress(): void {
        if (!this.enrollment?._id || !this.currentLesson?._id || this.completionLoading) return;
        this.completionLoading = true;
        this.completionError = '';
        this.http
            .put<any>(`${this.apiUrl}/enrollments/${this.enrollment._id}/progress`, {
                lessonId: this.currentLesson._id,
            })
            .subscribe({
                next: (res) => {
                    this.enrollment = res.enrollment;
                    this.completedLessons = res.enrollment.lessonsCompleted || [];
                    this.courseCompleted = !!res.enrollment.completed;
                    this.syncEligibility();
                    this.completionLoading = false;
                },
                error: (err) => {
                    this.completionError =
                        err.error?.message || 'Unable to save your progress. Please try again.';
                    this.completionLoading = false;
                },
            });
    }

    summarizeLesson(lessonId: string, force: boolean = false): void {
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

                this.lessonSummaries[lessonId] = {
                    summary: res.summary,
                    transcription: res.transcription,
                    keyPoints: res.keyPoints || [],
                    language: res.language,
                    summarizedAt: res.summarizedAt,
                };

                // ✅ Mettre à jour la leçon dans la liste
                const lesson = this.lessons.find((l: any) => l._id === lessonId);
                if (lesson) {
                    lesson.summary = res.summary;
                    lesson.keyPoints = res.keyPoints;
                    lesson.language = res.language;
                    lesson.summarizedAt = res.summarizedAt;
                }

                this.activeSummaryId = lessonId;
                setTimeout(() => (this.nlpSuccess = ''), 4000);
            },
            error: (err) => {
                this.nlpLoading = null;
                this.nlpError =
                    err.status === 503
                        ? '⚠️ Service Whisper non disponible. Lancez Flask sur le port 5001.'
                        : err.error?.message || 'Erreur lors de la génération du résumé';
                setTimeout(() => (this.nlpError = ''), 5000);
            },
        });
    }

    toggleLessonSummary(lessonId: string): void {
        this.activeSummaryId = this.activeSummaryId === lessonId ? null : lessonId;
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
            .replace(/^- (.+)$/gm, '<li style="margin:4px 0;">$1</li>')
            .replace(/\n/g, '<br>');
    }
}
