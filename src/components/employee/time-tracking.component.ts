import { ChangeDetectionStrategy, Component, inject, signal, OnInit, OnDestroy, computed, input, effect } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../services/auth.service';
import { TimeEntryService } from '../../services/time-entry.service';
import { UserService } from '../../services/user.service';
import { MotorcycleService } from '../../services/motorcycle.service';
import { TimeEntry, User, Motorcycle } from '../../models';

@Component({
  selector: 'app-time-tracking',
  templateUrl: './time-tracking.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatTabsModule, MatChipsModule, MatIconModule, MatButtonModule,
    MatInputModule, MatFormFieldModule, MatProgressBarModule, MatCardModule, MatBadgeModule
  ]
})
export class TimeTrackingComponent implements OnInit, OnDestroy {
  isActive = input<boolean>(false);
  authService = inject(AuthService);
  timeEntryService = inject(TimeEntryService);
  userService = inject(UserService);
  motorcycleService = inject(MotorcycleService);

  currentUser = this.authService.currentUser;

  // Time tracking signals
  todaysTimeEntries = signal<TimeEntry[]>([]);
  timeHistoryLoading = signal(false);
  isTimerPaused = signal(false);
  currentTimeEntry = signal<TimeEntry | null>(null);
  elapsedTime = signal(0);

  // Additional data signals
  clients = signal<User[]>([]);
  vehicles = signal<Motorcycle[]>([]);

  // Loading and error states
  loadingStates = signal({
    timeEntry: false,
    timeHistory: false
  });
  errorStates = signal({
    timeEntry: null as string | null,
    timeHistory: null as string | null
  });

  private destroy$ = new Subject<void>();
  private elapsedTimeInterval?: number;
  private dataLoaded = false;

  constructor() {
    // Update elapsed time every minute
    this.elapsedTimeInterval = window.setInterval(() => {
      this.elapsedTime.set(this.timeEntryService.getElapsedTime());
      this.isTimerPaused.set(this.timeEntryService.isTimeEntryPaused(this.currentUser()?.id || ''));
    }, 60000);

    // Load data only when tab becomes active
    effect(() => {
      if (this.isActive()) {
        this.loadTimeData();
      }
    });
  }

  ngOnInit(): void {
    // Data loading is handled by the effect in constructor
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.elapsedTimeInterval) {
      clearInterval(this.elapsedTimeInterval);
    }
  }

  // Lazy load time data when tab is activated
  loadTimeData(): void {
    if (this.dataLoaded) return;

    const user = this.currentUser();
    if (!user) return;

    this.dataLoaded = true;
    this.loadCurrentTimeEntry(user.id);
    this.loadTodaysTimeEntries(user.id);
    this.loadAdditionalData();
  }

  private async loadCurrentTimeEntry(userId: string): Promise<void> {
    this.loadingStates.update(states => ({ ...states, timeEntry: true }));
    this.errorStates.update(errors => ({ ...errors, timeEntry: null }));

    try {
      const activeEntry = await this.timeEntryService.getActiveTimeEntry(userId);
      this.currentTimeEntry.set(activeEntry);
      const elapsed = this.timeEntryService.getElapsedTime();
      this.elapsedTime.set(elapsed);
    } catch (error) {
      this.currentTimeEntry.set(null);
      this.elapsedTime.set(0);
      this.errorStates.update(errors => ({ ...errors, timeEntry: 'Error al cargar el temporizador activo' }));
    } finally {
      this.loadingStates.update(states => ({ ...states, timeEntry: false }));
    }
  }

  private async loadTodaysTimeEntries(userId: string): Promise<void> {
    this.loadingStates.update(states => ({ ...states, timeHistory: true }));
    this.errorStates.update(errors => ({ ...errors, timeHistory: null }));

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const entries = await this.timeEntryService.getTimeEntriesForTechnician(userId, today, tomorrow);
      this.todaysTimeEntries.set(entries);
    } catch (error) {
      this.todaysTimeEntries.set([]);
      this.errorStates.update(errors => ({ ...errors, timeHistory: 'Error al cargar el historial de tiempo' }));
    } finally {
      this.loadingStates.update(states => ({ ...states, timeHistory: false }));
    }
  }

  private async loadAdditionalData(): Promise<void> {
    try {
      this.clients.set(this.userService.getUsers()());
      this.vehicles.set(this.motorcycleService.getMotorcycles()());
    } catch (error) {
      console.error('Error loading additional data:', error);
    }
  }

  // Timer control methods
  async startWorkTimer(workOrderId: string): Promise<void> {
    try {
      const user = this.currentUser();
      if (!user) return;

      await this.timeEntryService.startTimeEntry(workOrderId, user.id);
      await this.loadCurrentTimeEntry(user.id);
      await this.loadTodaysTimeEntries(user.id);
    } catch (error) {
      // Error handled silently
    }
  }

  async stopWorkTimer(): Promise<void> {
    try {
      const user = this.currentUser();
      if (!user) return;

      await this.timeEntryService.stopTimeEntry(user.id);
      await this.loadCurrentTimeEntry(user.id);
      await this.loadTodaysTimeEntries(user.id);
    } catch (error) {
      // Error handled silently
    }
  }

  async pauseWorkTimer(reason?: string): Promise<void> {
    try {
      const user = this.currentUser();
      if (!user) return;

      await this.timeEntryService.pauseTimeEntry(user.id, reason);
      this.isTimerPaused.set(true);
    } catch (error) {
      // Error handled silently
    }
  }

  async resumeWorkTimer(): Promise<void> {
    try {
      const user = this.currentUser();
      if (!user) return;

      await this.timeEntryService.resumeTimeEntry(user.id);
      this.isTimerPaused.set(false);
    } catch (error) {
      // Error handled silently
    }
  }

  // Computed signals for time tracking
  todaysTotalTime = computed(() => {
    const entries = this.todaysTimeEntries();
    return entries.reduce((total, entry) => total + (entry.minutes || 0), 0);
  });

  todaysActiveTime = computed(() => {
    const activeEntry = this.currentTimeEntry();
    if (!activeEntry) return 0;
    return this.elapsedTime();
  });

  todaysEfficiency = computed(() => {
    const totalTime = this.todaysTotalTime();
    const activeTime = this.todaysActiveTime();
    const totalTracked = totalTime + activeTime;
    if (totalTracked === 0) return 0;

    const completedEntries = this.todaysTimeEntries().filter(entry => entry.endAt).length;
    const totalEntries = this.todaysTimeEntries().length + (this.currentTimeEntry() ? 1 : 0);

    return totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 0;
  });

  // Helper methods
  getClientInfo(clientId: string): User | undefined {
    return this.clients().find(client => client.id === clientId);
  }

  getVehicleInfo(vehicleId: string): Motorcycle | undefined {
    return this.vehicles().find(vehicle => vehicle.id === vehicleId);
  }

  getTimeEntryWorkOrderName(timeEntry: TimeEntry): string {
    // This would need work order data - for now return basic info
    return `Orden ${timeEntry.workOrderId}`;
  }

  getTimeEntryDuration(timeEntry: TimeEntry): number {
    if (timeEntry.endAt) {
      return timeEntry.minutes || 0;
    } else if (timeEntry.id === this.currentTimeEntry()?.id) {
      return this.elapsedTime();
    }
    return 0;
  }

  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  // TrackBy function for ngFor performance
  trackByTimeEntryId(index: number, entry: TimeEntry): string {
    return entry.id;
  }
}