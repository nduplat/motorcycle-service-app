import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AppointmentService } from '../../../../services/appointment.service';
import { ServiceItemService } from '../../../../services/service-item.service';
import { AuthService } from '../../../../services/auth.service';
import { UserVehicleService } from '../../../../services/user-vehicle.service';
import { ServiceItem, UserVehicle, Appointment } from '../../../../models';
import { Timestamp as FirestoreTimestamp } from 'firebase/firestore';

@Component({
  selector: 'app-appointment-booking',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './appointment-booking.html',
  styleUrl: './appointment-booking.css'
})
export class AppointmentBookingComponent implements OnInit {
  private fb = inject(FormBuilder);
  private appointmentService = inject(AppointmentService);
  private serviceItemService = inject(ServiceItemService);
  private authService = inject(AuthService);
  private userVehicleService = inject(UserVehicleService);

  services = signal<ServiceItem[]>([]);
  userVehicles = signal<UserVehicle[]>([]);
  availableTimes = signal<string[]>([]);
  selectedDate = signal<Date | null>(null);
  isLoggedIn = this.authService.currentUser;
  isLoading = signal(false);

  bookingForm!: FormGroup;

  ngOnInit() {
    this.loadServices();
    this.initializeForm();
    if (this.isLoggedIn()) {
      this.loadUserVehicles();
    }
  }

  private loadServices() {
    this.services.set(this.serviceItemService.getServices()());
  }

  private loadUserVehicles() {
    const userId = this.isLoggedIn()?.id;
    if (userId) {
      this.userVehicleService.getVehiclesForUser(userId).subscribe(vehicles => {
        this.userVehicles.set(vehicles);
      });
    }
  }

  private initializeForm() {
    this.bookingForm = this.fb.group({
      serviceId: ['', Validators.required],
      date: ['', Validators.required],
      time: ['', Validators.required],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      vehicleId: [''],
      vehicleBrand: [''],
      vehicleModel: [''],
      vehicleYear: [''],
      vehiclePlate: [''],
      notes: ['']
    });
  }

  onDateChange(event: any) {
    const date = new Date(event.target.value);
    this.selectedDate.set(date);
    this.generateAvailableTimes();
  }

  private generateAvailableTimes() {
    const times: string[] = [];
    for (let hour = 8; hour <= 17; hour++) {
      times.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    this.availableTimes.set(times);
  }

  onSubmit() {
    if (this.bookingForm.valid) {
      this.isLoading.set(true);
      const formValue = this.bookingForm.value;
      const selectedService = this.services().find(s => s.id === formValue.serviceId);

      if (!selectedService) return;

      const dateTime = new Date(`${formValue.date}T${formValue.time}`);

      let vehicleId = formValue.vehicleId;
      if (!vehicleId) {
        // For public users or if no vehicle selected, create a vehicle description
        vehicleId = `${formValue.vehicleBrand} ${formValue.vehicleModel} ${formValue.vehicleYear} ${formValue.vehiclePlate}`.trim();
      }

      const appointmentData = {
        clientId: this.isLoggedIn()?.id || 'public',
        vehicleId: vehicleId,
        serviceId: formValue.serviceId,
        scheduledAt: FirestoreTimestamp.fromDate(dateTime),
        estimatedDuration: (selectedService.estimatedHours || 1) * 60,
        status: 'pending_approval' as const,
        date: FirestoreTimestamp.fromDate(new Date(formValue.date))
      };

      this.appointmentService.createAppointment(appointmentData).subscribe({
        next: (appointment) => {
          console.log('Appointment created:', appointment);
          this.isLoading.set(false);
          // Handle success, maybe show message or redirect
        },
        error: (error) => {
          console.error('Error creating appointment:', error);
          this.isLoading.set(false);
        }
      });
    }
  }
}
