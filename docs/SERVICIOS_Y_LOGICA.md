# SERVICIOS Y LÓGICA DE NEGOCIO - Blue Dragon Motors

## Resumen Ejecutivo

**Total de Servicios**: 40+ servicios activos
**Arquitectura**: Bien estructurada con separación clara de responsabilidades
**Estado General**: Bueno con algunas áreas de mejora identificadas
**Servicios Críticos**: AIAssistantService, WorkOrderService, QueueService

Esta documentación detalla todos los servicios del sistema, organizados por dominio funcional y criticidad.

## 1. Servicios de IA y Optimización de Costos

### AIAssistantService (CRÍTICO)
**Ubicación**: `src/services/ai-assistant.service.ts`
**Responsabilidad**: Punto de entrada principal para consultas IA con optimización de costos

#### Métodos Principales
```typescript
async query(
  prompt: string,
  context: 'chatbot' | 'scanner' | 'workOrder' | 'productSearch',
  userId: string
): Promise<AIResponse>
```
**Lógica**: Implementa arquitectura de 3 capas (Fallback → Cache → AI)

#### Flujo de Optimización
1. **Fallback Check**: Respuestas pre-generadas para consultas comunes
2. **Cache Check**: Búsqueda en Firestore con TTL
3. **Rate Limiting**: Verificación de límites por rol
4. **AI Call**: Solo si no hay alternativas
5. **Cost Tracking**: Registro de costos por contexto

#### Problemas Identificados
- **generateMaintenanceReminders()**: Método demasiado largo (619 líneas) - dividir en métodos separados

### CacheService (CRÍTICO)
**Ubicación**: `src/services/cache.service.ts`
**Responsabilidad**: Caché inteligente multi-nivel con claves semánticas

#### Características
- **TTL Diferenciado**: 1h-30d según tipo de dato
- **Claves Semánticas**: Normalización de consultas similares
- **Persistencia**: Firestore-backed para compartir entre usuarios

### RateLimiterService (CRÍTICO)
**Ubicación**: `src/services/rate-limiter.service.ts`
**Responsabilidad**: Control de frecuencia de consultas por rol

#### Límites por Rol
```typescript
const limits = {
  technician: { chatbot: 50, scanner: 100, workOrder: 30 },
  customer: { chatbot: 5, productSearch: 10 }
};
```

### CostMonitoringService (CRÍTICO)
**Ubicación**: `src/services/cost-monitoring.service.ts`
**Responsabilidad**: Monitoreo y alertas de costos AI

#### Funcionalidades
- **Tracking en tiempo real**: Costos por contexto y usuario
- **Alertas automáticas**: Notificaciones a 80% del presupuesto
- **Reportes históricos**: Análisis de tendencias

## 2. Servicios de Gestión de Órdenes de Trabajo

### WorkOrderService (CRÍTICO)
**Ubicación**: `src/services/work-order.service.ts`
**Responsabilidad**: Gestión completa del ciclo de vida de órdenes de trabajo

#### Métodos Principales
- `getWorkOrders()`: Lista filtrada por permisos
- `createWorkOrder()`: Creación con validaciones
- `updateWorkOrder()`: Actualización con estado y asignación
- `completeWorkOrder()`: Finalización con cálculos de costo

#### Problemas Identificados
- **loadWorkOrders()**: Método largo (96-183 líneas) - extraer validación de permisos
- **Manejo de estado**: Transiciones de estado complejas

### AutoAssignmentService (IMPORTANTE)
**Ubicación**: `src/services/auto-assignment.service.ts`
**Responsabilidad**: Asignación automática de técnicos basada en disponibilidad y carga

#### Algoritmo de Asignación
1. **Filtrar entradas waiting** en cola
2. **Identificar técnicos disponibles** (no busy, no break)
3. **Ordenar por posición** FIFO
4. **Asignar al mejor técnico** disponible
5. **Actualizar estados** y notificar

### SmartAssignmentService (IMPORTANTE)
**Ubicación**: `src/services/smart-assignment.service.ts`
**Responsabilidad**: Recomendaciones inteligentes usando scoring multifactor

