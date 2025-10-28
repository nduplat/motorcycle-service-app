import { Timestamp } from './types';

/**
 * TimeBlock Model - Scheduled time blocks for technicians.
 *
 * Purpose: Defines specific time periods for work, breaks, or maintenance
 * in the technician scheduling system.
 *
 * Propósito: Define períodos de tiempo específicos para trabajo, descansos o mantenimiento
 * en el sistema de programación de técnicos.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'timeBlocks', auto-generated id
 * - Query: Use Firestore query() on 'timeBlocks' collection by technicianId, date range
 * - Delete: Use Firestore deleteDoc() when schedule changes
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'timeBlocks', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'timeBlocks' por technicianId, rango de fechas
 * - Eliminar: Usar Firestore deleteDoc() cuando el horario cambia
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface TimeBlock {
  id: string;
  startTime: Timestamp;
  endTime: Timestamp;
  type: 'work' | 'break' | 'maintenance';
  technicianId?: string;
  workshopLocationId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * ShiftConfig Model - Predefined shift templates.
 *
 * Purpose: Defines standard shift patterns that can be assigned to employees,
 * including start/end times and applicable days.
 *
 * Propósito: Define patrones estándar de turnos que pueden asignarse a empleados,
 * incluyendo horas de inicio/fin y días aplicables.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'shiftConfigs', auto-generated id
 * - Query: Use Firestore query() on 'shiftConfigs' collection by workshopLocationId
 * - Delete: Use Firestore deleteDoc() or set isActive to false
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'shiftConfigs', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'shiftConfigs' por workshopLocationId
 * - Eliminar: Usar Firestore deleteDoc() o configurar isActive a false
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface ShiftConfig {
  id: string;
  name: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  daysOfWeek: number[]; // 0-6 (Sunday-Saturday) - 0-6 (Domingo-Sábado)
  workshopLocationId?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * BreakConfig Model - Break period configurations.
 *
 * Purpose: Defines break periods within shifts, including duration and timing.
 *
 * Propósito: Define períodos de descanso dentro de turnos, incluyendo duración y horario.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'breakConfigs', auto-generated id
 * - Query: Use Firestore query() on 'breakConfigs' collection by shiftConfigId
 * - Delete: Use Firestore deleteDoc() or set isActive to false
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'breakConfigs', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'breakConfigs' por shiftConfigId
 * - Eliminar: Usar Firestore deleteDoc() o configurar isActive a false
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface BreakConfig {
  id: string;
  name: string;
  durationMinutes: number;
  startTime: string; // HH:MM
  shiftConfigId: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * EmployeeSchedule Model - Complete employee schedule.
 *
 * Purpose: Combines shifts, breaks, and time blocks for a specific employee
 * on a specific date, calculating total hours worked.
 *
 * Propósito: Combina turnos, descansos y bloques de tiempo para un empleado específico
 * en una fecha específica, calculando horas totales trabajadas.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'employeeSchedules', auto-generated id
 * - Query: Use Firestore query() on 'employeeSchedules' collection by employeeId, date
 * - Delete: Use Firestore deleteDoc() when schedule is no longer needed
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'employeeSchedules', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'employeeSchedules' por employeeId, fecha
 * - Eliminar: Usar Firestore deleteDoc() cuando el horario ya no es necesario
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface EmployeeSchedule {
  id: string;
  employeeId: string; // User id - ID de usuario
  date: Timestamp;
  shifts: ShiftConfig[];
  breaks: BreakConfig[];
  timeBlocks: TimeBlock[];
  totalHours: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * WorkshopCapacity Model - Daily workshop capacity tracking.
 *
 * Purpose: Tracks available capacity for technicians and work orders at each
 * workshop location on specific dates.
 *
 * Propósito: Rastrea capacidad disponible para técnicos y órdenes de trabajo en cada
 * ubicación del taller en fechas específicas.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'workshopCapacities', auto-generated id
 * - Query: Use Firestore query() on 'workshopCapacities' collection by workshopLocationId, date
 * - Delete: Use Firestore deleteDoc() when capacity data is outdated
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'workshopCapacities', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'workshopCapacities' por workshopLocationId, fecha
 * - Eliminar: Usar Firestore deleteDoc() cuando los datos de capacidad están desactualizados
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface WorkshopCapacity {
  id: string;
  workshopLocationId: string;
  date: Timestamp;
  maxTechnicians: number;
  maxWorkOrders: number;
  availableSlots: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * TechnicianMetrics Model - Performance metrics for technicians.
 *
 * Purpose: Tracks key performance indicators for technicians including
 * completed work orders, efficiency, and customer satisfaction.
 *
 * Propósito: Rastrea indicadores clave de rendimiento para técnicos incluyendo
 * órdenes de trabajo completadas, eficiencia y satisfacción del cliente.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'technicianMetrics', auto-generated id
 * - Query: Use Firestore query() on 'technicianMetrics' collection by technicianId, period
 * - Delete: Use Firestore deleteDoc() when metrics are archived
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'technicianMetrics', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'technicianMetrics' por technicianId, período
 * - Eliminar: Usar Firestore deleteDoc() cuando las métricas son archivadas
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface TechnicianMetrics {
  id: string;
  technicianId: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  completedWorkOrders: number;
  totalHoursWorked: number;
  averageJobDuration: number; // minutes - minutos
  efficiencyRate: number; // percentage - porcentaje
  customerRating?: number; // average rating 1-5 - calificación promedio 1-5
  reworkCount: number;
  onTimeCompletionRate: number; // percentage - porcentaje
  revenueGenerated: number;
  utilizationRate: number; // percentage - porcentaje
  createdAt: Timestamp;
  updatedAt: Timestamp;
}


/**
 * AuditLog Model - System audit trail.
 *
 * Purpose: Maintains complete audit trail of all system changes for compliance
 * and debugging purposes.
 *
 * Propósito: Mantiene rastro de auditoría completo de todos los cambios del sistema para cumplimiento
 * y propósitos de depuración.
 *
 * CRUD Operations:
 * - Save: Use Firestore addDoc() with collection 'auditLogs', auto-generated id
 * - Query: Use Firestore query() on 'auditLogs' collection by entity, performedBy, date
 * - Delete: Never delete - immutable audit trail
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore addDoc() con colección 'auditLogs', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'auditLogs' por entity, performedBy, fecha
 * - Eliminar: Nunca eliminar - rastro de auditoría inmutable
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface AuditLog {
  id: string;
  entity: string; // collection name - nombre de colección
  entityId: string;
  action: string; // create/update/delete - crear/actualizar/eliminar
  changes?: Record<string, any>;
  performedBy?: string; // user id - id de usuario
  performedAt: Timestamp;
}

/**
 * TechnicianKPIs Model - Key Performance Indicators for technicians.
 *
 * Purpose: Real-time KPIs and performance metrics for technician dashboards,
 * including trend analysis and benchmarking data.
 *
 * Propósito: KPIs en tiempo real y métricas de rendimiento para dashboards de técnicos,
 * incluyendo análisis de tendencias y datos de benchmarking.
 *
 * References: Used by TechnicianMetricsService for real-time performance tracking
 * Referencias: Usado por TechnicianMetricsService para seguimiento de rendimiento en tiempo real
 */
export interface TechnicianKPIs {
  technicianId: string;
  currentEfficiency: number; // percentage
  trendDirection: 'up' | 'down' | 'stable';
  trendPercentage: number;
  benchmarkComparison: number; // percentage above/below average
  dailyGoalProgress: number; // percentage
  weeklyGoalProgress: number; // percentage
  monthlyGoalProgress: number; // percentage
  skillsUtilization: Record<string, number>; // skill -> utilization percentage
  customerSatisfactionTrend: number[]; // last 30 days
  averageResolutionTime: number; // minutes
  reworkRate: number; // percentage
  utilizationRate: number; // percentage
  periodStart: Timestamp;
  periodEnd: Timestamp;
  updatedAt: Timestamp;
}