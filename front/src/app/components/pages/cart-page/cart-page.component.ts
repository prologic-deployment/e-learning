import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from '../../../services/cart.service';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-cart-page',
    templateUrl: './cart-page.component.html',
    styleUrls: ['./cart-page.component.scss'],
})
export class CartPageComponent implements OnInit {
    private destroy = inject(DestroyRef);
    clearLoading = false;
    actionError = '';
    cart: any = null;
    loading = true;
    error = '';
    removeLoading = '';

    constructor(
        private cartService: CartService,
        private authService: AuthService,
        private router: Router,
    ) {}

    ngOnInit(): void {
        if (!this.authService.isLoggedIn()) {
            this.router.navigate(['/profile-authentication']);
            return;
        }
        this.loadCart();
    }

    loadCart(): void {
        this.loading = true;
        this.error = '';
        this.cartService
            .getCart()
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: (data) => {
                    this.cart = data;
                    this.loading = false;
                },
                error: () => {
                    this.loading = false;
                    this.error =
                        'Your cart could not be loaded. Please try again.';
                },
            });
    }

    removeFromCart(courseId: string): void {
        if (!courseId || this.removeLoading || this.clearLoading) return;
        this.actionError = '';
        this.removeLoading = courseId;
        this.cartService
            .removeFromCart(courseId)
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: () => {
                    this.removeLoading = '';
                    this.loadCart();
                },
                error: () => {
                    this.removeLoading = '';
                    this.actionError =
                        'The course could not be removed. Please try again.';
                },
            });
    }

    clearCart(): void {
        if (this.clearLoading || this.removeLoading) return;
        this.clearLoading = true;
        this.actionError = '';
        this.cartService
            .clearCart()
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: () => {
                    this.clearLoading = false;
                    this.loadCart();
                },
                error: () => {
                    this.clearLoading = false;
                    this.actionError =
                        'Your cart could not be cleared. Please try again.';
                },
            });
    }
}
