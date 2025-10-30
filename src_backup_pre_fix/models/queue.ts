import { Timestamp, FieldValue } from './types';

/**
 * QueueEntry Model - Customer queue management.
 *
 * Purpose: Manages customer queue for walk-in service requests, tracking position,
 * status, and service assignments in real-time.
 *
 * Propósito: Gestiona la cola de clientes para solicitudes de servicio sin cita, rastreando posición,
 * estado y asignaciones de servicio en tiempo real.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'queueEntries', auto-generated id
 * - Query: Use Firestore query() on 'queueEntries' collection by status, position
 * - Delete: Use Firestore deleteDoc() when service is completed
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'queueEntries', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'queueEntries' por status, position
 * - Eliminar: Usar Firestore deleteDoc() cuando el servicio es completado
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface QueueEntry {
  id: string;
  customerId: string; // ref to customers - referencia a customers
  serviceType: import('./types').QueueServiceType;
  status: import('./types').QueueEntryStatus;
  position: number; // queue position - posición en cola
  joinedAt: Timestamp | FieldValue | Date;
  estimatedWaitTime?: number; // minutes - minutos
  assignedTo?: string; // technician id when called - id de técnico cuando es llamado
  workOrderId?: string; // work order id when created - id de orden de trabajo cuando es creada
  notes?: string;
  qrCodeDataUrl?: string; // for notifications - para notificaciones
  verificationCode?: string; // 4-digit code for verification - código de 4 dígitos para verificación
  expiresAt?: Timestamp | FieldValue | Date; // when the verification code expires (15 minutes from creation) - cuando expira el código de verificación (15 minutos desde creación)
  createdAt: Timestamp | FieldValue | Date;
  updatedAt: Timestamp | FieldValue | Date;
}

/**
 * QueueStatus Model - Global queue system status.
 *
 * Purpose: Singleton document tracking overall queue status, capacity,
 * and operating hours for the workshop.
 *
 * Propósito: Documento singleton que rastrea el estado general de la cola, capacidad
 * y horas de operación del taller.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'queueStatus', id = "singleton"
 * - Query: Use Firestore getDoc() on 'queueStatus' collection with id "singleton"
 * - Delete: Never delete - system status
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'queueStatus', id = "singleton"
 * - Consultar: Usar Firestore getDoc() en colección 'queueStatus' con id "singleton"
 * - Eliminar: Nunca eliminar - estado del sistema
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface QueueStatus {
  id: "singleton";
  isOpen: boolean;
  maxCapacity?: number;
  currentCount: number;
  averageWaitTime?: number; // minutes - minutos
  lastUpdated: Timestamp | FieldValue | Date;
  operatingHours?: {
    monday: { open: string; close: string; enabled: boolean };
    tuesday: { open: string; close: string; enabled: boolean };
    wednesday: { open: string; close: string; enabled: boolean };
    thursday: { open: string; close: string; enabled: boolean };
    friday: { open: string; close: string; enabled: boolean };
    saturday: { open: string; close: string; enabled: boolean };
    sunday: { open: string; close: string; enabled: boolean };
  };
}

/**
 * QueueJoinData Model - Data for joining the queue.
 *
 * Purpose: Temporary data structure for customers joining the queue,
 * containing all necessary information for queue entry creation.
 *
 * Propósito: Estructura de datos temporal para clientes que se unen a la cola,
 * conteniendo toda la información necesaria para creación de entrada de cola.
 *
 * CRUD Operations:
 * - Not persisted directly - used for queue entry creation
 * - Converted to QueueEntry when customer joins queue
 *
 * Operaciones CRUD:
 * - No se persiste directamente - usado para creación de entrada de cola
 * - Convertido a QueueEntry cuando cliente se une a cola
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface QueueJoinData {
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  serviceType: 'appointment' | 'direct_work_order';
  motorcycleId?: string; // ID del catálogo de motocicletas (opcional para identificación por placa)
  plate: string;
  mileageKm: number;
  notes?: string;
}

/**
 * QueueStatistics Model - Advanced queue analytics and metrics.
 *
 * Purpose: Comprehensive statistics for queue performance tracking,
 * including wait times, service efficiency, and customer satisfaction metrics.
 *
 * Propósito: Estadísticas completas para seguimiento de rendimiento de cola,
 * incluyendo tiempos de espera, eficiencia de servicio y métricas de satisfacción del cliente.
 *
 * References: Used by QueueService for dashboard analytics
 * Referencias: Usado por QueueService para análisis del dashboard
 */
export interface QueueStatistics {
  totalEntries: number;
  averageWaitTime: number; // minutes
  averageServiceTime: number; // minutes
  servedToday: number;
  noShowCount: number;
  cancelledCount: number;
  currentQueueLength: number;
  peakHour: string;
  busiestDay: string;
  customerSatisfaction?: number; // average rating 1-5
  technicianUtilization: number; // percentage
  periodStart: Timestamp;
  periodEnd: Timestamp;
  updatedAt: Timestamp;
}

/**
 * QueueFilter Model - Filtering options for queue entries.
 *
 * Purpose: Defines filter criteria for searching and filtering queue entries
 * in the employee dashboard.
 *
 * Propósito: Define criterios de filtro para buscar y filtrar entradas de cola
 * en el dashboard de empleados.
 *
 * References: Used by QueueService for advanced filtering
 * Referencias: Usado por QueueService para filtrado avanzado
 */
export interface QueueFilter {
  status?: import('./types').QueueEntryStatus[];
  serviceType?: import('./types').QueueServiceType[];
  assignedTo?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchTerm?: string;
  sortBy?: 'joinedAt' | 'position' | 'estimatedWaitTime' | 'status';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}