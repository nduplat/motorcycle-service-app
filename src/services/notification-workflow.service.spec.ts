/**
 * Notification Workflow Service - Tests
 * Pruebas del Servicio de Flujo de Trabajo de Notificaciones
 */

import { TestBed } from '@angular/core/testing';
import { NotificationWorkflowService, NotificationWorkflowEvent, NotificationTarget, NotificationMessage } from './notification-workflow.service';
import { NotificationService } from './notification.service';
import { EventBusService } from './event-bus.service';
import { UserService } from './user.service';
import { QrCodeService } from './qr-code.service';

describe('NotificationWorkflowService', () => {
  let service: NotificationWorkflowService;
  let notificationServiceSpy: any;
  let eventBusSpy: any;
  let userServiceSpy: any;
  let qrCodeServiceSpy: any;

  beforeEach(() => {
    const notificationSpy = jasmine.createSpyObj('NotificationService', [
      'getUserPreferences',
      'createCategorizedNotification',
      'sendPushNotification'
    ]);
    const eventBusSpyObj = jasmine.createSpyObj('EventBusService', ['events$']);
    const userSpy = jasmine.createSpyObj('UserService', [
      'getUsersByRole',
      'getUserById'
    ]);
    const qrSpy = jasmine.createSpyObj('QrCodeService', [
      'generateQrCodeDataUrl'
    ]);

    TestBed.configureTestingModule({
      providers: [
        NotificationWorkflowService,
        { provide: NotificationService, useValue: notificationSpy },
        { provide: EventBusService, useValue: eventBusSpyObj },
        { provide: UserService, useValue: userSpy },
        { provide: QrCodeService, useValue: qrSpy }
      ]
    });

    service = TestBed.inject(NotificationWorkflowService);
    notificationServiceSpy = TestBed.inject(NotificationService);
    eventBusSpy = TestBed.inject(EventBusService);
    userServiceSpy = TestBed.inject(UserService);
    qrCodeServiceSpy = TestBed.inject(QrCodeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('processEvent', () => {
    it('should process assignment events correctly', async () => {
      const event: NotificationWorkflowEvent = {
        type: 'assignment',
        entityId: 'test-entity',
        entityType: 'appointment',
        metadata: {
          technicianId: 'tech-1',
          customerId: 'customer-1'
        },
        timestamp: new Date()
      };

      notificationServiceSpy.getUserPreferences.and.returnValue(Promise.resolve({
        id: 'tech-1',
        userId: 'tech-1',
        pushNotifications: true,
        serviceOrderUpdates: true
      } as any));

      notificationServiceSpy.createCategorizedNotification.and.returnValue(Promise.resolve([]));

      qrCodeServiceSpy.generateQrCodeDataUrl.and.returnValue('data:image/png;base64,test');

      await service.processEvent(event);

      expect(notificationServiceSpy.getUserPreferences).toHaveBeenCalledWith('tech-1');
      expect(notificationServiceSpy.createCategorizedNotification).toHaveBeenCalled();
    });

    it('should skip notifications when user preferences disable them', async () => {
      const event: NotificationWorkflowEvent = {
        type: 'assignment',
        entityId: 'test-entity',
        entityType: 'appointment',
        metadata: {
          technicianId: 'tech-1',
          customerId: 'customer-1'
        },
        timestamp: new Date()
      };

      notificationServiceSpy.getUserPreferences.and.returnValue(Promise.resolve({
        id: 'tech-1',
        userId: 'tech-1',
        pushNotifications: false,
        serviceOrderUpdates: false
      } as any));

      await service.processEvent(event);

      expect(notificationServiceSpy.createCategorizedNotification).not.toHaveBeenCalled();
    });

    it('should handle status change events', async () => {
      const event: NotificationWorkflowEvent = {
        type: 'status_change',
        entityId: 'work-order-1',
        entityType: 'work_order',
        metadata: {
          customerId: 'customer-1',
          status: 'completed'
        },
        timestamp: new Date()
      };

      notificationServiceSpy.getUserPreferences.and.returnValue(Promise.resolve({
        id: 'customer-1',
        userId: 'customer-1',
        pushNotifications: true,
        serviceOrderUpdates: true
      } as any));

      notificationServiceSpy.createCategorizedNotification.and.returnValue(Promise.resolve([]));

      await service.processEvent(event);

      expect(notificationServiceSpy.createCategorizedNotification).toHaveBeenCalledWith(
        'service_orders',
        '¡Servicio Completado!',
        'Tu orden de trabajo ha sido completada. Ya puedes recoger tu vehículo.',
        jasmine.objectContaining({
          userId: 'customer-1',
          priority: 'high'
        })
      );
    });

    it('should handle queue called events with QR codes', async () => {
      const event: NotificationWorkflowEvent = {
        type: 'queue_called',
        entityId: 'queue-entry-1',
        entityType: 'queue_entry',
        metadata: {
          customerId: 'customer-1',
          technicianId: 'tech-1',
          verificationCode: 'ABC123',
          position: 5
        },
        timestamp: new Date()
      };

      notificationServiceSpy.getUserPreferences.and.returnValue(Promise.resolve({
        id: 'customer-1',
        userId: 'customer-1',
        pushNotifications: true,
        queueNotifications: true
      } as any));

      notificationServiceSpy.createCategorizedNotification.and.returnValue(Promise.resolve([]));
      qrCodeServiceSpy.generateQrCodeDataUrl.and.returnValue('data:image/png;base64,qrtest');

      await service.processEvent(event);

      expect(qrCodeServiceSpy.generateQrCodeDataUrl).toHaveBeenCalledWith('queue-entry', 'queue-entry-1');
      expect(notificationServiceSpy.createCategorizedNotification).toHaveBeenCalledWith(
        'queue',
        '¡Es tu turno!',
        expect.stringContaining('Código: ABC123'),
        jasmine.objectContaining({
          userId: 'customer-1',
          priority: 'critical'
        })
      );
    });

    it('should handle maintenance reminder events', async () => {
      const event: NotificationWorkflowEvent = {
        type: 'maintenance_reminder',
        entityId: 'vehicle-1',
        entityType: 'vehicle',
        metadata: {
          customerId: 'customer-1',
          serviceName: 'Cambio de aceite',
          dueDate: new Date()
        },
        timestamp: new Date()
      };

      notificationServiceSpy.getUserPreferences.and.returnValue(Promise.resolve({
        id: 'customer-1',
        userId: 'customer-1',
        pushNotifications: true,
        maintenanceReminders: true
      } as any));

      notificationServiceSpy.createCategorizedNotification.and.returnValue(Promise.resolve([]));

      await service.processEvent(event);

      expect(notificationServiceSpy.createCategorizedNotification).toHaveBeenCalledWith(
        'maintenance_reminders',
        'Recordatorio de Mantenimiento',
        expect.stringContaining('Cambio de aceite'),
        jasmine.objectContaining({
          userId: 'customer-1',
          priority: 'medium'
        })
      );
    });

    it('should handle inventory alert events for admins', async () => {
      const event: NotificationWorkflowEvent = {
        type: 'inventory_alert',
        entityId: 'product-1',
        entityType: 'inventory_item',
        metadata: {
          productName: 'Filtro de aceite',
          alertType: 'low_stock',
          currentStock: 5,
          minStock: 10
        },
        timestamp: new Date()
      };

      const mockAdmin = { id: 'admin-1', name: 'Admin User', role: 'admin' };
      userServiceSpy.getUsersByRole.and.returnValue([mockAdmin]);

      notificationServiceSpy.getUserPreferences.and.returnValue(Promise.resolve({
        id: 'admin-1',
        userId: 'admin-1',
        pushNotifications: true,
        inventoryAlerts: true
      } as any));

      notificationServiceSpy.createCategorizedNotification.and.returnValue(Promise.resolve([]));

      await service.processEvent(event);

      expect(userServiceSpy.getUsersByRole).toHaveBeenCalledWith('admin');
      expect(notificationServiceSpy.createCategorizedNotification).toHaveBeenCalledWith(
        'inventory',
        'Stock Bajo',
        expect.stringContaining('Filtro de aceite'),
        jasmine.objectContaining({
          priority: 'high',
          targetAudience: 'admins'
        })
      );
    });
  });

  describe('Manual triggering methods', () => {
    it('should trigger assignment notifications', async () => {
      const assignmentData = {
        entityId: 'appointment-1',
        entityType: 'appointment' as const,
        technicianId: 'tech-1',
        customerId: 'customer-1'
      };

      spyOn(service, 'processEvent');

      await service.triggerAssignmentNotification(assignmentData);

      expect(service.processEvent).toHaveBeenCalledWith(jasmine.objectContaining({
        type: 'assignment',
        entityId: 'appointment-1',
        metadata: assignmentData
      }));
    });

    it('should trigger status change notifications', async () => {
      const statusData = {
        entityId: 'work-order-1',
        entityType: 'work_order' as const,
        customerId: 'customer-1',
        status: 'completed'
      };

      spyOn(service, 'processEvent');

      await service.triggerStatusChangeNotification(statusData);

      expect(service.processEvent).toHaveBeenCalledWith(jasmine.objectContaining({
        type: 'status_change',
        entityId: 'work-order-1',
        metadata: statusData
      }));
    });

    it('should trigger maintenance reminders', async () => {
      const reminderData = {
        entityId: 'vehicle-1',
        customerId: 'customer-1',
        serviceName: 'Cambio de aceite',
        dueDate: new Date()
      };

      spyOn(service, 'processEvent');

      await service.triggerMaintenanceReminder(reminderData);

      expect(service.processEvent).toHaveBeenCalledWith(jasmine.objectContaining({
        type: 'maintenance_reminder',
        entityId: 'vehicle-1',
        metadata: reminderData
      }));
    });

    it('should trigger inventory alerts', async () => {
      const alertData = {
        entityId: 'product-1',
        productName: 'Filtro de aceite',
        alertType: 'low_stock' as const,
        currentStock: 5,
        minStock: 10
      };

      spyOn(service, 'processEvent');

      await service.triggerInventoryAlert(alertData);

      expect(service.processEvent).toHaveBeenCalledWith(jasmine.objectContaining({
        type: 'inventory_alert',
        entityId: 'product-1',
        metadata: alertData
      }));
    });
  });

  describe('Event conversion', () => {
    it('should convert event bus events to workflow events', () => {
      const eventBusEvent = {
        type: 'appointment.created' as const,
        entity: {
          id: 'appointment-1',
          clientId: 'customer-1'
        }
      };

      const result = (service as any).convertToWorkflowEvent(eventBusEvent);

      expect(result).toEqual(jasmine.objectContaining({
        type: 'appointment_created',
        entityId: 'appointment-1',
        entityType: 'appointment',
        metadata: { customerId: 'customer-1' }
      }));
    });

    it('should return null for unsupported events', () => {
      const unsupportedEvent = {
        type: 'unknown.event' as any,
        entity: { id: 'test' }
      };

      const result = (service as any).convertToWorkflowEvent(unsupportedEvent);

      expect(result).toBeNull();
    });
  });

  describe('Message generation', () => {
    it('should generate appropriate messages for different event types', async () => {
      const target: NotificationTarget = {
        userId: 'user-1',
        channels: ['in_app', 'push'],
        priority: 'high'
      };

      // Test assignment message
      const assignmentEvent: NotificationWorkflowEvent = {
        type: 'assignment',
        entityId: 'test-1',
        entityType: 'appointment',
        metadata: { technicianId: 'user-1' },
        timestamp: new Date()
      };

      qrCodeServiceSpy.generateQrCodeDataUrl.and.returnValue('qr-data-url');

      const assignmentMessage = await (service as any).generateMessageForTarget(assignmentEvent, target);
      expect(assignmentMessage?.title).toBe('Nueva Asignación');
      expect(assignmentMessage?.category).toBe('service_orders');

      // Test status change message
      const statusEvent: NotificationWorkflowEvent = {
        type: 'status_change',
        entityId: 'test-1',
        entityType: 'work_order',
        metadata: { status: 'completed' },
        timestamp: new Date()
      };

      const statusMessage = await (service as any).generateMessageForTarget(statusEvent, target);
      expect(statusMessage?.title).toBe('¡Servicio Completado!');
      expect(statusMessage?.category).toBe('service_orders');
    });

    it('should include QR codes for relevant events', async () => {
      const target: NotificationTarget = {
        userId: 'customer-1',
        channels: ['in_app'],
        priority: 'critical'
      };

      const queueEvent: NotificationWorkflowEvent = {
        type: 'queue_called',
        entityId: 'queue-1',
        entityType: 'queue_entry',
        metadata: { verificationCode: 'ABC123' },
        timestamp: new Date()
      };

      qrCodeServiceSpy.generateQrCodeDataUrl.and.returnValue('qr-data-url');

      const message = await (service as any).generateMessageForTarget(queueEvent, target);
      expect(message?.qrCodeData).toBe('qr-data-url');
      expect(message?.metadata?.verificationCode).toBe('ABC123');
    });
  });

  describe('Target determination', () => {
    it('should determine correct targets for assignment events', async () => {
      const event: NotificationWorkflowEvent = {
        type: 'assignment',
        entityId: 'test-1',
        entityType: 'appointment',
        metadata: {
          technicianId: 'tech-1',
          customerId: 'customer-1'
        },
        timestamp: new Date()
      };

      const targets = await (service as any).determineNotificationTargets(event);

      expect(targets).toContain(jasmine.objectContaining({
        userId: 'tech-1',
        channels: ['in_app', 'push'],
        priority: 'high'
      }));

      expect(targets).toContain(jasmine.objectContaining({
        userId: 'customer-1',
        channels: ['in_app', 'push', 'sms'],
        priority: 'medium'
      }));
    });

    it('should determine targets for inventory alerts (admins only)', async () => {
      const event: NotificationWorkflowEvent = {
        type: 'inventory_alert',
        entityId: 'product-1',
        entityType: 'inventory_item',
        metadata: {},
        timestamp: new Date()
      };

      const mockAdmins = [
        { id: 'admin-1', name: 'Admin 1', role: 'admin' },
        { id: 'admin-2', name: 'Admin 2', role: 'admin' }
      ];

      userServiceSpy.getUsersByRole.and.returnValue(mockAdmins);

      const targets = await (service as any).determineNotificationTargets(event);

      expect(userServiceSpy.getUsersByRole).toHaveBeenCalledWith('admin');
      expect(targets.length).toBe(2);
      expect(targets[0].userId).toBe('admin-1');
      expect(targets[0].channels).toEqual(['in_app', 'push', 'email']);
    });
  });

  describe('Preference filtering', () => {
    it('should filter targets based on user preferences', async () => {
      const targets: NotificationTarget[] = [
        {
          userId: 'user-1',
          channels: ['in_app', 'push'],
          priority: 'medium'
        },
        {
          userId: 'user-2',
          channels: ['in_app', 'push'],
          priority: 'medium'
        }
      ];

      // User 1 has notifications enabled
      notificationServiceSpy.getUserPreferences.and.callFake((userId: string) => {
        if (userId === 'user-1') {
          return Promise.resolve({
            id: 'user-1',
            userId: 'user-1',
            pushNotifications: true,
            serviceOrderUpdates: true
          } as any);
        } else {
          // User 2 has notifications disabled
          return Promise.resolve({
            id: 'user-2',
            userId: 'user-2',
            pushNotifications: false,
            serviceOrderUpdates: false
          } as any);
        }
      });

      const enabledTargets = await (service as any).filterEnabledNotifications(targets);

      expect(enabledTargets.length).toBe(1);
      expect(enabledTargets[0].userId).toBe('user-1');
    });

    it('should default to enabled when preferences cannot be retrieved', async () => {
      const targets: NotificationTarget[] = [{
        userId: 'user-1',
        channels: ['in_app'],
        priority: 'medium'
      }];

      notificationServiceSpy.getUserPreferences.and.returnValue(Promise.reject(new Error('DB error')));

      const enabledTargets = await (service as any).filterEnabledNotifications(targets);

      expect(enabledTargets.length).toBe(1); // Should still include the target
    });
  });
});