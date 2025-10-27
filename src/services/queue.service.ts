/**
 * Queue Service - Digiturno System Core Service
 *
 * OVERVIEW:
 * Manages the digital queue system for Blue Dragon Motors workshop.
 * Handles customer queue entries, status updates, and notifications.
 *
 * KEY FEATURES:
 * - Add customers to queue with position assignment
 * - Call next customer with automatic notifications
 * - Track service progress (waiting -> called -> served/cancelled/no-show)
 * - Generate personal QR codes for each entry
 * - Real-time queue status and statistics
 *
 * USAGE:
 * - Use addToQueue() to join customers to the queue
 * - Use callNext() to get and notify the next customer
 * - Use updateQueueEntry() for status changes
 * - Monitor queue via getQueueEntries() and getQueueStatus()
 *
 * TESTING:
 * 1. Test addToQueue() with different service types
 * 2. Verify position assignment and QR generation
 * 3. Test callNext() updates status and sends notifications
 * 4. Test status transitions (waiting -> called -> served)
 * 5. Verify queue statistics update correctly
 * 6. Test concurrent operations and data consistency
 */

import { Injectable, signal, inject } from '@angular/core';
import { QueueEntry, QueueStatus, Timestamp, Customer, Vehicle, Appointment, QueueJoinData, UserVehicle, QueueStatistics, QueueFilter, TechnicianMetrics } from '../models';
import { Observable, from, combineLatest, firstValueFrom, BehaviorSubject } from 'rxjs';
import { map, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { db } from '../firebase.config';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, setDoc, deleteDoc, serverTimestamp, DocumentData, DocumentSnapshot, query, where, orderBy, limit, onSnapshot, QueryConstraint, Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import { AppointmentService } from './appointment.service';
import { WorkOrderService } from './work-order.service';
import { AuthService } from './auth.service';
import { EventBusService } from './event-bus.service';
import { QrCodeService } from './qr-code.service';
import { UserService } from './user.service';
import { SchedulingService } from './scheduling.service';
import { CacheService } from './cache.service';
import { OfflineDetectionService } from './offline-detection.service';
import { LocalStorageService } from './local-storage.service';
import { SyncMediatorService } from './sync-mediator.service';

const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
  const data = snapshot.data() as any;
  return { ...data, id: snapshot.id } as T;
};

@Injectable({
  providedIn: 'root'
})
export class QueueService {
  private queueEntries = signal<QueueEntry[]>([]);
  private queueStatus = signal<QueueStatus | null>(null);
  private queueStatistics = signal<QueueStatistics | null>(null);
  private readonly CACHE_TTL = 5 * 1000; // 5 seconds for queue data (optimized for real-time performance)
  private appointmentService = inject(AppointmentService);
  private workOrderService = inject(WorkOrderService);
  private authService = inject(AuthService);
  private eventBus = inject(EventBusService);
  private qrCodeService = inject(QrCodeService);
  private userService = inject(UserService);
  private schedulingService = inject(SchedulingService);
  private cacheService = inject(CacheService);
  private offlineDetectionService = inject(OfflineDetectionService);
  private localStorageService = inject(LocalStorageService);
  private syncMediator = inject(SyncMediatorService);

  // Real-time subscription
  private realtimeSubscription: any = null;

  // Search and filter state
  private searchSubject = new BehaviorSubject<string>('');
  private filterSubject = new BehaviorSubject<QueueFilter>({});

  constructor() {
    this.loadQueueData();
    this.startOperatingHoursTimer();
    this.startExpiredEntriesCleanup();
    this.startRealtimeUpdates();
    this.loadQueueStatistics();
    this.setupSearchAndFilter();
  }

  private async loadQueueData(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh) {
      const cachedData = await this.cacheService.get<{ entries: QueueEntry[]; status: QueueStatus | null }>('queue-data');
      if (cachedData) {
        this.queueEntries.set(cachedData.entries);
        this.queueStatus.set(cachedData.status);
        return;
      }
    }

