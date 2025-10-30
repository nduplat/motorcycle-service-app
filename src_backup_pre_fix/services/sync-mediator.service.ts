import { Injectable, inject } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { WorkOrder } from '../models';
import { EventBusService, NotificationEvent } from './event-bus.service';

// Offline operation queue types
export interface OfflineOperation {
  id: string;
  type: 'queue_entry' | 'work_order' | 'status_update';
  action: string;
  data: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

export interface SyncConflict {
  id: string;
  type: 'version_conflict' | 'data_conflict';
  localData: any;
  remoteData: any;
  resolution?: 'local' | 'remote' | 'merge';
}

// Event types for sync mediator communication
export type SyncMediatorEvent =
  | { type: 'sync.work_order_operation', operation: 'create' | 'update', data: any }
  | { type: 'sync.queue_operation', operation: 'create' | 'update', data: any }
  | { type: 'sync.offline_operation_queued', operationType: string, data: any }
  | { type: 'sync.cache_refresh_requested' }
  | { type: 'sync.manual_sync_requested' }
  | { type: 'sync.background_sync_completed', success: boolean, error?: string }
  | { type: 'sync.queue_status_sync', data: any }
  | { type: 'sync.offline_queue_resolved', resolvedOperations: any[] }
  | { type: 'sync.conflict_detected', conflictType: string, data: any };

@Injectable({
  providedIn: 'root'
})
export class SyncMediatorService {
  private eventBus = inject(EventBusService);
  private mediatorSubject = new Subject<SyncMediatorEvent>();

  // Enhanced offline sync state
  private offlineOperations = new BehaviorSubject<OfflineOperation[]>([]);
  private syncConflicts = new BehaviorSubject<SyncConflict[]>([]);
  private isOnline = new BehaviorSubject<boolean>(navigator.onLine);
  private readonly MAX_OFFLINE_OPERATIONS = 100;
  private readonly SYNC_RETRY_DELAY = 5000; // 5 seconds
  private readonly MAX_SYNC_RETRIES = 3;

  constructor() {
    // Listen to sync-related events from the event bus
    this.eventBus.events$.subscribe((event: NotificationEvent) => {
      if (event.type.startsWith('sync.')) {
        this.mediatorSubject.next(event as unknown as SyncMediatorEvent);
      }
    });

    // Listen to mediator events and forward to event bus if needed
    this.mediatorSubject.subscribe(event => {
      // Forward sync events to the global event bus
      this.eventBus.emit(event as any);
    });

    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.isOnline.next(true);
      this.processOfflineOperations();
    });

    window.addEventListener('offline', () => {
      this.isOnline.next(false);
    });

    // Load persisted offline operations
    this.loadPersistedOperations();

