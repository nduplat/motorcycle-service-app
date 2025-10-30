import { ChangeDetectionStrategy, Component, input, output, signal, computed, inject } from '@angular/core';
import { AppointmentService } from '../../services/appointment.service';
import { Appointment } from '../../models';

@Component({
  selector: 'app-employee-calendar',
  template: `
    <div class="space-y-4">
      <!-- Week Navigation -->
      <div class="flex justify-between items-center">
        <button (click)="previousWeek()" class="px-3 py-1 bg-secondary rounded-md hover:bg-secondary/80">&larr;</button>
        <h3 class="font-semibold">{{ currentWeekLabel() }}</h3>
        <button (click)="nextWeek()" class="px-3 py-1 bg-secondary rounded-md hover:bg-secondary/80">&rarr;</button>
      </div>

      <!-- Calendar Grid -->
      <div class="grid grid-cols-7 gap-2">
        @for (day of weekDays(); track day.date.getTime()) {
          <div
            class="min-h-[100px] border border-border rounded-lg p-2 cursor-pointer hover:bg-secondary/50 transition-colors"
            [class.bg-primary/10]="day.isToday"
            [class.ring-2]="selectedDate()?.toDateString() === day.date.toDateString()"
            [class.ring-primary]="selectedDate()?.toDateString() === day.date.toDateString()"
            (click)="selectDate(day.date)">
            <div class="text-sm font-medium mb-1">{{ day.dayName }}</div>
            <div class="text-xs text-muted-foreground mb-2">{{ day.dayNumber }}</div>
            <div class="space-y-1">
              @for (apt of day.appointments; track apt.id) {
                <div class="text-xs bg-primary/20 rounded px-1 py-0.5 truncate" [title]="apt.serviceTypes.join(', ')">
                  {{ apt.scheduledAt.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) }}
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Daily Schedule Section -->
      @if (selectedDate() && dailyAppointments().length > 0) {
        <div class="mt-6">
          <h4 class="font-semibold mb-4 text-lg">
            Horario del {{ selectedDate()?.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
          </h4>
          <div class="space-y-3">
            @for (apt of sortedDailyAppointments(); track apt.id) {
              <div class="bg-secondary/50 rounded-lg p-4 border border-border">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <h5 class="font-semibold">{{ apt.serviceTypes.join(', ') }}</h5>
                    <p class="text-sm text-muted-foreground">
                      {{ apt.scheduledAt.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) }} -
                      {{ getEndTime(apt) }}
                    </p>
                  </div>
                  <span class="px-2 py-1 text-xs rounded-full"
                        [class]="getStatusClass(apt.status)">
                    {{ getStatusText(apt.status) }}
                  </span>
                </div>
                <div class="text-sm text-muted-foreground">
                  <p>Cliente: {{ apt.customerId }}</p>
                  <p>Duración: {{ apt.estimatedDuration }} minutos</p>
                  @if (apt.notes) {
                    <p>Notas: {{ apt.notes }}</p>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      } @else if (selectedDate()) {
        <div class="mt-6 text-center py-8 text-muted-foreground">
          <p>No hay citas programadas para este día.</p>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeCalendarComponent {
  private appointmentService = inject(AppointmentService);

  employeeId = input.required<string>();
  selectedDate = input<Date>();
  dateSelected = output<Date>();

  currentWeekStart = signal(this.getWeekStart(new Date()));

  currentWeekLabel = computed(() => {
    const start = this.currentWeekStart();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  });

  weekDays = computed(() => {
    const start = this.currentWeekStart();
    const days: { date: Date; dayName: string; dayNumber: number; isToday: boolean; appointments: Appointment[] }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);

      const appointments = this.appointmentService.getAppointmentsForDate(date)
        .filter(apt => apt.assignedTo === this.employeeId());

      days.push({
        date,
        dayName: date.toLocaleDateString('es-CO', { weekday: 'short' }),
        dayNumber: date.getDate(),
        isToday: this.isToday(date),
        appointments
      });
    }

    return days;
  });

  dailyAppointments = computed(() => {
    if (!this.selectedDate()) return [];
    return this.appointmentService.getAppointmentsForDate(this.selectedDate()!)
      .filter(apt => apt.assignedTo === this.employeeId());
  });

  sortedDailyAppointments = computed(() =>
    [...this.dailyAppointments()].sort((a, b) =>
      a.scheduledAt.toDate().getTime() - b.scheduledAt.toDate().getTime()
    )
  );

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Adjust for Sunday start
    return new Date(d.setDate(diff));
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
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

  selectDate(date: Date): void {
    this.dateSelected.emit(date);
  }

  getEndTime(apt: Appointment): string {
    const start = apt.scheduledAt.toDate();
    const end = new Date(start.getTime() + apt.estimatedDuration * 60000);
    return end.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  getStatusClass(status: Appointment['status']): string {
    switch (status) {
      case 'scheduled':
        return 'bg-green-100 text-green-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusText(status: Appointment['status']): string {
    switch (status) {
      case 'scheduled':
        return 'Programada';
      case 'confirmed':
        return 'Confirmada';
      case 'in_progress':
        return 'En Progreso';
      case 'completed':
        return 'Completada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  }
}