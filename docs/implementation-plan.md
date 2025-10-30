📋 ÓRDENES DE IMPLEMENTACIÓN DETALLADAS
Proyecto: Refactorización Sistema Blue Dragon Motors

🎯 CONTEXTO Y OBJETIVOS
Sistema actual: 7 técnicos, 4 administradores, ~100 clientes
Presupuesto: Minimizar costos (Firebase Spark gratuito prioritario)
Objetivo: Resolver conflicto client-flow ↔ queue + optimización de costos

📦 FASE 1: PREPARACIÓN Y ANÁLISIS DE COSTOS (Día 1)
ORDEN 1.1: Auditoría de Uso Actual de Firebase
Desarrollador asignado: DevOps/Backend Lead
Tareas específicas:

Acceder a Firebase Console → Uso y facturación
Documentar métricas actuales:

Lecturas/escrituras Firestore por día
Invocaciones de Cloud Functions (si existen)
Usuarios activos diarios (DAU)
Almacenamiento utilizado
Transferencia de datos


Crear spreadsheet con proyección de costos
Identificar operaciones que más consumen quota
Entregable: Documento "Firebase-Usage-Analysis.xlsx" con recomendaciones

ORDEN 1.2: Configurar Plan de Optimización de Costos
Desarrollador asignado: Backend Lead
Instrucciones precisas:

Implementar estrategia de STAY EN PLAN GRATUITO:

Límites Spark Plan: 50K lecturas/día, 20K escrituras/día
Para 111 usuarios: ~450 lecturas/día por usuario MAX
Presupuesto por operación: calcular y documentar


Crear reglas de optimización obligatorias:

   REGLA 1: Batch reads máximo 10 documentos por operación
   REGLA 2: Cache local obligatorio para datos estáticos (motos, usuarios)
   REGLA 3: Listeners en tiempo real SOLO para cola activa
   REGLA 4: Polling cada 30seg para dashboard admin (no listeners)
   REGLA 5: Eliminar listeners al destruir componentes (CRÍTICO)
```

3. **Entregable:** "Cost-Optimization-Rules.md" con checklist de validación

---

## 🔧 FASE 2: REFACTORIZACIÓN BACKEND (Días 2-8)

### ORDEN 2.1: Crear Nuevo Servicio Centralizado de Cola
**Desarrollador asignado:** Backend Senior

**Nombre del archivo:** `src/app/core/services/unified-queue.service.ts`

**Especificaciones técnicas detalladas:**

#### A) Estructura de datos Firestore optimizada
```
Collection: queues/{date}/entries/{entryId}
Estructura:
{
  customerId: string,
  motorcycleId: string,
  serviceType: string,
  status: 'waiting' | 'called' | 'in-service' | 'completed',
  position: number,
  estimatedTime: number,
  createdAt: Timestamp,
  calledAt: Timestamp | null,
  technicianId: string | null,
  priority: 'normal' | 'urgent',
  metadata: {
    sourceApp: 'web' | 'mobile',
    clientFlowCompleted: boolean
  }
}

Índices compuestos necesarios:
1. (status, position) - para ordenar cola
2. (customerId, createdAt) - historial cliente
3. (status, calledAt) - métricas
B) Implementar pattern Repository
Instrucciones precisas:

Crear interface IQueueRepository con métodos:

addEntry(data): Promise<string> - retorna ID
getActiveEntries(): Observable<QueueEntry[]> - UN SOLO listener
updateEntryStatus(id, status): Promise<void> - batch update
getEntryById(id): Promise<QueueEntry> - cached read
removeEntry(id): Promise<void> - soft delete (marcar como 'removed')


Implementar cache local con Map:

typescript   private cache = new Map<string, {data: QueueEntry, timestamp: number}>();
   private CACHE_TTL = 30000; // 30 segundos

Lógica de cache OBLIGATORIA:

Verificar cache antes de Firestore read
Invalidar cache solo cuando listener detecta cambio
NO invalidar cache por timeout en datos activos
Usar cache para operaciones repetidas (posición en cola)


CRÍTICO - Manejo de listeners:

typescript   private activeListener: Unsubscribe | null = null;
   
   initQueueListener(): void {
     // Destruir listener anterior si existe
     if (this.activeListener) {
       this.activeListener();
     }
     
     // Crear UN SOLO listener para cola activa
     this.activeListener = onSnapshot(
       query(collection(db, 'queues'), where('status', 'in', ['waiting', 'called'])),
       (snapshot) => {
         // Procesar cambios y actualizar cache
       }
     );
   }
   
   destroyListener(): void {
     if (this.activeListener) {
       this.activeListener();
       this.activeListener = null;
     }
   }

Implementar bloqueo optimista para callNext():

typescript   async callNext(technicianId: string): Promise<QueueEntry | null> {
     const transaction = await runTransaction(db, async (t) => {
       // 1. Leer siguiente en cola
       // 2. Verificar que status === 'waiting'
       // 3. Actualizar status a 'called' con technicianId
       // 4. Commit atómico
       // Si falla, reintentar 3 veces con backoff
     });
   }
Entregable:

unified-queue.service.ts funcional
Tests unitarios con 80% coverage
Documentación inline JSDoc completa


ORDEN 2.2: Refactorizar ClientFlowService
Desarrollador asignado: Frontend Senior
Archivo: src/app/features/client-flow/services/client-flow.service.ts
Cambios obligatorios:
A) ELIMINAR completamente gestión de cola
Líneas a BORRAR:

Signal queueEntry (línea ~409)
Método createQueueEntry()
Método updateQueuePosition()
Cualquier referencia directa a Firestore collection 'queues'

B) REEMPLAZAR con integración a UnifiedQueueService
Instrucciones paso a paso:

Inyectar dependencia:

typescript   constructor(private unifiedQueue: UnifiedQueueService) {}

Modificar método completeFlow():

