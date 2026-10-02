import { Component, OnInit } from '@angular/core';
import { CourseService } from '../../../services/course.service';
import { AuthService } from '../../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-courses-basic-grid-page',
  templateUrl: './courses-basic-grid-page.component.html',
  styleUrls: ['./courses-basic-grid-page.component.scss']
})
export class CoursesBasicGridPageComponent implements OnInit {

  courses: any[] = [];
  loading = true;
  error = '';
  searchQuery = '';
  selectedType = '';
  selectedTag = '';
  selectedCategory = '';
  totalCourses = 0;
  currentPage = 1;
  totalPages = 1;
  apiUrl = environment.apiUrl;
  enrollingCourseId = '';
  enrollSuccess = '';
  enrollError = '';

  // ✅ Reviews par cours
  reviewsMap: { [courseId: string]: { avgRating: number, total: number, reviews: any[] } | undefined } = {};

  categories = [
    'Development', 'Business', 'Finance', 'IT & Software',
    'Design', 'Marketing', 'Data Science'
  ];

  constructor(
    private courseService: CourseService,
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.searchQuery = params['search'] || '';
      this.selectedCategory = params['category'] || '';
      this.selectedTag = params['tag'] || '';  // ✅ tag manquait
      this.currentPage = 1;
      this.loadCourses();
    });
  }

  loadCourses(): void {
    this.loading = true;
    this.courseService.getAllCourses({
      search: this.searchQuery,
      type: this.selectedType,
      tag: this.selectedTag,
      category: this.selectedCategory,
      page: this.currentPage,
      limit: 8
    }).subscribe({
      next: (data) => {
        this.courses = data.courses;
        this.totalCourses = data.pagination.total;
        this.totalPages = data.pagination.pages;
        this.loading = false;
        this.loadAllReviews();
      },
      error: (err) => {
        this.error = err.error?.message || 'Error loading courses';
        this.loading = false;
      }
    });
  }

  loadAllReviews(): void {
    this.courses.forEach(course => {
      this.http.get(`${this.apiUrl}/reviews/course/${course._id}`).subscribe({
        next: (data: any) => {
          this.reviewsMap[course._id] = {
            avgRating: data.avgRating || 0,
            total: data.total || 0,
            reviews: (data.reviews || []).slice(0, 2)
          };
        },
        error: () => {
          this.reviewsMap[course._id] = { avgRating: 0, total: 0, reviews: [] };
        }
      });
    });
  }

  // ✅ Fonctions helper pour éviter les erreurs de type
  getReviewRating(courseId: string): number {
    return this.reviewsMap[courseId]?.avgRating || 0;
  }

  getReviewTotal(courseId: string): number {
    return this.reviewsMap[courseId]?.total || 0;
  }

  getReviewList(courseId: string): any[] {
    return this.reviewsMap[courseId]?.reviews || [];
  }

  getStars(rating: number): string {
    return '⭐'.repeat(Math.round(rating));
  }

  search(): void {
    this.currentPage = 1;
    this.loadCourses();
  }

  filterByType(type: string): void {
    this.selectedType = type;
    this.currentPage = 1;
    this.loadCourses();
  }

  filterByCategory(category: string): void {
    this.selectedCategory = category;
    this.currentPage = 1;
    this.loadCourses();
  }

  clearCategory(): void {
    this.selectedCategory = '';
    this.currentPage = 1;
    this.loadCourses();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadCourses();
  }

  goToCourseDetail(courseId: string): void {
    this.router.navigate(['/courses-details', courseId]);
  }

  enrollCourse(courseId: string): void {
    this.enrollingCourseId = courseId;
    this.enrollSuccess = '';
    this.enrollError = '';

    this.http.post(`${this.apiUrl}/enrollments/${courseId}/enroll`, {}).subscribe({
      next: () => {
        this.enrollSuccess = 'Enrolled successfully ! 🎉';
        this.enrollingCourseId = '';
        setTimeout(() => this.enrollSuccess = '', 3000);
      },
      error: (err) => {
        this.enrollError = err.error?.message || 'Error enrolling';
        this.enrollingCourseId = '';
        setTimeout(() => this.enrollError = '', 3000);
      }
    });
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  getPages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  getCategoryIcon(category: string): string {
    const icons: any = {
      'Development': '💻',
      'Business': '💼',
      'Finance': '💰',
      'IT & Software': '🖥️',
      'Design': '🎨',
      'Marketing': '📣',
      'Data Science': '📊'
    };
    return icons[category] || '📚';
  }

  getCourseColor(category: string): string {
    const colors: any = {
      'Development': 'linear-gradient(135deg, #667eea, #764ba2)',
      'Business': 'linear-gradient(135deg, #f093fb, #f5576c)',
      'Finance': 'linear-gradient(135deg, #4facfe, #00f2fe)',
      'IT & Software': 'linear-gradient(135deg, #43e97b, #38f9d7)',
      'Design': 'linear-gradient(135deg, #fa709a, #fee140)',
      'Marketing': 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
      'Data Science': 'linear-gradient(135deg, #ffecd2, #fcb69f)'
    };
    return colors[category] || 'linear-gradient(135deg, #667eea, #764ba2)';
  }

  getCourseImage(category: string): string {
    const images: any = {
      'Development': 'assets/img/courses/courses-img1.jpg',
      'Business': 'assets/img/courses/courses-img2.jpg',
      'Finance': 'assets/img/courses/courses-img3.jpg',
      'IT & Software': 'assets/img/courses/courses-img4.jpg',
      'Design': 'assets/img/courses/courses-img5.jpg',
      'Marketing': 'assets/img/courses/courses-img6.jpg',
      'Data Science': 'assets/img/courses/courses-img7.jpg'
    };
    return images[category] || 'assets/img/courses/courses-img1.jpg';
  }

  goToSearch(): void {
    if (!this.searchQuery.trim()) return;
    this.router.navigate(['/courses-grid'], {
      queryParams: { search: this.searchQuery }
    });
  }


}