import { Injectable, inject } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { WorkOrder } from '../models';
import { EventBusService, NotificationEvent } from './event-bus.service';

// Event types for sync mediator communication
export type SyncMediatorEvent =
  | { type: 'sync.work_order_operation', operation: 'create' | 'update', data: any }
  | { type: 'sync.queue_operation', operation: 'create' | 'update', data: any }
  | { type: 'sync.offline_operation_queued', operationType: string, data: any }
  | { type: 'sync.cache_refresh_requested' }
  | { type: 'sync.manual_sync_requested' }
  | { type: 'sync.background_sync_completed', success: boolean, error?: string };

@Injectable({
  providedIn: 'root'
})
export class SyncMediatorService {
  private eventBus = inject(EventBusService);
  private mediatorSubject = new Subject<SyncMediatorEvent>();

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
    this.emit({
      type: 'sync.offline_operation_queued',
      operationType,
      data
    });
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
}