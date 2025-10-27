import { ChangeDetectionStrategy, Component, signal, inject, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { Role } from '../../../models';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive]
})
export class HeaderComponent {
  authService = inject(AuthService);
  notificationService = inject(NotificationService);
  router = inject(Router);
  
  isMenuOpen = signal(false);
  currentUser = this.authService.currentUser;

  unreadCount = computed(() => {
    const user = this.currentUser();
    if (!user) return 0;
    return this.notificationService.getSystemNotifications()().filter(n => n.userId === user.id && !n.read).length;
  });

  navItems = computed(() => {
    const user = this.currentUser();
    if (user && (user.role === 'employee' || user.role === 'technician')) {
      // Employees only see their dashboard
      return [];
    }
    return [
      { name: 'Repuestos', path: '/inventory' },
      { name: 'Servicios', path: '/services' },
      { name: 'Citas', path: this.authService.isCustomer() ? '/appointments' : '/login' },
      { name: 'Ofertas', path: '/offers' },
      { name: 'Contacto', path: '/contact' },
    ];
  });

  get hasAdminAccess(): boolean {
    const user = this.currentUser();
    const adminRoles: Role[] = ['admin'];
    return !!user && adminRoles.includes(user.role);
  }

  toggleMenu(): void {
    this.isMenuOpen.update(value => !value);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
    this.closeMenu();
    this.router.navigate(['/']);
  }
}