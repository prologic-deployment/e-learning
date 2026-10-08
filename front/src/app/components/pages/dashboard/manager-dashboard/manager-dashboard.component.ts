import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';
import { StatsService } from '../../../../services/stats.service';
import { CourseService } from '../../../../services/course.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-manager-dashboard',
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.scss']
})
export class ManagerDashboardComponent implements OnInit {

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  activeTab: string = 'stats';
  currentUser: any;
  apiUrl = environment.apiUrl;

  // Stats
  stats: any = null;
  statsLoading = false;
  statsError = '';

  // Team
  teamStats: any[] = [];
  overdueEnrollments: any[] = [];

  // Assign Course
  courses: any[] = [];
  teamMembers: any[] = [];
  selectedCourseId = '';
  selectedUserIds: string[] = [];
  assignLoading = false;
  assignSuccess = '';
  assignError = '';

  // Deadline
  selectedEnrollmentId = '';
  selectedDeadline = '';
  deadlineSuccess = '';
  deadlineError = '';
  assignDeadline = '';
  today = new Date().toISOString().split('T')[0];

  // Filtres
  filterMember = '';
  filterDateFrom = '';
  filterDateTo = '';
  filteredTeamStats: any[] = [];

  // ✅ Profile
  profile: any = null;
  profileLoading = false;
  profileData = { firstname: '', lastname: '', phone: '', address: '' };
  profileUpdateLoading = false;
  profileUpdateSuccess = '';
  profileUpdateError = '';
  selectedAvatar: File | null = null;
  avatarPreview: string | null = null;

