import { Injectable, signal, inject, effect } from '@angular/core';
import { WorkOrder, Appointment, ServiceItem, Timestamp, QueueEntry, WorkOrderFilter, WorkOrderStats, TimeEntryMetrics, AppointmentStatus } from '../models';
import { Observable, from, BehaviorSubject, combineLatest } from 'rxjs';
import { map, switchMap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { db } from '../firebase.config';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp, DocumentData, DocumentSnapshot, query, where, orderBy, limit, startAfter, Timestamp as FirebaseTimestamp, onSnapshot, QueryConstraint } from 'firebase/firestore';
import { AppointmentService } from './appointment.service';
import { ServiceItemService } from './service-item.service';
import { StockMovementService } from './stock-movement.service';
import { AuthService } from './auth.service';
import { QrCodeService } from './qr-code.service';
import { EventBusService } from './event-bus.service';
import { OfflineDetectionService } from './offline-detection.service';
import { LocalStorageService } from './local-storage.service';
import { SyncMediatorService } from './sync-mediator.service';

const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
    const data = snapshot.data() as any;
    return { ...data, id: snapshot.id } as T;
};

// Cache interface for work order data
interface WorkOrderCache {
  data: WorkOrder[];
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

@Injectable({
  providedIn: 'root'
})
export class WorkOrderService {
  private workOrders = signal<WorkOrder[]>([]);
  private workOrderStats = signal<WorkOrderStats | null>(null);
  private appointmentService = inject(AppointmentService);
  private serviceItemService = inject(ServiceItemService);
  private stockMovementService = inject(StockMovementService);
  private authService = inject(AuthService);
  private qrCodeService = inject(QrCodeService);
  private eventBus = inject(EventBusService);
  private offlineDetectionService = inject(OfflineDetectionService);
  private localStorageService = inject(LocalStorageService);
  private syncMediator = inject(SyncMediatorService);

  // Real-time subscription
  private realtimeSubscription: any = null;

  // Cache
  private cache: WorkOrderCache | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Offline queue for operations
  private offlineQueue: Array<{
    type: 'create' | 'update' | 'complete';
    data: any;
    timestamp: number;
  }> = [];

  // Logging counters
  private firestoreReadCount = 0;
  private isLoading = false;

  // Track current user ID to prevent duplicate loads
  private currentUserId: string | null = null;

  // Pagination state
  private readonly PAGE_SIZE = 20;
  private lastDoc: any = null;
  private hasMore = signal(true);
  private isLoadingMore = signal(false);

  // Search and filter state
  private searchSubject = new BehaviorSubject<string>('');
  private filterSubject = new BehaviorSubject<WorkOrderFilter>({});

  constructor() {
    // Watch for user changes and reload work orders reactively
    effect(() => {
      const user = this.authService.currentUser();

      if (user && user.id !== this.currentUserId) {
        console.log('🔍 WorkOrderService: User authenticated, starting real-time updates');
        this.currentUserId = user.id;
        this.startRealtimeUpdates();
      } else if (!user && this.currentUserId !== null) {
        console.log('🔍 WorkOrderService: User not authenticated, clearing work orders');
        this.currentUserId = null;
        this.workOrders.set([]);
        this.stopRealtimeUpdates();
      }
    }, { allowSignalWrites: true });

    // Setup search and filter observables
    this.setupSearchAndFilter();

    // Prevent multiple simultaneous loads
    this.loadWorkOrders = this.loadWorkOrders.bind(this);
  }

