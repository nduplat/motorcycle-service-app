import { Injectable, inject } from '@angular/core';
import { TimeTrackingWorkflowService } from './time-tracking-workflow.service';
import { UserService } from './user.service';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { switchMap, filter } from 'rxjs/operators';

export interface AutoPauseConfig {
  enabled: boolean;
  inactivityThreshold: number; // minutes
  checkInterval: number; // seconds
  autoResumeOnActivity: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AutoPauseService {
  private timeTrackingService = inject(TimeTrackingWorkflowService);
  private userService = inject(UserService);

  private config: AutoPauseConfig = {
    enabled: true,
    inactivityThreshold: 15, // 15 minutes
    checkInterval: 60, // check every minute
    autoResumeOnActivity: true
  };

  private lastActivityTime = new Date();
  private monitoringSubscription: Subscription | null = null;
  private isMonitoring = new BehaviorSubject<boolean>(false);

  constructor() {
    // Start monitoring when the service initializes
    this.startMonitoring();
  }

  /**
   * Update auto-pause configuration
   */
  updateConfig(newConfig: Partial<AutoPauseConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.restartMonitoring();
  }

  /**
   * Record user activity to prevent auto-pause
   */
  recordActivity(): void {
    this.lastActivityTime = new Date();
  }

  /**
   * Start monitoring for inactivity
   */
  private startMonitoring(): void {
    if (this.monitoringSubscription) {
      this.monitoringSubscription.unsubscribe();
    }

    if (!this.config.enabled) {
      return;
    }

    this.monitoringSubscription = interval(this.config.checkInterval * 1000)
      .pipe(
        switchMap(() => this.checkInactivity())
      )
      .subscribe();
  }

  /**
   * Restart monitoring with new configuration
   */
  private restartMonitoring(): void {
    this.stopMonitoring();
    this.startMonitoring();
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringSubscription) {
      this.monitoringSubscription.unsubscribe();
      this.monitoringSubscription = null;
    }
  }

  /**
   * Check for inactivity and auto-pause if needed
   */
  private async checkInactivity(): Promise<void> {
    try {
      const technicians = this.userService.getTechnicians();
      const now = new Date();
      const thresholdMs = this.config.inactivityThreshold * 60 * 1000;

      for (const technician of technicians) {
        // Check if technician has an active workflow
        if (!this.timeTrackingService.hasActiveWorkflow(technician.id)) {
          continue;
        }

        // Get current workflow state
        const stateObservable = this.timeTrackingService.getWorkflowState(technician.id);
        const state = await stateObservable.toPromise();

        if (!state || !state.isActive || state.isPaused) {
          continue;
        }

        // Check if technician is marked as available (which might indicate break)
        if (technician.availability?.isAvailable) {
          // Technician is marked as available but has active timer - likely on break
          console.log(`🔧 AutoPause: Technician ${technician.id} appears to be on break (marked available)`);
          await this.timeTrackingService.pauseJob(technician.id, 'Auto-detected break');
          continue;
        }

        // Check for inactivity timeout
        const timeSinceActivity = now.getTime() - this.lastActivityTime.getTime();
        if (timeSinceActivity > thresholdMs) {
          console.log(`🔧 AutoPause: Auto-pausing technician ${technician.id} due to inactivity (${Math.floor(timeSinceActivity / (1000 * 60))} minutes)`);
          await this.timeTrackingService.pauseJob(technician.id, 'Auto-paused due to inactivity');
        }
      }
    } catch (error) {
      console.error('Error in auto-pause check:', error);
    }
  }

  /**
   * Get monitoring status
   */
  isMonitoringActive(): boolean {
    return this.monitoringSubscription !== null;
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoPauseConfig {
    return { ...this.config };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopMonitoring();
  }
}