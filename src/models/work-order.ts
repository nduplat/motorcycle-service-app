import { Timestamp } from './types';

/**
 * WorkOrder Model - Central entity for repair services.
 *
 * Purpose: Represents a complete repair/service job for a customer's vehicle.
 * Contains services, parts, status, and pricing information.
 *
 * Propósito: Representa un trabajo completo de reparación/servicio para el vehículo de un cliente.
 * Contiene servicios, partes, estado e información de precios.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'workOrders', auto-generated id
 * - Query: Use Firestore query() on 'workOrders' collection by clientId, status, assignedTo
 * - Delete: Use Firestore deleteDoc() (rare, usually keep for history)
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'workOrders', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'workOrders' por clientId, status, assignedTo
 * - Eliminar: Usar Firestore deleteDoc() (raro, usualmente mantener para historial)
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface WorkOrder {
  id: string;
  clientId: string;
  vehicleId: string;
  services: string[]; // Array of Service IDs - Array de IDs de Servicio
  products: string[]; // Array of Product IDs - Array de IDs de Producto
  status: import('./types').WorkOrderStatus;
  totalPrice: number;
  createdAt: Timestamp;
  number?: string;
  assignedTo?: string;
  parts?: WorkOrderPart[];
  notes?: string;
  updatedAt?: Timestamp;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Appointment Model - Scheduled service appointments.
 *
 * Purpose: Manages customer appointments for services, including scheduling,
 * status tracking, and conversion to work orders.
 *
 * Propósito: Gestiona citas de servicio de clientes, incluyendo programación,
 * seguimiento de estado y conversión a órdenes de trabajo.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'appointments', auto-generated id
 * - Query: Use Firestore query() on 'appointments' collection by date, clientId, status
 * - Delete: Use Firestore deleteDoc() when appointment is cancelled
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'appointments', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'appointments' por date, clientId, status
 * - Eliminar: Usar Firestore deleteDoc() cuando la cita es cancelada
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface Appointment {
  id: string;
  number: string; // "APT-2025-0001"
  clientId?: string;
  vehicleId: string;
  serviceId?: string;
  date?: Timestamp;
  scheduledAt: Timestamp;
  estimatedDuration: number; // minutos
  status: "pending_approval" | "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
  assignedTo?: string; // technician id - id de técnico
  workOrderId?: string; // se crea cuando inicia el servicio
  createdAt: Timestamp;
  updatedAt: Timestamp;
  serviceTypes?: string[];
  notes?: string;
}

/**
 * Service Model - Predefined services offered by the workshop.
 *
 * Purpose: Catalog of available services with pricing, compatibility, and requirements.
 * Used for service selection and work order creation.
 *
 * Propósito: Catálogo de servicios disponibles con precios, compatibilidad y requerimientos.
 * Usado para selección de servicio y creación de órdenes de trabajo.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'services', auto-generated id
 * - Query: Use Firestore query() on 'services' collection by compatibleBrands/Models
 * - Delete: Use Firestore deleteDoc() or set isActive to false
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'services', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'services' por compatibleBrands/Models
 * - Eliminar: Usar Firestore deleteDoc() o configurar isActive a false
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  compatibleBrands: string[];
  compatibleModels: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * ServiceItem Model - Detailed service catalog entries.
 *
 * Purpose: Comprehensive service definitions with parts suggestions,
 * required skills, and maintenance scheduling.
 *
 * Propósito: Definiciones completas de servicio con sugerencias de partes,
 * habilidades requeridas y programación de mantenimiento.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'serviceItems', auto-generated id
 * - Query: Use Firestore query() on 'serviceItems' collection with filters
 * - Delete: Use Firestore deleteDoc() or set isActive to false
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'serviceItems', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'serviceItems' con filtros
 * - Eliminar: Usar Firestore deleteDoc() o configurar isActive a false
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface ServiceItem {
  id: string;
  code?: string;
  title: string; // e.g., "Cambio de aceite completo"
  description?: string;
  type?: "maintenance" | "repair" | "inspection" | "customization"; // Tipo de servicio
  estimatedHours?: number;
  price?: number; // base price - precio base
  partsSuggested?: Array<{ productId: string; qty: number }>;
  requiredSkills?: string[]; // e.g., ["brakes", "electrical"] - ej. ["frenos", "eléctrica"]
  compatibleBrands: string[];
  compatibleModels: string[];
  taxPercent?: number;
  isActive?: boolean; // Service availability status - Estado de disponibilidad del servicio
  notificationDays?: number; // Days before maintenance notification - Días antes de notificación de mantenimiento
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * WorkOrderPart Model - Parts used in work orders.
 *
 * Purpose: Tracks specific parts and quantities used in each work order,
 * with pricing snapshots for accurate cost calculation.
 *
 * Propósito: Rastrea partes específicas y cantidades usadas en cada orden de trabajo,
 * con instantáneas de precios para cálculo preciso de costos.
 *
 * CRUD Operations:
 * - Save: Stored in workOrders.parts array, updated with work order
 * - Query: Retrieved as part of WorkOrder document
 * - Delete: Removed from parts array in WorkOrder update
 *
 * Operaciones CRUD:
 * - Guardar: Almacenado en array workOrders.parts, actualizado con orden de trabajo
 * - Consultar: Recuperado como parte del documento WorkOrder
 * - Eliminar: Removido del array parts en actualización de WorkOrder
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface WorkOrderPart {
  productId: string;
  variantId?: string;
  qty: number;
  unitPrice?: number; // snapshot of price when used - instantánea de precio cuando se usó
  taxPercent?: number;
}

/**
 * TimeEntry Model - Technician time tracking.
 *
 * Purpose: Records time spent by technicians on work orders for billing
 * and productivity tracking.
 *
 * Propósito: Registra tiempo gastado por técnicos en órdenes de trabajo para facturación
 * y seguimiento de productividad.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'timeEntries', auto-generated id
 * - Query: Use Firestore query() on 'timeEntries' collection by workOrderId, technicianId
 * - Delete: Use Firestore deleteDoc() for corrections
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'timeEntries', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'timeEntries' por workOrderId, technicianId
 * - Eliminar: Usar Firestore deleteDoc() para correcciones
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface TimeEntry {
  id: string;
  workOrderId: string;
  technicianId: string;
  startAt: Timestamp;
  endAt?: Timestamp;
  minutes?: number; // computed - calculado
  notes?: string;
  createdAt: Timestamp;
  pauses?: TimePause[]; // Array of pause periods - Array de períodos de pausa
}

/**
 * TimePause Model - Represents a pause period within a time entry.
 *
 * Purpose: Tracks when technicians take breaks during work, allowing accurate
 * time calculation excluding break periods.
 *
 * Propósito: Rastrea cuando los técnicos toman descansos durante el trabajo,
 * permitiendo cálculo preciso del tiempo excluyendo períodos de descanso.
 *
 * References: Used within TimeEntry.pauses array
 * Referencias: Usado dentro del array TimeEntry.pauses
 */
