# Rutas de Navegación del Proyecto Blue Dragon Motors

## Rutas Públicas

| Ruta | Componente | Título | Descripción |
|------|------------|--------|-------------|
| `/` | HomeComponent | Blue Dragon Motors - Inicio | Página principal |
| `/login` | LoginComponent | Iniciar Sesión | Autenticación de usuarios |
| `/inventory` | InventoryComponent | Repuestos | Catálogo de repuestos |
| `/services` | ServicesPageComponent | Servicios | Página de servicios |
| `/appointments` | AppointmentsPageComponent | Citas | Sistema de citas (requiere autenticación) |
| `/offers` | OffersPageComponent | Ofertas | Página de ofertas |
| `/contact` | ContactPageComponent | Contacto | Información de contacto |
| `/queue/join` | ClientFlowContainerComponent | Unirse a la Cola | Flujo de cliente para unirse a la cola |

## Rutas Protegidas

### Rutas de Cliente
| Ruta | Componente | Título | Roles Requeridos |
|------|------------|--------|------------------|
| `/account` | AccountComponent | Mi Cuenta | customer, employee, admin |
| `/checkout` | CheckoutComponent | Checkout | customer |

### Rutas de Empleado
| Ruta | Componente | Título | Roles Requeridos |
|------|------------|--------|------------------|
| `/employee` | UnifiedDashboardComponent | Panel de Empleado | technician, employee, front_desk |

## Rutas de Administración

### Panel Principal
| Ruta | Componente | Título | Roles Requeridos |
|------|------------|--------|------------------|
| `/admin` | AdminLayoutComponent | Panel de Administración | admin, manager |
| `/admin/dashboard` | UnifiedDashboardComponent | Panel de Administración | admin, manager |

### Gestión de Inventario
| Ruta | Componente | Título | Roles Requeridos |
|------|------------|--------|------------------|
| `/admin/motorcycles` | MotorcycleManagementComponent | Gestión de Motocicletas | admin, manager |
| `/admin/products` | ProductListComponent | Gestión de Productos | admin, manager |
| `/admin/products/new` | ProductFormComponent | Nuevo Producto | admin, manager |
| `/admin/products/:id/edit` | ProductFormComponent | Editar Producto | admin, manager |
| `/admin/suppliers` | SupplierManagementComponent | Gestión de Proveedores | admin, manager |
| `/admin/purchase-orders` | PurchaseOrderListComponent | Órdenes de Compra | admin, manager |
| `/admin/purchase-orders/new` | PurchaseOrderFormComponent | Nueva Orden de Compra | admin, manager |
| `/admin/purchase-orders/:id/edit` | PurchaseOrderFormComponent | Editar Orden de Compra | admin, manager |
| `/admin/stock-movements` | StockMovementComponent | Movimientos de Stock | admin, manager |

### Gestión de Servicios y Trabajo
| Ruta | Componente | Título | Roles Requeridos |
|------|------------|--------|------------------|
| `/admin/services` | ServiceManagementComponent | Catálogo de Servicios | admin, manager |
| `/admin/work-orders` | WorkOrderListComponent | Órdenes de Trabajo | admin, manager |
| `/admin/work-orders/:id` | WorkOrderFormComponent | Detalle Orden de Trabajo | admin, manager |

### Gestión de Usuarios y Sistema
| Ruta | Componente | Título | Roles Requeridos |
|------|------------|--------|------------------|
| `/admin/users` | UserManagementComponent | Gestión de Usuarios | admin |
| `/admin/scanner` | ScannerComponent | Escáner IA de Repuestos | admin, manager |
| `/admin/qr-generator` | QrGeneratorComponent | Generador de Códigos QR | admin |
| `/admin/notifications` | NotificationManagementComponent | Gestión de Notificaciones | admin, manager |
| `/admin/queue` | QueueManagementComponent | Gestión de Cola | admin, manager |
| `/admin/assignment` | AdminAssignmentComponent | Asignación Inteligente | admin, manager |
| `/admin/code-validation` | CodeValidationComponent | Validación de Códigos | admin, manager |

## Rutas de Redirección
| Ruta | Redirección | Descripción |
|------|-------------|-------------|
| `/admin` | `/admin/dashboard` | Redirección por defecto del panel admin |
| `/**` | `/` | Ruta comodín que redirige a la página principal |

## Notas sobre las Rutas

- **Lazy Loading**: Todas las rutas utilizan carga diferida (lazy loading) para mejorar el rendimiento
- **Guards**: Las rutas protegidas utilizan guards de autenticación y autorización
- **Roles**: Los roles incluyen: customer, employee, technician, front_desk, admin, manager
- **Parámetros Dinámicos**: Algunas rutas como `/admin/products/:id/edit` y `/admin/work-orders/:id` aceptan parámetros dinámicos
- **Jerarquía**: Las rutas de admin están anidadas bajo `/admin` con un layout compartido