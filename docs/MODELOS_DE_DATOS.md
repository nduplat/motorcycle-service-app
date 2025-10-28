# MODELOS DE DATOS - Blue Dragon Motors

## Resumen Ejecutivo

**Total de Modelos:** 58+ interfaces y clases activas
**Modelos Obsoletos Identificados:** 7 (marcados para eliminación)
**Modelos Ambiguos:** 2 (requieren enums)
**Estado General:** Bueno - Modelos bien estructurados y documentados

Esta documentación detalla todos los modelos de datos activos en el sistema, organizados por dominio funcional.

## 1. Modelos de Usuario y Autenticación

### User (Principal)
```typescript
interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole; // 'admin' | 'technician' | 'customer' | 'employee'
  phone?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
  profile?: UserProfile;
}
```

### UserProfile (Extendido)
```typescript
interface UserProfile {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  address?: Address;
  preferences: UserPreferences;
  emergencyContact?: EmergencyContact;
  certifications?: Certification[];
  skills?: string[];
}
```

### UserRole (Enum)
```typescript
enum UserRole {
  ADMIN = 'admin',
  TECHNICIAN = 'technician',
  CUSTOMER = 'customer',
  EMPLOYEE = 'employee'
}
```

## 2. Modelos de Vehículos y Motocicletas

### Motorcycle (Principal)
```typescript
interface Motorcycle {
  id: string;
  brand: string; // 'Honda', 'Yamaha', 'Kawasaki', etc.
  model: string;
  year: number;
  engineCapacity: number; // cc
  type: MotorcycleType;
  category: MotorcycleCategory;
  price: number;
  stock: number;
  isActive: boolean;
  specifications: MotorcycleSpecs;
  images: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Vehicle (Cliente)
```typescript
interface Vehicle {
  id: string;
  userId: string;
  motorcycleId: string;
  licensePlate: string;
  vin?: string;
  color?: string;
  mileage?: number;
  purchaseDate?: Timestamp;
  warranty?: WarrantyInfo;
  serviceHistory: ServiceRecord[];
}
```

### MotorcycleType & MotorcycleCategory (Enums)
```typescript
enum MotorcycleType {
  SPORT = 'sport',
  CRUISER = 'cruiser',
  TOURING = 'touring',
  OFF_ROAD = 'off_road',
  SCOOTER = 'scooter',
  ELECTRIC = 'electric'
}