    // Start background sync if online
    if (this.isOnline.value) {
      this.startBackgroundSync();
    }
  }

  /**
   * Emit a sync mediator event
   */
  emit(event: SyncMediatorEvent): void {
    this.mediatorSubject.next(event);
  }

  /**
   * Get observable for sync mediator events
   */
  get events$(): Observable<SyncMediatorEvent> {
    return this.mediatorSubject.asObservable();
  }

  /**
   * Request work order sync operation
   */
  requestWorkOrderSync(operation: 'create' | 'update', data: any): void {
    this.emit({
      type: 'sync.work_order_operation',
      operation,
      data
    });
  }

  /**
   * Request queue sync operation
   */
  requestQueueSync(operation: 'create' | 'update', data: any): void {
    this.emit({
      type: 'sync.queue_operation',
      operation,
      data
    });
  }

  /**
   * Notify that an offline operation has been queued
   */
  notifyOfflineOperationQueued(operationType: string, data: any): void {
    this.notifyOfflineOperationQueuedEnhanced(operationType, data);
  }

  /**
   * Request cache refresh
   */
  requestCacheRefresh(): void {
    this.emit({
      type: 'sync.cache_refresh_requested'
    });
  }

  /**
   * Request manual sync
   */
  requestManualSync(): void {
    this.emit({
      type: 'sync.manual_sync_requested'
    });
  }

  /**
   * Notify background sync completion
   */
  notifyBackgroundSyncCompleted(success: boolean, error?: string): void {
    this.emit({
      type: 'sync.background_sync_completed',
      success,
      error
    });
  }

  /**
   * Enhanced offline operation queuing with conflict detection (internal method)
   */
  private notifyOfflineOperationQueuedEnhanced(operationType: string, data: any, maxRetries: number = this.MAX_SYNC_RETRIES): void {
    const operation: OfflineOperation = {
      id: `${operationType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: operationType as any,
      action: data.action || 'update',
      data,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries
    };

    // Check for potential conflicts before queuing
    this.detectConflicts(operation);

    const currentOperations = this.offlineOperations.value;
    if (currentOperations.length >= this.MAX_OFFLINE_OPERATIONS) {
      // Remove oldest operations if queue is full
      currentOperations.shift();
    }

    this.offlineOperations.next([...currentOperations, operation]);
    this.persistOperations();

    this.emit({
      type: 'sync.offline_operation_queued',
      operationType,
      data
    });
  }

  /**
   * Get observable for offline operations
   */
  get offlineOperations$(): Observable<OfflineOperation[]> {
    return this.offlineOperations.asObservable();
  }

  /**
   * Get observable for sync conflicts
   */
  get syncConflicts$(): Observable<SyncConflict[]> {
    return this.syncConflicts.asObservable();
  }

  /**
   * Get observable for online status
   */
  get isOnline$(): Observable<boolean> {
    return this.isOnline.asObservable();
  }

  /**
   * Process queued offline operations when back online
   */
  private async processOfflineOperations(): Promise<void> {
    const operations = [...this.offlineOperations.value];
    if (operations.length === 0) return;

    const resolvedOperations: any[] = [];

    for (const operation of operations) {
      try {
        await this.executeOfflineOperation(operation);
        resolvedOperations.push(operation);
        this.removeOperation(operation.id);
      } catch (error) {
        operation.retryCount++;
        if (operation.retryCount >= operation.maxRetries) {
          console.error(`Failed to sync operation ${operation.id} after ${operation.maxRetries} retries:`, error);
          this.removeOperation(operation.id);
        } else {
          // Update retry count
          this.updateOperationRetryCount(operation.id, operation.retryCount);
        }
      }
    }

    if (resolvedOperations.length > 0) {
      this.emit({
        type: 'sync.offline_queue_resolved',
        resolvedOperations
      });
    }
  }

  /**
   * Execute a single offline operation
   */
  private async executeOfflineOperation(operation: OfflineOperation): Promise<void> {
    // This would integrate with the specific services (QueueService, WorkOrderService, etc.)
    // For now, emit the operation for other services to handle
    this.emit({
      type: 'sync.queue_operation',
      operation: operation.action as 'create' | 'update',
      data: operation.data
    });
  }

  /**
   * Detect potential conflicts in offline operations
   */
  private detectConflicts(operation: OfflineOperation): void {
    const conflicts = this.syncConflicts.value;
    // Simple conflict detection - operations on same entity
    const existingConflicts = conflicts.filter(c =>
      c.localData.id === operation.data.id ||
      c.remoteData.id === operation.data.id
    );

    if (existingConflicts.length > 0) {
      this.emit({
        type: 'sync.conflict_detected',
        conflictType: 'data_conflict',
        data: { operation, existingConflicts }
      });
    }
  }

  /**
   * Start background sync process
   */
  private startBackgroundSync(): void {
    setInterval(() => {
      if (this.isOnline.value && this.offlineOperations.value.length > 0) {
        this.processOfflineOperations();
      }
    }, this.SYNC_RETRY_DELAY);
  }

  /**
   * Persist operations to localStorage
   */
  private persistOperations(): void {
    try {
      localStorage.setItem('sync_offline_operations', JSON.stringify(this.offlineOperations.value));
    } catch (error) {
      console.error('Failed to persist offline operations:', error);
    }
  }

  /**
   * Load persisted operations from localStorage
   */
  private loadPersistedOperations(): void {
    try {
      const persisted = localStorage.getItem('sync_offline_operations');
      if (persisted) {
        const operations = JSON.parse(persisted).map((op: any) => ({
          ...op,
          timestamp: new Date(op.timestamp)
        }));
        this.offlineOperations.next(operations);
      }
    } catch (error) {
      console.error('Failed to load persisted operations:', error);
    }
  }

  /**
   * Remove operation from queue
   */
  private removeOperation(operationId: string): void {
    const current = this.offlineOperations.value.filter(op => op.id !== operationId);
    this.offlineOperations.next(current);
    this.persistOperations();
  }

  /**
   * Update operation retry count
   */
  private updateOperationRetryCount(operationId: string, retryCount: number): void {
    const current = this.offlineOperations.value.map(op =>
      op.id === operationId ? { ...op, retryCount } : op
    );
    this.offlineOperations.next(current);
    this.persistOperations();
  }

  /**
   * Force manual sync of all pending operations
   */
  async forceSync(): Promise<void> {
    if (!this.isOnline.value) {
      throw new Error('Cannot sync while offline');
    }

    await this.processOfflineOperations();
  }

  /**
   * Clear all offline operations (use with caution)
   */
  clearOfflineOperations(): void {
    this.offlineOperations.next([]);
    this.persistOperations();
  }
}