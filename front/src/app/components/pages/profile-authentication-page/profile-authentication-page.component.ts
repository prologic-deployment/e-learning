import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-profile-authentication-page',
  templateUrl: './profile-authentication-page.component.html',
  styleUrls: ['./profile-authentication-page.component.scss']
})
export class ProfileAuthenticationPageComponent implements OnInit {

  activeTab = 'login';

  // ========== LOGIN ==========
  loginData = { email: '', password: '' };
  loginError = '';
  loginSuccess = '';
  loginLoading = false;

  // ========== REGISTER ==========
  registerData = {
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    role: 'user',
    dateOfBirth: '',
    phone: ''
  };
  registerError = '';
  registerSuccess = '';
  registerLoading = false;

  registerTouched = {
  firstname: false,
  lastname: false,
  email: false,
  dateOfBirth: false,
  phone: false,
  password: false
 };

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn() && this.authService.getCurrentUser()) {
      this.redirectByRole();
      return;
    }

    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'register') {
        this.activeTab = 'register';
      } else {
        this.activeTab = 'login';
      }
    });
  }

  // ========== LOGIN ==========
  onLogin(): void {
    this.loginError = '';
    this.loginSuccess = '';
    this.loginLoading = true;

    // ✅ Single-step login: the API returns the session token directly, the
    // AuthService stores it, and the user goes straight to their dashboard.
    this.authService.login(this.loginData).subscribe({
      next: () => {
        this.loginLoading = false;
        if (this.authService.isLoggedIn()) {
          this.redirectByRole();
        } else {
          this.loginError = 'Login failed. Please try again.';
        }
      },
      error: (err) => {
        this.loginLoading = false;
        this.loginError = err.error?.message || 'Login failed. Please try again.';
      }
    });
  }

  // ========== REGISTER ==========
  onRegister(): void {
    this.registerError = '';
    this.registerSuccess = '';
    this.registerLoading = true;

    this.authService.register(this.registerData).subscribe({
      next: (res: any) => {
        this.registerLoading = false;
        this.registerData = {
          firstname: '', lastname: '', email: '',
          password: '', role: 'user', dateOfBirth: '', phone: ''
        };
        // Trainer sign-ups stay locked until an admin approves them:
        // keep the message on screen instead of jumping to the login tab.
        if (res?.pendingApproval) {
          this.registerSuccess = 'Your trainer account has been created and is awaiting approval by an administrator. '
            + 'You will receive an email and be able to sign in once it is approved.';
          return;
        }
        this.registerSuccess = 'Account created successfully ! Please login.';
        setTimeout(() => {
          this.activeTab = 'login';
          this.registerSuccess = '';
        }, 2000);
      },
      error: (err) => {
        this.registerLoading = false;
        this.registerError = err.error?.message || 'Registration failed. Please try again.';
      }
    });
  }

  // ========== REDIRECT PAR ROLE ==========
  redirectByRole(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];

    if (returnUrl) {
      this.router.navigateByUrl(returnUrl);
      return;
    }

    const role = this.authService.getRole();

    // ✅ Every role lands on its own dashboard right after sign-in
    switch (role) {
      case 'admin':
        this.router.navigate(['/admin-dashboard']);
        break;
      case 'manager':
        this.router.navigate(['/manager-dashboard']);
        break;
      case 'trainer':
        this.router.navigate(['/trainer-dashboard']);
        break;
      default:
        this.router.navigate(['/dashboard']);
        break;
    }
  }

  // ✅ Marquer un champ comme touché
  touch(field: string): void {
    this.registerTouched[field as keyof typeof this.registerTouched] = true;
  }

  // ✅ Vérifier si un champ est invalide
  isInvalid(field: string): boolean {
    const touched = this.registerTouched[field as keyof typeof this.registerTouched];
    const value = this.registerData[field as keyof typeof this.registerData];
    if (!touched) return false;

    if (field === 'email') {
      return !value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value as string);
    }
    if (field === 'password') {
      return !value || (value as string).length < 8;
    }
    if (field === 'phone') {
      return !value || (value as string).length < 8;
    }
    return !value;
  }
   

  getPasswordStrength(): number {
    const pwd = this.registerData.password || '';
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    return strength;
  }

  getPasswordColor(): string {
    const s = this.getPasswordStrength();
    if (s <= 1) return '#ef4444';
    if (s === 2) return '#f59e0b';
    if (s === 3) return '#3b82f6';
    return '#10b981';
  }



  getPasswordLabel(): string {
    const s = this.getPasswordStrength();
    if (s <= 1) return 'Mot de passe faible';
    if (s === 2) return 'Mot de passe moyen';
    if (s === 3) return 'Mot de passe fort';
    return 'Mot de passe très fort';
  }


}