#### Factores de Scoring
- **Skills Match** (40%): Coincidencia de habilidades requeridas
- **Availability** (20%): Técnico disponible inmediatamente
- **Workload** (20%): Balance de carga de trabajo
- **Efficiency** (15%): Rendimiento histórico
- **Proximity** (5%): Factor de proximidad (fijo)

## 3. Servicios de Gestión de Cola

### QueueService (CRÍTICO)
**Ubicación**: `src/services/queue.service.ts`
**Responsabilidad**: Gestión de cola de clientes y asignación de técnicos

#### Estados de Cola
```typescript
enum QueueStatus {
  WAITING = 'waiting',      // Esperando asignación
  CALLED = 'called',        // Llamado por técnico
  SERVING = 'serving',      // Siendo atendido
  COMPLETED = 'completed'   // Servicio completado
}
```

#### Métodos Clave
- `addToQueue()`: Agregar cliente con cálculo de posición
- `callNext()`: Llamar siguiente cliente disponible
- `assignToTechnician()`: Asignar cliente a técnico específico
- `completeService()`: Marcar servicio como completado

### QueueAnalyticsService (INFORMACIÓN)
**Ubicación**: `src/services/queue_analytics_service.ts`
**Responsabilidad**: Analytics y métricas de rendimiento de cola

#### Métricas Calculadas
- **Tiempo promedio de espera**
- **Tasa de abandono**
- **Eficiencia de asignación**
- **Utilización de técnicos**

## 4. Servicios de Autenticación y Usuarios

### AuthService (CRÍTICO)
**Ubicación**: `src/services/auth.service.ts`
**Responsabilidad**: Autenticación Firebase y gestión de sesiones

#### Funcionalidades
- **Login/Logout**: Autenticación con email/password
- **Role Management**: Gestión de roles y permisos
- **Session Handling**: Manejo de estado de sesión
- **Profile Updates**: Actualización de perfiles de usuario

### UserService (IMPORTANTE)
**Ubicación**: `src/services/user.service.ts`
**Responsabilidad**: Gestión de datos de usuario y perfiles

#### Métodos por Rol
- **Admin**: CRUD completo de usuarios
- **Manager**: Gestión de equipo
- **Technician/Employee**: Perfil propio + usuarios relacionados
- **Customer**: Perfil propio únicamente

## 5. Servicios de Productos e Inventario

### ProductService (CRÍTICO)
**Ubicación**: `src/services/product.service.ts`
**Responsabilidad**: Gestión de catálogo de productos y stock

#### Funcionalidades
- **CRUD de Productos**: Crear, leer, actualizar, eliminar
- **Gestión de Stock**: Movimientos, alertas de stock bajo
- **Búsqueda Avanzada**: Filtros por categoría, marca, compatibilidad
- **Precios y Descuentos**: Gestión de pricing dinámico

#### Problemas Identificados
- **Faltan validaciones de permisos** en algunos métodos

### StockMovementService (IMPORTANTE)
**Ubicación**: `src/services/stock-movement.service.ts`
**Responsabilidad**: Auditoría de movimientos de inventario

#### Tipos de Movimiento
```typescript
enum MovementType {
  IN = 'in',           // Entrada de mercancía
  OUT = 'out',         // Salida por venta/servicio
  ADJUSTMENT = 'adjustment'  // Ajuste manual
}
```

## 6. Servicios de Citas y Programación

### AppointmentService (IMPORTANTE)
**Ubicación**: `src/services/appointment.service.ts`
**Responsabilidad**: Gestión de citas de clientes

#### Problemas Identificados
- **loadAppointments()**: Método largo - separar responsabilidades
- **Mutaciones directas de estado**: Usar métodos de signal apropiados

### EmployeeScheduleService (IMPORTANTE)
**Ubicación**: `src/services/employee-schedule.service.ts`
**Responsabilidad**: Gestión de horarios y disponibilidad de empleados

#### Funcionalidades
- **Creación de horarios**: Shifts, breaks, availability
- **Validación de conflictos**: Evitar double-booking
- **Cálculos de horas**: Totales, overtime, etc.

## 7. Servicios de Compras y Proveedores

### PurchaseOrderService (IMPORTANTE)
**Ubicación**: `src/services/purchase-order.service.ts`
**Responsabilidad**: Gestión de órdenes de compra a proveedores

### SupplierService (INFORMACIÓN)
**Ubicación**: `src/services/supplier.service.ts`
**Responsabilidad**: Gestión de proveedores y contactos

