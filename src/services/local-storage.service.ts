import { Injectable } from '@angular/core';

export interface OfflineData {
  id: string;
  type: 'work_order' | 'queue_entry' | 'notification' | 'time_entry';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
  lastAttempt?: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {
  private readonly STORAGE_KEYS = {
    OFFLINE_QUEUE: 'offline_queue',
    CACHED_WORK_ORDERS: 'cached_work_orders',
    CACHED_QUEUE_ENTRIES: 'cached_queue_entries',
    CACHED_NOTIFICATIONS: 'cached_notifications',
    LAST_SYNC_TIME: 'last_sync_time',
    PENDING_CHANGES: 'pending_changes'
  };

  constructor() {}

  // ========== OFFLINE QUEUE MANAGEMENT ==========

  /**
   * Add operation to offline queue
   */
  addToOfflineQueue(operation: Omit<OfflineData, 'id' | 'timestamp' | 'retryCount'>): void {
    const queue = this.getOfflineQueue();
    const offlineData: OfflineData = {
      ...operation,
      id: this.generateId(),
      timestamp: Date.now(),
      retryCount: 0
    };

    queue.push(offlineData);
    this.saveOfflineQueue(queue);
  }

  /**
   * Get all pending offline operations
   */
  getOfflineQueue(): OfflineData[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.OFFLINE_QUEUE);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading offline queue:', error);
      return [];
    }
  }

  /**
   * Update operation in offline queue
   */
  updateOfflineOperation(id: string, updates: Partial<OfflineData>): void {
    const queue = this.getOfflineQueue();
    const index = queue.findIndex(op => op.id === id);

    if (index !== -1) {
      queue[index] = { ...queue[index], ...updates };
      this.saveOfflineQueue(queue);
    }
  }

  /**
   * Remove operation from offline queue
   */
  removeFromOfflineQueue(id: string): void {
    const queue = this.getOfflineQueue();
    const filtered = queue.filter(op => op.id !== id);
    this.saveOfflineQueue(filtered);
  }

  /**
   * Clear offline queue
   */
  clearOfflineQueue(): void {
    localStorage.removeItem(this.STORAGE_KEYS.OFFLINE_QUEUE);
  }

  /**
   * Get operations by type
   */
  getOfflineOperationsByType(type: OfflineData['type']): OfflineData[] {
    return this.getOfflineQueue().filter(op => op.type === type);
  }

  // ========== CACHED DATA MANAGEMENT ==========

  /**
   * Cache work orders for offline access
   */
  cacheWorkOrders(workOrders: any[]): void {
    try {
      localStorage.setItem(
        this.STORAGE_KEYS.CACHED_WORK_ORDERS,
        JSON.stringify({
          data: workOrders,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      console.error('Error caching work orders:', error);
    }
  }

  /**
   * Get cached work orders
   */
  getCachedWorkOrders(): any[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.CACHED_WORK_ORDERS);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if cache is less than 24 hours old
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.data || [];
        }
      }
    } catch (error) {
      console.error('Error reading cached work orders:', error);
    }
    return [];
  }

  /**
   * Cache queue entries for offline access
   */
  cacheQueueEntries(queueEntries: any[]): void {
    try {
      localStorage.setItem(
        this.STORAGE_KEYS.CACHED_QUEUE_ENTRIES,
        JSON.stringify({
          data: queueEntries,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      console.error('Error caching queue entries:', error);
    }
  }

  /**
   * Get cached queue entries
   */
  getCachedQueueEntries(): any[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.CACHED_QUEUE_ENTRIES);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if cache is less than 1 hour old
        if (Date.now() - parsed.timestamp < 60 * 60 * 1000) {
          return parsed.data || [];
        }
      }
    } catch (error) {
      console.error('Error reading cached queue entries:', error);
    }
    return [];
  }

  /**
   * Cache notifications for offline access
   */
  cacheNotifications(notifications: any[]): void {
    try {
      localStorage.setItem(
        this.STORAGE_KEYS.CACHED_NOTIFICATIONS,
        JSON.stringify({
          data: notifications,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      console.error('Error caching notifications:', error);
    }
  }

  /**
   * Get cached notifications
   */
  getCachedNotifications(): any[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.CACHED_NOTIFICATIONS);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if cache is less than 6 hours old
        if (Date.now() - parsed.timestamp < 6 * 60 * 60 * 1000) {
          return parsed.data || [];
        }
      }
    } catch (error) {
      console.error('Error reading cached notifications:', error);
    }
    return [];
  }

  // ========== SYNC MANAGEMENT ==========

  /**
   * Set last sync time
   */
  setLastSyncTime(timestamp: number = Date.now()): void {
    localStorage.setItem(this.STORAGE_KEYS.LAST_SYNC_TIME, timestamp.toString());
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): number | null {
    const stored = localStorage.getItem(this.STORAGE_KEYS.LAST_SYNC_TIME);
    return stored ? parseInt(stored, 10) : null;
  }

  /**
   * Check if data needs sync (older than specified minutes)
   */
  needsSync(maxAgeMinutes: number = 30): boolean {
    const lastSync = this.getLastSyncTime();
    if (!lastSync) return true;

    const ageMinutes = (Date.now() - lastSync) / (1000 * 60);
    return ageMinutes > maxAgeMinutes;
  }

  // ========== PENDING CHANGES MANAGEMENT ==========

  /**
   * Store pending changes that need to be synced
   */
  addPendingChange(change: {
    id: string;
    type: string;
    operation: 'create' | 'update' | 'delete';
    data: any;
    timestamp: number;
  }): void {
    const pending = this.getPendingChanges();
    pending.push(change);
    this.savePendingChanges(pending);
  }

  /**
   * Get all pending changes
   */
  getPendingChanges(): any[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.PENDING_CHANGES);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading pending changes:', error);
      return [];
    }
  }

  /**
   * Remove pending change after successful sync
   */
  removePendingChange(id: string): void {
    const pending = this.getPendingChanges();
    const filtered = pending.filter(change => change.id !== id);
    this.savePendingChanges(filtered);
  }

  /**
   * Clear all pending changes
   */
  clearPendingChanges(): void {
    localStorage.removeItem(this.STORAGE_KEYS.PENDING_CHANGES);
  }

  // ========== UTILITY METHODS ==========

  /**
   * Clear all cached data
   */
  clearAllCache(): void {
    Object.values(this.STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  /**
   * Get storage usage information
   */
  getStorageInfo(): { used: number; available: number; percentage: number } {
    let used = 0;
    Object.values(this.STORAGE_KEYS).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        used += item.length;
      }
    });

    // Estimate available space (localStorage typically allows 5-10MB)
    const available = 5 * 1024 * 1024; // 5MB estimate
    const percentage = (used / available) * 100;

    return { used, available, percentage };
  }

  /**
   * Check if storage is running low
   */
  isStorageLow(): boolean {
    const info = this.getStorageInfo();
    return info.percentage > 80; // Consider low when over 80%
  }

  private saveOfflineQueue(queue: OfflineData[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  private savePendingChanges(changes: any[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.PENDING_CHANGES, JSON.stringify(changes));
    } catch (error) {
      console.error('Error saving pending changes:', error);
    }
  }

  private generateId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}