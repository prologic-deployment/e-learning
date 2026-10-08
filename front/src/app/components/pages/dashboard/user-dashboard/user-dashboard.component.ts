import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { plainSystemText } from '../../../../services/system-text';
import { Component, OnInit, OnDestroy, DestroyRef, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';
import { SocketService } from '../../../../services/socket.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { Observable, finalize, shareReplay, forkJoin, Subscription } from 'rxjs';
import * as XLSX from 'xlsx';

@Component({
    selector: 'app-user-dashboard',
    templateUrl: './user-dashboard.component.html',
    styleUrls: ['./user-dashboard.component.scss'],
})
export class UserDashboardComponent implements OnInit, OnDestroy {
    private readonly destroyRef=inject(DestroyRef);
    private readonly inflight=new Map<string,Observable<any>>();
    private read(path:string):Observable<any>{
        const existing=this.inflight.get(path);if(existing)return existing;
        const result=this.http.get<any>(`${this.apiUrl}/${path}`).pipe(takeUntilDestroyed(this.destroyRef),finalize(()=>this.inflight.delete(path)),shareReplay({bufferSize:1,refCount:true}));
        this.inflight.set(path,result);return result;
    }
    readonly systemText = plainSystemText;
    certificateDownloading = '';
    downloadCertificate(c: any) {
        if (!c.isValid || this.certificateDownloading) return;
        this.certificateDownloading = c._id;
        this.errors['certificates'] = '';
        this.http
            .get(`${this.apiUrl}/files/certificate/${c._id}`, { responseType: 'blob' })
            .subscribe({
                next: (blob) => {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'certificate.pdf';
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    this.certificateDownloading = '';
                },
                error: () => {
                    this.certificateDownloading = '';
                    this.errors['certificates'] =
                        'Unable to download this certificate. Please try again.';
                },
            });
    }
    courseQuery = '';
    courseStatus = 'all';
    errors: Record<string, string> = {};
    get sectionTitle() {
        return (
            (
                {
                    courses: 'My learning',
                    badges: 'Your achievements',
                    certificates: 'Your credentials',
                    notifications: 'Your activity',
                    history: 'Learning history',
                    profile: 'Your account',
                } as Record<string, string>
            )[this.activeTab] || 'Your learning'
        );
    }
    get filteredEnrollments() {
        return this.enrollments.filter(
            (e) =>
                (e.course?.title || '').toLowerCase().includes(this.courseQuery.toLowerCase()) &&
                (this.courseStatus === 'all' ||
                    (this.courseStatus === 'complete' ? e.completed : !e.completed)),
        );
    }
    get upcoming() {
        return this.enrollments
            .filter((e) => e.deadline && !e.completed)
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
            .slice(0, 4);
    }
    assetUrl(path: string) {
        return /^https?:\/\//.test(path) ? path : environment.backendUrl + path;
    }
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
        { id: 'overview', icon: 'bx bx-bar-chart-alt-2', label: "Vue d'ensemble" },
        { id: 'courses', icon: 'bx bx-book-open', label: 'Mes cours' },
        { id: 'history', icon: 'bx bx-history', label: 'Historique' },
        { id: 'badges', icon: 'bx bx-medal', label: 'Badges' },
        { id: 'certificates', icon: 'bx bx-graduation', label: 'Certificats' },
        { id: 'notifications', icon: 'bx bx-bell', label: 'Notifications' },
        { id: 'profile', icon: 'bx bx-user', label: 'Profil' },
    ];

    constructor(
        private authService: AuthService,
        private socketService: SocketService,
        private http: HttpClient,
        private router: Router,
        private route: ActivatedRoute,
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
                    createdAt: new Date(),
                });
                this.unreadCount++;

                // ✅ Jouer un son de notification
                this.playNotificationSound();

                // ✅ Afficher une toast notification
                // The root notification outlet owns realtime toasts.
            }
        });

        // ✅ Lire le tab depuis les queryParams
        this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
            const requested = params['tab'] || 'overview';
            const tab = this.tabs.some((t) => t.id === requested) ? requested : 'overview';
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

        // ✅ Charger le count des notifications dès le début
        if (this.activeTab !== 'notifications') this.loadUnreadCount();
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
    // ✅ Charger uniquement le count
    loadUnreadCount(): void {
        this.read('notifications').subscribe({
            next: (data) => {
                this.unreadCount = data.unreadCount || 0;
                // ✅ Merge avec les notifs temps réel déjà reçues
                const rtIds = this.notifications.map((n: any) => n._id);
                const dbNotifs = (data.notifications || []).filter(
                    (n: any) => !rtIds.includes(n._id),
                );
                this.notifications = [...this.notifications, ...dbNotifs];
            },
            error: () => {},
        });
    }

    loadProfile(): void {
        this.errors['profile'] = '';
        this.profileLoading = true;
        this.read('profile').subscribe({
            next: (data: any) => {
                this.profile = data;
                this.avatarPreview = null;
                this.profileData.firstname = data.user?.firstname || '';
                this.profileData.lastname = data.user?.lastname || '';
                this.profileData.phone = data.user?.phone || '';
                this.profileData.address = data.user?.address || '';
                this.profileLoading = false;
            },
            error: () => {
                this.errors['profile'] = 'Unable to retrieve this information. Please try again.';
                this.profileLoading = false;
            },
        });
    }

    onAvatarSelected(event: any): void {
        this.selectedAvatar = event.target.files[0];
        if (this.selectedAvatar) {
            const reader = new FileReader();
            reader.onload = (e: any) => {
                this.avatarPreview = e.target.result;
            };
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
                this.profileUpdateSuccess = 'Profil mis à jour ! ';
                this.loadProfile();
                setTimeout(() => (this.profileUpdateSuccess = ''), 3000);
            },
            error: (err) => {
                this.profileUpdateLoading = false;
                this.profileUpdateError = err.error?.message || 'Erreur';
            },
        });
    }

    updateAvatar(): void {
        if (!this.selectedAvatar) return;
        const formData = new FormData();
        formData.append('avatar', this.selectedAvatar);
        this.http.put(`${this.apiUrl}/profile/avatar`, formData).subscribe({
            next: (res: any) => {
                this.profileUpdateSuccess = 'Avatar mis à jour ! ';
                this.selectedAvatar = null;
                this.avatarPreview = null;
                const user = this.authService.getCurrentUser();
                if (user) {
                    user.avatar = res.user.avatar;
                    localStorage.setItem('user', JSON.stringify(user));
                }
                this.loadProfile();
                setTimeout(() => (this.profileUpdateSuccess = ''), 3000);
            },
            error: (err) => {
                this.profileUpdateError = err.error?.message || 'Erreur avatar';
            },
        });
    }

    setTab(tab: string): void {
        if ((this.route.snapshot.queryParams['tab'] || 'overview') !== tab) {
            this.router.navigate([], {relativeTo:this.route,queryParams:{tab},queryParamsHandling:'merge',replaceUrl:true});
            return;
        }
        this.activeTab = tab;

        if (tab === 'overview') {
            this.loadEnrollments();
            this.loadBadges();
        }
        if (tab === 'courses') this.loadEnrollments();
        if (tab === 'badges') this.loadBadges();
        if (tab === 'certificates') this.loadCertificates();
        if (tab === 'notifications') this.loadNotifications();
        if (tab === 'history') this.loadHistory();
        if (tab === 'profile') this.loadProfile();
    }

    loadEnrollments(): void {
        this.errors['courses'] = '';
        this.enrollmentsLoading = true;
        this.read('enrollments/me').subscribe({
            next: (data: any) => {
                this.enrollments = Array.isArray(data) ? data : [];
                this.enrollmentsLoading = false;
            },
            error: () => {
                this.errors['courses'] = 'We could not retrieve your courses. Please try again.';
                this.enrollmentsLoading = false;
            },
        });
    }

    loadBadges(): void {
        this.errors['badges'] = '';
        this.badgesLoading = true;
        this.http.get(`${this.apiUrl}/badges/my-badges`).subscribe({
            next: (data: any) => {
                this.badges = data;
                this.badgesLoading = false;
            },
            error: () => {
                this.errors['badges'] = 'Unable to retrieve this information. Please try again.';
                this.badgesLoading = false;
            },
        });
    }

    loadCertificates(): void {
        this.errors['certificates'] = '';
        this.certificatesLoading = true;
        this.http.get(`${this.apiUrl}/certificates/me`).subscribe({
            next: (data: any) => {
                this.certificates = data;
                this.certificatesLoading = false;
            },
            error: () => {
                this.errors['certificates'] =
                    'Unable to retrieve this information. Please try again.';
                this.certificatesLoading = false;
            },
        });
    }

    // ✅ Charger notifications depuis l'API
    loadNotifications(): void {
        this.errors['notifications'] = '';
        this.notificationsLoading = true;
        this.read('notifications').subscribe({
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
            error: () => {
                this.errors['notifications'] =
                    'Unable to retrieve this information. Please try again.';
                this.notificationsLoading = false;
            },
        });
    }

    markAsRead(notificationId: string): void {
        this.http.patch(`${this.apiUrl}/notifications/${notificationId}/read`, {}).subscribe({
            next: () => {
                const notif = this.notifications.find((n) => n._id === notificationId);
                if (notif) {
                    notif.isRead = true;
                    this.unreadCount = Math.max(0, this.unreadCount - 1);
                }
            },
            error: () => {},
        });
    }

    markAllAsRead(): void {
        this.http.patch(`${this.apiUrl}/notifications/read-all`, {}).subscribe({
            next: () => {
                this.notifications.forEach((n) => (n.isRead = true));
                this.unreadCount = 0;
            },
            error: () => {},
        });
    }

    loadHistory(): void {
        this.errors['history']='';this.historyLoading=true;
        forkJoin({enrollments:this.read('enrollments/me'),purchases:this.read('purchases/me')}).subscribe({
            next:({enrollments,purchases})=>{this.history=Array.isArray(enrollments)?enrollments:[];this.purchases=Array.isArray(purchases)?purchases:[];this.historyLoading=false;},
            error:()=>{this.errors['history']='Unable to load your learning history. Please try again.';this.historyLoading=false;}
        });
    }

    getNotifIcon(type: string): string {
        const icons: any = {
            BADGE_EARNED: 'bx bx-medal',
            NEW_COURSE: 'bx bx-book-open',
            DEADLINE_REMINDER: 'bx bx-time',
            CERTIFICATE: 'bx bx-graduation',
            COURSE_ASSIGNED: 'bx bx-task',
            QUIZ_PASSED: 'bx bx-check-circle',
        };
        return icons[type] || 'bx bx-bell';
    }

    getAverageProgress(): number {
        if (!this.enrollments.length) return 0;
        return Math.round(
            this.enrollments.reduce((acc, e) => acc + (Number(e.progress) || 0), 0) /
                this.enrollments.length,
        );
    }

    getCompletedCourses(): number {
        return this.enrollments.filter((e) => e.completed).length;
    }

    // ✅ The course the learner should resume (first in-progress, else most recent)
    getContinueCourse(): any {
        if (!this.enrollments || !this.enrollments.length) return null;
        return (
            this.enrollments.find((e) => e.course?._id && !e.completed) ||
            this.enrollments.find((e) => e.course?._id)
        );
    }

    exportExcel(): void {
        const data = [
            ['Course', 'Progress', 'Completed'],
            ...this.enrollments.map((e) => [
                e.course?.title || 'N/A',
                `${e.progress}%`,
                e.completed ? 'Yes' : 'No',
            ]),
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'My Progress');
        XLSX.writeFile(wb, `my_progress_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    goToCourses(): void {
        this.router.navigate(['/courses-grid']);
    }
    goToCourse(courseId: string): void {
        this.router.navigate(['/course', courseId]);
    }

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
        this.http
            .post(`${this.apiUrl}/auth/change-password`, {
                currentPassword: this.passwordData.currentPassword,
                newPassword: this.passwordData.newPassword,
            })
            .subscribe({
                next: () => {
                    this.passwordLoading = false;
                    this.passwordSuccess = 'Mot de passe changé ! ';
                    this.passwordData = {
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                    };
                    setTimeout(() => (this.passwordSuccess = ''), 3000);
                },
                error: (err) => {
                    this.passwordLoading = false;
                    this.passwordError = err.error?.message || 'Erreur';
                },
            });
    }

    logout(): void {
        if (!this.authService.logout()) return;
        this.router.navigate(['/profile-authentication']);
    }
}