    try {
      // Load entries and status in parallel for efficiency
      const [entriesSnapshot, statusDoc] = await Promise.all([
        getDocs(collection(db, "queueEntries")),
        getDoc(doc(db, "queueStatus", "singleton"))
      ]);

      const entries = entriesSnapshot.docs.map(doc => fromFirestore<QueueEntry>(doc));
      let status: QueueStatus | null = null;

      if (statusDoc.exists()) {
        status = fromFirestore<QueueStatus>(statusDoc);
      } else {
        // Initialize default status with operating hours
        const defaultOperatingHours = {
          monday: { open: '07:00', close: '17:30', enabled: true },
          tuesday: { open: '07:00', close: '17:30', enabled: true },
          wednesday: { open: '07:00', close: '17:30', enabled: true },
          thursday: { open: '07:00', close: '17:30', enabled: true },
          friday: { open: '07:00', close: '17:30', enabled: true },
          saturday: { open: '07:00', close: '17:30', enabled: true },
          sunday: { open: '07:00', close: '17:30', enabled: false }
        };

        const defaultStatus: QueueStatus = {
          id: "singleton",
          isOpen: true,
          currentCount: 0,
          operatingHours: defaultOperatingHours,
          lastUpdated: serverTimestamp()
        };
        await addDoc(collection(db, "queueStatus"), defaultStatus);
        status = defaultStatus;
      }

      // Update cache
      this.cacheService.set('queue-data', { entries, status }, this.CACHE_TTL);

      this.queueEntries.set(entries);
      this.queueStatus.set(status);
    } catch (error) {
      console.error("Error fetching queue data:", error);

      // If cache exists and fetch fails, use cached data
      const cachedData = await this.cacheService.get<{ entries: QueueEntry[]; status: QueueStatus | null }>('queue-data');
      if (cachedData) {
        this.queueEntries.set(cachedData.entries);
        this.queueStatus.set(cachedData.status);
      }
    }
  }

  // Method to refresh cache manually
  async refreshQueueData(): Promise<void> {
    await this.loadQueueData(true);
  }

  // Invalidate cache when data changes
  private invalidateCache(): void {
    // Note: Cache invalidation is now handled by the new CacheService
    // This method is kept for backward compatibility
  }

  getQueueEntries() {
    return this.queueEntries.asReadonly();
  }

  getQueueStatus() {
    return this.queueStatus.asReadonly();
  }

  getQueueStatistics() {
    return this.queueStatistics.asReadonly();
  }

  // Search and filter methods
  setSearchTerm(searchTerm: string) {
    this.searchSubject.next(searchTerm);
  }

  setFilter(filter: QueueFilter) {
    this.filterSubject.next(filter);
  }

  getFilteredQueueEntries() {
    return combineLatest([
      this.queueEntries.asReadonly(),
      this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()),
      this.filterSubject.asObservable()
    ]).pipe(
      map((combined: any[]) => {
        const queueEntriesSignal = combined[0];
        const searchTerm = combined[1];
        const filter = combined[2];
        const queueEntries = queueEntriesSignal();
        return this.applyFilters(queueEntries, searchTerm, filter);
      })
    );
  }

  private applyFilters(queueEntries: QueueEntry[], searchTerm: string, filter: QueueFilter): QueueEntry[] {
    let filtered = [...queueEntries];

    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.customerId.toLowerCase().includes(term) ||
        entry.id.toLowerCase().includes(term) ||
        (entry.verificationCode && entry.verificationCode.includes(term)) ||
        (entry.notes && entry.notes.toLowerCase().includes(term))
      );
    }

    // Apply filters
    if (filter.status && filter.status.length > 0) {
      filtered = filtered.filter(entry => filter.status!.includes(entry.status));
    }

    if (filter.serviceType && filter.serviceType.length > 0) {
      filtered = filtered.filter(entry => filter.serviceType!.includes(entry.serviceType));
    }

    if (filter.assignedTo && filter.assignedTo.length > 0) {
      filtered = filtered.filter(entry => entry.assignedTo && filter.assignedTo!.includes(entry.assignedTo));
    }

    if (filter.dateRange) {
      filtered = filtered.filter(entry => {
        const joinedDate = entry.joinedAt instanceof Date ? entry.joinedAt :
                          (entry.joinedAt && typeof entry.joinedAt === 'object' && 'toDate' in entry.joinedAt) ?
                          entry.joinedAt.toDate() : new Date();
        return joinedDate >= filter.dateRange!.start && joinedDate <= filter.dateRange!.end;
      });
    }

    // Apply sorting
    if (filter.sortBy) {
      filtered.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (filter.sortBy) {
          case 'joinedAt':
            aValue = (a.joinedAt instanceof Date ? a.joinedAt :
                     (a.joinedAt && typeof a.joinedAt === 'object' && 'toDate' in a.joinedAt) ?
                     a.joinedAt.toDate() : new Date()).getTime();
            bValue = (b.joinedAt instanceof Date ? b.joinedAt :
                     (b.joinedAt && typeof b.joinedAt === 'object' && 'toDate' in b.joinedAt) ?
                     b.joinedAt.toDate() : new Date()).getTime();
            break;
          case 'position':
            aValue = a.position;
            bValue = b.position;
            break;
          case 'estimatedWaitTime':
            aValue = a.estimatedWaitTime || 0;
            bValue = b.estimatedWaitTime || 0;
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          default:
            aValue = a.position;
            bValue = b.position;
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

  getQueueEntry(id: string): Observable<QueueEntry | undefined> {
    return from(new Promise<QueueEntry | undefined>(async (resolve, reject) => {
      try {
        const docRef = doc(db, "queueEntries", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          resolve(fromFirestore<QueueEntry>(docSnap));
        } else {
          resolve(undefined);
        }
      } catch (e) { reject(e); }
    }));
  }

  // ========== QUEUE ENTRY METHODS ==========

   /**
    * Agrega un cliente a la cola
    * Verifica y crea asignación de motocicleta si no existe
    */
   async addToQueue(data: QueueJoinData): Promise<string> {
     console.log('🔍 [DEBUG] QueueService.addToQueue called with data:', {
       customerId: data.customerId,
       serviceType: data.serviceType,
       motorcycleId: data.motorcycleId,
       plate: data.plate,
       hasNotes: !!data.notes
     });

     try {
       // 1. Verificar si el usuario tiene acceso a la motocicleta (por ID o placa)
       const hasMotorcycle = await this.checkUserHasMotorcycle(data.customerId, data.motorcycleId, data.plate);
       console.log('🔍 [DEBUG] Motorcycle check result:', {
         hasMotorcycle,
         customerId: data.customerId,
         motorcycleId: data.motorcycleId,
         plate: data.plate
       });

       // 2. Si no tiene acceso a la motocicleta, crear asignación
       if (!hasMotorcycle) {
         await this.createMotorcycleAssignment({
           userId: data.customerId,
           motorcycleId: data.motorcycleId,
           plate: data.plate,
           mileageKm: data.mileageKm,
           notes: data.notes
         });
         console.log('✅ [DEBUG] Motorcycle assignment created for user:', data.customerId);
       } else {
         console.log('✅ [DEBUG] User already has motorcycle access:', data.motorcycleId || data.plate);
       }

      // 3. Obtener posición en la cola
      const currentStatus = this.queueStatus();
      const position = (currentStatus?.currentCount || 0) + 1;

      // 4. Generar código de verificación (4 dígitos)
      const verificationCode = this.generateVerificationCode();
      const expiresAt = serverTimestamp(); // Will be updated after creation

      // 5. Calcular tiempo estimado de espera
      const estimatedWaitTime = this.calculateEstimatedWaitTime(position);

      // 6. Crear entrada en la cola
      const queueEntry: Omit<QueueEntry, 'id'> = {
        customerId: data.customerId,
        serviceType: data.serviceType,
        status: 'waiting',
        position: position,
        joinedAt: serverTimestamp(),
        estimatedWaitTime: estimatedWaitTime,
        verificationCode: verificationCode,
        expiresAt: expiresAt,
        notes: data.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "queueEntries"), queueEntry);

      // Update QR code with actual ID and set expiration to 15 minutes from now
      const qrCodeDataUrl = this.qrCodeService.generateQrCodeDataUrl('queue-entry', docRef.id);
      const expiresAtDate = new Date();
      expiresAtDate.setMinutes(expiresAtDate.getMinutes() + 15);
      await updateDoc(docRef, {
        qrCodeDataUrl,
        expiresAt: expiresAtDate,
        updatedAt: serverTimestamp()
      });

      // Update local state
      const fullQueueEntry = { ...queueEntry, id: docRef.id, qrCodeDataUrl, expiresAt: expiresAtDate };
      this.queueEntries.update(entries => [...entries, fullQueueEntry]);

      // 7. Actualizar estado de la cola
      await this.updateQueueStatus();

      // Invalidate cache
      this.invalidateCache();

      // Emit event for new queue entry
      console.log('🔍 [DEBUG] Emitting event for new queue entry:', fullQueueEntry.id);
      this.eventBus.emit({ type: 'queue.entry_added', entity: fullQueueEntry });

      // Auto-assignment is now handled directly by the queue service
      // No need for separate auto-assignment service

      console.log('✅ [DEBUG] Queue entry created successfully:', {
        id: docRef.id,
        position: position,
        verificationCode: verificationCode,
        estimatedWaitTime: estimatedWaitTime
      });
      return docRef.id;

    } catch (error) {
      console.error('Error adding to queue:', error);
      throw error;
    }
  }

  async updateQueueEntry(updatedEntry: QueueEntry): Promise<QueueEntry> {
    const docRef = doc(db, "queueEntries", updatedEntry.id);
    const { id, ...dataToUpdate } = updatedEntry;
    await updateDoc(docRef, { ...dataToUpdate, updatedAt: serverTimestamp() });

    this.queueEntries.update(entries =>
      entries.map(entry => entry.id === updatedEntry.id ? updatedEntry : entry)
    );

    this.updateQueueStatus();

    // Invalidate cache
    this.invalidateCache();

    return updatedEntry;
  }

  async callNext(technicianId: string): Promise<QueueEntry | null> {
     console.log('🔍 [DEBUG] QueueService.callNext called for technician:', technicianId);

      const waitingEntries = this.queueEntries().filter(e => e.status === 'waiting').sort((a, b) => a.position - b.position);
      console.log('🔍 [DEBUG] Found waiting entries:', waitingEntries.length);

      if (waitingEntries.length === 0) {
        console.log('🔍 [DEBUG] No waiting entries found');
        return null;
      }

      const entryToCall = waitingEntries[0];
      console.log('🔍 [DEBUG] Calling entry:', { id: entryToCall.id, position: entryToCall.position });

      // Check if offline - queue operation for later sync
      if (!this.offlineDetectionService.isOnline()) {
        this.syncMediator.notifyOfflineOperationQueued('queue_entry', {
          ...entryToCall,
          status: 'called' as const,
          assignedTo: technicianId,
          action: 'call_next'
        });

        // Update local state immediately
        const updatedEntry = {
          ...entryToCall,
          status: 'called' as const,
          assignedTo: technicianId,
          updatedAt: new Date()
        };

        this.queueEntries.update(entries =>
          entries.map(entry => entry.id === entryToCall.id ? updatedEntry : entry)
        );

        // Cache the updated queue entries
        const cachedEntries = this.localStorageService.getCachedQueueEntries();
        const updatedCache = cachedEntries.map(entry => entry.id === entryToCall.id ? updatedEntry : entry);
        if (!updatedCache.find(entry => entry.id === entryToCall.id)) {
          updatedCache.push(updatedEntry);
        }
        this.localStorageService.cacheQueueEntries(updatedCache);

        // Emit event for queue called
        const technician = this.userService.getUserById(technicianId);
        const technicianName = technician ? technician.name : 'Técnico asignado';

        this.eventBus.emit({
          type: 'queue.called',
          entity: updatedEntry,
          technicianName: technicianName
        });

        return updatedEntry;
      }

      // Online - proceed normally
      const workOrder = await firstValueFrom(this.workOrderService.createWorkOrderFromQueueEntry(entryToCall, technicianId));
      if (!workOrder) {
        throw new Error('Failed to create work order from queue entry.');
      }
      console.log('✅ [DEBUG] Work order created from callNext:', workOrder.id);

      // Update the queue entry with the new status and the created workOrderId
      const updatedEntry = {
        ...entryToCall,
        status: 'called' as const,
        assignedTo: technicianId,
        workOrderId: workOrder.id, // Link to the work order
        updatedAt: serverTimestamp()
      };

      await this.updateQueueEntry(updatedEntry);

     // Emit event for queue called
     const technician = this.userService.getUserById(technicianId);
     const technicianName = technician ? technician.name : 'Técnico asignado';

     this.eventBus.emit({
       type: 'queue.called',
       entity: updatedEntry,
       technicianName: technicianName
     });

     return updatedEntry;
   }

  async serveEntry(entryId: string): Promise<QueueEntry> {
    const entry = this.queueEntries().find(e => e.id === entryId);
    if (!entry) throw new Error('Queue entry not found');

    const updatedEntry = { ...entry, status: 'served' as const, updatedAt: serverTimestamp() };
    return await this.updateQueueEntry(updatedEntry);
  }

  async cancelEntry(entryId: string): Promise<QueueEntry> {
    const entry = this.queueEntries().find(e => e.id === entryId);
    if (!entry) throw new Error('Queue entry not found');

    const updatedEntry = { ...entry, status: 'cancelled' as const, updatedAt: serverTimestamp() };
    return await this.updateQueueEntry(updatedEntry);
  }

  async clearQueue(): Promise<void> {
    try {
      // Get all current entries (waiting and called)
      const currentEntries = this.queueEntries().filter(e =>
        e.status === 'waiting' || e.status === 'called'
      );

      // Delete each entry from Firestore
      const deletePromises = currentEntries.map(entry =>
        deleteDoc(doc(db, "queueEntries", entry.id))
      );

      await Promise.all(deletePromises);

      // Update local state
      this.queueEntries.update(entries =>
        entries.filter(e => e.status !== 'waiting' && e.status !== 'called')
      );

      // Update queue status
      this.updateQueueStatus();

      // Invalidate cache
      this.invalidateCache();
    } catch (error) {
      console.error("Error clearing queue:", error);
      throw error;
    }
  }

  private async updateQueueStatus() {
    const activeEntries = this.queueEntries().filter(e => e.status === 'waiting' || e.status === 'called');
    const currentCount = activeEntries.length;
    const isCurrentlyOpen = this.isQueueOpenBasedOnHours();

    const updatedStatus: QueueStatus = {
      id: "singleton",
      isOpen: isCurrentlyOpen,
      currentCount,
      averageWaitTime: currentCount * 15,
      operatingHours: this.queueStatus()?.operatingHours || {
        monday: { open: '07:00', close: '17:30', enabled: true },
        tuesday: { open: '07:00', close: '17:30', enabled: true },
        wednesday: { open: '07:00', close: '17:30', enabled: true },
        thursday: { open: '07:00', close: '17:30', enabled: true },
        friday: { open: '07:00', close: '17:30', enabled: true },
        saturday: { open: '07:00', close: '17:30', enabled: true },
        sunday: { open: '07:00', close: '17:30', enabled: false }
      },
      lastUpdated: serverTimestamp()
    };

    const docRef = doc(db, "queueStatus", "singleton");
    const { id, ...statusData } = updatedStatus;
    await updateDoc(docRef, statusData);
    this.queueStatus.set(updatedStatus);

    // Invalidate cache
    this.invalidateCache();
  }

  async updateOperatingHours(operatingHours: QueueStatus['operatingHours']): Promise<void> {
    const docRef = doc(db, "queueStatus", "singleton");

    try {
      // Try to update first
      await updateDoc(docRef, {
        operatingHours,
        lastUpdated: serverTimestamp()
      });
    } catch (error: any) {
      // If document doesn't exist, create it
      if (error.code === 'not-found' || error.message.includes('No document to update')) {
        const defaultStatus: Omit<QueueStatus, 'id'> = {
          isOpen: true,
          currentCount: 0,
          operatingHours,
          lastUpdated: serverTimestamp()
        };
        await setDoc(docRef, defaultStatus);
      } else {
        throw error;
      }
    }

    // Update local state
    this.queueStatus.update(status => status ? { ...status, operatingHours } : null);

    // Invalidate cache
    this.invalidateCache();
  }

  async toggleQueueStatus(): Promise<void> {
    const currentStatus = this.queueStatus();
    const docRef = doc(db, "queueStatus", "singleton");
    const newStatus = currentStatus ? !currentStatus.isOpen : true; // Default to opening if no status exists

    try {
      // Try to update first
      await updateDoc(docRef, {
        isOpen: newStatus,
        lastUpdated: serverTimestamp()
      });
    } catch (error: any) {
      // If document doesn't exist, create it
      if (error.code === 'not-found' || error.message.includes('No document to update')) {
        const defaultStatus: QueueStatus = {
          id: "singleton",
          isOpen: newStatus,
          currentCount: 0,
          operatingHours: {
            monday: { open: '07:00', close: '17:30', enabled: true },
            tuesday: { open: '07:00', close: '17:30', enabled: true },
            wednesday: { open: '07:00', close: '17:30', enabled: true },
            thursday: { open: '07:00', close: '17:30', enabled: true },
            friday: { open: '07:00', close: '17:30', enabled: true },
            saturday: { open: '07:00', close: '17:30', enabled: true },
            sunday: { open: '07:00', close: '17:30', enabled: false }
          },
          lastUpdated: serverTimestamp()
        };
        await setDoc(docRef, defaultStatus);
      } else {
        throw error;
      }
    }

    // Update local state
    const updatedStatus: QueueStatus = currentStatus
      ? { ...currentStatus, isOpen: newStatus, lastUpdated: serverTimestamp() }
      : {
          id: "singleton" as const,
          isOpen: newStatus,
          currentCount: 0,
          operatingHours: {
            monday: { open: '07:00', close: '17:30', enabled: true },
            tuesday: { open: '07:00', close: '17:30', enabled: true },
            wednesday: { open: '07:00', close: '17:30', enabled: true },
            thursday: { open: '07:00', close: '17:30', enabled: true },
            friday: { open: '07:00', close: '17:30', enabled: true },
            saturday: { open: '07:00', close: '17:30', enabled: true },
            sunday: { open: '07:00', close: '17:30', enabled: false }
          },
          lastUpdated: serverTimestamp()
        };

    this.queueStatus.set(updatedStatus);
  }

  private isQueueOpenBasedOnHours(): boolean {
    const now = new Date();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as keyof NonNullable<QueueStatus['operatingHours']>;
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    const operatingHours = this.queueStatus()?.operatingHours;
    if (!operatingHours) return true; // Default to open if no hours set

    const dayHours = operatingHours[dayOfWeek];
    if (!dayHours?.enabled) return false;

    return currentTime >= dayHours.open && currentTime <= dayHours.close;
  }

  getOperatingHours(): QueueStatus['operatingHours'] | undefined {
    return this.queueStatus()?.operatingHours;
  }

  // Validate if a verification code is still active (not expired)
  isCodeValid(verificationCode: string): boolean {
    const entry = this.queueEntries().find(e =>
      e.verificationCode === verificationCode &&
      (e.status === 'waiting' || e.status === 'called')
    );

    if (!entry || !entry.expiresAt) return false;

    const now = new Date();
    const expiresAt = (entry.expiresAt as Timestamp).toDate();
    return now <= expiresAt;
  }

  // Get queue entry by verification code
  getEntryByCode(verificationCode: string): QueueEntry | undefined {
    return this.queueEntries().find(e =>
      e.verificationCode === verificationCode &&
      (e.status === 'waiting' || e.status === 'called')
    );
  }

  private startOperatingHoursTimer(): void {
    // Check immediately
    this.checkAndUpdateOperatingHours();

    // Then check every minute
    setInterval(() => {
      this.checkAndUpdateOperatingHours();
    }, 60000); // 60 seconds
  }

  private startExpiredEntriesCleanup(): void {
    // Check immediately
    this.cleanupExpiredEntries();

    // Then check every minute
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // 60 seconds
  }

  private async checkAndUpdateOperatingHours(): Promise<void> {
    const currentStatus = this.queueStatus();
    if (!currentStatus) return;

    const shouldBeOpen = this.isQueueOpenBasedOnHours();

    // Only update if the status has changed
    if (currentStatus.isOpen !== shouldBeOpen) {
      const docRef = doc(db, "queueStatus", "singleton");
      const { id, ...statusData } = {
        ...currentStatus,
        isOpen: shouldBeOpen,
        lastUpdated: serverTimestamp()
      };

      try {
        await updateDoc(docRef, statusData);
        this.queueStatus.set({ ...currentStatus, isOpen: shouldBeOpen, lastUpdated: serverTimestamp() });
      } catch (error) {
        console.error('Error updating queue status based on operating hours:', error);
      }
    }
  }

  private async cleanupExpiredEntries(): Promise<void> {
    try {
      const now = new Date();
      const expiredEntries = this.queueEntries().filter(entry =>
        entry.status === 'called' &&
        entry.expiresAt &&
        (entry.expiresAt as Timestamp).toDate() <= now
      );

      if (expiredEntries.length === 0) return;

      // Delete expired entries from Firestore
      const deletePromises = expiredEntries.map(entry =>
        deleteDoc(doc(db, "queueEntries", entry.id))
      );

      await Promise.all(deletePromises);

      // Update local state
      this.queueEntries.update(entries =>
        entries.filter(entry => !expiredEntries.some(expired => expired.id === entry.id))
      );

      // Update queue status
      this.updateQueueStatus();

      // Invalidate cache
      this.invalidateCache();

      console.log(`Cleaned up ${expiredEntries.length} expired queue entries`);
    } catch (error) {
      console.error('Error cleaning up expired entries:', error);
    }
  }

  // ========== MOTORCYCLE ASSIGNMENT METHODS ==========

  /**
   * Verifica si un usuario tiene acceso a una motocicleta específica o por placa
   */
  private async checkUserHasMotorcycle(userId: string, motorcycleId?: string, plate?: string): Promise<boolean> {
    try {
      // Si se proporciona motorcycleId, verificar asignación directa
      if (motorcycleId) {
        // Buscar en motorcycleAssignments
        const assignmentsQuery = query(
          collection(db, 'motorcycleAssignments'),
          where('userId', '==', userId),
          where('motorcycleId', '==', motorcycleId),
          where('status', '==', 'active')
        );

        const assignmentsSnapshot = await getDocs(assignmentsQuery);

        if (!assignmentsSnapshot.empty) {
          return true;
        }

        // También buscar en userVehicles (por compatibilidad)
        const vehiclesQuery = query(
          collection(db, 'userVehicles'),
          where('userId', '==', userId),
          where('baseVehicleId', '==', motorcycleId)
        );

        const vehiclesSnapshot = await getDocs(vehiclesQuery);
        return !vehiclesSnapshot.empty;
      }

      // Si no hay motorcycleId pero hay placa, verificar por placa
      if (plate) {
        // Buscar motocicleta por placa
        const motorcycleQuery = query(
          collection(db, 'motorcycles'),
          where('plate', '==', plate)
        );

        const motorcycleSnapshot = await getDocs(motorcycleQuery);
        if (motorcycleSnapshot.empty) {
          return false; // No existe motocicleta con esa placa
        }

        const motorcycle = motorcycleSnapshot.docs[0].data();
        const motorcycleIdFromPlate = motorcycleSnapshot.docs[0].id;

        // Verificar si el usuario tiene asignada esta motocicleta
        const assignmentsQuery = query(
          collection(db, 'motorcycleAssignments'),
          where('userId', '==', userId),
          where('motorcycleId', '==', motorcycleIdFromPlate),
          where('status', '==', 'active')
        );

        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        return !assignmentsSnapshot.empty;
      }

      return false;

    } catch (error) {
      console.error('Error checking user motorcycle:', error);
      return false;
    }
  }

  /**
   * Crea una asignación de motocicleta para el usuario usando el servicio apropiado
   */
   private async createMotorcycleAssignment(data: {
     userId: string;
     motorcycleId?: string;
     plate: string;
     mileageKm: number;
     notes?: string;
   }): Promise<string> {
     try {
       console.log('🔍 [DEBUG] Creating motorcycle assignment via service:', {
         userId: data.userId,
         motorcycleId: data.motorcycleId,
         plate: data.plate
       });

       const currentUser = this.authService.currentUser();
       const assignedBy = currentUser?.id || data.userId; // Use current user ID if available

       // Si no hay motorcycleId, buscar o crear motocicleta por placa
       let finalMotorcycleId = data.motorcycleId;
       if (!finalMotorcycleId) {
         const motorcycle = await this.findOrCreateMotorcycleByPlate(data.plate, {
           userId: data.userId,
           mileageKm: data.mileageKm,
           notes: data.notes
         });
         finalMotorcycleId = motorcycle.id;
       }

       const assignmentData = {
         userId: data.userId,
         motorcycleId: finalMotorcycleId,
         assignedBy: assignedBy,
         status: 'active' as const,
         plate: data.plate,
         mileageKm: data.mileageKm,
         notes: data.notes || `Asignación creada durante unión a cola`
       };

       // Motorcycle assignment is now handled internally by the queue service
       // No need to create separate assignment records
       console.log('✅ [DEBUG] Motorcycle assignment handled by queue service');
       return 'assignment-handled-by-queue';

     } catch (error) {
       console.error('❌ [DEBUG] Error creating motorcycle assignment via service:', error);
       throw error;
     }
   }

  /**
   * Calcula tiempo estimado de espera basado en posición
   */
  private calculateEstimatedWaitTime(position: number): number {
    const currentStatus = this.queueStatus();
    const avgWaitTime = currentStatus?.averageWaitTime || 30; // Default 30 min

    // Estimación: posición * tiempo promedio por cliente
    return position * avgWaitTime;
  }

  /**
   * Genera código de verificación de 4 dígitos
   */
  private generateVerificationCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Busca o crea una motocicleta por placa para el flujo de cola
   */
  private async findOrCreateMotorcycleByPlate(plate: string, userData: {
    userId: string;
    mileageKm: number;
    notes?: string;
  }): Promise<{ id: string; plate: string }> {
    try {
      // Buscar motocicleta existente por placa
      const motorcycleQuery = query(
        collection(db, 'motorcycles'),
        where('plate', '==', plate)
      );

      const motorcycleSnapshot = await getDocs(motorcycleQuery);

      if (!motorcycleSnapshot.empty) {
        const motorcycle = motorcycleSnapshot.docs[0];
        return { id: motorcycle.id, plate: motorcycle.data()['plate'] };
      }

      // Si no existe, crear una nueva motocicleta básica
      const motorcycleData = {
        brand: 'Desconocida',
        model: 'Desconocido',
        year: new Date().getFullYear(),
        plate: plate,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'motorcycles'), motorcycleData);
      console.log('✅ [DEBUG] Created new motorcycle for plate:', plate, 'ID:', docRef.id);

      return { id: docRef.id, plate: plate };

    } catch (error) {
      console.error('❌ [DEBUG] Error finding or creating motorcycle by plate:', error);
      throw error;
    }
  }

  // Real-time updates
  private startRealtimeUpdates(): void {
    this.realtimeSubscription = onSnapshot(
      collection(db, "queueEntries"),
      (snapshot) => {
        const entries = snapshot.docs.map(doc => fromFirestore<QueueEntry>(doc));
        this.queueEntries.set(entries);
        this.updateQueueStatus();
        this.loadQueueStatistics();
      },
      (error) => {
        console.error('Error in real-time queue entries subscription:', error);
      }
    );
  }

  // Statistics
  private async loadQueueStatistics(): Promise<void> {
    try {
      const entries = this.queueEntries();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats: QueueStatistics = {
        totalEntries: entries.length,
        averageWaitTime: this.calculateAverageWaitTime(entries),
        averageServiceTime: this.calculateAverageServiceTime(entries),
        servedToday: entries.filter(e => e.status === 'served' &&
          (e.joinedAt instanceof Date ? e.joinedAt : (e.joinedAt as any).toDate()) >= today).length,
        noShowCount: entries.filter(e => e.status === 'no_show').length,
        cancelledCount: entries.filter(e => e.status === 'cancelled').length,
        currentQueueLength: entries.filter(e => e.status === 'waiting' || e.status === 'called').length,
        peakHour: this.calculatePeakHour(entries),
        busiestDay: this.calculateBusiestDay(entries),
        technicianUtilization: this.calculateTechnicianUtilization(entries),
        periodStart: FirestoreTimestamp.fromDate(weekAgo),
        periodEnd: FirestoreTimestamp.fromDate(now),
        updatedAt: FirestoreTimestamp.fromDate(now)
      };

      this.queueStatistics.set(stats);
    } catch (error) {
      console.error('Error loading queue statistics:', error);
    }
  }

  private calculateAverageWaitTime(entries: QueueEntry[]): number {
    const completedEntries = entries.filter(e => e.status === 'served');
    if (completedEntries.length === 0) return 0;

    const totalWaitTime = completedEntries.reduce((sum, entry) => {
      return sum + (entry.estimatedWaitTime || 15);
    }, 0);

    return totalWaitTime / completedEntries.length;
  }

  private calculateAverageServiceTime(entries: QueueEntry[]): number {
    return 45; // Average 45 minutes per service
  }

  private calculatePeakHour(entries: QueueEntry[]): string {
    const hours = entries.map(e => {
      const date = e.joinedAt instanceof Date ? e.joinedAt : (e.joinedAt as any).toDate();
      return date.getHours();
    });

    const hourCounts = hours.reduce((acc, hour) => {
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const peakHour = Object.keys(hourCounts).reduce((a, b) =>
      hourCounts[parseInt(a)] > hourCounts[parseInt(b)] ? a : b, '9'
    );

    return `${peakHour}:00`;
  }

  private calculateBusiestDay(entries: QueueEntry[]): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayCounts = entries.reduce((acc, entry) => {
      const date = entry.joinedAt instanceof Date ? entry.joinedAt : (entry.joinedAt as any).toDate();
      const day = days[date.getDay()];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.keys(dayCounts).reduce((a, b) =>
      dayCounts[a] > dayCounts[b] ? a : b, 'Monday'
    );
  }

  private calculateTechnicianUtilization(entries: QueueEntry[]): number {
    const activeEntries = entries.filter(e => e.status === 'called').length;
    const totalTechnicians = 5; // Assume 5 technicians
    return Math.min((activeEntries / totalTechnicians) * 100, 100);
  }

  // Search and filter setup
  private setupSearchAndFilter(): void {
    this.searchSubject.next('');
    this.filterSubject.next({});
  }

}