## 8. Servicios de Notificaciones

### NotificationService (IMPORTANTE)
**Ubicación**: `src/services/notification.service.ts`
**Responsabilidad**: Sistema de notificaciones multi-canal

#### Canales Soportados
- **In-App**: Notificaciones dentro de la aplicación
- **Push**: Notificaciones push móviles
- **Email**: Correos electrónicos
- **SMS**: Mensajes de texto

### AutomatedNotificationService (INFORMACIÓN)
**Ubicación**: `src/services/automated-ai-tasks.service.ts`
**Responsabilidad**: Notificaciones automáticas basadas en triggers

## 9. Servicios de Utilidades y Helpers

### ErrorHandlerService (CRÍTICO)
**Ubicación**: `src/services/error-handler.service.ts`
**Responsabilidad**: Manejo centralizado de errores

#### Problema Identificado
- **Manejo de errores inconsistente** en otros servicios

### ToastService (INFORMACIÓN)
**Ubicación**: `src/services/toast.service.ts`
**Responsabilidad**: Notificaciones de usuario (toast messages)

### AuditService (INFORMACIÓN)
**Ubicación**: `src/services/audit.service.ts`
**Responsabilidad**: Registro de auditoría de acciones del sistema

## 10. Servicios Especializados

### QRCodeService (INFORMACIÓN)
**Ubicación**: `src/services/qr-code.service.ts`
**Responsabilidad**: Generación y validación de códigos QR

### BulkOperationsService (INFORMACIÓN)
**Ubicación**: `src/services/bulk-operations.service.ts`
**Responsabilidad**: Operaciones masivas (import/export)

### BackupRecoveryService (INFORMACIÓN)
**Ubicación**: `src/services/backup-recovery.service.ts`
**Responsabilidad**: Copias de seguridad y recuperación

## 11. Servicios con Problemas Identificados

### Servicios con Manipulación DOM (INCORRECTO)
- **AdvancedProductService**: Manipulación DOM en líneas 294-333
- **AdvancedServiceService**: Manipulación DOM en líneas 363-402

**Recomendación**: Mover lógica de export a componentes

### Servicios Intermediarios (OBSOLETOS)
- **AutomatedAITasksService**: Wrapper delgado
- **BudgetCircuitBreakerAdminService**: Wrapper delgado

**Recomendación**: Consolidar funcionalidades

### Servicios con Manejo de Errores Duplicado
- **Múltiples servicios** tienen manejo de errores repetitivo

**Recomendación**: Crear método centralizado en ErrorHandlerService

## 12. Arquitectura de Servicios

### Patrón de Diseño
- **Service Layer Pattern**: Separación clara entre UI y lógica de negocio
- **Dependency Injection**: Angular DI para inyección de dependencias
- **Reactive Programming**: Uso de RxJS Observables y Signals

### Comunicación entre Servicios
- **Event Bus**: Para comunicación desacoplada
- **Direct Injection**: Para dependencias directas
- **Signals**: Para estado reactivo compartido

### Manejo de Estado
- **Service-Scoped**: Estado manejado dentro del ámbito del servicio
- **Signals-based**: Para reactividad automática
- **Optimistic Updates**: Actualizaciones inmediatas con rollback

### Validaciones y Seguridad
- **Input Validation**: Validación en entrada de datos
- **Permission Checks**: Verificación de permisos por rol
- **Audit Logging**: Registro de acciones importantes

## 13. Recomendaciones de Mejora

### Prioridad Alta
1. **Refactorizar métodos largos** en servicios críticos
2. **Mover manipulación DOM** a componentes
3. **Eliminar servicios intermediarios** obsoletos
4. **Centralizar manejo de errores**

### Prioridad Media
1. **Agregar validaciones de permisos** faltantes
2. **Implementar logging consistente**
3. **Optimizar consultas a Firestore**
4. **Mejorar manejo de estado reactivo**

### Prioridad Baja
1. **Documentar contratos de servicio**
2. **Agregar tests unitarios faltantes**
3. **Implementar circuit breakers**
4. **Optimizar bundle sizes**

Esta documentación proporciona una visión completa de la arquitectura de servicios, destacando fortalezas y áreas de mejora identificadas durante la auditoría.