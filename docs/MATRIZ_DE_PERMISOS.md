# MATRIZ DE PERMISOS - Blue Dragon Motors

## Resumen Ejecutivo

**Sistema de Roles**: 4 roles principales + 1 obsoleto
**Estado General**: Bueno con algunas inconsistencias menores
**Rol más utilizado**: Customer (acceso público)
**Rol más restrictivo**: Admin (acceso completo al sistema)

Esta documentación detalla la matriz completa de permisos por rol, incluyendo rutas, acciones y responsabilidades.

## 1. Definición de Roles

### UserRole Enum (Activo)
```typescript
enum UserRole {
  ADMIN = 'admin',        // Acceso completo al sistema
  TECHNICIAN = 'technician', // Técnicos de taller
  CUSTOMER = 'customer',  // Clientes del taller
  EMPLOYEE = 'employee'   // Empleados administrativos
}
```

### Front Desk Role (OBSOLETO)
- **Estado**: Marcado para eliminación
- **Razón**: Funcionalidad mínima, puede consolidarse con EMPLOYEE
- **Ubicación**: `src/models/types.ts:19`

## 2. Matriz de Acceso a Rutas

### Rutas Públicas (Sin Autenticación)
| Ruta | Descripción | Acceso |
|------|-------------|--------|
| `/` | Home page | Todos |
| `/login` | Login | Todos |
| `/inventory` | Catálogo de productos | Todos |
| `/services` | Página de servicios | Todos |
| `/offers` | Ofertas y promociones | Todos |
| `/contact` | Información de contacto | Todos |
| `/queue-status` | Estado de cola público | Todos |

### Rutas Protegidas por Rol

#### Customer Routes
| Ruta | Componente | Acceso | Descripción |
|------|------------|--------|-------------|
| `/appointments` | AppointmentsPageComponent | ✅ Customer | Sistema de citas |
| `/queue/join` | ClientFlowContainerComponent | ⚠️ Customer + otros | Unirse a cola de espera |
| `/account` | AccountComponent | ✅ Customer | Gestión de cuenta personal |
| `/checkout` | CheckoutComponent | ✅ Customer | Proceso de compra |

#### Employee Routes
| Ruta | Componente | Acceso | Descripción |
|------|------------|--------|-------------|
| `/employee` | UnifiedDashboardComponent | ✅ Technician, Employee, Front Desk | Panel unificado de empleado |

#### Admin Routes (Anidadas)
| Ruta | Componente | Acceso | Descripción |
|------|------------|--------|-------------|
| `/admin` | AdminLayoutComponent | ✅ Admin, Manager | Layout de administración |
| `/admin/dashboard` | UnifiedDashboardComponent | ✅ Admin, Manager | Dashboard principal |
| `/admin/motorcycles` | MotorcycleManagementComponent | ✅ Admin, Manager | Gestión de motocicletas |
| `/admin/products` | ProductListComponent | ✅ Admin, Manager | Lista de productos |
| `/admin/products/new` | ProductFormComponent | ✅ Admin, Manager | Crear producto |
| `/admin/products/:id/edit` | ProductFormComponent | ✅ Admin, Manager | Editar producto |
| `/admin/suppliers` | SupplierManagementComponent | ✅ Admin, Manager | Gestión de proveedores |
| `/admin/purchase-orders` | PurchaseOrderListComponent | ✅ Admin, Manager | Lista órdenes de compra |
| `/admin/purchase-orders/new` | PurchaseOrderFormComponent | ✅ Admin, Manager | Crear orden de compra |
| `/admin/purchase-orders/:id/edit` | PurchaseOrderFormComponent | ✅ Admin, Manager | Editar orden de compra |
| `/admin/stock-movements` | StockMovementComponent | ✅ Admin, Manager | Movimientos de stock |
| `/admin/services` | ServiceManagementComponent | ✅ Admin, Manager | Catálogo de servicios |
| `/admin/work-orders` | WorkOrderListComponent | ✅ Admin, Manager | Lista órdenes de trabajo |
| `/admin/work-orders/:id` | WorkOrderFormComponent | ✅ Admin, Manager | Detalle orden de trabajo |
| `/admin/users` | UserManagementComponent | ✅ Admin only | Gestión de usuarios |
| `/admin/scanner` | ScannerComponent | ✅ Admin, Manager | Escáner IA |
| `/admin/qr-generator` | QrGeneratorComponent | ✅ Admin only | Generador QR |
| `/admin/notifications` | NotificationManagementComponent | ✅ Admin, Manager | Gestión notificaciones |
| `/admin/queue` | QueueManagementComponent | ✅ Admin, Manager | Gestión de cola |
| `/admin/code-validation` | CodeValidationComponent | ✅ Admin, Manager | Validación códigos |
| `/admin/cost-monitoring` | CostMonitoringDashboardComponent | ✅ Admin, Manager | Monitoreo costos |

