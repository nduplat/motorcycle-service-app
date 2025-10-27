import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';

// Initialize Firebase Admin if not already initialized
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp();
  console.log('🤖 AI Proxy: Firebase Admin initialized in services.ts');
} else {
  console.log('🤖 AI Proxy: Firebase Admin already initialized');
}

const db = admin.firestore();

// Structured logging utility
class StructuredLogger {
  static info(message: string, context?: any) {
    logger.info(message, context || {});
  }

  static warn(message: string, context?: any) {
    logger.warn(message, context || {});
  }

  static error(message: string, error?: any, context?: any) {
    const logContext = {
      ...context,
      error: error?.message || error,
      stack: error?.stack
    };
    logger.error(message, logContext);
  }

  static debug(message: string, context?: any) {
    logger.debug(message, context || {});
  }
}

// Metrics collection utility
class MetricsCollector {
  private static metrics: { [key: string]: { count: number; totalTime: number; errors: number } } = {};

  static incrementCounter(metric: string, value: number = 1) {
    if (!this.metrics[metric]) {
      this.metrics[metric] = { count: 0, totalTime: 0, errors: 0 };
    }
    this.metrics[metric].count += value;
  }

  static recordError(metric: string) {
    if (!this.metrics[metric]) {
      this.metrics[metric] = { count: 0, totalTime: 0, errors: 0 };
    }
    this.metrics[metric].errors++;
  }

  static recordTiming(metric: string, duration: number) {
    if (!this.metrics[metric]) {
      this.metrics[metric] = { count: 0, totalTime: 0, errors: 0 };
    }
    this.metrics[metric].totalTime += duration;
    this.metrics[metric].count++;
  }

  static async flushMetrics() {
    try {
      const metricsToStore = { ...this.metrics, timestamp: admin.firestore.FieldValue.serverTimestamp() };
      await db.collection('functionMetrics').add(metricsToStore);
      this.metrics = {}; // Reset after flushing
      StructuredLogger.info('Metrics flushed successfully', { metricsCount: Object.keys(metricsToStore).length - 1 });
    } catch (error) {
      StructuredLogger.error('Failed to flush metrics', error);
    }
  }

  static getMetrics() {
    return { ...this.metrics };
  }
}

// Circuit breaker pattern for external service calls
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    const startTime = Date.now();

    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        StructuredLogger.info(`Circuit breaker for ${operationName} entering HALF_OPEN state`);
      } else {
        MetricsCollector.recordError(`circuit_breaker.${operationName}`);
        throw new Error(`Circuit breaker is OPEN for ${operationName}`);
      }
    }

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      MetricsCollector.recordTiming(`operation.${operationName}`, duration);

      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
        StructuredLogger.info(`Circuit breaker for ${operationName} reset to CLOSED state`);
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      MetricsCollector.recordError(`operation.${operationName}`);

      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
        StructuredLogger.warn(`Circuit breaker for ${operationName} opened after ${this.failures} failures`);
      }

      throw error;
    }
  }

  getState() {
    return this.state;
  }

  reset() {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }
}

// Global circuit breaker instances
const capacityCircuitBreaker = new CircuitBreaker(3, 30000); // 30s recovery
const assignmentCircuitBreaker = new CircuitBreaker(3, 30000);
const metricsCircuitBreaker = new CircuitBreaker(3, 30000);

// Export utilities for use in other modules
export { StructuredLogger, MetricsCollector, CacheService, RateLimiter };

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_COLLECTION = 'functionCache';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_CALLS = 10; // Max 10 calls per minute per operation
const RATE_LIMIT_COLLECTION = 'rateLimits';

/**
 * Cache utility functions with enhanced error handling and metrics
 */
class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    try {
      MetricsCollector.incrementCounter('cache.get');

      const cacheDoc = await db.collection(CACHE_COLLECTION).doc(key).get();
      if (!cacheDoc.exists) {
        MetricsCollector.incrementCounter('cache.miss');
        StructuredLogger.debug('Cache miss', { key });
        return null;
      }

