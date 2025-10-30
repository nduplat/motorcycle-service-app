
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/shared/header/header.component';
import { FooterComponent } from './components/shared/footer/footer.component';
import { AvailabilityModalComponent } from './components/shared/availability-modal.component';
import { MaintenanceNotificationService } from './services/maintenance-notification.service';
import { LowStockNotificationService } from './services/low-stock-notification.service';
import { NotificationService } from './services/notification.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, AvailabilityModalComponent]
})
export class AppComponent implements OnInit {
  private maintenanceService = inject(MaintenanceNotificationService);
  private lowStockService = inject(LowStockNotificationService);
  private notificationService = inject(NotificationService);
  authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    // Constructor vacío - redirección manejada en login component
  }

  ngOnInit() {
    // Start the maintenance notification scheduler when the app initializes
    this.maintenanceService.startMaintenanceScheduler();

    // Check for low stock notifications on app start
    this.lowStockService.checkAllNotifications();

    // Clean up old notifications on app start
    this.notificationService.cleanupOldNotifications();

    // Initialize push notifications
    this.notificationService.initializePushNotifications();

    // Initialize audio context for notification sounds
    this.notificationService.initializeAudio();

    // Set up periodic checks for low stock (every 6 hours)
    setInterval(() => {
      this.lowStockService.checkStockLevels();
    }, 6 * 60 * 60 * 1000);

    // Clean up old notifications weekly
    setInterval(() => {
      this.notificationService.cleanupOldNotifications();
    }, 7 * 24 * 60 * 60 * 1000);
  }

  shouldHideHeadersFooters(): boolean {
    return this.router.url.includes('/queue/join') || this.router.url.includes('/admin');
  }

  onUserInteraction(): void {
    // Initialize audio context on user interaction to handle autoplay policies
    this.notificationService.initializeAudio();
  }
}
