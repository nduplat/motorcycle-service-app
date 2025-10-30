/**
 * QR Validation Service - Queue Entry Processing
 *
 * OVERVIEW:
 * Handles QR code validation for queue entries, initiates service timers,
 * and manages real-time queue position updates.
 *
 * KEY FEATURES:
 * - Validate QR codes from queue entries
 * - Start service timers upon successful validation
 * - Update queue entry status to 'in_service'
 * - Provide real-time queue position updates
 * - Handle validation timeouts and errors
 *
 * USAGE:
 * - Call validateQueueEntryQr() when QR is scanned
 * - Use getQueuePositionUpdates() for real-time position tracking
 * - Integrates with QueueService and TimeEntryService
 *
 * TESTING:
 * 1. Test QR validation with valid/invalid codes
 * 2. Verify timer starts on successful validation
 * 3. Test queue position updates
 * 4. Test timeout handling
 * 5. Verify status transitions
 */

import { Injectable, signal, inject } from '@angular/core';
import { QueueEntry, Timestamp } from '../models';
import { Observable, BehaviorSubject, from, timer } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { QueueService } from './queue.service';
import { TimeEntryService } from './time-entry.service';
import { EventBusService } from './event-bus.service';

export interface QrValidationResult {
  success: boolean;
  queueEntry?: QueueEntry;
  error?: string;
  timerStarted?: boolean;
}

