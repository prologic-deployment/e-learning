import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';
import { CartService } from '../../../services/cart.service';
import { categoryColor, categoryIcon } from '../../../shared/categories';

@Component({
  selector: 'app-paid-courses-single-page',
  templateUrl: './paid-courses-single-page.component.html',
  styleUrls: ['./paid-courses-single-page.component.scss']
})
export class PaidCoursesSinglePageComponent implements OnInit {

  course: any = null;
  loading = true;
  error = '';
  isOpen = false;
  apiUrl = environment.apiUrl;
  backendUrl = environment.backendUrl;   // public assets (avatars)

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


  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private cartService: CartService,
    private cdr: ChangeDetectorRef
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
              error: () => { this.loadReviews(id); }
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
      }
    });
  }

  checkEnrollment(courseId: string): void {
    this.http.get(`${this.apiUrl}/enrollments/me`).subscribe({
      next: (data: any) => {
        const enrollments = Array.isArray(data) ? data : [];
        this.isEnrolled = enrollments.some(
          (e: any) => e.course?._id === courseId || e.course === courseId
        );
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  // ✅ Charger les reviews (user connecté)
  loadReviews(courseId: string): void {
    this.http.get(`${this.apiUrl}/reviews/course/${courseId}`).subscribe({
      next: (data: any) => {
        this.reviews = [...(data.reviews || [])];
        this.avgRating = data.avgRating || 0;
        this.totalReviews = data.total || 0;

        this.hasReviewed = this.reviews.some(r =>
          r.user?._id?.toString() === this.currentUserId?.toString()
        );

        this.cdr.detectChanges();
      },
      error: () => {}
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
      }
    });
  }

  // ✅ Soumettre un review
  submitReview(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/profile-authentication'],
        { queryParams: { returnUrl: this.router.url } });
      return;
    }

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
        this.reviewSuccess = 'Review submitted and pending approval ! ';
        this.newReview = { rating: 5, comment: '' };
        this.loadReviews(this.course._id);
        setTimeout(() => this.reviewSuccess = '', 4000);
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
        this.reviewSuccess = 'Review updated ! ';
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

  getStars(rating: number): string {
    return '★'.repeat(Math.round(rating));
  }

  enrollCourse(): void {
    // ✅ Rediriger vers login si non connecté
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/profile-authentication'],
        { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.enrollLoading = true;
    this.enrollError = '';
    this.enrollSuccess = '';

    this.http.post(`${this.apiUrl}/enrollments/${this.course._id}/enroll`, {}).subscribe({
      next: () => {
        this.enrollLoading = false;
        this.enrollSuccess = 'Enrolled successfully ! ';
        this.isEnrolled = true;
      },
      error: (err) => {
        this.enrollLoading = false;
        this.enrollError = err.error?.message || 'Error enrolling';
      }
    });
  }

  addToCart(): void {
    // ✅ Rediriger vers login si non connecté
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/profile-authentication'],
        { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.cartLoading = true;
    this.cartError = '';
    this.cartSuccess = '';

    this.cartService.addToCart(this.course._id).subscribe({
      next: () => {
        this.cartLoading = false;
        this.cartSuccess = 'Course added to cart ! ';
        setTimeout(() => this.cartSuccess = '', 3000);
      },
      error: (err) => {
        this.cartLoading = false;
        if (err.status === 409) { this.isEnrolled = true; return; }      // already owned
        if (/already in cart/i.test(err.error?.message || '')) { this.cartSuccess = 'This course is already in your cart.'; return; }
        this.cartError = err.error?.message || 'Error adding to cart';
      }
    });
  }

  enrollAndView(): void {
    // ✅ Rediriger vers login si non connecté
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/profile-authentication'],
        { queryParams: { returnUrl: this.router.url } });
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
        if (err.status === 400) {
          this.router.navigate(['/course', this.course._id]);
        } else {
          this.enrollError = err.error?.message || 'Error enrolling';
        }
      }
    });
  }

  generateSummary(): void {
    // ✅ Rediriger vers login si non connecté
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/profile-authentication'],
        { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.aiLoading = true;
    this.aiError = '';
    this.showAiSummary = true;

    this.http.post(`${this.apiUrl}/nlp/summarize`, {
      courseId: this.course._id
    }).subscribe({
      next: (data: any) => {
        this.aiSummary = data;
        this.aiLoading = false;
      },
      error: (err) => {
        this.aiLoading = false;
        this.aiError = err.error?.message || 'Error generating AI summary';
      }
    });
  }

  getCategoryIcon(category: string): string {
    return categoryIcon(category);
  }

  getCourseColor(category: string): string {
    return categoryColor(category);
  }

  // ---------- view helpers for the course landing page ----------

  /** Add to cart, then go straight to the checkout */
  buyNow(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/profile-authentication'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.cartLoading = true;
    this.cartError = '';
    this.cartService.addToCart(this.course._id).subscribe({
      next: () => { this.cartLoading = false; this.router.navigate(['/checkout']); },
      error: (err) => {
        this.cartLoading = false;
        if (err.status === 409) { this.isEnrolled = true; return; }      // already owned
        // already in cart → still go to the checkout
        if (err.status === 400) { this.router.navigate(['/checkout']); return; }
        this.cartError = err.error?.message || 'Error adding to cart';
      }
    });
  }

  get lessons(): any[] {
    return (this.course?.lessons || []).filter((l: any) => l && typeof l === 'object');
  }

  get lessonCount(): number {
    return this.course?.lessons?.length || 0;
  }

  get examQuestions(): number {
    const fe = this.course?.finalExam;
    return fe?.questionsCount ?? fe?.questions?.length ?? 0;
  }

  get rounded(): number {
    return Math.round((Number(this.avgRating) || 0) * 10) / 10;
  }

  /** Boxicons classes for 5 rating stars (full / half / empty) */
  stars(value: number): string[] {
    const v = Number(value) || 0;
    return [1, 2, 3, 4, 5].map(i => v >= i ? 'bx bxs-star' : v >= i - 0.5 ? 'bx bxs-star-half' : 'bx bx-star');
  }

  /** Share of reviews per star value (5 → 1), for the rating bars */
  get ratingBreakdown(): { stars: number; pct: number; count: number }[] {
    const total = this.reviews.length || 1;
    return [5, 4, 3, 2, 1].map(s => {
      const count = this.reviews.filter(r => Math.round(r.rating) === s).length;
      return { stars: s, count, pct: Math.round((count / total) * 100) };
    });
  }

  lessonIcon(type: string): string {
    return type === 'video' ? 'bx bx-play-circle' : type === 'pdf' ? 'bx bx-file' : 'bx bx-book-content';
  }

  initials(first?: string, last?: string): string {
    return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || '?';
  }

  setRating(target: 'new' | 'edit', value: number): void {
    if (target === 'new') this.newReview.rating = value;
    else if (this.editingReview) this.editingReview.rating = value;
  }





  openPopup(): void { this.isOpen = true; }
  closePopup(): void { this.isOpen = false; }
}