  private async loadWorkOrders() {
    const currentUser = this.authService.currentUser();

    console.log("🔍 WorkOrderService: Loading work orders - Auth check:", {
      isAuthenticated: !!currentUser,
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      userRole: currentUser?.role
    });

    if (!currentUser) {
      console.warn("🔍 WorkOrderService: No authenticated user - cannot load work orders");
      return;
    }

    // Check if user has permission to load work orders (staff roles only)
    const staffRoles = ['admin', 'manager', 'technician', 'front_desk', 'employee'];
    const isStaff = staffRoles.includes(currentUser.role);

    console.log("🔍 WorkOrderService: Permission check:", {
      userRole: currentUser.role,
      isStaff,
      staffRoles
    });

    if (!isStaff) {
      console.log("🔍 WorkOrderService: User is not staff - skipping work order loading for role:", currentUser.role);
      this.workOrders.set([]);
      return;
    }

    // Prevent multiple simultaneous loads
    if (this.isLoading) {
      console.log("🔍 WorkOrderService: Load already in progress, skipping");
      return;
    }

    this.isLoading = true;

    try {
      // Check cache first
      if (this.cache && (Date.now() - this.cache.timestamp) < this.cache.ttl) {
        this.workOrders.set(this.cache.data);
        this.hasMore.set(false);
        this.lastDoc = null;
        return;
      }

      let baseQuery;
      if (currentUser.role === 'technician') {
        // For technicians, load only their assigned work orders with pagination
        console.log("🔍 WorkOrderService: Loading assigned work orders for technician with pagination");
        baseQuery = query(collection(db, "workOrders"), where("assignedTo", "==", currentUser.id), limit(this.PAGE_SIZE));
      } else {
        // For admins, load all work orders with pagination
        console.log("🔍 WorkOrderService: Loading all work orders for admin/non-technician with pagination");
        baseQuery = query(collection(db, "workOrders"), limit(this.PAGE_SIZE));
      }

      this.firestoreReadCount++;
      console.log(`🔍 WorkOrderService: Firestore read #${this.firestoreReadCount} - Loading initial work orders`);
      const querySnapshot = await getDocs(baseQuery);
      const workOrdersData = querySnapshot.docs.map(doc => fromFirestore<WorkOrder>(doc));
      console.log(`🔍 WorkOrderService: Loaded ${workOrdersData.length} work orders (page 1)`);

      this.workOrders.set(workOrdersData);
      this.lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      this.hasMore.set(workOrdersData.length === this.PAGE_SIZE);

      if (!this.hasMore()) {
        this.cache = {
          data: workOrdersData,
          timestamp: Date.now(),
          ttl: this.CACHE_TTL
        };
      }
    } catch (error: any) {
      console.error("🔍 WorkOrderService: Error fetching work orders:", {
        message: error?.message || 'Unknown error',
        code: error?.code || 'unknown',
        userRole: currentUser?.role,
        isPermissionError: error?.code === 'permission-denied',
        error: error
      });
    } finally {
      this.isLoading = false;
    }
  }

  getWorkOrders() {
    return this.workOrders.asReadonly();
  }

  getPaginationState() {
    return {
      hasMore: this.hasMore.asReadonly(),
      isLoadingMore: this.isLoadingMore.asReadonly()
    };
  }

  getWorkOrderStats() {
    return this.workOrderStats.asReadonly();
  }

  // Search and filter methods
  setSearchTerm(searchTerm: string) {
    this.searchSubject.next(searchTerm);
  }

  setFilter(filter: WorkOrderFilter) {
    this.filterSubject.next(filter);
  }

  getFilteredWorkOrders() {
    return combineLatest([
      this.workOrders.asReadonly(),
      this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()),
      this.filterSubject.asObservable()
    ]).pipe(
      map((combined: any[]) => {
        const workOrdersSignal = combined[0];
        const searchTerm = combined[1];
        const filter = combined[2];
        const workOrders = workOrdersSignal();
        return this.applyFilters(workOrders, searchTerm, filter);
      })
    );
  }

  private applyFilters(workOrders: WorkOrder[], searchTerm: string, filter: WorkOrderFilter): WorkOrder[] {
    let filtered = [...workOrders];

    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(wo =>
        wo.id.toLowerCase().includes(term) ||
        wo.clientId.toLowerCase().includes(term) ||
        wo.vehicleId.toLowerCase().includes(term) ||
        (wo.notes && wo.notes.toLowerCase().includes(term))
      );
    }

    // Apply filters
    if (filter.status && filter.status.length > 0) {
      filtered = filtered.filter(wo => filter.status!.includes(wo.status));
    }

    if (filter.assignedTo && filter.assignedTo.length > 0) {
      filtered = filtered.filter(wo => wo.assignedTo && filter.assignedTo!.includes(wo.assignedTo));
    }

    if (filter.clientId) {
      filtered = filtered.filter(wo => wo.clientId === filter.clientId);
    }

    if (filter.vehicleId) {
      filtered = filtered.filter(wo => wo.vehicleId === filter.vehicleId);
    }

    if (filter.dateRange) {
      filtered = filtered.filter(wo => {
        const createdDate = wo.createdAt.toDate();
        return createdDate >= filter.dateRange!.start && createdDate <= filter.dateRange!.end;
      });
    }

