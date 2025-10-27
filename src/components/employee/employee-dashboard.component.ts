import { ChangeDetectionStrategy, Component, inject, signal, OnInit, OnDestroy, effect, computed } from '@angular/core';
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
import { WorkOrderService } from '../../services/work-order.service';
import { TimeEntryService } from '../../services/time-entry.service';
import { TechnicianMetricsService } from '../../services/technician-metrics.service';
import { UserService } from '../../services/user.service';
import { MotorcycleService } from '../../services/motorcycle.service';
import { ServiceItemService } from '../../services/service-item.service';
import { QueueService } from '../../services/queue.service';
import { WorkshopCapacityService } from '../../services/workshop-capacity.service';
import { OfflineDetectionService } from '../../services/offline-detection.service';
import { LocalStorageService } from '../../services/local-storage.service';
import { SyncService } from '../../services/sync.service';
import { RetryService } from '../../services/retry.service';
import { EmployeeCalendarComponent } from './employee-calendar.component';
import { EmployeeNotificationsComponent } from './employee-notifications.component';
import { CodeValidatorComponent } from './code-validator.component';
import { HeaderComponent } from '../shared/header/header.component';
import { AvailabilityToggleComponent } from '../shared/availability-toggle.component';
import { EmployeeSchedule, WorkOrder, TimeEntry, TechnicianMetrics, UserProfile, Role, User, Motorcycle, ServiceItem, QueueEntry } from '../../models';
import { db } from '../../firebase.config';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-employee-dashboard',
  templateUrl: './employee-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatTabsModule, MatChipsModule, MatIconModule, MatButtonModule,
    MatInputModule, MatFormFieldModule, MatProgressBarModule, MatCardModule, MatBadgeModule,
    MatSelectModule, MatDividerModule, MatGridListModule, MatSnackBarModule,
    EmployeeNotificationsComponent, HeaderComponent
  ]
})
export class EmployeeDashboardComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  employeeScheduleService = inject(EmployeeScheduleService);
  workOrderService = inject(WorkOrderService);
  timeEntryService = inject(TimeEntryService);
  technicianMetricsService = inject(TechnicianMetricsService);
  userService = inject(UserService);
  motorcycleService = inject(MotorcycleService);
  serviceItemService = inject(ServiceItemService);
  queueService = inject(QueueService);
  workshopCapacityService = inject(WorkshopCapacityService);
  offlineDetectionService = inject(OfflineDetectionService);
  localStorageService = inject(LocalStorageService);
  syncService = inject(SyncService);
  retryService = inject(RetryService);

  currentUser = this.authService.currentUser;
  selectedDate = signal(new Date());

  // Tab state management
  activeTabIndex = signal(0);
  tabs = [
    { label: 'Mis Trabajos', value: 'trabajos' },
    { label: 'Cola', value: 'cola' },
    { label: 'Tiempo', value: 'tiempo' },
    { label: 'Métricas', value: 'metricas' },
    { label: 'Notificaciones', value: 'notificaciones' }
  ];

  // New signals for dashboard data
  dailySchedule = signal<EmployeeSchedule | null>(null);
  assignedJobs = signal<WorkOrder[]>([]);
  currentTimeEntry = signal<TimeEntry | null>(null);
  elapsedTime = signal(0);
  personalEfficiencyHistory = signal<TechnicianMetrics | null>(null);

  // Metrics signals
  metricsPeriod = signal<'daily' | 'weekly' | 'monthly'>('monthly');
  currentMetrics = signal<TechnicianMetrics | null>(null);
  teamMetrics = signal<TechnicianMetrics[]>([]);
  metricsHistory = signal<TechnicianMetrics[]>([]);
  metricsLoading = signal(false);
  metricsError = signal<string | null>(null);

  // Time tracking signals
  todaysTimeEntries = signal<TimeEntry[]>([]);
  timeHistoryLoading = signal(false);
  isTimerPaused = signal(false);

  // Queue-related signals
  queueEntries = this.queueService.getQueueEntries();
  queueStatus = this.queueService.getQueueStatus();
  availableTechnicians = signal<User[]>([]);
  waitTimeEstimations = signal<Map<string, number>>(new Map());
  selectedQueueFilter = signal<string>('TODOS');
  queueSearchQuery = signal<string>('');

  // Filter and search signals
  selectedFilter = signal<string>('TODOS');
  searchQuery = signal<string>('');
  filteredJobs = computed(() => {
    const jobs = this.assignedJobs();
    const filter = this.selectedFilter();
    const query = this.searchQuery().toLowerCase();

    let filtered = jobs;

    // Apply status filter
    if (filter !== 'TODOS') {
      switch (filter) {
        case 'PENDIENTES':
          filtered = filtered.filter(job => job.status === 'open');
          break;
        case 'EN PROGRESO':
          filtered = filtered.filter(job => job.status === 'in_progress');
          break;
        case 'PAUSADOS':
          filtered = filtered.filter(job => job.status === 'waiting_parts');
          break;
        case 'HOY':
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          filtered = filtered.filter(job => {
            const createdDate = job.createdAt.toDate();
            return createdDate >= today && createdDate < tomorrow;
          });
          break;
      }
    }

    // Apply search filter
    if (query) {
      filtered = filtered.filter(job => {
        const client = this.getClientInfo(job.clientId);
        const vehicle = this.getVehicleInfo(job.vehicleId);
        return (
          job.number?.toLowerCase().includes(query) ||
          client?.name?.toLowerCase().includes(query) ||
          client?.email?.toLowerCase().includes(query) ||
          vehicle?.plate?.toLowerCase().includes(query) ||
          vehicle?.brand?.toLowerCase().includes(query) ||
          vehicle?.model?.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  });

  // Additional data signals
  clients = signal<User[]>([]);
  vehicles = signal<Motorcycle[]>([]);
  services = signal<ServiceItem[]>([]);

  // Real-time subscription
  private workOrdersUnsubscribe?: () => void;

  // Offline and sync related signals
  isOnline = this.offlineDetectionService.isOnline;
  connectionQuality = this.offlineDetectionService.connectionQuality;
  syncStatus = this.syncService.syncStatus;
  cachedWorkOrders = signal<WorkOrder[]>([]);
  cachedQueueEntries = signal<QueueEntry[]>([]);

  // Loading and error states
  isLoading = signal(false);
  loadingStates = signal({
    schedule: false,
    jobs: false,
    metrics: false,
    timeEntry: false,
    timeHistory: false,
    teamMetrics: false,
    metricsHistory: false,
    sync: false
  });
  errorStates = signal({
    schedule: null as string | null,
    jobs: null as string | null,
    metrics: null as string | null,
    timeEntry: null as string | null,
    timeHistory: null as string | null,
    teamMetrics: null as string | null,
    metricsHistory: null as string | null,
    sync: null as string | null
  });

  private destroy$ = new Subject<void>();
  private elapsedTimeInterval?: number;

  // Filter options
  filterOptions = [
    { label: 'TODOS', value: 'TODOS' },
    { label: 'PENDIENTES', value: 'PENDIENTES' },
    { label: 'EN PROGRESO', value: 'EN PROGRESO' },
    { label: 'PAUSADOS', value: 'PAUSADOS' },
    { label: 'HOY', value: 'HOY' }
  ];

  // Queue filter options
  queueFilterOptions = [
    { label: 'TODOS', value: 'TODOS' },
    { label: 'MIS ASIGNADOS', value: 'MIS_ASIGNADOS' },
    { label: 'SIN ASIGNAR', value: 'SIN_ASIGNAR' },
    { label: 'URGENTES', value: 'URGENTES' },
    { label: 'LLAMADOS', value: 'LLAMADOS' }
  ];

  constructor() {
    // Watch for user changes and load data immediately
    effect(() => {
      const user = this.currentUser();
      if (user && !this.isLoading()) {
        this.isLoading.set(true);
        this.loadDashboardData(user.id).finally(() => this.isLoading.set(false));
        this.loadCurrentTimeEntry(user.id);
        this.setupRealTimeUpdates(user.id);
        this.loadQueueData();
        this.loadCachedData();
      }
    });

    // Update elapsed time every minute
    this.elapsedTimeInterval = window.setInterval(() => {
      this.elapsedTime.set(this.timeEntryService.getElapsedTime());
      this.isTimerPaused.set(this.timeEntryService.isTimeEntryPaused(this.currentUser()?.id || ''));
    }, 60000);

    // Setup offline/online event handlers
    this.setupOfflineHandlers();
  }

  ngOnInit(): void {
    // Initial load is handled by the effect in constructor
  }

  onDateSelected(date: Date): void {
    this.selectedDate.set(date);
    this.loadDailySchedule();
  }

  onTabChange(index: number): void {
    this.activeTabIndex.set(index);
  }

  private async loadDashboardData(userId: string): Promise<void> {
    await Promise.all([
      this.loadDailySchedule(),
      this.loadAssignedJobs(userId),
      this.loadPersonalEfficiencyHistory(userId),
      this.loadAdditionalData(),
      this.loadTodaysTimeEntries(userId),
      this.loadMetricsData(userId)
    ]);
  }

  private async loadDailySchedule(): Promise<void> {
    this.loadingStates.update(states => ({ ...states, schedule: true }));
    this.errorStates.update(errors => ({ ...errors, schedule: null }));

    try {
      const user = this.currentUser();
      if (!user) return;

      const schedule = await this.employeeScheduleService.getEmployeeSchedule(user.id, this.selectedDate());
      this.dailySchedule.set(schedule);
    } catch (error) {
      this.dailySchedule.set(null);
      this.errorStates.update(errors => ({ ...errors, schedule: 'Error al cargar el horario diario' }));
    } finally {
      this.loadingStates.update(states => ({ ...states, schedule: false }));
    }
  }

  private async loadAssignedJobs(userId: string): Promise<void> {
    this.loadingStates.update(states => ({ ...states, jobs: true }));
    this.errorStates.update(errors => ({ ...errors, jobs: null }));

    try {
      // Query work orders using indexed query with assignedTo and status
      const workOrdersQuery = query(
        collection(db, 'workOrders'),
        where('assignedTo', '==', userId),
        where('status', 'in', ['open', 'in_progress'])
      );
      const querySnapshot = await getDocs(workOrdersQuery);
      const workOrders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder))
        .sort((a, b) => {
          // Sort by priority (assuming higher priority number = higher priority)
          // For now, sort by status (in_progress first) then by created date
          if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
          if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
          return b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime();
        });

      this.assignedJobs.set(workOrders);
    } catch (error) {
      this.assignedJobs.set([]);
      this.errorStates.update(errors => ({ ...errors, jobs: 'Error al cargar los trabajos asignados' }));
    } finally {
      this.loadingStates.update(states => ({ ...states, jobs: false }));
    }
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
      // Fallback to no active entry
      this.currentTimeEntry.set(null);
      this.elapsedTime.set(0);
      this.errorStates.update(errors => ({ ...errors, timeEntry: 'Error al cargar el temporizador activo' }));
    } finally {
      this.loadingStates.update(states => ({ ...states, timeEntry: false }));
    }
  }

  private async loadPersonalEfficiencyHistory(userId: string): Promise<void> {
    this.loadingStates.update(states => ({ ...states, metrics: true }));
    this.errorStates.update(errors => ({ ...errors, metrics: null }));

    try {
      const metrics = await this.technicianMetricsService.getTechnicianMetrics(userId, this.metricsPeriod()).toPromise();
      this.personalEfficiencyHistory.set(metrics ?? null);
      this.currentMetrics.set(metrics ?? null);
    } catch (error) {
      this.personalEfficiencyHistory.set(null);
      this.currentMetrics.set(null);
      this.errorStates.update(errors => ({ ...errors, metrics: 'Error al cargar las métricas de eficiencia' }));
    } finally {
      this.loadingStates.update(states => ({ ...states, metrics: false }));
    }
  }

  private async loadMetricsData(userId: string): Promise<void> {
    await Promise.all([
      this.loadTeamMetrics(),
      this.loadMetricsHistory(userId)
    ]);
  }

  private async loadTeamMetrics(): Promise<void> {
    this.loadingStates.update(states => ({ ...states, teamMetrics: true }));
    this.errorStates.update(errors => ({ ...errors, teamMetrics: null }));

    try {
      const teamMetrics = await this.technicianMetricsService.getAllTechnicianMetrics(this.metricsPeriod()).toPromise();
      this.teamMetrics.set(teamMetrics || []);
    } catch (error) {
      this.teamMetrics.set([]);
      this.errorStates.update(errors => ({ ...errors, teamMetrics: 'Error al cargar las métricas del equipo' }));
    } finally {
      this.loadingStates.update(states => ({ ...states, teamMetrics: false }));
    }
  }

  private async loadMetricsHistory(userId: string): Promise<void> {
    this.loadingStates.update(states => ({ ...states, metricsHistory: true }));
    this.errorStates.update(errors => ({ ...errors, metricsHistory: null }));

    try {
      const history = await this.technicianMetricsService.getTechnicianMetricsHistory(userId, 6).toPromise();
      this.metricsHistory.set(history || []);
    } catch (error) {
      this.metricsHistory.set([]);
      this.errorStates.update(errors => ({ ...errors, metricsHistory: 'Error al cargar el historial de métricas' }));
    } finally {
      this.loadingStates.update(states => ({ ...states, metricsHistory: false }));
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.elapsedTimeInterval) {
      clearInterval(this.elapsedTimeInterval);
    }
    if (this.workOrdersUnsubscribe) {
      this.workOrdersUnsubscribe();
    }
  }

  // Filter methods
  onFilterChange(filter: string): void {
    this.selectedFilter.set(filter);
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
  }

  onQueueFilterChange(filter: string): void {
    this.selectedQueueFilter.set(filter);
  }

  onQueueSearchChange(query: string): void {
    this.queueSearchQuery.set(query);
  }

  onMetricsPeriodChange(period: 'daily' | 'weekly' | 'monthly'): void {
    this.metricsPeriod.set(period);
    const user = this.currentUser();
    if (user) {
      this.loadPersonalEfficiencyHistory(user.id);
      this.loadTeamMetrics();
    }
  }

  // Helper methods for getting related data
  getClientInfo(clientId: string): User | undefined {
    return this.clients().find(client => client.id === clientId);
  }

  getVehicleInfo(vehicleId: string): Motorcycle | undefined {
    return this.vehicles().find(vehicle => vehicle.id === vehicleId);
  }

  getServiceInfo(serviceId: string): ServiceItem | undefined {
    return this.services().find(service => service.id === serviceId);
  }

  // Action methods
  async startWorkOrder(workOrder: WorkOrder): Promise<void> {
    const updatedWorkOrder = { ...workOrder, status: 'in_progress' as const };

    try {
      if (this.isOnline()) {
        await this.workOrderService.updateWorkOrder(updatedWorkOrder).toPromise();
      } else {
        // Queue operation for offline sync
        this.syncService.addOfflineOperation({
          type: 'work_order',
          action: 'update',
          data: updatedWorkOrder
        });
        // Update local state immediately
        this.assignedJobs.update(jobs =>
          jobs.map(job => job.id === workOrder.id ? updatedWorkOrder : job)
        );
      }

      await this.startWorkTimer(workOrder.id);
    } catch (error) {
      console.error('Error starting work order:', error);
      // Try with retry mechanism
      try {
        await this.retryService.execute(
          () => this.workOrderService.updateWorkOrder(updatedWorkOrder).toPromise(),
          { maxAttempts: 3 }
        );
      } catch (retryError) {
        console.error('Failed to start work order after retries:', retryError);
      }
    }
  }

  async completeWorkOrder(workOrder: WorkOrder): Promise<void> {
    try {
      if (this.isOnline()) {
        await this.workOrderService.completeWorkOrder(workOrder).toPromise();
      } else {
        // Queue operation for offline sync
        this.syncService.addOfflineOperation({
          type: 'work_order',
          action: 'update',
          data: { ...workOrder, status: 'ready_for_pickup' }
        });
        // Update local state immediately
        this.assignedJobs.update(jobs =>
          jobs.filter(job => job.id !== workOrder.id)
        );
      }

      await this.stopWorkTimer();
    } catch (error) {
      console.error('Error completing work order:', error);
      // Try with retry mechanism
      try {
        await this.retryService.execute(
          () => this.workOrderService.completeWorkOrder(workOrder).toPromise(),
          { maxAttempts: 3 }
        );
      } catch (retryError) {
        console.error('Failed to complete work order after retries:', retryError);
      }
    }
  }

  async pauseWorkOrder(workOrder: WorkOrder): Promise<void> {
    const updatedWorkOrder = { ...workOrder, status: 'waiting_parts' as const };

    try {
      if (this.isOnline()) {
        await this.workOrderService.updateWorkOrder(updatedWorkOrder).toPromise();
      } else {
        // Queue operation for offline sync
        this.syncService.addOfflineOperation({
          type: 'work_order',
          action: 'update',
          data: updatedWorkOrder
        });
        // Update local state immediately
        this.assignedJobs.update(jobs =>
          jobs.map(job => job.id === workOrder.id ? updatedWorkOrder : job)
        );
      }

      await this.stopWorkTimer();
    } catch (error) {
      console.error('Error pausing work order:', error);
      // Try with retry mechanism
      try {
        await this.retryService.execute(
          () => this.workOrderService.updateWorkOrder(updatedWorkOrder).toPromise(),
          { maxAttempts: 3 }
        );
      } catch (retryError) {
        console.error('Failed to pause work order after retries:', retryError);
      }
    }
  }

  // Additional data loading
  private async loadAdditionalData(): Promise<void> {
    try {
      // Load clients, vehicles, and services for enhanced display
      this.clients.set(this.userService.getUsers()());
      this.vehicles.set(this.motorcycleService.getMotorcycles()());
      this.services.set(this.serviceItemService.getServices()());
    } catch (error) {
      console.error('Error loading additional data:', error);
    }
  }

  // Load cached data for offline support
  private async loadCachedData(): Promise<void> {
    try {
      // Load cached work orders and queue entries
      const cachedWorkOrders = this.localStorageService.getCachedWorkOrders();
      const cachedQueueEntries = this.localStorageService.getCachedQueueEntries();

      this.cachedWorkOrders.set(cachedWorkOrders);
      this.cachedQueueEntries.set(cachedQueueEntries);

      // If offline, use cached data as fallback
      if (!this.isOnline()) {
        if (cachedWorkOrders.length > 0) {
          this.assignedJobs.set(cachedWorkOrders);
        }
        if (cachedQueueEntries.length > 0) {
          // Update queue service with cached data if needed
        }
      }
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  }

  // Setup offline/online event handlers
  private setupOfflineHandlers(): void {
    // Listen for online status changes
    this.offlineDetectionService.getOnlineStatus().subscribe(isOnline => {
      if (isOnline) {
        // Came back online - trigger sync
        this.handleReconnection();
      } else {
        // Went offline - switch to cached data
        this.handleDisconnection();
      }
    });
  }

  // Handle when connection is restored
  private async handleReconnection(): Promise<void> {
    try {
      // Perform sync if there are pending operations
      if (this.syncService.hasPendingOperations()) {
        await this.syncService.performManualSync();
      }

      // Refresh data from server
      const user = this.currentUser();
      if (user) {
        await this.loadDashboardData(user.id);
        await this.loadQueueData();
      }

      // Update cached data
      await this.loadCachedData();
    } catch (error) {
      console.error('Error handling reconnection:', error);
    }
  }

  // Handle when connection is lost
  private handleDisconnection(): void {
    // Switch to cached data if available
    const cachedWorkOrders = this.cachedWorkOrders();
    const cachedQueueEntries = this.cachedQueueEntries();

    if (cachedWorkOrders.length > 0) {
      this.assignedJobs.set(cachedWorkOrders);
    }

    // Show offline indicator
    console.log('Switched to offline mode');
  }

  // Queue data loading
  private async loadQueueData(): Promise<void> {
    try {
      // Load available technicians
      const today = new Date();
      const technicians = await this.employeeScheduleService.getEmployeesAvailableForService(today);
      this.availableTechnicians.set(technicians);

      // Calculate wait times
      await this.calculateWaitTimes();
    } catch (error) {
      console.error('Error loading queue data:', error);
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

  // Real-time updates
  private setupRealTimeUpdates(userId: string): void {
    if (this.workOrdersUnsubscribe) {
      this.workOrdersUnsubscribe();
    }

    const workOrdersQuery = query(
      collection(db, 'workOrders'),
      where('assignedTo', '==', userId),
      where('status', 'in', ['open', 'in_progress', 'waiting_parts'])
    );

    this.workOrdersUnsubscribe = onSnapshot(workOrdersQuery, (snapshot) => {
      const workOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder))
        .sort((a, b) => {
          if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
          if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
          return b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime();
        });

      this.assignedJobs.set(workOrders);
    });
  }

  // Utility methods for UI
  getStatusColor(status: string): string {
    switch (status) {
      case 'open': return 'accent';
      case 'in_progress': return 'primary';
      case 'waiting_parts': return 'warn';
      case 'ready_for_pickup': return 'primary';
      case 'delivered': return 'accent';
      case 'cancelled': return 'warn';
      default: return 'basic';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'open': return 'PENDIENTE';
      case 'in_progress': return 'EN PROGRESO';
      case 'waiting_parts': return 'PAUSADO';
      case 'ready_for_pickup': return 'LISTO PARA ENTREGA';
      case 'delivered': return 'ENTREGADO';
      case 'cancelled': return 'CANCELADO';
      default: return status.toUpperCase();
    }
  }

  getPriorityBadge(workOrder: WorkOrder): { text: string, color: string } {
    // Simple priority logic based on status and creation date
    const daysSinceCreation = (Date.now() - workOrder.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24);

    if (workOrder.status === 'in_progress') {
      return { text: 'ALTA', color: 'warn' };
    } else if (daysSinceCreation > 2) {
      return { text: 'MEDIA', color: 'accent' };
    } else {
      return { text: 'BAJA', color: 'primary' };
    }
  }

  getProgressPercentage(workOrder: WorkOrder): number {
    // Simple progress calculation based on status
    switch (workOrder.status) {
      case 'open': return 0;
      case 'in_progress': return 50;
      case 'waiting_parts': return 25;
      case 'ready_for_pickup': return 100;
      case 'delivered': return 100;
      case 'cancelled': return 0;
      default: return 0;
    }
  }

  // TrackBy function for ngFor performance
  trackByWorkOrderId(index: number, workOrder: WorkOrder): string {
    return workOrder.id;
  }

  trackByQueueEntryId(index: number, entry: QueueEntry): string {
    return entry.id;
  }

  trackByTimeEntryId(index: number, entry: TimeEntry): string {
    return entry.id;
  }

  // Placeholder methods for photos and notes (to be implemented)
  openPhotos(workOrder: WorkOrder): void {
    console.log('Opening photos for work order:', workOrder.id);
    // TODO: Implement photo gallery
  }

  openNotes(workOrder: WorkOrder): void {
    console.log('Opening notes for work order:', workOrder.id);
    // TODO: Implement notes modal
  }

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
    return this.clients().find(client => client.id === entry.customerId);
  }

  getQueueEntryVehicleInfo(entry: QueueEntry): Motorcycle | undefined {
    // Assuming entry has vehicleId, but it might not - adjust based on actual model
    return undefined; // TODO: Add vehicleId to QueueEntry model if needed
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

    // Calculate efficiency based on completed vs active time
    const completedEntries = this.todaysTimeEntries().filter(entry => entry.endAt).length;
    const totalEntries = this.todaysTimeEntries().length + (this.currentTimeEntry() ? 1 : 0);

    return totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 0;
  });

  getTimeEntryWorkOrderName(timeEntry: TimeEntry): string {
    const workOrder = this.assignedJobs().find(job => job.id === timeEntry.workOrderId);
    if (workOrder) {
      const client = this.getClientInfo(workOrder.clientId);
      const vehicle = this.getVehicleInfo(workOrder.vehicleId);
      const clientName = client?.name || 'Cliente desconocido';
      const vehicleInfo = vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Vehículo desconocido';
      return `${workOrder.number || 'Sin número'} - ${clientName} (${vehicleInfo})`;
    }
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

  // Computed signals for metrics
  teamAverageEfficiency = computed(() => {
    const teamMetrics = this.teamMetrics();
    if (teamMetrics.length === 0) return 0;
    const total = teamMetrics.reduce((sum, metric) => sum + metric.efficiencyRate, 0);
    return Math.round(total / teamMetrics.length);
  });

  teamAverageCompletedJobs = computed(() => {
    const teamMetrics = this.teamMetrics();
    if (teamMetrics.length === 0) return 0;
    const total = teamMetrics.reduce((sum, metric) => sum + metric.completedWorkOrders, 0);
    return Math.round(total / teamMetrics.length);
  });

  teamAverageHoursWorked = computed(() => {
    const teamMetrics = this.teamMetrics();
    if (teamMetrics.length === 0) return 0;
    const total = teamMetrics.reduce((sum, metric) => sum + metric.totalHoursWorked, 0);
    return Math.round((total / teamMetrics.length) * 10) / 10;
  });

  personalVsTeamEfficiency = computed(() => {
    const personal = this.currentMetrics()?.efficiencyRate || 0;
    const team = this.teamAverageEfficiency();
    return personal - team;
  });

  personalVsTeamJobs = computed(() => {
    const personal = this.currentMetrics()?.completedWorkOrders || 0;
    const team = this.teamAverageCompletedJobs();
    return personal - team;
  });

  personalVsTeamHours = computed(() => {
    const personal = this.currentMetrics()?.totalHoursWorked || 0;
    const team = this.teamAverageHoursWorked();
    return personal - team;
  });

  // Goal tracking (mock data - would be configurable)
  monthlyGoals = computed(() => ({
    jobs: { current: this.currentMetrics()?.completedWorkOrders || 0, target: 25 },
    hours: { current: this.currentMetrics()?.totalHoursWorked || 0, target: 160 },
    efficiency: { current: this.currentMetrics()?.efficiencyRate || 0, target: 85 }
  }));

  goalProgress = computed(() => {
    const goals = this.monthlyGoals();
    return {
      jobs: Math.min((goals.jobs.current / goals.jobs.target) * 100, 100),
      hours: Math.min((goals.hours.current / goals.hours.target) * 100, 100),
      efficiency: Math.min((goals.efficiency.current / goals.efficiency.target) * 100, 100)
    };
  });

  // Chart data for productivity trends
  productivityChartData = computed(() => {
    const history = this.metricsHistory();
    return history.slice(-6).map(metric => ({
      month: metric.periodStart.toDate().toLocaleDateString('es-CO', { month: 'short' }),
      jobs: metric.completedWorkOrders,
      hours: metric.totalHoursWorked,
      efficiency: metric.efficiencyRate
    })).reverse();
  });

  // Customer satisfaction (mock data - would come from ratings system)
  customerSatisfaction = computed(() => {
    const metrics = this.currentMetrics();
    return metrics?.customerRating || 4.2; // Mock rating
  });

  // Sync methods
  async performManualSync(): Promise<void> {
    this.loadingStates.update(states => ({ ...states, sync: true }));
    this.errorStates.update(errors => ({ ...errors, sync: null }));

    try {
      await this.syncService.performManualSync();
    } catch (error: any) {
      this.errorStates.update(errors => ({ ...errors, sync: error.message || 'Sync failed' }));
      console.error('Manual sync failed:', error);
    } finally {
      this.loadingStates.update(states => ({ ...states, sync: false }));
    }
  }

  async forceRefreshCache(): Promise<void> {
    this.loadingStates.update(states => ({ ...states, sync: true }));
    this.errorStates.update(errors => ({ ...errors, sync: null }));

    try {
      await this.syncService.forceRefreshCache();
      // Reload cached data
      await this.loadCachedData();
    } catch (error: any) {
      this.errorStates.update(errors => ({ ...errors, sync: error.message || 'Cache refresh failed' }));
      console.error('Cache refresh failed:', error);
    } finally {
      this.loadingStates.update(states => ({ ...states, sync: false }));
    }
  }

  // Get connection status text
  getConnectionStatusText(): string {
    if (!this.isOnline()) return 'Sin conexión';
    if (this.connectionQuality() === 'slow') return 'Conexión lenta';
    if (this.connectionQuality() === 'fast') return 'Conexión buena';
    return 'Conectado';
  }

  // Get connection status color
  getConnectionStatusColor(): string {
    if (!this.isOnline()) return 'warn';
    if (this.connectionQuality() === 'slow') return 'accent';
    return 'primary';
  }

  // Get sync status text
  getSyncStatusText(): string {
    const status = this.syncStatus();
    if (status.syncInProgress) return 'Sincronizando...';
    if (status.pendingOperations > 0) return `${status.pendingOperations} pendiente(s)`;
    if (status.lastSyncError) return 'Error de sincronización';
    return 'Sincronizado';
  }

  // Get sync status color
  getSyncStatusColor(): string {
    const status = this.syncStatus();
    if (status.syncInProgress) return 'accent';
    if (status.pendingOperations > 0) return 'warn';
    if (status.lastSyncError) return 'warn';
    return 'primary';
  }

}