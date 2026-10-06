import { Component } from '@angular/core';
import { Router, NavigationCancel, NavigationEnd } from '@angular/router';
import { Location, LocationStrategy, PathLocationStrategy } from '@angular/common';
import { filter } from 'rxjs/operators';
import { OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { SocketService } from './services/socket.service';
import { AuthService } from './services/auth.service';
declare let $: any;

    @Component({
        selector: 'app-root',
        templateUrl: './app.component.html',
        styleUrls: ['./app.component.scss'],
        providers: [
            Location, {
                provide: LocationStrategy,
                useClass: PathLocationStrategy
            }
        ]
    })
  export class AppComponent implements OnInit, OnDestroy {
    location: any;
    routerSubscription: any;
    title: any;
    toasts: any[] = [];
   private notifSub: Subscription | null = null;

    constructor(
        private router: Router,
        private socketService: SocketService,
        private authService: AuthService
    ) {}

    ngOnInit(): void {
    this.recallJsFuntions();

    if (this.authService.isLoggedIn()) {
        this.socketService.connect();
    }

    this.notifSub = this.socketService.notification$.subscribe((notif: any) => {
        if (notif) {
        this.showToast(notif);
        this.playNotificationSound();
        }
    });


    }

    ngOnDestroy(): void {
    this.notifSub?.unsubscribe();
    this.routerSubscription?.unsubscribe();
    }

   recallJsFuntions() {
        this.routerSubscription = this.router.events
        .pipe(filter(event => event instanceof NavigationEnd || event instanceof NavigationCancel))
        .subscribe(event => {
            this.location = this.router.url;
            if (!(event instanceof NavigationEnd)) {
            return;
            }
            window.scrollTo(0, 0);
        });
    }

    showToast(notif: any): void {
    const id = Date.now();
    const toast = {
      id,
      title: notif.title || 'Nouvelle notification',
      message: notif.message || '',
      type: notif.type || 'INFO',
      visible: false
    };

    this.toasts.push(toast);

    // ✅ Animation entrée après 50ms
    setTimeout(() => {
      const t = this.toasts.find(t => t.id === id);
      if (t) t.visible = true;
    }, 50);

    // ✅ Auto-fermer après 5 secondes
    setTimeout(() => {
      this.closeToast(id);
    }, 5000);
    }

      closeToast(id: number): void {
    const toast = this.toasts.find(t => t.id === id);
    if (toast) {
      toast.visible = false;
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
      }, 400);
    }
  }

  // ✅ Icône selon le type
  getNotifIcon(type: string): string {
    const icons: any = {
      'BADGE_EARNED': '🏅',
      'NEW_COURSE': '📚',
      'DEADLINE_REMINDER': '⏰',
      'CERTIFICATE': '🎓',
      'COURSE_ASSIGNED': '📋',
      'QUIZ_PASSED': '✅',
      'INFO': '🔔'
    };
    return icons[type] || '🔔';
  }

    getNotifColor(type: string): string {
    const colors: any = {
      'BADGE_EARNED': '#f59e0b',
      'NEW_COURSE': '#457B9D',
      'DEADLINE_REMINDER': '#ef4444',
      'CERTIFICATE': '#10b981',
      'COURSE_ASSIGNED': '#8b5cf6',
      'QUIZ_PASSED': '#10b981',
      'INFO': '#457B9D'
    };
    return colors[type] || '#457B9D';
  }

    playNotificationSound(): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.15);

      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.log('Audio not supported');
    }
  }


}