enum MotorcycleCategory {
  ENTRY_LEVEL = 'entry_level',
  MID_RANGE = 'mid_range',
  PREMIUM = 'premium',
  LUXURY = 'luxury'
}
```

## 3. Modelos de Productos e Inventario

### Product (Principal)
```typescript
interface Product {
  id: string;
  name: string;
  description: string;
  category: ProductCategory;
  brand: string;
  sku: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  location: ProductLocation;
  compatibility: Compatibility[];
  images: string[];
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### ProductCategory (Enum)
```typescript
enum ProductCategory {
  OIL_FILTER = 'oil_filter',
  AIR_FILTER = 'air_filter',
  BRAKE_PADS = 'brake_pads',
  TIRES = 'tires',
  BATTERY = 'battery',
  CHAIN = 'chain',
  SPARK_PLUGS = 'spark_plugs',
  OIL = 'oil',
  TOOLS = 'tools',
  ACCESSORIES = 'accessories'
}
```

### StockMovement (Auditoría)
```typescript
interface StockMovement {
  id: string;
  productId: string;
  type: MovementType; // 'in', 'out', 'adjustment'
  quantity: number;
  reason: string;
  userId: string;
  reference?: string; // work order ID, purchase order ID
  location: ProductLocation;
  createdAt: Timestamp;
}
```

## 4. Modelos de Órdenes de Trabajo

### WorkOrder (Principal)
```typescript
interface WorkOrder {
  id: string;
  customerId: string;
  vehicleId: string;
  technicianId?: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority; // REQUIERE ENUM: 'low', 'normal', 'high', 'urgent'
  services: ServiceItem[];
  products: WorkOrderProduct[];
  estimatedDuration: number; // minutes
  actualDuration?: number;
  estimatedCost: number;
  actualCost?: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}
```

### ServiceItem (Servicio)
```typescript
interface ServiceItem {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  type: ServiceType; // REQUIERE ENUM: 'maintenance', 'repair', 'inspection', 'emergency'
  duration: number; // minutes
  price: number;
  isActive: boolean;
}
```

### WorkOrderProduct (Productos en OT)
```typescript
interface WorkOrderProduct {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  notes?: string;
}
```

## 5. Modelos de Citas y Cola

### Appointment (Cita)
```typescript
interface Appointment {
  id: string;
  customerId: string;
  serviceId: string;
  technicianId?: string;
  date: Timestamp;
  duration: number;
  status: AppointmentStatus;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### QueueEntry (Entrada en Cola)
```typescript
interface QueueEntry {
  id: string;
  customerId: string;
  position: number;
  estimatedWaitTime: number;
  status: QueueStatus; // 'waiting', 'called', 'serving', 'completed'
  serviceType: string;
  createdAt: Timestamp;
  calledAt?: Timestamp;
  completedAt?: Timestamp;
}
```

## 6. Modelos de Compras y Proveedores

### PurchaseOrder (Orden de Compra)
```typescript
interface PurchaseOrder {
  id: string;
  supplierId: string;
  items: PurchaseOrderItem[];
  status: PurchaseOrderStatus;
  totalAmount: number;
  expectedDelivery?: Timestamp;
  actualDelivery?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Supplier (Proveedor)
```typescript
interface Supplier {
  id: string;
  name: string;
  contact: SupplierContact;
  address: Address;
  paymentTerms: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 7. Modelos de Notificaciones y Comunicación

### Notification (Notificación)
```typescript
interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: Timestamp;
}
```

### AutomatedNotification (Automática)
```typescript
interface AutomatedNotification {
  id: string;
  trigger: NotificationTrigger;
  template: NotificationTemplate;
  conditions: NotificationCondition[];
  isActive: boolean;
  createdAt: Timestamp;
}
```

## 8. Modelos de Programación y Horarios

### EmployeeSchedule (Horario Empleado)
```typescript
interface EmployeeSchedule {
  id: string;
  employeeId: string;
  date: Timestamp;
  shifts: ShiftConfig[];
  breaks: BreakConfig[];
  totalHours: number;
  createdAt: Timestamp;
}
```

### ShiftConfig (Configuración de Turno)
```typescript
interface ShiftConfig {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  type: ShiftType;   // 'morning', 'afternoon', 'night'
  location: string;  // workshop identifier
}
```

## 9. Modelos de IA y Cache

### AICache (Cache de IA)
```typescript
interface AICache {
  id: string; // semantic key
  prompt: string;
  context: string;
  response: string;
  tokens: number;
  provider: 'gemini' | 'fallback';
  createdAt: Timestamp;
  expiresAt: Timestamp;
}
```

### AICostTracking (Seguimiento de Costos)
```typescript
interface AICostTracking {
  id: string;
  context: string;
  tokens: number;
  cost: number;
  provider: string;
  userId: string;
  timestamp: Timestamp;
}
```

## 10. Modelos de Configuración y Sistema

### SystemSettings (Configuración Sistema)
```typescript
interface SystemSettings {
  id: string;
  key: string;
  value: any;
  category: SettingCategory;
  isPublic: boolean;
  updatedAt: Timestamp;
}
```

### AuditLog (Log de Auditoría)
```typescript
interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes: any;
  ipAddress: string;
  userAgent: string;
  timestamp: Timestamp;
}
```

## Enums y Tipos Comunes

### Status Enums
```typescript
enum WorkOrderStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show'
}

enum PurchaseOrderStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  CONFIRMED = 'confirmed',
  RECEIVED = 'received',
  CANCELLED = 'cancelled'
}
```

### Priority Enums (REQUERIDOS)
```typescript
enum WorkOrderPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

enum ServiceType {
  MAINTENANCE = 'maintenance',
  REPAIR = 'repair',
  INSPECTION = 'inspection',
  EMERGENCY = 'emergency'
}
```

## Modelos Obsoletos (Marcados para Eliminación)

Los siguientes modelos han sido identificados como obsoletos y deben ser eliminados:

1. **InventoryLocation** - No utilizado
2. **Quote** - Funcionalidad no implementada
3. **ReturnOrder** - Funcionalidad no implementada
4. **WarrantyClaim** - Funcionalidad no implementada
5. **WorkQueue** - Reemplazado por QueueEntry
6. **AppSettings** - Reemplazado por SystemSettings
7. **VehicleAssignment** - Funcionalidad no implementada

## Recomendaciones

### Prioridad Alta
1. **Crear enums faltantes**: WorkOrderPriority y ServiceType
2. **Eliminar modelos obsoletos**: Los 7 modelos identificados
3. **Estandarizar timestamps**: Usar Timestamp de Firestore consistentemente

### Prioridad Media
1. **Agregar validaciones**: Constraints en modelos críticos
2. **Documentar relaciones**: Foreign keys y dependencias
3. **Crear índices**: Para consultas frecuentes

### Prioridad Baja
1. **Optimizar tipos**: Usar unions donde apropiado
2. **Agregar metadata**: Versiones y deprecation notices
3. **Crear schemas**: Para validación de datos

Esta documentación refleja el estado actual de los modelos de datos, con todos los modelos activos correctamente documentados y los obsoletos claramente identificados para eliminación.