export interface QueuePositionUpdate {
  entryId: string;
  position: number;
  estimatedWaitTime: number;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class QrValidationService {
  private queueService = inject(QueueService);
  private timeEntryService = inject(TimeEntryService);
  private eventBus = inject(EventBusService);

  // Real-time queue position updates
  private positionUpdates$ = new BehaviorSubject<QueuePositionUpdate[]>([]);

  // Validation timeout (15 minutes as per queue entry expiration)
  private readonly VALIDATION_TIMEOUT_MS = 15 * 60 * 1000;

  constructor() {
    // Start periodic position updates
    this.startPositionUpdates();
  }

  /**
   * Validate QR code for queue entry and start service timer
   */
  async validateQueueEntryQr(qrData: string): Promise<QrValidationResult> {
    try {
      console.log('🔍 [DEBUG] QrValidationService: Validating QR data:', qrData);

      // Parse QR data
      const parsedData = JSON.parse(qrData);
      if (!parsedData.type || !parsedData.id) {
        return {
          success: false,
          error: 'Invalid QR format: missing type or id'
        };
      }

      // Handle entrance QR codes (redirect to queue join)
      if (parsedData.type === 'entrance') {
        console.log('🎯 [DEBUG] QrValidationService: Entrance QR detected, redirecting to queue join');
        // This should be handled by the scanner component, not here
        return {
          success: false,
          error: 'Entrance QR should be handled by navigation, not validation'
        };
      }

      if (parsedData.type !== 'queue-entry') {
        return {
          success: false,
          error: 'Invalid QR type: expected queue-entry'
        };
      }

      const entryId = parsedData.id;

      // Get queue entry
      const queueEntry = await this.getQueueEntryById(entryId);
      if (!queueEntry) {
        return {
          success: false,
          error: 'Queue entry not found'
        };
      }

      console.log('🔍 [DEBUG] QrValidationService: Found queue entry:', {
        id: queueEntry.id,
        status: queueEntry.status,
        verificationCode: queueEntry.verificationCode
      });

      // Validate entry status
      if (queueEntry.status !== 'called') {
        return {
          success: false,
          error: `Invalid entry status: ${queueEntry.status}. Entry must be in 'called' status.`
        };
      }

      // Check if verification code is still valid
      if (!this.isVerificationCodeValid(queueEntry)) {
        return {
          success: false,
          error: 'Verification code has expired'
        };
      }

      // Start service timer
      const timerStarted = await this.startServiceTimer(queueEntry);
      if (!timerStarted) {
        return {
          success: false,
          error: 'Failed to start service timer'
        };
      }

      // Update queue entry status to 'in_service'
      const updatedEntry = await this.updateEntryToInService(queueEntry);

      // Emit validation success event
      this.eventBus.emit({
        type: 'queue.qr_validated',
        entity: updatedEntry,
        timerStarted: true
      });

      console.log('✅ [DEBUG] QrValidationService: QR validation successful for entry:', entryId);

      return {
        success: true,
        queueEntry: updatedEntry,
        timerStarted: true
      };

    } catch (error) {
      console.error('❌ [DEBUG] QrValidationService: QR validation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Get queue entry by ID
   */
  private async getQueueEntryById(entryId: string): Promise<QueueEntry | null> {
    try {
      const entry = await this.queueService.getQueueEntry(entryId).toPromise();
      return entry || null;
    } catch (error) {
      console.error('Error getting queue entry:', error);
      return null;
    }
  }

  /**
   * Check if verification code is still valid
   */
  private isVerificationCodeValid(entry: QueueEntry): boolean {
    if (!entry.expiresAt) return false;

    const now = new Date();
    const expiresAt = (entry.expiresAt as Timestamp).toDate();
    return now <= expiresAt;
  }

  /**
   * Start service timer for the queue entry
   */
  private async startServiceTimer(entry: QueueEntry): Promise<boolean> {
    try {
      if (!entry.workOrderId) {
        console.error('No work order ID found for queue entry:', entry.id);
        return false;
      }

      // Start time entry for the technician
      const timeEntry = await this.timeEntryService.startTimeEntry(
        entry.workOrderId,
        entry.assignedTo!
      );

      console.log('✅ [DEBUG] QrValidationService: Service timer started:', {
        timeEntryId: timeEntry.id,
        workOrderId: entry.workOrderId,
        technicianId: entry.assignedTo
      });

      return true;
    } catch (error) {
      console.error('Error starting service timer:', error);
      return false;
    }
  }

  /**
   * Update queue entry status to 'in_service'
   */
  private async updateEntryToInService(entry: QueueEntry): Promise<QueueEntry> {
    const updatedEntry = {
      ...entry,
      status: 'in_service' as const,
      updatedAt: new Date() as any
    };

    return await this.queueService.updateQueueEntry(updatedEntry);
  }

  /**
   * Get real-time queue position updates
   */
  getQueuePositionUpdates(): Observable<QueuePositionUpdate[]> {
    return this.positionUpdates$.asObservable();
  }

  /**
   * Get current queue position for an entry
   */
  getCurrentQueuePosition(entryId: string): QueuePositionUpdate | null {
    const updates = this.positionUpdates$.value;
    return updates.find(update => update.entryId === entryId) || null;
  }

  /**
   * Start periodic position updates
   */
  private startPositionUpdates(): void {
    // Update positions every 30 seconds
    timer(0, 30000).pipe(
      switchMap(() => this.calculatePositionUpdates())
    ).subscribe(updates => {
      this.positionUpdates$.next(updates);
    });
  }

  /**
   * Calculate current positions for all waiting entries
   */
  private async calculatePositionUpdates(): Promise<QueuePositionUpdate[]> {
    try {
      const queueEntries = this.queueService.getQueueEntries()();
      const waitingEntries = queueEntries
        .filter(entry => entry.status === 'waiting')
        .sort((a, b) => a.position - b.position);

      const updates: QueuePositionUpdate[] = waitingEntries.map((entry, index) => ({
        entryId: entry.id,
        position: index + 1,
        estimatedWaitTime: entry.estimatedWaitTime || 0,
        timestamp: new Date()
      }));

      return updates;
    } catch (error) {
      console.error('Error calculating position updates:', error);
      return [];
    }
  }

  /**
   * Validate if a queue entry can be processed (for UI feedback)
   */
  canValidateEntry(entry: QueueEntry): { canValidate: boolean; reason?: string } {
    if (entry.status !== 'called') {
      return {
        canValidate: false,
        reason: `Entry status is ${entry.status}, must be 'called'`
      };
    }

    if (!this.isVerificationCodeValid(entry)) {
      return {
        canValidate: false,
        reason: 'Verification code has expired'
      };
    }

    return { canValidate: true };
  }

  /**
   * Get validation timeout duration in milliseconds
   */
  getValidationTimeoutMs(): number {
    return this.VALIDATION_TIMEOUT_MS;
  }
}