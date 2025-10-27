import { ChangeDetectionStrategy, Component, input, output, signal, computed, inject } from '@angular/core';
import { AppointmentService } from '../../../services/appointment.service';
import { UserService } from '../../../services/user.service';
import { ServiceItem, UserProfile } from '../../../models';

@Component({
  selector: 'app-weekly-availability',
  template: `
    <div class="space-y-6">
      <!-- Week Navigation -->
      <div class="flex justify-between items-center">
        <button (click)="previousWeek()" class="px-3 py-1 bg-secondary rounded-md hover:bg-secondary/80">&larr; Semana Anterior</button>
        <h3 class="font-semibold text-lg">{{ currentWeekLabel() }}</h3>
        <button (click)="nextWeek()" class="px-3 py-1 bg-secondary rounded-md hover:bg-secondary/80">Siguiente Semana &rarr;</button>
      </div>

      <!-- Availability Grid -->
      <div class="overflow-x-auto">
        <div class="min-w-[800px]">
          <!-- Header Row -->
          <div class="grid grid-cols-8 gap-2 mb-4">
            <div class="font-semibold text-center">Empleado</div>
            @for (day of weekDays(); track day.date.getTime()) {
              <div class="text-center">
                <div class="font-semibold">{{ day.dayName }}</div>
                <div class="text-sm text-muted-foreground">{{ day.dayNumber }}</div>
              </div>
            }
          </div>

          <!-- Employee Rows -->
          @for (employee of employees(); track employee.id) {
            <div class="grid grid-cols-8 gap-2 mb-4 p-4 bg-card rounded-lg border border-border">
              <div class="font-medium flex items-center">{{ employee.name }}</div>
              @for (day of weekDays(); track day.date.getTime()) {
                <div class="space-y-1">
                  @for (slot of getAvailableSlots(employee.id, day.date); track slot) {
                    <button
                      (click)="selectSlot(employee.id, day.date, slot)"
                      class="w-full px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 rounded border border-green-300 transition-colors">
                      {{ slot }}
                    </button>
                  }
                  @if (getAvailableSlots(employee.id, day.date).length === 0) {
                    <div class="text-xs text-muted-foreground text-center py-2">No disponible</div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeeklyAvailabilityComponent {
  private appointmentService = inject(AppointmentService);
  private userService = inject(UserService);

  service = input.required<ServiceItem>();
  slotSelected = output<{ employeeId: string; date: Date; time: string }>();

  currentWeekStart = signal(this.getWeekStart(new Date()));

  employees = computed(() => [
    ...this.userService.getUsersByRole('employee'),
    ...this.userService.getUsersByRole('technician')
  ]);

  currentWeekLabel = computed(() => {
    const start = this.currentWeekStart();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  });

  weekDays = computed(() => {
    const start = this.currentWeekStart();
    const days: { date: Date; dayName: string; dayNumber: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push({
        date,
        dayName: date.toLocaleDateString('es-CO', { weekday: 'short' }),
        dayNumber: date.getDate()
      });
    }

    return days;
  });

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Adjust for Sunday start
    return new Date(d.setDate(diff));
  }

  getAvailableSlots(employeeId: string, date: Date): string[] {
    const duration = (this.service().estimatedHours ?? 1) * 60;
    return this.appointmentService.getAvailableSlots(date, employeeId, duration);
  }

  previousWeek(): void {
    const newStart = new Date(this.currentWeekStart());
    newStart.setDate(newStart.getDate() - 7);
    this.currentWeekStart.set(newStart);
  }

  nextWeek(): void {
    const newStart = new Date(this.currentWeekStart());
    newStart.setDate(newStart.getDate() + 7);
    this.currentWeekStart.set(newStart);
  }

  selectSlot(employeeId: string, date: Date, time: string): void {
    this.slotSelected.emit({ employeeId, date, time });
  }
}