export interface TimePause {
  pauseAt: Timestamp; // When the pause started - Cuando comenzó la pausa
  resumeAt?: Timestamp; // When work resumed (null if still paused) - Cuando se reanudó el trabajo (null si aún está en pausa)
  reason?: string; // Optional reason for pause (break, lunch, etc.) - Razón opcional de la pausa (descanso, almuerzo, etc.)
}

/**
 * ServiceRecord Model - Historical service records.
 *
 * Purpose: Maintains complete history of services performed on vehicles,
 * including costs, mileage, and next service due dates.
 *
 * Propósito: Mantiene historial completo de servicios realizados en vehículos,
 * incluyendo costos, kilometraje y próximas fechas de vencimiento de servicio.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'serviceRecords', auto-generated id
 * - Query: Use Firestore query() on 'serviceRecords' collection by customerId, vehicleId
 * - Delete: Usually not deleted, kept for history
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'serviceRecords', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'serviceRecords' por customerId, vehicleId
 * - Eliminar: Usualmente no se elimina, se mantiene para historial
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface ServiceRecord {
  id: string;
  workOrderId: string;
  customerId: string;
  vehicleId: string;
  serviceId: string;
  serviceName: string;
  performedAt: Timestamp;
  mileageAtService?: number;
  nextDueDate?: Timestamp; // calculado automáticamente
  nextDueMileage?: number;
  totalCost: number;
  laborCost: number;
  partsCost: number;
  taxAmount: number;
  technicianId: string;
  durationMinutes: number;
  notes?: string;
  createdAt: Timestamp;
}

/**
 * MaintenanceReminder Model - Service due notifications.
 *
 * Purpose: Tracks upcoming maintenance and sends reminders to customers
 * based on time or mileage intervals.
 *
 * Propósito: Rastrea mantenimiento próximo y envía recordatorios a clientes
 * basados en intervalos de tiempo o kilometraje.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'maintenanceReminders', auto-generated id
 * - Query: Use Firestore query() on 'maintenanceReminders' collection by customerId, status
 * - Delete: Use Firestore deleteDoc() when reminder is no longer relevant
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'maintenanceReminders', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'maintenanceReminders' por customerId, status
 * - Eliminar: Usar Firestore deleteDoc() cuando el recordatorio ya no es relevante
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface MaintenanceReminder {
  id: string;
  customerId: string;
  vehicleId: string;
  serviceId: string;
  serviceName: string;
  dueType: "overdue" | "due_soon" | "upcoming";
  dueDate?: Timestamp;
  dueMileage?: number;
  currentMileage?: number;
  priority: "critical" | "recommended" | "optional";
  lastServiceDate?: Timestamp;
  status: "pending" | "sent" | "scheduled" | "dismissed";
  createdAt: Timestamp;
}

/**
 * TimeEntryMetrics Model - Time tracking analytics and KPIs.
 *
 * Purpose: Aggregated metrics for time entry analysis, including productivity
 * tracking, overtime monitoring, and efficiency calculations.
 *
 * Propósito: Métricas agregadas para análisis de entradas de tiempo, incluyendo seguimiento
 * de productividad, monitoreo de horas extras y cálculos de eficiencia.
 *
 * References: Used by TimeEntryService for dashboard metrics
 * Referencias: Usado por TimeEntryService para métricas del dashboard
 */