typescript   async completeFlow(): Promise<void> {
     // Validar que todos los pasos estén completos
     if (!this.validateAllSteps()) {
       throw new Error('Flujo incompleto');
     }
     
     // Preparar datos para cola
     const queueData = {
       customerId: this.currentUser().uid,
       motorcycleId: this.selectedMotorcycleId(),
       serviceType: this.selectedServiceType(),
       status: 'waiting',
       metadata: {
         sourceApp: 'web',
         clientFlowCompleted: true,
         completedSteps: this.getCompletedSteps()
       }
     };
     
     // Delegar a UnifiedQueueService
     const entryId = await this.unifiedQueue.addEntry(queueData);
     
     // Guardar solo ID de referencia local
     this.currentQueueEntryId.set(entryId);
     
     // Notificar éxito
     this.notificationService.success('Te has unido a la cola correctamente');
     
     // Navegar a wait-ticket
     this.router.navigate(['/client-flow/wait-ticket']);
   }

Crear método auxiliar para consultar estado:

typescript   async getCurrentQueueStatus(): Promise<QueueEntry | null> {
     const entryId = this.currentQueueEntryId();
     if (!entryId) return null;
     
     // Usar cache de UnifiedQueueService
     return await this.unifiedQueue.getEntryById(entryId);
   }

CRÍTICO - Gestión de estado local:

Solo mantener: currentStep, completedSteps, currentQueueEntryId
NO mantener: datos de cola, posición, tiempo estimado
Consultar estado bajo demanda, no subscripciones permanentes



Entregable:

client-flow.service.ts refactorizado
Tests de integración con UnifiedQueueService
Diagrama de flujo actualizado


ORDEN 2.3: Actualizar ClientFlowGuard
Desarrollador asignado: Backend Junior
Archivo: src/app/core/guards/client-flow.guard.ts
Cambios específicos:
Línea 41 - REEMPLAZAR:
typescript// ANTES (INCORRECTO):
const allowedRoles = ['customer', 'admin', 'technician'];

// DESPUÉS (CORRECTO):
const allowedRoles = ['customer'];
Agregar validación adicional:
typescript// Verificar que el usuario sea customer Y tenga perfil completo
if (userRole !== 'customer') {
  this.router.navigate(['/unauthorized']);
  return false;
}

// Validar perfil completo
const userProfile = await this.authService.getUserProfile(user.uid);
if (!userProfile.motorcycleCount || userProfile.motorcycleCount === 0) {
  this.router.navigate(['/onboarding/add-motorcycle']);
  return false;
}

return true;
Entregable:

Guard actualizado
Tests E2E para verificar restricciones
Actualizar app.routes.ts si es necesario


ORDEN 2.4: Optimizar QueueManagementComponent
Desarrollador asignado: Frontend Mid-Level
Archivo: src/app/features/admin/components/queue-management/queue-management.component.ts
Optimizaciones de costos obligatorias:
A) ELIMINAR listener en tiempo real
Razón: Admins no necesitan updates cada segundo, es costoso
Implementación:

BORRAR línea de onSnapshot() o similar
IMPLEMENTAR polling cada 30 segundos:

typescript   private pollingInterval?: number;
   
   ngOnInit(): void {
     this.loadQueueData(); // Carga inicial
     
     // Polling cada 30 segundos
     this.pollingInterval = window.setInterval(() => {
       this.loadQueueData();
     }, 30000);
   }
   
   ngOnDestroy(): void {
     if (this.pollingInterval) {
       clearInterval(this.pollingInterval);
     }
   }
   
   async loadQueueData(): Promise<void> {
     // Usar UnifiedQueueService con cache
     this.queueEntries.set(
       await this.unifiedQueue.getActiveEntries().pipe(take(1)).toPromise()
     );
   }

Agregar botón de refresh manual:

html   <button (click)="loadQueueData()" class="btn-refresh">
     <lucide-icon name="refresh-cw"></lucide-icon>
     Actualizar
   </button>

Implementar loading state:

typescript   isLoading = signal(false);
   
   async loadQueueData(): Promise<void> {
     this.isLoading.set(true);
     try {
       // ... cargar datos
     } finally {
       this.isLoading.set(false);
     }
   }
Entregable:

Componente optimizado sin listeners
UI con indicador de última actualización
Tests de usabilidad con polling


ORDEN 2.5: Optimizar WaitTicketComponent
Desarrollador asignado: Frontend Mid-Level
Archivo: src/app/features/client-flow/components/wait-ticket/wait-ticket.component.ts
Optimización cliente en espera:
A) Implementar polling inteligente con backoff
Lógica específica:
typescriptprivate pollingInterval = 5000; // Empezar en 5 segundos
private maxPollingInterval = 60000; // Máximo 1 minuto
private pollingTimer?: number;

ngOnInit(): void {
  this.startIntelligentPolling();
}

async startIntelligentPolling(): Promise<void> {
  const updateTicket = async () => {
    const status = await this.clientFlow.getCurrentQueueStatus();
    
    if (!status) return;
    
    this.position.set(status.position);
    this.estimatedTime.set(status.estimatedTime);
    
    // Ajustar frecuencia según posición
    if (status.position <= 3) {
      // Top 3: actualizar cada 5 segundos
      this.pollingInterval = 5000;
    } else if (status.position <= 10) {
      // Top 10: actualizar cada 15 segundos
      this.pollingInterval = 15000;
    } else {
      // Resto: actualizar cada 30-60 segundos con backoff
      this.pollingInterval = Math.min(
        this.pollingInterval * 1.5,
        this.maxPollingInterval
      );
    }
    
    // Programar siguiente update
    this.pollingTimer = window.setTimeout(updateTicket, this.pollingInterval);
  };
  
  updateTicket();
}

ngOnDestroy(): void {
  if (this.pollingTimer) {
    clearTimeout(this.pollingTimer);
  }
}
B) Implementar notificaciones push (gratis con FCM)
Configuración:

Agregar Firebase Cloud Messaging al proyecto
Solicitar permiso de notificaciones:

typescript   async requestNotificationPermission(): Promise<void> {
     const permission = await Notification.requestPermission();
     if (permission === 'granted') {
       const token = await getToken(messaging);
       // Guardar token en Firestore user profile
       await this.authService.updateUserNotificationToken(token);
     }
   }
```

3. Crear Cloud Function para enviar notificaciones (GRATIS en Spark):
```
   Evento: onUpdate en queues/{date}/entries/{entryId}
   Condición: position <= 3 Y status === 'waiting'
   Acción: Enviar push notification al customerId
Entregable:

Componente con polling inteligente
Sistema de notificaciones push funcional
Documentación de configuración FCM


