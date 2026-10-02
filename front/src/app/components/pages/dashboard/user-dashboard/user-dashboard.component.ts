import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';
import { SocketService } from '../../../../services/socket.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.scss']
})
export class UserDashboardComponent implements OnInit, OnDestroy {

  activeTab = 'overview';
  currentUser: any;
  apiUrl = environment.apiUrl;

  // Profile
  profile: any = null;
  profileLoading = true;

  // Enrollments
  enrollments: any[] = [];
  enrollmentsLoading = false;

  // Badges
  badges: any[] = [];
  badgesLoading = false;

  // Certificates
  certificates: any[] = [];
  certificatesLoading = false;

  // ✅ Notifications
  notifications: any[] = [];
  unreadCount = 0;
  notificationsLoading = false;
  private notifSub: Subscription | null = null;

  // History
  history: any[] = [];
  purchases: any[] = [];
  historyLoading = false;

  profileData = { firstname: '', lastname: '', phone: '', address: '' };
  profileUpdateLoading = false;
  profileUpdateSuccess = '';
  profileUpdateError = '';
  selectedAvatar: File | null = null;
  avatarPreview: string | null = null;

  passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
  passwordLoading = false;
  passwordSuccess = '';
  passwordError = '';

  tabs = [
    { id: 'overview', icon: '📊', label: 'Vue d\'ensemble' },
    { id: 'courses', icon: '📚', label: 'Mes cours' },
    { id: 'history', icon: '📜', label: 'Historique' },
    { id: 'badges', icon: '🏅', label: 'Badges' },
    { id: 'certificates', icon: '🎓', label: 'Certificats' },
    { id: 'notifications', icon: '🔔', label: 'Notifications' },
    { id: 'profile', icon: '👤', label: 'Profil' }
  ];

  constructor(
    private authService: AuthService,
    private socketService: SocketService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    // ✅ Connexion Socket.io
    this.socketService.connect();

    // ✅ Écoute des notifications en temps réel
    this.notifSub = this.socketService.notification$.subscribe((notif: any) => {
      if (notif) {
        // ✅ Ajouter en tête de liste
        this.notifications.unshift({
          ...notif,
          isRead: false,
          createdAt: new Date()
        });
        this.unreadCount++;

        // ✅ Jouer un son de notification
        this.playNotificationSound();

        // ✅ Afficher une toast notification
        this.showToast(notif);
      }
    });

    // ✅ Lire le tab depuis les queryParams
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'] || 'overview';
      const section = params['section'] || '';
      this.activeTab = tab;
      this.setTab(tab);

      if (section === 'password') {
        setTimeout(() => {
          const el = document.getElementById('password-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      }
    });

    this.loadProfile();
    // ✅ Charger le count des notifications dès le début
    this.loadUnreadCount();
  }

  ngOnDestroy(): void {
    this.notifSub?.unsubscribe();
  }

  // ✅ Son de notification
  playNotificationSound(): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.log('Audio not supported');
    }
  }

  // ✅ Toast notification
  toastNotif: any = null;
  showToastVisible = false;

  showToast(notif: any): void {
    this.toastNotif = notif;
    this.showToastVisible = true;
    setTimeout(() => {
      this.showToastVisible = false;
      this.toastNotif = null;
    }, 4000);
  }

  // ✅ Charger uniquement le count
  loadUnreadCount(): void {
    this.http.get<any>(`${this.apiUrl}/notifications`).subscribe({
      next: (data) => {
        this.unreadCount = data.unreadCount || 0;
        // ✅ Merge avec les notifs temps réel déjà reçues
        const rtIds = this.notifications.map((n: any) => n._id);
        const dbNotifs = (data.notifications || []).filter(
          (n: any) => !rtIds.includes(n._id)
        );
        this.notifications = [...this.notifications, ...dbNotifs];
      },
      error: () => {}
    });
  }

  loadProfile(): void {
    this.profileLoading = true;
    this.http.get(`${this.apiUrl}/profile`).subscribe({
      next: (data: any) => {
        this.profile = data;
        this.avatarPreview = null;
        this.profileData.firstname = data.user?.firstname || '';
        this.profileData.lastname = data.user?.lastname || '';
        this.profileData.phone = data.user?.phone || '';
        this.profileData.address = data.user?.address || '';
        this.profileLoading = false;
      },
      error: () => { this.profileLoading = false; }
    });
  }

  onAvatarSelected(event: any): void {
    this.selectedAvatar = event.target.files[0];
    if (this.selectedAvatar) {
      const reader = new FileReader();
      reader.onload = (e: any) => { this.avatarPreview = e.target.result; };
      reader.readAsDataURL(this.selectedAvatar);
    }
  }

  updateProfile(): void {
    this.profileUpdateLoading = true;
    this.profileUpdateError = '';
    this.profileUpdateSuccess = '';
    this.http.put(`${this.apiUrl}/profile`, this.profileData).subscribe({
      next: () => {
        this.profileUpdateLoading = false;
        this.profileUpdateSuccess = 'Profil mis à jour ! ✅';
        this.loadProfile();
        setTimeout(() => this.profileUpdateSuccess = '', 3000);
      },
      error: (err) => {
        this.profileUpdateLoading = false;
        this.profileUpdateError = err.error?.message || 'Erreur';
      }
    });
  }

  updateAvatar(): void {
    if (!this.selectedAvatar) return;
    const formData = new FormData();
    formData.append('avatar', this.selectedAvatar);
    this.http.put(`${this.apiUrl}/profile/avatar`, formData).subscribe({
      next: (res: any) => {
        this.profileUpdateSuccess = 'Avatar mis à jour ! ✅';
        this.selectedAvatar = null;
        this.avatarPreview = null;
        const user = this.authService.getCurrentUser();
        if (user) {
          user.avatar = res.user.avatar;
          localStorage.setItem('user', JSON.stringify(user));
        }
        this.loadProfile();
        setTimeout(() => this.profileUpdateSuccess = '', 3000);
      },
      error: (err) => {
        this.profileUpdateError = err.error?.message || 'Erreur avatar';
      }
    });
  }

