import {ToastService} from '../../../../services/toast.service';
import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { StatsService } from '../../../../services/stats.service';
import { AuthService } from '../../../../services/auth.service';
import { CourseService } from '../../../../services/course.service';
import { UserService } from '../../../../services/user.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {

  activeTab: string = 'stats';
  currentUser: any;
  apiUrl = environment.apiUrl;

  stats: any = null;
  statsLoading = true;
  statsError = '';

  users: any[] = [];
  usersLoading = false;
  usersError = '';

  courses: any[] = [];
  coursesLoading = false;
  coursesError = '';
  searchQuery = '';

  newCourse = {
    title: '', description: '', tags: '',
    price: 0, category: '', subCategory: ''
  };
  createCourseLoading = false;
  createCourseSuccess = '';
  createCourseError = '';
  createdCourse: any = null;

  showCustomCategory = false;
  customCategoryInput = '';
  customSubCategoryInput = '';

  categories = [
    'Development', 'Business', 'Finance', 'IT & Software',
    'Design', 'Marketing', 'Health & Fitness', 'Data Science'
  ];

  subCategories: { [key: string]: string[] } = {
    'Development': ['Web Development', 'Mobile Development', 'Python', 'JavaScript', 'Java', 'Game Development'],
    'Business': ['Entrepreneurship', 'Management', 'Sales', 'Strategy', 'Communication'],
    'Finance': ['Accounting', 'Trading', 'Investment', 'Crypto', 'Personal Finance'],
    'IT & Software': ['Cybersecurity', 'Networking', 'Cloud Computing', 'Linux', 'DevOps'],
    'Design': ['UI/UX Design', 'Graphic Design', 'Figma', 'Motion Design', 'Illustration'],
    'Marketing': ['SEO', 'Social Media', 'Email Marketing', 'Google Ads', 'Content Marketing'],
    'Health & Fitness': ['Nutrition', 'Yoga', 'Fitness', 'Mental Health', 'Meditation'],
    'Data Science': ['Machine Learning', 'Artificial Intelligence', 'Data Analytics', 'Deep Learning', 'NLP']
  };

  get currentSubCategories(): string[] {
    if (!this.newCourse.category) return [];
    return this.subCategories[this.newCourse.category] || [];
  }

  addCustomCategory(): void {
    const cat = this.customCategoryInput.trim();
    if (!cat) return;
    if (!this.categories.includes(cat)) {
      this.categories.push(cat);
      this.subCategories[cat] = [];
    }
    this.newCourse.category = cat;
    this.newCourse.subCategory = '';
    this.customCategoryInput = '';
    this.showCustomCategory = false;
  }

  addCustomSubCategory(): void {
    const sub = this.customSubCategoryInput.trim();
    if (!sub || !this.newCourse.category) return;
    if (!this.subCategories[this.newCourse.category]) {
      this.subCategories[this.newCourse.category] = [];
    }
    if (!this.subCategories[this.newCourse.category].includes(sub)) {
      this.subCategories[this.newCourse.category].push(sub);
    }
    this.newCourse.subCategory = sub;
    this.customSubCategoryInput = '';
  }

  onCategoryChange(): void {
    this.newCourse.subCategory = '';
    this.customSubCategoryInput = '';
    this.showCustomCategory = false;
  }

  newLesson = { title: '', content: '' };
  lessonFile: File | null = null;
  lessonLoading = false;
  lessonSuccess = '';
  lessonError = '';
  lessons: any[] = [];

  // ✅ Quiz 1
  showQuizForm = false;
  selectedLessonId = '';
  newQuiz = {
    noteMinimale: 70,
    questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
  };
  quizLoading = false;
  quizSuccess = '';
  quizError = '';

  // ✅ Quiz 2
  showQuizForm2 = false;
  selectedLessonId2 = '';
  newQuiz2 = {
    noteMinimale: 70,
    questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
  };
  quizLoading2 = false;
  quizSuccess2 = '';
  quizError2 = '';

  // ✅ Final Exam
  showFinalExamForm = false;
  newFinalExam = {
    noteMinimale: 70,
    questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
  };
  finalExamLoading = false;
  finalExamSuccess = '';
  finalExamError = '';

  managers: any[] = [];
  assignUserId = '';
  assignManagerId = '';
  assignUserSuccess = '';
  assignUserError = '';
  assignUserLoading = false;

  newStaff = {
    firstname: '', lastname: '', email: '',
    password: '', dateOfBirth: '', role: 'manager'
  };
  private toast=inject(ToastService);
  get staffUsers(){return this.users.filter(u=>['admin','trainer','manager'].includes(Array.isArray(u.role)?u.role[0]:u.role));}
  createStaffLoading = false;
  createStaffSuccess = '';
  createStaffError = '';

  reviews: any[] = [];
  reviewsLoading = false;
  reviewsError = '';
  reviewFilter = 'all';

  quizResults: any[] = [];
  quizResultsLoading = false;
  quizResultsFilter = 'all';

  constructor(
    private statsService: StatsService,
    private authService: AuthService,
    private courseService: CourseService,
    private userService: UserService,
    private router: Router,
    private http: HttpClient,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadStats();
    this.route.queryParams.subscribe(params => {
      if (params['tab']) this.setTab(params['tab']);
    });
  }

  setTab(tab: string): void {
    this.activeTab = tab;
    if (this.route.snapshot.queryParams['tab'] !== tab) this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });

    if ((tab === 'users' || tab === 'staff-list') && this.users.length === 0) this.loadUsers();
    if (tab === 'courses' && this.courses.length === 0) this.loadCourses();

    // ✅ Fix archived
    if (tab === 'archived') this.loadArchivedCourses();

    if (tab === 'assign') {
      if (this.users.length === 0) this.loadUsers();
      this.loadManagers();
    }

    if (tab === 'reviews') this.loadReviews();
    if (tab === 'quiz-results') this.loadQuizResults();

    // ✅ clearCourseForm seulement si on quitte create
    if (tab !== 'create' && this.activeTab !== 'create') {
      this.clearCourseForm();
    }
  }

  clearCourseForm(): void {
    this.newCourse = { title: '', description: '', tags: '', price: 0, category: '', subCategory: '' };
    this.createCourseSuccess = '';
    this.createCourseError = '';
    this.newLesson = { title: '', content: '' };
    this.lessonFile = null;
    this.lessonSuccess = '';
    this.lessonError = '';
    // Quiz 1
    this.showQuizForm = false;
    this.quizSuccess = '';
    this.quizError = '';
    this.newQuiz = {
      noteMinimale: 70,
      questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
    };
    // Quiz 2
    this.showQuizForm2 = false;
    this.quizSuccess2 = '';
    this.quizError2 = '';
    this.newQuiz2 = {
      noteMinimale: 70,
      questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
    };
    // Final Exam
    this.showFinalExamForm = false;
    this.finalExamSuccess = '';
    this.finalExamError = '';
    this.newFinalExam = {
      noteMinimale: 70,
      questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
    };
    this.showCustomCategory = false;
    this.customCategoryInput = '';
    this.customSubCategoryInput = '';
  }

  loadStats(): void {
    this.statsLoading = true;
    this.statsService.getAdminStats().subscribe({
      next: (data) => { this.stats = data; this.statsLoading = false; },
      error: (err) => { this.statsError = err.error?.message || 'Error'; this.statsLoading = false; }
    });
  }

  loadUsers(): void {
    this.usersError = '';
    this.usersLoading = true;
    this.userService.getAllUsers().subscribe({
      next: (data) => { this.users = data; this.usersLoading = false; },
      error: (err) => { this.usersError = err.error?.message || 'Error'; this.usersLoading = false; }
    });
  }

  userActionLoading = false;
  changeRole(userId: string, role: string): void {
    if (this.userActionLoading) return;
    this.userActionLoading = true; this.usersError = '';
    this.userService.updateUserRole(userId, role).subscribe({
      next: () => { this.userActionLoading = false; this.toast.show('User access updated.'); this.loadUsers(); },
      error: err => { this.userActionLoading = false; this.usersError = err.error?.message || 'Unable to update this role.'; this.toast.show(this.usersError,'error'); }
    });
  }
  deleteUser(userId: string): void {
    if (this.userActionLoading) return;
    this.userActionLoading = true; this.usersError = '';
    this.userService.deleteUser(userId).subscribe({
      next: () => { this.userActionLoading = false; this.toast.show('User deleted.'); this.loadUsers(); },
      error: err => { this.userActionLoading = false; this.usersError = err.error?.message || 'Unable to delete this account.'; this.toast.show(this.usersError,'error'); }
    });
  }

  loadCourses(): void {
    this.coursesLoading = true;
    this.http.get<any>(`${this.apiUrl}/courses/trainer/all`).subscribe({
      next: (data) => { this.courses = data.courses; this.coursesLoading = false; },
      error: (err) => { this.coursesError = err.error?.message || 'Error'; this.coursesLoading = false; }
    });
  }

  searchCourses(): void {
    this.coursesLoading = true;
    this.courseService.getAllCourses({ search: this.searchQuery }).subscribe({
      next: (data) => { this.courses = data.courses; this.coursesLoading = false; },
      error: (err) => { this.coursesError = err.error?.message || 'Error'; this.coursesLoading = false; }
    });
  }

  approveCourse(courseId: string): void {
    this.courseService.approveCourse(courseId).subscribe({
      next: () => { this.loadCourses(); },
      error: (err) => this.toast.show(err.error?.message || 'Unable to publish course.','error')
    });
  }

  deleteCourse(courseId: string): void {
    {
      this.courseService.deleteCourse(courseId).subscribe({
        next: () => { this.loadCourses(); },
        error: (err) => this.toast.show(err.error?.message || 'Unable to delete course.','error')
      });
    }
  }

  createCourse(): void {
    this.createCourseLoading = true;
    this.createCourseError = '';
    this.createCourseSuccess = '';
    const body = {
      title: this.newCourse.title,
      description: this.newCourse.description,
      tags: this.newCourse.tags,
      price: this.newCourse.price,
      category: this.newCourse.category,
      subCategory: this.newCourse.subCategory
    };
    this.http.post(`${this.apiUrl}/courses`, body).subscribe({
      next: (data: any) => {
        this.createCourseLoading = false;
        this.createCourseSuccess = 'Course created ! Now add lessons 📚';
        this.createdCourse = data.course;
        this.loadLessons(data.course._id);
      },
      error: (err) => {
        this.createCourseLoading = false;
        this.createCourseError = err.error?.message || 'Error creating course';
      }
    });
  }

  editExistingCourse(course: any): void {
    this.createCourseSuccess = '';
    this.createCourseError = '';
    this.createdCourse = course;
    this.newCourse = {
      title: course.title || '',
      description: course.description || '',
      tags: Array.isArray(course.tags) ? course.tags.join(', ') : course.tags || '',
      price: course.price || 0,
      category: course.category || '',
      subCategory: course.subCategory || ''
    };
    this.loadLessons(course._id);
    this.setTab('create');
  }

  updateCourse(): void {
    this.createCourseLoading = true;
    this.createCourseError = '';
    this.createCourseSuccess = '';
    const body = {
      title: this.newCourse.title,
      description: this.newCourse.description,
      tags: this.newCourse.tags,
      price: this.newCourse.price,
      category: this.newCourse.category,
      subCategory: this.newCourse.subCategory
    };
    this.http.put(`${this.apiUrl}/courses/${this.createdCourse._id}`, body).subscribe({
      next: (data: any) => {
        this.createCourseLoading = false;
        this.createCourseSuccess = 'Course updated successfully ! ✅';
        this.createdCourse = { ...this.createdCourse, ...body };
        setTimeout(() => this.createCourseSuccess = '', 3000);
      },
      error: (err) => {
        this.createCourseLoading = false;
        this.createCourseError = err.error?.message || 'Error updating course';
      }
    });
  }

  onLessonFileSelected(event: any): void {
    this.lessonFile = event.target.files[0];
  }

  loadLessons(courseId: string): void {
    this.http.get(`${this.apiUrl}/lessons/course/${courseId}`).subscribe({
      next: (data: any) => { this.lessons = data; },
      error: () => {}
    });
  }

  addLesson(): void {
    if (!this.createdCourse) return;
    this.lessonLoading = true;
    this.lessonError = '';
    this.lessonSuccess = '';
    const formData = new FormData();
    formData.append('title', this.newLesson.title);
    formData.append('content', this.newLesson.content);
    if (this.lessonFile) formData.append('contentFile', this.lessonFile);
    this.http.post(`${this.apiUrl}/lessons/course/${this.createdCourse._id}`, formData).subscribe({
      next: () => {
        this.lessonLoading = false;
        this.lessonSuccess = 'Lesson added ! ✅';
        this.newLesson = { title: '', content: '' };
        this.lessonFile = null;
        this.loadLessons(this.createdCourse._id);
        setTimeout(() => this.lessonSuccess = '', 3000);
      },
      error: (err) => {
        this.lessonLoading = false;
        this.lessonError = err.error?.message || 'Error adding lesson';
      }
    });
  }

  deleteLesson(lessonId: string): void {
    this.http.delete(`${this.apiUrl}/lessons/${lessonId}`).subscribe({
      next: () => { this.loadLessons(this.createdCourse._id); },
      error: () => {}
    });
  }

  // ✅ Quiz 1
  openQuizForm(lessonId: string): void {
    this.selectedLessonId = lessonId;
    this.showQuizForm = true;
    this.showQuizForm2 = false;
    this.showFinalExamForm = false;
    this.newQuiz = {
      noteMinimale: 70,
      questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
    };
    this.quizSuccess = '';
    this.quizError = '';
  }

  addQuizQuestion(): void {
    this.newQuiz.questions.push({ texte: '', options: ['', '', '', ''], correctAnswer: 0 });
  }

  removeQuizQuestion(index: number): void {
    this.newQuiz.questions.splice(index, 1);
  }

  saveQuiz(): void {
    this.quizError = '';
    this.quizSuccess = '';

    const emptyQuestion = this.newQuiz.questions.find(q => !q.texte.trim());
    if (emptyQuestion) {
      this.quizError = '⚠️ Please fill in all question texts !';
      return;
    }
    for (const q of this.newQuiz.questions) {
      const filledOptions = q.options.filter(opt => opt.trim() !== '');
      if (filledOptions.length < 2) {
        this.quizError = '⚠️ Each question must have at least 2 answer options !';
        return;
      }
    }

    this.quizLoading = true;
    this.http.post(`${this.apiUrl}/quiz/lesson/${this.selectedLessonId}`, this.newQuiz).subscribe({
      next: () => {
        this.quizLoading = false;
        this.quizSuccess = 'Quiz 1 saved ! ✅';
        this.showQuizForm = false;
        this.newQuiz = {
          noteMinimale: 70,
          questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
        };
        this.loadLessons(this.createdCourse._id);
        setTimeout(() => this.quizSuccess = '', 3000);
      },
      error: (err) => {
        this.quizLoading = false;
        this.quizError = err.error?.message || 'Error saving quiz';
      }
    });
  }

  // ✅ Quiz 2
  openQuizForm2(lessonId: string): void {
    this.selectedLessonId2 = lessonId;
    this.showQuizForm2 = true;
    this.showQuizForm = false;
    this.showFinalExamForm = false;
    this.newQuiz2 = {
      noteMinimale: 70,
      questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
    };
    this.quizSuccess2 = '';
    this.quizError2 = '';
  }

  addQuizQuestion2(): void {
    this.newQuiz2.questions.push({ texte: '', options: ['', '', '', ''], correctAnswer: 0 });
  }

  removeQuizQuestion2(index: number): void {
    this.newQuiz2.questions.splice(index, 1);
  }

  saveQuiz2(): void {
    this.quizError2 = '';
    this.quizSuccess2 = '';

    const emptyQuestion = this.newQuiz2.questions.find(q => !q.texte.trim());
    if (emptyQuestion) {
      this.quizError2 = '⚠️ Please fill in all question texts !';
      return;
    }
    for (const q of this.newQuiz2.questions) {
      const filledOptions = q.options.filter(opt => opt.trim() !== '');
      if (filledOptions.length < 2) {
        this.quizError2 = '⚠️ Each question must have at least 2 answer options !';
        return;
      }
    }

    this.quizLoading2 = true;
    this.http.post(`${this.apiUrl}/quiz/lesson/${this.selectedLessonId2}/quiz2`, this.newQuiz2).subscribe({
      next: () => {
        this.quizLoading2 = false;
        this.quizSuccess2 = 'Quiz 2 saved ! ✅';
        this.showQuizForm2 = false;
        this.newQuiz2 = {
          noteMinimale: 70,
          questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
        };
        this.loadLessons(this.createdCourse._id);
        setTimeout(() => this.quizSuccess2 = '', 3000);
      },
      error: (err) => {
        this.quizLoading2 = false;
        this.quizError2 = err.error?.message || 'Error saving quiz 2';
      }
    });
  }

  // ✅ Final Exam
  openFinalExamForm(): void {
    this.showFinalExamForm = true;
    this.showQuizForm = false;
    this.showQuizForm2 = false;
    this.newFinalExam = {
      noteMinimale: 70,
      questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
    };
    this.finalExamSuccess = '';
    this.finalExamError = '';
  }

  addFinalExamQuestion(): void {
    this.newFinalExam.questions.push({ texte: '', options: ['', '', '', ''], correctAnswer: 0 });
  }

  removeFinalExamQuestion(index: number): void {
    this.newFinalExam.questions.splice(index, 1);
  }

  saveFinalExam(): void {
    this.finalExamError = '';
    this.finalExamSuccess = '';

    const emptyQuestion = this.newFinalExam.questions.find(q => !q.texte.trim());
    if (emptyQuestion) {
      this.finalExamError = '⚠️ Please fill in all question texts !';
      return;
    }
    for (const q of this.newFinalExam.questions) {
      const filledOptions = q.options.filter(opt => opt.trim() !== '');
      if (filledOptions.length < 2) {
        this.finalExamError = '⚠️ Each question must have at least 2 answer options !';
        return;
      }
    }

    this.finalExamLoading = true;
    this.http.post(`${this.apiUrl}/quiz/final/${this.createdCourse._id}`, this.newFinalExam).subscribe({
      next: () => {
        this.finalExamLoading = false;
        this.finalExamSuccess = 'Final exam saved ! 🎓';
        this.showFinalExamForm = false;
        this.newFinalExam = {
          noteMinimale: 70,
          questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
        };
        setTimeout(() => this.finalExamSuccess = '', 3000);
      },
      error: (err) => {
        this.finalExamLoading = false;
        this.finalExamError = err.error?.message || 'Error saving final exam';
      }
    });
  }

  loadManagers(): void {
    this.userService.getAllUsers().subscribe({
      next: (data) => { this.managers = data.filter((u: any) => u.role === 'manager'); },
      error: () => {}
    });
  }

  assignUserToManager(): void {
    if (!this.assignUserId || !this.assignManagerId) {
      this.assignUserError = 'Please select a user and a manager !';
      return;
    }
    this.assignUserLoading = true;
    this.assignUserError = '';
    this.assignUserSuccess = '';
    this.http.post(`${this.apiUrl}/managers/assign-user`, {
      userId: this.assignUserId,
      managerId: this.assignManagerId
    }).subscribe({
      next: () => {
        this.assignUserLoading = false;
        this.assignUserSuccess = 'User assigned to manager successfully ! ✅';
        this.assignUserId = '';
        this.assignManagerId = '';
        this.loadUsers();
      },
      error: (err) => {
        this.assignUserLoading = false;
        this.assignUserError = err.error?.message || 'Error assigning user';
      }
    });
  }

  loadReviews(): void {
    this.reviewsLoading = true;
    this.reviewsError = '';
    this.http.get(`${this.apiUrl}/reviews/all`).subscribe({
      next: (data: any) => {
        this.reviews = data.reviews || data || [];
        this.reviewsLoading = false;
      },
      error: (err) => {
        this.reviewsError = err.error?.message || 'Error loading reviews';
        this.reviewsLoading = false;
      }
    });
  }

  get filteredReviews(): any[] {
    if (this.reviewFilter === 'pending') return this.reviews.filter(r => !r.isApproved);
    if (this.reviewFilter === 'approved') return this.reviews.filter(r => r.isApproved);
    return this.reviews;
  }

  get pendingReviewsCount(): number {
    return this.reviews.filter(r => !r.isApproved).length;
  }

  approveReview(reviewId: string): void {
    this.http.patch(`${this.apiUrl}/reviews/${reviewId}/approve`, {}).subscribe({
      next: () => { this.loadReviews(); },
      error: (err) => alert(err.error?.message || 'Error approving review')
    });
  }

  rejectReview(reviewId: string): void {
    if (!confirm('Reject and delete this review ?')) return;
    this.http.patch(`${this.apiUrl}/reviews/${reviewId}/reject`, {}).subscribe({
      next: () => { this.loadReviews(); },
      error: (err) => alert(err.error?.message || 'Error rejecting review')
    });
  }

  deleteReview(reviewId: string): void {
    if (!confirm('Delete this review ?')) return;
    this.http.delete(`${this.apiUrl}/reviews/${reviewId}`).subscribe({
      next: () => { this.loadReviews(); },
      error: (err) => alert(err.error?.message || 'Error deleting review')
    });
  }

  getStars(rating: number): string {
    return '⭐'.repeat(Math.round(rating));
  }

  loadQuizResults(): void {
    this.quizResultsLoading = true;
    this.http.get(`${this.apiUrl}/quiz/results/all`).subscribe({
      next: (data: any) => {
        this.quizResults = data.results || [];
        this.quizResultsLoading = false;
      },
      error: () => { this.quizResultsLoading = false; }
    });
  }

  get filteredQuizResults(): any[] {
    if (this.quizResultsFilter === 'passed') return this.quizResults.filter(r => r.passed);
    if (this.quizResultsFilter === 'failed') return this.quizResults.filter(r => !r.passed);
    return this.quizResults;
  }

  get passedCount(): number { return this.quizResults.filter(r => r.passed).length; }
  get failedCount(): number { return this.quizResults.filter(r => !r.passed).length; }

  exportPDF(): void {
    const doc = new jsPDF();
    doc.setFontSize(20); doc.setTextColor(44, 62, 80);
    doc.text('Platform Activity Report', 14, 20);
    doc.setFontSize(12); doc.setTextColor(100);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 14, 30);
    doc.setFontSize(14); doc.setTextColor(44, 62, 80);
    doc.text('Overview', 14, 45);
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Value']],
      body: [
        ['Total Users', this.stats.overview.totalUsers],
        ['Total Trainers', this.stats.overview.totalTrainers],
        ['Total Managers', this.stats.overview.totalManagers],
        ['Total Courses', this.stats.overview.totalCourses],
        ['Approved Courses', this.stats.overview.approvedCourses],
        ['Pending Courses', this.stats.overview.pendingCourses],
        ['Total Enrollments', this.stats.overview.totalEnrollments],
        ['Completion Rate', `${this.stats.overview.completionRate}%`],
        ['Total Revenue', `${this.stats.overview.totalRevenue} TND`],
        ['Certificates Delivered', this.stats.overview.totalCertificates],
      ],
      theme: 'grid', headStyles: { fillColor: [44, 62, 80] }
    });
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14); doc.text('Top Courses', 14, finalY);
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Course', 'Enrollments']],
      body: this.stats.topCourses.map((c: any) => [c.courseTitle, c.enrollments]),
      theme: 'striped', headStyles: { fillColor: [52, 152, 219] }
    });
    doc.save(`activity_report_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  exportExcel(): void {
    const overviewData = [
      ['Metric', 'Value'],
      ['Total Users', this.stats.overview.totalUsers],
      ['Total Trainers', this.stats.overview.totalTrainers],
      ['Total Managers', this.stats.overview.totalManagers],
      ['Total Courses', this.stats.overview.totalCourses],
      ['Approved Courses', this.stats.overview.approvedCourses],
      ['Pending Courses', this.stats.overview.pendingCourses],
      ['Total Enrollments', this.stats.overview.totalEnrollments],
      ['Completion Rate', `${this.stats.overview.completionRate}%`],
      ['Total Revenue', `${this.stats.overview.totalRevenue} TND`],
      ['Certificates', this.stats.overview.totalCertificates],
    ];
    const coursesData = [
      ['Course', 'Enrollments'],
      ...this.stats.topCourses.map((c: any) => [c.courseTitle, c.enrollments])
    ];
    const usersData = [
      ['First Name', 'Last Name', 'Email', 'Role'],
      ...this.users.map(u => [u.firstname, u.lastname, u.email, u.role])
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewData), 'Overview');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(coursesData), 'Top Courses');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(usersData), 'Users');
    XLSX.writeFile(wb, `activity_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  createStaff(): void {
    if(this.createStaffLoading)return;
    this.createStaffLoading = true;
    this.createStaffError = '';
    this.createStaffSuccess = '';
    this.http.post(`${this.apiUrl}/users/staff`, this.newStaff).subscribe({
      next: () => {
        this.createStaffLoading = false;
        this.toast.show('Staff account created.');
        this.newStaff = { firstname: '', lastname: '', email: '', password: '', dateOfBirth: '', role: 'manager' };
        this.setTab('staff-list');this.loadUsers();
      },
      error: (err) => {
        this.createStaffLoading = false;
        this.createStaffError = err.error?.message || 'Error creating manager';
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/profile-authentication']);
  }

  trackByIndex(index: number): number {
  return index;
  }


    // ✅ Edit Quiz 1
  editQuiz(lesson: any): void {
    this.selectedLessonId = lesson._id;
    this.showQuizForm = true;
    this.showQuizForm2 = false;
    this.showFinalExamForm = false;
    // ✅ Pré-remplir avec les données existantes
    this.newQuiz = {
      noteMinimale: lesson.quiz.noteMinimale || 70,
      questions: lesson.quiz.questions.map((q: any) => ({
        texte: q.texte,
        options: [...q.options],
        correctAnswer: q.correctAnswer
      }))
    };
    this.quizSuccess = '';
    this.quizError = '';
  }

  // ✅ Delete Quiz 1
  deleteQuiz(lessonId: string): void {
    if (!confirm('Delete Quiz 1 from this lesson ?')) return;
    this.http.delete(`${this.apiUrl}/quiz/lesson/${lessonId}/delete`).subscribe({
      next: () => {
        this.loadLessons(this.createdCourse._id);
      },
      error: (err) => alert(err.error?.message || 'Error deleting quiz')
    });
  }

  // ✅ Edit Quiz 2
  editQuiz2(lesson: any): void {
    this.selectedLessonId2 = lesson._id;
    this.showQuizForm2 = true;
    this.showQuizForm = false;
    this.showFinalExamForm = false;
    // ✅ Pré-remplir avec les données existantes
    this.newQuiz2 = {
      noteMinimale: lesson.quiz2.noteMinimale || 70,
      questions: lesson.quiz2.questions.map((q: any) => ({
        texte: q.texte,
        options: [...q.options],
        correctAnswer: q.correctAnswer
      }))
    };
    this.quizSuccess2 = '';
    this.quizError2 = '';
  }

  // ✅ Delete Quiz 2
  deleteQuiz2(lessonId: string): void {
    if (!confirm('Delete Quiz 2 from this lesson ?')) return;
    this.http.delete(`${this.apiUrl}/quiz/lesson/${lessonId}/quiz2/delete`).subscribe({
      next: () => {
        this.loadLessons(this.createdCourse._id);
      },
      error: (err) => alert(err.error?.message || 'Error deleting quiz 2')
    });
  }

  // ✅ Edit Final Exam
  editFinalExam(): void {
    this.showFinalExamForm = true;
    this.showQuizForm = false;
    this.showQuizForm2 = false;
    // ✅ Pré-remplir avec les données existantes
    this.http.get(`${this.apiUrl}/courses/${this.createdCourse._id}`).subscribe({
      next: (data: any) => {
        const exam = data.course?.finalExam || data.finalExam;
        if (exam) {
          this.newFinalExam = {
            noteMinimale: exam.noteMinimale || 70,
            questions: exam.questions.map((q: any) => ({
              texte: q.texte,
              options: [...q.options],
              correctAnswer: q.correctAnswer
            }))
          };
        }
      },
      error: () => {}
    });
    this.finalExamSuccess = '';
    this.finalExamError = '';
  }

  // ✅ Delete Final Exam
  deleteFinalExam(): void {
    if (!confirm('Delete Final Exam from this course ?')) return;
    this.http.delete(`${this.apiUrl}/quiz/final/${this.createdCourse._id}/delete`).subscribe({
      next: () => {
        this.loadLessons(this.createdCourse._id);
      },
      error: (err) => alert(err.error?.message || 'Error deleting final exam')
    });
  }


  // ✅ Cours archivés
  archivedCourses: any[] = [];

  // ✅ Archiver un cours (au lieu de supprimer)
  archiveCourse(course: any): void {


    this.http.patch(`${this.apiUrl}/courses/${course._id}/archive`, {}).subscribe({
      next: () => {
        // ✅ Retirer de la liste active
        this.courses = this.courses.filter(c => c._id !== course._id);
        // ✅ Ajouter à la liste archivée
        this.archivedCourses.unshift({
          ...course,
          isArchived: true,
          archivedAt: new Date()
        });
      },
      error: (err) => console.error(err)
    });
  }

  // ✅ Restaurer un cours archivé
  restoreCourse(courseId: string): void {
    this.http.patch(`${this.apiUrl}/courses/${courseId}/restore`, {}).subscribe({
      next: () => {
        const course = this.archivedCourses.find(c => c._id === courseId);
        if (course) {
          this.archivedCourses = this.archivedCourses.filter(c => c._id !== courseId);
          this.courses.unshift({ ...course, isArchived: false });
        }
      },
      error: (err) => console.error(err)
    });
  }

  loadArchivedCourses(): void {
    this.http.get(`${this.apiUrl}/courses/archived`).subscribe({
      next: (data: any) => {
        this.archivedCourses = data.courses || [];
      },
      error: () => {
        // ✅ Si pas de route backend encore — utilise la liste locale
        console.log('Archived courses loaded locally');
      }
    });
  }


}