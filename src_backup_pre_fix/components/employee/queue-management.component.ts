import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit, OnDestroy, input, effect } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
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
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { EmployeeScheduleService } from '../../services/employee-schedule.service';
import { QueueService } from '../../services/queue.service';
import { WorkshopCapacityService } from '../../services/workshop-capacity.service';
import { OfflineDetectionService } from '../../services/offline-detection.service';
import { LocalStorageService } from '../../services/local-storage.service';
import { SyncService } from '../../services/sync.service';
import { RetryService } from '../../services/retry.service';
import { UserService } from '../../services/user.service';
import { User, QueueEntry } from '../../models';

@Component({
  selector: 'app-queue-management',
  templateUrl: './queue-management.component.html',
  styleUrls: ['./queue-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatTabsModule, MatChipsModule, MatIconModule, MatButtonModule,
    MatInputModule, MatFormFieldModule, MatProgressBarModule, MatCardModule, MatBadgeModule,
    MatSelectModule, MatDividerModule, MatGridListModule, MatSnackBarModule
  ]
})
export class QueueManagementComponent implements OnInit, OnDestroy {
  isActive = input<boolean>(false);
  authService = inject(AuthService);
  employeeScheduleService = inject(EmployeeScheduleService);
  queueService = inject(QueueService);
  workshopCapacityService = inject(WorkshopCapacityService);
  offlineDetectionService = inject(OfflineDetectionService);
  localStorageService = inject(LocalStorageService);
  syncService = inject(SyncService);
  retryService = inject(RetryService);
  userService = inject(UserService);

  // Queue-related signals
  queueEntries = this.queueService.getQueueEntries();
  queueStatus = this.queueService.getQueueStatus();
  availableTechnicians = signal<User[]>([]);
  waitTimeEstimations = signal<Map<string, number>>(new Map());
  selectedQueueFilter = signal<string>('TODOS');
  queueSearchQuery = signal<string>('');

  // Filter options
  queueFilterOptions = [
    { label: 'TODOS', value: 'TODOS' },
    { label: 'MIS ASIGNADOS', value: 'MIS_ASIGNADOS' },
    { label: 'SIN ASIGNAR', value: 'SIN_ASIGNAR' },
    { label: 'URGENTES', value: 'URGENTES' },
    { label: 'LLAMADOS', value: 'LLAMADOS' }
  ];

  // Offline and sync related signals
  isOnline = this.offlineDetectionService.isOnline;
  connectionQuality = this.offlineDetectionService.connectionQuality;
  syncStatus = this.syncService.syncStatus;

  // Loading and error states
  isLoading = signal(false);
  loadingStates = signal({
    queue: false
  });
  errorStates = signal({
    queue: null as string | null
  });

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Data loading is handled by the isActive input effect
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  constructor() {
    // Load data only when tab becomes active
    effect(() => {
      if (this.isActive()) {
        this.loadQueueData();
      }
    });
  }

  onQueueFilterChange(filter: string): void {
    this.selectedQueueFilter.set(filter);
  }

  onQueueSearchChange(query: string): void {
    this.queueSearchQuery.set(query);
  }

  // Queue data loading
  private async loadQueueData(): Promise<void> {
    this.loadingStates.update(states => ({ ...states, queue: true }));
    this.errorStates.update(errors => ({ ...errors, queue: null }));

    try {
      // Load available technicians
      const today = new Date();
      const technicians = await this.employeeScheduleService.getEmployeesAvailableForService(today);
      this.availableTechnicians.set(technicians);

      // Calculate wait times
      await this.calculateWaitTimes();
    } catch (error) {
      this.errorStates.update(errors => ({ ...errors, queue: 'Error al cargar los datos de la cola' }));
    } finally {
      this.loadingStates.update(states => ({ ...states, queue: false }));
    }
  }

  // Calculate wait times for queue entries
  private async calculateWaitTimes(): Promise<void> {
    try {
      const currentEntries = this.queueEntries().filter(entry =>
        entry.status === 'waiting' || entry.status === 'called'
      );
      const newEstimations = new Map<string, number>();

      for (const entry of currentEntries) {
        try {
          const position = entry.position;
          const capacity = await this.workshopCapacityService.calculateCurrentCapacity().toPromise();

          // Simple estimation: position * average service time / available technicians
          const avgServiceTime = 30; // minutes
          const estimatedWait = Math.max(0, (position - 1) * avgServiceTime / Math.max(1, capacity?.availableTechnicians || 1));

          newEstimations.set(entry.id, Math.round(estimatedWait));
        } catch (error) {
          newEstimations.set(entry.id, 0);
        }
      }

      this.waitTimeEstimations.set(newEstimations);
    } catch (error) {
      console.error('Error calculating wait times:', error);
    }
  }