🛡️ FASE 3: SEGURIDAD Y FIRESTORE RULES (Día 9)
ORDEN 3.1: Actualizar Firestore Security Rules
Desarrollador asignado: Backend Lead
Archivo: firestore.rules
Reglas completas y precisas:
javascriptrules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    
    function isCustomer() {
      return isAuthenticated() && getUserRole() == 'customer';
    }
    
    function isTechnician() {
      return isAuthenticated() && getUserRole() == 'technician';
    }
    
    function isAdmin() {
      return isAuthenticated() && getUserRole() == 'admin';
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated() && (
        request.auth.uid == userId || 
        isAdmin() || 
        isTechnician()
      );
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow update: if isAuthenticated() && (
        request.auth.uid == userId || 
        isAdmin()
      );
      allow delete: if isAdmin();
    }
    
    // Queues collection - CRÍTICO PARA COSTOS
    match /queues/{date}/entries/{entryId} {
      // Customers: solo leer SU propia entrada
      allow read: if isCustomer() && 
        resource.data.customerId == request.auth.uid;
      
      // Customers: solo crear SU propia entrada
      allow create: if isCustomer() && 
        request.resource.data.customerId == request.auth.uid &&
        request.resource.data.status == 'waiting' &&
        request.resource.data.metadata.clientFlowCompleted == true;
      
      // Technicians: leer todas las entradas activas
      allow read: if isTechnician() && 
        resource.data.status in ['waiting', 'called', 'in-service'];
      
      // Technicians: actualizar entradas para llamar/atender
      allow update: if isTechnician() && 
        resource.data.status in ['waiting', 'called'] &&
        request.resource.data.status in ['called', 'in-service'] &&
        request.resource.data.technicianId == request.auth.uid;
      
      // Admins: acceso total
      allow read, write: if isAdmin();
    }
    
    // Motorcycles collection
    match /motorcycles/{motorcycleId} {
      allow read: if isAuthenticated() && (
        resource.data.ownerId == request.auth.uid ||
        isAdmin() ||
        isTechnician()
      );
      allow create: if isCustomer() && 
        request.resource.data.ownerId == request.auth.uid;
      allow update, delete: if isAuthenticated() && (
        resource.data.ownerId == request.auth.uid ||
        isAdmin()
      );
    }
    
    // Work Orders collection
    match /workOrders/{orderId} {
      allow read: if isAuthenticated() && (
        resource.data.customerId == request.auth.uid ||
        resource.data.technicianId == request.auth.uid ||
        isAdmin()
      );
      allow create: if isTechnician() || isAdmin();
      allow update: if isAuthenticated() && (
        resource.data.technicianId == request.auth.uid ||
        isAdmin()
      );
      allow delete: if isAdmin();
    }
    
    // Notifications collection (opcional, para push notifications)
    match /notifications/{notificationId} {
      allow read: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
      allow create: if isAdmin() || isTechnician();
    }
    
    // Deny all other paths by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
Validación obligatoria:

Desplegar rules: firebase deploy --only firestore:rules
Probar con Firebase Emulator:

bash   firebase emulators:start --only firestore

Ejecutar test suite de seguridad:

bash   npm run test:security-rules
Entregable:

firestore.rules actualizado
Tests de seguridad pasando al 100%
Documentación de permisos por rol


📱 FASE 4: FRONTEND - COMPONENTES Y UX (Días 10-14)
ORDEN 4.1: Actualizar ClientFlowContainerComponent
Desarrollador asignado: Frontend Senior
Archivo: src/app/features/client-flow/containers/client-flow-container/client-flow-container.component.ts
Cambios de coordinación:
A) Inicialización sincronizada
Problema actual: Componente inicializa sin esperar servicios
Solución:
typescriptasync ngOnInit(): Promise<void> {
  // Mostrar loading
  this.isInitializing.set(true);
  
  try {
    // 1. Esperar autenticación
    const user = await this.auth.currentUser;
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    
    // 2. Esperar carga de perfil
    await this.clientFlow.loadUserProfile(user.uid);
    
    // 3. Verificar si tiene entrada en cola activa
    const existingEntry = await this.clientFlow.checkExistingQueueEntry();
    if (existingEntry) {
      // Redirigir directo a wait-ticket
      this.router.navigate(['/client-flow/wait-ticket']);
      return;
    }
    
    // 4. Inicializar flujo desde paso 1
    this.clientFlow.initializeFlow();
    
  } catch (error) {
    this.notificationService.error('Error al inicializar flujo');
    console.error(error);
  } finally {
    this.isInitializing.set(false);
  }
}
B) Validación de navegación entre pasos
Implementar guards internos:
typescriptcanNavigateToStep(targetStep: number): boolean {
  // No permitir saltar pasos
  if (targetStep > this.currentStep() + 1) {
    return false;
  }
  
  // Validar que pasos anteriores estén completos
  for (let i = 1; i < targetStep; i++) {
    if (!this.clientFlow.isStepCompleted(i)) {
      return false;
    }
  }
  
  return true;
}

navigateToStep(step: number): void {
  if (!this.canNavigateToStep(step)) {
    this.notificationService.warning('Completa los pasos anteriores');
    return;
  }
  
  this.clientFlow.setCurrentStep(step);
}
Entregable:

Componente container refactorizado
Lógica de validación robusta
Tests E2E de flujo completo


ORDEN 4.2: Diseño UI/UX Moderno y Responsivo
Desarrollador asignado: Frontend Developer + UI Designer
Requisitos de diseño:
A) Sistema de diseño base (Design Tokens)
Crear archivo: src/styles/_design-tokens.scss
scss// Colores modernos - tema Blue Dragon
$primary: #2563eb; // Blue 600
$primary-dark: #1e40af; // Blue 700
$primary-light: #3b82f6; // Blue 500

$secondary: #8b5cf6; // Violet 500
$accent: #06b6d4; // Cyan 500

$success: #10b981; // Green 500
$warning: #f59e0b; // Amber 500
$error: #ef4444; // Red 500

$neutral-50: #f9fafb;
$neutral-100: #f3f4f6;
$neutral-200: #e5e7eb;
$neutral-300: #d1d5db;
$neutral-400: #9ca3af;
$neutral-500: #6b7280;
$neutral-600: #4b5563;
$neutral-700: #374151;
$neutral-800: #1f2937;
$neutral-900: #111827;