## 3. Matriz de Permisos por Servicio

### ProductService
| Método | Admin | Manager | Technician | Employee | Customer |
|--------|-------|---------|------------|----------|----------|
| `getProducts()` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `getProduct(id)` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `addProduct()` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `updateProduct()` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `deleteProduct()` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `updateStock()` | ✅ | ✅ | ✅ (assigned work orders) | ❌ | ❌ |
| `getLowStockProducts()` | ✅ | ✅ | ❌ | ❌ | ❌ |

### WorkOrderService
| Método | Admin | Manager | Technician | Employee | Customer |
|--------|-------|---------|------------|----------|----------|
| `getWorkOrders()` | ✅ | ✅ | ✅ (assigned) | ✅ | ✅ (own) |
| `getWorkOrder(id)` | ✅ | ✅ | ✅ (assigned) | ✅ | ✅ (own) |
| `createWorkOrder()` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `updateWorkOrder()` | ✅ | ✅ | ✅ (assigned) | ✅ | ❌ |
| `deleteWorkOrder()` | ✅ | ❌ | ❌ | ❌ | ❌ |

### UserService
| Método | Admin | Manager | Technician | Employee | Customer |
|--------|-------|---------|------------|----------|----------|
| `getUsers()` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `getUserById()` | ✅ | ✅ (team) | ❌ | ❌ | ✅ (own) |
| `addUser()` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `updateUser()` | ✅ | ✅ (team) | ❌ | ❌ | ✅ (own profile) |
| `deactivateUser()` | ✅ | ❌ | ❌ | ❌ | ❌ |

### QueueService
| Método | Admin | Manager | Technician | Employee | Customer |
|--------|-------|---------|------------|----------|----------|
| `getQueueEntries()` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `addToQueue()` | ✅ | ✅ | ✅ | ✅ | ✅ (self) |
| `updateQueueEntry()` | ✅ | ✅ | ✅ (assigned) | ✅ | ❌ |
| `removeFromQueue()` | ✅ | ✅ | ✅ (assigned) | ✅ | ✅ (self) |

## 4. Matriz de Permisos de UI

### Dashboard Components
| Componente | Admin | Manager | Technician | Employee | Customer |
|------------|-------|---------|------------|----------|----------|
| AdminDashboard | ✅ | ✅ | ❌ | ❌ | ❌ |
| EmployeeDashboard | ❌ | ❌ | ✅ | ✅ | ❌ |
| CustomerDashboard | ❌ | ❌ | ❌ | ❌ | ✅ |

### Work Order Management
| Acción | Admin | Manager | Technician | Employee | Customer |
|--------|-------|---------|------------|----------|----------|
| Ver todas las OT | ✅ | ✅ | ❌ | ✅ | ❌ |
| Ver OT asignadas | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver propias OT | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear OT | ✅ | ✅ | ❌ | ✅ | ❌ |
| Editar OT | ✅ | ✅ | ✅ (assigned) | ✅ | ❌ |
| Completar OT | ✅ | ✅ | ✅ (assigned) | ✅ | ❌ |
| Eliminar OT | ✅ | ❌ | ❌ | ❌ | ❌ |

### Product Management
| Acción | Admin | Manager | Technician | Employee | Customer |
|--------|-------|---------|------------|----------|----------|
| Ver catálogo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Agregar productos | ✅ | ✅ | ❌ | ❌ | ❌ |
| Editar productos | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gestionar stock | ✅ | ✅ | ✅ (work order) | ❌ | ❌ |
| Ver reportes stock | ✅ | ✅ | ❌ | ❌ | ❌ |

