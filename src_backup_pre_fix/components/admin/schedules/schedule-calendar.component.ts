import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmployeeScheduleService } from '../../../services/employee-schedule.service';
import { EmployeeSchedule, User, ShiftConfig, BreakConfig } from '../../../models';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  schedules: EmployeeSchedule[];
}

interface CalendarEmployee {
  employee: User;
  schedule: EmployeeSchedule | null;
}

@Component({
  selector: 'app-schedule-calendar',
  templateUrl: './schedule-calendar.component.html',
  styleUrls: ['./schedule-calendar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class ScheduleCalendarComponent {
  private scheduleService = inject(EmployeeScheduleService);

  // Signals for reactive state
  currentDate = signal(new Date());
  employees = signal<User[]>([]);
  calendarDays = signal<CalendarDay[]>([]);
  isLoading = signal(false);
  draggedSchedule: EmployeeSchedule | null = null;
  draggedShift: ShiftConfig | null = null;

  // Calendar navigation
  monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  constructor() {
    this.loadEmployees();
    this.generateCalendar();
  }

  async loadEmployees() {
    try {
      this.isLoading.set(true);
      const employees = await this.scheduleService.getEmployeesAvailableForService(new Date());
      this.employees.set(employees);
      await this.loadSchedulesForMonth();
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadSchedulesForMonth() {
    try {
      const currentDate = this.currentDate();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      // Get first and last day of the month
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      // Load schedules for all days in the month for all employees
      const allSchedules: EmployeeSchedule[] = [];

      for (let date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
        for (const employee of this.employees()) {
          const schedule = await this.scheduleService.getEmployeeSchedule(employee.id, date);
          if (schedule) {
            allSchedules.push(schedule);
          }
        }
      }

      // Update calendar days with schedules
      this.updateCalendarWithSchedules(allSchedules);
    } catch (error) {
      console.error('Error loading schedules for month:', error);
    }
  }

  generateCalendar() {
    const currentDate = this.currentDate();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay())); // End on Saturday

    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      days.push({
        date: new Date(date),
        isCurrentMonth: date.getMonth() === month,
        isToday: date.getTime() === today.getTime(),
        schedules: []
      });
    }

    this.calendarDays.set(days);
  }

  updateCalendarWithSchedules(schedules: EmployeeSchedule[]) {
    const days = this.calendarDays();
    const updatedDays = days.map(day => ({
      ...day,
      schedules: schedules.filter(schedule =>
        schedule.date.toDate().toDateString() === day.date.toDateString()
      )
    }));
    this.calendarDays.set(updatedDays);
  }

  navigateMonth(direction: number) {
    const newDate = new Date(this.currentDate());
    newDate.setMonth(newDate.getMonth() + direction);
    this.currentDate.set(newDate);
    this.generateCalendar();
    this.loadSchedulesForMonth();
  }

  goToToday() {
    this.currentDate.set(new Date());
    this.generateCalendar();
    this.loadSchedulesForMonth();
  }

  getEmployeeScheduleForDay(employeeId: string, day: CalendarDay): EmployeeSchedule | null {
    return day.schedules.find(schedule => schedule.employeeId === employeeId) || null;
  }

  getEmployeeShiftsForDay(employeeId: string, day: CalendarDay): ShiftConfig[] {
    const schedule = this.getEmployeeScheduleForDay(employeeId, day);
    return schedule?.shifts || [];
  }

  getEmployeeBreaksForDay(employeeId: string, day: CalendarDay): BreakConfig[] {
    const schedule = this.getEmployeeScheduleForDay(employeeId, day);
    return schedule?.breaks || [];
  }

  // Drag and Drop functionality
  onDragStart(event: DragEvent, schedule: EmployeeSchedule, shift?: ShiftConfig) {
    this.draggedSchedule = schedule;
    this.draggedShift = shift || null;
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', schedule.id);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  async onDrop(event: DragEvent, targetEmployeeId: string, targetDate: Date) {
    event.preventDefault();

    if (!this.draggedSchedule) return;

    try {
      this.isLoading.set(true);

      // Create new schedule for target date with the dragged shift
      const targetDateString = targetDate.toISOString().split('T')[0];
      const sourceDateString = this.draggedSchedule.date.toDate().toISOString().split('T')[0];

      if (targetDateString === sourceDateString && this.draggedSchedule.employeeId === targetEmployeeId) {
        // Same day and employee, no change needed
        return;
      }

      // Check if target already has a schedule
      const existingSchedule = await this.scheduleService.getEmployeeSchedule(targetEmployeeId, targetDate);

      if (existingSchedule) {
        // Update existing schedule
        const updatedShifts = [...existingSchedule.shifts];
        if (this.draggedShift) {
          updatedShifts.push(this.draggedShift);
        }

        await this.scheduleService.updateSchedule(existingSchedule.id, {
          shifts: updatedShifts
        });
      } else {
        // Create new schedule
        const shifts = this.draggedShift ? [this.draggedShift] : this.draggedSchedule.shifts;
        await this.scheduleService.createSchedule(targetEmployeeId, targetDate, shifts, []);
      }

      // Remove shift from source if different day/employee
      if (targetDateString !== sourceDateString || this.draggedSchedule.employeeId !== targetEmployeeId) {
        const sourceShifts = this.draggedSchedule.shifts.filter(shift =>
          !this.draggedShift || shift.id !== this.draggedShift.id
        );

        if (sourceShifts.length === 0) {
          // If no shifts left, we could delete the schedule, but for now just update
          await this.scheduleService.updateSchedule(this.draggedSchedule.id, {
            shifts: [],
            totalHours: 0
          });
        } else {
          await this.scheduleService.updateSchedule(this.draggedSchedule.id, {
            shifts: sourceShifts
          });
        }
      }

      // Reload schedules
      await this.loadSchedulesForMonth();

    } catch (error) {
      console.error('Error moving schedule:', error);
    } finally {
      this.isLoading.set(false);
      this.draggedSchedule = null;
      this.draggedShift = null;
    }
  }

  onDragEnd() {
    this.draggedSchedule = null;
    this.draggedShift = null;
  }

  // Helper methods
  formatTime(timeString: string): string {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  getShiftColor(shift: ShiftConfig): string {
    // Simple color assignment based on shift name
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-pink-100 text-pink-800'
    ];
    const index = shift.name.charCodeAt(0) % colors.length;
    return colors[index];
  }

  getBreakColor(): string {
    return 'bg-red-100 text-red-800';
  }

  getEmployeeName(employeeId: string): string {
    const employee = this.employees().find(e => e.id === employeeId);
    return employee ? employee.displayName : 'Empleado';
  }

  isDayAvailable(employeeId: string, date: Date): boolean {
    // In a real implementation, check if employee is available on this date
    // For now, assume all days are available
    return true;
  }
}