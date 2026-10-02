import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { SocketService } from '../../../services/socket.service';
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {

  showUserMenu = false;
  showGuestMenu = false;
  showCategoryMenu = false;
  classApplied = false;
  isSticky: boolean = false;
  currentUser: any = null;

  searchQuery = '';
  suggestions: string[] = [];
  showSuggestions = false;
  searchSubject = new Subject<string>();
  apiUrl = environment.apiUrl;

  // ✅ Notifications temps réel
  realtimeNotifications: any[] = [];
  showNotifPanel = false;
  private notifSub: Subscription | null = null;

  constructor(
    public router: Router,
    private authService: AuthService,
    private socketService: SocketService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
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
  }

  // ✅ Nombre de notifications non lues
  get unreadCount(): number {
    return this.realtimeNotifications.filter(n => !n.isRead).length;
  }

  // ✅ Icône selon le type
  getNotifIcon(type: string): string {
    const icons: any = {
      'BADGE_EARNED': '🏅',
      'NEW_COURSE': '📚',
      'DEADLINE_REMINDER': '⏰',
      'CERTIFICATE': '🎓'  // ✅ clé différente
    };
    return icons[type] || '🔔';
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