// Tipografía
$font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
$font-mono: 'JetBrains Mono', 'Fira Code', monospace;

// Espaciado
$spacing-xs: 0.25rem; // 4px
$spacing-sm: 0.5rem;  // 8px
$spacing-md: 1rem;    // 16px
$spacing-lg: 1.5rem;  // 24px
$spacing-xl: 2rem;    // 32px
$spacing-2xl: 3rem;   // 48px

// Radios
$radius-sm: 0.375rem; // 6px
$radius-md: 0.5rem;   // 8px
$radius-lg: 0.75rem;  // 12px
$radius-xl: 1rem;     // 16px

// Sombras modernas
$shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
$shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
$shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
$shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);

// Transiciones
$transition-fast: 150ms ease-in-out;
$transition-base: 200ms ease-in-out;
$transition-slow: 300ms ease-in-out;

// Breakpoints
$breakpoint-sm: 640px;
$breakpoint-md: 768px;
$breakpoint-lg: 1024px;
$breakpoint-xl: 1280px;
B) Componentes base reutilizables
Crear: src/app/shared/components/ui/
Lista de componentes a crear:

Button Component (button.component.ts)

typescript   // Props:
   variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
   size: 'sm' | 'md' | 'lg'
   loading: boolean
   disabled: boolean
   icon: string (lucide icon name)
   iconPosition: 'left' | 'right'

Card Component (card.component.ts)

typescript   // Props:
   elevation: 'sm' | 'md' | 'lg'
   padding: 'sm' | 'md' | 'lg'
   hoverable: boolean

Input Component (input.component.ts)

typescript   // Props:
   label: string
   placeholder: string
   type: 'text' | 'email' | 'password' | 'number'
   error: string
   icon: string

Badge Component (badge.component.ts)

typescript   // Props:
   variant: 'success' | 'warning' | 'error' | 'info'
   size: 'sm' | 'md'

Stepper Component (stepper.component.ts)

typescript   // Props:
   steps: StepConfig[]
   currentStep: number
   orientation: 'horizontal' | 'vertical'
```

**Especificaciones de diseño:**

- Usar Tailwind CSS utilities exclusivamente
- NO usar componentes externos (PrimeNG, Material, etc.) para ahorrar bundle size
- Implementar modo oscuro con CSS variables
- Animaciones sutiles con CSS transitions
- Iconos: lucide-react (ya instalado)

#### C) Layouts responsivos obligatorios

**Crear:** `src/app/shared/layouts/`

1. **MainLayout** (para app general)
```
   Estructura:
   - Header: 64px height, sticky
   - Sidebar: 256px width en desktop, drawer en mobile
   - Content: flex-1, padding responsive
   - Footer: auto height
   
   Breakpoints:
   - Mobile (<768px): Sidebar colapsado, header condensado
   - Tablet (768-1024px): Sidebar auto-hide
   - Desktop (>1024px): Sidebar visible
```

2. **ClientFlowLayout** (para flujo cliente)
```
   Estructura:
   - Progress bar top
   - Main content: max-width 800px, centered
   - Navigation: Fixed bottom en mobile, inline en desktop
   
   Features:
   - Animaciones entre pasos (slide transition)
   - Back button contextual
   - Progress indicator visual
```

3. **AdminDashboardLayout** (para admin)
```
   Estructura:
   - Header con stats rápidas
   - Grid 2 columnas en desktop, 1 en mobile
   - Sidebar con filtros colapsable
   
   Features:
   - Cards con datos en tiempo real (polling)
   - Gráficos responsivos (recharts)
   - Tabla adaptativa
Entregable:

Design system completo documentado
Componentes UI en Storybook (opcional pero recomendado)
Todos los layouts implementados y responsivos
Guía de uso de componentes


ORDEN 4.3: Implementar Animaciones y Micro-interacciones
Desarrollador asignado: Frontend Mid-Level
Framework: Angular Animations + CSS Transitions
Animaciones requeridas:
A) Transiciones entre pasos del client-flow
Crear: src/app/features/client-flow/animations/step-transition.animation.ts
typescriptexport const stepTransition = trigger('stepTransition', [
  transition(':increment', [
    style({ transform: 'translateX(100%)', opacity: 0 }),
    animate('300ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
  ]),
  transition(':decrement', [
    style({ transform: 'translateX(-100%)', opacity: 0 }),
    animate('300ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
  ])
]);
B) Loading states
Crear componente: src/app/shared/components/loading-spinner/loading-spinner.component.ts
typescript// Spinner con animación CSS pura (sin JavaScript)
// Diseño moderno: gradient spinner rotating
// Tamaños: sm (16px), md (24px), lg (40px)
C) Micro-interacciones en botones
scss// Hover effect
.btn {
  transition: all 200ms ease-in-out;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: $shadow-lg;
  }
  
  &:active {
    transform: translateY(0);
  }
}

// Loading state
.btn--loading {
  position: relative;
  pointer-events: none;
  
  &::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-radius: 50%;
    border-top-color: transparent;
    animation: spin 0.6s linear infinite;
  }
}
Entregable:

Animaciones implementadas en componentes clave
Performance: 60fps garantizado
Documentación de uso


