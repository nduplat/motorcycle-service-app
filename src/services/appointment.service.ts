
import { Injectable, signal, inject, effect } from '@angular/core';
import { Appointment, ServiceItem, User, AppointmentStatus, WorkOrder } from '../models';
import { Timestamp } from 'firebase/firestore';
import { map, catchError } from 'rxjs/operators';
import { of, delay, Observable, from } from 'rxjs';
import { UserService } from './user.service';
import { EventBusService } from './event-bus.service';
import { ServiceItemService } from './service-item.service';
import { db } from '../firebase.config';
import { collection, getDocs, doc, addDoc, updateDoc, serverTimestamp, query, where, orderBy, limit, startAfter, DocumentData, DocumentSnapshot } from 'firebase/firestore';
import { SchedulingService } from './scheduling.service';
import { AuthService } from './auth.service';
import { CostMonitoringService } from './cost-monitoring.service';
import { ApiService } from './api.service';



const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
    const data = snapshot.data() as any;
    return { ...data, id: snapshot.id } as T;
};

// Cache interface for appointment data
interface AppointmentCache {
  data: Appointment[];
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

// Helper to convert JS Date to a Firestore Timestamp for new objects
const toTimestamp = (date: Date): Timestamp => Timestamp.fromDate(date);

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private userService = inject(UserService);
  private serviceItemService = inject(ServiceItemService);
  private eventBus = inject(EventBusService);
  private schedulingService = inject(SchedulingService);
  private authService = inject(AuthService);
  private costMonitoringService = inject(CostMonitoringService);
  private apiService = inject(ApiService);

  private appointments = signal<Appointment[]>([]);

  // Cache
  private cache: AppointmentCache | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Pagination state
  private readonly PAGE_SIZE = 20;
  private lastDoc: any = null;
  private hasMore = signal(true);
  private isLoadingMore = signal(false);