### Appointment System
| Acción | Admin | Manager | Technician | Employee | Customer |
|--------|-------|---------|------------|----------|----------|
| Ver todas citas | ✅ | ✅ | ❌ | ✅ | ❌ |
| Ver citas asignadas | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver propias citas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear citas | ✅ | ✅ | ❌ | ✅ | ✅ |
| Editar citas | ✅ | ✅ | ✅ (assigned) | ✅ | ✅ (own) |
| Cancelar citas | ✅ | ✅ | ✅ (assigned) | ✅ | ✅ (own) |

## 5. Matriz de Permisos de IA y Costos

### AIAssistantService
| Acción | Admin | Manager | Technician | Employee | Customer |
|--------|-------|---------|------------|----------|----------|
| Consultas chatbot | ✅ | ✅ | ✅ (50/day) | ✅ (50/day) | ✅ (5/day) |
| Escáner IA | ✅ | ✅ | ✅ (100/day) | ✅ (100/day) | ❌ |
| Búsqueda productos | ✅ | ✅ | ✅ (30/day) | ✅ (30/day) | ✅ (10/day) |
| Work order templates | ✅ | ✅ | ✅ (30/day) | ✅ (30/day) | ❌ |

### Cost Monitoring
| Acción | Admin | Manager | Technician | Employee | Customer |
|--------|-------|---------|------------|----------|----------|
| Ver costos totales | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver costos por contexto | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver alertas presupuesto | ✅ | ✅ | ❌ | ❌ | ❌ |
| Recibir notificaciones | ✅ | ✅ | ❌ | ❌ | ❌ |

## 6. Guards y Validaciones

### AuthGuard
- **Ubicación**: `src/guards/auth.guard.ts`
- **Validación**: Verifica roles requeridos desde route data
- **Aplicado a**: Todas las rutas protegidas

### ClientFlowGuard
- **Ubicación**: `src/guards/client-flow.guard.ts`
- **Validación**: Verifica rol customer + estado de flujo
- **Aplicado a**: `/queue/join`
- **⚠️ Problema**: Actualmente permite múltiples roles, debería ser customer-only

### QueueSessionGuard (OBSOLETO)
- **Estado**: No utilizado en ninguna ruta
- **Recomendación**: Eliminar

## 7. Problemas Identificados

### Inconsistencias Críticas
1. **ClientFlowGuard demasiado permisivo**
   - Actualmente: customer, admin, employee, technician
   - Debería ser: customer only

2. **Rol Manager inconsistente**
   - Definido en rutas pero no implementado completamente
   - Considerar eliminar o implementar fully

3. **Front Desk rol subutilizado**
   - Mínima funcionalidad
   - Recomendación: Consolidar con Employee

### Inconsistencias Menores
1. **Arrays de roles duplicados**
   - Guards vs rutas tienen definiciones separadas
   - Recomendación: Crear constantes centralizadas

2. **Permisos hardcodeados**
   - Lógica de permisos en múltiples lugares
   - Recomendación: Servicio centralizado de permisos

3. **UI genérica basada en roles**
   - UnifiedDashboardComponent usado para múltiples roles
   - Recomendación: Componentes específicos por rol

## 8. Recomendaciones de Mejora

### Prioridad Alta
1. **Restringir ClientFlowGuard** a rol customer únicamente
2. **Eliminar rol Front Desk** y consolidar con Employee
3. **Corregir rol Manager** - implementar o eliminar

### Prioridad Media
1. **Crear servicio de permisos centralizado**
2. **Estandarizar constantes de roles**
3. **Implementar componentes dashboard específicos por rol**

### Prioridad Baja
1. **Mejorar logging de guards**
2. **Agregar validaciones de permisos en servicios faltantes**
3. **Documentar reglas de negocio por rol**

## 9. Testing de Permisos

### Casos de Prueba Críticos
```typescript
// AuthGuard tests
✅ Admin puede acceder a /admin/users
✅ Customer no puede acceder a /admin/dashboard
✅ Technician puede acceder a /employee
✅ Customer puede acceder a /appointments

// Service permission tests
✅ Customer solo ve sus propias work orders
✅ Technician solo edita work orders asignadas
✅ Admin ve todas las work orders
✅ Manager puede crear pero no eliminar work orders
```

### Edge Cases
- Usuario con múltiples roles
- Transiciones de rol durante sesión
- Permisos revocados dinámicamente
- Cache de permisos expirado

Esta matriz de permisos proporciona una base sólida para el control de acceso del sistema, con identificaciones claras de áreas que requieren atención y recomendaciones específicas para mejoras.