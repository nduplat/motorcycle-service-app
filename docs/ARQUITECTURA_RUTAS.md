# ARQUITECTURA DE RUTAS - Blue Dragon Motors

## Árbol de Rutas desde la Auditoría de Routing

### Estructura General de Rutas

```
/
/├── (Públicas - Sin Guards)
/│   ├── / (HomeComponent)
/│   ├── /login (LoginComponent)
/│   ├── /inventory (InventoryComponent)
/│   ├── /services (ServicesPageComponent)
/│   ├── /offers (OffersPageComponent)
/│   ├── /contact (ContactPageComponent)
/│   └── /queue-status (QueueStatusComponent)
/│
/├── (Protegidas - Auth Guards)
/│   ├── /appointments (AppointmentsPageComponent)
/│   │   └── Requiere: customer
/│   ├── /queue/join (ClientFlowContainerComponent)
/│   │   └── Requiere: customer, admin, employee, technician
/│   ├── /account (AccountComponent)
/│   │   └── Requiere: customer, employee, admin
/│   ├── /employee (UnifiedDashboardComponent)
/│   │   └── Requiere: technician, employee, front_desk
/│   ├── /checkout (CheckoutComponent)
/│   │   └── Requiere: customer
/│   └── /admin (AdminLayoutComponent)
/│       └── Requiere: admin, manager
/│       └── Hijos:
/│           ├── /admin/dashboard (UnifiedDashboardComponent)
/│           ├── /admin/motorcycles (MotorcycleManagementComponent)
/│           ├── /admin/products (ProductListComponent)
/│           ├── /admin/products/new (ProductFormComponent)
/│           ├── /admin/products/:id/edit (ProductFormComponent)
/│           ├── /admin/suppliers (SupplierManagementComponent)
/│           ├── /admin/purchase-orders (PurchaseOrderListComponent)
/│           ├── /admin/purchase-orders/new (PurchaseOrderFormComponent)
/│           ├── /admin/purchase-orders/:id/edit (PurchaseOrderFormComponent)
/│           ├── /admin/stock-movements (StockMovementComponent)
/│           ├── /admin/services (ServiceManagementComponent)
/│           ├── /admin/work-orders (WorkOrderListComponent)
/│           ├── /admin/work-orders/:id (WorkOrderFormComponent)
/│           ├── /admin/users (UserManagementComponent)
/│           │   └── Requiere: admin
/│           ├── /admin/scanner (ScannerComponent)
/│           ├── /admin/qr-generator (QrGeneratorComponent)
/│           │   └── Requiere: admin
/│           ├── /admin/notifications (NotificationManagementComponent)
/│           ├── /admin/queue (QueueManagementComponent)
/│           ├── /admin/code-validation (CodeValidationComponent)
/│           └── /admin/cost-monitoring (CostMonitoringDashboardComponent)
/│
└── (Wildcards)
/    ├── /** (Admin wildcard) → /admin/dashboard
    └── /** (Global wildcard) → /
```

## Detalle de Rutas Públicas

| Ruta | Componente | Guards | Lazy Loading | Descripción |
|------|------------|--------|--------------|-------------|
| `/` | HomeComponent | Ninguno | ✅ | Página principal |
| `/login` | LoginComponent | Ninguno | ✅ | Autenticación de usuarios |
| `/inventory` | InventoryComponent | Ninguno | ✅ | Catálogo de repuestos |
| `/services` | ServicesPageComponent | Ninguno | ✅ | Página de servicios |
| `/offers` | OffersPageComponent | Ninguno | ✅ | Página de ofertas |
| `/contact` | ContactPageComponent | Ninguno | ✅ | Información de contacto |
| `/queue-status` | QueueStatusComponent | Ninguno | ✅ | Estado de cola (público) |

## Detalle de Rutas Protegidas

