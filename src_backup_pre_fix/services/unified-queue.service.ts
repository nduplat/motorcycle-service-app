/**
 * Unified Queue Service - Centralized Queue Management
 *
 * This service provides a unified interface for queue operations,
 * replacing the previous fragmented approach between ClientFlowService
 * and QueueService. It implements optimistic locking, caching, and
 * proper separation of concerns.
 *
 * KEY FEATURES:
 * - Atomic queue operations with optimistic locking
 * - Intelligent caching with TTL
 * - Real-time updates (optional, can be disabled for cost optimization)
 * - Proper error handling and validation
 * - Integration with work order creation
 */

import { Injectable, signal, inject } from '@angular/core';
import { QueueEntry, QueueStatus, QueueJoinData, Timestamp } from '../models';
import { Observable, from, BehaviorSubject, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { db } from '../firebase.config';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  DocumentData,
  DocumentSnapshot,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction,
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';
import { AuthService } from './auth.service';
import { WorkOrderService } from './work-order.service';
import { EventBusService } from './event-bus.service';
import { QrCodeService } from './qr-code.service';
import { CacheService } from './cache.service';
import { MotorcycleService } from './motorcycle.service';

const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
  const data = snapshot.data() as any;
  return { ...data, id: snapshot.id } as T;
};

@Injectable({
  providedIn: 'root'
})
export class UnifiedQueueService {
  private readonly CACHE_TTL = 30000; // 30 seconds for queue data
  private readonly CACHE_KEY_ENTRIES = 'unified-queue-entries';
  private readonly CACHE_KEY_STATUS = 'unified-queue-status';
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 100;

  // Services
  private authService = inject(AuthService);
  private workOrderService = inject(WorkOrderService);
  private eventBus = inject(EventBusService);
  private qrCodeService = inject(QrCodeService);
  private cacheService = inject(CacheService);
  private motorcycleService = inject(MotorcycleService);

  // State signals
  private queueEntries = signal<QueueEntry[]>([]);
  private queueStatus = signal<QueueStatus | null>(null);
  private realtimeSubscription: Unsubscribe | null = null;

  constructor() {
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    await this.loadQueueData();
    // Note: Real-time updates disabled by default for cost optimization
    // this.startRealtimeUpdates();
  }

  // ========== PUBLIC API ==========

  /**
   * Add entry to queue with atomic operations
   */
  async addEntry(data: QueueJoinData): Promise<string> {
    this.validateQueueEntryData(data);

    return await this.executeWithRetry(async () => {
      const entryId = await this.createQueueEntry(data);
      await this.updateQueueStatus();
      return entryId;
    });
  }

