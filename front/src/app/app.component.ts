import {ToastService} from './services/toast.service';
import { isWorkspaceRoute } from './services/workspace-route';
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
    get isLandingPage() { return ['/', '/welcome'].includes(this.router.url.split(/[?#]/)[0]); }
    get isAuthPage() { return /^\/(profile-authentication|forgot-password|reset-password)(\/|\?|$)/.test(this.router.url); }
    get workspaceEnabled() { return this.authService.isLoggedIn() && isWorkspaceRoute(this.router.url); }
    location: any;
    routerSubscription: any;
    title: any;
    toasts: any[] = [];
   private notifSub: Subscription | null = null;

    constructor(
        private router: Router,
        public socketService: SocketService,
        private authService: AuthService, private toast:ToastService
    ) {}

    ngOnInit(): void {
    this.recallJsFuntions();

    if (this.authService.isLoggedIn()) {
        this.socketService.connect();
    }

    this.notifSub = this.socketService.notification$.subscribe((notif: any) => {
        if (notif) {
        this.showToast(notif);

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
            // Router scrolling handles fragments and back/forward restoration.
        });
    }

    showToast(notif:any){this.toast.show(notif.message||'You have a new notification.','info',notif.title||'Notification');}
}