🧪 FASE 5: TESTING Y VALIDACIÓN (Días 15-17)
ORDEN 5.1: Tests Unitarios de Servicios
Desarrollador asignado: QA Engineer + Backend Developer
Framework: Jasmine + Karma (ya configurado en Angular)
Tests obligatorios:
A) UnifiedQueueService
Archivo: src/app/core/services/unified-queue.service.spec.ts
Test cases mínimos:
typescriptdescribe('UnifiedQueueRetryFContinueService', () => {
let service: UnifiedQueueService;
let firestore: Firestore;
beforeEach(() => {
TestBed.configureTestingModule({
providers: [
UnifiedQueueService,
{ provide: Firestore, useValue: mockFirestore }
]
});
service = TestBed.inject(UnifiedQueueService);
});
describe('addEntry', () => {
it('debe crear entrada con status waiting', async () => {
const data = createMockQueueEntry();
const entryId = await service.addEntry(data);
expect(entryId).toBeDefined();
expect(entryId).toMatch(/^[a-zA-Z0-9]+$/);
});
it('debe rechazar entrada sin customerId', async () => {
  const data = { ...createMockQueueEntry(), customerId: '' };
  await expectAsync(service.addEntry(data)).toBeRejectedWithError();
});

it('debe asignar posición correcta en cola', async () => {
  // Simular 3 entradas existentes
  mockFirestore.collection.returns([entry1, entry2, entry3]);
  const data = createMockQueueEntry();
  await service.addEntry(data);
  expect(data.position).toBe(4);
});
});
describe('callNext', () => {
it('debe actualizar status a called y asignar técnico', async () => {
const technicianId = 'tech-123';
const entry = await service.callNext(technicianId);
expect(entry.status).toBe('called');
expect(entry.technicianId).toBe(technicianId);
expect(entry.calledAt).toBeDefined();
});
it('debe manejar race condition con transacción', async () => {
  // Simular 2 técnicos llamando simultáneamente
  const [result1, result2] = await Promise.all([
    service.callNext('tech-1'),
    service.callNext('tech-2')
  ]);
  // Solo uno debe obtener la entrada
  expect([result1, result2].filter(r => r !== null).length).toBe(1);
});

it('debe retornar null si no hay entradas waiting', async () => {
  mockFirestore.collection.returns([]);
  const entry = await service.callNext('tech-123');
  expect(entry).toBeNull();
});
});
describe('cache', () => {
it('debe usar cache para lecturas repetidas', async () => {
const entryId = 'entry-123';
await service.getEntryById(entryId);
await service.getEntryById(entryId);
// Verificar que solo se hizo 1 llamada a Firestore
expect(mockFirestore.doc).toHaveBeenCalledTimes(1);
});
it('debe invalidar cache al actualizar entrada', async () => {
  const entryId = 'entry-123';
  await service.getEntryById(entryId);
  await service.updateEntryStatus(entryId, 'called');
  await service.getEntryById(entryId);
  // Debe hacer 2 llamadas: una antes y una después del update
  expect(mockFirestore.doc).toHaveBeenCalledTimes(2);
});

it('debe expirar cache después de TTL', async () => {
  const entryId = 'entry-123';
  await service.getEntryById(entryId);
  // Avanzar tiempo 31 segundos (TTL = 30s)
  jasmine.clock().tick(31000);
  await service.getEntryById(entryId);
  expect(mockFirestore.doc).toHaveBeenCalledTimes(2);
});
});
describe('listener management', () => {
it('debe crear solo un listener activo', () => {
service.initQueueListener();
service.initQueueListener();
// Verificar que el listener anterior fue destruido
expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});
it('debe destruir listener en cleanup', () => {
  service.initQueueListener();
  service.destroyListener();
  expect(mockUnsubscribe).toHaveBeenCalled();
});
});
});

**Coverage mínimo requerido:** 80%

**Comandos:**
```bash
ng test --code-coverage
ng test --watch=false --browsers=ChromeHeadless
```

#### B) ClientFlowService

**Archivo:** `src/app/features/client-flow/services/client-flow.service.spec.ts`

**Test cases críticos:**
```typescript
describe('ClientFlowService', () => {
  let service: ClientFlowService;
  let unifiedQueue: jasmine.SpyObj<UnifiedQueueService>;
  
  beforeEach(() => {
    const queueSpy = jasmine.createSpyObj('UnifiedQueueService', 
      ['addEntry', 'getEntryById']);
    
    TestBed.configureTestingModule({
      providers: [
        ClientFlowService,
        { provide: UnifiedQueueService, useValue: queueSpy }
      ]
    });
    
    service = TestBed.inject(ClientFlowService);
    unifiedQueue = TestBed.inject(UnifiedQueueService) as jasmine.SpyObj<UnifiedQueueService>;
  });
  
  describe('completeFlow', () => {
    it('debe validar todos los pasos antes de completar', async () => {
      service.currentStep.set(3); // Solo 3 de 4 pasos
      await expectAsync(service.completeFlow()).toBeRejectedWithError('Flujo incompleto');
    });
    
    it('debe delegar creación de entrada a UnifiedQueueService', async () => {
      setupCompleteFlow(service);
      unifiedQueue.addEntry.and.returnValue(Promise.resolve('entry-123'));
      
      await service.completeFlow();
      
      expect(unifiedQueue.addEntry).toHaveBeenCalledWith(
        jasmine.objectContaining({
          customerId: jasmine.any(String),
          status: 'waiting',
          metadata: jasmine.objectContaining({
            clientFlowCompleted: true
          })
        })
      );
    });
    
    it('NO debe mantener copia local de queueEntry', async () => {
      setupCompleteFlow(service);
      unifiedQueue.addEntry.and.returnValue(Promise.resolve('entry-123'));
      
      await service.completeFlow();
      
      // Verificar que solo guarda el ID, no el objeto completo
      expect(service.currentQueueEntryId()).toBe('entry-123');
      expect((service as any).queueEntry).toBeUndefined();
    });
  });
  
  describe('getCurrentQueueStatus', () => {
    it('debe consultar UnifiedQueueService bajo demanda', async () => {
      service.currentQueueEntryId.set('entry-123');
      const mockEntry = createMockQueueEntry();
      unifiedQueue.getEntryById.and.returnValue(Promise.resolve(mockEntry));
      
      const status = await service.getCurrentQueueStatus();
      
      expect(unifiedQueue.getEntryById).toHaveBeenCalledWith('entry-123');
      expect(status).toEqual(mockEntry);
    });
    
    it('debe retornar null si no hay entrada activa', async () => {
      service.currentQueueEntryId.set(null);
      const status = await service.getCurrentQueueStatus();
      expect(status).toBeNull();
      expect(unifiedQueue.getEntryById).not.toHaveBeenCalled();
    });
  });
});
```

**Entregable:**
- Tests unitarios con 80%+ coverage
- Mock factories para datos de prueba
- Reporte de coverage en HTML

---

### ORDEN 5.2: Tests de Integración
**Desarrollador asignado:** QA Engineer

**Framework:** Jasmine + Angular Testing Library

**Escenarios críticos:**

#### A) Flujo completo cliente end-to-end

