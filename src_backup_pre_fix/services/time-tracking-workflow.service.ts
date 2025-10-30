import { Injectable, inject, signal } from '@angular/core';
import { TimeEntryService } from './time-entry.service';
import { UserService } from './user.service';
import { WorkOrderService } from './work-order.service';
import { TimeEntry, User, WorkOrder } from '../models';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

export interface TimeTrackingState {
  technicianId: string;
  workOrderId: string;
  isActive: boolean;
  isPaused: boolean;
  elapsedTime: number;
  totalPausedTime: number;
  status: 'available' | 'busy' | 'on_break';
  currentEntry: TimeEntry | null;
}

@Injectable({
  providedIn: 'root'
})
export class TimeTrackingWorkflowService {
  private timeEntryService = inject(TimeEntryService);
  private userService = inject(UserService);
  private workOrderService = inject(WorkOrderService);

  // State management
  private workflowStates = new Map<string, BehaviorSubject<TimeTrackingState>>();
  private backgroundTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Start background timer for all active workflows
    this.startBackgroundTimer();
  }

  /**
   * Start the time tracking workflow for a technician and work order
   */
  async startJob(workOrderId: string, technicianId: string): Promise<TimeTrackingState> {
    try {
      console.log('🔧 TimeTrackingWorkflow: Starting job for technician', technicianId, 'on work order', workOrderId);

      // Validate work order exists and is assigned to technician
      const workOrder = await this.workOrderService.getWorkOrder(workOrderId).toPromise();
      if (!workOrder) {
        throw new Error('Work order not found');
      }

      if (workOrder.assignedTo !== technicianId) {
        throw new Error('Work order is not assigned to this technician');
      }

      // Start time entry
      const timeEntry = await this.timeEntryService.startTimeEntry(workOrderId, technicianId);

      // Update technician status to busy
      await this.updateTechnicianStatus(technicianId, false, 'Working on job');

      // Create workflow state
      const state: TimeTrackingState = {
        technicianId,
        workOrderId,
        isActive: true,
        isPaused: false,
        elapsedTime: 0,
        totalPausedTime: 0,
        status: 'busy',
        currentEntry: timeEntry
      };

      const stateSubject = new BehaviorSubject<TimeTrackingState>(state);
      this.workflowStates.set(technicianId, stateSubject);

      console.log('🔧 TimeTrackingWorkflow: Job started successfully');
      return state;
    } catch (error) {
      console.error('Error starting job:', error);
      throw error;
    }
  }

  /**
   * Pause the current job (technician takes break)
   */
  async pauseJob(technicianId: string, reason?: string): Promise<TimeTrackingState> {
    try {
      console.log('🔧 TimeTrackingWorkflow: Pausing job for technician', technicianId);

      const stateSubject = this.workflowStates.get(technicianId);
      if (!stateSubject) {
        throw new Error('No active workflow found for technician');
      }

      const currentState = stateSubject.value;
      if (!currentState.isActive || currentState.isPaused) {
        throw new Error('Job is not active or already paused');
      }

      // Pause time entry
      await this.timeEntryService.pauseTimeEntry(technicianId, reason);

      // Update technician status to available (on break)
      await this.updateTechnicianStatus(technicianId, true, reason || 'On break');

      // Update state
      const updatedState: TimeTrackingState = {
        ...currentState,
        isPaused: true,
        status: 'on_break'
      };

      stateSubject.next(updatedState);

      console.log('🔧 TimeTrackingWorkflow: Job paused successfully');
      return updatedState;
    } catch (error) {
      console.error('Error pausing job:', error);
      throw error;
    }
  }

  /**
   * Resume the paused job
   */
  async resumeJob(technicianId: string): Promise<TimeTrackingState> {
    try {
      console.log('🔧 TimeTrackingWorkflow: Resuming job for technician', technicianId);

      const stateSubject = this.workflowStates.get(technicianId);
      if (!stateSubject) {
        throw new Error('No active workflow found for technician');
      }

      const currentState = stateSubject.value;
      if (!currentState.isActive || !currentState.isPaused) {
        throw new Error('Job is not active or not paused');
      }

      // Resume time entry
      await this.timeEntryService.resumeTimeEntry(technicianId);

      // Update technician status back to busy
      await this.updateTechnicianStatus(technicianId, false, 'Working on job');

      // Update state
      const updatedState: TimeTrackingState = {
        ...currentState,
        isPaused: false,
        status: 'busy'
      };

      stateSubject.next(updatedState);

      console.log('🔧 TimeTrackingWorkflow: Job resumed successfully');
      return updatedState;
    } catch (error) {
      console.error('Error resuming job:', error);
      throw error;
    }
  }

  /**
   * Complete the job and stop time tracking
   */
  async completeJob(technicianId: string): Promise<TimeEntry> {
    try {
      console.log('🔧 TimeTrackingWorkflow: Completing job for technician', technicianId);

      const stateSubject = this.workflowStates.get(technicianId);
      if (!stateSubject) {
        throw new Error('No active workflow found for technician');
      }

      const currentState = stateSubject.value;
      if (!currentState.isActive) {
        throw new Error('No active job to complete');
      }

      // Stop time entry
      const completedEntry = await this.timeEntryService.stopTimeEntry(technicianId);
      if (!completedEntry) {
        throw new Error('Failed to stop time entry');
      }

      // Update work order status to completed if applicable
      try {
        const workOrder = await this.workOrderService.getWorkOrder(currentState.workOrderId).toPromise();
        if (workOrder && workOrder.status === 'in_progress') {
          // Update work order status to ready_for_pickup (completed status)
          const updatedWorkOrder = { ...workOrder, status: 'ready_for_pickup' as const };
          await this.workOrderService.updateWorkOrder(updatedWorkOrder).toPromise();
          console.log('🔧 TimeTrackingWorkflow: Work order status updated to completed');
        }
      } catch (error) {
        console.warn('Failed to update work order status:', error);
        // Don't fail the entire operation for this
      }

      // Update technician status to available
      await this.updateTechnicianStatus(technicianId, true, 'Job completed');

      // Clean up workflow state
      this.workflowStates.delete(technicianId);

      console.log('🔧 TimeTrackingWorkflow: Job completed successfully');
      return completedEntry;
    } catch (error) {
      console.error('Error completing job:', error);
      throw error;
    }
  }

  /**
   * Get current workflow state for a technician
   */
  getWorkflowState(technicianId: string): Observable<TimeTrackingState | null> {
    const stateSubject = this.workflowStates.get(technicianId);
    if (!stateSubject) {
      return from(Promise.resolve(null));
    }
    return stateSubject.asObservable();
  }

  /**
   * Check if technician has an active workflow
   */
  hasActiveWorkflow(technicianId: string): boolean {
    return this.workflowStates.has(technicianId);
  }

  /**
   * Generate time report for a technician within date range
   */
  async generateTimeReport(technicianId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const timeEntries = await this.timeEntryService.getTimeEntriesForTechnician(technicianId, startDate, endDate);

      const report = {
        technicianId,
        period: { startDate, endDate },
        totalEntries: timeEntries.length,
        totalMinutes: timeEntries.reduce((sum, entry) => sum + (entry.minutes || 0), 0),
        totalPausedMinutes: timeEntries.reduce((sum, entry) => {
          if (!entry.pauses) return sum;
          let pausedTime = 0;
          const endTime = entry.endAt ? entry.endAt.toDate() : new Date();
          for (const pause of entry.pauses) {
            const pauseStart = pause.pauseAt.toDate();
            const pauseEnd = pause.resumeAt ? pause.resumeAt.toDate() : endTime;
            pausedTime += Math.floor((pauseEnd.getTime() - pauseStart.getTime()) / (1000 * 60));
          }
          return sum + pausedTime;
        }, 0),
        entries: timeEntries
      };

      return report;
    } catch (error) {
      console.error('Error generating time report:', error);
      throw error;
    }
  }

  /**
   * Private method to update technician availability status
   */
  private async updateTechnicianStatus(technicianId: string, isAvailable: boolean, reason?: string): Promise<void> {
    try {
      await this.userService.updateMyAvailability(isAvailable, reason);
    } catch (error) {
      console.error('Error updating technician status:', error);
      // Don't throw here as it's not critical to the workflow
    }
  }

  /**
   * Background timer to update elapsed times
   */
  private startBackgroundTimer(): void {
    this.backgroundTimer = setInterval(() => {
      this.workflowStates.forEach((stateSubject, technicianId) => {
        const currentState = stateSubject.value;
        if (currentState.isActive) {
          const updatedState: TimeTrackingState = {
            ...currentState,
            elapsedTime: this.timeEntryService.getElapsedTime(),
            totalPausedTime: this.timeEntryService.getTotalPausedTime()
          };
          stateSubject.next(updatedState);
        }
      });
    }, 30000); // Update every 30 seconds
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.backgroundTimer) {
      clearInterval(this.backgroundTimer);
    }
  }
}