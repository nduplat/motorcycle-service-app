import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { ButtonComponent } from '../shared/ui/button.component';
import { CARD_COMPONENTS } from '../shared/ui/card.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonComponent,
    ...CARD_COMPONENTS,
  ]
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  isLoading = signal(false);
  error = signal<string | null>(null);
  accessDenied = signal<string | null>(null);

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    const access = this.route.snapshot.queryParams['access'];
    if (access === 'denied') {
      this.accessDenied.set('No tienes permisos para acceder a esa página. Contacta al administrador si crees que es un error.');
    }
  }

  async onEmailSignIn() {
    if (this.loginForm.invalid) {
      this.error.set('Por favor, ingresa un email y contraseña válidos.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    const { email, password } = this.loginForm.value;
    const success = await this.authService.login(email, password);

    if (success) {
      const user = await this.authService.waitForUser();
      console.log('🔐 LoginComponent: User data loaded after email/pass login:', user?.role);
      this.navigateAfterLogin();
    } else {
      this.error.set('Credenciales incorrectas. Verifica tu email y contraseña.');
      this.isLoading.set(false);
    }
  }

  

  async onGoogleSignIn() {
    this.isLoading.set(true);
    this.error.set(null);

    const success = await this.authService.signInWithGoogle();

    if (success) {
      // Wait for user data to be loaded
      const user = await this.authService.waitForUser();
      console.log('🔐 LoginComponent: User data loaded:', user?.role);
      this.navigateAfterLogin();
    } else {
      this.error.set('Error al iniciar sesión con Google. Por favor, inténtalo de nuevo.');
      this.isLoading.set(false);
    }
  }

  async onAppleSignIn() {
    this.isLoading.set(true);
    this.error.set(null);

    const success = await this.authService.signInWithApple();

    if (success) {
      // Wait for user data to be loaded
      const user = await this.authService.waitForUser();
      console.log('🔐 LoginComponent: User data loaded:', user?.role);
      this.navigateAfterLogin();
    } else {
      this.error.set('Error al iniciar sesión con Apple. Por favor, inténtalo de nuevo.');
      this.isLoading.set(false);
    }
  }

  private async navigateAfterLogin() {
    const user = this.authService.currentUser();
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    console.log('🔐 LoginComponent: Navigating after login, user role:', user?.role, 'returnUrl:', returnUrl);

    // Initialize audio context and request notification permissions
    try {
      await this.notificationService.initializeAudio();
      console.log('🔐 LoginComponent: Audio context initialized');
      await this.notificationService.requestPermission();
      console.log('🔐 LoginComponent: Notification permissions requested');
    } catch (error) {
      console.warn('🔐 LoginComponent: Failed to initialize audio or request permissions:', error);
    }

    // If returnUrl exists and user has access, navigate to it
    if (returnUrl && this.canAccessRoute(returnUrl, user?.role)) {
      console.log('🔐 LoginComponent: Navigating to returnUrl:', returnUrl);
      this.router.navigate([returnUrl]);
      return;
    }

    // Check if new customer (customer role)
    if (user?.role === 'customer') {
      // Always navigate to queue/join for customers to complete onboarding
      console.log('🔐 LoginComponent: Customer detected, navigating to queue/join for onboarding');
      this.router.navigate(['/queue/join']);
      return;
    }

    // Role-based navigation with comprehensive role handling
    switch (user?.role) {
      case 'admin':
        console.log('🔐 LoginComponent: Navigating admin to /admin');
        this.router.navigate(['/admin']);
        break;
      case 'manager':
        console.log('🔐 LoginComponent: Navigating manager to /admin');
        this.router.navigate(['/admin']);
        break;
      case 'technician':
      case 'employee':
      case 'front_desk':
        console.log('🔐 LoginComponent: Navigating staff to /employee');
        this.router.navigate(['/employee']);
        break;
      case 'customer' as any:
        console.log('🔐 LoginComponent: Customer navigation handled above');
        break;
      default:
        console.log('🔐 LoginComponent: Unknown role, navigating to /');
        this.router.navigate(['/']);
    }
  }

  private canAccessRoute(url: string, role?: string): boolean {
    // Comprehensive role-based access control matching route guards
    if (url.startsWith('/admin')) {
      return role === 'admin' || role === 'manager' || role === 'employee' || role === 'technician';
    }
    if (url === '/appointments') {
      return role === 'customer';
    }
    if (url === '/checkout') {
      return role === 'customer';
    }
    if (url === '/account') {
      return role === 'customer' || role === 'employee' || role === 'admin';
    }
    if (url === '/employee') {
      return role === 'employee' || role === 'technician' || role === 'front_desk';
    }
    if (url === '/queue/join') {
      return role === 'customer' || role === 'admin' || role === 'employee' || role === 'technician';
    }
    // Public routes or routes accessible if logged in
    if (url === '/' || url === '/inventory' || url === '/services' || url === '/offers' || url === '/contact') {
      return true;
    }
    // For other routes, assume accessible if logged in
    return !!role;
  }
}