    if (filter.serviceTypes && filter.serviceTypes.length > 0) {
      filtered = filtered.filter(wo =>
        wo.services.some((serviceId: string) => filter.serviceTypes!.includes(serviceId))
      );
    }

    // Apply sorting
    if (filter.sortBy) {
      filtered.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (filter.sortBy) {
          case 'createdAt':
            aValue = a.createdAt.toDate().getTime();
            bValue = b.createdAt.toDate().getTime();
            break;
          case 'updatedAt':
            aValue = (a as any).updatedAt?.toDate().getTime() || a.createdAt.toDate().getTime();
            bValue = (b as any).updatedAt?.toDate().getTime() || b.createdAt.toDate().getTime();
            break;
          case 'totalPrice':
            aValue = a.totalPrice;
            bValue = b.totalPrice;
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          default:
            aValue = a.createdAt.toDate().getTime();
            bValue = b.createdAt.toDate().getTime();
        }

        if (filter.sortOrder === 'desc') {
          return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
        } else {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        }
      });
    }

    // Apply pagination
    if (filter.limit && filter.offset !== undefined) {
      const start = filter.offset;
      const end = start + filter.limit;
      filtered = filtered.slice(start, end);
    }

    return filtered;
  }

  async loadMoreWorkOrders(): Promise<void> {
    if (!this.hasMore() || this.isLoadingMore()) {
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser || !this.lastDoc) {
      return;
    }

    this.isLoadingMore.set(true);

    try {
      let baseQuery;
      if (currentUser.role === 'technician') {
        baseQuery = query(
          collection(db, "workOrders"),
          where("assignedTo", "==", currentUser.id),
          startAfter(this.lastDoc),
          limit(this.PAGE_SIZE)
        );
      } else {
        baseQuery = query(
          collection(db, "workOrders"),
          startAfter(this.lastDoc),
          limit(this.PAGE_SIZE)
        );
      }

      this.firestoreReadCount++;
      console.log(`🔍 WorkOrderService: Firestore read #${this.firestoreReadCount} - Loading more work orders`);
      const querySnapshot = await getDocs(baseQuery);
      const newWorkOrders = querySnapshot.docs.map(doc => fromFirestore<WorkOrder>(doc));
      console.log(`🔍 WorkOrderService: Loaded ${newWorkOrders.length} more work orders`);

      if (newWorkOrders.length > 0) {
        this.workOrders.update(current => [...current, ...newWorkOrders]);
        this.lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      }

      this.hasMore.set(newWorkOrders.length === this.PAGE_SIZE);
    } catch (error: any) {
      console.error("🔍 WorkOrderService: Error loading more work orders:", error);
    } finally {
      this.isLoadingMore.set(false);
    }
  }
  
  getWorkOrder(id: string): Observable<WorkOrder | undefined> {
    return from(new Promise<WorkOrder | undefined>(async (resolve, reject) => {
        try {
            const docRef = doc(db, "workOrders", id);
            this.firestoreReadCount++;
            console.log(`🔍 WorkOrderService: Firestore read #${this.firestoreReadCount} - Getting work order ${id}`);
            const docSnap = await getDoc(docRef);
            if(docSnap.exists()){
                resolve(fromFirestore<WorkOrder>(docSnap));
            } else {
                resolve(undefined);
            }
        } catch(e) { reject(e); }
    }));
  }
  
  createWorkOrder(workOrder: Omit<WorkOrder, 'id' | 'createdAt'>): Observable<WorkOrder> {
    return from(new Promise<WorkOrder>(async (resolve, reject) => {
        try {
            // Check authentication
            const currentUser = this.authService.currentUser();
            if (!currentUser) {
                reject(new Error('User not authenticated'));
                return;
            }

            const workOrderWithTimestamp = {
                ...workOrder,
                createdAt: serverTimestamp(),
            };
            const docRef = await addDoc(collection(db, "workOrders"), workOrderWithTimestamp);
            const newWorkOrder = {
                ...workOrder,
                id: docRef.id,
                createdAt: { toDate: () => new Date() }
            } as WorkOrder;
            this.workOrders.update(wos => [...wos, newWorkOrder]);

            this.invalidateCache();

            resolve(newWorkOrder);
        } catch(e) {
            reject(e);
        }
    }));
  }

  createWorkOrderFromAppointment(appointment: Appointment): Observable<WorkOrder> {
    return from(new Promise<WorkOrder>(async (resolve, reject) => {
      try {
        console.log('🔍 WorkOrderService: Creating work order from appointment', {
          appointmentId: appointment.id,
          appointmentStatus: appointment.status,
          clientId: appointment.clientId,
          vehicleId: appointment.vehicleId,
          serviceId: appointment.serviceId,
          assignedTo: appointment.assignedTo
        });

        const serviceDetails = this.serviceItemService.getServices()().find(s => s.id === appointment.serviceId);
        console.log('🔍 WorkOrderService: Service details lookup', {
          serviceId: appointment.serviceId,
          serviceFound: !!serviceDetails,
          servicePrice: serviceDetails?.price
        });

        const newWorkOrderData = {
          clientId: appointment.clientId,
          vehicleId: appointment.vehicleId,
          status: 'in_progress' as const,
          assignedTo: appointment.assignedTo,
          services: serviceDetails ? [serviceDetails.id] : [],
          products: [],
          totalPrice: serviceDetails?.price || 0,
          createdAt: serverTimestamp(),
        };

        console.log('🔍 WorkOrderService: Work order data prepared', newWorkOrderData);

        const docRef = await addDoc(collection(db, "workOrders"), newWorkOrderData);
        console.log('🔍 WorkOrderService: Work order created in Firestore', { workOrderId: docRef.id });

        const newWorkOrder = {
            ...newWorkOrderData,
            id: docRef.id,
            createdAt: { toDate: () => new Date() }
        } as unknown as WorkOrder;

        this.workOrders.update(wos => [...wos, newWorkOrder]);
        this.invalidateCache();

        console.log('🔍 WorkOrderService: Updating appointment status to IN_PROGRESS', {
          appointmentId: appointment.id,
          workOrderId: docRef.id
        });

        this.appointmentService.updateAppointmentStatus(appointment.id, AppointmentStatus.IN_PROGRESS, docRef.id).subscribe({
          next: (updatedAppointment) => {
            console.log('🔍 WorkOrderService: Appointment status updated successfully', {
              appointmentId: appointment.id,
              newStatus: updatedAppointment?.status,
              workOrderId: updatedAppointment?.workOrderId
            });
          },
          error: (error) => {
            console.error('🔍 WorkOrderService: Failed to update appointment status', {
              appointmentId: appointment.id,
              error: error instanceof Error ? error.message : String(error),
              workOrderId: docRef.id
            });
          }
        });

        console.log('🔍 WorkOrderService: Work order creation completed', { workOrderId: docRef.id });
        resolve(newWorkOrder);
      } catch (e) {
        console.error('🔍 WorkOrderService: Error creating work order from appointment', {
          appointmentId: appointment.id,
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined
        });
        reject(e);
      }
    }));
  }

  updateWorkOrder(updatedWO: WorkOrder): Observable<WorkOrder> {
    return from(new Promise<WorkOrder>(async (resolve, reject) => {
      try {
        // Check authentication
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        const originalWO = this.workOrders().find(wo => wo.id === updatedWO.id);

        // Check if offline - queue operation for later sync
        if (!this.offlineDetectionService.isOnline()) {
          this.syncMediator.notifyOfflineOperationQueued('work_order', updatedWO);

          // Update local state immediately
          this.workOrders.update(wos =>
            wos.map(wo => wo.id === updatedWO.id ? updatedWO : wo)
          );

          // Cache the updated work order
          const cachedWorkOrders = this.localStorageService.getCachedWorkOrders();
          const updatedCache = cachedWorkOrders.map(wo => wo.id === updatedWO.id ? updatedWO : wo);
          if (!updatedCache.find(wo => wo.id === updatedWO.id)) {
            updatedCache.push(updatedWO);
          }
          this.localStorageService.cacheWorkOrders(updatedCache);

          resolve(updatedWO);
          return;
        }

        // Online - update immediately
        const docRef = doc(db, "workOrders", updatedWO.id);
        const { id, ...dataToUpdate } = updatedWO;
        await updateDoc(docRef, { ...dataToUpdate, updatedAt: serverTimestamp() });
        this.workOrders.update(wos =>
          wos.map(wo => wo.id === updatedWO.id ? updatedWO : wo)
        );

        this.invalidateCache();

        if (originalWO && originalWO.status !== updatedWO.status) {
            this.eventBus.emit({
              type: 'work_order.status_changed',
              entity: updatedWO,
              previousStatus: originalWO.status
            });
        }

        resolve(updatedWO);
      } catch (e) {
        reject(e);
      }
    }));
  }
  
  completeWorkOrder(wo: WorkOrder): Observable<WorkOrder> {
    return from(new Promise<WorkOrder>(async (resolve, reject) => {
      try {
        const currentUser = this.authService.currentUser();
        if (!currentUser) throw new Error("User not authenticated");

        await this.stockMovementService.createMovementsForWorkOrder(wo, currentUser.id).toPromise();

        const updatedWO = { ...wo, status: 'ready_for_pickup' as const };
        await this.updateWorkOrder(updatedWO).toPromise();

        // Send service reminder for the vehicle
        const workOrders = this.workOrders().filter(wo2 => wo2.vehicleId === wo.vehicleId && (wo2.status === 'ready_for_pickup' || wo2.status === 'delivered'));
        let lastServiceDate: Date | undefined;
        if (workOrders.length > 0) {
          const lastService = workOrders.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())[0];
          lastServiceDate = lastService.createdAt.toDate();
        }
        this.eventBus.emit({ type: 'work_order.completed', entity: wo, lastServiceDate });

        const appointment = this.appointmentService.getAppointments()().find(a => a.workOrderId === wo.id);
        if (appointment) {
          await this.appointmentService.updateAppointmentStatus(appointment.id, AppointmentStatus.COMPLETED).toPromise();
        }

        resolve(updatedWO);

      } catch(e) {
        reject(e);
      }
    }));
  }

  private invalidateCache(): void {
    this.cache = null;
  }

  // Offline functionality
  isOfflineOperation(operation: any): boolean {
    return !this.offlineDetectionService.isOnline() ||
           operation.type === 'offline_create' ||
           operation.type === 'offline_update';
  }

  queueOfflineOperation(operation: { type: 'create' | 'update' | 'complete'; data: any }): void {
    this.offlineQueue.push({
      ...operation,
      timestamp: Date.now()
    });

    // Store in local storage using existing methods
    this.localStorageService.addToOfflineQueue({
      type: 'work_order',
      action: operation.type === 'complete' ? 'update' : operation.type,
      data: operation.data
    });
  }

  async syncOfflineOperations(): Promise<void> {
    if (!this.offlineDetectionService.isOnline()) {
      return;
    }

    const offlineOps = this.localStorageService.getOfflineOperationsByType('work_order');

    for (const op of offlineOps) {
      try {
        switch (op.action) {
          case 'create':
            await this.createWorkOrder(op.data).toPromise();
            break;
          case 'update':
            // Check if this is a completion operation
            if (op.data.status === 'ready_for_pickup') {
              await this.completeWorkOrder(op.data).toPromise();
            } else {
              await this.updateWorkOrder(op.data).toPromise();
            }
            break;
        }

        // Remove from offline queue
        this.localStorageService.removeFromOfflineQueue(op.id);
      } catch (error) {
        console.error('Failed to sync offline operation:', error);
        // Keep failed operations for retry
      }
    }
  }

  getOfflineQueueLength(): number {
    return this.offlineQueue.length;
  }

  // Enhanced offline data loading
  async loadOfflineWorkOrders(): Promise<void> {
    const offlineData = this.localStorageService.getCachedWorkOrders();
    if (offlineData.length > 0) {
      this.workOrders.set(offlineData);
    }
  }

  // Conflict resolution for offline operations
  async resolveOfflineConflicts(): Promise<void> {
    const offlineOps = this.localStorageService.getOfflineOperationsByType('work_order');

    for (const op of offlineOps) {
      try {
        // Check if the operation conflicts with current server state
        if (op.action === 'update') {
          const serverWorkOrder = await this.getWorkOrder(op.data.id).toPromise();
          if (serverWorkOrder && serverWorkOrder.updatedAt) {
            const serverUpdateTime = serverWorkOrder.updatedAt.toDate().getTime();
            const offlineUpdateTime = op.timestamp;

            if (serverUpdateTime > offlineUpdateTime) {
              // Server has newer data - merge or prompt user
              console.warn('Conflict detected for work order:', op.data.id);
              // For now, prefer server data but could implement merge logic
            }
          }
        }
      } catch (error) {
        console.error('Error resolving offline conflict:', error);
      }
    }
  }

  // Real-time updates
  private startRealtimeUpdates(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    let queryConstraints: QueryConstraint[] = [];
    if (currentUser.role === 'technician') {
      queryConstraints = [where("assignedTo", "==", currentUser.id)];
    } else if (currentUser.role === 'customer') {
      queryConstraints = [where("clientId", "==", currentUser.id)];
    }

    this.realtimeSubscription = onSnapshot(
      query(collection(db, "workOrders"), ...queryConstraints),
      (snapshot) => {
        const workOrders = snapshot.docs.map(doc => fromFirestore<WorkOrder>(doc));
        this.workOrders.set(workOrders);
        this.invalidateCache();
      },
      (error) => {
        console.error('Error in real-time work orders subscription:', error);
      }
    );
  }

  private stopRealtimeUpdates(): void {
    if (this.realtimeSubscription) {
      this.realtimeSubscription();
      this.realtimeSubscription = null;
    }
  }

  // Statistics
  private async loadWorkOrderStats(): Promise<void> {
    try {
      const workOrders = this.workOrders();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats: WorkOrderStats = {
        totalWorkOrders: workOrders.length,
        completedToday: workOrders.filter(wo =>
          wo.status === 'delivered' &&
          wo.createdAt.toDate() >= today
        ).length,
        inProgress: workOrders.filter(wo => wo.status === 'in_progress').length,
        pending: workOrders.filter(wo => wo.status === 'open').length,
        overdue: workOrders.filter(wo =>
          (wo.status === 'in_progress' || wo.status === 'open') &&
          wo.createdAt.toDate() < weekAgo
        ).length,
        averageCompletionTime: this.calculateAverageCompletionTime(workOrders),
        totalRevenue: workOrders
          .filter(wo => wo.status === 'delivered')
          .reduce((sum, wo) => sum + wo.totalPrice, 0),
        averageRevenuePerOrder: 0,
        technicianUtilization: 0,
        periodStart: FirebaseTimestamp.fromDate(weekAgo),
        periodEnd: FirebaseTimestamp.fromDate(now),
        updatedAt: FirebaseTimestamp.fromDate(now)
      };

      stats.averageRevenuePerOrder = stats.totalWorkOrders > 0 ? stats.totalRevenue / stats.totalWorkOrders : 0;

      this.workOrderStats.set(stats);
    } catch (error) {
      console.error('Error loading work order stats:', error);
    }
  }

  private calculateAverageCompletionTime(workOrders: WorkOrder[]): number {
    const completedOrders = workOrders.filter(wo => wo.status === 'delivered');
    if (completedOrders.length === 0) return 0;

    const totalHours = completedOrders.reduce((sum, wo) => {
      // Estimate completion time based on created date (simplified)
      const created = wo.createdAt.toDate();
      const now = new Date();
      const hours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      return sum + Math.min(hours, 24); // Cap at 24 hours for estimation
    }, 0);

    return totalHours / completedOrders.length;
  }

  // Search and filter setup
  private setupSearchAndFilter(): void {
    // Initialize with empty values
    this.searchSubject.next('');
    this.filterSubject.next({});
  }

  createWorkOrderFromQueueEntry(entry: QueueEntry, createdBy: string): Observable<WorkOrder> {
    return from(new Promise<WorkOrder>(async (resolve, reject) => {
      try {
        // The vehicle ID is not directly on the QueueEntry model.
        // We cast to `any` to check for a potential motorcycleId property passed from the client flow.
        const vehicleId = (entry as any).motorcycleId || 'TBD';

        const newWorkOrderData = {
          clientId: entry.customerId,
          vehicleId: vehicleId,
          status: 'open' as const,
          assignedTo: entry.assignedTo,
          services: [],
          products: [],
          totalPrice: 0,
          notes: `Creada desde la entrada de cola #${entry.position}. ${entry.notes || ''}`,
          createdBy: createdBy,
          queueEntryId: entry.id,
          createdAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, "workOrders"), newWorkOrderData);
        
        const newWorkOrder: WorkOrder = {
          ...(newWorkOrderData as any),
          id: docRef.id,
          createdAt: FirebaseTimestamp.now(), // Use a real Timestamp
          updatedAt: FirebaseTimestamp.now(),
        };
        
        this.workOrders.update(wos => [...wos, newWorkOrder]);
        this.invalidateCache();

        this.eventBus.emit({ type: 'work_order.created', entity: newWorkOrder });

        resolve(newWorkOrder);
      } catch (e) {
        reject(e);
      }
    }));
  }
}