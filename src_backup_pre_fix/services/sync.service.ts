import { Injectable, signal, inject } from '@angular/core';
import { interval, Subscription, BehaviorSubject } from 'rxjs';
import { OfflineDetectionService } from './offline-detection.service';
import { LocalStorageService, OfflineData } from './local-storage.service';
import { RetryService } from './retry.service';
import { QueueService } from './queue.service';
import { NotificationService } from './notification.service';
import { SyncMediatorService } from './sync-mediator.service';

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: Date | null;
  pendingOperations: number;
  syncInProgress: boolean;
  lastSyncError: string | null;
  connectionQuality: 'slow' | 'fast' | 'unknown';
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private offlineDetectionService = inject(OfflineDetectionService);
  private localStorageService = inject(LocalStorageService);
  private retryService = inject(RetryService);
  private queueService = inject(QueueService);
  private notificationService = inject(NotificationService);
  private syncMediator = inject(SyncMediatorService);

  // Sync status signals
  syncStatus = signal<SyncStatus>({
    isOnline: navigator.onLine,
    lastSyncTime: null,
    pendingOperations: 0,
    syncInProgress: false,
    lastSyncError: null,
    connectionQuality: 'unknown'
  });

  private syncSubscription?: Subscription;
  private backgroundSyncInterval = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeSync();
    this.startBackgroundSync();
  }

  /**
   * Initialize sync service
   */
  private initializeSync(): void {
    // Update sync status when online status changes
    this.offlineDetectionService.getOnlineStatus().subscribe(isOnline => {
      this.updateSyncStatus({ isOnline });
    });

    // Update connection quality
    this.offlineDetectionService.getConnectionQuality().subscribe(quality => {
      this.updateSyncStatus({ connectionQuality: quality });
    });

    // Update pending operations count
    this.updatePendingOperationsCount();
  }

  /**
   * Start background sync when online
   */
  private startBackgroundSync(): void {
    this.syncSubscription = interval(this.backgroundSyncInterval).subscribe(() => {
      if (this.offlineDetectionService.isOnline() && this.hasPendingOperations()) {
        this.performBackgroundSync();
      }
    });
  }

  /**
   * Perform manual sync
   */
  async performManualSync(): Promise<void> {
    if (!this.offlineDetectionService.isOnline()) {
      throw new Error('No internet connection available');
    }

    this.updateSyncStatus({ syncInProgress: true, lastSyncError: null });

    try {
      await this.syncOfflineOperations();
      await this.refreshCachedData();
      this.updateSyncStatus({
        lastSyncTime: new Date(),
        syncInProgress: false
      });
      this.updatePendingOperationsCount();
    } catch (error: any) {
      this.updateSyncStatus({
        syncInProgress: false,
        lastSyncError: error.message || 'Sync failed'
      });
      throw error;
    }
  }

  /**
   * Perform background sync (lighter version)
   */
  private async performBackgroundSync(): Promise<void> {
    try {
      await this.syncOfflineOperations();
      this.updateSyncStatus({ lastSyncTime: new Date() });
      this.updatePendingOperationsCount();
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }

  /**
   * Sync offline operations
   */
  private async syncOfflineOperations(): Promise<void> {
    const operations = this.localStorageService.getOfflineQueue();

    for (const operation of operations) {
      try {
        await this.retryService.execute(
          () => this.executeOperation(operation),
          {
            maxAttempts: 3,
            baseDelay: 2000,
            maxDelay: 10000
          }
        );

        // Remove successful operation
        this.localStorageService.removeFromOfflineQueue(operation.id);
      } catch (error: any) {
        // Update operation with error
        this.localStorageService.updateOfflineOperation(operation.id, {
          retryCount: operation.retryCount + 1,
          lastAttempt: Date.now(),
          error: error.message
        });

        // If max retries reached, mark as failed
        if (operation.retryCount >= 2) {
          console.error(`Operation ${operation.id} failed permanently:`, error);
        }
      }
    }
  }

  /**
   * Execute a single offline operation
   */
  private async executeOperation(operation: OfflineData): Promise<void> {
    switch (operation.type) {
      case 'work_order':
        await this.syncWorkOrderOperation(operation);
        break;
      case 'queue_entry':
        await this.syncQueueOperation(operation);
        break;
      case 'time_entry':
        await this.syncTimeEntryOperation(operation);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Sync work order operations
   */
  private async syncWorkOrderOperation(operation: OfflineData): Promise<void> {
    // Emit event to mediator for work order operations
    this.syncMediator.requestWorkOrderSync(operation.action as 'create' | 'update', operation.data);
  }

  /**
   * Sync queue operations
   */
   private async syncQueueOperation(operation: OfflineData): Promise<void> {
     // Use sync mediator to avoid direct dependency
     this.syncMediator.requestQueueSync(operation.action as 'create' | 'update', operation.data);
   }

  /**
   * Sync time entry operations
   */
  private async syncTimeEntryOperation(operation: OfflineData): Promise<void> {
    // Time entries are typically handled by the time tracking service
    // This would need to be implemented based on the specific time tracking service
    console.log('Time entry sync not yet implemented:', operation);
  }

  /**
   * Refresh cached data from server
   */
  private async refreshCachedData(): Promise<void> {
    try {
      // Request cache refresh through mediator
      this.syncMediator.requestCacheRefresh();

      // Request cache refresh through mediator for queue entries
      this.syncMediator.requestCacheRefresh();

      // Refresh notifications cache
      const notifications = this.notificationService.getSystemNotifications()();
      this.localStorageService.cacheNotifications(notifications);

      // Update last sync time
      this.localStorageService.setLastSyncTime();
    } catch (error) {
      console.error('Error refreshing cached data:', error);
    }
  }

  /**
   * Add operation to offline queue
   */
  addOfflineOperation(operation: Omit<OfflineData, 'id' | 'timestamp' | 'retryCount'>): void {
    this.localStorageService.addToOfflineQueue(operation);
    this.updatePendingOperationsCount();
  }

  /**
   * Check if there are pending operations
   */
  hasPendingOperations(): boolean {
    return this.localStorageService.getOfflineQueue().length > 0;
  }

  /**
   * Get pending operations count
   */
  getPendingOperationsCount(): number {
    return this.localStorageService.getOfflineQueue().length;
  }

  /**
   * Update pending operations count in sync status
   */
  private updatePendingOperationsCount(): void {
    const count = this.getPendingOperationsCount();
    this.updateSyncStatus({ pendingOperations: count });
  }

  /**
   * Update sync status
   */
  private updateSyncStatus(updates: Partial<SyncStatus>): void {
    this.syncStatus.update(current => ({ ...current, ...updates }));
  }

  /**
   * Force refresh of cached data
   */
  async forceRefreshCache(): Promise<void> {
    if (!this.offlineDetectionService.isOnline()) {
      throw new Error('Cannot refresh cache while offline');
    }

    this.updateSyncStatus({ syncInProgress: true });

    try {
      await this.refreshCachedData();
      this.updateSyncStatus({
        lastSyncTime: new Date(),
        syncInProgress: false
      });
    } catch (error: any) {
      this.updateSyncStatus({
        syncInProgress: false,
        lastSyncError: error.message
      });
      throw error;
    }
  }

  /**
   * Get failed operations for manual review
   */
  getFailedOperations(): OfflineData[] {
    return this.localStorageService.getOfflineQueue()
      .filter(op => op.error && op.retryCount >= 2);
  }

  /**
   * Retry failed operation
   */
  async retryFailedOperation(operationId: string): Promise<void> {
    const operations = this.localStorageService.getOfflineQueue();
    const operation = operations.find(op => op.id === operationId);

    if (!operation) {
      throw new Error('Operation not found');
    }

    if (!this.offlineDetectionService.isOnline()) {
      throw new Error('Cannot retry while offline');
    }

    try {
      await this.retryService.execute(
        () => this.executeOperation(operation),
        {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 5000
        }
      );

      this.localStorageService.removeFromOfflineQueue(operationId);
      this.updatePendingOperationsCount();
    } catch (error: any) {
      this.localStorageService.updateOfflineOperation(operationId, {
        retryCount: operation.retryCount + 1,
        lastAttempt: Date.now(),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clear all failed operations
   */
  clearFailedOperations(): void {
    const operations = this.localStorageService.getOfflineQueue();
    const activeOperations = operations.filter(op => !op.error || op.retryCount < 2);
    this.localStorageService.clearOfflineQueue();

    // Re-add active operations
    activeOperations.forEach(op => {
      this.localStorageService.addToOfflineQueue({
        type: op.type,
        action: op.action,
        data: op.data
      });
    });

    this.updatePendingOperationsCount();
  }

  /**
   * Cleanup old cached data
   */
  cleanupOldCache(): void {
    // This would implement cache cleanup logic
    // For now, just clear if storage is low
    if (this.localStorageService.isStorageLow()) {
      console.warn('Storage low, clearing old cache data');
      // Clear oldest cached data first
      // Implementation would depend on cache age tracking
    }
  }

  ngOnDestroy(): void {
    if (this.syncSubscription) {
      this.syncSubscription.unsubscribe();
    }
  }
}