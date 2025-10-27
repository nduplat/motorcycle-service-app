import { Injectable, signal, computed, inject } from '@angular/core';
import { OfflineDetectionService } from './offline-detection.service';
import { SyncService } from './sync.service';

export interface StatusDisplay {
  text: string;
  color: string;
}

@Injectable({
  providedIn: 'root'
})
export class StatusDisplayService {
  private offlineDetectionService = inject(OfflineDetectionService);
  private syncService = inject(SyncService);

  // Connection status display
  connectionStatusDisplay = computed<StatusDisplay>(() => {
    const isOnline = this.offlineDetectionService.isOnline();
    const connectionQuality = this.offlineDetectionService.connectionQuality();

    return {
      text: this.getConnectionStatusText(isOnline, connectionQuality),
      color: this.getConnectionStatusColor(isOnline, connectionQuality)
    };
  });

  // Sync status display
  syncStatusDisplay = computed<StatusDisplay>(() => {
    const syncStatus = this.syncService.syncStatus();

    return {
      text: this.getSyncStatusText(syncStatus),
      color: this.getSyncStatusColor(syncStatus)
    };
  });

  /**
   * Get connection status text based on online status and quality
   */
  private getConnectionStatusText(isOnline: boolean, connectionQuality: 'slow' | 'fast' | 'unknown'): string {
    if (!isOnline) return 'Sin conexión';
    if (connectionQuality === 'slow') return 'Conexión lenta';
    if (connectionQuality === 'fast') return 'Conexión buena';
    return 'Conectado';
  }

  /**
   * Get connection status color based on online status and quality
   */
  private getConnectionStatusColor(isOnline: boolean, connectionQuality: 'slow' | 'fast' | 'unknown'): string {
    if (!isOnline) return 'warn';
    if (connectionQuality === 'slow') return 'accent';
    return 'primary';
  }

  /**
   * Get sync status text based on sync status
   */
  private getSyncStatusText(syncStatus: any): string {
    if (syncStatus.syncInProgress) return 'Sincronizando...';
    if (syncStatus.pendingOperations > 0) return `${syncStatus.pendingOperations} pendiente(s)`;
    if (syncStatus.lastSyncError) return 'Error de sincronización';
    return 'Sincronizado';
  }

  /**
   * Get sync status color based on sync status
   */
  private getSyncStatusColor(syncStatus: any): string {
    if (syncStatus.syncInProgress) return 'accent';
    if (syncStatus.pendingOperations > 0) return 'warn';
    if (syncStatus.lastSyncError) return 'warn';
    return 'primary';
  }
}