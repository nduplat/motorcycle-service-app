import { Injectable, inject } from '@angular/core';
import { TimeTrackingWorkflowService, TimeTrackingState } from './time-tracking-workflow.service';
import { UserService } from './user.service';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { switchMap, filter } from 'rxjs/operators';

export interface BackgroundTimerConfig {
  updateInterval: number; // seconds
  syncInterval: number; // seconds - how often to sync with server
  maxOfflineTime: number; // minutes - max time allowed without sync
}

@Injectable({
  providedIn: 'root'
})
export class BackgroundTimerService {
  private timeTrackingService = inject(TimeTrackingWorkflowService);
  private userService = inject(UserService);

  private config: BackgroundTimerConfig = {
    updateInterval: 30, // Update every 30 seconds
    syncInterval: 300, // Sync every 5 minutes
    maxOfflineTime: 60 // Max 1 hour without sync
  };

  private updateSubscription: Subscription | null = null;
  private syncSubscription: Subscription | null = null;
  private lastSyncTime = new Date();
  private isOnline = new BehaviorSubject<boolean>(navigator.onLine);

  // Track active timers
  private activeTimers = new Map<string, { lastUpdate: Date; state: TimeTrackingState }>();

  constructor() {
    // Monitor online/offline status
    window.addEventListener('online', () => this.isOnline.next(true));
    window.addEventListener('offline', () => this.isOnline.next(false));

    // Start background timers
    this.startBackgroundUpdates();
    this.startPeriodicSync();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BackgroundTimerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.restartTimers();
  }

  /**
   * Start background timer updates
   */
  private startBackgroundUpdates(): void {
    if (this.updateSubscription) {
      this.updateSubscription.unsubscribe();
    }

    this.updateSubscription = interval(this.config.updateInterval * 1000)
      .pipe(
        switchMap(() => this.updateActiveTimers())
      )
      .subscribe();
  }

  /**
   * Start periodic synchronization
   */
  private startPeriodicSync(): void {
    if (this.syncSubscription) {
      this.syncSubscription.unsubscribe();
    }

    this.syncSubscription = interval(this.config.syncInterval * 1000)
      .pipe(
        filter(() => this.isOnline.value), // Only sync when online
        switchMap(() => this.syncWithServer())
      )
      .subscribe();
  }

  /**
   * Update all active timers
   */
  private async updateActiveTimers(): Promise<void> {
    try {
      const technicians = this.userService.getTechnicians();

      for (const technician of technicians) {
        // Check if technician has an active workflow
        const workflowState = await this.timeTrackingService.getWorkflowState(technician.id).toPromise();

        if (workflowState && workflowState.isActive) {
          // Update local tracking
          this.activeTimers.set(technician.id, {
            lastUpdate: new Date(),
            state: workflowState
          });

          // Check for offline timeout
          if (!this.isOnline.value) {
            const offlineTime = (new Date().getTime() - this.lastSyncTime.getTime()) / (1000 * 60);
            if (offlineTime > this.config.maxOfflineTime) {
              console.warn(`🔧 BackgroundTimer: Technician ${technician.id} offline too long, pausing timer`);
              await this.timeTrackingService.pauseJob(technician.id, 'Offline timeout');
            }
          }
        } else {
          // Remove from active timers if no longer active
          this.activeTimers.delete(technician.id);
        }
      }
    } catch (error) {
      console.error('Error updating active timers:', error);
    }
  }

  /**
   * Sync local state with server
   */
  private async syncWithServer(): Promise<void> {
    try {
      console.log('🔧 BackgroundTimer: Syncing with server...');

      // Sync each active timer
      for (const [technicianId, timerData] of this.activeTimers) {
        try {
          // Verify the timer state is still valid on server
          const serverState = await this.timeTrackingService.getWorkflowState(technicianId).toPromise();

          if (!serverState) {
            // Timer was stopped on server, clean up local state
            console.log(`🔧 BackgroundTimer: Cleaning up local timer for technician ${technicianId}`);
            this.activeTimers.delete(technicianId);
          } else if (serverState.isActive && !timerData.state.isActive) {
            // Server has active timer but local doesn't - resync
            console.log(`🔧 BackgroundTimer: Resyncing timer for technician ${technicianId}`);
            this.activeTimers.set(technicianId, {
              lastUpdate: new Date(),
              state: serverState
            });
          }
        } catch (error) {
          console.error(`Error syncing timer for technician ${technicianId}:`, error);
        }
      }

      this.lastSyncTime = new Date();
      console.log('🔧 BackgroundTimer: Server sync completed');
    } catch (error) {
      console.error('Error during server sync:', error);
    }
  }

  /**
   * Get active timer count
   */
  getActiveTimerCount(): number {
    return this.activeTimers.size;
  }

  /**
   * Get timer info for a specific technician
   */
  getTimerInfo(technicianId: string): { lastUpdate: Date; state: TimeTrackingState } | null {
    return this.activeTimers.get(technicianId) || null;
  }

  /**
   * Force sync for a specific technician
   */
  async forceSync(technicianId: string): Promise<void> {
    try {
      const serverState = await this.timeTrackingService.getWorkflowState(technicianId).toPromise();

      if (serverState) {
        this.activeTimers.set(technicianId, {
          lastUpdate: new Date(),
          state: serverState
        });
      } else {
        this.activeTimers.delete(technicianId);
      }
    } catch (error) {
      console.error(`Error force syncing technician ${technicianId}:`, error);
      throw error;
    }
  }

  /**
   * Check if service is online
   */
  isServiceOnline(): boolean {
    return this.isOnline.value;
  }

  /**
   * Get current configuration
   */
  getConfig(): BackgroundTimerConfig {
    return { ...this.config };
  }

  /**
   * Restart timers with new configuration
   */
  private restartTimers(): void {
    this.stopTimers();
    this.startBackgroundUpdates();
    this.startPeriodicSync();
  }

  /**
   * Stop all timers
   */
  private stopTimers(): void {
    if (this.updateSubscription) {
      this.updateSubscription.unsubscribe();
      this.updateSubscription = null;
    }

    if (this.syncSubscription) {
      this.syncSubscription.unsubscribe();
      this.syncSubscription = null;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopTimers();
    window.removeEventListener('online', () => this.isOnline.next(true));
    window.removeEventListener('offline', () => this.isOnline.next(false));
  }
}