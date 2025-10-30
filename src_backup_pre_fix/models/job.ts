import { Timestamp } from './types';

/**
 * Job Model - Background job processing system.
 *
 * Purpose: Represents background jobs for processing heavy operations like
 * work order creation, notifications, and other async tasks.
 *
 * Propósito: Representa trabajos en background para procesar operaciones pesadas
 * como creación de órdenes de trabajo, notificaciones y otras tareas asíncronas.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'jobs', auto-generated id
 * - Query: Use Firestore query() on 'jobs' collection by status, type, createdAt
 * - Delete: Use Firestore deleteDoc() after successful completion
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'jobs', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'jobs' por status, type, createdAt
 * - Eliminar: Usar Firestore deleteDoc() después de completado exitosamente
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  data: JobData;
  result?: any;
  error?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  createdBy?: string; // User ID who created the job
  workerId?: string; // Worker function that processed it
  processingTimeMs?: number;
}

/**
 * Job types for different background operations.
 * Defines the specific operations that can be queued.
 *
 * Tipos de trabajo para diferentes operaciones en background.
 * Define las operaciones específicas que pueden ser encoladas.
 */
export enum JobType {
  CREATE_WORK_ORDER = 'create_work_order',
  SEND_NOTIFICATION = 'send_notification',
  PROCESS_PAYMENT = 'process_payment',
  GENERATE_REPORT = 'generate_report',
  SYNC_INVENTORY = 'sync_inventory',
  MAINTENANCE_REMINDER = 'maintenance_reminder',
  BULK_OPERATION = 'bulk_operation'
}

/**
 * Job status throughout its lifecycle.
 * Tracks the current state of background job processing.
 *
 * Estado del trabajo a lo largo de su ciclo de vida.
 * Rastrea el estado actual del procesamiento del trabajo en background.
 */
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled'
}

/**
 * Job priority levels for queue ordering.
 * Higher priority jobs are processed first.
 *
 * Niveles de prioridad para ordenamiento de cola.
 * Los trabajos de mayor prioridad se procesan primero.
 */
export enum JobPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Job data payload for different job types.
 * Contains the specific data needed for each operation.
 *
 * Payload de datos del trabajo para diferentes tipos.
 * Contiene los datos específicos necesarios para cada operación.
 */
export interface JobData {
  // Work order creation
  workOrderData?: {
    clientId: string;
    vehicleId: string;
    services: string[];
    products?: string[];
    priority?: string;
    notes?: string;
    assignedTo?: string;
  };

  // Notification data
  notificationData?: {
    userId?: string; // null for broadcast
    title: string;
    message?: string;
    templateId?: string;
    parameters?: Record<string, any>;
    channels?: ('push' | 'email' | 'sms')[];
  };

  // Payment processing
  paymentData?: {
    workOrderId: string;
    amount: number;
    method: string;
    customerId: string;
  };

  // Report generation
  reportData?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom';
    filters?: Record<string, any>;
    format: 'pdf' | 'excel' | 'csv';
    recipientEmails?: string[];
  };

  // Inventory sync
  inventoryData?: {
    operation: 'sync' | 'update' | 'reconcile';
    items?: Array<{
      productId: string;
      quantity: number;
      operation: 'add' | 'subtract' | 'set';
    }>;
  };

  // Maintenance reminder
  reminderData?: {
    customerId: string;
    vehicleId: string;
    serviceId: string;
    dueDate?: Timestamp;
    dueMileage?: number;
  };

  // Bulk operations
  bulkData?: {
    operation: string;
    items: any[];
    options?: Record<string, any>;
  };

  // Generic data for extensibility
  [key: string]: any;
}

/**
 * Job statistics and metrics.
 * Aggregated data for monitoring job queue performance.
 *
 * Estadísticas y métricas de trabajos.
 * Datos agregados para monitoreo del rendimiento de la cola de trabajos.
 */
export interface JobStats {
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number; // milliseconds
  successRate: number; // percentage
  periodStart: Timestamp;
  periodEnd: Timestamp;
  jobsByType: Record<JobType, number>;
  jobsByStatus: Record<JobStatus, number>;
  updatedAt: Timestamp;
}

/**
 * Job retry configuration.
 * Defines retry behavior with exponential backoff.
 *
 * Configuración de reintentos de trabajo.
 * Define el comportamiento de reintentos con backoff exponencial.
 */
export interface JobRetryConfig {
  maxRetries: number;
  baseDelayMs: number; // Base delay for exponential backoff
  maxDelayMs: number; // Maximum delay cap
  backoffMultiplier: number; // Exponential multiplier
  retryableErrors: string[]; // Error types that should be retried
}