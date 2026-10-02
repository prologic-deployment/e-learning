import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-course-viewer',
  templateUrl: './course-viewer.component.html',
  styleUrls: ['./course-viewer.component.scss']
})
export class CourseViewerComponent implements OnInit {

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
    private cdr: ChangeDetectorRef
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
            }
          });
        } else {
          this.loadReviews(id);
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Error loading course';
        this.loading = false;
      }
    });
  }

  loadLessons(courseId: string): void {
    this.lessonsLoading = true;
    this.http.get(`${this.apiUrl}/lessons/course/${courseId}`).subscribe({
      next: (data: any) => {
        this.lessons = Array.isArray(data) ? data : [];
        if (this.lessons.length > 0) this.selectLesson(0);
        this.lessonsLoading = false;
      },
      error: () => { this.lessonsLoading = false; }
    });
  }

  selectLesson(index: number): void {
    this.currentLessonIndex = index;
    this.currentLesson = this.lessons[index];
    this.showQuiz = false;
    this.quizSubmitted = false;
    this.quizAnswers = [];
    this.showFinalExam = false;

    // ✅ SECURITY: content is delivered through the authenticated, access-checked
    // streaming endpoint — the old approach exposed raw /uploads URLs.
    if (this.currentLesson?._id && (this.currentLesson?.contentType || this.currentLesson?.contentFile)) {
      this.isVideo = this.currentLesson.contentType === 'video';
      this.isPDF = this.currentLesson.contentType === 'pdf';
      this.contentUrl = `${this.apiUrl}/files/lesson/${this.currentLesson._id}`;
      this.safeContentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.contentUrl);
    } else {
      this.isVideo = false;
      this.isPDF = false;
      this.contentUrl = '';
      this.safeContentUrl = '';
    }
  }

  checkEnrollment(courseId: string): void {
    this.http.get(`${this.apiUrl}/enrollments/me`).subscribe({
      next: (data: any) => {
        const enrollments = Array.isArray(data) ? data : [];
        const enrollment = enrollments.find(
          (e: any) => e.course?._id === courseId || e.course === courseId
        );
        this.isEnrolled = !!enrollment;

        if (enrollment) {
          this.completedLessons = enrollment.lessonsCompleted || [];
          this.courseCompleted = enrollment.progress === 100;
          this.allLessonsCompleted = this.lessons.length > 0 &&
            this.lessons.every(
              l => this.completedLessons.includes(l._id) || !l.quiz?.questions?.length
            );
        }
        this.cdr.detectChanges();
      },
      error: () => {}
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
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.enrollLoading = false;
        if (err.status === 400) {
          this.isEnrolled = true;
        } else {
          this.enrollError = err.error?.message || 'Error enrolling';
        }
      }
    });
  }

  // ========== QUIZ ==========
  openQuiz(): void {
    if (!this.currentLesson?.quiz?.questions?.length) return;
    this.showQuiz = true;
    this.quizSubmitted = false;
    this.quizScore = 0;
    this.quizPassed = false;
    this.quizError = '';
    this.quizAnswers = new Array(this.currentLesson.quiz.questions.length).fill(-1);
  }

  submitQuiz(): void {
    if (this.quizAnswers.includes(-1)) {
      this.quizError = 'Please answer all questions !';
      return;
    }

    this.quizLoading = true;
    this.quizError = '';

    this.http.post(`${this.apiUrl}/quiz/lesson/${this.currentLesson._id}/submit`, {
      answers: this.quizAnswers
    }).subscribe({
      next: (res: any) => {
        this.quizLoading = false;
        this.quizSubmitted = true;
        this.quizScore = res.score;
        this.quizPassed = res.passed;

        if (res.passed) {
          if (!this.completedLessons.includes(this.currentLesson._id)) {
            this.completedLessons.push(this.currentLesson._id);
          }
          this.allLessonsCompleted = this.lessons.every(
            l => this.completedLessons.includes(l._id) || !l.quiz?.questions?.length
          );
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.quizLoading = false;
        this.quizError = err.error?.message || 'Error submitting quiz';
      }
    });
  }

  isLessonCompleted(lessonId: string): boolean {
    return this.completedLessons.includes(lessonId);
  }

  canGoNext(): boolean {
    if (!this.currentLesson?.quiz?.questions?.length) return true;
    return this.isLessonCompleted(this.currentLesson._id);
  }

  // ========== FINAL EXAM ==========
  openFinalExam(): void {
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
    if (this.finalExamAnswers.includes(-1)) {
      this.finalExamError = 'Please answer all questions !';
      return;
    }

    this.finalExamLoading = true;
    this.finalExamError = '';

    this.http.post(`${this.apiUrl}/quiz/final/${this.course._id}/submit`, {
      answers: this.finalExamAnswers
    }).subscribe({
      next: (res: any) => {
        this.finalExamLoading = false;
        this.finalExamSubmitted = true;
        this.finalExamScore = res.score;
        this.finalExamPassed = res.passed;
        if (res.passed) this.courseCompleted = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.finalExamLoading = false;
        this.finalExamError = err.error?.message || 'Error submitting final exam';
      }
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
        this.hasReviewed = this.reviews.some(r =>
          r.user?._id?.toString() === this.currentUserId?.toString()
        );

        console.log('📝 currentUserId:', this.currentUserId);
        console.log('📝 hasReviewed:', this.hasReviewed);
        console.log('📝 reviews:', this.reviews.map(r => ({
          userId: r.user?._id,
          match: r.user?._id?.toString() === this.currentUserId?.toString()
        })));

        this.cdr.detectChanges();
      },
      error: () => {}
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

    this.http.post(`${this.apiUrl}/reviews/course/${this.course._id}`, this.newReview).subscribe({
      next: () => {
        this.reviewLoading = false;
        this.reviewSuccess = 'Review added ! ✅';
        this.newReview = { rating: 5, comment: '' };
        this.loadReviews(this.course._id);
        setTimeout(() => this.reviewSuccess = '', 3000);
      },
      error: (err) => {
        this.reviewLoading = false;
        this.reviewError = err.error?.message || 'Error adding review';
      }
    });
  }

  editReview(review: any): void {
    this.editingReview = { ...review };
    this.cdr.detectChanges();
  }

  updateReview(): void {
    this.reviewLoading = true;
    this.reviewError = '';

    this.http.put(`${this.apiUrl}/reviews/${this.editingReview._id}`, {
      rating: this.editingReview.rating,
      comment: this.editingReview.comment
    }).subscribe({
      next: () => {
        this.reviewLoading = false;
        this.reviewSuccess = 'Review updated ! ✅';
        this.editingReview = null;
        this.loadReviews(this.course._id);
        setTimeout(() => this.reviewSuccess = '', 3000);
      },
      error: (err) => {
        this.reviewLoading = false;
        this.reviewError = err.error?.message || 'Error updating review';
      }
    });
  }

  deleteReview(reviewId: string): void {
    if (!confirm('Delete this review ?')) return;
    this.http.delete(`${this.apiUrl}/reviews/${reviewId}`).subscribe({
      next: () => {
        this.hasReviewed = false;
        this.loadReviews(this.course._id);
      },
      error: () => {}
    });
  }

  isMyReview(review: any): boolean {
    if (!this.currentUserId) return false;
    const reviewUserId = review.user?._id?.toString() ||
                         review.user?.id?.toString() ||
                         review.user?.toString() || '';
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
    return this.isPurchased;
  }

  // ✅ Progress is computed server-side now; the client only signals completion
  // of the current lesson — no more fabricated { progress: 100 } calls.
  updateProgress(): void {
    this.http.get(`${this.apiUrl}/enrollments/me`).subscribe({
      next: (data: any) => {
        const enrollments = Array.isArray(data) ? data : [];
        const enrollment = enrollments.find(
          (e: any) => e.course?._id === this.course._id || e.course === this.course._id
        );

        if (enrollment) {
          this.http.put(`${this.apiUrl}/enrollments/${enrollment._id}/progress`, {})
            .subscribe({ error: () => {} });
        }
      },
      error: () => {}
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
          summarizedAt: res.summarizedAt
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
        setTimeout(() => this.nlpSuccess = '', 4000);
      },
      error: (err) => {
        this.nlpLoading = null;
        this.nlpError = err.status === 503
          ? '⚠️ Service Whisper non disponible. Lancez Flask sur le port 5001.'
          : err.error?.message || 'Erreur lors de la génération du résumé';
        setTimeout(() => this.nlpError = '', 5000);
      }
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