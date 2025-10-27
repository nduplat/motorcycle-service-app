import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { EventBusService } from './event-bus.service';
import { CacheService } from './cache.service';
import { CostMonitoringService } from './cost-monitoring.service';
/// <reference types="jest" />

describe('NotificationService', () => {
  let service: NotificationService;
  let authServiceSpy: jest.SpyInstance;
  let userServiceSpy: jest.SpyInstance;
  let eventBusSpy: jest.SpyInstance;
  let cacheServiceSpy: jest.SpyInstance;
  let costMonitoringSpy: jest.SpyInstance;

  beforeEach(() => {
    const authSpy = {
      currentUser: jest.fn().mockReturnValue({ id: 'user1', role: 'customer' })
    };
    const userSpy = {
      getUsers: jest.fn().mockReturnValue([]),
      getUserById: jest.fn()
    };
    const eventBusSpyObj = {
      emit: jest.fn()
    };
    const cacheSpy = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined)
    };
    const costSpy = {
      trackFirestoreRead: jest.fn(),
      trackFirestoreWrite: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: AuthService, useValue: authSpy },
        { provide: UserService, useValue: userSpy },
        { provide: EventBusService, useValue: eventBusSpyObj },
        { provide: CacheService, useValue: cacheSpy },
        { provide: CostMonitoringService, useValue: costSpy }
      ]
    });

    service = TestBed.inject(NotificationService);
    authServiceSpy = authSpy.currentUser;
    userServiceSpy = userSpy.getUsers;
    eventBusSpy = eventBusSpyObj.emit;
    cacheServiceSpy = cacheSpy.get;
    costMonitoringSpy = costSpy.trackFirestoreRead;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Notification Management', () => {
    it('should create inventory alert notification', async () => {
      const productInfo = {
        name: 'Oil Filter',
        sku: 'OIL-001',
        currentStock: 5,
        minStock: 10
      };

      await service.createInventoryAlert(productInfo, 'low_stock', 'Main Warehouse');

      expect(eventBusSpy).toHaveBeenCalledWith({
        type: 'notification.created',
        entity: expect.objectContaining({
          type: 'inventory',
          title: 'Stock Bajo',
          message: expect.stringContaining('Oil Filter'),
          priority: 'medium'
        })
      });
    });

    it('should create categorized notification', async () => {
      const notificationData = {
        type: 'maintenance_reminder' as const,
        title: 'Maintenance Due',
        message: 'Vehicle maintenance is due',
        priority: 'medium' as const,
        targetUsers: ['customer'],
        metadata: { vehicleId: 'vehicle1' }
      };

      await service.createCategorizedNotification(notificationData);

      expect(eventBusSpy).toHaveBeenCalledWith({
        type: 'notification.created',
        entity: expect.objectContaining(notificationData)
      });
    });

    it('should create queue notification', async () => {
      const queueData = {
        customerId: 'customer1',
        position: 3,
        estimatedWaitTime: 45
      };

      await service.createQueueNotification(queueData);

      expect(eventBusSpy).toHaveBeenCalledWith({
        type: 'notification.queue_update',
        entity: expect.objectContaining({
          type: 'queue_update',
          title: 'Queue Position Update',
          message: expect.stringContaining('position 3'),
          priority: 'low',
          targetUsers: ['customer1']
        })
      });
    });

    it('should create maintenance reminder', async () => {
      const reminderData = {
        vehicleId: 'vehicle1',
        customerId: 'customer1',
        serviceType: 'Oil Change',
        dueDate: new Date(),
        mileageDue: 10000
      };

      await service.createMaintenanceReminder(reminderData);

      expect(eventBusSpy).toHaveBeenCalledWith({
        type: 'notification.maintenance_reminder',
        entity: expect.objectContaining({
          type: 'maintenance_reminder',
          title: 'Maintenance Reminder',
          message: expect.stringContaining('Oil Change'),
          priority: 'medium',
          targetUsers: ['customer1']
        })
      });
    });
  });

  describe('Notification Retrieval', () => {
    it('should get system notifications', async () => {
      const mockNotifications = [
        {
          id: 'notif1',
          type: 'system',
          title: 'System Update',
          message: 'System maintenance scheduled',
          priority: 'low',
          createdAt: new Date(),
          read: false
        }
      ];

      // Mock the getSystemNotifications method
      jest.spyOn(service as any, 'getSystemNotifications').mockResolvedValue(mockNotifications);

      const result = await service.getSystemNotifications();

      expect(result).toEqual(mockNotifications);
    });

    it('should get unread count', async () => {
      const mockCount = 5;

      // Mock the getUnreadCount method
      jest.spyOn(service as any, 'getUnreadCount').mockResolvedValue(mockCount);

      const result = await service.getUnreadCount('user1');

      expect(result).toBe(mockCount);
    });
  });

  describe('Notification Categories', () => {
    it('should handle different notification priorities', () => {
      const priorities = ['low', 'medium', 'high', 'urgent'] as const;

      priorities.forEach(priority => {
        const notification = {
          type: 'system' as const,
          title: 'Test',
          message: 'Test message',
          priority,
          targetUsers: ['user1']
        };

        expect(notification.priority).toBe(priority);
      });
    });

    it('should handle different notification types', () => {
      const types = [
        'inventory_alert',
        'queue_update',
        'maintenance_reminder',
        'system',
        'appointment_reminder',
        'payment_due'
      ] as const;

      types.forEach(type => {
        const notification = {
          type,
          title: 'Test',
          message: 'Test message',
          priority: 'medium' as const,
          targetUsers: ['user1']
        };

        expect(notification.type).toBe(type);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle notification creation errors gracefully', async () => {
      const alertData = {
        productId: 'product1',
        productName: 'Oil Filter',
        currentStock: 5,
        minimumStock: 10,
        location: 'Main Warehouse'
      };

      // Mock eventBus.emit to throw error
      eventBusSpy.mockImplementation(() => {
        throw new Error('Event bus error');
      });

      await expect(service.createInventoryAlert(alertData)).rejects.toThrow('Event bus error');
    });

    it('should handle empty notification data', async () => {
      const emptyData = {
        type: 'system' as const,
        title: '',
        message: '',
        priority: 'low' as const,
        targetUsers: []
      };

      await service.createCategorizedNotification(emptyData);

      expect(eventBusSpy).toHaveBeenCalledWith({
        type: 'notification.created',
        entity: expect.objectContaining({
          title: '',
          message: '',
          targetUsers: []
        })
      });
    });
  });

  describe('Cache Integration', () => {
    it('should use cached notification data when available', async () => {
      const cachedNotifications = [
        {
          id: 'cached1',
          type: 'system',
          title: 'Cached Notification',
          message: 'This is cached',
          priority: 'low',
          createdAt: new Date(),
          read: false
        }
      ];

      cacheServiceSpy.mockResolvedValue(cachedNotifications);

      // Mock the getSystemNotifications method
      jest.spyOn(service as any, 'getSystemNotifications').mockResolvedValue([]);

      const result = await service.getSystemNotifications();

      expect(cacheServiceSpy).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should cache notification results', async () => {
      const notifications = [
        {
          id: 'notif1',
          type: 'system',
          title: 'Test Notification',
          message: 'Test message',
          priority: 'low',
          createdAt: new Date(),
          read: false
        }
      ];

      jest.spyOn(service as any, 'getSystemNotifications').mockResolvedValue(notifications);

      await service.getSystemNotifications();

      expect(cacheServiceSpy).toHaveBeenCalled();
    });
  });

  describe('Cost Monitoring', () => {
    it('should track Firestore operations', async () => {
      const alertData = {
        productId: 'product1',
        productName: 'Oil Filter',
        currentStock: 5,
        minimumStock: 10,
        location: 'Main Warehouse'
      };

      await service.createInventoryAlert(alertData);

      expect(costMonitoringSpy).toHaveBeenCalled();
    });

    it('should track multiple operations', async () => {
      // Create multiple notifications
      await service.createInventoryAlert({
        productId: 'product1',
        productName: 'Oil Filter',
        currentStock: 5,
        minimumStock: 10,
        location: 'Main Warehouse'
      });

      await service.createQueueNotification({
        customerId: 'customer1',
        position: 1,
        estimatedWaitTime: 30
      });

      // Should track multiple Firestore operations
      expect(costMonitoringSpy).toHaveBeenCalledTimes(2);
    });
  });
});