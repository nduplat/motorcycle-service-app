import { TestBed } from '@angular/core/testing';
import { QrValidationService, QrValidationResult, QueuePositionUpdate } from './qr-validation.service';
import { QueueService } from './queue.service';
import { TimeEntryService } from './time-entry.service';
import { EventBusService } from './event-bus.service';
import { QueueEntry, Timestamp } from '../models';

describe('QrValidationService', () => {
  let service: QrValidationService;
  let queueServiceSpy: any;
  let timeEntryServiceSpy: any;
  let eventBusSpy: any;

  beforeEach(() => {
    const queueSpy = jasmine.createSpyObj('QueueService', ['getQueueEntry', 'updateQueueEntry']);
    const timeSpy = jasmine.createSpyObj('TimeEntryService', ['startTimeEntry']);
    const eventSpy = jasmine.createSpyObj('EventBusService', ['emit']);

    TestBed.configureTestingModule({
      providers: [
        QrValidationService,
        { provide: QueueService, useValue: queueSpy },
        { provide: TimeEntryService, useValue: timeSpy },
        { provide: EventBusService, useValue: eventSpy }
      ]
    });

    service = TestBed.inject(QrValidationService);
    queueServiceSpy = TestBed.inject(QueueService);
    timeEntryServiceSpy = TestBed.inject(TimeEntryService);
    eventBusSpy = TestBed.inject(EventBusService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('validateQueueEntryQr', () => {
    it('should return error for invalid QR format', async () => {
      const invalidQr = 'invalid json';

      const result = await service.validateQueueEntryQr(invalidQr);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown validation error');
    });

    it('should return error for non-queue-entry QR type', async () => {
      const productQr = JSON.stringify({ type: 'product', id: '123' });

      const result = await service.validateQueueEntryQr(productQr);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid QR type: expected queue-entry');
    });

    it('should return error when queue entry not found', async () => {
      const queueQr = JSON.stringify({ type: 'queue-entry', id: 'nonexistent' });
      queueServiceSpy.getQueueEntry.and.returnValue(of(null));

      const result = await service.validateQueueEntryQr(queueQr);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Queue entry not found');
    });

    it('should return error for invalid entry status', async () => {
      const queueQr = JSON.stringify({ type: 'queue-entry', id: '123' });
      const invalidEntry: QueueEntry = {
        id: '123',
        customerId: 'customer1',
        serviceType: 'appointment',
        status: 'waiting', // Should be 'called'
        position: 1,
        joinedAt: {} as Timestamp,
        verificationCode: '1234',
        expiresAt: new Date(Date.now() + 10000) as any,
        createdAt: {} as Timestamp,
        updatedAt: {} as Timestamp
      };

      queueServiceSpy.getQueueEntry.and.returnValue(of(invalidEntry));

      const result = await service.validateQueueEntryQr(queueQr);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid entry status');
    });

    it('should return error for expired verification code', async () => {
      const queueQr = JSON.stringify({ type: 'queue-entry', id: '123' });
      const expiredEntry: QueueEntry = {
        id: '123',
        customerId: 'customer1',
        serviceType: 'appointment',
        status: 'called',
        position: 1,
        joinedAt: {} as Timestamp,
        verificationCode: '1234',
        expiresAt: new Date(Date.now() - 10000) as any, // Expired
        createdAt: {} as Timestamp,
        updatedAt: {} as Timestamp
      };

      queueServiceSpy.getQueueEntry.and.returnValue(of(expiredEntry));

      const result = await service.validateQueueEntryQr(queueQr);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Verification code has expired');
    });

    it('should successfully validate and start timer for valid queue entry', async () => {
      const queueQr = JSON.stringify({ type: 'queue-entry', id: '123' });
      const validEntry: QueueEntry = {
        id: '123',
        customerId: 'customer1',
        serviceType: 'appointment',
        status: 'called',
        position: 1,
        joinedAt: {} as Timestamp,
        verificationCode: '1234',
        expiresAt: new Date(Date.now() + 10000) as any,
        assignedTo: 'tech1',
        workOrderId: 'wo123',
        createdAt: {} as Timestamp,
        updatedAt: {} as Timestamp
      };

      const updatedEntry = { ...validEntry, status: 'in_service' as const };
      const timeEntry = { id: 'te123', workOrderId: 'wo123', technicianId: 'tech1', startAt: new Date() };

      queueServiceSpy.getQueueEntry.and.returnValue(of(validEntry));
      timeEntryServiceSpy.startTimeEntry.and.returnValue(Promise.resolve(timeEntry));
      queueServiceSpy.updateQueueEntry.and.returnValue(Promise.resolve(updatedEntry));

      const result = await service.validateQueueEntryQr(queueQr);

      expect(result.success).toBe(true);
      expect(result.queueEntry).toEqual(updatedEntry);
      expect(result.timerStarted).toBe(true);
      expect(timeEntryServiceSpy.startTimeEntry).toHaveBeenCalledWith('wo123', 'tech1');
      expect(queueServiceSpy.updateQueueEntry).toHaveBeenCalled();
      expect(eventBusSpy.emit).toHaveBeenCalledWith({
        type: 'queue.qr_validated',
        entity: updatedEntry,
        timerStarted: true
      });
    });
  });

  describe('canValidateEntry', () => {
    it('should return false for non-called status', () => {
      const entry: QueueEntry = {
        id: '123',
        customerId: 'customer1',
        serviceType: 'appointment',
        status: 'waiting',
        position: 1,
        joinedAt: {} as Timestamp,
        verificationCode: '1234',
        expiresAt: new Date(Date.now() + 10000) as any,
        createdAt: {} as Timestamp,
        updatedAt: {} as Timestamp
      };

      const result = service.canValidateEntry(entry);

      expect(result.canValidate).toBe(false);
      expect(result.reason).toContain('waiting');
    });

    it('should return false for expired code', () => {
      const entry: QueueEntry = {
        id: '123',
        customerId: 'customer1',
        serviceType: 'appointment',
        status: 'called',
        position: 1,
        joinedAt: {} as Timestamp,
        verificationCode: '1234',
        expiresAt: new Date(Date.now() - 10000) as any,
        createdAt: {} as Timestamp,
        updatedAt: {} as Timestamp
      };

      const result = service.canValidateEntry(entry);

      expect(result.canValidate).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('should return true for valid entry', () => {
      const entry: QueueEntry = {
        id: '123',
        customerId: 'customer1',
        serviceType: 'appointment',
        status: 'called',
        position: 1,
        joinedAt: {} as Timestamp,
        verificationCode: '1234',
        expiresAt: new Date(Date.now() + 10000) as any,
        createdAt: {} as Timestamp,
        updatedAt: {} as Timestamp
      };

      const result = service.canValidateEntry(entry);

      expect(result.canValidate).toBe(true);
    });
  });

  describe('getValidationTimeoutMs', () => {
    it('should return the validation timeout duration', () => {
      const timeout = service.getValidationTimeoutMs();
      expect(timeout).toBe(15 * 60 * 1000); // 15 minutes in milliseconds
    });
  });
});

// Helper function for creating observables
function of<T>(value: T) {
  return {
    toPromise: () => Promise.resolve(value)
  };
}