import { isWorkspaceRoute } from '../../services/workspace-route';
import { BrandComponent } from '../brand/brand.component';
import { ThemeService } from '../../services/theme.service';
import { Component, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { UiModule } from '../ui/ui.module';
import { BrnDialogComponent } from '@spartan-ng/ui-dialog-brain';

interface Destination {
    label: string;
    icon: string;
    path: string;
    tab?: string;
}
@Component({
    selector: 'app-workspace-shell',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, UiModule, BrandComponent],
    templateUrl: './workspace-shell.component.html',
    styleUrls: ['./workspace-shell.component.scss'],
})
export class WorkspaceShellComponent implements OnDestroy {
    @ViewChild('searchDialog') searchDialog?: BrnDialogComponent;
    collapsed = false;
    query = '';
    get dark() { return this.theme.dark; }
    private sub: Subscription;
    constructor(
        public auth: AuthService,
        public router: Router,
        public theme: ThemeService,
    ) {
        this.sub = router.events.subscribe(() => (this.query = ''));
    }
    get enabled() { return this.auth.isLoggedIn() && isWorkspaceRoute(this.router.url); }
    get role() {
        return this.auth.getRole().toLowerCase();
    }
    get home() {
        return this.role === 'user' ? '/dashboard' : `/${this.role}-dashboard`;
    }
    get items(): Destination[] {
        const definitions: Record<string, string[][]> = {
            user: [
                ['Your overview', 'grid-alt', 'overview'],
                ['My learning', 'book-open', 'courses'],
                ['Achievements', 'medal', 'badges'],
                ['Certificates', 'award', 'certificates'],
                ['Learning history', 'time', 'history'],
                ['Notifications', 'bell', 'notifications'],
                ['Profile & security', 'user', 'profile'],
            ],
            trainer: [
                ['Studio overview', 'grid-alt', 'stats'],
                ['Course library', 'book-open', 'courses'],
                ['Create a course', 'plus-circle', 'create'],
                ['Assessment results', 'bar-chart-alt-2', 'quiz-results'],
                ['Profile & security', 'user', 'profile'],
            ],
            manager: [
                ['Team overview', 'grid-alt', 'stats'],
                ['Assign learning', 'book-add', 'assign'],
                ['Needs attention', 'time', 'overdue'],
                ['Profile & security', 'user', 'profile'],
            ],
            admin: [
                ['Platform overview', 'grid-alt', 'stats'],
                ['People & access', 'group', 'users'],
                ['Staff accounts', 'user-plus', 'staff-list'],
                ['Course library', 'book-open', 'courses'],
                ['Create a course', 'plus-circle', 'create'],
                ['Archived courses', 'archive', 'archived'],
                ['Team assignments', 'network-chart', 'assign'],
                ['Reviews', 'message-square', 'reviews'],
                ['Assessment results', 'bar-chart-alt-2', 'quiz-results'],
            ],
        };
        const items = (definitions[this.role] || []).map(([label, icon, tab]) => ({
            label,
            icon,
            tab,
            path: this.home,
        }));
        if (this.role === 'user')
            items.splice(2, 0, {
                label: 'Discover courses',
                icon: 'compass',
                tab: '',
                path: '/courses-grid',
            });
        items.push({label: 'Account security', icon: 'shield-quarter', tab: '', path: '/account/security'});
        return items;
    }
    get filteredItems() {
        return this.items.filter((i) => i.label.toLowerCase().includes(this.query.toLowerCase()));
    }
    active(item: Destination) {
        const url = this.router.parseUrl(this.router.url);
        return (
            url.root.children['primary']?.segments.map((s) => s.path).join('/') ===
                item.path.slice(1) &&
            (url.queryParams['tab'] || (this.role === 'user' ? 'overview' : 'stats')) ===
                (item.tab || (this.role === 'user' ? 'overview' : 'stats'))
        );
    }
    toggleTheme() { this.theme.toggle(); }
    @HostListener('document:keydown', ['$event']) shortcut(event: KeyboardEvent) {
        if (this.enabled && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            this.searchDialog?.open();
        }
    }
    logout() {
        this.auth.logout();
        this.router.navigate(['/profile-authentication']);
    }
    ngOnDestroy() {
        this.sub.unsubscribe();
    }
}