  setTab(tab: string): void {
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });

    if (tab === 'overview') { this.loadProfile(); this.loadEnrollments(); this.loadBadges(); }
    if (tab === 'courses') this.loadEnrollments();
    if (tab === 'badges') this.loadBadges();
    if (tab === 'certificates') this.loadCertificates();
    if (tab === 'notifications') this.loadNotifications();
    if (tab === 'history') this.loadHistory();
    if (tab === 'profile') this.loadProfile();
  }

  loadEnrollments(): void {
    this.enrollmentsLoading = true;
    this.http.get(`${this.apiUrl}/enrollments/me`).subscribe({
      next: (data: any) => {
        this.enrollments = Array.isArray(data) ? data : [];
        this.enrollmentsLoading = false;
      },
      error: () => { this.enrollments = []; this.enrollmentsLoading = false; }
    });
  }

  loadBadges(): void {
    this.badgesLoading = true;
    this.http.get(`${this.apiUrl}/badges/my-badges`).subscribe({
      next: (data: any) => { this.badges = data; this.badgesLoading = false; },
      error: () => { this.badgesLoading = false; }
    });
  }

  loadCertificates(): void {
    this.certificatesLoading = true;
    this.http.get(`${this.apiUrl}/certificates/me`).subscribe({
      next: (data: any) => { this.certificates = data; this.certificatesLoading = false; },
      error: () => { this.certificatesLoading = false; }
    });
  }

  // ✅ Charger notifications depuis l'API
  loadNotifications(): void {
    this.notificationsLoading = true;
    this.http.get<any>(`${this.apiUrl}/notifications`).subscribe({
      next: (data) => {
        // ✅ Merge notifs temps réel + notifs DB sans doublons
        const rtIds = this.notifications
          .filter((n: any) => !n._id)
          .map((n: any) => n.tempId);

        const dbNotifs = data.notifications || [];
        const rtOnly = this.notifications.filter((n: any) => !n._id);

        this.notifications = [...rtOnly, ...dbNotifs];
        this.unreadCount = data.unreadCount + rtOnly.length;
        this.notificationsLoading = false;
      },
      error: () => { this.notificationsLoading = false; }
    });
  }

  markAsRead(notificationId: string): void {
    this.http.patch(`${this.apiUrl}/notifications/${notificationId}/read`, {}).subscribe({
      next: () => {
        const notif = this.notifications.find(n => n._id === notificationId);
        if (notif) { notif.isRead = true; this.unreadCount = Math.max(0, this.unreadCount - 1); }
      },
      error: () => {}
    });
  }

  markAllAsRead(): void {
    this.http.patch(`${this.apiUrl}/notifications/read-all`, {}).subscribe({
      next: () => {
        this.notifications.forEach(n => n.isRead = true);
        this.unreadCount = 0;
      },
      error: () => {}
    });
  }

  loadHistory(): void {
    this.historyLoading = true;
    this.http.get(`${this.apiUrl}/enrollments/me`).subscribe({
      next: (data: any) => { this.history = Array.isArray(data) ? data : []; this.historyLoading = false; },
      error: () => { this.history = []; this.historyLoading = false; }
    });
    this.http.get(`${this.apiUrl}/purchases/me`).subscribe({
      next: (data: any) => { this.purchases = Array.isArray(data) ? data : []; },
      error: () => { this.purchases = []; }
    });
  }

  getNotifIcon(type: string): string {
    const icons: any = {
      'BADGE_EARNED': '🏅',
      'NEW_COURSE': '📚',
      'DEADLINE_REMINDER': '⏰',
      'CERTIFICATE': '🎓',
      'COURSE_ASSIGNED': '📋',
      'QUIZ_PASSED': '✅'
    };
    return icons[type] || '🔔';
  }

  getAverageProgress(): number {
    if (!this.enrollments.length) return 0;
    return Math.round(this.enrollments.reduce((acc, e) => acc + e.progress, 0) / this.enrollments.length);
  }

  getCompletedCourses(): number {
    return this.enrollments.filter(e => e.completed).length;
  }

  exportExcel(): void {
    const data = [
      ['Course', 'Progress', 'Completed'],
      ...this.enrollments.map(e => [e.course?.title || 'N/A', `${e.progress}%`, e.completed ? 'Yes' : 'No'])
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'My Progress');
    XLSX.writeFile(wb, `my_progress_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  goToCourses(): void { this.router.navigate(['/courses-grid']); }
  goToCourse(courseId: string): void { this.router.navigate(['/course', courseId]); }

  changePassword(): void {
    this.passwordError = '';
    this.passwordSuccess = '';
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      this.passwordError = 'Les mots de passe ne correspondent pas !';
      return;
    }
    const regex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!regex.test(this.passwordData.newPassword)) {
      this.passwordError = 'Min 8 caractères, 1 majuscule, 1 chiffre !';
      return;
    }
    this.passwordLoading = true;
    this.http.post(`${this.apiUrl}/auth/change-password`, {
      currentPassword: this.passwordData.currentPassword,
      newPassword: this.passwordData.newPassword
    }).subscribe({
      next: () => {
        this.passwordLoading = false;
        this.passwordSuccess = 'Mot de passe changé ! ✅';
        this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
        setTimeout(() => this.passwordSuccess = '', 3000);
      },
      error: (err) => {
        this.passwordLoading = false;
        this.passwordError = err.error?.message || 'Erreur';
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/profile-authentication']);
  }
}