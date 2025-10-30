import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { UnifiedQueueService } from './unified-queue.service';
import { QueueEntry, QueueStatus, QueueJoinData } from '../models';
import { AuthService } from './auth.service';
import { WorkOrderService } from './work-order.service';
import { EventBusService } from './event-bus.service';
import { QrCodeService } from './qr-code.service';
import { CacheService } from './cache.service';
import { MotorcycleService } from './motorcycle.service';

describe('UnifiedQueueService', () => {
  let service: UnifiedQueueService;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockWorkOrderService: jasmine.SpyObj<WorkOrderService>;
  let mockEventBus: jasmine.SpyObj<EventBusService>;
  let mockQrCodeService: jasmine.SpyObj<QrCodeService>;
  let mockCacheService: jasmine.SpyObj<CacheService>;
  let mockMotorcycleService: jasmine.SpyObj<MotorcycleService>;

  beforeEach(() => {
    const authSpy = jasmine.createSpyObj('AuthService', ['currentUser']);
    const workOrderSpy = jasmine.createSpyObj('WorkOrderService', ['createWorkOrderFromQueueEntry']);
    const eventBusSpy = jasmine.createSpyObj('EventBusService', ['emit']);
    const qrCodeSpy = jasmine.createSpyObj('QrCodeService', ['generateQrCodeDataUrl']);
    const cacheSpy = jasmine.createSpyObj('CacheService', ['get', 'set', 'invalidateByEntity']);
    const motorcycleSpy = jasmine.createSpyObj('MotorcycleService', ['getMotorcycles']);

    TestBed.configureTestingModule({
      providers: [
        UnifiedQueueService,
        { provide: AuthService, useValue: authSpy },
        { provide: WorkOrderService, useValue: workOrderSpy },
        { provide: EventBusService, useValue: eventBusSpy },
        { provide: QrCodeService, useValue: qrCodeSpy },
        { provide: CacheService, useValue: cacheSpy },
        { provide: MotorcycleService, useValue: motorcycleSpy }
      ]
    });

    service = TestBed.inject(UnifiedQueueService);
    mockAuthService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    mockWorkOrderService = TestBed.inject(WorkOrderService) as jasmine.SpyObj<WorkOrderService>;
    mockEventBus = TestBed.inject(EventBusService) as jasmine.SpyObj<EventBusService>;
    mockQrCodeService = TestBed.inject(QrCodeService) as jasmine.SpyObj<QrCodeService>;
    mockCacheService = TestBed.inject(CacheService) as jasmine.SpyObj<CacheService>;
    mockMotorcycleService = TestBed.inject(MotorcycleService) as jasmine.SpyObj<MotorcycleService>;
  });

  describe('addEntry', () => {
    it('should create queue entry with valid data', async () => {
      const queueData: QueueJoinData = {
        customerId: 'customer123',
        serviceType: 'appointment',
        motorcycleId: 'motorcycle123',
        plate: 'ABC123',
        mileageKm: 50000,
        notes: 'Test service'
      };

      mockQrCodeService.generateQrCodeDataUrl.and.returnValue('data:image/png;base64,test');
      mockCacheService.set.and.returnValue(Promise.resolve());

      const entryId = await service.addEntry(queueData);

      expect(entryId).toBeDefined();
      expect(typeof entryId).toBe('string');
      expect(mockQrCodeService.generateQrCodeDataUrl).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        jasmine.objectContaining({
          type: 'queue.entry_added',
          entity: jasmine.objectContaining({
            customerId: 'customer123',
            serviceType: 'appointment',
            status: 'waiting'
          })
        })
      );
    });

    it('should reject invalid queue data', async () => {
      const invalidData = {
        customerId: '',
        serviceType: 'invalid' as any
      };

      await expectAsync(service.addEntry(invalidData as any)).toBeRejected();
    });

    it('should handle cache operations', async () => {
      const queueData: QueueJoinData = {
        customerId: 'customer123',
        serviceType: 'appointment'
      };

      mockQrCodeService.generateQrCodeDataUrl.and.returnValue('data:image/png;base64,test');
      mockCacheService.set.and.returnValue(Promise.resolve());

      await service.addEntry(queueData);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        jasmine.stringContaining('unified-queue-entries'),
        jasmine.any(Object),
        jasmine.any(Number),
        'queue'
      );
    });
  });

  describe('getEntryById', () => {
    it('should return cached entry if available', async () => {
      const mockEntry: QueueEntry = {
        id: 'entry123',
        customerId: 'customer123',
        serviceType: 'appointment',
        status: 'waiting',
        position: 1,
        joinedAt: new Date(),
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockCacheService.get.and.returnValue(Promise.resolve(mockEntry));

      const result = await service.getEntryById('entry123');

      expect(result).toEqual(mockEntry);
      expect(mockCacheService.get).toHaveBeenCalledWith('unified-queue-entries-entry123');
    });

    it('should return null for non-existent entry', async () => {
      mockCacheService.get.and.returnValue(Promise.resolve(null));
      // Mock Firestore to return no document

      const result = await service.getEntryById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('callNext', () => {
    it('should call next waiting customer', async () => {
      const mockEntry: QueueEntry = {
        id: 'entry123',
        customerId: 'customer123',
        serviceType: 'appointment',
        status: 'waiting',
        position: 1,
        joinedAt: new Date(),
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockWorkOrder = { id: 'wo123' };
      mockWorkOrderService.createWorkOrderFromQueueEntry.and.returnValue(Promise.resolve(mockWorkOrder));

      // Mock the transaction behavior
      spyOn(service as any, 'executeWithRetry').and.callFake(async (fn: any) => {
        return await fn();
      });

      const result = await service.callNext('technician123');

      expect(mockWorkOrderService.createWorkOrderFromQueueEntry).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        jasmine.objectContaining({
          type: 'queue.called',
          technicianName: 'Técnico asignado'
        })
      );
    });

    it('should return null when no waiting customers', async () => {
      spyOn(service as any, 'executeWithRetry').and.callFake(async (fn: any) => {
        return await fn();
      });

      const result = await service.callNext('technician123');

      expect(result).toBeNull();
    });
  });

  describe('updateEntryStatus', () => {
    it('should update entry status with technician assignment', async () => {
      mockCacheService.invalidateByEntity.and.returnValue(Promise.resolve());

      await service.updateEntryStatus('entry123', 'called', 'technician123');

      expect(mockCacheService.invalidateByEntity).toHaveBeenCalledWith('queue', 'entry123');
    });

    it('should handle status updates without technician', async () => {
      mockCacheService.invalidateByEntity.and.returnValue(Promise.resolve());

      await service.updateEntryStatus('entry123', 'served');

      expect(mockCacheService.invalidateByEntity).toHaveBeenCalledWith('queue', 'entry123');
    });
  });

  describe('getActiveEntries', () => {
    it('should return observable of active entries', (done) => {
      const mockEntries: QueueEntry[] = [
        {
          id: 'entry1',
          customerId: 'customer1',
          serviceType: 'appointment',
          status: 'waiting',
          position: 1,
          joinedAt: new Date(),
          estimatedWaitTime: 30,
          verificationCode: '1234',
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      // Mock the signal to return entries
      spyOn(service as any, 'queueEntries').and.returnValue(signal(mockEntries));

      service.getActiveEntries().subscribe(entries => {
        expect(entries).toEqual(mockEntries);
        done();
      });
    });
  });

  describe('error handling', () => {
    it('should handle cache failures gracefully', async () => {
      mockCacheService.get.and.rejectWith(new Error('Cache failure'));

      const result = await service.getEntryById('entry123');

      expect(result).toBeNull();
    });

    it('should retry operations on failure', async () => {
      let callCount = 0;
      spyOn(service as any, 'executeWithRetry').and.callFake(async (fn: any) => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return await fn();
      });

      const queueData: QueueJoinData = {
        customerId: 'customer123',
        serviceType: 'appointment'
      };

      mockQrCodeService.generateQrCodeDataUrl.and.returnValue('data:image/png;base64,test');
      mockCacheService.set.and.returnValue(Promise.resolve());

      await service.addEntry(queueData);

      expect(callCount).toBe(3);
    });
  });

  describe('real-time updates', () => {
    it('should enable real-time updates when requested', () => {
      service.enableRealtimeUpdates();
      expect((service as any).realtimeSubscription).toBeDefined();
    });

    it('should disable real-time updates', () => {
      service.enableRealtimeUpdates();
      service.disableRealtimeUpdates();
      expect((service as any).realtimeSubscription).toBeNull();
    });
  });

  describe('validation', () => {
    it('should validate queue entry data', () => {
      const validData: QueueJoinData = {
        customerId: 'customer123',
        serviceType: 'appointment',
        motorcycleId: 'motorcycle123',
        plate: 'ABC123',
        mileageKm: 50000
      };

      expect(() => (service as any).validateQueueEntryData(validData)).not.toThrow();
    });

    it('should reject invalid service types', () => {
      const invalidData = {
        customerId: 'customer123',
        serviceType: 'invalid' as any
      };

      expect(() => (service as any).validateQueueEntryData(invalidData)).toThrow();
    });

    it('should reject empty customer ID', () => {
      const invalidData = {
        customerId: '',
        serviceType: 'appointment' as const
      };

      expect(() => (service as any).validateQueueEntryData(invalidData)).toThrow();
    });
  });

  describe('utility methods', () => {
    it('should calculate estimated wait time', () => {
      const waitTime = (service as any).calculateEstimatedWaitTime(3);
      expect(waitTime).toBe(45); // 3 * 15
    });

    it('should generate verification code', () => {
      const code = (service as any).generateVerificationCode();
      expect(code).toMatch(/^\d{4}$/);
      expect(parseInt(code)).toBeGreaterThanOrEqual(1000);
      expect(parseInt(code)).toBeLessThanOrEqual(9999);
    });
  });
});