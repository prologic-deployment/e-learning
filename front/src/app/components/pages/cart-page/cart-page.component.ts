import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from '../../../services/cart.service';
import { AuthService } from '../../../services/auth.service';
import { formatTnd } from '../../../shared/pricing';
import { categoryColor, categoryIcon } from '../../../shared/categories';

@Component({
  selector: 'app-cart-page',
  templateUrl: './cart-page.component.html',
  styleUrls: ['./cart-page.component.scss']
})
export class CartPageComponent implements OnInit {

  cart: any = null;
  loading = true;
  error = '';
  removeLoading = '';

  fmt = formatTnd;
  color = categoryColor;
  icon = categoryIcon;

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/profile-authentication'], { queryParams: { returnUrl: '/cart' } });
      return;
    }
    this.loadCart();
  }

  get savings(): number {
    if (!this.cart) return 0;
    return Math.max(0, (this.cart.originalTotal ?? this.cart.totalPrice) - this.cart.totalPrice);
  }

  loadCart(): void {
    this.loading = true;
    this.cartService.getCart().subscribe({
      next: (data) => {
        this.cart = data;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  removeFromCart(courseId: string): void {
    this.removeLoading = courseId;
    this.cartService.removeFromCart(courseId).subscribe({
      next: () => {
        this.removeLoading = '';
        this.loadCart();
      },
      error: () => { this.removeLoading = ''; }
    });
  }

  clearCart(): void {
    this.cartService.clearCart().subscribe({
      next: () => { this.loadCart(); },
      error: () => {}
    });
  }
}
