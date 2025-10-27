/**
 * Queue Join Component - Enhanced Walk-in Flow
 * Implements improved flow with service integration, validation, analytics, and cache
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs/operators';
import { QueueService } from '../../../services/queue.service';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { MotorcycleService } from '../../../services/motorcycle.service';
import { AdvancedServiceService } from '../../../services/advanced-service.service';
import { NotificationService } from '../../../services/notification.service';
import { UserVehicleService } from '../../../services/user-vehicle.service';
import { QueueSessionService, QueueSession } from '../../../services/queue-session.service';
import { ValidationService } from '../../../services/validation_service';
import { QueueAnalyticsService } from '../../../services/queue_analytics_service';
import { FormCacheService } from '../../../services/form_cache_service';
import { GroqService } from '../../../services/groq.service';
import { AIAssistantService } from '../../../services/ai-assistant.service';
import { QueueEntry, User, Motorcycle } from '../../../models';
import { auth } from '../../../firebase.config';
import { User as FirebaseUser } from 'firebase/auth';

interface ChatMessage {
  id: string;
  type: 'ai' | 'user' | 'system';
  content: string;
  timestamp: Date;
  options?: string[];
  data?: any;
  isError?: boolean;
  isSuccess?: boolean;
  isProgress?: boolean;
}

type OnboardingStep =
  | 'welcome'
  | 'phone'
  | 'motorcycle_check'
  | 'service'
  | 'motorcycle'
  | 'license_plate'
  | 'mileage'
  | 'confirm'
  | 'complete';

interface StepConfig {
  name: OnboardingStep;
  title: string;
  order: number;
  required: boolean;
}

@Component({
  selector: 'app-queue-join',
  templateUrl: './queue-join.component.html',
  styleUrls: ['./queue-join.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CommonModule],
})
export class QueueJoinComponent implements OnInit, OnDestroy, AfterViewChecked {
  // ========== SERVICES ==========
  private queueService = inject(QueueService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private motorcycleService = inject(MotorcycleService);
  private advancedServiceService = inject(AdvancedServiceService);
  private notificationService = inject(NotificationService);
  private userVehicleService = inject(UserVehicleService);
  private queueSessionService = inject(QueueSessionService);
  private validationService = inject(ValidationService);
  private analyticsService = inject(QueueAnalyticsService);
  private cacheService = inject(FormCacheService);
  private groqService = inject(GroqService);
  private aiAssistantService = inject(AIAssistantService);
  private router = inject(Router);

  // ========== STEP CONFIGURATION ==========
  private readonly STEPS: StepConfig[] = [
    { name: 'welcome', title: 'Bienvenida', order: 0, required: true },
    { name: 'phone', title: 'Teléfono', order: 1, required: true },
    { name: 'motorcycle_check', title: 'Verificar Moto', order: 2, required: true },
    { name: 'service', title: 'Servicio', order: 3, required: true },
    { name: 'motorcycle', title: 'Motocicleta', order: 4, required: false }, // Optional if already has one
    { name: 'license_plate', title: 'Placa', order: 5, required: false }, // Optional if already has one
    { name: 'mileage', title: 'Kilometraje', order: 6, required: false },
    { name: 'confirm', title: 'Confirmación', order: 7, required: true },
    { name: 'complete', title: 'Completado', order: 8, required: true }
  ];

  // ========== PROGRESS TRACKING ==========
  currentStepIndex = computed(() => {
    const step = this.currentStep();
    return this.STEPS.findIndex(s => s.name === step);
  });

  progressPercentage = computed(() => {
    const index = this.currentStepIndex();
    const total = this.STEPS.length - 1; // Exclude 'complete'
    return Math.round((index / total) * 100);
  });

  totalSteps = computed(() => this.STEPS.length - 1); // Exclude 'complete'

  // ========== COMPONENT STATE ==========
  currentUser = this.authService.currentUser;
  isAuthenticated = computed(() => !!this.currentUser());
  isAuthenticating = signal(false);
  authenticationError = signal<string | null>(null);
  isLoadingUserData = signal(true);
  loadingError = signal<string | null>(null);
  isRetrying = signal(false);

  // ViewChild for auto-scroll
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  // Session and navigation protection
  private navigationSubscription: any;
  private hasStartedOnboarding = false;
  private isFlowCompleted = false;
  private currentSession: QueueSession | null = null;

  // User vehicles - CRITICAL for checking existing motorcycles
  private userAssignedMotorcycles = signal<any[]>([]);
  private userVehiclesLoaded = signal(false);
  private hasExistingMotorcycle = computed(() => this.userAssignedMotorcycles().length > 0);

  // Chat state
  chatMessages = signal<ChatMessage[]>([]);
  currentStep = signal<OnboardingStep>('welcome');
  isAIThinking = signal(false);
  userInput = signal('');
  showChatInput = signal(true);

  // AI Conversation state
  conversationContext = signal<any>({
    collectedData: {},
    currentIntent: null,
    conversationHistory: [],
    isComplete: false
  });
  aiConversationActive = signal(false);

  // Collected data with validation
  userPhone = signal<string>('');
  phoneValidated = signal(false);
  selectedService = signal<string>('');
  serviceValidated = signal(false);
  selectedMotorcycle = signal<Motorcycle | null>(null);
  motorcycleValidated = signal(false);
  licensePlate = signal<string>('');
  licensePlateValidated = signal(false);
  currentMileage = signal<number | null>(null);
  mileageValidated = signal(false);

  // Motorcycle search functionality
  motorcycleSearchQuery = signal<string>('');
  filteredMotorcycles = computed(() => {
    const query = this.motorcycleSearchQuery().toLowerCase().trim();
    const allMotorcycles = this.availableMotorcycles();

    if (!query) {
      // Show user's motorcycles first, then all others
      const userMotorcycles = this.userAssignedMotorcycles().map(vehicle =>
        allMotorcycles.find(m => m.id === vehicle.baseVehicleId)
      ).filter(m => m !== undefined);

      const otherMotorcycles = allMotorcycles.filter(m =>
        !userMotorcycles.some(userMoto => userMoto.id === m.id)
      );

      return [...userMotorcycles, ...otherMotorcycles];
    }

    // Filter by search query
    return allMotorcycles.filter(motorcycle =>
      motorcycle.brand.toLowerCase().includes(query) ||
      motorcycle.model.toLowerCase().includes(query) ||
      motorcycle.year.toString().includes(query) ||
      `${motorcycle.brand} ${motorcycle.model}`.toLowerCase().includes(query)
    );
  });

  showMotorcycleSearch = signal(false);

  // Final result
  queueEntry = signal<QueueEntry | null>(null);
  ticketNumber = signal<string>('');

  // Available options (cached)
  availableServices = computed(() => {
    const services = this.advancedServiceService.paginatedServices();
    return services.map(s => s.title || s.code || 'Servicio sin nombre');
  });

  availableMotorcycles = computed(() => {
    return this.motorcycleService.getMotorcycles()();
  });

  // Chat visibility
  showChatInterface = computed(() => {
    const user = this.currentUser();
    const isFullyAuthenticated = this.isAuthenticated() &&
                                  user &&
                                  user.name &&
                                  user.name !== 'undefined' &&
                                  user.name.trim() !== '';
    return isFullyAuthenticated &&
           !this.queueEntry() &&
           !this.isLoadingUserData() &&
           this.hasStartedOnboarding;
  });

  // ========== CONSTRUCTOR ==========
  constructor() {
    this.setupNavigationGuards();
  }

  // ========== LIFECYCLE METHODS ==========
  async ngOnInit() {
    console.log('🚀 QueueJoin Component: Initializing...');
    await this.initializeComponent();
    console.log('✅ QueueJoin Component: Initialized successfully');
  }

  ngOnDestroy() {
    // Track abandonment if flow not completed
    if (this.hasStartedOnboarding && !this.isFlowCompleted) {
      this.analyticsService.endSession('abandoned');
    }

    // Stop auto-save
    this.cacheService.stopAutoSave();

    // Clean up navigation subscription
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  // ========== INITIALIZATION ==========
  private async initializeComponent() {
    try {
      console.log('🔄 QueueJoin: Starting initialization');

      this.loadingError.set(null);

      const loadingTimeout = setTimeout(() => {
        if (this.isLoadingUserData()) {
          console.warn('⏱️ Loading timeout');
          this.isLoadingUserData.set(false);
          this.loadingError.set('La carga tardó mucho. Intenta recargar.');
        }
      }, 30000);

      if (this.isAuthenticated()) {
        console.log('🔄 User authenticated, loading complete data');
        this.isLoadingUserData.set(true);

        await this.loadCompleteUserData();

        clearTimeout(loadingTimeout);

        // Start analytics session
        const sessionId = this.analyticsService.startSession(this.currentUser()?.id);

        // Create queue session
        this.currentSession = this.queueSessionService.createSession();
        if (this.currentSession && this.currentUser()) {
          this.currentSession.userId = this.currentUser()!.id;
        }

        this.isLoadingUserData.set(false);

        // Try to recover cached form data
        this.recoverCachedData();

        await this.startImprovedOnboarding();
      } else {
        console.log('🔄 User not authenticated');
        clearTimeout(loadingTimeout);
        this.isLoadingUserData.set(false);
      }
    } catch (error: any) {
      console.error('❌ Initialization error:', error);
      this.isLoadingUserData.set(false);
      this.loadingError.set('Error al cargar. Intenta de nuevo.');
    }
  }

  private async loadCompleteUserData(): Promise<void> {
    await this.waitForUserProfile();
    await this.waitForServicesLoaded();
    await this.loadUserAssignedMotorcycles();
    console.log('✅ Complete user data loaded');
  }

  private async waitForUserProfile(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        const user = this.currentUser();
        if (user?.name && user.name !== 'undefined' && user.name.trim() && user.email && user.id) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  private async waitForServicesLoaded(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        const uvLoaded = !this.userVehicleService.isDataLoading();
        const maLoaded = true; // Motorcycle assignment service removed
        if (uvLoaded && maLoaded) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  private async loadUserAssignedMotorcycles() {
    try {
      const user = this.currentUser();
      if (!user) return;

      if (this.userVehicleService.isDataLoading()) {
        await new Promise(resolve => {
          const check = () => {
            if (!this.userVehicleService.isDataLoading()) {
              resolve(void 0);
            } else {
              setTimeout(check, 100);
            }
          };
          check();
        });
      }

      const userVehicles = await this.userVehicleService.getVehiclesForUser(user.id).toPromise();
      this.userAssignedMotorcycles.set(userVehicles || []);
      this.userVehiclesLoaded.set(true);

      console.log('✅ User vehicles loaded:', userVehicles?.length || 0);
    } catch (error) {
      console.error('❌ Error loading motorcycles:', error);
      this.userAssignedMotorcycles.set([]);
      this.userVehiclesLoaded.set(true);
    }
  }

  // ========== CACHE INTEGRATION ==========
  private recoverCachedData() {
    const recovery = this.cacheService.recoverFormData();

    if (recovery.hasRecovery && recovery.canRecover) {
      const data = recovery.data;

      // Recover form data
      if (data && data.phone) {
        this.userPhone.set(data.phone);
        this.phoneValidated.set(data.phoneValidated || false);
      }
      if (data && data.service) {
        this.selectedService.set(data.service);
        this.serviceValidated.set(data.serviceValidated || false);
      }
      if (data && data.licensePlate) {
        this.licensePlate.set(data.licensePlate);
        this.licensePlateValidated.set(data.licensePlateValidated || false);
      }
      if (data && data.mileage !== undefined) {
        this.currentMileage.set(data.mileage);
        this.mileageValidated.set(data.mileageValidated || false);
      }

      // Show recovery message
      this.addMessage('system',
        `💾 Recuperé tu progreso anterior (${recovery.age} ago). Continuemos donde lo dejaste.`,
        [],
        { isSuccess: true }
      );

      console.log('✅ Form data recovered from cache');
    }
  }

  private startAutoSave() {
    this.cacheService.startAutoSave(() => ({
      phone: this.userPhone(),
      phoneValidated: this.phoneValidated(),
      service: this.selectedService(),
      serviceValidated: this.serviceValidated(),
      motorcycleId: this.selectedMotorcycle()?.id,
      motorcycleValidated: this.motorcycleValidated(),
      licensePlate: this.licensePlate(),
      licensePlateValidated: this.licensePlateValidated(),
      mileage: this.currentMileage() ?? undefined,
      mileageValidated: this.mileageValidated(),
      currentStep: this.currentStep()
    }));
  }

  // ========== AI CONVERSATION ONBOARDING ==========
  private async startImprovedOnboarding() {
    try {
      console.log('🤖 Starting AI conversation onboarding');

      const user = this.currentUser();
      if (!user?.name || user.name === 'undefined' || !user.name.trim()) {
        console.log('⏳ User data incomplete');
        return;
      }

      this.hasStartedOnboarding = true;
      this.showChatInput.set(true);
      this.aiConversationActive.set(true);

      // Start auto-save
      this.startAutoSave();

      // Initialize conversation context
      this.conversationContext.set({
        collectedData: {},
        currentIntent: 'welcome',
        conversationHistory: [],
        isComplete: false
      });

      // Welcome message with AI
      await this.addMessage('ai',
        `¡Hola ${user.name}! 👋\n\nSoy tu asistente inteligente de Blue Dragon Motors. Te ayudaré a unirte a la cola de servicio de manera natural y sencilla.\n\n¿En qué puedo ayudarte hoy? Puedes decirme qué servicio necesitas o preguntarme cualquier cosa sobre el proceso.`,
        [],
        { isSuccess: true }
      );

      // Pre-fill known data
      await this.prefillKnownData();

    } catch (error) {
      console.error('❌ Onboarding error:', error);
      await this.addMessage('system',
        '❌ Error al iniciar. Recarga la página o contacta al personal.',
        [],
        { isError: true }
      );
      this.showChatInput.set(false);
      this.aiConversationActive.set(false);
    }
  }

  private async prefillKnownData() {
    const user = this.currentUser();
    if (!user) return;

    const prefilled: string[] = [];

    // Check phone
    if (user.phone && this.validationService.validatePhone(user.phone).isValid) {
      this.userPhone.set(user.phone);
      this.phoneValidated.set(true);
      prefilled.push(`📱 Teléfono: ${this.validationService.formatPhone(user.phone)}`);
    }

    // Check motorcycles - CRITICAL CHECK
    const motorcycles = this.userAssignedMotorcycles();
    if (motorcycles.length > 0) {
      prefilled.push(`🏍️ Tienes ${motorcycles.length} motocicleta(s) registrada(s)`);

      // Pre-select first motorcycle
      const firstVehicle = motorcycles[0];
      const motorcycle = this.availableMotorcycles().find(m => m.id === firstVehicle.baseVehicleId);

      if (motorcycle) {
        this.selectedMotorcycle.set(motorcycle);
        this.motorcycleValidated.set(true);
        this.licensePlate.set(firstVehicle.plate);
        this.licensePlateValidated.set(true);
        this.currentMileage.set(firstVehicle.mileageKm || 0);
        this.mileageValidated.set(true);
      }
    }

    if (prefilled.length > 0) {
      await this.addMessage('ai',
        `✅ Información encontrada:\n\n${prefilled.join('\n')}\n\nUsaremos estos datos para agilizar el proceso.`,
        [],
        { isSuccess: true }
      );
    }
  }

  // ========== STEP HANDLERS ==========
  private async askForPhone() {
    this.currentStep.set('phone');
    this.analyticsService.startStep('phone');

    if (this.phoneValidated()) {
      await this.showProgress();
      await this.checkMotorcycleStatus();
      return;
    }

    const user = this.currentUser();
    if (user?.phone) {
      await this.addMessage('ai',
        `📱 Tengo: ${this.validationService.formatPhone(user.phone)}\n\n¿Es correcto?`,
        ['✅ Sí, correcto', '✏️ No, cambiar']
      );
    } else {
      await this.addMessage('ai',
        `📱 **Paso 1: Teléfono**\n\nNecesito tu celular para notificaciones.\n\n📌 Formato: 10 dígitos con 3\n💡 Ejemplo: 3123456789`,
        [],
        { inputType: 'phone' }
      );
    }
  }

  private async checkMotorcycleStatus() {
    console.log('🔍 QueueJoin: Starting motorcycle check step');
    this.currentStep.set('motorcycle_check');
    this.analyticsService.startStep('motorcycle_check');

    await this.addMessage('system', '🔍 Verificando tus motocicletas...', [], { isProgress: true });

    // Wait for vehicles to load if not loaded
    if (!this.userVehiclesLoaded()) {
      await this.loadUserAssignedMotorcycles();
    }

    const hasMotorcycle = this.hasExistingMotorcycle();

    if (hasMotorcycle) {
      const motorcycles = this.userAssignedMotorcycles();
      await this.addSuccessMessage(`✅ Encontré ${motorcycles.length} motocicleta(s) tuya(s)`);
    }

    // Always show motorcycle search interface
    console.log('🔍 QueueJoin: Activating motorcycle search interface');
    this.showMotorcycleSearch.set(true);
    await this.addMessage('ai',
      '🏍️ **Paso 2: Selecciona tu motocicleta**\n\nBusca tu motocicleta por marca, modelo o año. Si no encuentras la tuya, puedes agregarla después.',
      [],
      { inputType: 'motorcycle_search' }
    );
  }

  private async askForService() {
    this.currentStep.set('service');
    this.analyticsService.startStep('service');

    const services = this.availableServices();

    if (services.length === 0) {
      await this.addErrorMessage('No hay servicios disponibles. Contacta al taller.');
      return;
    }

    await this.addMessage('ai',
      `🔧 **Servicio**\n\n¿Qué servicio necesitas?`,
      services.slice(0, 6)
    );
  }

  // ========== VALIDATION METHODS ==========
  private async processPhoneResponse(response: string) {
    const user = this.currentUser();
    if (!user) {
      await this.handleError(new Error('Usuario no encontrado'), 'Phone');
      return;
    }

    const trimmed = response.trim().toLowerCase();

    // Handle confirmation
    if (user.phone && (trimmed.includes('sí') || trimmed.includes('correcto') || trimmed.includes('si'))) {
      const validation = this.validationService.validatePhone(user.phone);
      if (validation.isValid) {
        this.userPhone.set(user.phone);
        this.phoneValidated.set(true);
        await this.addSuccessMessage(`✅ Teléfono: ${this.validationService.formatPhone(user.phone)}`);
        this.analyticsService.completeStep('phone');
        await this.showProgress();
        await this.checkMotorcycleStatus();
        return;
      }
    }

    // Handle change
    if (user.phone && (trimmed.includes('no') || trimmed.includes('cambiar'))) {
      await this.addMessage('ai', '✏️ Ingresa tu nuevo número:', [], { inputType: 'phone' });
      return;
    }

    // Validate new phone
    const validation = this.validationService.validatePhone(response);

    if (!validation.isValid) {
      await this.addErrorMessage(validation.message!);
      if (validation.suggestions) {
        await this.addMessage('ai', `💡 ${validation.suggestions.join('\n')}`);
      }
      return;
    }

    // Save phone
    try {
      const clean = this.validationService.formatPhone(response);
      await this.userService.updateUser({ id: user.id, phone: clean }).toPromise();

      this.userPhone.set(clean);
      this.phoneValidated.set(true);

      await this.addSuccessMessage(`✅ Teléfono: ${clean}`);
      this.analyticsService.completeStep('phone');
      await this.showProgress();
      await this.checkMotorcycleStatus();
    } catch (error) {
      await this.handleError(error, 'Guardando teléfono');
    }
  }

  private async processServiceResponse(response: string) {
    const validation = this.validationService.validateService(response, this.advancedServiceService.paginatedServices());

    if (!validation.isValid) {
      await this.addErrorMessage(validation.message!);
      if (validation.suggestions) {
        await this.addMessage('ai',
          `💡 Servicios disponibles:\n${validation.suggestions.join('\n')}`,
          validation.suggestions
        );
      }
      return;
    }

    this.selectedService.set(validation.data);
    this.serviceValidated.set(true);

    await this.addSuccessMessage(`✅ Servicio: ${validation.data}`);
    this.analyticsService.completeStep('service');
    await this.showProgress();

    // Continue based on motorcycle status
    if (this.hasExistingMotorcycle()) {
      await this.checkMotorcycleStatus();
    } else {
      await this.askForMotorcycle();
    }
  }

  private async processMotorcycleSelection(motorcycleId: string) {
    const motorcycle = this.availableMotorcycles().find(m => m.id === motorcycleId);

    if (!motorcycle) {
      await this.addErrorMessage('Error al seleccionar la motocicleta. Intenta de nuevo.');
      return;
    }

    // Check if this is a user's assigned motorcycle
    const userVehicle = this.userAssignedMotorcycles().find(v => v.baseVehicleId === motorcycleId);

    this.selectedMotorcycle.set(motorcycle);
    this.motorcycleValidated.set(true);

    if (userVehicle) {
      // User has this motorcycle assigned, use existing data
      this.licensePlate.set(userVehicle.plate);
      this.licensePlateValidated.set(true);
      this.currentMileage.set(userVehicle.mileageKm || 0);
      this.mileageValidated.set(true);

      await this.addSuccessMessage(`✅ Motocicleta: ${motorcycle.brand} ${motorcycle.model}`);
      await this.addSuccessMessage(`✅ Placa: ${userVehicle.plate}`);
      await this.addSuccessMessage(`✅ Kilometraje: ${this.validationService.formatMileage(userVehicle.mileageKm || 0)}`);
    } else {
      // New motorcycle, need to collect additional info
      await this.addSuccessMessage(`✅ Motocicleta: ${motorcycle.brand} ${motorcycle.model}`);
      await this.askForLicensePlate();
      return;
    }

    this.analyticsService.completeStep('motorcycle_check');
    await this.showProgress();
    await this.confirmAndJoinQueue();
  }

  private async handleMotorcycleSearchSelection(motorcycleId: string) {
    await this.processMotorcycleSelection(motorcycleId);
  }

  private async handleAddNewMotorcycle() {
    this.showMotorcycleSearch.set(false);
    await this.askForMotorcycle();
  }

  private async processMotorcycleDescription(response: string) {
    // For now, just store the description and continue
    // In a real implementation, this would need to match against available motorcycles
    await this.addSuccessMessage(`✅ Descripción: ${response}`);
    this.analyticsService.completeStep('motorcycle');
    await this.showProgress();
    await this.askForLicensePlate();
  }

  private async processLicensePlate(response: string) {
    const validation = this.validationService.validateLicensePlate(response);

    if (!validation.isValid) {
      await this.addErrorMessage(validation.message!);
      return;
    }

    this.licensePlate.set(validation.data);
    this.licensePlateValidated.set(true);

    await this.addSuccessMessage(`✅ Placa: ${validation.data}`);
    this.analyticsService.completeStep('license_plate');
    await this.showProgress();
    await this.askForMileage();
  }

  private async processMileage(response: string) {
    const validation = this.validationService.validateMileage(response);

    if (!validation.isValid) {
      await this.addErrorMessage(validation.message!);
      return;
    }

    this.currentMileage.set(validation.data);
    this.mileageValidated.set(true);

    await this.addSuccessMessage(`✅ Kilometraje: ${this.validationService.formatMileage(validation.data)}`);
    this.analyticsService.completeStep('mileage');
    await this.showProgress();
    await this.confirmAndJoinQueue();
  }

  private async processConfirmation(response: string) {
    if (this.aiConversationActive()) {
      // AI conversation confirmation
      if (response.includes('Sí') || response.includes('confirmar') || response.includes('si')) {
        await this.joinQueue();
      } else if (response.includes('No') || response.includes('cambiar') || response.includes('no')) {
        // Reset conversation context and start over
        this.conversationContext.set({
          collectedData: {},
          currentIntent: 'welcome',
          conversationHistory: [],
          isComplete: false
        });
        this.selectedService.set('');
        this.serviceValidated.set(false);
        this.selectedMotorcycle.set(null);
        this.motorcycleValidated.set(false);
        this.licensePlate.set('');
        this.licensePlateValidated.set(false);
        this.currentMileage.set(null);
        this.mileageValidated.set(false);

        await this.addMessage('ai', 'Entendido, empecemos de nuevo. ¿Qué servicio necesitas?', this.availableServices().slice(0, 6));
      } else {
        await this.addMessage('ai', 'Por favor, confirma si la información es correcta o si quieres cambiar algo.', ['✅ Sí, confirmar y unirme', '✏️ No, quiero cambiar algo']);
      }
    } else {
      // Legacy confirmation
      if (response.includes('Sí') || response.includes('confirmar') || response.includes('si')) {
        await this.joinQueue();
      } else if (response.includes('No') || response.includes('cambiar') || response.includes('no')) {
        // Reset to service selection
        this.currentStep.set('service');
        this.selectedService.set('');
        this.serviceValidated.set(false);
        await this.askForService();
      } else {
        await this.addMessage('ai', 'Por favor, confirma si la información es correcta o si quieres cambiar algo.', ['✅ Sí, confirmar y unirme', '✏️ No, quiero cambiar algo']);
      }
    }
  }

  private async joinQueue() {
    try {
      this.currentStep.set('complete');
      this.analyticsService.startStep('complete');

      const user = this.currentUser();
      if (!user) {
        await this.handleError(new Error('Usuario no encontrado'), 'Unirse a cola');
        return;
      }

      // Prepare queue data
      const queueData = {
        customerId: user.id,
        serviceType: 'direct_work_order' as const,
        motorcycleId: this.selectedMotorcycle()?.id || '',
        plate: this.licensePlate(),
        mileageKm: this.currentMileage() || 0,
        notes: `Servicio: ${this.selectedService()}${this.selectedMotorcycle() ? ` - Moto: ${this.selectedMotorcycle()?.brand} ${this.selectedMotorcycle()?.model}` : ''}`
      };

      await this.addMessage('system', '⏳ Uniéndote a la cola...', [], { isProgress: true });

      // Save motorcycle assignment first
      await this.saveMotorcycleAssignment(user);

      // Join queue
      const queueEntryId = await this.queueService.addToQueue(queueData);

      // Get the created queue entry
      const queueEntry = await this.queueService.getQueueEntry(queueEntryId).toPromise();

      if (queueEntry) {
        this.queueEntry.set(queueEntry);
        this.ticketNumber.set(`Q${queueEntry.position.toString().padStart(3, '0')}`);

        await this.addSuccessMessage('✅ ¡Te has unido exitosamente a la cola!');
        await this.addMessage('ai',
          `🎫 **Tu número de turno: ${this.ticketNumber()}**\n\n📱 Código de verificación: **${queueEntry.verificationCode}**\n\n⏰ Tiempo estimado de espera: ${queueEntry.estimatedWaitTime ? Math.ceil(queueEntry.estimatedWaitTime / 60) : 'No disponible'} minutos\n\n📍 Presenta este código cuando te llamen. Puedes descargar el código QR abajo.`,
          [],
          { isSuccess: true }
        );

        this.isFlowCompleted = true;
        this.analyticsService.completeStep('complete');
        this.analyticsService.endSession('completed');

        // Stop auto-save since flow is complete
        this.cacheService.stopAutoSave();
      } else {
        await this.handleError(new Error('No se pudo crear la entrada en cola'), 'Unirse a cola');
      }

    } catch (error) {
      await this.handleError(error, 'Unirse a cola');
    }
  }

  private async saveMotorcycleAssignment(user: any) {
    try {
      const motorcycle = this.selectedMotorcycle();
      if (!motorcycle) {
        console.log('No motorcycle selected, skipping assignment');
        return;
      }

      // Motorcycle assignment is now handled by the queue service
      // No need to check or create assignments here

      console.log('✅ Motorcycle assignment handled by queue service');
      await this.addSuccessMessage(`✅ Motocicleta ${motorcycle.brand} ${motorcycle.model} asignada a tu cuenta`);

    } catch (error) {
      console.error('❌ Error saving motorcycle assignment:', error);
      // Don't fail the entire flow for assignment errors, just log and continue
      await this.addMessage('system',
        '⚠️ No se pudo guardar la asignación de motocicleta, pero puedes continuar.',
        [],
        { isError: false }
      );
    }
  }

  private async askForMotorcycle() {
    this.currentStep.set('motorcycle');
    this.analyticsService.startStep('motorcycle');

    await this.addMessage('ai',
      '🏍️ Describe tu motocicleta (marca, modelo, año aproximado):',
      [],
      { inputType: 'motorcycle_text' }
    );
  }

  private async askForLicensePlate() {
    this.currentStep.set('license_plate');
    this.analyticsService.startStep('license_plate');

    await this.addMessage('ai',
      '🔢 ¿Cuál es la placa? (ej: ABC123, XYZ45, AAA00A):',
      [],
      { inputType: 'license_plate' }
    );
  }

  private async askForMileage() {
    this.currentStep.set('mileage');
    this.analyticsService.startStep('mileage');

    await this.addMessage('ai',
      '📊 ¿Cuántos kilómetros tiene? (solo números):',
      [],
      { inputType: 'mileage' }
    );
  }

  private async confirmAndJoinQueue() {
    this.currentStep.set('confirm');
    this.analyticsService.startStep('confirm');

    const phone = this.userPhone();
    const service = this.selectedService();
    const motorcycle = this.selectedMotorcycle();
    const licensePlate = this.licensePlate();
    const mileage = this.currentMileage();

    const summary = `
📋 Resumen de tu solicitud:
📱 Teléfono: ${this.validationService.formatPhone(phone)}
🔧 Servicio: ${service}
🏍️ Motocicleta: ${motorcycle ? `${motorcycle.brand} ${motorcycle.model} ${motorcycle.year}` : 'No especificada'}
${licensePlate ? `🔢 Placa: ${licensePlate}` : ''}
${mileage !== null ? `📊 Kilometraje: ${this.validationService.formatMileage(mileage)}` : ''}

¿Confirmas que la información es correcta?
    `.trim();

    await this.addMessage('ai', summary, ['✅ Sí, confirmar y unirme', '✏️ No, quiero cambiar algo']);
  }

  // ========== UTILITY METHODS ==========
  private async showProgress() {
    const progress = this.progressPercentage();
    await this.addMessage('system',
      `📊 Progreso: ${progress}%`,
      [],
      { isProgress: true, isSuccess: true }
    );
  }

  private async addSuccessMessage(content: string) {
    await this.addMessage('system', content, [], { isSuccess: true });
  }

  private async addErrorMessage(content: string) {
    await this.addMessage('system', content, [], { isError: true });
  }

  private async addMessage(
    type: 'ai' | 'user' | 'system',
    content: string,
    options: string[] = [],
    data?: any
  ) {
    const message: ChatMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      options: options.length > 0 ? options : undefined,
      data,
      isError: data?.isError || false,
      isSuccess: data?.isSuccess || false,
      isProgress: data?.isProgress || false
    };

    this.chatMessages.update(msgs => [...msgs, message]);
    this.scrollToBottom();
  }

  private async handleError(error: any, context: string): Promise<void> {
    console.error(`❌ ${context}:`, error);

    let errorMessage = '❌ Ocurrió un error. ';
    if (error.message?.includes('network') || error.message?.includes('conexión')) {
      errorMessage += 'Verifica tu conexión a internet e intenta nuevamente.';
    } else {
      errorMessage += error.message || 'Por favor, intenta de nuevo.';
    }

    await this.addErrorMessage(errorMessage);
    this.isAIThinking.set(false);

    // Track step failure
    this.analyticsService.failStep(this.currentStep(), error.message || 'Unknown error');
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      setTimeout(() => {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }, 100);
    }
  }

  // ========== NAVIGATION GUARDS ==========
  private setupNavigationGuards() {
    this.navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationStart))
      .subscribe((event: NavigationStart) => {
        if (this.hasStartedOnboarding && !this.isFlowCompleted && !event.url.includes('/queue/join')) {
          const shouldLeave = confirm('⚠️ ¿Salir? Perderás tu progreso.');
          if (!shouldLeave) {
            window.history.pushState(null, '', window.location.href);
          }
        }
      });
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(event: any) {
    if (this.hasStartedOnboarding && !this.isFlowCompleted) {
      if (!confirm('⚠️ ¿Salir? Perderás tu progreso.')) {
        window.history.pushState(null, '', window.location.href);
        return false;
      }
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.hasStartedOnboarding && !this.isFlowCompleted) {
      event.preventDefault();
      event.returnValue = '¿Salir? Perderás tu progreso.';
      return event.returnValue;
    }
  }

  // ========== TEMPLATE METHODS ==========
  async onSendMessage() {
    const message = this.userInput().trim();
    if (!message || this.isAIThinking()) return;

    this.userInput.set('');

    await this.addMessage('user', message);

    // Route to handler
    switch (this.currentStep()) {
      case 'phone':
        await this.processPhoneResponse(message);
        break;
      case 'service':
        await this.processServiceResponse(message);
        break;
      // Add other handlers...
    }
  }

  onOptionSelect(option: string) {
    this.processUserResponse(option);
  }

  private async processUserResponse(response: string) {
    if (!this.aiConversationActive()) {
      // Fallback to old logic if AI is not active
      switch (this.currentStep()) {
        case 'phone':
          await this.processPhoneResponse(response);
          break;
        case 'service':
          await this.processServiceResponse(response);
          break;
        case 'motorcycle_check':
          // Handle special case for motorcycle search
          if (response === 'add_new_motorcycle') {
            await this.askForMotorcycle();
          } else {
            await this.processMotorcycleSelection(response);
          }
          break;
        case 'motorcycle':
          await this.processMotorcycleDescription(response);
          break;
        case 'license_plate':
          await this.processLicensePlate(response);
          break;
        case 'mileage':
          await this.processMileage(response);
          break;
        case 'confirm':
          await this.processConfirmation(response);
          break;
        default:
          console.log('Unhandled step:', this.currentStep(), 'response:', response);
      }
      return;
    }

    // AI-powered conversation processing
    await this.processAIResponse(response);
  }

  private async processAIResponse(userMessage: string) {
    try {
      this.isAIThinking.set(true);

      const context = this.conversationContext();
      const user = this.currentUser();

      // Build conversation history for context
      const conversationHistory = [
        ...context.conversationHistory,
        { role: 'user', content: userMessage }
      ];

      // Create AI prompt for queue joining conversation
      const systemPrompt = `Eres un asistente conversacional amigable para Blue Dragon Motors, un taller de motocicletas.
Tu tarea es guiar al usuario a través del proceso de unirse a la cola de servicio de manera natural y conversacional.

INFORMACIÓN DEL USUARIO:
- Nombre: ${user?.name || 'Usuario'}
- Teléfono actual: ${user?.phone || 'No registrado'}
- Motocicletas registradas: ${this.userAssignedMotorcycles().length > 0 ?
  this.userAssignedMotorcycles().map(v => `${v.plate} (${this.availableMotorcycles().find(m => m.id === v.baseVehicleId)?.brand} ${this.availableMotorcycles().find(m => m.id === v.baseVehicleId)?.model})`).join(', ') :
  'Ninguna'}

DATOS RECOLECTADOS HASTA AHORA:
${Object.entries(context.collectedData).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

SERVICIOS DISPONIBLES:
${this.availableServices().join(', ')}

MOTOCICLETAS DISPONIBLES:
${this.availableMotorcycles().map(m => `${m.brand} ${m.model} (${m.year})`).join(', ')}

INSTRUCCIONES:
1. Sé conversacional y amigable, no uses un formato de pasos rígido
2. Pregunta por la información necesaria de manera natural
3. Valida la información que el usuario proporciona
4. Si algo no está claro, pide aclaración amablemente
5. Cuando tengas toda la información necesaria (servicio, motocicleta, placa, kilometraje), confirma y procede a unir a la cola
6. Si el usuario ya tiene motocicletas registradas, pregúntale cuál quiere usar
7. Mantén el contexto de la conversación anterior

INFORMACIÓN NECESARIA PARA COMPLETAR:
- Servicio requerido (de la lista de servicios disponibles)
- Motocicleta (marca, modelo, año o selección de las registradas)
- Placa de la motocicleta
- Kilometraje actual
- Teléfono de contacto (si no está registrado)

Responde de manera natural, como si estuvieras charlando con un cliente en el taller.`;

      // Get AI response
      const aiResponse = await this.groqService.generateResponse(
        userMessage,
        systemPrompt,
        {
          temperature: 0.7,
          max_tokens: 1000
        }
      );

      // Add AI response to chat
      await this.addMessage('ai', aiResponse);

      // Update conversation context
      this.conversationContext.update(ctx => ({
        ...ctx,
        conversationHistory: [...conversationHistory, { role: 'assistant', content: aiResponse }]
      }));

      // Try to extract information from user message and AI response
      await this.extractInformationFromConversation(userMessage, aiResponse);

      // Check if we have all required information to proceed
      await this.checkCompletionAndProceed();

    } catch (error) {
      console.error('AI response processing error:', error);
      await this.addMessage('system',
        'Lo siento, tuve un problema procesando tu mensaje. ¿Puedes intentarlo de nuevo?',
        [],
        { isError: true }
      );
    } finally {
      this.isAIThinking.set(false);
    }
  }

  private async extractInformationFromConversation(userMessage: string, aiResponse: string) {
    const context = this.conversationContext();
    const collectedData = { ...context.collectedData };

    // Extract phone number
    const phoneMatch = userMessage.match(/(\d{10}|\d{3}[-.\s]\d{3}[-.\s]\d{4}|\(\d{3}\)\s*\d{3}[-.\s]\d{4})/);
    if (phoneMatch && !collectedData.phone) {
      const phone = phoneMatch[1].replace(/[-.\s]/g, '');
      if (this.validationService.validatePhone(phone).isValid) {
        collectedData.phone = phone;
        this.userPhone.set(phone);
        this.phoneValidated.set(true);
      }
    }

    // Extract service from available services
    const services = this.availableServices();
    for (const service of services) {
      if (userMessage.toLowerCase().includes(service.toLowerCase()) && !collectedData.service) {
        collectedData.service = service;
        this.selectedService.set(service);
        this.serviceValidated.set(true);
        break;
      }
    }

    // Extract motorcycle information
    const motorcycles = this.availableMotorcycles();
    for (const motorcycle of motorcycles) {
      const motorcycleText = `${motorcycle.brand} ${motorcycle.model}`.toLowerCase();
      if (userMessage.toLowerCase().includes(motorcycleText) && !collectedData.motorcycle) {
        collectedData.motorcycle = motorcycle;
        this.selectedMotorcycle.set(motorcycle);
        this.motorcycleValidated.set(true);
        break;
      }
    }

    // Extract license plate
    const plateMatch = userMessage.match(/([A-Z]{3}\d{3}|[A-Z]{2}\d{4}|[A-Z]{1}\d{5}|\d{3}[A-Z]{3})/i);
    if (plateMatch && !collectedData.plate) {
      const plate = plateMatch[1].toUpperCase();
      if (this.validationService.validateLicensePlate(plate).isValid) {
        collectedData.plate = plate;
        this.licensePlate.set(plate);
        this.licensePlateValidated.set(true);
      }
    }

    // Extract mileage
    const mileageMatch = userMessage.match(/(\d{1,6})\s*(?:km|kilometros|kilómetros|millas)/i);
    if (mileageMatch && !collectedData.mileage) {
      const mileage = parseInt(mileageMatch[1]);
      if (this.validationService.validateMileage(mileage.toString()).isValid) {
        collectedData.mileage = mileage;
        this.currentMileage.set(mileage);
        this.mileageValidated.set(true);
      }
    }

    // Update context
    this.conversationContext.update(ctx => ({
      ...ctx,
      collectedData
    }));
  }

  private async checkCompletionAndProceed() {
    const context = this.conversationContext();
    const collectedData = context.collectedData;

    // Check if we have all required information
    const hasPhone = collectedData.phone || this.userPhone();
    const hasService = collectedData.service || this.selectedService();
    const hasMotorcycle = collectedData.motorcycle || this.selectedMotorcycle();
    const hasPlate = collectedData.plate || this.licensePlate();
    const hasMileage = collectedData.mileage !== undefined || this.currentMileage() !== null;

    if (hasPhone && hasService && hasMotorcycle && hasPlate && hasMileage) {
      // We have all required information, proceed to confirmation
      if (!context.isComplete) {
        this.conversationContext.update(ctx => ({ ...ctx, isComplete: true }));
        await this.confirmAndJoinQueueAI();
      }
    }
  }

  private async confirmAndJoinQueueAI() {
    const context = this.conversationContext();
    const collectedData = context.collectedData;

    const phone = collectedData.phone || this.userPhone();
    const service = collectedData.service || this.selectedService();
    const motorcycle = collectedData.motorcycle || this.selectedMotorcycle();
    const plate = collectedData.plate || this.licensePlate();
    const mileage = collectedData.mileage !== undefined ? collectedData.mileage : this.currentMileage();

    const summary = `
📋 Resumen de tu solicitud:
📱 Teléfono: ${this.validationService.formatPhone(phone)}
🔧 Servicio: ${service}
🏍️ Motocicleta: ${motorcycle ? `${motorcycle.brand} ${motorcycle.model} ${motorcycle.year}` : 'No especificada'}
🔢 Placa: ${plate}
📊 Kilometraje: ${this.validationService.formatMileage(mileage)}

¿Confirmas que la información es correcta y quieres unirte a la cola?
    `.trim();

    await this.addMessage('ai', summary, ['✅ Sí, confirmar y unirme', '✏️ No, quiero cambiar algo']);
    this.currentStep.set('confirm');
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage();
    }
  }

  goBack() {
    this.router.navigate(['/']);
  }

  downloadQRCode() {
    const entry = this.queueEntry();
    if (!entry?.qrCodeDataUrl) return;

    const link = document.createElement('a');
    link.href = entry.qrCodeDataUrl;
    link.download = `ticket-qr-${this.ticketNumber()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Template helper methods
  formatMessage(content: string): string {
    return content.replace(/\n/g, '<br>');
  }

  getInputPlaceholder(): string {
    switch (this.currentStep()) {
      case 'phone':
        return 'Ingresa tu número de teléfono...';
      case 'service':
        return 'Escribe el servicio que necesitas...';
      case 'motorcycle':
        return 'Describe tu motocicleta (ej: Yamaha R15 2020)...';
      case 'license_plate':
        return 'Ingresa la placa de tu motocicleta...';
      case 'mileage':
        return 'Ingresa los kilómetros actuales...';
      default:
        return 'Escribe tu respuesta...';
    }
  }

  formatTime(date: Date): string {
    if (!date) return '';

    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Hace ${diffInHours}h`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `Hace ${diffInDays}d`;

    return date.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Authentication methods
  async onGoogleSignIn() {
    this.isAuthenticating.set(true);
    this.authenticationError.set(null);

    try {
      const success = await this.authService.signInWithGoogle();
      if (success) {
        await this.handleSuccessfulAuthentication();
      } else {
        this.authenticationError.set('Error al iniciar sesión con Google. Por favor, inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      this.authenticationError.set('Error al iniciar sesión con Google. Por favor, inténtalo de nuevo.');
    } finally {
      this.isAuthenticating.set(false);
    }
  }

  async onAppleSignIn() {
    this.isAuthenticating.set(true);
    this.authenticationError.set(null);

    try {
      const success = await this.authService.signInWithApple();
      if (success) {
        await this.handleSuccessfulAuthentication();
      } else {
        this.authenticationError.set('Error al iniciar sesión con Apple. Por favor, inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('Apple sign-in error:', error);
      this.authenticationError.set('Error al iniciar sesión con Apple. Por favor, inténtalo de nuevo.');
    } finally {
      this.isAuthenticating.set(false);
    }
  }

  private async handleSuccessfulAuthentication() {
    this.authenticationError.set(null);
    this.isLoadingUserData.set(true);

    await this.waitForCompleteUserData();

    // Create session
    this.currentSession = this.queueSessionService.createSession();
    if (this.currentSession && this.currentUser()) {
      this.currentSession.userId = this.currentUser()!.id;
    }

    this.isLoadingUserData.set(false);
    await this.startImprovedOnboarding();
  }

  private async waitForCompleteUserData(): Promise<void> {
    return new Promise((resolve) => {
      const checkCompleteData = () => {
        const user = this.currentUser();

        const hasCompleteProfile = user &&
          user.name &&
          user.name !== 'undefined' &&
          user.name.trim() !== '' &&
          user.email &&
          user.id;

        if (hasCompleteProfile) {
          this.waitForServicesLoaded().then(() => {
            console.log('🔄 QueueJoin: Complete user data loaded');
            resolve();
          }).catch((error) => {
            console.error('🔄 QueueJoin: Error waiting for services:', error);
            resolve();
          });
        } else {
          setTimeout(checkCompleteData, 100);
        }
      };
      checkCompleteData();
    });
  }

  // Template helper methods
  isOnline(): boolean {
    return navigator.onLine;
  }

  retryLoading(): void {
    if (this.isLoadingUserData()) {
      console.log('🔄 QueueJoin: Retrying loading...');
      this.isRetrying.set(true);
      this.isLoadingUserData.set(true);
      this.loadingError.set(null);
      this.ngOnInit();
      setTimeout(() => this.isRetrying.set(false), 1000);
    }
  }

  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id;
  }

  trackByOption(index: number, option: string): string {
    return option;
  }

  isMotorcycleAssigned(motorcycleId: string): boolean {
    return this.userAssignedMotorcycles().some(v => v.baseVehicleId === motorcycleId);
  }

  getMessageAriaLabel(message: ChatMessage): string {
    const typeLabels = {
      ai: 'Mensaje del asistente',
      user: 'Tu mensaje',
      system: 'Mensaje del sistema',
      error: 'Mensaje de error',
      success: 'Mensaje de éxito',
      progress: 'Mensaje de progreso'
    };

    const typeLabel = typeLabels[message.type] || 'Mensaje';
    return `${typeLabel}: ${message.content}`;
  }
}