      const data = cacheDoc.data();
      if (!data) {
        MetricsCollector.incrementCounter('cache.miss');
        StructuredLogger.debug('Cache miss - no data', { key });
        return null;
      }

      const now = Date.now();
      const cachedAt = data.cachedAt?.toMillis?.() || data.cachedAt;

      if (now - cachedAt > CACHE_TTL) {
        // Cache expired, delete it
        MetricsCollector.incrementCounter('cache.expired');
        StructuredLogger.debug('Cache expired, deleting', { key, age: now - cachedAt });
        await db.collection(CACHE_COLLECTION).doc(key).delete();
        return null;
      }

      MetricsCollector.incrementCounter('cache.hit');
      const duration = Date.now() - startTime;
      MetricsCollector.recordTiming('cache.get.duration', duration);

      StructuredLogger.debug('Cache hit', { key, age: now - cachedAt });
      return data.value as T;
    } catch (error) {
      MetricsCollector.recordError('cache.get');
      StructuredLogger.error('Cache get error', error, { key });
      return null;
    }
  }

  static async set<T>(key: string, value: T): Promise<void> {
    const startTime = Date.now();
    try {
      MetricsCollector.incrementCounter('cache.set');

      await db.collection(CACHE_COLLECTION).doc(key).set({
        value,
        cachedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const duration = Date.now() - startTime;
      MetricsCollector.recordTiming('cache.set.duration', duration);

      StructuredLogger.debug('Cache set successful', { key });
    } catch (error) {
      MetricsCollector.recordError('cache.set');
      StructuredLogger.error('Cache set error', error, { key });
      throw new Error(`Cache set failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static async invalidate(pattern: string): Promise<void> {
    const startTime = Date.now();
    try {
      MetricsCollector.incrementCounter('cache.invalidate');

      // Get all cache documents and filter by pattern in memory
      const cacheSnapshot = await db.collection(CACHE_COLLECTION).get();

      const matchingDocs = cacheSnapshot.docs.filter(doc => doc.id.includes(pattern));

      if (matchingDocs.length === 0) {
        StructuredLogger.debug('No cache entries to invalidate', { pattern });
        return;
      }

      const batch = db.batch();
      matchingDocs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      const duration = Date.now() - startTime;
      MetricsCollector.recordTiming('cache.invalidate.duration', duration);
      MetricsCollector.incrementCounter('cache.invalidated', matchingDocs.length);

      StructuredLogger.info('Cache invalidated successfully', { pattern, count: matchingDocs.length });
    } catch (error) {
      MetricsCollector.recordError('cache.invalidate');
      StructuredLogger.error('Cache invalidate error', error, { pattern });
      throw new Error(`Cache invalidate failed for pattern ${pattern}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Rate limiting utility with enhanced error handling and metrics
 */
class RateLimiter {
  static async checkLimit(operation: string): Promise<boolean> {
    const startTime = Date.now();
    try {
      MetricsCollector.incrementCounter('rate_limit.check');

      const now = Date.now();
      const windowStart = now - RATE_LIMIT_WINDOW;
      const key = `${operation}_${Math.floor(now / RATE_LIMIT_WINDOW)}`;

      // Use transaction to prevent race conditions
      const result = await db.runTransaction(async (transaction) => {
        const rateLimitRef = db.collection(RATE_LIMIT_COLLECTION).doc(key);
        const rateLimitDoc = await transaction.get(rateLimitRef);
        const currentCount = rateLimitDoc.exists ? rateLimitDoc.data()?.count || 0 : 0;

        if (currentCount >= RATE_LIMIT_MAX_CALLS) {
          MetricsCollector.incrementCounter('rate_limit.exceeded');
          StructuredLogger.warn('Rate limit exceeded', { operation, currentCount, maxCalls: RATE_LIMIT_MAX_CALLS });
          return false;
        }

        // Increment counter atomically
        transaction.set(rateLimitRef, {
          count: currentCount + 1,
          windowStart,
          expiresAt: admin.firestore.Timestamp.fromMillis(windowStart + RATE_LIMIT_WINDOW)
        }, { merge: true });

        return true;
      });

      const duration = Date.now() - startTime;
      MetricsCollector.recordTiming('rate_limit.check.duration', duration);

      if (result) {
        MetricsCollector.incrementCounter('rate_limit.allowed');
      }

      return result;
    } catch (error) {
      MetricsCollector.recordError('rate_limit.check');
      StructuredLogger.error('Rate limit check error', error, { operation });
      // Allow the operation if rate limiting fails to avoid blocking legitimate requests
      StructuredLogger.warn('Rate limiting failed, allowing operation to proceed', { operation });
      return true;
    }
  }
}

// Type definitions for Firestore data
interface FirestoreWorkOrder {
  id: string;
  clientId: string;
  vehicleId: string;
  services: string[];
  products: string[];
  status: string;
  totalPrice: number;
  createdAt: admin.firestore.Timestamp;
  assignedTo?: string;
  number?: string;
  parts?: any[];
  updatedAt?: admin.firestore.Timestamp;
}

interface FirestoreAppointment {
  id: string;
  number: string;
  clientId?: string;
  vehicleId: string;
  serviceId?: string;
  scheduledAt: admin.firestore.Timestamp;
  estimatedDuration: number;
  status: string;
  assignedTo?: string;
  workOrderId?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  customerId?: string;
  serviceTypes?: string[];
  notes?: string;
}

interface FirestoreUser {
  id: string;
  email: string;
  displayName: string;
  name: string;
  role: string;
  availability?: {
    isAvailable: boolean;
    lastUpdated: admin.firestore.Timestamp;
    reason?: string;
  };
}

// Server-side service utilities for Firebase Cloud Functions
// These replicate the logic from Angular services but work with firebase-admin

export class WorkshopCapacityService {
  static async calculateCurrentCapacity() {
    const startTime = Date.now();
    const cacheKey = 'workshop_capacity_current';

    try {
      MetricsCollector.incrementCounter('workshop_capacity.calculate');

      // Check rate limit
      const withinLimit = await RateLimiter.checkLimit('calculateCurrentCapacity');
      if (!withinLimit) {
        // Return cached result even if expired, or throw error
        const cachedResult = await CacheService.get(cacheKey);
        if (cachedResult) {
          MetricsCollector.incrementCounter('workshop_capacity.rate_limited_cache_hit');
          StructuredLogger.info('Rate limited, returning cached workshop capacity');
          return cachedResult;
        }
        MetricsCollector.recordError('workshop_capacity.rate_limited_no_cache');
        throw new Error('Rate limit exceeded and no cache available');
      }

      // Try to get from cache first
      const cachedResult = await CacheService.get(cacheKey);
      if (cachedResult) {
        MetricsCollector.incrementCounter('workshop_capacity.cache_hit');
        StructuredLogger.debug('Returning cached workshop capacity');
        return cachedResult;
      }

      // Use circuit breaker for database operations
      const result = await capacityCircuitBreaker.execute(async () => {
        MetricsCollector.incrementCounter('workshop_capacity.db_query');

        // Get current date and time
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get active work orders
        const workOrdersSnapshot = await db.collection('workOrders')
          .where('status', 'in', ['in_progress', 'waiting_parts'])
          .get();

        const activeWorkOrders = workOrdersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreWorkOrder));

        // Get scheduled appointments for today
        const appointmentsSnapshot = await db.collection('appointments')
          .where('scheduledAt', '>=', admin.firestore.Timestamp.fromDate(today))
          .where('scheduledAt', '<', admin.firestore.Timestamp.fromDate(tomorrow))
          .where('status', 'in', ['scheduled', 'confirmed', 'in_progress'])
          .get();

        const scheduledAppointments = appointmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreAppointment));

        // Get all technicians
        const techniciansSnapshot = await db.collection('users')
          .where('role', '==', 'technician')
          .get();

        const technicians = techniciansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreUser));

        // Count active work orders
        const activeWorkOrdersCount = activeWorkOrders.length;

        // Count scheduled appointments
        const scheduledAppointmentsCount = scheduledAppointments.length;

        // Count available technicians (not currently assigned to active work)
        const busyTechnicians = new Set([
          ...activeWorkOrders.map((wo: any) => wo.assignedTo),
          ...scheduledAppointments.map((apt: any) => apt.assignedTo)
        ].filter(Boolean));

        const availableTechnicians = technicians.filter((tech: any) =>
          tech.availability?.isAvailable !== false && !busyTechnicians.has(tech.id)
        ).length;

        // Calculate capacity metrics
        const totalCapacity = technicians.length * 8; // Assuming 8 hours per technician per day
        const usedCapacity = activeWorkOrdersCount + scheduledAppointmentsCount;
        const availableCapacity = Math.max(0, totalCapacity - usedCapacity);
        const utilizationRate = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0;

        const result = {
          totalCapacity,
          usedCapacity,
          availableCapacity,
          utilizationRate,
          activeWorkOrders: activeWorkOrdersCount,
          scheduledAppointments: scheduledAppointmentsCount,
          availableTechnicians
        };

        return result;
      }, 'calculateCurrentCapacity');

      // Cache the result
      await CacheService.set(cacheKey, result);

      const duration = Date.now() - startTime;
      MetricsCollector.recordTiming('workshop_capacity.calculate.duration', duration);

      StructuredLogger.info('Workshop capacity calculated successfully', {
        totalCapacity: result.totalCapacity,
        utilizationRate: result.utilizationRate,
        availableTechnicians: result.availableTechnicians,
        duration
      });

      return result;
    } catch (error) {
      MetricsCollector.recordError('workshop_capacity.calculate');
      StructuredLogger.error('Error in WorkshopCapacityService.calculateCurrentCapacity', error, {
        duration: Date.now() - startTime
      });
      throw new Error(`Workshop capacity calculation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Invalidate capacity cache when relevant data changes
   */
  static async invalidateCapacityCache() {
    await CacheService.invalidate('workshop_capacity');
  }
}

export class TimeCoordinationService {
  static async notifyDelayedJobs() {
    const startTime = Date.now();

    try {
      MetricsCollector.incrementCounter('delayed_jobs.check');

      const now = new Date();
      const delayThreshold = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

      // Get active work orders with circuit breaker
      const delayedJobsCount = await capacityCircuitBreaker.execute(async () => {
        MetricsCollector.incrementCounter('delayed_jobs.db_query');

        // Get active work orders
        const workOrdersSnapshot = await db.collection('workOrders')
          .where('status', 'in', ['in_progress', 'waiting_parts'])
          .get();

        const activeWorkOrders = workOrdersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreWorkOrder));

        // Find delayed jobs
        const delayedJobs = activeWorkOrders.filter((wo: any) => {
          const createdTime = wo.createdAt.toDate();
          return (now.getTime() - createdTime.getTime()) > delayThreshold;
        });

        // Get managers for notifications
        const managersSnapshot = await db.collection('users')
          .where('role', '==', 'manager')
          .get();

        const managers = managersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreUser));

        // Create notifications for delayed jobs
        const notificationPromises: Promise<any>[] = [];

        for (const workOrder of delayedJobs) {
          const delayHours = Math.round((now.getTime() - workOrder.createdAt.toDate().getTime()) / (1000 * 60 * 60));

          // Notify assigned technician
          if (workOrder.assignedTo) {
            notificationPromises.push(
              db.collection('notifications').add({
                type: 'service_orders',
                title: 'Trabajo Retrasado',
                message: `La orden de trabajo ${workOrder.id} está retrasada. Por favor revise el progreso.`,
                userId: workOrder.assignedTo,
                priority: 'high',
                targetAudience: 'specific_user',
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                additionalMeta: {
                  workOrderId: workOrder.id,
                  delayHours
                }
              })
            );
          }

          // Notify managers
          for (const manager of managers) {
            notificationPromises.push(
              db.collection('notifications').add({
                type: 'service_orders',
                title: 'Orden de Trabajo Retrasada',
                message: `La orden de trabajo ${workOrder.id} para el cliente ${workOrder.clientId} está retrasada.`,
                userId: manager.id,
                priority: 'medium',
                targetAudience: 'specific_user',
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                additionalMeta: {
                  workOrderId: workOrder.id,
                  requiresAttention: true,
                  delayHours
                }
              })
            );
          }
        }

        // Wait for all notifications to be created
        if (notificationPromises.length > 0) {
          await Promise.all(notificationPromises);
          MetricsCollector.incrementCounter('delayed_jobs.notifications_sent', notificationPromises.length);
        }

        return delayedJobs.length;
      }, 'notifyDelayedJobs');

      const duration = Date.now() - startTime;
      MetricsCollector.recordTiming('delayed_jobs.check.duration', duration);

      StructuredLogger.info('Delayed jobs check completed', {
        delayedJobsCount,
        duration
      });

      return delayedJobsCount;
    } catch (error) {
      MetricsCollector.recordError('delayed_jobs.check');
      StructuredLogger.error('Error in TimeCoordinationService.notifyDelayedJobs', error, {
        duration: Date.now() - startTime
      });
      throw new Error(`Delayed jobs notification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export class SmartAssignmentService {
  static async optimizeDailySchedule() {
    const startTime = Date.now();

    try {
      MetricsCollector.incrementCounter('schedule_optimization.attempt');

      const result = await assignmentCircuitBreaker.execute(async () => {
        MetricsCollector.incrementCounter('schedule_optimization.db_query');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get appointments for today
        const appointmentsSnapshot = await db.collection('appointments')
          .where('scheduledAt', '>=', admin.firestore.Timestamp.fromDate(today))
          .where('scheduledAt', '<', admin.firestore.Timestamp.fromDate(tomorrow))
          .get();

        const appointments = appointmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreAppointment));

        // Get active work orders
        const workOrdersSnapshot = await db.collection('workOrders')
          .where('status', 'in', ['open', 'in_progress', 'waiting_parts'])
          .get();

        const workOrders = workOrdersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreWorkOrder));

        // Get technicians
        const techniciansSnapshot = await db.collection('users')
          .where('role', '==', 'technician')
          .get();

        const technicians = techniciansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreUser));

        let reassignedAppointments = 0;
        let optimizedWorkOrders = 0;

        // Simple workload balancing logic
        const technicianWorkloads: { [key: string]: number } = {};
        technicians.forEach((tech: any) => {
          technicianWorkloads[tech.id] = 0;
        });

        // Count current workloads
        workOrders.forEach((wo: any) => {
          if (wo.assignedTo && technicianWorkloads[wo.assignedTo] !== undefined) {
            technicianWorkloads[wo.assignedTo]++;
          }
        });

        appointments.forEach((apt: any) => {
          if (apt.assignedTo && technicianWorkloads[apt.assignedTo] !== undefined) {
            technicianWorkloads[apt.assignedTo]++;
          }
        });

        // Find overloaded and underloaded technicians
        const avgWorkload = Object.values(technicianWorkloads).reduce((sum, load) => sum + load, 0) / Object.keys(technicianWorkloads).length;
        const overloaded = Object.entries(technicianWorkloads).filter(([, load]) => load > avgWorkload + 1);
        const underloaded = Object.entries(technicianWorkloads).filter(([, load]) => load < avgWorkload - 1);

        // Reassign work orders from overloaded to underloaded technicians
        const reassignmentPromises: Promise<any>[] = [];

        for (const [overloadedTechId] of overloaded) {
          const techWorkOrders = workOrders.filter((wo: any) => wo.assignedTo === overloadedTechId && wo.status === 'open');

          for (const [underloadedTechId] of underloaded) {
            if (techWorkOrders.length > 0) {
              const workOrderToReassign = techWorkOrders[0];

              reassignmentPromises.push(
                db.collection('workOrders').doc(workOrderToReassign.id).update({
                  assignedTo: underloadedTechId,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                })
              );

              technicianWorkloads[overloadedTechId]--;
              technicianWorkloads[underloadedTechId]++;
              optimizedWorkOrders++;
            }
          }
        }

        // Optimize unassigned appointments
        const unassignedAppointments = appointments.filter((apt: any) => !apt.assignedTo || apt.status === 'pending_approval');

        for (const appointment of unassignedAppointments) {
          // Find technician with lowest workload
          const bestTechnician = Object.entries(technicianWorkloads)
            .sort(([, a], [, b]) => a - b)[0];

          if (bestTechnician && bestTechnician[1] < avgWorkload + 2) { // Don't overload
            reassignmentPromises.push(
              db.collection('appointments').doc(appointment.id).update({
                assignedTo: bestTechnician[0],
                status: 'scheduled',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              })
            );

            technicianWorkloads[bestTechnician[0]]++;
            reassignedAppointments++;
          }
        }

        // Wait for all reassignments to complete
        if (reassignmentPromises.length > 0) {
          await Promise.all(reassignmentPromises);
          MetricsCollector.incrementCounter('schedule_optimization.reassignments', reassignmentPromises.length);
        }

        return { reassignedAppointments, optimizedWorkOrders };
      }, 'optimizeDailySchedule');

      const duration = Date.now() - startTime;
      MetricsCollector.recordTiming('schedule_optimization.duration', duration);

      StructuredLogger.info('Daily schedule optimization completed', {
        reassignedAppointments: result.reassignedAppointments,
        optimizedWorkOrders: result.optimizedWorkOrders,
        duration
      });

      return result;
    } catch (error) {
      MetricsCollector.recordError('schedule_optimization');
      StructuredLogger.error('Error in SmartAssignmentService.optimizeDailySchedule', error, {
        duration: Date.now() - startTime
      });
      throw new Error(`Schedule optimization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export class TechnicianMetricsService {
  static async calculateMonthlyMetrics() {
    const startTime = Date.now();
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthKey = currentMonth.toISOString().slice(0, 7); // YYYY-MM format
    const cacheKey = `technician_metrics_${monthKey}`;

    try {
      MetricsCollector.incrementCounter('technician_metrics.calculate');

      // Check rate limit
      const withinLimit = await RateLimiter.checkLimit('calculateMonthlyMetrics');
      if (!withinLimit) {
        // Return cached result even if expired
        const cachedResult = await CacheService.get(cacheKey);
        if (cachedResult) {
          MetricsCollector.incrementCounter('technician_metrics.rate_limited_cache_hit');
          StructuredLogger.info(`Rate limited, returning cached technician metrics for ${monthKey}`);
          return cachedResult;
        }
        MetricsCollector.recordError('technician_metrics.rate_limited_no_cache');
        throw new Error('Rate limit exceeded and no cache available');
      }

      // Try to get from cache first (cache monthly metrics for 1 hour)
      const cachedResult = await CacheService.get(cacheKey);
      if (cachedResult) {
        MetricsCollector.incrementCounter('technician_metrics.cache_hit');
        StructuredLogger.debug(`Returning cached technician metrics for ${monthKey}`);
        return cachedResult;
      }

      const result = await metricsCircuitBreaker.execute(async () => {
        MetricsCollector.incrementCounter('technician_metrics.db_query');

        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // Get work orders for the month
        const workOrdersSnapshot = await db.collection('workOrders')
          .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(currentMonth))
          .where('createdAt', '<', admin.firestore.Timestamp.fromDate(nextMonth))
          .get();

        const monthlyWorkOrders = workOrdersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreWorkOrder));

        // Get appointments for the month
        const appointmentsSnapshot = await db.collection('appointments')
          .where('scheduledAt', '>=', admin.firestore.Timestamp.fromDate(currentMonth))
          .where('scheduledAt', '<', admin.firestore.Timestamp.fromDate(nextMonth))
          .get();

        const monthlyAppointments = appointmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreAppointment));

        // Get technicians
        const techniciansSnapshot = await db.collection('users')
          .where('role', '==', 'technician')
          .get();

        const technicians = techniciansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreUser));

        // Calculate metrics
        const totalWorkOrders = monthlyWorkOrders.length;
        const completedWorkOrders = monthlyWorkOrders.filter((wo: any) => wo.status === 'ready_for_pickup').length;
        const completionRate = totalWorkOrders > 0 ? (completedWorkOrders / totalWorkOrders) * 100 : 0;

        const totalAppointments = monthlyAppointments.length;
        const completedAppointments = monthlyAppointments.filter((apt: any) => apt.status === 'completed').length;
        const appointmentCompletionRate = totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;

        // Calculate average completion time
        const completedWorkOrdersWithTimes = monthlyWorkOrders.filter((wo: any) =>
          wo.status === 'ready_for_pickup' && wo.createdAt && wo.updatedAt
        );

        let totalCompletionTime = 0;
        completedWorkOrdersWithTimes.forEach((wo: any) => {
          const createdTime = wo.createdAt.toDate?.() || new Date(wo.createdAt);
          const completedTime = wo.updatedAt?.toDate?.() || new Date(wo.updatedAt);
          totalCompletionTime += (completedTime.getTime() - createdTime.getTime());
        });

        const averageCompletionTime = completedWorkOrdersWithTimes.length > 0
          ? totalCompletionTime / completedWorkOrdersWithTimes.length / (1000 * 60 * 60) // Convert to hours
          : 0;

        // Calculate technician performance
        const technicianMetrics = technicians.map((technician: any) => {
          const techWorkOrders = monthlyWorkOrders.filter((wo: any) => wo.assignedTo === technician.id);
          const techCompletedWorkOrders = techWorkOrders.filter((wo: any) => wo.status === 'ready_for_pickup');

          const techAppointments = monthlyAppointments.filter((apt: any) => apt.assignedTo === technician.id);
          const techCompletedAppointments = techAppointments.filter((apt: any) => apt.status === 'completed');

          // Calculate efficiency (simplified)
          const efficiency = techCompletedWorkOrders.length > 0
            ? Math.min(100, (techCompletedWorkOrders.length / 10) * 100) // Assuming 10 work orders = 100% efficiency
          : 0;

          return {
            technicianId: technician.id,
            technicianName: technician.name,
            workOrdersAssigned: techWorkOrders.length,
            workOrdersCompleted: techCompletedWorkOrders.length,
            appointmentsAssigned: techAppointments.length,
            appointmentsCompleted: techCompletedAppointments.length,
            efficiency
          };
        });

        // Calculate revenue metrics (if available)
        const totalRevenue = monthlyWorkOrders
          .filter((wo: any) => wo.totalPrice)
          .reduce((sum, wo: any) => sum + (wo.totalPrice || 0), 0);

        const result = {
          month: monthKey,
          periodStart: admin.firestore.Timestamp.fromDate(currentMonth),
          periodEnd: admin.firestore.Timestamp.fromDate(nextMonth),

          // Work order metrics
          totalWorkOrders,
          completedWorkOrders,
          completionRate,

          // Appointment metrics
          totalAppointments,
          completedAppointments,
          appointmentCompletionRate,

          // Performance metrics
          averageCompletionTime,

          // Financial metrics
          totalRevenue,

          // Technician performance
          technicianMetrics,

          // Metadata
          calculatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        return result;
      }, 'calculateMonthlyMetrics');

      // Cache the result for 1 hour (shorter than monthly cache since data changes frequently)
      await CacheService.set(cacheKey, result);

      const duration = Date.now() - startTime;
      MetricsCollector.recordTiming('technician_metrics.calculate.duration', duration);

      StructuredLogger.info('Monthly technician metrics calculated successfully', {
        month: monthKey,
        totalWorkOrders: result.totalWorkOrders,
        completionRate: result.completionRate,
        totalRevenue: result.totalRevenue,
        duration
      });

      return result;
    } catch (error) {
      MetricsCollector.recordError('technician_metrics.calculate');
      StructuredLogger.error('Error in TechnicianMetricsService.calculateMonthlyMetrics', error, {
        month: monthKey,
        duration: Date.now() - startTime
      });
      throw new Error(`Monthly metrics calculation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
    * Invalidate metrics cache when relevant data changes
    */
   static async invalidateMetricsCache() {
     await CacheService.invalidate('technician_metrics');
   }

   /**
    * Flush accumulated metrics to Firestore (should be called periodically)
    */
   static async flushAccumulatedMetrics() {
     await MetricsCollector.flushMetrics();
   }
 }