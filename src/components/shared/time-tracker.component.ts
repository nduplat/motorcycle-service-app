import { Component, inject, signal, computed, effect, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeTrackingWorkflowService, TimeTrackingState } from '../../services/time-tracking-workflow.service';
import { TimeEntryService } from '../../services/time-entry.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { AutoPauseService } from '../../services/auto-pause.service';
import { ToastService } from '../../services/toast.service';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-time-tracker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="time-tracker-widget" *ngIf="currentUser()?.role === 'technician'">
      <div class="timer-header">
        <h3>Time Tracker</h3>
        <div class="status-indicator" [class]="statusClass()">
          <span class="status-dot"></span>
          {{ statusText() }}
        </div>
      </div>

      <div class="timer-display" *ngIf="currentState(); else noActiveTimer">
        <div class="time-display">
          <div class="main-time">{{ formatTime(elapsedTime()) }}</div>
          <div class="sub-info" *ngIf="totalPausedTime() > 0">
            Paused: {{ formatTime(totalPausedTime()) }}
          </div>
        </div>

        <div class="timer-controls">
          <button
            class="btn btn-primary"
            [disabled]="isStarting()"
            (click)="startJob()"
            *ngIf="!currentState()?.isActive">
            Start Job
          </button>

          <button
            class="btn btn-warning"
            [disabled]="isPausing()"
            (click)="pauseJob()"
            *ngIf="currentState()?.isActive && !currentState()?.isPaused">
            Take Break
          </button>

          <button
            class="btn btn-success"
            [disabled]="isResuming()"
            (click)="resumeJob()"
            *ngIf="currentState()?.isActive && currentState()?.isPaused">
            Resume Work
          </button>

          <button
            class="btn btn-danger"
            [disabled]="isCompleting()"
            (click)="completeJob()"
            *ngIf="currentState()?.isActive">
            Complete Job
          </button>
        </div>

        <div class="work-order-info" *ngIf="currentState()?.workOrderId">
          <small>Work Order: {{ currentState()?.workOrderId }}</small>
        </div>
      </div>

      <ng-template #noActiveTimer>
        <div class="no-timer-state">
          <p>No active timer</p>
          <small>Start a job to begin tracking time</small>
        </div>
      </ng-template>

      <div class="auto-pause-notice" *ngIf="isAutoPaused()">
        <div class="alert alert-warning">
          <small>⚠️ Timer was automatically paused due to inactivity</small>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .time-tracker-widget {
      background: white;
      border-radius: 8px;
      padding: 1rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 1rem;
    }

    .timer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .timer-header h3 {
      margin: 0;
      font-size: 1.1rem;
      color: #333;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .status-indicator.available .status-dot {
      background: #28a745;
    }

    .status-indicator.busy .status-dot {
      background: #dc3545;
    }

    .status-indicator.on_break .status-dot {
      background: #ffc107;
    }

    .time-display {
      text-align: center;
      margin-bottom: 1rem;
    }

    .main-time {
      font-size: 2rem;
      font-weight: bold;
      color: #333;
      font-family: monospace;
    }

    .sub-info {
      font-size: 0.9rem;
      color: #666;
      margin-top: 0.5rem;
    }

    .timer-controls {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #007bff;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #0056b3;
    }

    .btn-warning {
      background: #ffc107;
      color: #212529;
    }

    .btn-warning:hover:not(:disabled) {
      background: #e0a800;
    }

    .btn-success {
      background: #28a745;
      color: white;
    }

    .btn-success:hover:not(:disabled) {
      background: #1e7e34;
    }

    .btn-danger {
      background: #dc3545;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #bd2130;
    }

    .work-order-info {
      text-align: center;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
    }

    .work-order-info small {
      color: #666;
    }

    .no-timer-state {
      text-align: center;
      padding: 2rem 1rem;
      color: #666;
    }

    .no-timer-state p {
      margin: 0 0 0.5rem 0;
      font-size: 1.1rem;
    }

    .auto-pause-notice {
      margin-top: 1rem;
    }

    .alert {
      padding: 0.75rem;
      border-radius: 4px;
      font-size: 0.9rem;
    }

    .alert-warning {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
    }
  `]
})
export class TimeTrackerComponent implements OnInit, OnDestroy {
  private timeTrackingService = inject(TimeTrackingWorkflowService);
  private timeEntryService = inject(TimeEntryService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private autoPauseService = inject(AutoPauseService);
  private toastService = inject(ToastService);

  // State signals
  currentUser = this.authService.currentUser;
  currentState = signal<TimeTrackingState | null>(null);
  elapsedTime = signal<number>(0);
  totalPausedTime = signal<number>(0);
  isAutoPaused = signal<boolean>(false);

  // Loading states
  isStarting = signal<boolean>(false);
  isPausing = signal<boolean>(false);
  isResuming = signal<boolean>(false);
  isCompleting = signal<boolean>(false);

  // Computed signals
  statusClass = computed(() => {
    const state = this.currentState();
    if (!state) return 'available';
    if (state.isPaused) return 'on_break';
    if (state.isActive) return 'busy';
    return 'available';
  });

  statusText = computed(() => {
    const state = this.currentState();
    if (!state) return 'Available';
    if (state.isPaused) return 'On Break';
    if (state.isActive) return 'Working';
    return 'Available';
  });

  private subscriptions: Subscription[] = [];

  ngOnInit() {
    // Subscribe to workflow state changes
    const stateSubscription = this.timeTrackingService
      .getWorkflowState(this.currentUser()?.id || '')
      .subscribe(state => {
        this.currentState.set(state);
        if (state) {
          this.elapsedTime.set(this.timeEntryService.getElapsedTime());
          this.totalPausedTime.set(this.timeEntryService.getTotalPausedTime());
        } else {
          this.elapsedTime.set(0);
          this.totalPausedTime.set(0);
        }
      });

    this.subscriptions.push(stateSubscription);

    // Set up activity recording for auto-pause
    this.setupActivityRecording();

    // Load initial state
    this.loadCurrentState();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Start a new job
   */
  async startJob(): Promise<void> {
    // In a real implementation, this would show a work order selection dialog
    // For now, we'll use a placeholder work order ID
    const workOrderId = prompt('Enter Work Order ID:');
    if (!workOrderId) return;

    this.isStarting.set(true);
    try {
      const state = await this.timeTrackingService.startJob(workOrderId, this.currentUser()?.id || '');
      this.toastService.success('Job started successfully');
    } catch (error: any) {
      this.toastService.error(error.message || 'Failed to start job');
    } finally {
      this.isStarting.set(false);
    }
  }

  /**
   * Pause current job (take break)
   */
  async pauseJob(): Promise<void> {
    this.isPausing.set(true);
    try {
      const reason = prompt('Reason for break (optional):') || undefined;
      await this.timeTrackingService.pauseJob(this.currentUser()?.id || '', reason);
      this.toastService.success('Job paused for break');
    } catch (error: any) {
      this.toastService.error(error.message || 'Failed to pause job');
    } finally {
      this.isPausing.set(false);
    }
  }

  /**
   * Resume paused job
   */
  async resumeJob(): Promise<void> {
    this.isResuming.set(true);
    try {
      await this.timeTrackingService.resumeJob(this.currentUser()?.id || '');
      this.toastService.success('Job resumed');
    } catch (error: any) {
      this.toastService.error(error.message || 'Failed to resume job');
    } finally {
      this.isResuming.set(false);
    }
  }

  /**
   * Complete current job
   */
  async completeJob(): Promise<void> {
    if (!confirm('Are you sure you want to complete this job?')) return;

    this.isCompleting.set(true);
    try {
      await this.timeTrackingService.completeJob(this.currentUser()?.id || '');
      this.toastService.success('Job completed successfully');
    } catch (error: any) {
      this.toastService.error(error.message || 'Failed to complete job');
    } finally {
      this.isCompleting.set(false);
    }
  }

  /**
   * Load current workflow state
   */
  private async loadCurrentState(): Promise<void> {
    try {
      const state = await this.timeTrackingService.getWorkflowState(this.currentUser()?.id || '').toPromise();
      this.currentState.set(state || null);
    } catch (error) {
      console.error('Error loading current state:', error);
    }
  }

  /**
   * Set up activity recording for auto-pause functionality
   */
  private setupActivityRecording(): void {
    // Record activity on user interactions
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, () => {
        this.autoPauseService.recordActivity();
      }, { passive: true });
    });
  }

  /**
   * Format time in HH:MM:SS
   */
  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }
}