**Archivo:** `src/app/features/client-flow/client-flow-integration.spec.ts`
```typescript
describe('Client Flow Integration', () => {
  let fixture: ComponentFixture<ClientFlowContainerComponent>;
  let component: ClientFlowContainerComponent;
  
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ClientFlowModule,
        provideFirebaseApp(() => initializeApp(environment.firebase)),
        provideFirestore(() => getFirestore())
      ]
    }).compileComponents();
    
    fixture = TestBed.createComponent(ClientFlowContainerComponent);
    component = fixture.componentInstance;
  });
  
  it('debe completar flujo de 4 pasos y unirse a cola', async () => {
    // Paso 1: Seleccionar tipo de servicio
    const serviceButton = fixture.debugElement.query(By.css('[data-test="service-maintenance"]'));
    serviceButton.nativeElement.click();
    fixture.detectChanges();
    
    expect(component.clientFlow.currentStep()).toBe(1);
    expect(component.clientFlow.isStepCompleted(1)).toBeTrue();
    
    // Paso 2: Seleccionar motocicleta
    component.clientFlow.nextStep();
    fixture.detectChanges();
    
    const motorcycleCard = fixture.debugElement.query(By.css('[data-test="motorcycle-1"]'));
    motorcycleCard.nativeElement.click();
    fixture.detectChanges();
    
    expect(component.clientFlow.currentStep()).toBe(2);
    
    // Paso 3: Confirmar detalles
    component.clientFlow.nextStep();
    fixture.detectChanges();
    
    const confirmButton = fixture.debugElement.query(By.css('[data-test="confirm-details"]'));
    confirmButton.nativeElement.click();
    fixture.detectChanges();
    
    // Paso 4: Unirse a cola
    component.clientFlow.nextStep();
    fixture.detectChanges();
    
    const joinButton = fixture.debugElement.query(By.css('[data-test="join-queue"]'));
    joinButton.nativeElement.click();
    fixture.detectChanges();
    
    // Verificar que se creó entrada en Firestore
    await fixture.whenStable();
    expect(component.clientFlow.currentQueueEntryId()).toBeDefined();
    
    // Verificar navegación a wait-ticket
    expect(component.router.url).toBe('/client-flow/wait-ticket');
  });
  
  it('debe prevenir saltar pasos sin completar anteriores', () => {
    component.navigateToStep(3);
    fixture.detectChanges();
    
    // Debe mostrar warning y mantenerse en paso actual
    expect(component.clientFlow.currentStep()).toBe(1);
    expect(component.notificationService.warning).toHaveBeenCalledWith(
      'Completa los pasos anteriores'
    );
  });
});
```

#### B) Interacción Admin-Técnico-Cliente

**Archivo:** `src/app/features/admin/queue-management-integration.spec.ts`
```typescript
describe('Queue Management Integration', () => {
  it('debe reflejar cambios cuando técnico llama siguiente cliente', async () => {
    // Setup: Cliente en cola posición 1
    const clientEntry = await createTestQueueEntry({ position: 1 });
    
    // Admin abre dashboard
    const adminFixture = TestBed.createComponent(QueueManagementComponent);
    adminFixture.detectChanges();
    await adminFixture.whenStable();
    
    // Verificar que cliente aparece en lista
    const clientRow = adminFixture.debugElement.query(
      By.css(`[data-test="queue-entry-${clientEntry.id}"]`)
    );
    expect(clientRow).toBeTruthy();
    expect(clientRow.nativeElement.textContent).toContain('Posición: 1');
    
    // Técnico llama siguiente
    const techService = TestBed.inject(UnifiedQueueService);
    await techService.callNext('tech-123');
    
    // Admin actualiza (polling manual)
    const refreshButton = adminFixture.debugElement.query(By.css('[data-test="refresh"]'));
    refreshButton.nativeElement.click();
    adminFixture.detectChanges();
    await adminFixture.whenStable();
    
    // Verificar que estado cambió a 'called'
    const updatedRow = adminFixture.debugElement.query(
      By.css(`[data-test="queue-entry-${clientEntry.id}"]`)
    );
    expect(updatedRow.nativeElement.textContent).toContain('Estado: Llamado');
  });
});
```

**Entregable:**
- Tests de integración con escenarios reales
- Setup de datos de prueba automatizado
- Documentación de casos de prueba

---

### ORDEN 5.3: Tests E2E con Cypress
**Desarrollador asignado:** QA Lead

**Framework:** Cypress (instalar si no existe)

**Instalación:**
```bash
npm install --save-dev cypress
npx cypress open
```

**Configuración:** `cypress.config.ts`
```typescript
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts'
  },
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack'
    },
    specPattern: '**/*.cy.ts'
  }
});
```

**Tests E2E críticos:**

#### A) Flujo cliente completo

**Archivo:** `cypress/e2e/client-flow.cy.ts`
```typescript
describe('Client Flow E2E', () => {
  beforeEach(() => {
    // Login como customer
    cy.login('customer@test.com', 'password123');
    cy.visit('/client-flow');
  });
  
  it('debe completar flujo completo y mostrar ticket', () => {
    // Paso 1: Tipo de servicio
    cy.get('[data-cy="service-maintenance"]').click();
    cy.get('[data-cy="next-step"]').should('be.enabled').click();
    
    // Paso 2: Seleccionar moto
    cy.get('[data-cy="motorcycle-card"]').first().click();
    cy.get('[data-cy="next-step"]').click();
    
    // Paso 3: Confirmar detalles
    cy.get('[data-cy="service-type"]').should('contain', 'Mantenimiento');
    cy.get('[data-cy="confirm-details"]').click();
    
    // Paso 4: Unirse a cola
    cy.get('[data-cy="join-queue"]').click();
    
    // Verificar navegación a ticket
    cy.url().should('include', '/wait-ticket');
    
    // Verificar datos del ticket
    cy.get('[data-cy="ticket-number"]').should('exist');
    cy.get('[data-cy="queue-position"]').should('contain', /\d+/);
    cy.get('[data-cy="estimated-time"]').should('exist');
    cy.get('[data-cy="qr-code"]').should('be.visible');
  });
  
  it('debe prevenir completar flujo sin todos los pasos', () => {
    // Intentar saltar directo a paso 4
    cy.visit('/client-flow?step=4');
    
    // Debe redirigir a paso 1
    cy.url().should('include', 'step=1');
    cy.get('[data-cy="notification-warning"]').should('contain', 'Completa los pasos anteriores');
  });
  
  it('debe actualizar posición en tiempo real', () => {
    // Completar flujo
    cy.completeClientFlow();
    
    // Capturar posición inicial
    cy.get('[data-cy="queue-position"]').invoke('text').then((initialPosition) => {
      const position = parseInt(initialPosition);
      
      // Simular que técnico llama cliente anterior (mock backend)
      cy.task('callNextInQueue');
      
      // Esperar actualización (polling cada 5s)
      cy.wait(6000);
      
      // Verificar que posición decrementó
      cy.get('[data-cy="queue-position"]').should('contain', position - 1);
    });
  });
});
```

