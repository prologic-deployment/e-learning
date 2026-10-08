import { TABLES } from '../../../data-table/table-presets';
import { memoLast } from '../../../management/memo-last';
import { ToastService } from '../../../../services/toast.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';
import { StatsService } from '../../../../services/stats.service';
import { CourseService } from '../../../../services/course.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-trainer-dashboard',
  templateUrl: './trainer-dashboard.component.html',
  styleUrls: ['./trainer-dashboard.component.scss']
})
export class TrainerDashboardComponent implements OnInit {
    readonly tables=TABLES;

  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  activeTab: string = 'stats';
  currentUser: any;
  apiUrl = environment.apiUrl;

  // Stats
  stats: any = null;
  statsLoading = false;
  statsError = '';

  // ✅ All Courses list
  allCourses: any[] = [];
  allCoursesLoading = false;
  allCoursesSearch = '';

  // Create Course
  newCourse = { title: '', description: '', tags: '', price: 0, category: '' };
  createCourseLoading = false;
  createCourseSuccess = '';
  createCourseError = '';
  createdCourse: any = null;

  // Lessons
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

  // Final Exam
  showFinalExamForm = false;
  newFinalExam = {
    noteMinimale: 70,
    questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
  };
  finalExamLoading = false;
  finalExamSuccess = '';
  finalExamError = '';

  // ✅ Quiz Results
  quizResults: any[] = [];
  quizResultsLoading = false;
  quizResultsError = '';
  quizResultsFilter = 'all';

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

  categories = [
    'Development', 'Business', 'Finance', 'IT & Software',
    'Design', 'Marketing', 'Health & Fitness', 'Data Science'
  ];

  // Profile
  profile: any = null;
  profileLoading = false;
  profileData = { firstname: '', lastname: '', phone: '', address: '' };
  profileUpdateLoading = false;
  profileUpdateSuccess = '';
  profileUpdateError = '';

  // Password
  passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
  passwordLoading = false;
  passwordSuccess = '';
  passwordError = '';