  constructor() {
    // Watch for user changes and reload appointments reactively
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        console.log('AppointmentService: User authenticated, loading appointments');
        this.loadAppointments();
      } else {
        console.log('AppointmentService: User not authenticated, clearing appointments');
        this.appointments.set([]);
      }
    });
  }

  private async loadAppointments() {
    // Get current user from AuthService
    const currentUser = this.authService.currentUser();

    console.log("AppointmentService: Loading appointments - Auth check:", {
      isAuthenticated: !!currentUser,
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      userRole: currentUser?.role
    });

    if (!currentUser) {
      console.warn("AppointmentService: No authenticated user - cannot load appointments");
      return;
    }

    // Check if user has permission to load appointments (staff roles only)
    const staffRoles = ['admin', 'manager', 'technician', 'front_desk', 'employee'];
    const isStaff = staffRoles.includes(currentUser.role);

    console.log("AppointmentService: Permission check:", {
      userRole: currentUser.role,
      isStaff,
      staffRoles
    });

    if (!isStaff) {
      console.log("AppointmentService: User is not staff - skipping appointment loading for role:", currentUser.role);
      this.appointments.set([]);
      return;
    }

    // Check cache first
    if (this.cache && (Date.now() - this.cache.timestamp) < this.cache.ttl) {
      this.appointments.set(this.cache.data);
      this.hasMore.set(false);
      this.lastDoc = null;
      return;
    }

    try {
      // Load appointments assigned to current user with pagination (simplified query)
      const assignedQuery = query(collection(db, "appointments"), where("assignedTo", "==", currentUser.id || ""), limit(this.PAGE_SIZE * 2)); // Get more and sort in memory
      const assignedSnapshot = await getDocs(assignedQuery);
      this.costMonitoringService.trackFirestoreRead(assignedSnapshot.docs.length);
      const allAssignedData = assignedSnapshot.docs.map(doc => fromFirestore<Appointment>(doc));
      // Sort by createdAt desc in memory
      const assignedData = allAssignedData
        .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())
        .slice(0, this.PAGE_SIZE);

      const appointmentsData = [...assignedData];

      // Also load unassigned appointments for assignment purposes (only for admins)
      if (currentUser.role === 'admin') {
        const unassignedQuery = query(collection(db, "appointments"), where("assignedTo", "==", null));
        const unassignedSnapshot = await getDocs(unassignedQuery);
        this.costMonitoringService.trackFirestoreRead(unassignedSnapshot.docs.length);
        const unassignedData = unassignedSnapshot.docs.map(doc => fromFirestore<Appointment>(doc));
        appointmentsData.push(...unassignedData);
      }
      this.appointments.set(appointmentsData);

      this.lastDoc = assignedSnapshot.docs[assignedSnapshot.docs.length - 1];
      this.hasMore.set(assignedData.length === this.PAGE_SIZE);

      if (!this.hasMore()) {
        this.cache = {
          data: appointmentsData,
          timestamp: Date.now(),
          ttl: this.CACHE_TTL
        };
      }
    } catch (error: any) {
      console.error("AppointmentService: Error fetching appointments:", {
        message: error.message,
        code: error.code,
        userRole: currentUser?.role,
        isPermissionError: error.code === 'permission-denied',
        networkOnline: navigator.onLine,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });

      // Handle specific Firebase errors
      switch (error.code) {
        case 'permission-denied':
          console.warn('AppointmentService: PERMISSION_DENIED - User lacks permission to read appointments');
          break;
        case 'unavailable':
          console.warn('AppointmentService: SERVICE_UNAVAILABLE - Firestore service temporarily unavailable');
          break;
        case 'internal':
          console.error('AppointmentService: FIREBASE_INTERNAL_ERROR - Firebase internal error occurred');
          break;
        case 'deadline-exceeded':
          console.warn('AppointmentService: DEADLINE_EXCEEDED - Request timed out');
          break;
        case 'resource-exhausted':
          console.warn('AppointmentService: RESOURCE_EXHAUSTED - Quota exceeded or rate limited');
          break;
        default:
          console.warn('AppointmentService: UNKNOWN_ERROR - Unknown error fetching appointments');
      }
    }
  }

  getAppointments() {
    return this.appointments.asReadonly();
  }

  getPaginationState() {
    return {
      hasMore: this.hasMore.asReadonly(),
      isLoadingMore: this.isLoadingMore.asReadonly()
    };
  }

  async loadMoreAppointments(): Promise<void> {
    if (!this.hasMore() || this.isLoadingMore()) {
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser || !this.lastDoc) {
      return;
    }

    this.isLoadingMore.set(true);

    try {
      // Simplified query for pagination (get more and filter in memory)
      const assignedQuery = query(
        collection(db, "appointments"),
        where("assignedTo", "==", currentUser.id || ""),
        limit(this.PAGE_SIZE * 3) // Get more to account for pagination
      );
      const assignedSnapshot = await getDocs(assignedQuery);
      const allNewAssigned = assignedSnapshot.docs.map(doc => fromFirestore<Appointment>(doc));
      // Filter out already loaded appointments and sort
      const existingIds = new Set(this.appointments().map(a => a.id));
      const newAssigned = allNewAssigned
        .filter(doc => !existingIds.has(doc.id))
        .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())
        .slice(0, this.PAGE_SIZE);

      if (newAssigned.length > 0) {
        this.appointments.update(current => [...current, ...newAssigned]);
        this.lastDoc = assignedSnapshot.docs[assignedSnapshot.docs.length - 1];
      }

      this.hasMore.set(newAssigned.length === this.PAGE_SIZE);

      if (!this.hasMore()) {
        // Cache the full list if no more
        this.cache = {
          data: this.appointments(),
          timestamp: Date.now(),
          ttl: this.CACHE_TTL
        };
      }
    } catch (error: any) {
      console.error("AppointmentService: Error loading more appointments:", {
        message: error.message,
        code: error.code,
        networkOnline: navigator.onLine,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });

      // Handle specific Firebase errors
      switch (error.code) {
        case 'permission-denied':
          console.warn('AppointmentService: PERMISSION_DENIED - User lacks permission to read more appointments');
          break;
        case 'unavailable':
          console.warn('AppointmentService: SERVICE_UNAVAILABLE - Firestore service temporarily unavailable');
          break;
        case 'internal':
          console.error('AppointmentService: FIREBASE_INTERNAL_ERROR - Firebase internal error occurred');
          break;
        case 'deadline-exceeded':
          console.warn('AppointmentService: DEADLINE_EXCEEDED - Request timed out');
          break;
        case 'resource-exhausted':
          console.warn('AppointmentService: RESOURCE_EXHAUSTED - Quota exceeded or rate limited');
          break;
        default:
          console.warn('AppointmentService: UNKNOWN_ERROR - Unknown error loading more appointments');
      }
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  getAppointmentsForDate(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.appointments().filter(apt => {
        const aptDate = apt.scheduledAt.toDate();
        return aptDate >= startOfDay && aptDate <= endOfDay;
    });
  }

  getAvailableSlots(date: Date, technicianId: string, serviceDurationMinutes: number): string[] {
    // This logic remains the same as it calculates based on existing appointment data
    const workingHours = { start: 8, end: 17 };
    const slotDuration = 30;

    const technicianAppointments = this.getAppointmentsForDate(date).filter(
      apt => apt.assignedTo === technicianId
    );

    const availableSlots: string[] = [];
    if (date.getDay() === 0) return []; // No Sundays

    for (let hour = workingHours.start; hour < workingHours.end; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const slotTime = new Date(date);
        slotTime.setHours(hour, minute, 0, 0);
        const slotEndTime = new Date(slotTime.getTime() + serviceDurationMinutes * 60000);

        const isConflict = technicianAppointments.some(apt => {
          const aptStart = apt.scheduledAt.toDate();
          const aptEnd = new Date(aptStart.getTime() + apt.estimatedDuration * 60000);
          return (slotTime < aptEnd && slotEndTime > aptStart);
        });

        if (!isConflict && slotEndTime.getHours() <= workingHours.end) {
          availableSlots.push(slotTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }));
        }
      }
    }
    return availableSlots;
  }

  getAvailableTechnicians(atTime: Date = new Date()): User[] {
    const allTechnicians = this.userService.getTechnicians();
    return allTechnicians.filter(tech => {
      const techAppointments = this.appointments().filter(apt => apt.assignedTo === tech.id && apt.status === AppointmentStatus.SCHEDULED);
      return !techAppointments.some(apt => {
        const aptStart = apt.scheduledAt.toDate();
        const aptEnd = new Date(aptStart.getTime() + apt.estimatedDuration * 60000);
        return atTime >= aptStart && atTime < aptEnd;
      });
    });
  }

  createAppointment(data: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'number'>): Observable<Appointment> {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return new Observable(observer => observer.error(new Error('User not authenticated')));
    }

    // Data sent to the backend is simplified
    const payload = {
      ...data,
      scheduledAt: data.scheduledAt.toDate().toISOString(), // Send as ISO string
    };

    return this.apiService.callFunction<{ id: string, number: string, status: AppointmentStatus }>('createAppointment', payload).pipe(
      map(result => {
        const newAppointment: Appointment = {
          ...data,
          id: result.id,
          number: result.number,
          status: result.status,
          createdAt: toTimestamp(new Date()), // Mock timestamp for immediate UI update
          updatedAt: toTimestamp(new Date())
        };

        this.appointments.update(apts => [...apts, newAppointment]);
        this.invalidateCache();

        this.eventBus.emit({ type: 'appointment.created', entity: newAppointment });

        return newAppointment;
      }),
      catchError(error => {
        console.error('AppointmentService: Error creating appointment via API:', error);
        // The ApiService already logs the error, here we can transform it for the UI
        throw new Error('Failed to create appointment. Please try again later.');
      })
    );
  }

  private autoAssignTechnician(appointment: Appointment): string | undefined {
    const allAppointments = this.appointments();
    return this.schedulingService.autoAssignTechnician(appointment, allAppointments);
  }
  
  assignTechnician(appointmentId: string, technicianId: string): Observable<Appointment | undefined> {
    return this.apiService.callFunction<{ success: boolean }>('assignTechnician', { appointmentId, technicianId }).pipe(
      map(result => {
        if (result.success) {
          let updatedAppointment: Appointment | undefined;
          this.appointments.update(apts => apts.map(apt => {
            if (apt.id === appointmentId) {
              updatedAppointment = { ...apt, assignedTo: technicianId, status: AppointmentStatus.SCHEDULED };
              return updatedAppointment;
            }
            return apt;
          }));

          this.invalidateCache();

          if (updatedAppointment) {
            this.eventBus.emit({ type: 'appointment.assigned', entity: updatedAppointment });
          }
          return updatedAppointment;
        }
        return undefined;
      }),
      catchError(error => {
        console.error('AppointmentService: Error assigning technician via API:', error);
        throw new Error('Failed to assign technician. Please try again later.');
      })
    );
  }



  updateAppointmentStatus(appointmentId: string, status: Appointment['status'], workOrderId?: string): Observable<Appointment | undefined> {
    const payload = { appointmentId, status, workOrderId };

    return this.apiService.callFunction<{ success: boolean }>('updateAppointmentStatus', payload).pipe(
      map(result => {
        if (result.success) {
          let updatedAppointment: Appointment | undefined;
          const oldStatus = this.appointments().find(a => a.id === appointmentId)?.status;

          this.appointments.update(apts => apts.map(apt => {
            if (apt.id === appointmentId) {
              updatedAppointment = { ...apt, status, workOrderId: workOrderId || apt.workOrderId };
              return updatedAppointment;
            }
            return apt;
          }));

          this.invalidateCache();

          if (updatedAppointment) {
            this.eventBus.emit({ type: 'appointment.status_changed', entity: updatedAppointment, oldStatus: oldStatus, newStatus: status });
          }

          return updatedAppointment;
        }
        return undefined;
      }),
      catchError(error => {
        console.error('AppointmentService: Error updating appointment status via API:', error);
        throw new Error('Failed to update appointment status. Please try again later.');
      })
    );
  }
     
       private invalidateCache(): void {
         this.cache = null;
       }
     }