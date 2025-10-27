import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { QueueService } from './queue.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { EventBusService } from './event-bus.service';
import { QrCodeService } from './qr-code.service';
import { SchedulingService } from './scheduling.service';
import { CacheService } from './cache.service';
import { AppointmentService } from './appointment.service';
import { WorkOrderService } from './work-order.service';
import { QueueEntry, QueueStatus, QueueServiceType } from '../models';
/// <reference types="jest" />

describe('QueueService', () => {
  let service: QueueService;
  let authServiceSpy: jest.SpyInstance;
  let userServiceSpy: jest.SpyInstance;
  let eventBusSpy: jest.SpyInstance;
  let qrCodeServiceSpy: jest.SpyInstance;
  let schedulingServiceSpy: jest.SpyInstance;
  let cacheServiceSpy: jest.SpyInstance;
  let appointmentServiceSpy: jest.SpyInstance;
  let workOrderServiceSpy: jest.SpyInstance;

  beforeEach(() => {
    const authSpy = {
      currentUser: jest.fn().mockReturnValue({ id: 'user1', role: 'customer' })
    };
    const userSpy = {
      getUserById: jest.fn(),
      getUsers: jest.fn().mockReturnValue([])
    };
    const eventBusSpyObj = {
      emit: jest.fn()
    };
    const qrCodeSpy = {
      generateQrCodeDataUrl: jest.fn().mockReturnValue('data:image/png;base64,test')
    };
    const schedulingSpy = {
      autoAssignTechnician: jest.fn().mockReturnValue('tech1')
    };
    const cacheSpy = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined)
    };
    const appointmentSpy = {};
    const workOrderSpy = {
      createWorkOrderFromQueueEntry: jest.fn().mockReturnValue(of({ id: 'wo1' }))
    };

    TestBed.configureTestingModule({
      providers: [
        QueueService,
        { provide: AuthService, useValue: authSpy },
        { provide: UserService, useValue: userSpy },
        { provide: EventBusService, useValue: eventBusSpyObj },
        { provide: QrCodeService, useValue: qrCodeSpy },
        { provide: SchedulingService, useValue: schedulingSpy },
        { provide: CacheService, useValue: cacheSpy },
        { provide: AppointmentService, useValue: appointmentSpy },
        { provide: WorkOrderService, useValue: workOrderSpy }
      ]
    });

    service = TestBed.inject(QueueService);
    authServiceSpy = authSpy.currentUser;
    userServiceSpy = userSpy.getUserById;
    eventBusSpy = eventBusSpyObj.emit;
    qrCodeServiceSpy = qrCodeSpy.generateQrCodeDataUrl;
    schedulingServiceSpy = schedulingSpy.autoAssignTechnician;
    cacheServiceSpy = cacheSpy.get;
    appointmentServiceSpy = appointmentSpy as any;
    workOrderServiceSpy = workOrderSpy.createWorkOrderFromQueueEntry;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Queue Management', () => {
    it('should return queue entries', () => {
      const entries = service.getQueueEntries();
      expect(entries).toBeDefined();
    });

    it('should return queue status', () => {
      const status = service.getQueueStatus();
      expect(status).toBeDefined();
    });

    it('should add customer to queue successfully', async () => {
      const queueData = {
        customerId: 'customer1',
        serviceType: 'appointment' as QueueServiceType,
        motorcycleId: 'motorcycle1',
        plate: 'ABC123',
        mileageKm: 10000,
        notes: 'Test notes'
      };

      // Mock the private methods
      jest.spyOn(service as any, 'checkUserHasMotorcycle').mockResolvedValue(true);
      jest.spyOn(service as any, 'createMotorcycleAssignment').mockResolvedValue('assignment1');
      jest.spyOn(service as any, 'generateVerificationCode').mockReturnValue('1234');
      jest.spyOn(service as any, 'calculateEstimatedWaitTime').mockReturnValue(30);
      jest.spyOn(service as any, 'updateQueueStatus').mockResolvedValue(undefined);

      const result = await service.addToQueue(queueData);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(qrCodeServiceSpy).toHaveBeenCalled();
      expect(eventBusSpy).toHaveBeenCalledWith({
        type: 'queue.entry_added',
        entity: expect.any(Object)
      });
    });

    it('should call next customer and create work order', async () => {
      const mockEntry: QueueEntry = {
        id: 'entry1',
        customerId: 'customer1',
        serviceType: 'appointment' as QueueServiceType,
        status: 'waiting',
        position: 1,
        joinedAt: new Date(),
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock queue entries
      jest.spyOn(service as any, 'queueEntries', 'get').mockReturnValue(signal([mockEntry]));
      jest.spyOn(service as any, 'updateQueueEntry').mockResolvedValue(mockEntry);

      const result = await service.callNext('tech1');

      expect(result).toBeDefined();
      expect(result?.status).toBe('called');
      expect(result?.assignedTo).toBe('tech1');
      expect(workOrderServiceSpy).toHaveBeenCalledWith(mockEntry, 'tech1');
      expect(eventBusSpy).toHaveBeenCalledWith({
        type: 'queue.called',
        entity: expect.any(Object),
        technicianName: expect.any(String)
      });
    });

    it('should return null when no waiting entries', async () => {
      jest.spyOn(service as any, 'queueEntries', 'get').mockReturnValue(signal([]));

      const result = await service.callNext('tech1');

      expect(result).toBeNull();
    });

    it('should serve queue entry', async () => {
      const mockEntry: QueueEntry = {
        id: 'entry1',
        customerId: 'customer1',
        serviceType: 'appointment' as QueueServiceType,
        status: 'called',
        position: 1,
        joinedAt: new Date(),
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(service as any, 'queueEntries', 'get').mockReturnValue(signal([mockEntry]));
      jest.spyOn(service as any, 'updateQueueEntry').mockResolvedValue({ ...mockEntry, status: 'served' });

      const result = await service.serveEntry('entry1');

      expect(result.status).toBe('served');
    });

    it('should cancel queue entry', async () => {
      const mockEntry: QueueEntry = {
        id: 'entry1',
        customerId: 'customer1',
        serviceType: 'appointment' as QueueServiceType,
        status: 'waiting',
        position: 1,
        joinedAt: new Date(),
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(service as any, 'queueEntries', 'get').mockReturnValue(signal([mockEntry]));
      jest.spyOn(service as any, 'updateQueueEntry').mockResolvedValue({ ...mockEntry, status: 'cancelled' });

      const result = await service.cancelEntry('entry1');

      expect(result.status).toBe('cancelled');
    });

    it('should clear queue', async () => {
      const mockEntries: QueueEntry[] = [
        {
          id: 'entry1',
          customerId: 'customer1',
          serviceType: 'appointment' as QueueServiceType,
          status: 'waiting',
          position: 1,
          joinedAt: new Date(),
          estimatedWaitTime: 30,
          verificationCode: '1234',
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'entry2',
          customerId: 'customer2',
          serviceType: 'direct_work_order' as QueueServiceType,
          status: 'called',
          position: 2,
          joinedAt: new Date(),
          estimatedWaitTime: 45,
          verificationCode: '5678',
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      jest.spyOn(service as any, 'queueEntries', 'get').mockReturnValue(signal(mockEntries));
      jest.spyOn(service as any, 'updateQueueStatus').mockResolvedValue(undefined);

      await service.clearQueue();

      expect(service.getQueueEntries()()).toEqual([]);
    });
  });

  describe('Queue Status Management', () => {
    it('should toggle queue status', async () => {
      const mockStatus: QueueStatus = {
        id: 'singleton',
        isOpen: true,
        currentCount: 0,
        operatingHours: {
          monday: { open: '07:00', close: '17:30', enabled: true },
          tuesday: { open: '07:00', close: '17:30', enabled: true },
          wednesday: { open: '07:00', close: '17:30', enabled: true },
          thursday: { open: '07:00', close: '17:30', enabled: true },
          friday: { open: '07:00', close: '17:30', enabled: true },
          saturday: { open: '07:00', close: '17:30', enabled: true },
          sunday: { open: '07:00', close: '17:30', enabled: false }
        },
        lastUpdated: new Date()
      };

      jest.spyOn(service as any, 'queueStatus', 'get').mockReturnValue(signal(mockStatus));

      await service.toggleQueueStatus();

      // Should have updated to closed
      expect(service.getQueueStatus()()?.isOpen).toBe(false);
    });

    it('should update operating hours', async () => {
      const newHours = {
        monday: { open: '08:00', close: '18:00', enabled: true },
        tuesday: { open: '08:00', close: '18:00', enabled: true },
        wednesday: { open: '08:00', close: '18:00', enabled: true },
        thursday: { open: '08:00', close: '18:00', enabled: true },
        friday: { open: '08:00', close: '18:00', enabled: true },
        saturday: { open: '08:00', close: '18:00', enabled: true },
        sunday: { open: '08:00', close: '18:00', enabled: false }
      };

      await service.updateOperatingHours(newHours);

      expect(service.getOperatingHours()).toEqual(newHours);
    });
  });

  describe('Verification Code Management', () => {
    it('should validate verification code', () => {
      const mockEntry: QueueEntry = {
        id: 'entry1',
        customerId: 'customer1',
        serviceType: 'appointment' as QueueServiceType,
        status: 'waiting',
        position: 1,
        joinedAt: new Date(),
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(service as any, 'queueEntries', 'get').mockReturnValue(signal([mockEntry]));

      const isValid = service.isCodeValid('1234');

      expect(isValid).toBe(true);
    });

    it('should return false for expired code', () => {
      const mockEntry: QueueEntry = {
        id: 'entry1',
        customerId: 'customer1',
        serviceType: 'appointment' as QueueServiceType,
        status: 'waiting',
        position: 1,
        joinedAt: new Date(),
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: new Date(Date.now() - 1000), // Expired
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(service as any, 'queueEntries', 'get').mockReturnValue(signal([mockEntry]));

      const isValid = service.isCodeValid('1234');

      expect(isValid).toBe(false);
    });

    it('should get entry by verification code', () => {
      const mockEntry: QueueEntry = {
        id: 'entry1',
        customerId: 'customer1',
        serviceType: 'appointment' as QueueServiceType,
        status: 'waiting',
        position: 1,
        joinedAt: new Date(),
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(service as any, 'queueEntries', 'get').mockReturnValue(signal([mockEntry]));

      const entry = service.getEntryByCode('1234');

      expect(entry).toEqual(mockEntry);
    });
  });

  describe('Error Handling', () => {
    it('should handle addToQueue errors gracefully', async () => {
      const queueData = {
        customerId: 'customer1',
        serviceType: 'appointment' as QueueServiceType,
        motorcycleId: 'motorcycle1',
        plate: 'ABC123',
        mileageKm: 10000
      };

      jest.spyOn(service as any, 'checkUserHasMotorcycle').mockRejectedValue(new Error('Database error'));

      await expect(service.addToQueue(queueData)).rejects.toThrow();
    });

    it('should handle callNext errors gracefully', async () => {
      const mockEntry: QueueEntry = {
        id: 'entry1',
        customerId: 'customer1',
        serviceType: 'appointment' as QueueServiceType,
        status: 'waiting',
        position: 1,
        joinedAt: new Date(),
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(service as any, 'queueEntries', 'get').mockReturnValue(signal([mockEntry]));
      workOrderServiceSpy.mockRejectedValue(new Error('Work order creation failed'));

      await expect(service.callNext('tech1')).rejects.toThrow('Failed to create work order from queue entry');
    });

    it('should throw error for non-existent queue entry operations', async () => {
      jest.spyOn(service as any, 'queueEntries', 'get').mockReturnValue(signal([]));

      await expect(service.serveEntry('nonexistent')).rejects.toThrow('Queue entry not found');
      await expect(service.cancelEntry('nonexistent')).rejects.toThrow('Queue entry not found');
    });
  });

  describe('Cache Integration', () => {
    it('should use cached queue data when available', async () => {
      const cachedData = {
        entries: [],
        status: { id: 'singleton', isOpen: true, currentCount: 0 }
      };

      cacheServiceSpy.mockResolvedValue(cachedData);

      // Trigger loadQueueData
      await (service as any).loadQueueData();

      expect(service.getQueueEntries()()).toEqual([]);
      expect(service.getQueueStatus()()).toEqual(cachedData.status);
    });

    it('should refresh cache when forceRefresh is true', async () => {
      cacheServiceSpy.mockResolvedValue(null); // No cache

      await service.refreshQueueData();

      expect(cacheServiceSpy).toHaveBeenCalled();
    });
  });

  describe('Operating Hours', () => {
    it('should determine if queue is open based on hours', () => {
      const mockStatus: QueueStatus = {
        id: 'singleton',
        isOpen: true,
        currentCount: 0,
        operatingHours: {
          monday: { open: '07:00', close: '17:30', enabled: true },
          tuesday: { open: '07:00', close: '17:30', enabled: true },
          wednesday: { open: '07:00', close: '17:30', enabled: true },
          thursday: { open: '07:00', close: '17:30', enabled: true },
          friday: { open: '07:00', close: '17:30', enabled: true },
          saturday: { open: '07:00', close: '17:30', enabled: true },
          sunday: { open: '07:00', close: '17:30', enabled: false }
        },
        lastUpdated: new Date()
      };

      jest.spyOn(service as any, 'queueStatus', 'get').mockReturnValue(signal(mockStatus));

      // Mock current time to be within operating hours
      const originalDate = Date;
      const mockDate = new Date('2024-01-01T10:00:00'); // Monday 10:00 AM
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const isOpen = (service as any).isQueueOpenBasedOnHours();

      expect(isOpen).toBe(true);

      // Restore original Date
      global.Date = originalDate;
    });

    it('should return false for disabled days', () => {
      const mockStatus: QueueStatus = {
        id: 'singleton',
        isOpen: true,
        currentCount: 0,
        operatingHours: {
          monday: { open: '07:00', close: '17:30', enabled: true },
          tuesday: { open: '07:00', close: '17:30', enabled: true },
          wednesday: { open: '07:00', close: '17:30', enabled: true },
          thursday: { open: '07:00', close: '17:30', enabled: true },
          friday: { open: '07:00', close: '17:30', enabled: true },
          saturday: { open: '07:00', close: '17:30', enabled: true },
          sunday: { open: '07:00', close: '17:30', enabled: false }
        },
        lastUpdated: new Date()
      };

      jest.spyOn(service as any, 'queueStatus', 'get').mockReturnValue(signal(mockStatus));

      // Mock current time to be Sunday
      const originalDate = Date;
      const mockDate = new Date('2024-01-07T10:00:00'); // Sunday 10:00 AM
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const isOpen = (service as any).isQueueOpenBasedOnHours();

      expect(isOpen).toBe(false);

      // Restore original Date
      global.Date = originalDate;
    });
  });
});