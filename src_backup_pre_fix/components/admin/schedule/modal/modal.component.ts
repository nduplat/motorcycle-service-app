import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { UserService } from '../../../../services/user.service';
import { ServiceItemService } from '../../../../services/service-item.service';
import { UserVehicleService } from '../../../../services/user-vehicle.service';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
})
export class ModalComponent {
  private userService = inject(UserService);
  private serviceItemService = inject(ServiceItemService);
  private userVehicleService = inject(UserVehicleService);

  // Form data
  selectedClient = '';
  selectedService = '';
  selectedVehicle = '';
  selectedDate: Date | null = null;
  selectedTime = '';

  // Data for dropdowns
  clients = this.userService.getUsersAsMap();
  services = this.serviceItemService.getServices();
  vehicles: any[] = [];

  // New features data
  capacityValidation = { isValid: true, message: '' };
  timeSuggestions: any[] = [];
  technicianAvailability: any[] = [];
  autoAssignedTechnician = '';

  constructor(
    public dialogRef: MatDialogRef<ModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit() {
    if (this.data.mode === 'create') {
      // Initialize for creation mode
    }
  }

  onClientChange() {
    // Load vehicles for selected client
    if (this.selectedClient) {
      this.userVehicleService.getVehiclesForUser(this.selectedClient).subscribe(vehicles => {
        this.vehicles = vehicles;
      });
    }
  }

  async validateCapacity() {
    if (this.selectedDate && this.selectedService) {
      // Call capacity validation
      // This would integrate with the schedule component's validateCapacity method
      this.capacityValidation = { isValid: true, message: 'Capacity available' };
    }
  }

  async getTimeSuggestions() {
    if (this.selectedDate && this.selectedService) {
      // Call optimal time suggestions
      // This would integrate with the schedule component's getOptimalTimeSuggestions method
      this.timeSuggestions = [
        { time: '09:00', score: 95 },
        { time: '14:00', score: 88 },
        { time: '10:00', score: 82 }
      ];
    }
  }

  async checkTechnicianAvailability() {
    if (this.selectedDate) {
      // Call technician availability
      // This would integrate with the schedule component's getTechnicianAvailability method
      this.technicianAvailability = [
        { name: 'John Doe', available: true },
        { name: 'Jane Smith', available: false },
        { name: 'Bob Johnson', available: true }
      ];
    }
  }

  async autoAssignTechnician() {
    if (this.selectedService && this.selectedDate) {
      // Call auto-assignment
      // This would integrate with the schedule component's autoAssignTechnician method
      this.autoAssignedTechnician = 'John Doe';
    }
  }

  async onCreateAppointment() {
    try {
      // Validate all fields
      if (!this.selectedClient || !this.selectedService || !this.selectedVehicle || !this.selectedDate || !this.selectedTime) {
        alert('Please fill all required fields');
        return;
      }

      // Perform validations and auto-assignment
      await this.validateCapacity();
      await this.getTimeSuggestions();
      await this.checkTechnicianAvailability();
      await this.autoAssignTechnician();

      // Create appointment data
      const appointmentData = {
        clientId: this.selectedClient,
        serviceId: this.selectedService,
        vehicleId: this.selectedVehicle,
        scheduledAt: new Date(`${this.selectedDate.toDateString()} ${this.selectedTime}`),
        assignedTo: this.autoAssignedTechnician || null
      };

      // Close modal with appointment data
      this.dialogRef.close(appointmentData);
    } catch (error) {
      console.error('Error creating appointment:', error);
      alert('Error creating appointment');
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }
}