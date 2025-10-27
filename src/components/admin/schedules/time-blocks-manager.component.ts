import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EmployeeScheduleService } from '../../../services/employee-schedule.service';
import { TimeBlock, User } from '../../../models';
import { AuthService } from '../../../services/auth.service';

type TimeBlockRequest = TimeBlock & {
  employeeName: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Date;
};

@Component({
  selector: 'app-time-blocks-manager',
  templateUrl: './time-blocks-manager.component.html',
  styleUrls: ['./time-blocks-manager.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule]
})
export class TimeBlocksManagerComponent {
  private fb = inject(FormBuilder);
  private scheduleService = inject(EmployeeScheduleService);
  private authService = inject(AuthService);

  // Signals for reactive state
  timeBlocks = signal<TimeBlockRequest[]>([]);
  employees = signal<User[]>([]);
  selectedTimeBlock = signal<TimeBlockRequest | null>(null);
  isLoading = signal(false);
  showRequestForm = signal(false);
  showApprovalModal = signal(false);
  filterStatus = signal<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Forms
  timeBlockForm!: FormGroup;

  constructor() {
    this.initializeForm();
    this.loadEmployees();
    this.loadTimeBlocks();
  }

  private initializeForm() {
    this.timeBlockForm = this.fb.group({
      employeeId: ['', Validators.required],
      type: ['break', Validators.required],
      startDate: [this.formatDate(new Date()), Validators.required],
      startTime: ['', Validators.required],
      endDate: [this.formatDate(new Date()), Validators.required],
      endTime: ['', Validators.required],
      reason: ['', Validators.required],
      workshopLocationId: ['']
    });
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  async loadEmployees() {
    try {
      this.isLoading.set(true);
      // Get all employees
      const employees = await this.scheduleService.getEmployeesAvailableForService(new Date());
      this.employees.set(employees);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadTimeBlocks() {
    try {
      this.isLoading.set(true);
      // For now, we'll simulate time block requests
      // In a real implementation, you'd have a separate service/collection for time block requests
      const mockTimeBlocks: TimeBlockRequest[] = [
        // Mock data - replace with actual service calls
      ];

      this.timeBlocks.set(mockTimeBlocks);
    } catch (error) {
      console.error('Error loading time blocks:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  openRequestForm() {
    this.timeBlockForm.reset({
      type: 'break',
      startDate: this.formatDate(new Date()),
      endDate: this.formatDate(new Date())
    });
    this.showRequestForm.set(true);
  }

  openApprovalModal(timeBlock: TimeBlockRequest) {
    this.selectedTimeBlock.set(timeBlock);
    this.showApprovalModal.set(true);
  }

  closeModals() {
    this.showRequestForm.set(false);
    this.showApprovalModal.set(false);
    this.selectedTimeBlock.set(null);
  }

  async submitTimeBlockRequest() {
    if (this.timeBlockForm.invalid) return;

    try {
      this.isLoading.set(true);
      const formValue = this.timeBlockForm.value;

      const startDateTime = new Date(`${formValue.startDate}T${formValue.startTime}`);
      const endDateTime = new Date(`${formValue.endDate}T${formValue.endTime}`);

      // Create time block request
      const timeBlockRequest: TimeBlockRequest = {
        id: `request_${Date.now()}`,
        startTime: startDateTime,
        endTime: endDateTime,
        type: formValue.type,
        technicianId: formValue.employeeId,
        workshopLocationId: formValue.workshopLocationId,
        employeeName: this.getEmployeeName(formValue.employeeId),
        status: 'pending',
        requestedAt: new Date(),
        reason: formValue.reason
      } as any;

      // Add to time blocks list (in real implementation, save to database)
      const currentBlocks = this.timeBlocks();
      this.timeBlocks.set([...currentBlocks, timeBlockRequest]);

      this.closeModals();
    } catch (error) {
      console.error('Error submitting time block request:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async approveTimeBlock() {
    if (!this.selectedTimeBlock()) return;

    try {
      this.isLoading.set(true);
      const timeBlock = this.selectedTimeBlock()!;

      // Create the actual time block in the schedule
      await this.scheduleService.createTimeBlock(
        timeBlock.technicianId!,
        timeBlock.startTime.toDate(),
        timeBlock.endTime.toDate(),
        timeBlock.type,
        timeBlock.workshopLocationId
      );

      // Update status
      const updatedBlocks = this.timeBlocks().map(tb =>
        tb.id === timeBlock.id ? { ...tb, status: 'approved' as const } : tb
      );
      this.timeBlocks.set(updatedBlocks);

      this.closeModals();
    } catch (error) {
      console.error('Error approving time block:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async rejectTimeBlock() {
    if (!this.selectedTimeBlock()) return;

    try {
      this.isLoading.set(true);
      const timeBlock = this.selectedTimeBlock()!;

      // Update status to rejected
      const updatedBlocks = this.timeBlocks().map(tb =>
        tb.id === timeBlock.id ? { ...tb, status: 'rejected' as const } : tb
      );
      this.timeBlocks.set(updatedBlocks);

      this.closeModals();
    } catch (error) {
      console.error('Error rejecting time block:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  getFilteredTimeBlocks() {
    const allBlocks = this.timeBlocks();
    if (this.filterStatus() === 'all') return allBlocks;
    return allBlocks.filter(block => block.status === this.filterStatus());
  }

  getEmployeeName(employeeId: string): string {
    const employee = this.employees().find(e => e.id === employeeId);
    return employee ? employee.displayName : 'Empleado desconocido';
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'approved': return 'Aprobado';
      case 'rejected': return 'Rechazado';
      default: return status;
    }
  }

  getTypeText(type: string): string {
    switch (type) {
      case 'work': return 'Trabajo';
      case 'break': return 'Descanso';
      case 'maintenance': return 'Mantenimiento';
      default: return type;
    }
  }

  formatDateTime(date: any): string {
    if (date.toDate) {
      return date.toDate().toLocaleString('es-CO');
    }
    return new Date(date).toLocaleString('es-CO');
  }

  calculateDuration(timeBlock: TimeBlockRequest): string {
    const start = timeBlock.startTime.toDate ? timeBlock.startTime.toDate() : new Date(timeBlock.startTime as any);
    const end = timeBlock.endTime.toDate ? timeBlock.endTime.toDate() : new Date(timeBlock.endTime as any);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  }
}