export interface TimeEntryMetrics {
  totalHoursWorked: number;
  averageDailyHours: number;
  overtimeHours: number;
  productiveHours: number; // hours spent on actual work
  breakHours: number;
  efficiencyRate: number; // percentage of productive time
  technicianId: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  workOrdersCompleted: number;
  averageTimePerWorkOrder: number; // minutes
  updatedAt: Timestamp;
}

/**
 * WorkOrderFilter Model - Filtering options for work orders.
 *
 * Purpose: Defines filter criteria for searching and filtering work orders
 * in the employee dashboard.
 *
 * Propósito: Define criterios de filtro para buscar y filtrar órdenes de trabajo
 * en el dashboard de empleados.
 *
 * References: Used by WorkOrderService for advanced filtering
 * Referencias: Usado por WorkOrderService para filtrado avanzado
 */
export interface WorkOrderFilter {
  status?: import('./types').WorkOrderStatus[];
  assignedTo?: string[];
  clientId?: string;
  vehicleId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  serviceTypes?: string[];
  searchTerm?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status' | 'totalPrice';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * WorkOrderStats Model - Statistics for work order analytics.
 *
 * Purpose: Aggregated statistics and KPIs for work order performance
 * tracking in the employee dashboard.
 *
 * Propósito: Estadísticas agregadas y KPIs para seguimiento de rendimiento
 * de órdenes de trabajo en el dashboard de empleados.
 *
 * References: Used by WorkOrderService for dashboard metrics
 * Referencias: Usado por WorkOrderService para métricas del dashboard
 */
export interface WorkOrderStats {
  totalWorkOrders: number;
  completedToday: number;
  inProgress: number;
  pending: number;
  overdue: number;
  averageCompletionTime: number; // hours
  totalRevenue: number;
  averageRevenuePerOrder: number;
  technicianUtilization: number; // percentage
  customerSatisfaction?: number; // average rating
  periodStart: Timestamp;
  periodEnd: Timestamp;
  updatedAt: Timestamp;
}