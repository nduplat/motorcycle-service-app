# Documentación Completa de Endpoints y Servicios CRUD - Blue Dragon Motors

## Índice
1. [Endpoints del Servidor (Backend API)](#endpoints-servidor)
2. [Rutas del Frontend (Angular Routes)](#rutas-frontend)
3. [Servicios CRUD de Angular](#servicios-crud)

---

## Endpoints del Servidor (Backend API)

### 1. Health Check
- **Método**: GET
- **Ruta**: `/health`
- **Autenticación**: No requerida
- **Descripción**: Verifica el estado del servidor, servicios AI disponibles, estadísticas de caché, circuit breakers y balanceo de carga.
- **Parámetros**: Ninguno
- **Respuesta**: JSON con estado, servicios, caché, circuit breakers y uptime.

### 2. Groq Chat Completions
- **Método**: POST
- **Ruta**: `/api/ai/groq/chat/completions`
- **Autenticación**: Requerida (Firebase/API key)
- **Descripción**: Genera respuestas de chat usando Groq API (compatible con OpenAI).
- **Parámetros**: `messages`, `model` (opcional), `temperature` (opcional), `max_tokens` (opcional), otros parámetros OpenAI.
- **Respuesta**: Respuesta de chat completions con metadatos adicionales (provider, responseTime).

### 3. Groq Responses
- **Método**: POST
- **Ruta**: `/api/ai/groq/responses`
- **Autenticación**: Requerida
- **Descripción**: Genera respuestas usando el formato de responses de Groq.
- **Parámetros**: `input`, `instructions` (opcional), `model`, `temperature`, `max_output_tokens`.
- **Respuesta**: Objeto response con output formateado.

### 4. Groq Audio Transcription
- **Método**: POST
- **Ruta**: `/api/ai/groq/audio/transcriptions`
- **Autenticación**: Requerida
- **Descripción**: Transcribe audio (placeholder - no implementado).
- **Parámetros**: Archivo de audio
- **Respuesta**: Texto transcrito (placeholder).

### 5. Groq Audio Translation
- **Método**: POST
- **Ruta**: `/api/ai/groq/audio/translations`
- **Autenticación**: Requerida
- **Descripción**: Traduce audio (placeholder - no implementado).
- **Parámetros**: Archivo de audio
- **Respuesta**: Texto traducido (placeholder).

### 6. Groq Audio Speech
- **Método**: POST
- **Ruta**: `/api/ai/groq/audio/speech`
- **Autenticación**: Requerida
- **Descripción**: Genera audio desde texto (placeholder - no implementado).
- **Parámetros**: Texto y opciones
- **Respuesta**: Audio generado (placeholder).

### 7. List Groq Models
- **Método**: GET
- **Ruta**: `/api/ai/groq/models`
- **Autenticación**: Requerida
- **Descripción**: Lista modelos disponibles de Groq.
- **Parámetros**: Ninguno
- **Respuesta**: Lista de modelos (llama-3.3-70b-versatile, llama-3.1-8b-instant, gemma2-9b-it).

### 8. Retrieve Groq Model
- **Método**: GET
- **Ruta**: `/api/ai/groq/models/:model`
- **Autenticación**: Requerida
- **Descripción**: Obtiene detalles de un modelo específico.
- **Parámetros**: `model` (path parameter)
- **Respuesta**: Detalles del modelo.

### 9. Create Groq Batch
- **Método**: POST
- **Ruta**: `/api/ai/groq/batches`
- **Autenticación**: Requerida
- **Descripción**: Crea un batch job (no implementado).
- **Parámetros**: Configuración del batch
- **Respuesta**: Error 501 (not implemented).

### 10. Retrieve Groq Batch
- **Método**: GET
- **Ruta**: `/api/ai/groq/batches/:batchId`
- **Autenticación**: Requerida
- **Descripción**: Obtiene estado de un batch (no implementado).
- **Parámetros**: `batchId` (path parameter)
- **Respuesta**: Error 501.

### 11. List Groq Batches
- **Método**: GET
- **Ruta**: `/api/ai/groq/batches`
- **Autenticación**: Requerida
- **Descripción**: Lista batches (no implementado).
- **Parámetros**: Ninguno
- **Respuesta**: Error 501.

### 12. Cancel Groq Batch
- **Método**: POST
- **Ruta**: `/api/ai/groq/batches/:batchId/cancel`
- **Autenticación**: Requerida
- **Descripción**: Cancela un batch (no implementado).
- **Parámetros**: `batchId` (path parameter)
- **Respuesta**: Error 501.

### 13. Upload Groq File
- **Método**: POST
- **Ruta**: `/api/ai/groq/files`
- **Autenticación**: Requerida
- **Descripción**: Sube archivo (no implementado).
- **Parámetros**: Archivo
- **Respuesta**: Error 501.

### 14. List Groq Files
- **Método**: GET
- **Ruta**: `/api/ai/groq/files`
- **Autenticación**: Requerida
- **Descripción**: Lista archivos (no implementado).
- **Parámetros**: Ninguno
- **Respuesta**: Error 501.

### 15. Retrieve Groq File
- **Método**: GET
- **Ruta**: `/api/ai/groq/files/:fileId`
- **Autenticación**: Requerida
- **Descripción**: Obtiene archivo (no implementado).
- **Parámetros**: `fileId` (path parameter)
- **Respuesta**: Error 501.

### 16. Download Groq File
- **Método**: GET
- **Ruta**: `/api/ai/groq/files/:fileId/content`
- **Autenticación**: Requerida
- **Descripción**: Descarga archivo (no implementado).
- **Parámetros**: `fileId` (path parameter)
- **Respuesta**: Error 501.

### 17. Delete Groq File
- **Método**: DELETE
- **Ruta**: `/api/ai/groq/files/:fileId`
- **Autenticación**: Requerida
- **Descripción**: Elimina archivo (no implementado).
- **Parámetros**: `fileId` (path parameter)
- **Respuesta**: Error 501.

### 18. Create Groq Fine-tuning
- **Método**: POST
- **Ruta**: `/api/ai/groq/fine_tunings`
- **Autenticación**: Requerida
- **Descripción**: Crea fine-tuning job (no implementado).
- **Parámetros**: Configuración de fine-tuning
- **Respuesta**: Error 501.

### 19. List Groq Fine-tunings
- **Método**: GET
- **Ruta**: `/api/ai/groq/fine_tunings`
- **Autenticación**: Requerida
- **Descripción**: Lista fine-tunings (no implementado).
- **Parámetros**: Ninguno
- **Respuesta**: Error 501.

### 20. Get Groq Fine-tuning
- **Método**: GET
- **Ruta**: `/api/ai/groq/fine_tunings/:id`
- **Autenticación**: Requerida
- **Descripción**: Obtiene fine-tuning (no implementado).
- **Parámetros**: `id` (path parameter)
- **Respuesta**: Error 501.

### 21. Delete Groq Fine-tuning
- **Método**: DELETE
- **Ruta**: `/api/ai/groq/fine_tunings/:id`
- **Autenticación**: Requerida
- **Descripción**: Elimina fine-tuning (no implementado).
- **Parámetros**: `id` (path parameter)
- **Respuesta**: Error 501.

### 22. Legacy Groq Chat
- **Método**: POST
- **Ruta**: `/api/ai/groq/chat`
- **Autenticación**: Requerida
- **Descripción**: Endpoint legacy para chat con Groq.
- **Parámetros**: `messages`, `options`
- **Respuesta**: Respuesta de chat.

### 23. Legacy Groq Generate
- **Método**: POST
- **Ruta**: `/api/ai/groq/generate`
- **Autenticación**: Requerida
- **Descripción**: Genera texto con Groq (con balanceo de carga y caché).
- **Parámetros**: `input`, `instructions`, `options`
- **Respuesta**: Texto generado con metadatos.

### 24. Legacy Groq Analyze
- **Método**: POST
- **Ruta**: `/api/ai/groq/analyze`
- **Autenticación**: Requerida
- **Descripción**: Analiza texto usando Groq para Blue Dragon Motors.
- **Parámetros**: `text`, `analysisType`, `context`
- **Respuesta**: Análisis generado.

### 25. OpenAI Chat Completions
- **Método**: POST
- **Ruta**: `/api/ai/openai/chat/completions`
- **Autenticación**: Requerida
- **Descripción**: Genera respuestas de chat usando OpenAI.
- **Parámetros**: `messages`, `options`
- **Respuesta**: Respuesta de chat completions.

### 26. OpenAI Completions
- **Método**: POST
- **Ruta**: `/api/ai/openai/completions`
- **Autenticación**: Requerida
- **Descripción**: Genera texto usando OpenAI.
- **Parámetros**: `input`, `instructions`, `options`
- **Respuesta**: Texto generado.

### 27. Admin Usage Stats
- **Método**: GET
- **Ruta**: `/api/admin/usage`
- **Autenticación**: Admin requerida
- **Descripción**: Obtiene estadísticas de uso de la API.
- **Parámetros**: Ninguno
- **Respuesta**: Estadísticas de requests, tokens, errores por provider.

---

## Rutas del Frontend (Angular Routes)

### Rutas Públicas
- `/` - HomeComponent - Página principal
- `/login` - LoginComponent - Inicio de sesión
- `/onboarding` - OnboardingComponent - Completar perfil (requiere auth, rol: customer)
- `/inventory` - InventoryComponent - Repuestos
- `/services` - ServicesPageComponent - Servicios
- `/appointments` - AppointmentsPageComponent - Citas (requiere auth, rol: customer)
- `/offers` - OffersPageComponent - Ofertas
- `/contact` - ContactPageComponent - Contacto
- `/queue/join` - QueueJoinComponent - Unirse a la cola

### Rutas Protegidas de Cliente
- `/account` - AccountComponent - Mi cuenta (requiere auth, roles: customer, employee, admin)

### Rutas Protegidas de Empleado
- `/employee` - EmployeeDashboardComponent - Panel de empleado (requiere auth, roles: employee, technician)

### Rutas Protegidas de Checkout
- `/checkout` - CheckoutComponent - Checkout (requiere auth, rol: customer)

### Rutas Protegidas de Admin
- `/admin` - AdminLayoutComponent - Panel de administración (requiere auth, roles: admin, manager, technician, front_desk)
  - `/admin/` - AdminDashboardComponent - Dashboard
  - `/admin/motorcycles` - MotorcycleManagementComponent - Gestión de motocicletas
  - `/admin/products` - ProductListComponent - Gestión de productos
  - `/admin/products/new` - ProductFormComponent - Nuevo producto
  - `/admin/products/:id/edit` - ProductFormComponent - Editar producto
  - `/admin/suppliers` - SupplierManagementComponent - Gestión de proveedores
  - `/admin/purchase-orders` - PurchaseOrderListComponent - Órdenes de compra
  - `/admin/purchase-orders/new` - PurchaseOrderFormComponent - Nueva orden de compra
  - `/admin/purchase-orders/:id/edit` - PurchaseOrderFormComponent - Editar orden de compra
  - `/admin/stock-movements` - StockMovementComponent - Movimientos de stock
  - `/admin/services` - ServiceManagementComponent - Catálogo de servicios
  - `/admin/work-orders` - WorkOrderListComponent - Órdenes de trabajo
  - `/admin/work-orders/:id` - WorkOrderFormComponent - Detalle orden de trabajo
  - `/admin/schedule` - ScheduleComponent - Agenda
  - `/admin/users` - UserManagementComponent - Gestión de usuarios (requiere roles: admin, manager)
  - `/admin/scanner` - ScannerComponent - Escáner IA de repuestos
  - `/admin/qr-generator` - QrGeneratorComponent - Generador de códigos QR (requiere roles: admin, manager)
  - `/admin/notifications` - NotificationManagementComponent - Gestión de notificaciones
  - `/admin/queue` - QueueManagementComponent - Gestión de cola

---

## Servicios CRUD de Angular

### ProductService
**Colección Firestore**: `products`

#### Métodos CRUD Principales:
- `getProducts()`: Signal<Product[]> - Obtiene todos los productos
- `getProduct(id: string)`: Observable<Product | undefined> - Obtiene un producto por ID
- `addProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>)`: Observable<Product> - Crea un nuevo producto
- `updateProduct(updatedProduct: Product)`: Observable<Product> - Actualiza un producto existente
- `deleteProduct(id: string)`: Observable<boolean> - Elimina un producto (soft delete - marca como inactivo)

#### Métodos Adicionales:
- `getFilteredProducts(filters?)`: Product[] - Filtra productos por categoría, marca, ubicación, stock bajo, etc.
- `updateStock(productId, newStock, reason, userId?)`: Observable<void> - Actualiza stock de producto
- `getLowStockProducts()`: Product[] - Obtiene productos con stock bajo
- `getProductsByCompatibility(motorcycleId)`: Product[] - Productos compatibles con una motocicleta
- `transferProductToLocation(productId, newLocationId, userId?)`: Observable<void> - Transfiere producto a otra ubicación
- `reserveProduct(productId, quantity, workOrderId, userId?)`: Observable<void> - Reserva producto para orden de trabajo
- `releaseReservation(productId, quantity, workOrderId, userId?)`: Observable<void> - Libera reserva de producto
- `getAvailableStock(productId)`: number - Obtiene stock disponible (total - reservado)
- `getReservedProducts()`: Product[] - Obtiene productos con reservas

### UserService
**Colección Firestore**: `users`

#### Métodos CRUD Principales:
- `getUsers()`: Signal<User[]> - Obtiene todos los usuarios
- `getUserById(id: string)`: User | undefined - Obtiene un usuario por ID
- `addUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>)`: Observable<User> - Crea un nuevo usuario
- `updateUser(updatedUser: Partial<User> & { id: string })`: Observable<User> - Actualiza un usuario existente
- `deactivateUser(userId: string)`: Observable<User> - Desactiva usuario (soft delete)
- `reactivateUser(userId: string)`: Observable<User> - Reactiva usuario
- `deleteUser(userId: string)`: Observable<void> - Elimina usuario permanentemente (solo super admins)

#### Métodos Adicionales:
- `getUsersAsMap()`: Map<string, User> - Obtiene usuarios como mapa
- `getTechnicians()`: User[] - Obtiene técnicos
- `searchUsers(searchTerm, filters?)`: User[] - Busca usuarios con filtros
- `getUsersByRole(role)`: User[] - Obtiene usuarios por rol
- `getActiveUsers()`: User[] - Obtiene usuarios activos
- `getInactiveUsers()`: User[] - Obtiene usuarios inactivos
- `getUsersCreatedInDateRange(startDate, endDate)`: User[] - Usuarios creados en rango de fechas

### MotorcycleService
**Colección Firestore**: `motorcycles` y `vehicles`

#### Métodos CRUD Principales:
- `getMotorcycles()`: Signal<Motorcycle[]> - Obtiene todas las motocicletas
- `addMotorcycle(motorcycle: Omit<Motorcycle, 'id'>)`: Observable<Motorcycle> - Crea una nueva motocicleta
- `updateMotorcycle(updatedMotorcycle: Motorcycle)`: Observable<Motorcycle> - Actualiza una motocicleta
- `deleteMotorcycle(id: string)`: Observable<boolean> - Elimina una motocicleta

#### Métodos Adicionales:
- `getVehiclesForUser(userId)`: Observable<Vehicle[]> - Obtiene vehículos de un usuario
- `getMotorcyclesGroupedByCategory()`: Record<string, Motorcycle[]> - Agrupa por categoría
- `getMotorcyclesGroupedByType()`: Record<string, Motorcycle[]> - Agrupa por tipo
- `getMotorcyclesGroupedByBrand()`: Record<string, Motorcycle[]> - Agrupa por marca
- `searchMotorcycles(query, filters?)`: Motorcycle[] - Busca motocicletas
- `getMotorcyclesByCategory(category)`: Motorcycle[] - Por categoría específica
- `getMotorcyclesByType(type)`: Motorcycle[] - Por tipo específico
- `getMotorcyclesByBrand(brand)`: Motorcycle[] - Por marca específica
- `getMotorcyclesByYear(year)`: Motorcycle[] - Por año
- `getMotorcyclesByYearRange(minYear, maxYear)`: Motorcycle[] - Por rango de años
- `getActiveMotorcycles()`: Motorcycle[] - Motocicletas activas

### WorkOrderService
**Colección Firestore**: `work-orders`

#### Métodos CRUD Principales:
- `getWorkOrders()`: Signal<WorkOrder[]> - Obtiene todas las órdenes de trabajo
- `getWorkOrder(id)`: Observable<WorkOrder | undefined> - Obtiene una orden por ID
- `createWorkOrder(workOrder)`: Observable<WorkOrder> - Crea nueva orden de trabajo
- `updateWorkOrder(workOrder)`: Observable<WorkOrder> - Actualiza orden de trabajo
- `deleteWorkOrder(id)`: Observable<void> - Elimina orden de trabajo

#### Métodos Adicionales:
- Métodos para gestión de estados, asignación de técnicos, productos utilizados, etc.

### PurchaseOrderService
**Colección Firestore**: `purchase-orders`

#### Métodos CRUD Principales:
- `getPurchaseOrders()`: Signal<PurchaseOrder[]> - Obtiene todas las órdenes de compra
- `getPurchaseOrder(id)`: Observable<PurchaseOrder | undefined> - Obtiene una orden por ID
- `createPurchaseOrder(order)`: Observable<PurchaseOrder> - Crea nueva orden de compra
- `updatePurchaseOrder(order)`: Observable<PurchaseOrder> - Actualiza orden de compra
- `deletePurchaseOrder(id)`: Observable<void> - Elimina orden de compra

### SupplierService
**Colección Firestore**: `suppliers`

#### Métodos CRUD Principales:
- `getSuppliers()`: Signal<Supplier[]> - Obtiene todos los proveedores
- `getSupplier(id)`: Observable<Supplier | undefined> - Obtiene un proveedor por ID
- `addSupplier(supplier)`: Observable<Supplier> - Crea nuevo proveedor
- `updateSupplier(supplier)`: Observable<Supplier> - Actualiza proveedor
- `deleteSupplier(id)`: Observable<void> - Elimina proveedor

### ServiceItemService
**Colección Firestore**: `services`

#### Métodos CRUD Principales:
- `getServices()`: Signal<ServiceItem[]> - Obtiene todos los servicios
- `getService(id)`: Observable<ServiceItem | undefined> - Obtiene un servicio por ID
- `addService(service)`: Observable<ServiceItem> - Crea nuevo servicio
- `updateService(service)`: Observable<ServiceItem> - Actualiza servicio
- `deleteService(id)`: Observable<void> - Elimina servicio

### AppointmentService
**Colección Firestore**: `appointments`

#### Métodos CRUD Principales:
- `getAppointments()`: Signal<Appointment[]> - Obtiene todas las citas
- `getAppointment(id)`: Observable<Appointment | undefined> - Obtiene una cita por ID
- `createAppointment(appointment)`: Observable<Appointment> - Crea nueva cita
- `updateAppointment(appointment)`: Observable<Appointment> - Actualiza cita
- `cancelAppointment(id)`: Observable<void> - Cancela cita

### QueueService
**Colección Firestore**: `queue`

#### Métodos CRUD Principales:
- `getQueueEntries()`: Signal<QueueEntry[]> - Obtiene entradas de cola
- `addToQueue(entry)`: Observable<QueueEntry> - Agrega a cola
- `updateQueueEntry(entry)`: Observable<QueueEntry> - Actualiza entrada
- `removeFromQueue(id)`: Observable<void> - Remueve de cola

### StockMovementService
**Colección Firestore**: `stock-movements`

#### Métodos CRUD Principales:
- `getMovements()`: Signal<StockMovement[]> - Obtiene movimientos de stock
- `createMovement(movement)`: Observable<StockMovement> - Crea movimiento
- `getMovementsByProduct(productId)`: StockMovement[] - Movimientos por producto
- `getMovementsByDateRange(start, end)`: StockMovement[] - Movimientos por fecha

### NotificationService
**Colección Firestore**: `notifications`

#### Métodos CRUD Principales:
- `getNotifications()`: Signal<Notification[]> - Obtiene notificaciones
- `createNotification(notification)`: Observable<Notification> - Crea notificación
- `markAsRead(id)`: Observable<void> - Marca como leída
- `deleteNotification(id)`: Observable<void> - Elimina notificación

### AuthService
**Colección Firestore**: `users`

#### Métodos CRUD Relacionados:
- `login(email, password)`: Observable<User> - Autenticación
- `register(userData)`: Observable<User> - Registro
- `logout()`: void - Cierre de sesión
- `currentUser()`: User | null - Usuario actual
- `updateProfile(userData)`: Observable<User> - Actualizar perfil

---

## Servicios Adicionales (No CRUD Principales)

### AIServices
- **GroqService**: Comunicación con Groq AI API
- **GeminiService**: Comunicación con Google Gemini AI
- **AIAssistantService**: Asistente IA integrado

### Servicios de Notificaciones
- **NotificationService**: Gestión de notificaciones push y audio
- **NotificationManagerService**: Gestión centralizada de notificaciones
- **AutomatedNotificationService**: Notificaciones automáticas
- **LowStockNotificationService**: Alertas de stock bajo
- **MaintenanceNotificationService**: Recordatorios de mantenimiento

### Servicios de Validación
- **ProductValidationService**: Validación de productos
- **UserValidationService**: Validación de usuarios

### Servicios de Categorización
- **MotorcycleCategorizationService**: Categorización de motocicletas
- **CategoryService**: Gestión de categorías

### Servicios de Utilidades
- **AuditService**: Registro de auditoría
- **BackupRecoveryService**: Copias de seguridad
- **BulkOperationsService**: Operaciones masivas
- **EventBusService**: Comunicación entre componentes
- **LocationService**: Servicios de ubicación
- **PasswordService**: Gestión de contraseñas
- **QRCodeService**: Generación de códigos QR
- **SchedulingService**: Programación de citas
- **SessionService**: Gestión de sesiones

---

## Notas Generales

- **Autenticación**: La mayoría de los servicios requieren autenticación Firebase
- **Validación**: Los servicios incluyen validación de datos antes de operaciones CRUD
- **Auditoría**: Cambios importantes se registran en el servicio de auditoría
- **Soft Deletes**: Muchos servicios usan eliminación suave (marcar como inactivo)
- **Signals**: Los servicios usan Angular Signals para estado reactivo
- **Observables**: Operaciones asíncronas retornan Observables de RxJS
- **Firestore**: Todos los datos se almacenan en Google Firestore
- **Timestamps**: Registros incluyen createdAt y updatedAt automáticos

Esta documentación cubre los endpoints principales del servidor AI proxy, las rutas del frontend Angular, y los servicios CRUD principales de la aplicación Blue Dragon Motors.