  // ✅ Password
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
      this.router.navigate([], {relativeTo:this.route,queryParams:{tab},queryParamsHandling:'merge',replaceUrl:true});
      return;
    }
    this.activeTab = tab;
    if ((tab === 'stats' || tab === 'overdue') && !this.stats && !this.statsLoading) this.loadStats();
    if (tab === 'assign' && this.courses.length === 0) {
      this.loadCourses();
      this.loadTeamMembers();
    }
    if (tab === 'profile') this.loadProfile();
  }

  // ========== STATS ==========
  loadStats(): void {
    this.statsError = '';
    this.statsLoading = true;
    this.statsService.getManagerStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.teamStats = data.memberStats;
        this.filteredTeamStats = data.memberStats;
        this.overdueEnrollments = data.overdueEnrollments;
        this.statsLoading = false;
      },
      error: (err) => {
        this.statsError = err.error?.message || 'Error loading stats';
        this.statsLoading = false;
      }
    });
  }

  applyFilters(): void {
    this.filteredTeamStats = this.teamStats.filter((member: any) => {
      if (this.filterMember) {
        const fullName = `${member.user.firstname} ${member.user.lastname}`.toLowerCase();
        if (!fullName.includes(this.filterMember.toLowerCase())) return false;
      }
      return true;
    });
  }

  resetFilters(): void {
    this.filterMember = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.filteredTeamStats = this.teamStats;
  }

  // ========== ASSIGN COURSE ==========
  loadCourses(): void {
    this.courseService.getAllCourses({ type: 'free' }).subscribe({
      next: (data) => { this.courses = data.courses; },
      error: () => {}
    });
  }

  loadTeamMembers(): void {
    this.http.get(`${this.apiUrl}/managers/team`).subscribe({
      next: (data: any) => { this.teamMembers = data; },
      error: () => {}
    });
  }

  toggleUserSelection(userId: string): void {
    const index = this.selectedUserIds.indexOf(userId);
    if (index === -1) this.selectedUserIds.push(userId);
    else this.selectedUserIds.splice(index, 1);
  }

  isSelected(userId: string): boolean {
    return this.selectedUserIds.includes(userId);
  }

  assignCourse(): void {
    if (!this.selectedCourseId || this.selectedUserIds.length === 0) {
      this.assignError = 'Please select a course and at least one user !';
      return;
    }
    this.assignLoading = true;
    this.assignError = '';
    this.assignSuccess = '';

    this.http.post(`${this.apiUrl}/managers/assign-course`, {
      courseId: this.selectedCourseId,
      userIds: this.selectedUserIds,
      deadline: this.assignDeadline || null
    }).subscribe({
      next: () => {
        this.assignLoading = false;
        this.assignSuccess = 'Course assigned successfully ! ';
        this.selectedCourseId = '';
        this.selectedUserIds = [];
        this.assignDeadline = '';
      },
      error: (err) => {
        this.assignLoading = false;
        this.assignError = err.error?.message || 'Error assigning course';
      }
    });
  }

  // ========== DEADLINE ==========
  setDeadline(enrollmentId: string): void {
    if (!this.selectedDeadline) {
      this.deadlineError = 'Please select a deadline !';
      return;
    }
    this.http.patch(`${this.apiUrl}/enrollments/deadline`, {
      enrollmentId,
      deadline: this.selectedDeadline
    }).subscribe({
      next: () => {
        this.deadlineSuccess = 'Deadline set successfully ! ';
        this.loadStats();
      },
      error: (err) => {
        this.deadlineError = err.error?.message || 'Error setting deadline';
      }
    });
  }

  // ========== PROFILE ==========
  loadProfile(): void {
    this.profileLoading = true;
    this.http.get(`${this.apiUrl}/profile`).subscribe({
      next: (data: any) => {
        this.profile = data;
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

    this.http.put(`${this.apiUrl}/profile`, this.profileData).subscribe({
      next: () => {
        this.profileUpdateLoading = false;
        this.profileUpdateSuccess = 'Profile updated successfully ! ';
        this.loadProfile();
        setTimeout(() => this.profileUpdateSuccess = '', 3000);
      },
      error: (err) => {
        this.profileUpdateLoading = false;
        this.profileUpdateError = err.error?.message || 'Error updating profile';
      }
    });
  }

  onAvatarSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedAvatar = file;
      const reader = new FileReader();
      reader.onload = (e: any) => { this.avatarPreview = e.target.result; };
      reader.readAsDataURL(file);
    }
  }

  updateAvatar(): void {
    if (!this.selectedAvatar) return;
    const formData = new FormData();
    formData.append('avatar', this.selectedAvatar);

    this.http.put(`${this.apiUrl}/profile/avatar`, formData).subscribe({
      next: () => {
        this.profileUpdateSuccess = 'Avatar updated ! ';
        this.loadProfile();
        this.selectedAvatar = null;
        this.avatarPreview = null;
        setTimeout(() => this.profileUpdateSuccess = '', 3000);
      },
      error: (err) => {
        this.profileUpdateError = err.error?.message || 'Error updating avatar';
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
        this.passwordSuccess = 'Password changed successfully ! ';
        this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
        setTimeout(() => this.passwordSuccess = '', 3000);
      },
      error: (err) => {
        this.passwordLoading = false;
        this.passwordError = err.error?.message || 'Error changing password';
      }
    });
  }

  logout(): void {
    if (!this.authService.logout()) return;
    this.router.navigate(['/profile-authentication']);
  }

  exportPDF(): void {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(44, 62, 80);
    doc.text('Team Performance Report', 14, 20);
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Manager: ${this.currentUser?.firstname} ${this.currentUser?.lastname}`, 14, 30);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 14, 38);
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Value']],
      body: [
        ['Team Size', this.stats.overview.teamSize],
        ['Total Enrollments', this.stats.overview.totalEnrollments],
        ['Completed Enrollments', this.stats.overview.completedEnrollments],
        ['Completion Rate', `${this.stats.overview.completionRate}%`],
        ['Average Progress', `${this.stats.overview.averageProgress}%`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [44, 62, 80] }
    });
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    autoTable(doc, {
      startY: finalY,
      head: [['Member', 'Email', 'Courses', 'Completed', 'Progress']],
      body: this.filteredTeamStats.map(member => [
        `${member.user.firstname} ${member.user.lastname}`,
        member.user.email,
        member.totalCourses,
        member.completedCourses,
        `${member.averageProgress}%`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [52, 152, 219] }
    });
    doc.save(`team_report_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  exportExcel(): void {
    const overviewData = [
      ['Metric', 'Value'],
      ['Team Size', this.stats.overview.teamSize],
      ['Total Enrollments', this.stats.overview.totalEnrollments],
      ['Completed Enrollments', this.stats.overview.completedEnrollments],
      ['Completion Rate', `${this.stats.overview.completionRate}%`],
      ['Average Progress', `${this.stats.overview.averageProgress}%`],
    ];
    const teamData = [
      ['Member', 'Email', 'Courses', 'Completed', 'Progress'],
      ...this.filteredTeamStats.map(m => [
        `${m.user.firstname} ${m.user.lastname}`,
        m.user.email, m.totalCourses, m.completedCourses, `${m.averageProgress}%`
      ])
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewData), 'Overview');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(teamData), 'Team Progress');
    XLSX.writeFile(wb, `team_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
}
