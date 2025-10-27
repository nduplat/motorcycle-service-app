import { ChangeDetectionStrategy, Component, inject, signal, computed, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase.config';

const fromFirestore = <T>(snapshot: any): T => {
  const data = snapshot.data() as any;
  return { ...data, id: snapshot.id } as T;
};

import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { UserValidationService } from '../../services/user-validation.service';
import { NotificationService } from '../../services/notification.service';
import { ToastService } from '../../services/toast.service';
import { ModalService } from '../../services/modal.service';
import { MotorcycleService } from '../../services/motorcycle.service';
import { Motorcycle, MotorcycleAssignment } from '../../models';
import { MotorcycleRegistrationComponent } from '../shared/motorcycle-registration.component';
import { QueueService } from '../../services/queue.service';


@Component({
  selector: 'app-account',
  templateUrl: './account.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MotorcycleRegistrationComponent],
})
export class AccountComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  userService = inject(UserService);
  validationService = inject(UserValidationService);
  notificationService = inject(NotificationService);
  toastService = inject(ToastService);
  modalService = inject(ModalService);
  motorcycleService = inject(MotorcycleService);
  queueService = inject(QueueService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  currentUser = this.authService.currentUser;
  isSubmitting = signal(false);
  activeTab = signal<'profile' | 'notifications' | 'motorcycles'>('motorcycles');
  pushNotificationsEnabled = signal(true);
  maintenanceRemindersEnabled = signal(true);
  notificationFilter = signal<'all' | 'unread' | 'read'>('all');

  private destroy$ = new Subject<void>();

  // Computed signals for notifications
  userNotifications = computed(() =>
    this.notificationService.getNotificationsForUser(this.currentUser()?.id || '')
      .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())
  );

  filteredNotifications = computed(() => {
    const filter = this.notificationFilter();
    const notifications = this.userNotifications();
    switch (filter) {
      case 'unread': return notifications.filter(n => !n.read);
      case 'read': return notifications.filter(n => n.read);
      default: return notifications;
    }
  });

  unreadCount = computed(() => this.userNotifications().filter(n => !n.read).length);
  readCount = computed(() => this.userNotifications().filter(n => n.read).length);

  // User's assigned motorcycles with assignment details
  userMotorcycles = signal<Motorcycle[]>([]);
  motorcycleAssignments = signal<MotorcycleAssignment[]>([]);
  motorcycleQueueStatuses = signal<Record<string, any>>({});

  ngOnInit(): void {
    // Initialize profile form with current user data
    const user = this.currentUser();
    if (user) {
      this.profileForm.patchValue({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
      });

      // Load user's assigned motorcycles
      this.loadUserMotorcycles();
    }

    // Check query params for tab
    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      if (params['tab'] === 'motorcycles') {
        this.activeTab.set('motorcycles');
      }
    });
  }

  private async loadUserMotorcycles(): Promise<void> {
    const user = this.currentUser();
    if (!user) return;

    try {
      // Load motorcycles and assignments
      const motorcycles = await this.motorcycleService.getUserAssignedMotorcycles(user.id).toPromise();
      this.userMotorcycles.set(motorcycles || []);

      // Load assignment details for each motorcycle
      const assignments: MotorcycleAssignment[] = [];
      for (const motorcycle of motorcycles || []) {
        try {
          // Get assignment details from motorcycleAssignments collection
          const assignmentQuery = query(
            collection(db, 'motorcycleAssignments'),
            where('userId', '==', user.id),
            where('motorcycleId', '==', motorcycle.id),
            where('status', '==', 'active')
          );
          const assignmentSnapshot = await getDocs(assignmentQuery);
          if (!assignmentSnapshot.empty) {
            const assignment = fromFirestore<MotorcycleAssignment>(assignmentSnapshot.docs[0]);
            assignments.push(assignment);
          }
        } catch (error) {
          console.error(`Error loading assignment for motorcycle ${motorcycle.id}:`, error);
        }
      }
      this.motorcycleAssignments.set(assignments);

      // Load queue statuses for motorcycles currently in service
      await this.loadMotorcycleQueueStatuses(motorcycles || []);

    } catch (error) {
      console.error('Error loading user motorcycles:', error);
    }
  }

  private async loadMotorcycleQueueStatuses(motorcycles: Motorcycle[]): Promise<void> {
    const statuses: Record<string, any> = {};

    for (const motorcycle of motorcycles) {
      if (motorcycle.plate) {
        try {
          // Check if motorcycle is currently in queue by plate
          const queueEntries = this.queueService.getQueueEntries()();
          const queueEntry = queueEntries?.find((entry: any) => entry.plate === motorcycle.plate);
          if (queueEntry) {
            statuses[motorcycle.id] = {
              position: queueEntry.position,
              estimatedWaitTime: queueEntry.estimatedWaitTime,
              status: queueEntry.status,
              serviceType: queueEntry.serviceType
            };
          }
        } catch (error) {
          console.error(`Error loading queue status for plate ${motorcycle.plate}:`, error);
        }
      }
    }

    this.motorcycleQueueStatuses.set(statuses);
  }

  // Computed values for template optimization
  currentUserWithComputedValues = computed(() => {
    const user = this.currentUser();
    if (!user) return null;
    return {
      ...user,
      roleClass: this.getRoleClass(user.role)
    };
  });

  notificationsWithComputedValues = computed(() => {
    return this.filteredNotifications().map(notification => ({
      ...notification,
      notificationIcon: this.getNotificationIcon(notification),
      notificationIconPath: this.getNotificationIconPath(notification),
      priority: this.getNotificationPriority(notification),
      priorityBadgeClass: this.getPriorityBadgeClass(notification),
      formattedTime: this.formatNotificationTime(notification.createdAt?.toDate())
    }));
  });

  // Profile form
  profileForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: [{ value: '', disabled: true }, [Validators.required]], // Email cannot be changed
    phone: ['', this.validationService.phoneValidator()],
  });



  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setActiveTab(tab: 'profile' | 'notifications' | 'motorcycles'): void {
    this.activeTab.set(tab);
  }

  saveProfile(): void {
    if (this.profileForm.invalid) return;

    this.isSubmitting.set(true);
    const formValue = this.profileForm.getRawValue();
    const currentUser = this.currentUser();

    if (!currentUser) return;

    const updateData = {
      name: formValue.name || undefined,
      phone: formValue.phone || undefined,
    };

    this.userService.updateUser({
      id: currentUser.id,
      ...updateData
    }).subscribe({
      next: (updatedUser) => {
        this.authService.currentUser.set(updatedUser);
        this.isSubmitting.set(false);
        this.toastService.success('Perfil actualizado exitosamente');
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.toastService.error(`Error al actualizar perfil: ${error.message}`);
      }
    });
  }


  logout(): void {
    this.modalService.confirm({
      title: 'Cerrar sesión',
      message: '¿Estás seguro de que quieres cerrar sesión?',
      confirmText: 'Cerrar sesión',
      cancelText: 'Cancelar'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.authService.logout();
        this.router.navigate(['/login']);
      }
    });
  }


  getRoleClass(role?: string): string {
    const roles: Record<string, string> = {
      admin: 'bg-red-200 text-red-800',
      technician: 'bg-blue-200 text-blue-800',
      customer: 'bg-green-200 text-green-800'
    };
    return roles[role || ''] || 'bg-gray-200 text-gray-800';
  }


  markAsRead(notificationId: string): void {
    this.notificationService.markAsRead(notificationId).subscribe({
      next: () => {
        // Notification marked as read
      },
      error: (error) => {
        console.error('Error marking notification as read:', error);
      }
    });
  }

  markAllAsRead(): void {
    const user = this.currentUser();
    if (!user) return;

    this.notificationService.markAllAsRead(user.id).subscribe({
      next: () => {
        // All notifications marked as read
      },
      error: (error) => {
        console.error('Error marking all notifications as read:', error);
      }
    });
  }

  togglePushNotifications(): void {
    this.pushNotificationsEnabled.update(enabled => !enabled);
    if (this.pushNotificationsEnabled()) {
      this.notificationService.requestPermission();
    }
  }

  toggleMaintenanceReminders(): void {
    this.maintenanceRemindersEnabled.update(enabled => !enabled);
  }

  setNotificationFilter(filter: 'all' | 'unread' | 'read'): void {
    this.notificationFilter.set(filter);
  }

  getUnreadCount(): number {
    return this.unreadCount();
  }

  getUserNotifications() {
    return this.userNotifications();
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

  // Motorcycle registration event handlers
  onMotorcycleRegistered(motorcycle: Motorcycle): void {
    this.toastService.success(`Motocicleta ${motorcycle.plate} registrada exitosamente`);
    // Reload user's motorcycles to update the list
    this.loadUserMotorcycles();
  }

  onRegistrationCancelled(): void {
    // Handle cancellation if needed
  }

  // Motorcycle management methods
  viewServiceHistory(motorcycle: Motorcycle): void {
    // Navigate to service history for this motorcycle
    this.router.navigate(['/service-history'], {
      queryParams: { plate: motorcycle.plate }
    });
  }

  manageAssignment(motorcycle: Motorcycle): void {
    // Open assignment management modal or navigate to assignment page
    this.router.navigate(['/motorcycle-assignment'], {
      queryParams: { motorcycleId: motorcycle.id }
    });
  }

  getAssignmentForMotorcycle(motorcycleId: string): MotorcycleAssignment | undefined {
    return this.motorcycleAssignments().find(assignment => assignment.motorcycleId === motorcycleId);
  }

  getQueueStatusForMotorcycle(motorcycleId: string): any {
    return this.motorcycleQueueStatuses()[motorcycleId];
  }

  formatAssignmentDate(date: any): string {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}
