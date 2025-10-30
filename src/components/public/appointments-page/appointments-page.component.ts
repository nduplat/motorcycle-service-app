import { ChangeDetectionStrategy, Component, inject, signal, computed, afterNextRender } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ServiceItemService } from '../../../services/service-item.service';
import { AppointmentService } from '../../../services/appointment.service';
import { UserService } from '../../../services/user.service';
import { UserVehicleService } from '../../../services/user-vehicle.service';
import { MotorcycleService } from '../../../services/motorcycle.service';
import { ServiceItem, MotorcycleAssignment, Motorcycle, AppointmentStatus } from '../../../models';
import { AuthService } from '../../../services/auth.service';
import { Timestamp } from 'firebase/firestore';
import { WeeklyAvailabilityComponent } from './weekly-availability.component';
import { ChatbotComponent } from '../../shared/chatbot.component';

type Step = 'selectService' | 'selectSlot' | 'confirm' | 'success';

@Component({
  selector: 'app-appointments-page',
  imports: [ReactiveFormsModule, WeeklyAvailabilityComponent, ChatbotComponent],
  templateUrl: './appointments-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentsPageComponent {
  private serviceItemService = inject(ServiceItemService);
  private appointmentService = inject(AppointmentService);
  private userService = inject(UserService);
  private userVehicleService = inject(UserVehicleService);
  private motorcycleService = inject(MotorcycleService);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  step = signal<Step>('selectService');
  isLoading = signal(false);
  userVehicles = signal<MotorcycleAssignment[]>([]);

  services = this.serviceItemService.getServices();
  allMotorcycles = this.motorcycleService.getMotorcycles();

  selectedService = signal<ServiceItem | null>(null);
  selectedSlot = signal<{ employeeId: string; date: Date; time: string } | null>(null);

  confirmationForm = this.fb.group({
    name: [{ value: '', disabled: true }, Validators.required],
    phone: ['', Validators.required],
    vehicle: ['', Validators.required],
    notes: [''],
  });

  userVehicleOptions = computed(() => {
    const vehicles = this.userVehicles();
    const motorcycles = this.allMotorcycles();

    return vehicles.map(vehicle => {
      const motorcycle = motorcycles.find(m => m.id === vehicle.motorcycleId);
      return {
        id: vehicle.id,
        label: motorcycle ? `${motorcycle.brand} ${motorcycle.model} ${motorcycle.year || ''}`.trim() : 'Vehículo desconocido',
        value: vehicle.id
      };
    });
  });

  constructor() {
    afterNextRender(() => {
      const currentUser = this.authService.currentUser();
      if (currentUser) {
        this.confirmationForm.patchValue({
          name: currentUser.name,
          phone: currentUser.phone || ''
        });

        // Load user's vehicles
        this.userVehicleService.getVehiclesForUser(currentUser.id).subscribe(vehicles => {
          this.userVehicles.set(vehicles);

          // Auto-select first vehicle if available
          if (vehicles.length > 0) {
            this.confirmationForm.patchValue({
              vehicle: vehicles[0].id
            });
          }
        });
      }
    });
  }

  selectService(service: ServiceItem): void {
    this.selectedService.set(service);
    this.step.set('selectSlot');
  }

  onSlotSelected(slot: { employeeId: string; date: Date; time: string }): void {
    this.selectedSlot.set(slot);
    this.step.set('confirm');
  }

  goBackTo(step: Step): void {
    this.step.set(step);
  }

  confirmAppointment(): void {
    if (this.confirmationForm.invalid) {
      this.confirmationForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const service = this.selectedService();
    const slot = this.selectedSlot();
    const formValue = this.confirmationForm.getRawValue();
    const currentUser = this.authService.currentUser();

    if (!service || !slot || !currentUser) {
        this.isLoading.set(false);
        return;
    };

    const [hour, minute] = slot.time.split(':');
    const scheduledAtDate = new Date(slot.date);
    scheduledAtDate.setHours(parseInt(hour), parseInt(minute), 0, 0);

    this.appointmentService.createAppointment({
      clientId: currentUser.id,
      plate: formValue.vehicle!,
      scheduledAt: Timestamp.fromDate(scheduledAtDate),
      estimatedDuration: (service.estimatedHours ?? 1) * 60,
      status: AppointmentStatus.PENDING_APPROVAL,
      serviceTypes: [service.title],
      assignedTo: slot.employeeId, // Assign to selected employee
      notes: formValue.notes || '',
    }).subscribe(() => {
        this.isLoading.set(false);
        this.step.set('success');
    });
  }

  startOver(): void {
    this.selectedService.set(null);
    this.selectedSlot.set(null);
    this.confirmationForm.reset();
    const currentUser = this.authService.currentUser();
      if (currentUser) {
        this.confirmationForm.patchValue({
          name: currentUser.name,
          phone: currentUser.phone || ''
        });
      }
    this.step.set('selectService');
  }

  onAppointmentBooked(appointment: any) {
    // Handle appointment booking from chatbot
    this.step.set('success');
  }
}