import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { ClientFlowService } from './client-flow.service';
import { AuthService } from './auth.service';
import { QueueService } from './queue.service';
import { MotorcycleService } from './motorcycle.service';
import { AdvancedServiceService } from './advanced-service.service';
import { NotificationService } from './notification.service';
import { ValidationService } from './validation_service';
import { FormCacheService } from './form_cache_service';
import { CacheService } from './cache.service';
import { QueueJoinData, Motorcycle, ServiceItem, User } from '../models';

describe('ClientFlowService', () => {
  let service: ClientFlowService;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockQueueService: jasmine.SpyObj<QueueService>;
  let mockMotorcycleService: jasmine.SpyObj<MotorcycleService>;
  let mockServiceService: jasmine.SpyObj<AdvancedServiceService>;
  let mockNotificationService: jasmine.SpyObj<NotificationService>;
  let mockValidationService: jasmine.SpyObj<ValidationService>;
  let mockFormCacheService: jasmine.SpyObj<FormCacheService>;
  let mockCacheService: jasmine.SpyObj<CacheService>;

  beforeEach(() => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const authSpy = jasmine.createSpyObj('AuthService', ['currentUser']);
    const queueSpy = jasmine.createSpyObj('QueueService', ['addToQueue', 'getQueueEntry']);
    const motorcycleSpy = jasmine.createSpyObj('MotorcycleService', ['getMotorcycles']);
    const serviceSpy = jasmine.createSpyObj('AdvancedServiceService', ['paginatedServices']);
    const notificationSpy = jasmine.createSpyObj('NotificationService', ['addSystemNotification']);
    const validationSpy = jasmine.createSpyObj('ValidationService', ['validatePhone', 'validateLicensePlate', 'validateMileage']);
    const formCacheSpy = jasmine.createSpyObj('FormCacheService', ['recoverFormData', 'startAutoSave', 'stopAutoSave']);
    const cacheSpy = jasmine.createSpyObj('CacheService', ['invalidateByEntity']);

    TestBed.configureTestingModule({
      providers: [
        ClientFlowService,
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: QueueService, useValue: queueSpy },
        { provide: MotorcycleService, useValue: motorcycleSpy },
        { provide: AdvancedServiceService, useValue: serviceSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: ValidationService, useValue: validationSpy },
        { provide: FormCacheService, useValue: formCacheSpy },
        { provide: CacheService, useValue: cacheSpy }
      ]
    });

    service = TestBed.inject(ClientFlowService);
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    mockAuthService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    mockQueueService = TestBed.inject(QueueService) as jasmine.SpyObj<QueueService>;
    mockMotorcycleService = TestBed.inject(MotorcycleService) as jasmine.SpyObj<MotorcycleService>;
    mockServiceService = TestBed.inject(AdvancedServiceService) as jasmine.SpyObj<AdvancedServiceService>;
    mockNotificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    mockValidationService = TestBed.inject(ValidationService) as jasmine.SpyObj<ValidationService>;
    mockFormCacheService = TestBed.inject(FormCacheService) as jasmine.SpyObj<FormCacheService>;
    mockCacheService = TestBed.inject(CacheService) as jasmine.SpyObj<CacheService>;
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      expect(service.getCurrentStep()).toBe('phone');
      expect(service.flowState().currentStep).toBe('phone');
      expect(service.flowState().isAuthenticated).toBeFalsy();
    });

    it('should load cached data on initialization', () => {
      const cachedData = {
        hasRecovery: true,
        canRecover: true,
        data: {
          phone: '+573001234567',
          phoneValidated: true,
          licensePlate: 'ABC123',
          mileage: 50000
        }
      };

      mockFormCacheService.recoverFormData.and.returnValue(cachedData);
      mockAuthService.currentUser.and.returnValue({ id: 'user1', name: 'Test User' } as User);

      // Re-initialize service
      (service as any).initializeFlow();

      expect(mockFormCacheService.recoverFormData).toHaveBeenCalled();
    });
  });

  describe('step navigation', () => {
    beforeEach(() => {
      mockAuthService.currentUser.and.returnValue({ id: 'user1', name: 'Test User' } as User);
    });

    it('should navigate to next step when validation passes', () => {
      // Setup valid phone
      service.setPhone('+573001234567');
      mockValidationService.validatePhone.and.returnValue({ isValid: true });

      service.nextStep();

      expect(service.getCurrentStep()).toBe('motorcycle');
    });

    it('should not navigate when validation fails', () => {
      service.setPhone('invalid');
      mockValidationService.validatePhone.and.returnValue({ isValid: false, message: 'Invalid phone' });

      service.nextStep();

      expect(service.getCurrentStep()).toBe('phone');
    });

    it('should allow navigation to previous steps', () => {
      service.navigateToStep('motorcycle');
      expect(service.canNavigateToStep('phone')).toBe(true);
    });

    it('should prevent navigation to future steps without completion', () => {
      expect(service.canNavigateToStep('service')).toBe(false);
    });
  });

  describe('step validation', () => {
    it('should validate phone step correctly', () => {
      service.setPhone('+573001234567');
      mockValidationService.validatePhone.and.returnValue({ isValid: true });

      const validation = service.validateCurrentStep();
      expect(validation.isValid).toBe(true);
    });

    it('should validate motorcycle step with all required fields', () => {
      const motorcycle: Motorcycle = {
        id: 'moto1',
        brand: 'Yamaha',
        model: 'FZ150',
        year: 2022,
        plate: 'ABC123',
        isActive: true
      };

      service.setSelectedMotorcycle(motorcycle);
      service.setLicensePlate('ABC123');
      service.setCurrentMileage(50000);

      mockValidationService.validateLicensePlate.and.returnValue({ isValid: true });
      mockValidationService.validateMileage.and.returnValue({ isValid: true });

      service.navigateToStep('motorcycle');
      const validation = service.validateCurrentStep();

      expect(validation.isValid).toBe(true);
    });

    it('should reject motorcycle step without motorcycle selection', () => {
      service.navigateToStep('motorcycle');
      const validation = service.validateCurrentStep();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Debe seleccionar una motocicleta');
    });

    it('should validate service step', () => {
      const serviceItem: ServiceItem = {
        id: 'service1',
        title: 'Cambio de Aceite',
        code: 'OIL_CHANGE',
        description: 'Cambio completo de aceite',
        estimatedTime: 30,
        price: 75000
      };

      service.setSelectedService(serviceItem);
      service.navigateToStep('service');

      const validation = service.validateCurrentStep();
      expect(validation.isValid).toBe(true);
    });
  });

  describe('data setters', () => {
    it('should set and validate phone number', () => {
      service.setPhone('+573001234567');
      expect(service.flowState().phone).toBe('+573001234567');
      expect(mockValidationService.validatePhone).toHaveBeenCalledWith('+573001234567');
    });

    it('should set motorcycle and update validation', () => {
      const motorcycle: Motorcycle = {
        id: 'moto1',
        brand: 'Yamaha',
        model: 'FZ150',
        year: 2022,
        plate: 'ABC123',
        isActive: true
      };

      service.setSelectedMotorcycle(motorcycle);
      expect(service.flowState().selectedMotorcycle).toEqual(motorcycle);
      expect(service.flowState().motorcycleValidated).toBe(true);
    });

    it('should set license plate with validation', () => {
      service.setLicensePlate('ABC123');
      expect(service.flowState().licensePlate).toBe('ABC123');
      expect(mockValidationService.validateLicensePlate).toHaveBeenCalledWith('ABC123');
    });

    it('should set mileage with validation', () => {
      service.setCurrentMileage(50000);
      expect(service.flowState().currentMileage).toBe(50000);
      expect(mockValidationService.validateMileage).toHaveBeenCalledWith('50000');
    });

    it('should set service selection', () => {
      const serviceItem: ServiceItem = {
        id: 'service1',
        title: 'Cambio de Aceite',
        code: 'OIL_CHANGE',
        description: 'Cambio completo de aceite',
        estimatedTime: 30,
        price: 75000
      };

      service.setSelectedService(serviceItem);
      expect(service.flowState().selectedService).toEqual(serviceItem);
      expect(service.flowState().serviceValidated).toBe(true);
    });
  });

  describe('completeFlow', () => {
    beforeEach(() => {
      const user: User = { id: 'user1', name: 'Test User', phone: '+573001234567' };
      const motorcycle: Motorcycle = {
        id: 'moto1',
        brand: 'Yamaha',
        model: 'FZ150',
        year: 2022,
        plate: 'ABC123',
        isActive: true
      };
      const serviceItem: ServiceItem = {
        id: 'service1',
        title: 'Cambio de Aceite',
        code: 'OIL_CHANGE',
        description: 'Cambio completo de aceite',
        estimatedTime: 30,
        price: 75000
      };

      mockAuthService.currentUser.and.returnValue(user);
      service.setPhone('+573001234567');
      service.setSelectedMotorcycle(motorcycle);
      service.setLicensePlate('ABC123');
      service.setCurrentMileage(50000);
      service.setSelectedService(serviceItem);

      mockValidationService.validatePhone.and.returnValue({ isValid: true });
      mockValidationService.validateLicensePlate.and.returnValue({ isValid: true });
      mockValidationService.validateMileage.and.returnValue({ isValid: true });
    });

    it('should complete flow successfully', async () => {
      mockQueueService.addToQueue.and.returnValue(Promise.resolve('queue-entry-123'));
      mockQueueService.getQueueEntry.and.returnValue(of({
        id: 'queue-entry-123',
        position: 1,
        verificationCode: '1234'
      }));

      await service.completeFlow();

      expect(mockQueueService.addToQueue).toHaveBeenCalledWith(jasmine.objectContaining({
        customerId: 'user1',
        serviceType: 'direct_work_order',
        motorcycleId: 'moto1',
        plate: 'ABC123',
        mileageKm: 50000
      }));

      expect(service.flowState().currentQueueEntryId).toBe('queue-entry-123');
      expect(service.getCurrentStep()).toBe('ticket');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/client-flow/wait-ticket']);
    });

    it('should handle queue creation failure', async () => {
      mockQueueService.addToQueue.and.rejectWith(new Error('Queue creation failed'));

      await expectAsync(service.completeFlow()).toBeRejectedWithError('Queue creation failed');
      expect(service.flowState().error).toContain('Queue creation failed');
    });

    it('should require authenticated user', async () => {
      mockAuthService.currentUser.and.returnValue(null);

      await expectAsync(service.completeFlow()).toBeRejectedWithError('Usuario no autenticado');
    });
  });

  describe('flow state management', () => {
    it('should calculate progress correctly', () => {
      expect(service.flowState().progress).toBe(25); // Phone step = 25%

      service.navigateToStep('motorcycle');
      expect(service.flowState().progress).toBe(50); // Motorcycle step = 50%

      service.navigateToStep('service');
      expect(service.flowState().progress).toBe(75); // Service step = 75%

      service.navigateToStep('ticket');
      expect(service.flowState().progress).toBe(100); // Ticket step = 100%
    });

    it('should track flow completion', () => {
      expect(service.isFlowComplete()).toBe(false);

      // Set queue entry ID
      (service as any).currentQueueEntryId.set('entry123');
      service.navigateToStep('ticket');

      expect(service.isFlowComplete()).toBe(true);
    });
  });

  describe('cache integration', () => {
    it('should save to cache on completion', async () => {
      const user: User = { id: 'user1', name: 'Test User' };
      mockAuthService.currentUser.and.returnValue(user);
      service.setPhone('+573001234567');

      mockQueueService.addToQueue.and.returnValue(Promise.resolve('entry123'));

      await service.completeFlow();

      expect(mockFormCacheService.startAutoSave).toHaveBeenCalled();
    });

    it('should invalidate queue cache on completion', async () => {
      const user: User = { id: 'user1', name: 'Test User' };
      mockAuthService.currentUser.and.returnValue(user);

      mockQueueService.addToQueue.and.returnValue(Promise.resolve('entry123'));

      await service.completeFlow();

      expect(mockCacheService.invalidateByEntity).toHaveBeenCalledWith('queue', 'entry123');
    });
  });

  describe('reset functionality', () => {
    it('should reset flow to initial state', () => {
      // Set some data
      service.setPhone('+573001234567');
      service.navigateToStep('motorcycle');
      (service as any).currentQueueEntryId.set('entry123');

      service.resetFlow();

      expect(service.getCurrentStep()).toBe('phone');
      expect(service.flowState().phone).toBe('');
      expect(service.flowState().currentQueueEntryId).toBe(null);
      expect(mockFormCacheService.stopAutoSave).toHaveBeenCalled();
    });
  });

  describe('entrance source tracking', () => {
    it('should set entrance source', () => {
      service.setEntranceSource('qr-main-entrance', 'Main Entrance');

      const source = service.getEntranceSource();
      expect(source.source).toBe('qr-main-entrance');
      expect(source.location).toBe('Main Entrance');
    });

    it('should include entrance source in flow state', () => {
      service.setEntranceSource('qr-parking', 'Parking Area');

      expect(service.flowState().entranceSource).toBe('qr-parking');
      expect(service.flowState().entranceLocation).toBe('Parking Area');
    });
  });

  describe('queue state access', () => {
    it('should provide access to current queue entry', () => {
      (service as any).currentQueueEntryId.set('entry123');
      mockQueueService.getQueueEntry.and.returnValue(of({ id: 'entry123', position: 1 }));

      const entryObservable = service.getCurrentQueueEntry();
      expect(entryObservable).toBeDefined();
    });

    it('should return current queue position', () => {
      const mockEntries = [{ id: 'entry123', position: 3 }];
      mockQueueService.getQueueEntries.and.returnValue(signal(mockEntries));
      (service as any).currentQueueEntryId.set('entry123');

      const position = service.getCurrentQueuePosition();
      expect(position).toBe(3);
    });

    it('should return null position when no entry', () => {
      (service as any).currentQueueEntryId.set(null);

      const position = service.getCurrentQueuePosition();
      expect(position).toBe(null);
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      mockAuthService.currentUser.and.throwError('Auth error');

      // Should not crash during initialization
      expect(() => new ClientFlowService()).not.toThrow();
    });

    it('should set error state on validation failures', () => {
      service.setPhone('invalid');
      mockValidationService.validatePhone.and.returnValue({
        isValid: false,
        message: 'Invalid phone format'
      });

      service.nextStep();

      expect(service.flowState().error).toContain('Invalid phone format');
    });

    it('should clear error on successful navigation', () => {
      // Set an error first
      service.setError('Previous error');

      // Navigate successfully
      service.setPhone('+573001234567');
      mockValidationService.validatePhone.and.returnValue({ isValid: true });

      service.nextStep();

      expect(service.flowState().error).toBe(null);
    });
  });
});