### Rutas de Cliente
| Ruta | Componente | Roles Requeridos | Lazy Loading | Descripción |
|------|------------|------------------|--------------|-------------|
| `/appointments` | AppointmentsPageComponent | customer | ✅ | Sistema de citas |
| `/queue/join` | ClientFlowContainerComponent | customer, admin, employee, technician | ✅ | Flujo de cliente para unirse a la cola |
| `/account` | AccountComponent | customer, employee, admin | ✅ | Mi cuenta |
| `/checkout` | CheckoutComponent | customer | ✅ | Checkout |

### Rutas de Empleado
| Ruta | Componente | Roles Requeridos | Lazy Loading | Descripción |
|------|------------|------------------|--------------|-------------|
| `/employee` | UnifiedDashboardComponent | technician, employee, front_desk | ✅ | Panel de empleado |

### Rutas de Administración (Anidadas)
| Ruta | Componente | Roles Requeridos | Lazy Loading | Descripción |
|------|------------|------------------|--------------|-------------|
| `/admin` | AdminLayoutComponent | admin, manager | ✅ | Layout de administración |
| `/admin/dashboard` | UnifiedDashboardComponent | admin, manager | ✅ | Dashboard principal |
| `/admin/motorcycles` | MotorcycleManagementComponent | admin, manager | ✅ | Gestión de motocicletas |
| `/admin/products` | ProductListComponent | admin, manager | ✅ | Gestión de productos |
| `/admin/products/new` | ProductFormComponent | admin, manager | ✅ | Nuevo producto |
| `/admin/products/:id/edit` | ProductFormComponent | admin, manager | ✅ | Editar producto |
| `/admin/suppliers` | SupplierManagementComponent | admin, manager | ✅ | Gestión de proveedores |
| `/admin/purchase-orders` | PurchaseOrderListComponent | admin, manager | ✅ | Órdenes de compra |
| `/admin/purchase-orders/new` | PurchaseOrderFormComponent | admin, manager | ✅ | Nueva orden de compra |
| `/admin/purchase-orders/:id/edit` | PurchaseOrderFormComponent | admin, manager | ✅ | Editar orden de compra |
| `/admin/stock-movements` | StockMovementComponent | admin, manager | ✅ | Movimientos de stock |
| `/admin/services` | ServiceManagementComponent | admin, manager | ✅ | Catálogo de servicios |
| `/admin/work-orders` | WorkOrderListComponent | admin, manager | ✅ | Órdenes de trabajo |
| `/admin/work-orders/:id` | WorkOrderFormComponent | admin, manager | ✅ | Detalle orden de trabajo |
| `/admin/users` | UserManagementComponent | admin | ✅ | Gestión de usuarios |
| `/admin/scanner` | ScannerComponent | admin, manager | ✅ | Escáner IA de repuestos |
| `/admin/qr-generator` | QrGeneratorComponent | admin | ✅ | Generador de códigos QR |
| `/admin/notifications` | NotificationManagementComponent | admin, manager | ✅ | Gestión de notificaciones |
| `/admin/queue` | QueueManagementComponent | admin, manager | ✅ | Gestión de cola |
| `/admin/code-validation` | CodeValidationComponent | admin, manager | ✅ | Validación de códigos |
| `/admin/cost-monitoring` | CostMonitoringDashboardComponent | admin, manager | ✅ | Monitoreo de costos |

## Rutas de Redirección

| Ruta | Redirección | Descripción |
|------|-------------|-------------|
| `/admin` | `/admin/dashboard` | Redirección por defecto del panel admin |
| `/**` | `/` | Ruta comodín que redirige a la página principal |

## Guards Implementados

### AuthGuard
- **Ubicación**: `src/guards/auth.guard.ts`
- **Función**: Verifica roles requeridos desde data de ruta
- **Aplicado a**: `/appointments`, `/account`, `/employee`, `/admin/*`, `/checkout`, `/queue/join`

### ClientFlowGuard
- **Ubicación**: `src/guards/client-flow.guard.ts`
- **Función**: Verifica roles y estado de flujo cliente
- **Roles permitidos**: customer, admin, employee, technician
- **Aplicado a**: `/queue/join`

### QueueSessionGuard (OBSOLETO)
- **Ubicación**: `src/guards/queue-session.guard.ts`
- **Estado**: Existe pero no se usa en ninguna ruta
- **Recomendación**: Eliminar