  constructor(
    private authService: AuthService,
    private statsService: StatsService,
    private courseService: CourseService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => this.setTab(params['tab'] || 'stats'));
  }

  setTab(tab: string): void {
    if ((this.route.snapshot.queryParams['tab'] || 'stats') !== tab) {
      this.router.navigate([], {relativeTo:this.route, queryParams:{tab}, queryParamsHandling:'merge', replaceUrl:true});
      return;
    }
    this.activeTab = tab;
    if (tab === 'stats' && !this.stats && !this.statsLoading) this.loadStats();
    if (tab === 'create' && !this.createdCourse) {
      this.createCourseSuccess = '';
      this.createCourseError = '';
    }
    if (tab === 'profile') this.loadProfile();
    if (tab === 'courses') this.loadAllCourses();
    if (tab === 'quiz-results') this.loadQuizResults();
  }

  // ========== STATS ==========
  loadStats(): void {
    this.statsError = '';
    this.statsLoading = true;
    this.statsService.getTrainerStats().subscribe({
      next: (data) => { this.stats = data; this.statsLoading = false; },
      error: (err) => { this.statsError = err.error?.message || 'Error'; this.statsLoading = false; }
    });
  }

  // ✅ ========== ALL COURSES ==========
  loadAllCourses(): void {
    this.courseTableError = '';
    this.allCoursesLoading = true;
    this.http.get(`${this.apiUrl}/courses/trainer/all`).subscribe({
      next: (data: any) => {
        this.allCourses = data.courses || data || [];
        this.allCoursesLoading = false;
      },
      error: () => {this.courseTableError = 'Unable to retrieve your course library. Please try again.';this.allCoursesLoading = false;}
    });
  }

  get filteredCourses(): any[] {
    if (!this.allCoursesSearch.trim()) return this.allCourses;
    const q = this.allCoursesSearch.toLowerCase();
    return this.allCourses.filter(c =>
      c.title?.toLowerCase().includes(q) ||
      c.category?.toLowerCase().includes(q)
    );
  }

  startNewCourse() { this.createdCourse = null; this.newCourse = {title:'',description:'',tags:'',price:0,category:''}; this.createCourseSuccess = ''; this.createCourseError = ''; this.lessons = []; this.showQuizForm = false; this.showQuizForm2 = false; this.showFinalExamForm = false; }

  editCourse(course:any):void {
    this.router.navigate([],{relativeTo:this.route,queryParams:{tab:'create',courseId:course._id,step:1}});
  }

  courseTableError = '';
  courseActionLoading = false;
  deleteCourse(courseId: string): void {
    if(this.courseActionLoading) return;
    this.courseActionLoading = true; this.courseTableError = '';
    this.http.delete(`${this.apiUrl}/courses/${courseId}`).subscribe({
      next: () => { this.courseActionLoading = false; this.loadAllCourses(); },
      error: err => { this.courseActionLoading = false; this.courseTableError = err.error?.message || 'Unable to delete this course.'; }
    });
  }

  updateCourse(): void {
    if (!this.createdCourse) return;
    this.createCourseLoading = true;
    this.createCourseError = '';
    this.createCourseSuccess = '';

    const body = {
      title: this.newCourse.title,
      description: this.newCourse.description,
      tags: this.newCourse.tags,
      price: this.newCourse.price,
      category: this.newCourse.category
    };

    this.http.put(`${this.apiUrl}/courses/${this.createdCourse._id}`, body).subscribe({
      next: (data: any) => {
        this.createCourseLoading = false;
        this.createCourseSuccess = 'Course updated ! ';
        this.createdCourse = { ...this.createdCourse, ...body };
        setTimeout(() => this.createCourseSuccess = '', 3000);
      },
      error: (err) => {
        this.createCourseLoading = false;
        this.createCourseError = err.error?.message || 'Error updating course';
      }
    });
  }

  // ========== PROFILE ==========
  loadProfile(): void {
    this.profileLoading = true;
    this.http.get(`${this.apiUrl}/profile`).subscribe({
      next: (data: any) => {
        this.profile = data;
                this.authService.updateProfileSummary(data.user);
                this.currentUser = this.authService.getCurrentUser();
        this.profileData = {
          firstname: data.user?.firstname || '',
          lastname: data.user?.lastname || '',
          phone: data.user?.phone || '',
          address: data.user?.address || ''
        };
        this.profileLoading = false;
      },
      error: () => { this.profileLoading = false; }
    });
  }

  updateProfile(): void {
    this.profileUpdateLoading = true;
    this.profileUpdateError = '';
    this.profileUpdateSuccess = '';
    this.http.put(`${this.apiUrl}/profile/update`, this.profileData).subscribe({
      next: () => {
        this.profileUpdateLoading = false;
        this.profileUpdateSuccess = 'Profile updated ! ';
        this.loadProfile();
        setTimeout(() => this.profileUpdateSuccess = '', 3000);
      },
      error: (err) => {
        this.profileUpdateLoading = false;
        this.profileUpdateError = err.error?.message || 'Error updating profile';
      }
    });
  }

  changePassword(): void {
    if (!this.passwordData.currentPassword || !this.passwordData.newPassword) {
      this.passwordError = 'Please fill all fields !';
      return;
    }
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      this.passwordError = 'Passwords do not match !';
      return;
    }
    this.passwordLoading = true;
    this.passwordError = '';
    this.passwordSuccess = '';
    this.http.put(`${this.apiUrl}/auth/change-password`, {
      currentPassword: this.passwordData.currentPassword,
      newPassword: this.passwordData.newPassword
    }).subscribe({
      next: () => {
        this.passwordLoading = false;
        this.passwordSuccess = 'Password changed ! ';
        this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
        setTimeout(() => this.passwordSuccess = '', 3000);
      },
      error: (err) => {
        this.passwordLoading = false;
        this.passwordError = err.error?.message || 'Error changing password';
      }
    });
  }

  // ========== CREATE COURSE ==========
  onLessonFileSelected(event: any): void { this.lessonFile = event.target.files[0]; }

  createCourse(): void {
    this.createCourseLoading = true;
    this.createCourseError = '';
    this.createCourseSuccess = '';
    const body = {
      title: this.newCourse.title,
      description: this.newCourse.description,
      tags: this.newCourse.tags,
      price: this.newCourse.price,
      category: this.newCourse.category
    };
    this.http.post(`${this.apiUrl}/courses`, body).subscribe({
      next: (data: any) => {
        this.createCourseLoading = false;
        this.createCourseSuccess = 'Course created ! Now add lessons ';
        this.createdCourse = data.course;
        this.loadLessons(data.course._id);
      },
      error: (err) => {
        this.createCourseLoading = false;
        this.createCourseError = err.error?.message || 'Error creating course';
      }
    });
  }

  // ========== LESSONS ==========
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
        this.lessonSuccess = 'Lesson added ! ';
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

  // ========== QUIZ ==========
  openQuizForm(lessonId: string): void {
    this.selectedLessonId = lessonId;
    this.showQuizForm = true;
    this.showFinalExamForm = false;
    this.newQuiz = {
      noteMinimale: 70,
      questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
    };
    this.quizSuccess = '';
    this.quizError = '';
  }

  // ✅ Edit Quiz — pré-remplir
  editQuiz(lesson: any): void {
    this.selectedLessonId = lesson._id;
    this.showQuizForm = true;
    this.showFinalExamForm = false;
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

  // ✅ Delete Quiz
  deleteQuiz(lessonId: string): void {
    if (!confirm('Delete quiz from this lesson ?')) return;
    this.http.delete(`${this.apiUrl}/quiz/lesson/${lessonId}/delete`).subscribe({
      next: () => { this.loadLessons(this.createdCourse._id); },
      error: (err) => this.toast.show(err.error?.message || 'Error deleting quiz', 'error')
    });
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

    const emptyQ = this.newQuiz.questions.find(q => !q.texte.trim());
    if (emptyQ) { this.quizError = ' Please fill all question texts !'; return; }
    for (const q of this.newQuiz.questions) {
      if (q.options.filter(o => o.trim()).length < 2) {
        this.quizError = ' Each question must have at least 2 options !';
        return;
      }
    }

    this.quizLoading = true;
    this.http.post(`${this.apiUrl}/quiz/lesson/${this.selectedLessonId}`, this.newQuiz).subscribe({
      next: () => {
        this.quizLoading = false;
        this.quizSuccess = 'Quiz saved ! ';
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

  // ========== FINAL EXAM ==========
  openFinalExamForm(): void {
    this.showFinalExamForm = true;
    this.showQuizForm = false;
    this.newFinalExam = {
      noteMinimale: 70,
      questions: [{ texte: '', options: ['', '', '', ''], correctAnswer: 0 }]
    };
    this.finalExamSuccess = '';
    this.finalExamError = '';
  }

  // ✅ Edit Final Exam — pré-remplir
  editFinalExam(): void {
    this.showFinalExamForm = true;
    this.showQuizForm = false;
    this.http.get(`${this.apiUrl}/courses/${this.createdCourse._id}`).subscribe({
      next: (data: any) => {
        const exam = data.course?.finalExam || data.finalExam;
        if (exam?.questions?.length > 0) {
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

  addFinalExamQuestion(): void {
    this.newFinalExam.questions.push({ texte: '', options: ['', '', '', ''], correctAnswer: 0 });
  }

  removeFinalExamQuestion(index: number): void {
    this.newFinalExam.questions.splice(index, 1);
  }

  saveFinalExam(): void {
    this.finalExamError = '';
    this.finalExamSuccess = '';

    const emptyQ = this.newFinalExam.questions.find(q => !q.texte.trim());
    if (emptyQ) { this.finalExamError = ' Please fill all question texts !'; return; }

    this.finalExamLoading = true;
    this.http.post(`${this.apiUrl}/quiz/final/${this.createdCourse._id}`, this.newFinalExam).subscribe({
      next: () => {
        this.finalExamLoading = false;
        this.finalExamSuccess = 'Final exam saved ! ';
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

  // ✅ ========== QUIZ RESULTS ==========
  loadQuizResults(): void {
    this.quizResultsError = '';
    this.quizResultsLoading = true;
    this.http.get(`${this.apiUrl}/quiz/results/all`).subscribe({
      next: (data: any) => {
        this.quizResults = data.results || [];
        this.quizResultsLoading = false;
      },
      error: () => { this.quizResultsError = 'Unable to load assessment results. Please try again.'; this.quizResultsLoading = false; }
    });
  }

  private resultFilter=memoLast<any[]>();
  get filteredQuizResults(): any[] {
    return this.resultFilter([this.quizResults,this.quizResultsFilter],()=>this.quizResultsFilter==='all'?this.quizResults:this.quizResults.filter(r=>this.quizResultsFilter==='passed'?r.passed:!r.passed));
  }

  get passedCount(): number { return this.quizResults.filter(r => r.passed).length; }
  get failedCount(): number { return this.quizResults.filter(r => !r.passed).length; }

  // ========== HELPERS ==========
  getDropoutRate(item: any): number {
    if (!item.totalEnrollments) return 0;
    return Math.round(((item.totalEnrollments - item.completedEnrollments) / item.totalEnrollments) * 100);
  }

  getProgressBarColor(progress: number): string {
    if (progress >= 70) return 'bg-success';
    if (progress >= 30) return 'bg-warning';
    return 'bg-danger';
  }

  trackByIndex(index: number): number {
    return index;
  }

  // ========== EXPORT ==========
  exportPDF(): void {
    const doc = new jsPDF();
    doc.setFontSize(20); doc.setTextColor(44, 62, 80);
    doc.text('Trainer Performance Report', 14, 20);
    doc.setFontSize(12); doc.setTextColor(100);
    doc.text(`Trainer: ${this.currentUser?.firstname} ${this.currentUser?.lastname}`, 14, 30);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 14, 38);
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Value']],
      body: [
        ['Total Courses', this.stats.overview.totalCourses],
        ['Approved Courses', this.stats.overview.approvedCourses],
        ['Total Enrollments', this.stats.overview.totalEnrollments],
        ['Completion Rate', `${this.stats.overview.completionRate}%`],
      ],
      theme: 'grid', headStyles: { fillColor: [44, 62, 80] }
    });
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    autoTable(doc, {
      startY: finalY,
      head: [['Course', 'Students', 'Completed', 'Dropout', 'Progress', 'Revenue']],
      body: this.stats.courseStats.map((c: any) => [
        c.course.title, c.totalEnrollments, c.completedEnrollments,
        `${this.getDropoutRate(c)}%`, `${c.averageProgress}%`, `${c.revenue} TND`
      ]),
      theme: 'striped', headStyles: { fillColor: [52, 152, 219] }
    });
    doc.save(`trainer_report_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  exportExcel(): void {
    const overviewData = [
      ['Metric', 'Value'],
      ['Total Courses', this.stats.overview.totalCourses],
      ['Approved Courses', this.stats.overview.approvedCourses],
      ['Total Enrollments', this.stats.overview.totalEnrollments],
      ['Completion Rate', `${this.stats.overview.completionRate}%`],
    ];
    const coursesData = [
      ['Course', 'Status', 'Students', 'Completed', 'Dropout', 'Progress', 'Revenue'],
      ...this.stats.courseStats.map((c: any) => [
        c.course.title, c.course.isApproved ? 'Approved' : 'Pending',
        c.totalEnrollments, c.completedEnrollments,
        `${this.getDropoutRate(c)}%`, `${c.averageProgress}%`, `${c.revenue} TND`
      ])
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewData), 'Overview');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(coursesData), 'Courses');
    XLSX.writeFile(wb, `trainer_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  }


  logout(): void {
    if (!this.authService.logout()) return;
    this.router.navigate(['/profile-authentication']);
  }


  // ✅ Open Quiz 2 form
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

  // ✅ Edit Quiz 2 — pré-remplir
  editQuiz2(lesson: any): void {
    this.selectedLessonId2 = lesson._id;
    this.showQuizForm2 = true;
    this.showQuizForm = false;
    this.showFinalExamForm = false;
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
      next: () => { this.loadLessons(this.createdCourse._id); },
      error: (err) => this.toast.show(err.error?.message || 'Error deleting quiz 2', 'error')
    });
  }

  // ✅ Add question Quiz 2
  addQuizQuestion2(): void {
    this.newQuiz2.questions.push({ texte: '', options: ['', '', '', ''], correctAnswer: 0 });
  }

  // ✅ Remove question Quiz 2
  removeQuizQuestion2(index: number): void {
    this.newQuiz2.questions.splice(index, 1);
  }

  // ✅ Save Quiz 2
  saveQuiz2(): void {
    this.quizError2 = '';
    this.quizSuccess2 = '';

    const emptyQ = this.newQuiz2.questions.find(q => !q.texte.trim());
    if (emptyQ) { this.quizError2 = ' Please fill all question texts !'; return; }

    this.quizLoading2 = true;
    this.http.post(`${this.apiUrl}/quiz/lesson/${this.selectedLessonId2}/quiz2`, this.newQuiz2).subscribe({
      next: () => {
        this.quizLoading2 = false;
        this.quizSuccess2 = 'Quiz 2 saved ! ';
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

}
