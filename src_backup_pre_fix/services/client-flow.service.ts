/**
 * Client Flow Service - State Management for 4-Step Client Interface Flow
 *
 * Manages the complete client onboarding flow state, including:
 * - Current step tracking
 * - Form data persistence
 * - Validation state
 * - Navigation control
 * - Integration with existing services
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { QueueService } from './queue.service';
import { MotorcycleService } from './motorcycle.service';
import { AdvancedServiceService } from './advanced-service.service';
import { NotificationService } from './notification.service';
import { ValidationService } from './validation_service';
import { FormCacheService } from './form_cache_service';
import { CacheService } from './cache.service';
import { QueueJoinData, QueueEntry, Motorcycle, ServiceItem, User } from '../models';

export type ClientFlowStep = 'phone' | 'motorcycle' | 'service' | 'ticket';

export interface ClientFlowState {
  currentStep: ClientFlowStep;
  isAuthenticated: boolean;
  user: User | null;
  phone: string;
  phoneValidated: boolean;
  selectedMotorcycle: Motorcycle | null;
  motorcycleValidated: boolean;
  licensePlate: string;
  licensePlateValidated: boolean;
  currentMileage: number | null;
  mileageValidated: boolean;
  selectedService: ServiceItem | null;
  serviceValidated: boolean;
  currentQueueEntryId: string | null;
  isLoading: boolean;
  error: string | null;
  progress: number;
  // Entrance QR tracking
  entranceSource: string | null;
  entranceLocation: string | null;
}

export interface StepValidation {
  isValid: boolean;
  errors: string[];
  canProceed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ClientFlowService {
  private router = inject(Router);
  private authService = inject(AuthService);
  private queueService = inject(QueueService);
  private motorcycleService = inject(MotorcycleService);
  private serviceService = inject(AdvancedServiceService);
  private notificationService = inject(NotificationService);
  private validationService = inject(ValidationService);
  private formCacheService = inject(FormCacheService);
  private cacheService = inject(CacheService);

  // Flow state signals
  private currentStep = signal<ClientFlowStep>('phone');
  private phone = signal<string>('');
  private phoneValidated = signal<boolean>(false);
  private selectedMotorcycle = signal<Motorcycle | null>(null);
  private motorcycleValidated = signal<boolean>(false);
  private licensePlate = signal<string>('');
  private licensePlateValidated = signal<boolean>(false);
  private currentMileage = signal<number | null>(null);
  private mileageValidated = signal<boolean>(false);
  private selectedService = signal<ServiceItem | null>(null);
  private serviceValidated = signal<boolean>(false);
  private currentQueueEntryId = signal<string | null>(null);
  private isLoading = signal<boolean>(false);
  private error = signal<string | null>(null);
  // Entrance QR tracking
  private entranceSource = signal<string | null>(null);
  private entranceLocation = signal<string | null>(null);

  // Computed state
  readonly flowState = computed<ClientFlowState>(() => ({
    currentStep: this.currentStep(),
    isAuthenticated: !!this.authService.currentUser(),
    user: this.authService.currentUser(),
    phone: this.phone(),
    phoneValidated: this.phoneValidated(),
    selectedMotorcycle: this.selectedMotorcycle(),
    motorcycleValidated: this.motorcycleValidated(),
    licensePlate: this.licensePlate(),
    licensePlateValidated: this.licensePlateValidated(),
    currentMileage: this.currentMileage(),
    mileageValidated: this.mileageValidated(),
    selectedService: this.selectedService(),
    serviceValidated: this.serviceValidated(),
    currentQueueEntryId: this.currentQueueEntryId(),
    isLoading: this.isLoading(),
    error: this.error(),
    progress: this.calculateProgress(),
    entranceSource: this.entranceSource(),
    entranceLocation: this.entranceLocation()
  }));

  readonly canProceedToNext = computed(() => {
    return this.validateCurrentStep().canProceed;
  });

  readonly isFlowComplete = computed(() => {
    return this.currentStep() === 'ticket' && this.currentQueueEntryId() !== null;
  });

  // Available data
  readonly availableMotorcycles = this.motorcycleService.getMotorcycles();
  readonly availableServices = this.serviceService.paginatedServices;

  constructor() {
    this.initializeFlow();
  }

  // ========== INITIALIZATION ==========

  private async initializeFlow(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      // Check authentication
      if (!this.authService.currentUser()) {
        await this.handleAuthenticationRequired();
        return;
      }

      // Load cached data if available
      this.loadCachedData();

      // Pre-fill user data
      await this.prefillUserData();

    } catch (error: any) {
      console.error('Flow initialization error:', error);
      this.error.set('Error al inicializar el flujo. Intente recargar la página.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async handleAuthenticationRequired(): Promise<void> {
    // Redirect to login or show auth prompt
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: '/queue/join' }
    });
  }

  private loadCachedData(): void {
    const cached = this.formCacheService.recoverFormData();
    if (cached.hasRecovery && cached.canRecover && cached.data) {
      const data = cached.data;

      if (data.phone) {
        this.phone.set(data.phone);
        this.phoneValidated.set(data.phoneValidated || false);
      }
      if (data.licensePlate) {
        this.licensePlate.set(data.licensePlate);
        this.licensePlateValidated.set(data.licensePlateValidated || false);
      }
      if (data.mileage !== undefined) {
        this.currentMileage.set(data.mileage);
        this.mileageValidated.set(data.mileageValidated || false);
      }
      if (data.service) {
        // Find service by title/code
        const service = this.availableServices().find(s =>
          s.title === data.service || s.code === data.service
        );
        if (service) {
          this.selectedService.set(service);
          this.serviceValidated.set(true);
        }
      }
    }
  }

  private async prefillUserData(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) return;

    // Pre-fill phone if available and valid
    if (user.phone && this.validationService.validatePhone(user.phone).isValid) {
      this.phone.set(user.phone);
      this.phoneValidated.set(true);
    }
  }

  // ========== STEP MANAGEMENT ==========

  getCurrentStep(): ClientFlowStep {
    return this.currentStep();
  }

  canNavigateToStep(step: ClientFlowStep): boolean {
    const stepOrder: ClientFlowStep[] = ['phone', 'motorcycle', 'service', 'ticket'];
    const currentIndex = stepOrder.indexOf(this.currentStep());
    const targetIndex = stepOrder.indexOf(step);

    // Can only navigate to previous steps or current step
    return targetIndex <= currentIndex;
  }

  navigateToStep(step: ClientFlowStep): void {
    if (this.canNavigateToStep(step)) {
      this.currentStep.set(step);
      this.error.set(null);
    }
  }

  nextStep(): void {
    const validation = this.validateCurrentStep();
    if (!validation.canProceed) {
      this.error.set(validation.errors.join('. '));
      return;
    }

    const stepOrder: ClientFlowStep[] = ['phone', 'motorcycle', 'service', 'ticket'];
    const currentIndex = stepOrder.indexOf(this.currentStep());

    if (currentIndex < stepOrder.length - 1) {
      this.currentStep.set(stepOrder[currentIndex + 1]);
      this.error.set(null);
    }
  }

  previousStep(): void {
    const stepOrder: ClientFlowStep[] = ['phone', 'motorcycle', 'service', 'ticket'];
    const currentIndex = stepOrder.indexOf(this.currentStep());

    if (currentIndex > 0) {
      this.currentStep.set(stepOrder[currentIndex - 1]);
      this.error.set(null);
    }
  }

  // ========== STEP VALIDATION ==========

  validateCurrentStep(): StepValidation {
    const step = this.currentStep();

    switch (step) {
      case 'phone':
        return this.validatePhoneStep();
      case 'motorcycle':
        return this.validateMotorcycleStep();
      case 'service':
        return this.validateServiceStep();
      case 'ticket':
        return this.validateTicketStep();
      default:
        return { isValid: false, errors: ['Paso desconocido'], canProceed: false };
    }
  }

  private validatePhoneStep(): StepValidation {
    const phone = this.phone().trim();
    if (!phone) {
      return { isValid: false, errors: ['El teléfono es requerido'], canProceed: false };
    }

    const validation = this.validationService.validatePhone(phone);
    return {
      isValid: validation.isValid,
      errors: validation.isValid ? [] : [validation.message || 'Teléfono inválido'],
      canProceed: validation.isValid
    };
  }

  private validateMotorcycleStep(): StepValidation {
    const motorcycle = this.selectedMotorcycle();
    const plate = this.licensePlate().trim();
    const mileage = this.currentMileage();

    const errors: string[] = [];

    if (!motorcycle) {
      errors.push('Debe seleccionar una motocicleta');
    }

    if (!plate) {
      errors.push('La placa es requerida');
    } else {
      const plateValidation = this.validationService.validateLicensePlate(plate);
      if (!plateValidation.isValid) {
        errors.push(plateValidation.message || 'Placa inválida');
      }
    }

    if (mileage === null || mileage < 0) {
      errors.push('El kilometraje es requerido');
    } else {
      const mileageValidation = this.validationService.validateMileage(mileage.toString());
      if (!mileageValidation.isValid) {
        errors.push(mileageValidation.message || 'Kilometraje inválido');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      canProceed: errors.length === 0
    };
  }

  private validateServiceStep(): StepValidation {
    const service = this.selectedService();
    if (!service) {
      return { isValid: false, errors: ['Debe seleccionar un servicio'], canProceed: false };
    }

    return { isValid: true, errors: [], canProceed: true };
  }

  private validateTicketStep(): StepValidation {
    const entryId = this.currentQueueEntryId();
    if (!entryId) {
      return { isValid: false, errors: ['No se ha completado el registro en cola'], canProceed: false };
    }

    return { isValid: true, errors: [], canProceed: true };
  }

  // ========== DATA SETTERS ==========

  setPhone(phone: string): void {
    this.phone.set(phone.trim());
    const validation = this.validationService.validatePhone(phone);
    this.phoneValidated.set(validation.isValid);
  }

  setSelectedMotorcycle(motorcycle: Motorcycle | null): void {
    this.selectedMotorcycle.set(motorcycle);
    this.motorcycleValidated.set(motorcycle !== null);
  }

  setLicensePlate(plate: string): void {
    this.licensePlate.set(plate.trim().toUpperCase());
    const validation = this.validationService.validateLicensePlate(plate);
    this.licensePlateValidated.set(validation.isValid);
  }

  setCurrentMileage(mileage: number | null): void {
    this.currentMileage.set(mileage);
    if (mileage !== null) {
      const validation = this.validationService.validateMileage(mileage.toString());
      this.mileageValidated.set(validation.isValid);
    } else {
      this.mileageValidated.set(false);
    }
  }

  setSelectedService(service: ServiceItem | null): void {
    this.selectedService.set(service);
    this.serviceValidated.set(service !== null);
  }

  setError(message: string): void {
    this.error.set(message);
  }

  // ========== FLOW COMPLETION ==========

  async completeFlow(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      const user = this.authService.currentUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Prepare queue data
      const queueData: QueueJoinData = {
        customerId: user.id,
        customerName: user.name,
        customerPhone: this.phone(),
        serviceType: 'direct_work_order',
        motorcycleId: this.selectedMotorcycle()!.id,
        plate: this.licensePlate(),
        mileageKm: this.currentMileage()!,
        notes: `Servicio: ${this.selectedService()!.title}`
      };

      // Delegate queue creation to QueueService with TTL awareness
      const queueEntryId = await this.queueService.addToQueue(queueData);
      if (!queueEntryId) {
        throw new Error('No se pudo crear la entrada en cola');
      }

      // Invalidate related caches after successful queue creation
      this.cacheService.invalidateByEntity('queue', queueEntryId).catch(err =>
        console.error('Queue cache invalidation error:', err)
      );

      // Store only the queue entry ID locally
      this.currentQueueEntryId.set(queueEntryId);

      // Navigate to ticket step
      this.currentStep.set('ticket');

      // Save to cache for recovery
      this.saveToCache();

      // Send success notification - get entry details from QueueService
      const queueEntry = await this.queueService.getQueueEntry(queueEntryId).toPromise();
      if (queueEntry) {
        this.notificationService.addSystemNotification({
          userId: user.id,
          title: '¡Registro exitoso!',
          message: `Te has unido a la cola exitosamente. Tu número de turno es Q${queueEntry.position.toString().padStart(3, '0')}`,
          meta: {
            queueEntryId: queueEntry.id,
            verificationCode: queueEntry.verificationCode
          }
        }).subscribe();
      }

    } catch (error: any) {
      console.error('Flow completion error:', error);
      this.error.set(error.message || 'Error al completar el registro');
    } finally {
      this.isLoading.set(false);
    }
  }

  // ========== UTILITIES ==========

  private calculateProgress(): number {
    const stepOrder: ClientFlowStep[] = ['phone', 'motorcycle', 'service', 'ticket'];
    const currentIndex = stepOrder.indexOf(this.currentStep());
    return Math.round(((currentIndex + 1) / stepOrder.length) * 100);
  }

  private saveToCache(): void {
    this.formCacheService.startAutoSave(() => ({
      phone: this.phone(),
      phoneValidated: this.phoneValidated(),
      motorcycleId: this.selectedMotorcycle()?.id,
      motorcycleValidated: this.motorcycleValidated(),
      licensePlate: this.licensePlate(),
      licensePlateValidated: this.licensePlateValidated(),
      mileage: this.currentMileage() ?? undefined,
      mileageValidated: this.mileageValidated(),
      service: this.selectedService()?.title,
      serviceValidated: this.serviceValidated(),
      currentStep: this.currentStep()
    }));
  }

  setEntranceSource(source: string, location?: string): void {
    this.entranceSource.set(source);
    this.entranceLocation.set(location || null);
    console.log('🎯 ClientFlowService: Entrance source set', { source, location });
  }

  getEntranceSource(): { source: string | null; location: string | null } {
    return {
      source: this.entranceSource(),
      location: this.entranceLocation()
    };
  }

  resetFlow(): void {
    this.currentStep.set('phone');
    this.phone.set('');
    this.phoneValidated.set(false);
    this.selectedMotorcycle.set(null);
    this.motorcycleValidated.set(false);
    this.licensePlate.set('');
    this.licensePlateValidated.set(false);
    this.currentMileage.set(null);
    this.mileageValidated.set(false);
    this.selectedService.set(null);
    this.serviceValidated.set(false);
    this.currentQueueEntryId.set(null);
    this.error.set(null);
    this.entranceSource.set(null);
    this.entranceLocation.set(null);
    this.formCacheService.stopAutoSave();
  }

  // ========== GETTERS FOR TEMPLATES ==========

  getStepTitle(step: ClientFlowStep): string {
    const titles = {
      phone: 'Verificación de Teléfono',
      motorcycle: 'Selección de Motocicleta',
      service: 'Selección de Servicio',
      ticket: 'Tu Turno en Cola'
    };
    return titles[step];
  }

  getStepDescription(step: ClientFlowStep): string {
    const descriptions = {
      phone: 'Necesitamos tu número de teléfono para notificarte cuando sea tu turno',
      motorcycle: 'Selecciona la motocicleta que necesita servicio',
      service: 'Elige el servicio que requieres para tu motocicleta',
      ticket: '¡Ya estás en la cola! Aquí tienes tu información de turno'
    };
    return descriptions[step];
  }

  // ========== QUEUE STATE ACCESS ==========

  /**
   * Get current queue entry from QueueService by ID
   */
  getCurrentQueueEntry() {
    const entryId = this.currentQueueEntryId();
    if (!entryId) return null;
    return this.queueService.getQueueEntry(entryId);
  }

  /**
   * Get queue position for current entry
   */
  getCurrentQueuePosition(): number | null {
    const entryId = this.currentQueueEntryId();
    if (!entryId) return null;

    const entries = this.queueService.getQueueEntries()();
    const entry = entries.find(e => e.id === entryId);
    return entry ? entry.position : null;
  }
}