## Problemas Identificados en Routing

### Rutas Incorrectas
1. **Import path incorrecto para CostMonitoringDashboardComponent**
   - Ruta actual: `./app/cost-monitoring-dashboard/cost-monitoring-dashboard.component`
   - Problema: Debería ser `./components/admin/cost-monitoring-dashboard/cost-monitoring-dashboard.component`

2. **QueueSessionGuard sin usar**
   - Guard existe pero no está aplicado a ninguna ruta
   - Recomendación: Eliminar o implementar

### Rutas Ambiguas
1. **Propósito poco claro de `/queue-status`**
   - Considerar renombrar a `/queue/my-status` para mayor claridad

2. **Múltiples componentes Dashboard**
   - UnifiedDashboardComponent usado tanto para empleado como admin
   - Puede ser confuso - considerar componentes separados

### Problemas de Configuración
1. **Requisitos de roles de ClientFlowGuard**
   - Actualmente permite: customer, admin, employee, technician
   - Problema: Flujo cliente debería ser customer-only

2. **Ubicación inconsistente de componentes**
   - CostMonitoringDashboardComponent está en `src/app/` en lugar de `src/components/admin/`

## Recomendaciones de Mejora

### Prioridad Alta
1. **Corregir ruta de import de CostMonitoringDashboardComponent**
2. **Restringir ClientFlowGuard a rol customer únicamente**
3. **Eliminar QueueSessionGuard no utilizado**

### Prioridad Media
1. **Renombrar `/queue-status` a `/queue/my-status`**
2. **Mover CostMonitoringDashboardComponent a ubicación consistente**
3. **Crear componentes dashboard separados para admin/empleado**

### Prioridad Baja
1. **Mejorar logging de guards** (remover logs de producción)
2. **Agregar componente 404 dedicado** en lugar de redirigir a home/dashboard

## Análisis de Lazy Loading

- **Implementación**: ✅ Todas las rutas usan `loadComponent` con imports dinámicos
- **Organización**: ✅ Componentes agrupados apropiadamente por feature
- **Performance**: ✅ Lazy loading aplicado consistentemente
- **Bundle inicial**: ✅ Mejorado significativamente

## Análisis de Guards

- **AuthGuard**: ✅ Implementado correctamente con verificación de roles desde data de ruta
- **ClientFlowGuard**: ⚠️ Requiere restricción a rol customer únicamente
- **QueueSessionGuard**: ❌ No utilizado - marcar para eliminación

## Mapa de Dependencias de Rutas

### Rutas por Rol
```
Admin (admin, manager):
├── /admin/dashboard
├── /admin/motorcycles
├── /admin/products/*
├── /admin/suppliers
├── /admin/purchase-orders/*
├── /admin/stock-movements
├── /admin/services
├── /admin/work-orders/*
├── /admin/users (admin only)
├── /admin/scanner
├── /admin/qr-generator (admin only)
├── /admin/notifications
├── /admin/queue
├── /admin/code-validation
└── /admin/cost-monitoring

Technician (technician, employee, front_desk):
└── /employee

Customer (customer):
├── /appointments
├── /queue/join
├── /account
└── /checkout
```

### Rutas por Funcionalidad
```
Gestión de Inventario:
├── /inventory (público)
├── /admin/products/*
├── /admin/stock-movements
└── /admin/suppliers

Gestión de Órdenes de Trabajo:
├── /admin/work-orders/*
└── /employee

Sistema de Cola:
├── /queue-status (público)
├── /queue/join (cliente)
└── /admin/queue

Sistema de Citas:
├── /appointments (cliente)
└── /admin/schedule (future)

Monitoreo y Analytics:
├── /admin/cost-monitoring
└── /admin/scanner
```

Esta arquitectura de rutas proporciona una separación clara de responsabilidades, con lazy loading efectivo y guards de seguridad apropiados. Los problemas identificados son menores y pueden ser corregidos sin afectar la funcionalidad del sistema.