#### B) Gestión de cola por admin

**Archivo:** `cypress/e2e/admin-queue-management.cy.ts`
```typescript
describe('Admin Queue Management E2E', () => {
  beforeEach(() => {
    cy.login('admin@test.com', 'admin123');
    cy.visit('/admin/queue');
  });
  
  it('debe mostrar lista de clientes en cola', () => {
    cy.get('[data-cy="queue-table"]').should('be.visible');
    cy.get('[data-cy="queue-entry"]').should('have.length.greaterThan', 0);
    
    // Verificar columnas
    cy.get('[data-cy="column-position"]').should('exist');
    cy.get('[data-cy="column-customer"]').should('exist');
    cy.get('[data-cy="column-service"]').should('exist');
    cy.get('[data-cy="column-status"]').should('exist');
    cy.get('[data-cy="column-actions"]').should('exist');
  });
  
  it('debe actualizar lista al hacer refresh manual', () => {
    // Capturar timestamp inicial
    cy.get('[data-cy="last-update"]').invoke('text').then((initialTime) => {
      // Click en refresh
      cy.get('[data-cy="refresh-button"]').click();
      
      // Verificar loading
      cy.get('[data-cy="loading-spinner"]').should('be.visible');
      cy.get('[data-cy="loading-spinner"]').should('not.exist');
      
      // Verificar que timestamp cambió
      cy.get('[data-cy="last-update"]').invoke('text').should('not.equal', initialTime);
    });
  });
  
  it('debe permitir eliminar entrada de cola', () => {
    // Seleccionar primera entrada
    cy.get('[data-cy="queue-entry"]').first().within(() => {
      cy.get('[data-cy="entry-id"]').invoke('text').then((entryId) => {
        // Click en eliminar
        cy.get('[data-cy="delete-button"]').click();
        
        // Confirmar modal
        cy.get('[data-cy="confirm-delete"]').click();
        
        // Verificar que desapareció
        cy.get(`[data-cy="queue-entry-${entryId}"]`).should('not.exist');
      });
    });
  });
});
```

#### C) Guards de seguridad

**Archivo:** `cypress/e2e/security-guards.cy.ts`
```typescript
describe('Security Guards E2E', () => {
  it('debe bloquear acceso de admin a client-flow', () => {
    cy.login('admin@test.com', 'admin123');
    cy.visit('/client-flow');
    
    // Debe redirigir a unauthorized
    cy.url().should('include', '/unauthorized');
    cy.get('[data-cy="error-message"]').should('contain', 'No tienes permiso');
  });
  
  it('debe bloquear acceso de customer a admin panel', () => {
    cy.login('customer@test.com', 'password123');
    cy.visit('/admin/queue');
    
    cy.url().should('include', '/unauthorized');
  });
  
  it('debe permitir solo a customer acceder a client-flow', () => {
    cy.login('customer@test.com', 'password123');
    cy.visit('/client-flow');
    
    cy.url().should('include', '/client-flow');
    cy.get('[data-cy="flow-container"]').should('be.visible');
  });
});
```

**Comandos custom de Cypress:**

**Archivo:** `cypress/support/commands.ts`
```typescript
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      completeClientFlow(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login');
  cy.get('[data-cy="email-input"]').type(email);
  cy.get('[data-cy="password-input"]').type(password);
  cy.get('[data-cy="login-button"]').click();
  cy.url().should('not.include', '/login');
});

Cypress.Commands.add('completeClientFlow', () => {
  cy.visit('/client-flow');
  cy.get('[data-cy="service-maintenance"]').click();
  cy.get('[data-cy="next-step"]').click();
  cy.get('[data-cy="motorcycle-card"]').first().click();
  cy.get('[data-cy="next-step"]').click();
  cy.get('[data-cy="confirm-details"]').click();
  cy.get('[data-cy="join-queue"]').click();
  cy.url().should('include', '/wait-ticket');
});
```

**Ejecutar tests:**
```bash
# Modo interactivo
npx cypress open

# Modo headless
npx cypress run

# Solo un archivo
npx cypress run --spec "cypress/e2e/client-flow.cy.ts"
```

**Entregable:**
- Suite completa de tests E2E
- Videos de tests ejecutándose
- Reportes de resultados

---

### ORDEN 5.4: Tests de Seguridad de Firestore Rules
**Desarrollador asignado:** Backend Developer

**Framework:** Firebase Emulator + @firebase/rules-unit-testing

**Instalación:**
```bash
npm install --save-dev @firebase/rules-unit-testing
firebase init emulators
# Seleccionar: Firestore, Authentication
```

