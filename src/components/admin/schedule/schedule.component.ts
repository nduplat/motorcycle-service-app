import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AppointmentService } from '../../../services/appointment.service';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import { CommonModule } from '@angular/common';
import { CustomCalendarModule } from './calendar.module';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ModalComponent } from './modal/modal.component';
import { ServiceItemService } from '../../../services/service-item.service';
import { UserService } from '../../../services/user.service';
import { WorkshopCapacityService } from '../../../services/workshop-capacity.service';
import { EmployeeScheduleService } from '../../../services/employee-schedule.service';
import { Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import { AppointmentStatus } from '../../../models';

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
  styleUrls: [],
  standalone: true,
  imports: [
    CommonModule,
    CustomCalendarModule,
    MatDialogModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleComponent {
  private appointmentService = inject(AppointmentService);
  private serviceItemService = inject(ServiceItemService);
  private userService = inject(UserService);
  private dialog = inject(MatDialog);
  private workshopCapacityService = inject(WorkshopCapacityService);
  private employeeScheduleService = inject(EmployeeScheduleService);

  view: CalendarView = CalendarView.Month;
  CalendarView = CalendarView;
  viewDate: Date = new Date();
  
  appointments = this.appointmentService.getAppointments();
  
  calendarEvents = computed(() => {
    const serviceMap = this.serviceItemService.getServiceAsMap();
    const userMap = this.userService.getUsersAsMap();

    return this.appointments().map(appointment => {
      const service = appointment.serviceId ? serviceMap.get(appointment.serviceId) : undefined;
      const client = appointment.clientId ? userMap.get(appointment.clientId) : undefined;
      const title = `${service?.title || 'Servicio Desconocido'} - ${client?.name || 'Cliente Desconocido'}`;

      return {
        start: appointment.scheduledAt.toDate(),
        title: title,
        meta: {
          client: client?.name || 'N/A',
          vehicle: appointment.plate, // You might want to fetch vehicle details too
          service: service?.title || 'N/A',
          time: appointment.scheduledAt.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        },
      };
    });
  });

  // Use a signal for events to be passed to the calendar component
  events = signal<CalendarEvent[]>([]);

  constructor() {
    // When calendarEvents changes, update the events signal
    effect(() => {
      this.events.set(this.calendarEvents());
    });
  }

  handleEvent(action: string, event: CalendarEvent): void {
    this.dialog.open(ModalComponent, {
      width: '400px',
      data: {
        client: event.meta.client,
        vehicle: event.meta.vehicle,
        service: event.meta.service,
        time: event.meta.time,
      },
    });
  }

  setView(view: CalendarView) {
    this.view = view;
  }

  openCreateAppointmentModal() {
    const dialogRef = this.dialog.open(ModalComponent, {
      width: '600px',
      data: {
        mode: 'create',
        title: 'Create New Appointment'
      },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Create appointment using the new features
        this.createAppointmentWithFeatures(
          result.clientId,
          result.serviceId,
          result.vehicleId,
          result.scheduledAt
        ).then(result => {
          console.log('Appointment created successfully:', result);
          // Refresh appointments
          // The appointments signal should update automatically
        }).catch(error => {
          console.error('Error creating appointment:', error);
          alert('Error creating appointment: ' + error.message);
        });
      }
    });
  }

  // Capacity validation when scheduling
  async validateCapacity(date: Date, serviceDuration: number): Promise<boolean> {
    try {
      const capacityCheck = await this.workshopCapacityService.canAccommodateService(serviceDuration, date).toPromise();
      return capacityCheck?.canAccommodate || false;
    } catch (error) {
      console.error('Error validating capacity:', error);
      return false;
    }
  }

  // Get optimal time suggestions
  async getOptimalTimeSuggestions(date: Date, serviceDuration: number) {
    try {
      const suggestions = await this.workshopCapacityService.getOptimalAppointmentSlots(date, serviceDuration).toPromise();
      return suggestions || [];
    } catch (error) {
      console.error('Error getting optimal time suggestions:', error);
      return [];
    }
  }

  // Get technician availability indicators
  async getTechnicianAvailability(date: Date) {
    try {
      const capacityInfo = await this.workshopCapacityService.getCapacityForDate(date).toPromise();
      return capacityInfo?.technicianAvailability || [];
    } catch (error) {
      console.error('Error getting technician availability:', error);
      return [];
    }
  }

  // Auto-assign technician when creating appointment
  async autoAssignTechnician(serviceId: string, date: Date): Promise<string | null> {
    try {
      // For now, return null - technician assignment is handled by queue service
      // TODO: Implement technician assignment logic if needed
      console.log('Technician assignment handled by queue service');
      return null;
    } catch (error) {
      console.error('Error auto-assigning technician:', error);
      return null;
    }
  }

  // Create appointment with all validations and auto-assignment
  async createAppointmentWithFeatures(clientId: string, serviceId: string, vehicleId: string, preferredDate: Date) {
    try {
      // 1. Validate capacity
      const service = this.serviceItemService.getServices()().find(s => s.id === serviceId);
      const duration = (service?.estimatedHours || 1) * 60; // Convert hours to minutes, default 1 hour

      const hasCapacity = await this.validateCapacity(preferredDate, duration);
      if (!hasCapacity) {
        throw new Error('No capacity available for the selected date');
      }

      // 2. Get optimal time suggestions if needed
      const suggestions = await this.getOptimalTimeSuggestions(preferredDate, duration);
      const scheduledTime = suggestions.length > 0 ? suggestions[0].startTime : preferredDate;

      // 3. Auto-assign technician
      const assignedTechnician = await this.autoAssignTechnician(serviceId, scheduledTime);

      // 4. Create the appointment
      const appointment = {
        clientId,
        serviceId,
        plate: vehicleId, // Use plate instead of vehicleId
        scheduledAt: FirestoreTimestamp.fromDate(scheduledTime),
        assignedTo: assignedTechnician || undefined,
        status: AppointmentStatus.SCHEDULED,
        estimatedDuration: duration
      };

      await this.appointmentService.createAppointment(appointment).toPromise();

      return {
        appointment,
        technicianAssigned: assignedTechnician,
        optimalTime: scheduledTime
      };
    } catch (error) {
      console.error('Error creating appointment with features:', error);
      throw error;
    }
  }
}
