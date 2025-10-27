import { ChangeDetectionStrategy, Component, input, computed, inject, effect, signal } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { Notification as NotificationModel } from '../../models';

@Component({
  selector: 'app-employee-notifications',
  template: `
    @if (isActive()) {
      @if (notifications().length > 0) {
        <div class="space-y-3 max-h-80 overflow-y-auto">
          @for (notification of notifications(); track notification.id) {
            <div class="group bg-card border rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer"
                  [class]="!notification.read ? 'border-primary/30 bg-gradient-to-r from-primary/5 to-transparent shadow-sm' : 'border-border'"
                  (click)="toggleNotification(notification.id)">
              <div class="flex items-start gap-3">
                <!-- Notification Icon -->
                <div class="flex-shrink-0">
                  <div class="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                        [class]="getNotificationIcon(notification)">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="getNotificationIconPath(notification)"></path>
                    </svg>
                  </div>
                </div>

                <!-- Notification Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex-1">
                      <h4 class="font-semibold text-sm leading-tight"
                          [class]="!notification.read ? 'text-primary' : 'text-foreground'">
                        {{ notification.title }}
                      </h4>
                      <div class="flex items-center gap-2 mt-1">
                        <span class="text-xs text-muted-foreground">
                          {{ formatNotificationTime(notification.createdAt?.toDate()) }}
                        </span>
                        @if (getNotificationPriority(notification) !== 'normal') {
                          <span class="px-2 py-0.5 text-xs rounded-full font-medium"
                                [class]="getPriorityBadgeClass(notification)">
                            {{ getNotificationPriority(notification) === 'high' ? 'Importante' : 'Urgente' }}
                          </span>
                        }
                      </div>
                    </div>
                    <div class="flex items-center gap-2 ml-4">
                      @if (!notification.read) {
                        <div class="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                      }
                      <button (click)="markAsRead(notification.id); $event.stopPropagation()"
                              class="opacity-0 group-hover:opacity-100 text-xs text-primary hover:text-primary/80 font-medium transition-opacity">
                        @if (!notification.read) {
                          Marcar como leída
                        } @else {
                          Marcar como no leída
                        }
                      </button>
                    </div>
                  </div>

                  @if (notification.message) {
                    <p class="text-sm text-muted-foreground leading-relaxed">
                      {{ notification.message }}
                    </p>
                  }

                  <!-- Notification Actions -->
                  @if (notification.meta) {
                    <div class="flex items-center gap-2 pt-2 border-t border-border/50">
                      @if (notification.meta.workOrderId) {
                        <button class="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                          </svg>
                          Ver Orden
                        </button>
                      }
                      @if (notification.meta.qrCodeDataUrl) {
                        <button class="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 15h4.01M12 21h4.01M12 3h4.01M6 3h4.01M6 6h4.01M6 9h4.01M6 12h4.01M6 15h4.01M6 18h4.01M6 21h4.01"></path>
                          </svg>
                          QR
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
        <div class="mt-4 pt-3 border-t border-border space-y-2">
          <button (click)="markAllAsRead()"
                  class="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 text-sm transition-colors">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            Marcar todas como leídas
          </button>
          <button (click)="testNotificationAlert()"
                  class="w-full px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 text-sm transition-colors">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5v-5zM4.868 12.683A17.925 17.925 0 0112 21c7.962 0 12-1.21 12-2.683m-12 2.683a17.925 17.925 0 01-7.132-8.317M12 21c4.411 0 8-4.03 8-9s-3.589-9-8-9-8 4.03-8 9a9.06 9.06 0 001.832 5.683L4 21l4.868-8.317z"></path>
            </svg>
            Probar Sonido y Vibración
          </button>
        </div>
      } @else {
        <div class="text-center py-12">
          <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5v-5zM4.868 12.683A17.925 17.925 0 0112 21c7.962 0 12-1.21 12-2.683m-12 2.683a17.925 17.925 0 01-7.132-8.317M12 21c4.411 0 8-4.03 8-9s-3.589-9-8-9-8 4.03-8 9a9.06 9.06 0 001.832 5.683L4 21l4.868-8.317z"></path>
            </svg>
          </div>
          <h4 class="text-lg font-semibold text-muted-foreground mb-2">Sin notificaciones</h4>
          <p class="text-sm text-muted-foreground">Cuando tengas nuevas notificaciones, aparecerán aquí.</p>
        </div>
      }
    } @else {
      <!-- Loading placeholder when tab is not active -->
      <div class="text-center py-12">
        <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-full flex items-center justify-center">
          <svg class="w-8 h-8 text-primary/60 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        </div>
        <h4 class="text-lg font-semibold text-muted-foreground mb-2">Cargando notificaciones...</h4>
        <p class="text-sm text-muted-foreground">Activando pestaña de notificaciones.</p>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeNotificationsComponent {
  private notificationService = inject(NotificationService);
  private previousNotifications = signal<NotificationModel[]>([]);
  private userNotifications = signal<NotificationModel[]>([]);

  userId = input.required<string>();
  isActive = input<boolean>(false);

  notifications = this.userNotifications.asReadonly();

  constructor() {
    // Effect to update user notifications when system notifications change and tab is active
    effect(() => {
      if (this.isActive()) {
        const allNotifications = this.notificationService.getNotificationsForUser(this.userId());
        const sorted = allNotifications
          .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());

        // Only update if the content actually changed
        const current = this.userNotifications();
        if (JSON.stringify(current) !== JSON.stringify(sorted)) {
          this.userNotifications.set(sorted);
        }
      } else {
        // Clear notifications when tab becomes inactive to free memory
        this.userNotifications.set([]);
        this.previousNotifications.set([]);
      }
    });

    // Effect to detect new notifications and play sound/vibration only when tab is active
    effect(() => {
      if (this.isActive()) {
        const currentNotifications = this.notifications();
        const previous = this.previousNotifications();

        // Find new unread notifications that should trigger alerts
        const newNotifications = currentNotifications.filter(current => {
          // Check if this notification is new (not in previous list)
          const isNew = !previous.some(prev => prev.id === current.id);
          // Check if it should play loud notification
          const shouldPlayLoud = this.shouldPlayLoudNotification(current);
          // Check if it's unread
          const isUnread = !current.read;

          return isNew && shouldPlayLoud && isUnread;
        });

        // Play alerts for new notifications
        if (newNotifications.length > 0) {
          this.notificationService.playNotificationAlert(this.userId()).catch(error => {
            console.error('Failed to play notification alert:', error);
          });
        }

        // Update previous notifications
        this.previousNotifications.set([...currentNotifications]);
      }
    });
  }

  private shouldPlayLoudNotification(notification: NotificationModel): boolean {
    // Use the same logic as the service
    if (!notification.userId) return false;

    const title = notification.title?.toLowerCase() || '';
    const message = notification.message?.toLowerCase() || '';
    const meta = notification.meta || {};

    // Urgent notifications
    if (title.includes('urgente') || message.includes('urgente') || meta.type === 'urgent') {
      return true;
    }

    // Queue notifications
    if (title.includes('cola') || title.includes('queue') || meta.type === 'queue') {
      return true;
    }

    // Appointments
    if (title.includes('cita') || title.includes('appointment') || meta.type === 'appointment_reminder') {
      return true;
    }

    // Maintenance reminders
    if (title.includes('mantenimiento') || title.includes('maintenance') || meta.type === 'maintenance_reminder') {
      return true;
    }

    // All employee notifications
    return true;
  }

  markAsRead(notificationId: string): void {
    this.notificationService.markAsRead(notificationId).subscribe();
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead(this.userId()).subscribe();
  }

  testNotificationAlert(): void {
    console.log('Testing notification alert for user:', this.userId());
    this.notificationService.playNotificationAlert(this.userId()).catch(error => {
      console.error('Test notification alert failed:', error);
      alert('Error al probar sonido/vibración: ' + error.message);
    });
  }

  toggleNotification(notificationId: string): void {
    // For now, just mark as read. Could expand to toggle read/unread
    this.markAsRead(notificationId);
  }

  getNotificationIcon(notification: any): string {
    // Return appropriate background classes based on notification type
    if (notification.title?.toLowerCase().includes('cita') || notification.title?.toLowerCase().includes('appointment')) {
      return 'bg-blue-100 text-blue-600';
    } else if (notification.title?.toLowerCase().includes('mantenimiento') || notification.title?.toLowerCase().includes('maintenance')) {
      return 'bg-orange-100 text-orange-600';
    } else if (notification.title?.toLowerCase().includes('orden') || notification.title?.toLowerCase().includes('work')) {
      return 'bg-green-100 text-green-600';
    } else {
      return 'bg-gray-100 text-gray-600';
    }
  }

  getNotificationIconPath(notification: any): string {
    // Return appropriate SVG path based on notification type
    if (notification.title?.toLowerCase().includes('cita') || notification.title?.toLowerCase().includes('appointment')) {
      return 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z';
    } else if (notification.title?.toLowerCase().includes('mantenimiento') || notification.title?.toLowerCase().includes('maintenance')) {
      return 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z';
    } else if (notification.title?.toLowerCase().includes('orden') || notification.title?.toLowerCase().includes('work')) {
      return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
    } else {
      return 'M15 17h5l-5 5v-5zM4.868 12.683A17.925 17.925 0 0112 21c7.962 0 12-1.21 12-2.683m-12 2.683a17.925 17.925 0 01-7.132-8.317M12 21c4.411 0 8-4.03 8-9s-3.589-9-8-9-8 4.03-8 9a9.06 9.06 0 001.832 5.683L4 21l4.868-8.317z';
    }
  }

  getNotificationPriority(notification: any): 'normal' | 'high' | 'urgent' {
    const title = notification.title?.toLowerCase() || '';
    const message = notification.message?.toLowerCase() || '';

    if (title.includes('urgente') || title.includes('vencido') || message.includes('urgente') || message.includes('vencido')) {
      return 'urgent';
    } else if (title.includes('importante') || title.includes('próximo') || message.includes('importante') || message.includes('próximo')) {
      return 'high';
    }
    return 'normal';
  }

  getPriorityBadgeClass(notification: any): string {
    const priority = this.getNotificationPriority(notification);
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  formatNotificationTime(date: Date): string {
    if (!date) return '';

    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Hace ${diffInHours}h`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `Hace ${diffInDays}d`;

    return date.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}