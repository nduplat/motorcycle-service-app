import { ChangeDetectionStrategy, Component, inject, signal, computed, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { MotorcycleService } from '../../services/motorcycle.service';
import { AdvancedServiceService } from '../../services/advanced-service.service';
import { NotificationService } from '../../services/notification.service';
import { UserVehicleService } from '../../services/user-vehicle.service';
import { QueueSessionService } from '../../services/queue-session.service';
import { QueueService } from '../../services/queue.service';
import { AppointmentService } from '../../services/appointment.service';
import { AdvancedProductService } from '../../services/advanced-product.service';
import { QueueEntry, User, Motorcycle, Product } from '../../models';

export type ChatbotMode = 'services' | 'appointments' | 'offers' | 'queue';

interface ChatMessage {
  id: string;
  type: 'ai' | 'user' | 'system';
  content: string;
  timestamp: Date;
  options?: string[];
  data?: any;
}

interface ProductResult {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  brand: string;
  compatibility: string[];
}

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.component.html',

  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CommonModule],
})
export class ChatbotComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private motorcycleService = inject(MotorcycleService);
  private advancedServiceService = inject(AdvancedServiceService);
  private notificationService = inject(NotificationService);
  private userVehicleService = inject(UserVehicleService);
  private queueSessionService = inject(QueueSessionService);
  private queueService = inject(QueueService);
  private appointmentService = inject(AppointmentService);
  private advancedProductService = inject(AdvancedProductService);

  // Inputs
  @Input() mode: ChatbotMode = 'queue';
  @Input() showLoginButtons = true;

  // Outputs
  @Output() productSelected = new EventEmitter<ProductResult>();
  @Output() appointmentBooked = new EventEmitter<any>();
  @Output() offerApplied = new EventEmitter<any>();

  // Component state
  currentUser = this.authService.currentUser;
  isAuthenticated = computed(() => !!this.currentUser());
  isAuthenticating = signal(false);
  authenticationError = signal<string | null>(null);

  // Chat state
  chatMessages = signal<ChatMessage[]>([]);
  isAIThinking = signal(false);
  userInput = signal('');
  showChatInput = signal(true);
  isUserAtBottom = signal(true);
  showScrollToBottom = signal(false);

  // Floating chat state
  isChatOpen = signal(false);
  hasNewMessage = signal(false);

  // Mode-specific state
  currentStep = signal<string>('welcome');
  selectedService = signal<string>('');
  selectedMotorcycle = signal<Motorcycle | null>(null);
  licensePlate = signal<string>('');
  currentMileage = signal<number | null>(null);
  userPhone = signal<string>('');

  // Services data
  availableServices = computed(() => {
    const services = this.advancedServiceService.paginatedServices();
    return services.map(s => s.title || s.code || 'Servicio sin nombre');
  });

  availableMotorcycles = computed(() => {
    return this.motorcycleService.getMotorcycles()();
  });

  availableProducts = computed(() => {
    return this.advancedProductService.products();
  });

  ngOnInit() {
    this.initializeChat();
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  private async initializeChat() {
    if (this.isAuthenticated()) {
      await this.startChatForMode();
    } else if (this.showLoginButtons) {
      // Show welcome message for unauthenticated users
      await this.addMessage('ai', '¡Hola! Soy tu asistente de Blue Dragon Motors. Para continuar, por favor inicia sesión.');
    }
  }

  private async startChatForMode() {
    const user = this.currentUser();
    if (!user) return;

    this.showChatInput.set(true);

    switch (this.mode) {
      case 'services':
        await this.initializeServicesChat();
        break;
      case 'appointments':
        await this.initializeAppointmentsChat();
        break;
      case 'offers':
        await this.initializeOffersChat();
        break;
      case 'queue':
        await this.initializeQueueChat();
        break;
    }
  }

  private async initializeServicesChat() {
    await this.addMessage('ai', `¡Hola ${this.currentUser()?.name}! Soy tu asistente de repuestos. ¿Qué tipo de repuesto necesitas para tu motocicleta?`, [
      'Frenos', 'Motor', 'Eléctrico', 'Suspensión', 'Transmisión', 'Accesorios'
    ]);
  }

  private async initializeAppointmentsChat() {
    await this.addMessage('ai', `¡Hola ${this.currentUser()?.name}! Te ayudaré a agendar una cita de servicio. ¿Qué tipo de servicio necesitas?`, this.availableServices());
  }

  private async initializeOffersChat() {
    await this.addMessage('ai', `¡Hola ${this.currentUser()?.name}! Te mostraré nuestras mejores ofertas. ¿Qué tipo de producto te interesa?`, [
      'Repuestos', 'Accesorios', 'Servicios', 'Paquetes'
    ]);
  }

  private async initializeQueueChat() {
    await this.addMessage('ai', `¡Hola ${this.currentUser()?.name}! Soy tu asistente de Blue Dragon Motors. Te ayudaré a unirte a la cola de servicio de manera rápida y sencilla.`);
    await this.askForPhone();
  }

  private async askForPhone() {
    this.currentStep.set('phone');
    const user = this.currentUser();

    if (user?.phone) {
      await this.addMessage('ai', `Veo que tienes registrado el teléfono: ${this.formatPhone(user.phone)}. ¿Es correcto?`, ['Sí, es correcto', 'No, quiero cambiarlo']);
    } else {
      await this.addMessage('ai', 'Para comenzar, necesito tu número de teléfono celular. ¿Cuál es tu número? (ej: 3123456789)', [], { inputType: 'phone' });
    }
  }

  private async processUserResponse(response: string) {
    try {
      if (!response || response.trim().length === 0) {
        await this.addMessage('ai', '❌ El mensaje está vacío. Por favor, escribe algo.');
        return;
      }

      if (response.trim().length > 500) {
        await this.addMessage('ai', '❌ El mensaje es demasiado largo. Por favor, sé más conciso.');
        return;
      }

      await this.addMessage('user', response.trim());

      switch (this.mode) {
        case 'services':
          await this.processServicesResponse(response);
          break;
        case 'appointments':
          await this.processAppointmentsResponse(response);
          break;
        case 'offers':
          await this.processOffersResponse(response);
          break;
        case 'queue':
          await this.processQueueResponse(response);
          break;
      }
    } catch (error) {
      console.error('Error processing user response:', error);
      await this.addMessage('ai', 'Lo siento, ocurrió un error. Por favor, intenta de nuevo.');
      this.isAIThinking.set(false);
    }
  }

  private async processServicesResponse(response: string) {
    const products = this.availableProducts();
    const category = this.getCategoryFromResponse(response);

    if (category) {
      const filteredProducts = products.filter((p: any) =>
        p.category?.toLowerCase().includes(category.toLowerCase()) ||
        p.name?.toLowerCase().includes(category.toLowerCase())
      ).slice(0, 5);

      if (filteredProducts.length > 0) {
        await this.addMessage('ai', `Encontré ${filteredProducts.length} productos en la categoría "${category}". Aquí están los resultados:`, [], {
          products: filteredProducts.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            category: p.category,
            brand: p.brand,
            compatibility: p.compatibility || []
          }))
        });
      } else {
        await this.addMessage('ai', `No encontré productos en la categoría "${category}". ¿Quieres buscar en otra categoría?`, [
          'Frenos', 'Motor', 'Eléctrico', 'Suspensión', 'Transmisión', 'Accesorios'
        ]);
      }
    } else {
      await this.addMessage('ai', 'No entendí esa categoría. ¿Qué tipo de repuesto buscas?', [
        'Frenos', 'Motor', 'Eléctrico', 'Suspensión', 'Transmisión', 'Accesorios'
      ]);
    }
  }

  private async processAppointmentsResponse(response: string) {
    // Simplified appointment booking logic
    const services = this.availableServices();
    const selectedService = services.find(s =>
      s.toLowerCase().includes(response.toLowerCase()) ||
      response.toLowerCase().includes(s.toLowerCase())
    );

    if (selectedService) {
      this.selectedService.set(selectedService);
      await this.addMessage('ai', `Excelente, seleccionaste "${selectedService}". ¿Para cuándo quieres agendar tu cita?`, [
        'Hoy', 'Mañana', 'Esta semana', 'Próxima semana'
      ]);
    } else {
      await this.addMessage('ai', 'No encontré ese servicio. ¿Cuál de estos servicios necesitas?', services.slice(0, 6));
    }
  }

  private async processOffersResponse(response: string) {
    // Simplified offers logic
    const offerType = response.toLowerCase();
    if (offerType.includes('repuesto') || offerType.includes('accesorio')) {
      await this.addMessage('ai', '¡Tenemos grandes ofertas en repuestos! Aquí están nuestras promociones actuales:', [], {
        offers: [
          { name: 'Aceite de motor 20% OFF', description: 'Oferta válida por tiempo limitado', discount: 20 },
          { name: 'Frenos delanteros con instalación', description: 'Kit completo con 15% de descuento', discount: 15 },
          { name: 'Batería nueva 10% OFF', description: 'Baterías de alta calidad con garantía', discount: 10 }
        ]
      });
    } else {
      await this.addMessage('ai', '¿Qué tipo de oferta te interesa?', ['Repuestos', 'Accesorios', 'Servicios', 'Paquetes']);
    }
  }

  private async processQueueResponse(response: string) {
    // Queue logic (simplified version from original component)
    const lowerResponse = response.toLowerCase().trim();

    if (lowerResponse.includes('cancelar') || lowerResponse.includes('salir')) {
      await this.addMessage('ai', 'Entendido. ¿Estás seguro de que quieres cancelar?', ['Sí, salir', 'No, continuar']);
      return;
    }

    switch (this.currentStep()) {
      case 'phone':
        await this.processPhoneResponse(response);
        break;
      case 'service':
        await this.processServiceResponse(response);
        break;
      // Add other queue steps as needed
      default:
        await this.addMessage('ai', 'Lo siento, no entiendo ese paso. ¿Podemos empezar desde cero?', ['Sí, empezar desde cero', 'No, salir']);
    }
  }

  private async processPhoneResponse(response: string) {
    // Simplified phone processing
    const phoneRegex = /^3\d{9}$/;
    const cleanPhone = response.replace(/\s+/g, '').replace(/[^\d]/g, '');

    if (!phoneRegex.test(cleanPhone)) {
      await this.addMessage('ai', 'Número inválido. Debe empezar con 3 y tener 10 dígitos.', [], { inputType: 'phone' });
      return;
    }

    this.userPhone.set(cleanPhone);
    await this.addMessage('ai', `✅ Teléfono registrado: ${this.formatPhone(cleanPhone)}`);
    await this.askForService();
  }

  private async askForService() {
    this.currentStep.set('service');
    await this.addMessage('ai', '¿Qué tipo de servicio necesitas?', this.availableServices().slice(0, 6));
  }

  private async processServiceResponse(response: string) {
    const services = this.availableServices();
    const selectedService = services.find(s =>
      s.toLowerCase().includes(response.toLowerCase()) ||
      response.toLowerCase().includes(s.toLowerCase())
    );

    if (selectedService) {
      this.selectedService.set(selectedService);
      await this.addMessage('ai', `✅ Servicio seleccionado: ${selectedService}`);
      // Continue with queue process...
    } else {
      await this.addMessage('ai', 'Servicio no encontrado. ¿Cuál de estos servicios necesitas?', services.slice(0, 6));
    }
  }

  private getCategoryFromResponse(response: string): string | null {
    const categories = {
      'frenos': 'Frenos',
      'freno': 'Frenos',
      'motor': 'Motor',
      'eléctrico': 'Eléctrico',
      'electrico': 'Eléctrico',
      'suspensión': 'Suspensión',
      'suspension': 'Suspensión',
      'transmisión': 'Transmisión',
      'transmision': 'Transmisión',
      'accesorios': 'Accesorios',
      'accesorio': 'Accesorios'
    };

    const lowerResponse = response.toLowerCase();
    for (const [key, value] of Object.entries(categories)) {
      if (lowerResponse.includes(key)) {
        return value;
      }
    }
    return null;
  }

  private async addMessage(type: 'ai' | 'user' | 'system', content: string, options: string[] = [], data?: any) {
    const message: ChatMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      options: options.length > 0 ? options : undefined,
      data
    };

    this.chatMessages.update(messages => [...messages, message]);

    // Set new message indicator if chat is closed
    if (!this.isChatOpen() && type === 'ai') {
      this.hasNewMessage.set(true);
    }

    // Only auto-scroll if user is near the bottom
    if (this.isUserAtBottom()) {
      this.scrollToBottom();
    } else {
      // Show scroll to bottom button if user is scrolled up
      this.showScrollToBottom.set(true);
    }
  }

  onScroll(event: Event) {
    const container = event.target as HTMLElement;
    const threshold = 100; // pixels from bottom
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;

    this.isUserAtBottom.set(isAtBottom);

    if (isAtBottom) {
      this.showScrollToBottom.set(false);
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = document.querySelector('.chat-messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
        this.isUserAtBottom.set(true);
        this.showScrollToBottom.set(false);
      }
    }, 100);
  }

  // Event handlers
  async onSendMessage() {
    const message = this.userInput().trim();
    if (!message || this.isAIThinking()) return;

    this.userInput.set('');
    await this.processUserResponse(message);
  }

  onOptionSelect(option: string) {
    this.processUserResponse(option);
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage();
    }
  }

  onProductSelect(product: ProductResult) {
    this.productSelected.emit(product);
  }

  onOfferApply(offer: any) {
    this.offerApplied.emit(offer);
  }

  onAppointmentBook(appointment: any) {
    this.appointmentBooked.emit(appointment);
  }

  // Floating chat methods
  toggleChat(): void {
    const isOpen = this.isChatOpen();
    this.isChatOpen.set(!isOpen);

    if (!isOpen) {
      // Opening chat - clear new message indicator
      this.hasNewMessage.set(false);
    }
  }

  // Authentication methods
  async onGoogleSignIn() {
    this.isAuthenticating.set(true);
    this.authenticationError.set(null);

    try {
      const success = await this.authService.signInWithGoogle();
      if (success) {
        await this.startChatForMode();
      } else {
        this.authenticationError.set('Error al iniciar sesión con Google.');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      this.authenticationError.set('Error al iniciar sesión con Google.');
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
        await this.startChatForMode();
      } else {
        this.authenticationError.set('Error al iniciar sesión con Apple.');
      }
    } catch (error) {
      console.error('Apple sign-in error:', error);
      this.authenticationError.set('Error al iniciar sesión con Apple.');
    } finally {
      this.isAuthenticating.set(false);
    }
  }

  // Helper methods
  formatPhone(phone: string): string {
    if (phone.length === 10) {
      return `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;
    }
    return phone;
  }

  formatMessage(content: string): string {
    return content.replace(/\n/g, '<br>');
  }

  getInputPlaceholder(): string {
    switch (this.mode) {
      case 'services':
        return 'Escribe el tipo de repuesto que buscas...';
      case 'appointments':
        return 'Describe el servicio que necesitas...';
      case 'offers':
        return '¿Qué tipo de oferta te interesa?...';
      case 'queue':
        return 'Escribe tu respuesta...';
      default:
        return 'Escribe tu mensaje...';
    }
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id;
  }

  trackByOption(index: number, option: string): string {
    return option;
  }

  trackByProductId(index: number, product: ProductResult): string {
    return product.id;
  }

  trackByOfferName(index: number, offer: any): string {
    return offer.name;
  }
}