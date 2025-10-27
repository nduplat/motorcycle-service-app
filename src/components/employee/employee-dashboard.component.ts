import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { OfflineDetectionService } from '../../services/offline-detection.service';
import { SyncService } from '../../services/sync.service';
import { StatusDisplayService } from '../../services/status-display.service';
import { QueueManagementComponent } from './queue-management.component';
import { TimeTrackingComponent } from './time-tracking.component';
import { MetricsComponent } from './metrics.component';
import { HeaderComponent } from '../shared/header/header.component';
import { EmployeeNotificationsComponent } from './employee-notifications.component';
import { WorkOrderListComponent } from '../admin/work-orders/work-order-list.component';

@Component({
  selector: 'app-employee-dashboard',
  templateUrl: './employee-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatTabsModule, MatIconModule, MatButtonModule,
    MatCardModule, MatDividerModule, MatSnackBarModule,
    EmployeeNotificationsComponent, QueueManagementComponent, TimeTrackingComponent, MetricsComponent, HeaderComponent, WorkOrderListComponent
  ]
})
export class EmployeeDashboardComponent {
  authService = inject(AuthService);
  offlineDetectionService = inject(OfflineDetectionService);
  syncService = inject(SyncService);
  statusDisplayService = inject(StatusDisplayService);

  currentUser = this.authService.currentUser;

  // Tab state management
  activeTabIndex = signal(0);
  tabs = [
    { label: 'Mis Trabajos', value: 'trabajos' },
    { label: 'Cola', value: 'cola' },
    { label: 'Tiempo', value: 'tiempo' },
    { label: 'Métricas', value: 'metricas' },
    { label: 'Notificaciones', value: 'notificaciones' }
  ];

  // Computed signal to check if notifications tab is active
  isNotificationsTabActive = computed(() => this.activeTabIndex() === 4);

  // Computed signals for sub-component activation
  isWorkOrdersTabActive = computed(() => this.activeTabIndex() === 0);
  isQueueTabActive = computed(() => this.activeTabIndex() === 1);
  isTimeTabActive = computed(() => this.activeTabIndex() === 2);
  isMetricsTabActive = computed(() => this.activeTabIndex() === 3);

  // Offline and sync related signals
  isOnline = this.offlineDetectionService.isOnline;
  connectionQuality = this.offlineDetectionService.connectionQuality;
  syncStatus = this.syncService.syncStatus;

  // Status display signals
  connectionStatusDisplay = this.statusDisplayService.connectionStatusDisplay;
  syncStatusDisplay = this.statusDisplayService.syncStatusDisplay;

  onTabChange(index: number): void {
    this.activeTabIndex.set(index);
  }

  // Sync methods
  async performManualSync(): Promise<void> {
    try {
      await this.syncService.performManualSync();
    } catch (error: any) {
      console.error('Manual sync failed:', error);
    }
  }

  async forceRefreshCache(): Promise<void> {
    try {
      await this.syncService.forceRefreshCache();
    } catch (error: any) {
      console.error('Cache refresh failed:', error);
    }
  }

}