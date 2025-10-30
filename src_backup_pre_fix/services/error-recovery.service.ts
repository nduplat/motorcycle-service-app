import { Injectable, inject } from '@angular/core';
import { TimeTrackingWorkflowService, TimeTrackingState } from './time-tracking-workflow.service';
import { TimeEntryService } from './time-entry.service';
import { UserService } from './user.service';
import { BackgroundTimerService } from './background-timer.service';
import { BehaviorSubject, Observable } from 'rxjs';

export interface RecoveryAction {
  id: string;
  type: 'resume_timer' | 'sync_state' | 'restart_workflow' | 'fix_inconsistency';
  technicianId: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  autoRecoverable: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorRecoveryService {
  private timeTrackingService = inject(TimeTrackingWorkflowService);
  private timeEntryService = inject(TimeEntryService);
  private userService = inject(UserService);
  private backgroundTimerService = inject(BackgroundTimerService);

  private recoveryActions = new BehaviorSubject<RecoveryAction[]>([]);
  private isRecovering = new BehaviorSubject<boolean>(false);

  constructor() {
    // Start monitoring for inconsistencies
    this.startConsistencyMonitoring();
  }

  /**
   * Get pending recovery actions
   */
  getRecoveryActions(): Observable<RecoveryAction[]> {
    return this.recoveryActions.asObservable();
  }

  /**
   * Check if recovery is in progress
   */
  isRecoveryInProgress(): Observable<boolean> {
    return this.isRecovering.asObservable();
  }

  /**
   * Execute a recovery action
   */
  async executeRecovery(action: RecoveryAction): Promise<boolean> {
    this.isRecovering.next(true);

    try {
      let success = false;

      switch (action.type) {
        case 'resume_timer':
          success = await this.resumeOrphanedTimer(action.technicianId);
          break;
        case 'sync_state':
          success = await this.syncWorkflowState(action.technicianId);
          break;
        case 'restart_workflow':
          success = await this.restartWorkflow(action.technicianId);
          break;
        case 'fix_inconsistency':
          success = await this.fixStateInconsistency(action.technicianId);
          break;
      }

      if (success) {
        // Remove the action from the list
        const currentActions = this.recoveryActions.value;
        const updatedActions = currentActions.filter(a => a.id !== action.id);
        this.recoveryActions.next(updatedActions);
      }

      return success;
    } catch (error) {
      console.error('Recovery action failed:', error);
      return false;
    } finally {
      this.isRecovering.next(false);
    }
  }

  /**
   * Run automatic recovery for all technicians
   */
  async runAutomaticRecovery(): Promise<void> {
    const actions = this.recoveryActions.value;
    const autoRecoverableActions = actions.filter(action => action.autoRecoverable);

    for (const action of autoRecoverableActions) {
      try {
        await this.executeRecovery(action);
      } catch (error) {
        console.error(`Auto-recovery failed for action ${action.id}:`, error);
      }
    }
  }

  /**
   * Resume an orphaned timer (timer running but no workflow state)
   */
  private async resumeOrphanedTimer(technicianId: string): Promise<boolean> {
    try {
      // Check if there's an active time entry
      const activeEntry = await this.timeEntryService.getActiveTimeEntry(technicianId);
      if (!activeEntry) {
        return false;
      }

      // Check if workflow state exists
      const workflowState = await this.timeTrackingService.getWorkflowState(technicianId).toPromise();
      if (workflowState) {
        return false; // State already exists
      }

      // Recreate workflow state
      const state: TimeTrackingState = {
        technicianId,
        workOrderId: activeEntry.workOrderId,
        isActive: true,
        isPaused: this.timeEntryService.isTimeEntryPaused(technicianId),
        elapsedTime: this.timeEntryService.getElapsedTime(),
        totalPausedTime: this.timeEntryService.getTotalPausedTime(),
        status: this.timeEntryService.isTimeEntryPaused(technicianId) ? 'on_break' : 'busy',
        currentEntry: activeEntry
      };

      // Manually set the workflow state (this would need to be added to the service)
      // For now, we'll just ensure the background timer knows about it
      await this.backgroundTimerService.forceSync(technicianId);

      console.log(`Recovered orphaned timer for technician ${technicianId}`);
      return true;
    } catch (error) {
      console.error('Failed to resume orphaned timer:', error);
      return false;
    }
  }

  /**
   * Sync workflow state with server
   */
  private async syncWorkflowState(technicianId: string): Promise<boolean> {
    try {
      await this.backgroundTimerService.forceSync(technicianId);
      console.log(`Synced workflow state for technician ${technicianId}`);
      return true;
    } catch (error) {
      console.error('Failed to sync workflow state:', error);
      return false;
    }
  }

  /**
   * Restart a broken workflow
   */
  private async restartWorkflow(technicianId: string): Promise<boolean> {
    try {
      // Get the active time entry
      const activeEntry = await this.timeEntryService.getActiveTimeEntry(technicianId);
      if (!activeEntry) {
        return false;
      }

      // Stop the current entry and restart it
      await this.timeEntryService.stopTimeEntry(technicianId);
      await this.timeTrackingService.startJob(activeEntry.workOrderId, technicianId);

      console.log(`Restarted workflow for technician ${technicianId}`);
      return true;
    } catch (error) {
      console.error('Failed to restart workflow:', error);
      return false;
    }
  }

  /**
   * Fix state inconsistencies
   */
  private async fixStateInconsistency(technicianId: string): Promise<boolean> {
    try {
      // Get all current states
      const workflowState = await this.timeTrackingService.getWorkflowState(technicianId).toPromise();
      const activeEntry = await this.timeEntryService.getActiveTimeEntry(technicianId);
      const technician = this.userService.getUserById(technicianId);

      // Check for inconsistencies
      const hasWorkflowState = !!workflowState;
      const hasActiveEntry = !!activeEntry;
      const isMarkedBusy = technician?.availability?.isAvailable === false;

      // Case 1: Has workflow state and active entry, but marked as available
      if (hasWorkflowState && hasActiveEntry && !isMarkedBusy) {
        await this.userService.updateMyAvailability(false, 'Working on job');
        console.log(`Fixed availability inconsistency for technician ${technicianId}`);
        return true;
      }

      // Case 2: No workflow state but has active entry
      if (!hasWorkflowState && hasActiveEntry) {
        return await this.resumeOrphanedTimer(technicianId);
      }

      // Case 3: Has workflow state but no active entry
      if (hasWorkflowState && !hasActiveEntry) {
        // This is more complex - might need to clean up the workflow state
        console.warn(`Workflow state exists but no active entry for technician ${technicianId}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to fix state inconsistency:', error);
      return false;
    }
  }

  /**
   * Start monitoring for inconsistencies
   */
  private startConsistencyMonitoring(): void {
    // Check every 5 minutes
    setInterval(async () => {
      await this.checkForInconsistencies();
    }, 5 * 60 * 1000);

    // Initial check
    setTimeout(() => {
      this.checkForInconsistencies();
    }, 10000); // Check after 10 seconds
  }

  /**
   * Check for system inconsistencies
   */
  private async checkForInconsistencies(): Promise<void> {
    try {
      const technicians = this.userService.getTechnicians();
      const newActions: RecoveryAction[] = [];

      for (const technician of technicians) {
        const inconsistencies = await this.detectInconsistencies(technician.id);

        for (const inconsistency of inconsistencies) {
          // Check if action already exists
          const existingAction = this.recoveryActions.value.find(
            action => action.technicianId === technician.id && action.type === inconsistency.type
          );

          if (!existingAction) {
            newActions.push({
              id: `${inconsistency.type}_${technician.id}_${Date.now()}`,
              type: inconsistency.type,
              technicianId: technician.id,
              description: inconsistency.description,
              priority: inconsistency.priority,
              timestamp: new Date(),
              autoRecoverable: inconsistency.autoRecoverable
            });
          }
        }
      }

      if (newActions.length > 0) {
        const currentActions = this.recoveryActions.value;
        this.recoveryActions.next([...currentActions, ...newActions]);
      }

      // Run automatic recovery for high-priority issues
      const highPriorityActions = newActions.filter(action => action.priority === 'critical' || action.priority === 'high');
      if (highPriorityActions.length > 0) {
        setTimeout(() => {
          this.runAutomaticRecovery();
        }, 5000); // Wait 5 seconds before auto-recovering
      }
    } catch (error) {
      console.error('Error checking for inconsistencies:', error);
    }
  }

  /**
   * Detect inconsistencies for a technician
   */
  private async detectInconsistencies(technicianId: string): Promise<Array<{
    type: 'resume_timer' | 'sync_state' | 'restart_workflow' | 'fix_inconsistency';
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    autoRecoverable: boolean;
  }>> {
    const inconsistencies: Array<{
      type: 'resume_timer' | 'sync_state' | 'restart_workflow' | 'fix_inconsistency';
      description: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      autoRecoverable: boolean;
    }> = [];

    try {
      const workflowState = await this.timeTrackingService.getWorkflowState(technicianId).toPromise();
      const activeEntry = await this.timeEntryService.getActiveTimeEntry(technicianId);
      const technician = this.userService.getUserById(technicianId);

      const hasWorkflowState = !!workflowState;
      const hasActiveEntry = !!activeEntry;
      const isMarkedBusy = technician?.availability?.isAvailable === false;

      // Check for orphaned timer
      if (!hasWorkflowState && hasActiveEntry) {
        inconsistencies.push({
          type: 'resume_timer',
          description: 'Active time entry found but no workflow state',
          priority: 'high',
          autoRecoverable: true
        });
      }

      // Check for availability inconsistency
      if (hasWorkflowState && hasActiveEntry && !isMarkedBusy) {
        inconsistencies.push({
          type: 'fix_inconsistency',
          description: 'Technician has active timer but is marked as available',
          priority: 'medium',
          autoRecoverable: true
        });
      }

      // Check for state sync issues
      const backgroundInfo = this.backgroundTimerService.getTimerInfo(technicianId);
      if (hasWorkflowState && !backgroundInfo) {
        inconsistencies.push({
          type: 'sync_state',
          description: 'Workflow state exists but background timer not tracking',
          priority: 'low',
          autoRecoverable: true
        });
      }

    } catch (error) {
      console.error(`Error detecting inconsistencies for technician ${technicianId}:`, error);
    }

    return inconsistencies;
  }

  /**
   * Clear all recovery actions
   */
  clearRecoveryActions(): void {
    this.recoveryActions.next([]);
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): { total: number; byPriority: Record<string, number>; byType: Record<string, number> } {
    const actions = this.recoveryActions.value;
    const byPriority: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const action of actions) {
      byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
      byType[action.type] = (byType[action.type] || 0) + 1;
    }

    return {
      total: actions.length,
      byPriority,
      byType
    };
  }
}