import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EmployeeScheduleService } from '../../../services/employee-schedule.service';
import { EmployeeSchedule, ShiftConfig, BreakConfig, User } from '../../../models';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-employee-schedule-manager',
  templateUrl: './employee-schedule-manager.component.html',
  styleUrls: ['./employee-schedule-manager.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule]
})
export class EmployeeScheduleManagerComponent {
  private fb = inject(FormBuilder);
  private scheduleService = inject(EmployeeScheduleService);
  private authService = inject(AuthService);

  // Signals for reactive state
  schedules = signal<EmployeeSchedule[]>([]);
  employees = signal<User[]>([]);
  selectedSchedule = signal<EmployeeSchedule | null>(null);
  selectedDate = signal<Date>(new Date());
  isLoading = signal(false);
  showCreateForm = signal(false);
  showEditForm = signal(false);

  // Forms
  scheduleForm!: FormGroup;
  shiftForm!: FormGroup;
  breakForm!: FormGroup;

  constructor() {
    this.initializeForms();
    this.loadEmployees();
    this.loadSchedulesForDate(this.selectedDate());
  }

  private initializeForms() {
    this.scheduleForm = this.fb.group({
      employeeId: ['', Validators.required],
      date: [this.formatDate(new Date()), Validators.required],
      shifts: this.fb.array([]),
      breaks: this.fb.array([])
    });

    this.shiftForm = this.fb.group({
      name: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      daysOfWeek: [[], Validators.required]
    });

    this.breakForm = this.fb.group({
      name: ['', Validators.required],
      startTime: ['', Validators.required],
      durationMinutes: [30, [Validators.required, Validators.min(15)]]
    });
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  async loadEmployees() {
    try {
      this.isLoading.set(true);
      // Get all employees (technicians, employees, front_desk)
      const employees = await this.scheduleService.getEmployeesAvailableForService(new Date());
      this.employees.set(employees);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadSchedulesForDate(date: Date) {
    try {
      this.isLoading.set(true);
      const allSchedules: EmployeeSchedule[] = [];

      // Load schedules for all employees on this date
      for (const employee of this.employees()) {
        const schedule = await this.scheduleService.getEmployeeSchedule(employee.id, date);
        if (schedule) {
          allSchedules.push(schedule);
        }
      }

      this.schedules.set(allSchedules);
    } catch (error) {
      console.error('Error loading schedules:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  onDateChange(date: string) {
    const selectedDate = new Date(date);
    this.selectedDate.set(selectedDate);
    this.loadSchedulesForDate(selectedDate);
  }

  openCreateForm() {
    this.scheduleForm.reset({
      date: this.formatDate(this.selectedDate())
    });
    this.showCreateForm.set(true);
    this.showEditForm.set(false);
  }

  openEditForm(schedule: EmployeeSchedule) {
    this.selectedSchedule.set(schedule);
    this.scheduleForm.patchValue({
      employeeId: schedule.employeeId,
      date: this.formatDate(schedule.date.toDate()),
      shifts: schedule.shifts,
      breaks: schedule.breaks
    });
    this.showEditForm.set(true);
    this.showCreateForm.set(false);
  }

  closeForms() {
    this.showCreateForm.set(false);
    this.showEditForm.set(false);
    this.selectedSchedule.set(null);
  }

  async createSchedule() {
    if (this.scheduleForm.invalid) return;

    try {
      this.isLoading.set(true);
      const formValue = this.scheduleForm.value;
      const date = new Date(formValue.date);

      const schedule = await this.scheduleService.createSchedule(
        formValue.employeeId,
        date,
        formValue.shifts || [],
        formValue.breaks || []
      );

      // Reload schedules
      this.loadSchedulesForDate(this.selectedDate());
      this.closeForms();
    } catch (error) {
      console.error('Error creating schedule:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateSchedule() {
    if (this.scheduleForm.invalid || !this.selectedSchedule()) return;

    try {
      this.isLoading.set(true);
      const formValue = this.scheduleForm.value;
      const updates: Partial<EmployeeSchedule> = {
        shifts: formValue.shifts || [],
        breaks: formValue.breaks || []
      };

      await this.scheduleService.updateSchedule(this.selectedSchedule()!.id, updates);

      // Reload schedules
      this.loadSchedulesForDate(this.selectedDate());
      this.closeForms();
    } catch (error) {
      console.error('Error updating schedule:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteSchedule(schedule: EmployeeSchedule) {
    if (!confirm('¿Está seguro de que desea eliminar este horario?')) return;

    try {
      this.isLoading.set(true);
      // Note: The service doesn't have a delete method, so we'll update with empty shifts
      await this.scheduleService.updateSchedule(schedule.id, {
        shifts: [],
        breaks: [],
        totalHours: 0
      });

      // Reload schedules
      this.loadSchedulesForDate(this.selectedDate());
    } catch (error) {
      console.error('Error deleting schedule:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  addShift() {
    if (this.shiftForm.invalid) return;

    const shifts = this.scheduleForm.get('shifts')?.value || [];
    shifts.push(this.shiftForm.value);
    this.scheduleForm.patchValue({ shifts });

    this.shiftForm.reset();
  }

  removeShift(index: number) {
    const shifts = this.scheduleForm.get('shifts')?.value || [];
    shifts.splice(index, 1);
    this.scheduleForm.patchValue({ shifts });
  }

  addBreak() {
    if (this.breakForm.invalid) return;

    const breaks = this.scheduleForm.get('breaks')?.value || [];
    breaks.push(this.breakForm.value);
    this.scheduleForm.patchValue({ breaks });

    this.breakForm.reset();
  }

  removeBreak(index: number) {
    const breaks = this.scheduleForm.get('breaks')?.value || [];
    breaks.splice(index, 1);
    this.scheduleForm.patchValue({ breaks });
  }

  getEmployeeName(employeeId: string): string {
    const employee = this.employees().find(e => e.id === employeeId);
    return employee ? employee.displayName : 'Empleado desconocido';
  }

  formatTimeRange(shift: ShiftConfig): string {
    return `${shift.startTime} - ${shift.endTime}`;
  }

  calculateTotalHours(schedule: EmployeeSchedule): number {
    return this.scheduleService.calculateWorkingHours(schedule.shifts, schedule.breaks);
  }
}