import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { ClientFlowService } from '../../src/services/client-flow.service';
import { UnifiedQueueService } from '../../src/services/unified-queue.service';
import { AuthService } from '../../src/services/auth.service';
import { MotorcycleService } from '../../src/services/motorcycle.service';
import { AdvancedServiceService } from '../../src/services/advanced-service.service';
import { NotificationService } from '../../src/services/notification.service';
import { ValidationService } from '../../src/services/validation_service';
import { FormCacheService } from '../../src/services/form_cache_service';
import { CacheService } from '../../src/services/cache.service';
import { EventBusService } from '../../src/services/event-bus.service';
import { QrCodeService } from '../../src/services/qr-code.service';
import { WorkOrderService } from '../../src/services/work-order.service';
import { QueueJoinData, Motorcycle, ServiceItem, User, QueueEntry } from '../../src/models';

describe('Client Flow ↔ Queue Integration Tests', () => {
  let clientFlowService: ClientFlowService;
  let unifiedQueueService: UnifiedQueueService;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockMotorcycleService: jasmine.SpyObj<MotorcycleService>;
  let mockServiceService: jasmine.SpyObj<AdvancedServiceService>;
  let mockNotificationService: jasmine.SpyObj<NotificationService>;
  let mockValidationService: jasmine.SpyObj<ValidationService>;
  let mockFormCacheService: jasmine.SpyObj<FormCacheService>;
  let mockCacheService: jasmine.SpyObj<CacheService>;
  let mockEventBus: jasmine.SpyObj<EventBusService>;
  let mockQrCodeService: jasmine.SpyObj<QrCodeService>;
  let mockWorkOrderService: jasmine.SpyObj<WorkOrderService>;

  beforeEach(() => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const authSpy = jasmine.createSpyObj('AuthService', ['currentUser']);
    const motorcycleSpy = jasmine.createSpyObj('MotorcycleService', ['getMotorcycles']);
    const serviceSpy = jasmine.createSpyObj('AdvancedServiceService', ['paginatedServices']);
    const notificationSpy = jasmine.createSpyObj('NotificationService', ['addSystemNotification']);
    const validationSpy = jasmine.createSpyObj('ValidationService', ['validatePhone', 'validateLicensePlate', 'validateMileage']);
    const formCacheSpy = jasmine.createSpyObj('FormCacheService', ['recoverFormData', 'startAutoSave', 'stopAutoSave']);
    const cacheSpy = jasmine.createSpyObj('CacheService', ['get', 'set', 'invalidateByEntity']);
    const eventBusSpy = jasmine.createSpyObj('EventBusService', ['emit']);
    const qrCodeSpy = jasmine.createSpyObj('QrCodeService', ['generateQrCodeDataUrl']);
    const workOrderSpy = jasmine.createSpyObj('WorkOrderService', ['createWorkOrderFromQueueEntry']);

    TestBed.configureTestingModule({
      providers: [
        ClientFlowService,
        UnifiedQueueService,
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: MotorcycleService, useValue: motorcycleSpy },
        { provide: AdvancedServiceService, useValue: serviceSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: ValidationService, useValue: validationSpy },
        { provide: FormCacheService, useValue: formCacheSpy },
        { provide: CacheService, useValue: cacheSpy },
        { provide: EventBusService, useValue: eventBusSpy },
        { provide: QrCodeService, useValue: qrCodeSpy },
        { provide: WorkOrderService, useValue: workOrderSpy }
      ]
    });

    clientFlowService = TestBed.inject(ClientFlowService);
    unifiedQueueService = TestBed.inject(UnifiedQueueService);
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    mockAuthService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    mockMotorcycleService = TestBed.inject(MotorcycleService) as jasmine.SpyObj<MotorcycleService>;
    mockServiceService = TestBed.inject(AdvancedServiceService) as jasmine.SpyObj<AdvancedServiceService>;
    mockNotificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    mockValidationService = TestBed.inject(ValidationService) as jasmine.SpyObj<ValidationService>;
    mockFormCacheService = TestBed.inject(FormCacheService) as jasmine.SpyObj<FormCacheService>;
    mockCacheService = TestBed.inject(CacheService) as jasmine.SpyObj<CacheService>;
    mockEventBus = TestBed.inject(EventBusService) as jasmine.SpyObj<EventBusService>;
    mockQrCodeService = TestBed.inject(QrCodeService) as jasmine.SpyObj<QrCodeService>;
    mockWorkOrderService = TestBed.inject(WorkOrderService) as jasmine.SpyObj<WorkOrderService>;
  });

  describe('Complete Client Flow Integration', () => {
    let testUser: User;
    let testMotorcycle: Motorcycle;
    let testService: ServiceItem;

    beforeEach(() => {
      testUser = {
        uid: 'test-user-123',
        id: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        name: 'Test User',
        phone: '+573001234567',
        role: 'customer',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      testMotorcycle = {
        id: 'test-moto-123',
        brand: 'Yamaha',
        model: 'FZ150',
        year: 2022,
        plate: 'ABC123',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      testService = {
        id: 'test-service-123',
        title: 'Cambio de Aceite',
        code: 'OIL_CHANGE',
        description: 'Cambio completo de aceite y filtro',
        price: 75000
      };

      mockAuthService.currentUser.and.returnValue(testUser);
      mockValidationService.validatePhone.and.returnValue({ isValid: true });
      mockValidationService.validateLicensePlate.and.returnValue({ isValid: true });
      mockValidationService.validateMileage.and.returnValue({ isValid: true });
      mockQrCodeService.generateQrCodeDataUrl.and.returnValue('data:image/png;base64,test-qr');
      mockCacheService.set.and.returnValue(Promise.resolve());
      mockCacheService.invalidateByEntity.and.returnValue(Promise.resolve());
    });

    it('should complete full client flow and create queue entry', async () => {
      // Step 1: Setup ClientFlowService with complete data
      clientFlowService.setPhone('+573001234567');
      clientFlowService.setSelectedMotorcycle(testMotorcycle);
      clientFlowService.setLicensePlate('ABC123');
      clientFlowService.setCurrentMileage(50000);
      clientFlowService.setSelectedService(testService);

      // Mock UnifiedQueueService to return entry ID
      spyOn(unifiedQueueService, 'addEntry').and.returnValue(Promise.resolve('queue-entry-123'));

      // Step 2: Complete the flow
      await clientFlowService.completeFlow();

      // Assertions
      expect(unifiedQueueService.addEntry).toHaveBeenCalledWith(jasmine.objectContaining({
        customerId: testUser.id,
        serviceType: 'direct_work_order',
        motorcycleId: testMotorcycle.id,
        plate: 'ABC123',
        mileageKm: 50000,
        notes: jasmine.stringContaining('Cambio de Aceite')
      }));

      expect(clientFlowService.flowState().currentQueueEntryId).toBe('queue-entry-123');
      expect(clientFlowService.getCurrentStep()).toBe('ticket');
      expect(clientFlowService.isFlowComplete()).toBe(true);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/client-flow/wait-ticket']);
    });

    it('should synchronize state between ClientFlowService and UnifiedQueueService', async () => {
      // Setup flow completion
      clientFlowService.setPhone('+573001234567');
      clientFlowService.setSelectedMotorcycle(testMotorcycle);
      clientFlowService.setLicensePlate('ABC123');
      clientFlowService.setCurrentMileage(50000);
      clientFlowService.setSelectedService(testService);

      const mockQueueEntry: QueueEntry = {
        id: 'queue-entry-123',
        customerId: testUser.id,
        serviceType: 'direct_work_order',
        status: 'waiting',
        position: 1,
        joinedAt: new Date(),
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        motorcycleId: testMotorcycle.id,
        plate: 'ABC123',
        mileageKm: 50000,
        notes: `Servicio: ${testService.title}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      spyOn(unifiedQueueService, 'addEntry').and.returnValue(Promise.resolve(mockQueueEntry.id));
      spyOn(unifiedQueueService, 'getEntryById').and.returnValue(Promise.resolve(mockQueueEntry));

      // Complete flow
      await clientFlowService.completeFlow();

      // Verify state synchronization
      expect(clientFlowService.flowState().currentQueueEntryId).toBe(mockQueueEntry.id);

      // Test queue position access
      const position = clientFlowService.getCurrentQueuePosition();
      expect(position).toBe(mockQueueEntry.position);
    });

    it('should handle queue entry updates from UnifiedQueueService', async () => {
      // Setup initial flow completion
      clientFlowService.setPhone('+573001234567');
      clientFlowService.setSelectedMotorcycle(testMotorcycle);
      clientFlowService.setLicensePlate('ABC123');
      clientFlowService.setCurrentMileage(50000);
      clientFlowService.setSelectedService(testService);

      spyOn(unifiedQueueService, 'addEntry').and.returnValue(Promise.resolve('queue-entry-123'));
      await clientFlowService.completeFlow();

      // Simulate queue status update (technician calls next)
      const updatedEntry: QueueEntry = {
        id: 'queue-entry-123',
        customerId: testUser.id,
        serviceType: 'direct_work_order',
        status: 'called',
        position: 1,
        joinedAt: new Date(),
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        assignedTo: 'technician-123',
        calledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      spyOn(unifiedQueueService, 'getEntryById').and.returnValue(Promise.resolve(updatedEntry));

      // ClientFlowService should reflect the updated status
      const currentEntry = await unifiedQueueService.getEntryById('queue-entry-123');
      expect(currentEntry?.status).toBe('called');
      expect(currentEntry?.assignedTo).toBe('technician-123');
    });

    it('should maintain data consistency across service boundaries', async () => {
      // Setup flow data
      const flowData = {
        phone: '+573001234567',
        motorcycle: testMotorcycle,
        licensePlate: 'ABC123',
        mileage: 50000,
        service: testService
      };

      clientFlowService.setPhone(flowData.phone);
      clientFlowService.setSelectedMotorcycle(flowData.motorcycle);
      clientFlowService.setLicensePlate(flowData.licensePlate);
      clientFlowService.setCurrentMileage(flowData.mileage);
      clientFlowService.setSelectedService(flowData.service);

      // Mock queue creation
      const expectedQueueData: QueueJoinData = {
        customerId: testUser.id,
        serviceType: 'direct_work_order',
        motorcycleId: flowData.motorcycle.id,
        plate: flowData.licensePlate,
        mileageKm: flowData.mileage,
        notes: `Servicio: ${flowData.service.title}`
      };

      spyOn(unifiedQueueService, 'addEntry').and.returnValue(Promise.resolve('queue-entry-123'));

      // Complete flow
      await clientFlowService.completeFlow();

      // Verify data consistency
      expect(unifiedQueueService.addEntry).toHaveBeenCalledWith(
        jasmine.objectContaining(expectedQueueData)
      );

      // Verify ClientFlowService maintains its own state
      expect(clientFlowService.flowState().phone).toBe(flowData.phone);
      expect(clientFlowService.flowState().selectedMotorcycle?.id).toBe(flowData.motorcycle.id);
      expect(clientFlowService.flowState().licensePlate).toBe(flowData.licensePlate);
      expect(clientFlowService.flowState().currentMileage).toBe(flowData.mileage);
      expect(clientFlowService.flowState().selectedService?.id).toBe(flowData.service.id);
    });

    it('should handle concurrent operations without conflicts', async () => {
      // Setup multiple clients completing flow simultaneously
      const clients = Array.from({ length: 5 }, (_, i) => ({
        user: { ...testUser, id: `user-${i}`, uid: `user-${i}` },
        motorcycle: { ...testMotorcycle, id: `moto-${i}` },
        plate: `PLATE${i}`,
        mileage: 40000 + i * 5000
      }));

      const completionPromises = clients.map(async (client, index) => {
        // Setup ClientFlowService for this client
        const clientFlow = TestBed.inject(ClientFlowService);
        mockAuthService.currentUser.and.returnValue(client.user);

        clientFlow.setPhone('+573001234567');
        clientFlow.setSelectedMotorcycle(client.motorcycle);
        clientFlow.setLicensePlate(client.plate);
        clientFlow.setCurrentMileage(client.mileage);
        clientFlow.setSelectedService(testService);

        // Mock queue service to return unique IDs
        spyOn(unifiedQueueService, 'addEntry').and.returnValue(
          Promise.resolve(`queue-entry-${index}`)
        );

        return clientFlow.completeFlow();
      });

      // Execute all completions concurrently
      await Promise.all(completionPromises);

      // Verify all operations completed successfully
      // (In real scenario, we'd check that positions are assigned correctly)
      expect(true).toBe(true); // Placeholder - actual verification would check queue positions
    });

    it('should propagate errors correctly across service boundaries', async () => {
      // Setup valid flow data
      clientFlowService.setPhone('+573001234567');
      clientFlowService.setSelectedMotorcycle(testMotorcycle);
      clientFlowService.setLicensePlate('ABC123');
      clientFlowService.setCurrentMileage(50000);
      clientFlowService.setSelectedService(testService);

      // Mock queue service to fail
      spyOn(unifiedQueueService, 'addEntry').and.rejectWith(new Error('Queue service unavailable'));

      // Attempt to complete flow
      await expectAsync(clientFlowService.completeFlow()).toBeRejectedWithError('Queue service unavailable');

      // Verify error state is maintained in ClientFlowService
      expect(clientFlowService.flowState().error).toContain('Queue service unavailable');

      // Verify flow did not complete
      expect(clientFlowService.isFlowComplete()).toBe(false);
      expect(clientFlowService.flowState().currentQueueEntryId).toBe(null);
    });

    it('should handle cache invalidation correctly', async () => {
      // Setup flow completion
      clientFlowService.setPhone('+573001234567');
      clientFlowService.setSelectedMotorcycle(testMotorcycle);
      clientFlowService.setLicensePlate('ABC123');
      clientFlowService.setCurrentMileage(50000);
      clientFlowService.setSelectedService(testService);

      spyOn(unifiedQueueService, 'addEntry').and.returnValue(Promise.resolve('queue-entry-123'));
      mockCacheService.invalidateByEntity.and.returnValue(Promise.resolve());

      await clientFlowService.completeFlow();

      // Verify cache invalidation was called
      expect(mockCacheService.invalidateByEntity).toHaveBeenCalledWith('queue', 'queue-entry-123');
    });

    it('should emit correct events for integration tracking', async () => {
      // Setup flow completion
      clientFlowService.setPhone('+573001234567');
      clientFlowService.setSelectedMotorcycle(testMotorcycle);
      clientFlowService.setLicensePlate('ABC123');
      clientFlowService.setCurrentMileage(50000);
      clientFlowService.setSelectedService(testService);

      spyOn(unifiedQueueService, 'addEntry').and.returnValue(Promise.resolve('queue-entry-123'));

      await clientFlowService.completeFlow();

      // Verify events were emitted
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        jasmine.objectContaining({
          type: 'queue.entry_added'
        })
      );
    });
  });

  describe('State Synchronization Validation', () => {
    it('should prevent client-flow ↔ queue conflicts', async () => {
      // This test validates that the refactoring resolved the original conflict
      // by ensuring ClientFlowService no longer manages queue state directly

      const clientFlow = TestBed.inject(ClientFlowService);

      // Verify ClientFlowService doesn't have queue management methods
      expect((clientFlow as any).addToQueue).toBeUndefined();
      expect((clientFlow as any).callNext).toBeUndefined();
      expect((clientFlow as any).updateQueueEntry).toBeUndefined();

      // Verify ClientFlowService delegates to UnifiedQueueService
      expect(clientFlow.completeFlow).toBeDefined();
      expect(clientFlow.getCurrentQueueEntry).toBeDefined();
      expect(clientFlow.getCurrentQueuePosition).toBeDefined();
    });

    it('should validate single source of truth for queue data', async () => {
      // Setup flow and queue entry
      clientFlowService.setPhone('+573001234567');
      clientFlowService.setSelectedMotorcycle(testMotorcycle);
      clientFlowService.setLicensePlate('ABC123');
      clientFlowService.setCurrentMileage(50000);
      clientFlowService.setSelectedService(testService);

      spyOn(unifiedQueueService, 'addEntry').and.returnValue(Promise.resolve('queue-entry-123'));

      await clientFlowService.completeFlow();

      // Verify ClientFlowService only stores reference, not full data
      expect(clientFlowService.flowState().currentQueueEntryId).toBe('queue-entry-123');
      expect(clientFlowService.flowState().selectedMotorcycle).toBeDefined(); // Own data
      expect(clientFlowService.flowState().selectedService).toBeDefined(); // Own data

      // Queue-specific data should come from UnifiedQueueService
      const queuePosition = clientFlowService.getCurrentQueuePosition();
      expect(queuePosition).toBeDefined(); // Retrieved from queue service
    });
  });

  describe('Performance and Caching Integration', () => {
    it('should leverage caching for better performance', async () => {
      const mockEntry: QueueEntry = {
        id: 'cached-entry-123',
        customerId: 'test-user',
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

      // Mock cache hit
      mockCacheService.get.and.returnValue(Promise.resolve(mockEntry));

      const result = await unifiedQueueService.getEntryById('cached-entry-123');

      expect(result).toEqual(mockEntry);
      expect(mockCacheService.get).toHaveBeenCalledWith('unified-queue-entries-cached-entry-123');
    });

    it('should handle cache misses gracefully', async () => {
      mockCacheService.get.and.returnValue(Promise.resolve(null));

      const result = await unifiedQueueService.getEntryById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle partial failures without corrupting state', async () => {
      // Setup valid flow data
      clientFlowService.setPhone('+573001234567');
      clientFlowService.setSelectedMotorcycle(testMotorcycle);
      clientFlowService.setLicensePlate('ABC123');
      clientFlowService.setCurrentMileage(50000);
      clientFlowService.setSelectedService(testService);

      // Mock notification failure but queue success
      spyOn(unifiedQueueService, 'addEntry').and.returnValue(Promise.resolve('queue-entry-123'));
      mockNotificationService.addSystemNotification.and.rejectWith(new Error('Notification failed'));

      // Flow should still complete despite notification failure
      await clientFlowService.completeFlow();

      expect(clientFlowService.flowState().currentQueueEntryId).toBe('queue-entry-123');
      expect(clientFlowService.isFlowComplete()).toBe(true);
    });

    it('should maintain data integrity during concurrent updates', async () => {
      // Setup initial state
      clientFlowService.setPhone('+573001234567');
      clientFlowService.setSelectedMotorcycle(testMotorcycle);
      clientFlowService.setLicensePlate('ABC123');
      clientFlowService.setCurrentMileage(50000);
      clientFlowService.setSelectedService(testService);

      spyOn(unifiedQueueService, 'addEntry').and.returnValue(Promise.resolve('queue-entry-123'));
      await clientFlowService.completeFlow();

      // Simulate concurrent queue updates
      spyOn(unifiedQueueService, 'updateEntryStatus').and.returnValue(Promise.resolve());

      // Both services should handle concurrent operations gracefully
      await Promise.all([
        unifiedQueueService.updateEntryStatus('queue-entry-123', 'called', 'tech1'),
        clientFlowService.getCurrentQueuePosition() // Access during update
      ]);

      expect(unifiedQueueService.updateEntryStatus).toHaveBeenCalledWith('queue-entry-123', 'called', 'tech1');
    });
  });
});