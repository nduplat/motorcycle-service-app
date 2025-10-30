import { Injectable, inject, signal, effect } from '@angular/core';
import { ServiceItem, MaintenanceReminder, MotorcycleAssignment, UserProfile, Timestamp } from '../models';
import { ServiceItemService } from './service-item.service';
import { UserService } from './user.service';
import { UserVehicleService } from './user-vehicle.service';
import { EventBusService } from './event-bus.service';
import { AuthService } from './auth.service';
import { db } from '../firebase.config';
import { collection, getDocs, doc, addDoc, updateDoc, serverTimestamp, query, where, DocumentData, DocumentSnapshot } from 'firebase/firestore';

const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
  const data = snapshot.data() as any;
  return { ...data, id: snapshot.id } as T;
};

@Injectable({
  providedIn: 'root'
})
export class MaintenanceNotificationService {
  private serviceItemService = inject(ServiceItemService);
  private userService = inject(UserService);
  private userVehicleService = inject(UserVehicleService);
  private eventBus = inject(EventBusService);
  private authService = inject(AuthService);

  private reminders = signal<MaintenanceReminder[]>([]);

  constructor() {
    // Subscribe to auth state changes for reactive loading
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        console.log('MaintenanceNotificationService: User authenticated, loading reminders');
        this.loadReminders();
      } else {
        console.log('MaintenanceNotificationService: User not authenticated, clearing reminders');
        this.reminders.set([]);
      }
    });
  }

  private async loadReminders() {
    // Get current user from AuthService
    const currentUser = this.authService.currentUser();

    console.log("MaintenanceNotificationService: Loading reminders - Auth check:", {
      isAuthenticated: !!currentUser,
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      userRole: currentUser?.role
    });

    if (!currentUser) {
      console.warn("MaintenanceNotificationService: No authenticated user - cannot load reminders");
      return;
    }

    // Check if user has permission to load reminders
    const staffRoles = ['admin', 'manager', 'technician', 'front_desk', 'employee'];
    const isStaff = staffRoles.includes(currentUser.role);

    console.log("MaintenanceNotificationService: Permission check:", {
      userRole: currentUser.role,
      isStaff,
      staffRoles
    });

    if (!isStaff) {
      console.log("MaintenanceNotificationService: User is not staff - skipping reminder loading for role:", currentUser.role);
      this.reminders.set([]);
      return;
    }

    try {
      // Staff can load all reminders
      console.log("MaintenanceNotificationService: Loading all reminders for staff");
      const querySnapshot = await getDocs(collection(db, "maintenanceReminders"));
      this.reminders.set(querySnapshot.docs.map(doc => fromFirestore<MaintenanceReminder>(doc)));
    } catch (error: any) {
      console.error("MaintenanceNotificationService: Error fetching maintenance reminders:", {
        message: error.message,
        code: error.code,
        userRole: currentUser?.role,
        isPermissionError: error.code === 'permission-denied'
      });
    }
  }

  getReminders() {
    return this.reminders.asReadonly();
  }

  // Check for upcoming maintenance and create notifications
  async checkUpcomingMaintenance(): Promise<void> {
    const services = this.serviceItemService.getServices()();
    const users = this.userService.getUsers()();

    const maintenanceServices = services.filter(s => s.type === 'maintenance');

    for (const service of maintenanceServices) {
      if (!service.notificationDays) continue;

      // Get all user vehicles for maintenance checks
      for (const user of users) {
        try {
          const userVehicles = await this.userVehicleService.getVehiclesForUser(user.id).toPromise();
          if (userVehicles) {
            for (const vehicle of userVehicles) {
              await this.checkServiceForVehicle(service, vehicle, user);
            }
          }
        } catch (error) {
          console.error(`Error checking vehicles for user ${user.id}:`, error);
        }
      }
    }
  }

  private async checkServiceForVehicle(
    service: ServiceItem,
    vehicle: MotorcycleAssignment,
    user: UserProfile
  ): Promise<void> {
    // Calculate next service date based on service requirements
    const nextServiceDate = this.calculateNextServiceDate(service, vehicle);
    if (!nextServiceDate) return;

    const notificationDate = new Date(nextServiceDate);
    notificationDate.setDate(notificationDate.getDate() - (service.notificationDays || 30));

    const now = new Date();
    const daysUntilNotification = Math.ceil((notificationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Check if notification should be sent
    if (daysUntilNotification <= 0 && daysUntilNotification >= -7) { // Within notification window
      await this.createOrUpdateReminder(service, vehicle, user, nextServiceDate, daysUntilNotification);
    }
  }

  private calculateNextServiceDate(service: ServiceItem, vehicle: MotorcycleAssignment,): Date | null {
    // This is a simplified calculation - in a real app, you'd have service history
    // For now, we'll assume services are due every 6 months for maintenance
    // Since UserVehicle doesn't have service history, we'll use created date as fallback
    const referenceDate = vehicle.createdAt?.toDate() || new Date();

    // Calculate next service date (6 months from reference date)
    const nextServiceDate = new Date(referenceDate);
    nextServiceDate.setMonth(nextServiceDate.getMonth() + 6);

    return nextServiceDate;
  }

  private async createOrUpdateReminder(
    service: ServiceItem,
    vehicle: MotorcycleAssignment,
    user: UserProfile,
    nextServiceDate: Date,
    daysUntilDue: number
  ): Promise<void> {
    const existingReminder = this.reminders().find(r =>
      r.customerId === user.id &&
      r.plate === vehicle.plate &&
      r.serviceId === service.id
    );

    let dueType: MaintenanceReminder['dueType'] = 'upcoming';
    let priority: MaintenanceReminder['priority'] = 'recommended';

    if (daysUntilDue < 0) {
      dueType = 'overdue';
      priority = 'critical';
    } else if (daysUntilDue <= 7) {
      dueType = 'due_soon';
      priority = 'recommended';
    }

    const reminderData = {
      customerId: user.id,
      plate: vehicle.plate || '',
      vehicleId: vehicle.id,
      serviceId: service.id,
      serviceName: service.title,
      dueType,
      dueDate: { toDate: () => nextServiceDate } as Timestamp,
      currentMileage: vehicle.mileageKm,
      priority,
      lastServiceDate: vehicle.createdAt,
      status: 'pending' as MaintenanceReminder['status'],
      createdAt: serverTimestamp()
    };

    try {
      // Check authentication
      const currentUser = this.authService.currentUser();
      if (!currentUser) {
        console.error("MaintenanceNotificationService: User not authenticated - cannot create/update reminder");
        return;
      }

      if (existingReminder) {
        // Update existing reminder
        const docRef = doc(db, "maintenanceReminders", existingReminder.id);
        await updateDoc(docRef, {
          ...reminderData,
          updatedAt: serverTimestamp()
        });

        // Send notification if status changed
        if (existingReminder.dueType !== dueType) {
          await this.sendMaintenanceNotification(reminderData, user);
        }
      } else {
        // Create new reminder
        const docRef = await addDoc(collection(db, "maintenanceReminders"), reminderData);

        // Update local state
        const newReminder: MaintenanceReminder = {
          ...reminderData,
          id: docRef.id,
          createdAt: { toDate: () => new Date() } as Timestamp
        };

        this.reminders.update(reminders => [...reminders, newReminder]);

        // Send notification
        await this.sendMaintenanceNotification(reminderData, user);
      }
    } catch (error) {
      console.error("Error creating/updating maintenance reminder:", error);
    }
  }

  private async sendMaintenanceNotification(
    reminder: any,
    customer: UserProfile
  ): Promise<void> {
    let title = '';
    let message = '';

    switch (reminder.dueType) {
      case 'overdue':
        title = '🚨 Servicio de Mantenimiento Vencido';
        message = `El servicio "${reminder.serviceName}" para tu motocicleta con placa ${reminder.plate} está vencido. Te recomendamos programarlo lo antes posible.`;
        break;
      case 'due_soon':
        title = '⚠️ Servicio de Mantenimiento Próximo';
        message = `El servicio "${reminder.serviceName}" para tu motocicleta con placa ${reminder.plate} vencerá pronto. Considera programarlo.`;
        break;
      case 'upcoming':
        title = '📅 Recordatorio de Mantenimiento';
        message = `Te recordamos que el servicio "${reminder.serviceName}" está programado para mantenimiento preventivo.`;
        break;
    }

    // Emit event for maintenance reminder
    this.eventBus.emit({ type: 'maintenance.reminder_created', reminder, customer });

    // Here you could also send email/SMS notifications
    console.log(`Maintenance notification sent to ${customer.email}: ${title}`);
  }

  // Get reminders for a specific customer
  getRemindersForCustomer(customerId: string): MaintenanceReminder[] {
    return this.reminders().filter(r => r.customerId === customerId);
  }

  // Get overdue reminders
  getOverdueReminders(): MaintenanceReminder[] {
    return this.reminders().filter(r => r.dueType === 'overdue');
  }

  // Get reminders due soon
  getDueSoonReminders(): MaintenanceReminder[] {
    return this.reminders().filter(r => r.dueType === 'due_soon');
  }

  // Mark reminder as sent/scheduled/dismissed
  async updateReminderStatus(
    reminderId: string,
    status: MaintenanceReminder['status']
  ): Promise<void> {
    try {
      // Check authentication
      const currentUser = this.authService.currentUser();
      if (!currentUser) {
        console.error("MaintenanceNotificationService: User not authenticated - cannot update reminder status");
        return;
      }

      const docRef = doc(db, "maintenanceReminders", reminderId);
      await updateDoc(docRef, {
        status,
        updatedAt: serverTimestamp()
      });

      // Update local state
      this.reminders.update(reminders =>
        reminders.map(r =>
          r.id === reminderId ? { ...r, status } : r
        )
      );
    } catch (error) {
      console.error("Error updating reminder status:", error);
    }
  }

  // Get maintenance statistics
  getMaintenanceStats() {
    const reminders = this.reminders();
    return {
      total: reminders.length,
      overdue: reminders.filter(r => r.dueType === 'overdue').length,
      dueSoon: reminders.filter(r => r.dueType === 'due_soon').length,
      upcoming: reminders.filter(r => r.dueType === 'upcoming').length,
      critical: reminders.filter(r => r.priority === 'critical').length,
      pending: reminders.filter(r => r.status === 'pending').length
    };
  }

  // Schedule automatic maintenance checks (could be called by a cron job or timer)
  startMaintenanceScheduler(): void {
    // Check every 24 hours
    setInterval(() => {
      this.checkUpcomingMaintenance();
    }, 24 * 60 * 60 * 1000);

    // Initial check
    this.checkUpcomingMaintenance();
  }
}