  // Queue management methods
  async callNextCustomer(): Promise<void> {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    try {
      if (this.isOnline()) {
        const calledEntry = await this.queueService.callNext(currentUser.id);
        if (calledEntry && calledEntry.workOrderId) {
          // Navigate to work order if created
          // this.router.navigate(['/admin/work-orders', calledEntry.workOrderId]);
        }
      } else {
        // Queue operation for offline sync
        this.syncService.addOfflineOperation({
          type: 'queue_entry',
          action: 'create',
          data: { technicianId: currentUser.id, action: 'call_next' }
        });
        // Show offline message
        console.log('Call next operation queued for when connection is restored');
      }
    } catch (error) {
      console.error('Error calling next customer:', error);
      // Try with retry mechanism
      try {
        await this.retryService.execute(
          () => this.queueService.callNext(currentUser.id),
          { maxAttempts: 3 }
        );
      } catch (retryError) {
        console.error('Failed to call next customer after retries:', retryError);
      }
    }
  }

  async reassignQueueEntry(entryId: string, technicianId: string): Promise<void> {
    try {
      const entry = this.queueEntries().find(e => e.id === entryId);
      if (entry) {
        const updatedEntry = { ...entry, assignedTo: technicianId };
        await this.queueService.updateQueueEntry(updatedEntry);
      }
    } catch (error) {
      console.error('Error reassigning queue entry:', error);
    }
  }

  viewQueueEntryDetails(entry: QueueEntry): void {
    // Implementation for viewing entry details
    console.log('Viewing queue entry details:', entry);
  }

  // Computed signals for queue filtering
  filteredQueueEntries = computed(() => {
    const entries = this.queueEntries().filter(entry =>
      entry.status === 'waiting' || entry.status === 'called'
    );
    const filter = this.selectedQueueFilter();
    const query = this.queueSearchQuery().toLowerCase();
    const currentUser = this.authService.currentUser();

    let filtered = entries;

    // Apply status filter
    if (filter !== 'TODOS') {
      switch (filter) {
        case 'MIS_ASIGNADOS':
          filtered = filtered.filter(entry => entry.assignedTo === currentUser?.id);
          break;
        case 'SIN_ASIGNAR':
          filtered = filtered.filter(entry => !entry.assignedTo);
          break;
        case 'URGENTES':
          // Filter for urgent entries - could be based on wait time or priority
          filtered = filtered.filter(entry => this.getQueueEntryWaitTime(entry) > 60);
          break;
        case 'LLAMADOS':
          filtered = filtered.filter(entry => entry.status === 'called');
          break;
      }
    }

    // Apply search filter
    if (query) {
      filtered = filtered.filter(entry =>
        entry.customerId?.toLowerCase().includes(query) ||
        entry.serviceType?.toLowerCase().includes(query) ||
        entry.notes?.toLowerCase().includes(query)
      );
    }

    return filtered;
  });

  // Queue statistics
  queueStats = computed(() => {
    const entries = this.queueEntries();
    const waiting = entries.filter(e => e.status === 'waiting').length;
    const called = entries.filter(e => e.status === 'called').length;
    const avgWaitTime = this.queueStatus()?.averageWaitTime || 0;
    const technicians = this.availableTechnicians().length;

    return {
      totalInQueue: waiting + called,
      averageWaitTime: avgWaitTime,
      techniciansAvailable: technicians,
      waitingCount: waiting,
      calledCount: called
    };
  });

  // Helper methods for queue display
  getQueueEntryClientInfo(entry: QueueEntry): User | undefined {
    return this.userService.getUserById(entry.customerId);
  }

  getQueueEntryWaitTime(entry: QueueEntry): number {
    return this.waitTimeEstimations().get(entry.id) || 0;
  }

  getQueueEntryStatusText(status: string): string {
    switch (status) {
      case 'waiting': return 'Esperando';
      case 'called': return 'Llamado';
      default: return status;
    }
  }

  getQueueEntryStatusColor(status: string): string {
    switch (status) {
      case 'waiting': return 'accent';
      case 'called': return 'primary';
      default: return 'basic';
    }
  }

  // TrackBy function for ngFor performance
  trackByQueueEntryId(index: number, entry: QueueEntry): string {
    return entry.id;
  }
}