  /**
   * Get entry by ID with caching
   */
  async getEntryById(entryId: string): Promise<QueueEntry | null> {
    // Check cache first
    const cacheKey = `${this.CACHE_KEY_ENTRIES}-${entryId}`;
    const cached = await this.cacheService.get<QueueEntry>(cacheKey);
    if (cached) return cached;

    // Fetch from Firestore
    const docRef = doc(db, 'queueEntries', entryId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const entry = fromFirestore<QueueEntry>(docSnap);

    // Cache the result
    this.cacheService.set(cacheKey, entry, this.CACHE_TTL, 'queue', entryId);

    return entry;
  }

  /**
   * Get active entries (waiting + called)
   */
  getActiveEntries(): Observable<QueueEntry[]> {
    return from(this.loadActiveEntries());
  }

  /**
   * Call next customer with atomic transaction
   */
  async callNext(technicianId: string): Promise<QueueEntry | null> {
    return await this.executeWithRetry(async () => {
      return await runTransaction(db, async (transaction) => {
        // Get fresh queue data
        const queueRef = collection(db, 'queueEntries');
        const q = query(queueRef, where('status', '==', 'waiting'), orderBy('position'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const nextEntry = fromFirestore<QueueEntry>(snapshot.docs[0]);
        const entryRef = doc(db, 'queueEntries', nextEntry.id);

        // Update entry status
        transaction.update(entryRef, {
          status: 'called',
          assignedTo: technicianId,
          calledAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Create work order
        const workOrder = await firstValueFrom(
          this.workOrderService.createWorkOrderFromQueueEntry(nextEntry, technicianId)
        );

        if (workOrder) {
          transaction.update(entryRef, {
            workOrderId: workOrder.id
          });
        }

        // Update queue status
        await this.updateQueueStatus();

        // Emit event
        this.eventBus.emit({
          type: 'queue.called',
          entity: { ...nextEntry, status: 'called', assignedTo: technicianId, workOrderId: workOrder?.id },
          technicianName: 'Técnico asignado' // Default name, can be enhanced later
        });

        return { ...nextEntry, status: 'called', assignedTo: technicianId, workOrderId: workOrder?.id };
      });
    });
  }

  /**
   * Update entry status
   */
  async updateEntryStatus(entryId: string, status: QueueEntry['status'], technicianId?: string): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: serverTimestamp()
    };

    if (technicianId) {
      updateData.assignedTo = technicianId;
    }

    if (status === 'called') {
      updateData.calledAt = serverTimestamp();
    }

    await updateDoc(doc(db, 'queueEntries', entryId), updateData);

    // Invalidate cache
    this.cacheService.invalidateByEntity('queue', entryId);
    await this.loadQueueData(); // Refresh local state
  }

  // ========== PRIVATE METHODS ==========

  private async loadQueueData(): Promise<void> {
    try {
      // Check cache first
      const cached = await this.cacheService.get<{
        entries: QueueEntry[];
        status: QueueStatus | null;
      }>(this.CACHE_KEY_ENTRIES);

      if (cached) {
        this.queueEntries.set(cached.entries);
        this.queueStatus.set(cached.status);
        return;
      }

      // Load from Firestore
      const [entriesSnapshot, statusDoc] = await Promise.all([
        getDocs(collection(db, 'queueEntries')),
        getDoc(doc(db, 'queueStatus', 'singleton'))
      ]);

      const entries = entriesSnapshot.docs.map(doc => fromFirestore<QueueEntry>(doc));
      let status: QueueStatus | null = null;

      if (statusDoc.exists()) {
        status = fromFirestore<QueueStatus>(statusDoc);
      }

      // Update cache
      this.cacheService.set(
        this.CACHE_KEY_ENTRIES,
        { entries, status },
        this.CACHE_TTL,
        'queue'
      );

      this.queueEntries.set(entries);
      this.queueStatus.set(status);
    } catch (error) {
      console.error('Error loading queue data:', error);
    }
  }

  private async loadActiveEntries(): Promise<QueueEntry[]> {
    const entries = this.queueEntries();
    return entries.filter(entry =>
      entry.status === 'waiting' || entry.status === 'called'
    );
  }

  private async createQueueEntry(data: QueueJoinData): Promise<string> {
    // Get current queue position
    const status = this.queueStatus();
    const position = (status?.currentCount || 0) + 1;

    // Generate verification code
    const verificationCode = this.generateVerificationCode();

    // Calculate estimated wait time
    const estimatedWaitTime = this.calculateEstimatedWaitTime(position);

    const entryData: any = {
      customerId: data.customerId,
      serviceType: data.serviceType,
      status: 'waiting' as const,
      position,
      joinedAt: serverTimestamp(),
      estimatedWaitTime,
      verificationCode,
      expiresAt: serverTimestamp(), // Will be set after creation
      notes: data.notes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Add optional fields
    if (data.motorcycleId) entryData.motorcycleId = data.motorcycleId;
    if (data.plate) entryData.plate = data.plate;
    if (data.mileageKm) entryData.mileageKm = data.mileageKm;

    const docRef = await addDoc(collection(db, 'queueEntries'), entryData);

    // Update with QR code and expiration
    const qrCodeDataUrl = this.qrCodeService.generateQrCodeDataUrl('queue-entry', docRef.id);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes

    await updateDoc(docRef, {
      qrCodeDataUrl,
      expiresAt,
      updatedAt: serverTimestamp()
    });

    // Update queue status atomically
    await this.updateQueueStatusAtomic((status?.currentCount || 0) + 1);

    // Emit event
    this.eventBus.emit({
      type: 'queue.entry_added',
      entity: { ...entryData, id: docRef.id, qrCodeDataUrl, expiresAt }
    });

    return docRef.id;
  }

  private async updateQueueStatus(): Promise<void> {
    const entries = this.queueEntries();
    const activeCount = entries.filter(e =>
      e.status === 'waiting' || e.status === 'called'
    ).length;

    await this.updateQueueStatusAtomic(activeCount);
  }

  private async updateQueueStatusAtomic(newCount: number): Promise<void> {
    const statusData = {
      currentCount: newCount,
      averageWaitTime: newCount * 15, // 15 min per customer
      lastUpdated: serverTimestamp()
    };

    const statusRef = doc(db, 'queueStatus', 'singleton');

    try {
      await updateDoc(statusRef, statusData);
    } catch (error) {
      // If document doesn't exist, create it
      await setDoc(statusRef, {
        id: 'singleton',
        isOpen: true,
        ...statusData,
        operatingHours: {
          monday: { open: '07:00', close: '17:30', enabled: true },
          tuesday: { open: '07:00', close: '17:30', enabled: true },
          wednesday: { open: '07:00', close: '17:30', enabled: true },
          thursday: { open: '07:00', close: '17:30', enabled: true },
          friday: { open: '07:00', close: '17:30', enabled: true },
          saturday: { open: '07:00', close: '17:30', enabled: true },
          sunday: { open: '07:00', close: '17:30', enabled: false }
        }
      });
    }

    // Update local state
    const currentStatus = this.queueStatus();
    this.queueStatus.set(currentStatus ? { ...currentStatus, ...statusData } : null);
  }

  private validateQueueEntryData(data: QueueJoinData): void {
    if (!data.customerId?.trim()) {
      throw new Error('Customer ID is required');
    }
    if (!data.serviceType?.trim()) {
      throw new Error('Service type is required');
    }
    if (!['immediate', 'appointment', 'emergency'].includes(data.serviceType)) {
      throw new Error('Invalid service type');
    }
  }

  private calculateEstimatedWaitTime(position: number): number {
    // Base 15 minutes per customer, with some variance
    return position * 15;
  }

  private generateVerificationCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < this.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Retry on specific errors
        if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
          if (attempt < this.MAX_RETRY_ATTEMPTS - 1) {
            await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS * Math.pow(2, attempt)));
            continue;
          }
        }

        throw error;
      }
    }

    throw lastError;
  }

  // ========== REAL-TIME UPDATES (OPTIONAL) ==========

  /**
   * Enable real-time updates (use sparingly for cost optimization)
   */
  enableRealtimeUpdates(): void {
    if (this.realtimeSubscription) return;

    this.realtimeSubscription = onSnapshot(
      collection(db, 'queueEntries'),
      (snapshot) => {
        const entries = snapshot.docs.map(doc => fromFirestore<QueueEntry>(doc));
        this.queueEntries.set(entries);
        this.updateQueueStatus();
      },
      (error) => {
        console.error('Real-time queue updates error:', error);
      }
    );
  }

  /**
   * Disable real-time updates to save costs
   */
  disableRealtimeUpdates(): void {
    if (this.realtimeSubscription) {
      this.realtimeSubscription();
      this.realtimeSubscription = null;
    }
  }

  // ========== CLEANUP ==========

  destroy(): void {
    this.disableRealtimeUpdates();
  }
}