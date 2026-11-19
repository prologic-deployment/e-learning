import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { SocketService } from '../../../services/socket.service';
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { COURSE_CATEGORIES, CourseCategory } from '../../../shared/categories';

/** One entry of the signed-in user menu */
interface MenuItem {
  label: string;
  icon: string;          // Boxicons class
  route: string;
  tab?: string;          // ?tab= query param for dashboards
  badge?: 'unread';      // show the unread notification count
}

/** Menu entries per role — rendered by the user dropdown */
const ROLE_MENUS: { [role: string]: { title: string; items: MenuItem[] }[] } = {
  user: [
    { title: 'Learning', items: [
      { label: 'Dashboard', icon: 'bx bx-grid-alt', route: '/dashboard', tab: 'overview' },
      { label: 'My courses', icon: 'bx bx-book-open', route: '/dashboard', tab: 'courses' },
      { label: 'Certificates', icon: 'bx bx-award', route: '/dashboard', tab: 'certificates' },
      { label: 'Badges', icon: 'bx bx-medal', route: '/dashboard', tab: 'badges' },
      { label: 'History', icon: 'bx bx-history', route: '/dashboard', tab: 'history' }
    ]},
    { title: 'Account', items: [
      { label: 'Notifications', icon: 'bx bx-bell', route: '/dashboard', tab: 'notifications', badge: 'unread' },
      { label: 'My CV', icon: 'bx bx-id-card', route: '/cv' },
      { label: 'Cart', icon: 'bx bx-cart', route: '/cart' },
      { label: 'Profile & settings', icon: 'bx bx-cog', route: '/dashboard', tab: 'profile' }
    ]}
  ],
  admin: [
    { title: 'Platform', items: [
      { label: 'Statistics', icon: 'bx bx-bar-chart-alt-2', route: '/admin-dashboard', tab: 'stats' },
      { label: 'Users', icon: 'bx bx-group', route: '/admin-dashboard', tab: 'users' },
      { label: 'Courses', icon: 'bx bx-book-open', route: '/admin-dashboard', tab: 'courses' },
      { label: 'Create course', icon: 'bx bx-plus-circle', route: '/admin-dashboard', tab: 'create' }
    ]},
    { title: 'Management', items: [
      { label: 'Trainer requests', icon: 'bx bx-user-check', route: '/admin-dashboard', tab: 'trainers' },
      { label: 'Reviews', icon: 'bx bx-message-square-dots', route: '/admin-dashboard', tab: 'reviews' },
      { label: 'Assign users', icon: 'bx bx-transfer-alt', route: '/admin-dashboard', tab: 'assign' },
      { label: 'Create staff', icon: 'bx bx-user-plus', route: '/admin-dashboard', tab: 'staff' },
      { label: 'Quiz results', icon: 'bx bx-task', route: '/admin-dashboard', tab: 'quiz-results' }
    ]}
  ],
  trainer: [
    { title: 'Teaching', items: [
      { label: 'Statistics', icon: 'bx bx-bar-chart-alt-2', route: '/trainer-dashboard', tab: 'stats' },
      { label: 'My courses', icon: 'bx bx-book-open', route: '/trainer-dashboard', tab: 'courses' },
      { label: 'Create course', icon: 'bx bx-plus-circle', route: '/trainer-dashboard', tab: 'create' },
      { label: 'Quiz results', icon: 'bx bx-task', route: '/trainer-dashboard', tab: 'quiz-results' }
    ]},
    { title: 'Account', items: [
      { label: 'Profile & settings', icon: 'bx bx-cog', route: '/trainer-dashboard', tab: 'profile' }
    ]}
  ],
  manager: [
    { title: 'My team', items: [
      { label: 'Team statistics', icon: 'bx bx-bar-chart-alt-2', route: '/manager-dashboard', tab: 'stats' },
      { label: 'Assign courses', icon: 'bx bx-transfer-alt', route: '/manager-dashboard', tab: 'assign' },
      { label: 'Overdue', icon: 'bx bx-time-five', route: '/manager-dashboard', tab: 'overdue' }
    ]},
    { title: 'Account', items: [
      { label: 'Profile & settings', icon: 'bx bx-cog', route: '/manager-dashboard', tab: 'profile' }
    ]}
  ]
};

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {

  showUserMenu = false;
  showGuestMenu = false;
  showCategoryMenu = false;
  /** Category highlighted in the mega menu (drives the subcategory column) */
  readonly menuCategories: CourseCategory[] = COURSE_CATEGORIES;
  activeCategory: CourseCategory = COURSE_CATEGORIES[0];
  classApplied = false;
  isSticky: boolean = false;
  currentUser: any = null;

  searchQuery = '';
  suggestions: string[] = [];
  showSuggestions = false;
  searchSubject = new Subject<string>();
  apiUrl = environment.apiUrl;
  backendUrl = environment.backendUrl;

  // ✅ Notifications temps réel
  realtimeNotifications: any[] = [];
  showNotifPanel = false;
  private notifSub: Subscription | null = null;
  private userSub: Subscription | null = null;

  constructor(
    public router: Router,
    private authService: AuthService,
    private socketService: SocketService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // keep the header in sync when the profile (e.g. avatar) changes
    this.userSub = this.authService.currentUser$.subscribe(u => this.currentUser = u);
    // ✅ Ajoute ça au début
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      if (query.trim().length >= 2) {
        this.fetchSuggestions(query);
      } else {
        this.suggestions = [];
        this.showSuggestions = false;
      }
    });

    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentUser = this.authService.getCurrentUser();
        this.showUserMenu = false;
        this.showGuestMenu = false;
        this.showCategoryMenu = false;
      }
    });

    this.currentUser = this.authService.getCurrentUser();

    if (this.authService.isLoggedIn()) {
      this.socketService.connect();
      this.notifSub = this.socketService.notification$.subscribe(notif => {
        this.realtimeNotifications.unshift(notif);
      });
    }
  }


  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.search-box-wrapper')) {
      this.showSuggestions = false;
    }
  }

  onSearchInput(): void {
  this.searchSubject.next(this.searchQuery);
 }


  ngOnDestroy(): void {
    this.notifSub?.unsubscribe();
    this.userSub?.unsubscribe();
  }

  // ✅ Nombre de notifications non lues
  get unreadCount(): number {
    return this.realtimeNotifications.filter(n => !n.isRead).length;
  }

  // ✅ Icône selon le type
  getNotifIcon(type: string): string {
    const icons: any = {
      'BADGE_EARNED': 'bx bx-medal',
      'NEW_COURSE': 'bx bx-book-open',
      'DEADLINE_REMINDER': 'bx bx-alarm',
      'CERTIFICATE': 'bx bx-certification'  // clé différente
    };
    return icons[type] || 'bx bx-bell';
  }

  markNotifRead(notif: any): void {
    notif.isRead = true;
  }

  markAllNotifsRead(): void {
    this.realtimeNotifications.forEach(n => n.isRead = true);
  }

  clearNotifications(): void {
    this.realtimeNotifications = [];
    this.showNotifPanel = false;
  }

  toggleClass() {
    this.classApplied = !this.classApplied;
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn() && !!this.authService.getCurrentUser();
  }

  /** Sections of the user dropdown for the signed-in user's role */
  get userMenuSections(): { title: string; items: MenuItem[] }[] {
    const role = Array.isArray(this.currentUser?.role) ? this.currentUser.role[0] : this.currentUser?.role;
    return ROLE_MENUS[role] || ROLE_MENUS['user'];
  }

  get roleLabel(): string {
    const role = Array.isArray(this.currentUser?.role) ? this.currentUser.role[0] : this.currentUser?.role;
    return ({ user: 'Learner', admin: 'Administrator', trainer: 'Trainer', manager: 'Manager' } as any)[role] || 'Member';
  }

  toggleCategoryMenu(): void {
    this.showCategoryMenu = !this.showCategoryMenu;
    this.showUserMenu = false;
    this.activeCategory = this.menuCategories[0];
  }

  closeMenus(): void {
    this.showCategoryMenu = false;
    this.showUserMenu = false;
  }

  getDashboardRoute(): string {
    const role = this.authService.getRole();
    switch (role) {
      case 'admin': return '/admin-dashboard';
      case 'manager': return '/manager-dashboard';
      case 'trainer': return '/trainer-dashboard';
      default: return '/dashboard';
    }
  }

  logout(): void {
    this.socketService.disconnect();
    this.authService.logout();
    this.router.navigate(['/profile-authentication']);
  }

  @HostListener('window:scroll', ['$event'])
  checkScroll() {
    const scrollPosition = window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop || 0;
    this.isSticky = scrollPosition >= 50;
  }

  goToSearch(): void {
    if (!this.searchQuery.trim()) return;
    this.showSuggestions = false;
    this.router.navigate(['/courses-grid'], {
      queryParams: { search: this.searchQuery }
    });
    this.searchQuery = '';
  }

  selectSuggestion(suggestion: string): void {
  this.searchQuery = suggestion;
  this.showSuggestions = false;
  this.goToSearch();
  }

  fetchSuggestions(query: string): void {
  this.http.get<any>(`${this.apiUrl}/courses?search=${query}&limit=5`).subscribe({
    next: (data) => {
      const courses = data.courses || [];
      // ✅ Extraire titres + tags uniques qui commencent par la query
      const titles = courses
        .map((c: any) => c.title)
        .filter((t: string) => t.toLowerCase().startsWith(query.toLowerCase()));

      const tags = courses
        .flatMap((c: any) => c.tags || [])
        .filter((t: string) => t.toLowerCase().startsWith(query.toLowerCase()));

      const categories = courses
        .map((c: any) => c.category)
        .filter((c: string) => c?.toLowerCase().startsWith(query.toLowerCase()));

      // ✅ Fusionner + dédupliquer + limiter à 6
      this.suggestions = [...new Set([...titles, ...categories, ...tags])].slice(0, 6);
      this.showSuggestions = this.suggestions.length > 0;
    },
    error: () => {
      this.suggestions = [];
      this.showSuggestions = false;
    }
  });
 }


}