**Archivo:** `test/firestore-rules.spec.ts`
```typescript
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { setDoc, getDoc, doc, updateDoc } from 'firebase/firestore';

describe('Firestore Security Rules', () => {
  let testEnv: RulesTestEnvironment;
  
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'blue-dragon-test',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
        host: 'localhost',
        port: 8080
      }
    });
  });
  
  afterAll(async () => {
    await testEnv.cleanup();
  });
  
  afterEach(async () => {
    await testEnv.clearFirestore();
  });
  
  describe('Queue Entries', () => {
    it('debe permitir a customer crear su propia entrada', async () => {
      const customer = testEnv.authenticatedContext('customer-1', {
        role: 'customer'
      });
      
      await assertSucceeds(
        setDoc(doc(customer.firestore(), 'queues/2025-01-15/entries/entry-1'), {
          customerId: 'customer-1',
          status: 'waiting',
          position: 1,
          createdAt: new Date(),
          metadata: { clientFlowCompleted: true }
        })
      );
    });
    
    it('debe rechazar customer creando entrada para otro usuario', async () => {
      const customer = testEnv.authenticatedContext('customer-1', {
        role: 'customer'
      });
      
      await assertFails(
        setDoc(doc(customer.firestore(), 'queues/2025-01-15/entries/entry-1'), {
          customerId: 'customer-2', // ID diferente!
          status: 'waiting',
          position: 1,
          createdAt: new Date()
        })
      );
    });
    
    it('debe rechazar customer creando entrada con status diferente a waiting', async () => {
      const customer = testEnv.authenticatedContext('customer-1', {
        role: 'customer'
      });
      
      await assertFails(
        setDoc(doc(customer.firestore(), 'queues/2025-01-15/entries/entry-1'), {
          customerId: 'customer-1',
          status: 'called', // No permitido!
          position: 1,
          createdAt: new Date()
        })
      );
    });
    
    it('debe permitir a técnico leer entradas activas', async () => {
      // Setup: Crear entrada como admin
      const admin = testEnv.authenticatedContext('admin-1', { role: 'admin' });
      await setDoc(doc(admin.firestore(), 'queues/2025-01-15/entries/entry-1'), {
        customerId: 'customer-1',
        status: 'waiting',
        position: 1
      });
      
      // Test: Técnico puede leer
      const technician = testEnv.authenticatedContext('tech-1', {
        role: 'technician'
      });
      
      await assertSucceeds(
        getDoc(doc(technician.firestore(), 'queues/2025-01-15/entries/entry-1'))
      );
    });
    
    it('debe permitir a técnico actualizar entrada para llamar cliente', async () => {
      // Setup
      const admin = testEnv.authenticatedContext('admin-1', { role: 'admin' });
      await setDoc(doc(admin.firestore(), 'queues/2025-01-15/entries/entry-1'), {
        customerId: 'customer-1',
        status: 'waiting',
        position: 1,
        technicianId: null
      });
      
      // Test
      const technician = testEnv.authenticatedContext('tech-1', {
        role: 'technician'
      });
      
      await assertSucceeds(
        updateDoc(doc(technician.firestore(), 'queues/2025-01-15/entries/entry-1'), {
          status: 'called',
          technicianId: 'tech-1',
          calledAt: new Date()
        })
      );
    });
    
    it('debe rechazar técnico asignando entrada a otro técnico', async () => {
      const admin = testEnv.authenticatedContext('admin-1', { role: 'admin' });
      await setDoc(doc(admin.firestore(), 'queues/2025-01-15/entries/entry-1'), {
        customerId: 'customer-1',
        status: 'waiting',
        technicianId: null
      });
      
      const technician = testEnv.authenticatedContext('tech-1', {
        role: 'technician'
      });
      
      await assertFails(
        updateDoc(doc(technician.firestore(), 'queues/2025-01-15/entries/entry-1'), {
          status: 'called',
          technicianId: 'tech-2' // ID diferente!
        })
      );
    });
    
    it('debe rechazar admin/técnico accediendo a client-flow', async () => {
      // Esta prueba es más conceptual, ya que el guard se maneja en frontend
      // Pero podemos verificar que no pueden crear entries "en nombre de" customers
      
      const admin = testEnv.authenticatedContext('admin-1', { role: 'admin' });
      
      // Admin puede crear, pero debe seguir reglas de validación
      await assertSucceeds(
        setDoc(doc(admin.firestore(), 'queues/2025-01-15/entries/entry-1'), {
          customerId: 'customer-1',
          status: 'waiting',
          position: 1,
          metadata: { sourceApp: 'admin-override' }
        })
      );
    });
  });
  
  describe('Motorcycles', () => {
    it('debe permitir a customer crear su propia moto', async () => {
      const customer = testEnv.authenticatedContext('customer-1', {
        role: 'customer'
      });
      
      await assertSucceeds(
        setDoc(doc(customer.firestore(), 'motorcycles/moto-1'), {
          ownerId: 'customer-1',
          brand: 'Yamaha',
          model: 'MT-07',
          year: 2023
        })
      );
    });
    
    it('debe rechazar customer creando moto para otro usuario', async () => {
      const customer = testEnv.authenticatedContext('customer-1', {
        role: 'customer'
      });
      
      await assertFails(
        setDoc(doc(customer.firestore(), 'motorcycles/moto-1'), {
          ownerId: 'customer-2',
          brand: 'Honda',
          model: 'CB500F'
        })
      );
    });
  });
});
```

**Ejecutar tests:**
```bash
# Iniciar emulator
firebase emulators:start --only firestore,auth

# En otra terminal, ejecutar tests
npm run test:security-rules
```

**Script en package.json:**
```json
{
  "scripts": {
    "test:security-rules": "jest test/firestore-rules.spec.ts --runInBand"
  }
}
```

**Entregable:**
- Tests de security rules con 100% coverage
- Documentación de permisos
- CI/CD pipeline que ejecuta estos tests

---

## 🚀 FASE 6: OPTIMIZACIÓN Y MONITOREO (Días 18-20)

### ORDEN 6.1: Implementar Monitoreo de Performance
**Desarrollador asignado:** DevOps Engineer

**Herramientas:** Firebase Performance Monitoring (GRATIS en Spark Plan)

**Configuración:**

#### A) Instalar Firebase Performance
```bash
npm install firebase
```

#### B) Inicializar en app

**Archivo:** `src/main.ts`
```typescript
import { initializeApp } from 'firebase/app';
import { getPerformance } from 'firebase/performance';
import { environment } from './environments/environment';

const app = initializeApp(environment.firebase);
const perf = getPerformance(app);

// Performance monitoring se activa automáticamente
```

#### C) Instrumentar operaciones críticas

**Archivo:** `src/app/core/services/unified-queue.service.ts`
```typescript
import { trace } from 'firebase/performance';

async addEntry(data: QueueEntryData): Promise<string> {
  const traceInstance = trace(perf, 'queue_add_entry');
  traceInstance.start();
  
  try {
    // ... lógica existente
    const entryId = await this.createEntry(data);
    
    traceInstance.putMetric('entry_position', data.position);
    traceInstance.putAttribute('service_type', data.serviceType);
    
    return entryId;
  } catch (error) {
    traceInstance.putAttribute('error',