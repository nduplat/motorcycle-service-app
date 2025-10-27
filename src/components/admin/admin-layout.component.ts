import { Component, ChangeDetectionStrategy, signal, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet]
})
export class AdminLayoutComponent {
  isMenuOpen = signal(false);

  constructor(private router: Router, private authService: AuthService) {}

  navigationItems = [
    {
      label: 'Dashboard',
      route: '/admin/dashboard',
      icon: '📊'
    },
    {
      label: 'Gestión de Cola',
      route: '/admin/queue',
      icon: '👥'
    },
    {
      label: 'Asignación Inteligente',
      route: '/admin/assignment',
      icon: '🎯'
    },
    {
      label: 'Validación de Códigos',
      route: '/admin/code-validation',
      icon: '🔍'
    },
    {
      label: 'Motocicletas',
      route: '/admin/motorcycles',
      icon: '🏍️'
    },
    {
      label: 'Productos',
      route: '/admin/products',
      icon: '📦'
    },
    {
      label: 'Servicios',
      route: '/admin/services',
      icon: '🔧'
    },
    {
      label: 'Usuarios',
      route: '/admin/users',
      icon: '👤'
    },
    {
      label: 'Órdenes de Trabajo',
      route: '/admin/work-orders',
      icon: '📋'
    }
  ];

  toggleMenu() {
    this.isMenuOpen.set(!this.isMenuOpen());
  }

  closeMenu() {
    this.isMenuOpen.set(false);
  }

  navigateToEmployee() {
    this.closeMenu();
    this.router.navigate(['/employee']);
  }

  logout() {
    this.closeMenu();
    this.authService.logout();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent) {
    if (this.isMenuOpen()) {
      this.closeMenu();
      event.preventDefault();
    }
  }
}