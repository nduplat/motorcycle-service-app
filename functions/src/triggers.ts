import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { WorkshopCapacityService, TechnicianMetricsService, StructuredLogger, MetricsCollector } from './services';

// Initialize Firebase Admin (should be done in index.ts, but ensuring here)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Enhanced retry configuration
const MAX_RETRIES = 5;
const BASE_RETRY_DELAY = 100; // ms
const MAX_RETRY_DELAY = 5000; // 5 seconds

/**
 * Enhanced retry mechanism with exponential backoff and jitter
 */
async function retryTransaction<T>(
  transactionFn: () => Promise<T>,
  operationName: string,
  customMaxRetries?: number
): Promise<T> {
  let lastError: Error;
  const actualMaxRetries = customMaxRetries || MAX_RETRIES;

  for (let attempt = 1; attempt <= actualMaxRetries; attempt++) {
    try {
      MetricsCollector.incrementCounter(`trigger.${operationName}.attempt`);
      const startTime = Date.now();

      const result = await transactionFn();

      const duration = Date.now() - startTime;
      MetricsCollector.recordTiming(`trigger.${operationName}.duration`, duration);

      if (attempt > 1) {
        StructuredLogger.info(`Transaction succeeded on attempt ${attempt}`, {
          operation: operationName,
          attempts: attempt,
          duration
        });
      }

      return result;
    } catch (error: any) {
      lastError = error;
      MetricsCollector.recordError(`trigger.${operationName}`);

      // Determine if error is retryable
      const isRetryable = isRetryableError(error);

      if (!isRetryable || attempt === actualMaxRetries) {
        StructuredLogger.error(`Transaction failed permanently`, error, {
          operation: operationName,
          attempts: attempt,
          errorCode: error.code,
          retryable: isRetryable
        });
        throw error;
      }

      // Exponential backoff with jitter
      const baseDelay = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.1 * baseDelay; // Add up to 10% jitter
      const delay = Math.min(baseDelay + jitter, MAX_RETRY_DELAY);

      StructuredLogger.warn(`Transaction failed, retrying`, {
        operation: operationName,
        attempt,
        maxAttempts: actualMaxRetries,
        delay: Math.round(delay),
        errorCode: error.code,
        errorMessage: error.message?.substring(0, 100)
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Firestore transaction conflicts
  if (error.code === 'ABORTED') return true;

  // Temporary server errors
  if (error.code === 'UNAVAILABLE' || error.code === 'DEADLINE_EXCEEDED') return true;

  // Rate limiting (may be temporary)
  if (error.code === 'RESOURCE_EXHAUSTED') return true;

  // Network errors
  if (error.code === 'CANCELLED' || error.code === 'UNKNOWN') return true;

  // Don't retry permission errors, invalid arguments, etc.
  return false;
}

/**
 * Trigger when work order status changes
 * Updates workshop capacity and technician metrics (optimized with caching)
 */
export const onWorkOrderUpdate = onDocumentUpdated(
  'workOrders/{workOrderId}',
  async (event) => {
     const startTime = Date.now();
     const workOrderId = event.params.workOrderId;
     const beforeData = event.data?.before.data();
     const afterData = event.data?.after.data();

     try {
       MetricsCollector.incrementCounter('trigger.work_order_update');

       StructuredLogger.info(`Work order ${workOrderId} updated`, {
         beforeStatus: beforeData?.status,
         afterStatus: afterData?.status,
         assignedTo: afterData?.assignedTo
       });

       // Only proceed if status or assignment actually changed
       const statusChanged = beforeData?.status !== afterData?.status;
       const assignmentChanged = beforeData?.assignedTo !== afterData?.assignedTo;

       if (!statusChanged && !assignmentChanged) {
         StructuredLogger.debug('No relevant changes, skipping updates', { workOrderId });
         return null;
       }

       // Update technician availability if assigned technician changed
       if (assignmentChanged) {
         await retryTransaction(async () => {
           await db.runTransaction(async (transaction) => {
             if (beforeData?.assignedTo) {
               await updateTechnicianAvailability(transaction, beforeData.assignedTo, true); // Make previously assigned tech available
             }
             if (afterData?.assignedTo) {
               await updateTechnicianAvailability(transaction, afterData.assignedTo, false); // Make newly assigned tech busy
             }
           });
         }, 'updateTechnicianAvailabilityOnWorkOrderUpdate');
       }

       // Only update capacity if status changed (assignment changes don't affect capacity calculation)
       if (statusChanged) {
         // Invalidate capacity cache instead of recalculating immediately
         await WorkshopCapacityService.invalidateCapacityCache();

         // Store a lightweight capacity update record (without full calculation)
         await retryTransaction(async () => {
           await db.collection('workshopCapacity').doc(`trigger_${Date.now()}`).set({
             timestamp: admin.firestore.FieldValue.serverTimestamp(),
             triggeredBy: 'workOrderUpdate',
             workOrderId,
             statusChange: { from: beforeData?.status, to: afterData?.status },
             cacheInvalidated: true
           });
         }, 'storeCapacityUpdateRecord');
       }

       // If work order is completed, invalidate metrics cache
       if (afterData?.status === 'ready_for_pickup' && beforeData?.status !== 'ready_for_pickup') {
         await TechnicianMetricsService.invalidateMetricsCache();
         // Don't calculate metrics here - let scheduled function handle it
       }

       const duration = Date.now() - startTime;
       MetricsCollector.recordTiming('trigger.work_order_update.duration', duration);

       StructuredLogger.info(`Work order ${workOrderId} update processed successfully`, {
         statusChanged,
         assignmentChanged,
         duration
       });

       return null;
     } catch (error) {
       MetricsCollector.recordError('trigger.work_order_update');
       StructuredLogger.error('Error in onWorkOrderUpdate', error, {
         workOrderId,
         duration: Date.now() - startTime
       });
       throw error;
     }
   });

/**
 * Trigger when time entry is created (technician starts working)
 * Updates technician availability (optimized)
 */
export const onTimeEntryCreate = onDocumentCreated(
  'timeEntries/{timeEntryId}',
  async (event) => {
     const startTime = Date.now();
     const timeEntryId = event.params.timeEntryId;
     const timeEntryData = event.data?.data();

     if (!timeEntryData) {
       StructuredLogger.error('No time entry data found', null, { timeEntryId });
       return null;
     }

     try {
       MetricsCollector.incrementCounter('trigger.time_entry_create');

       StructuredLogger.info(`Time entry ${timeEntryId} created`, {
         technicianId: timeEntryData.technicianId,
         workOrderId: timeEntryData.workOrderId
       });

       // Update technician availability to busy with retry
       await retryTransaction(async () => {
         await updateTechnicianAvailabilitySimple(timeEntryData.technicianId, false);
       }, 'updateTechnicianAvailabilityOnTimeEntryCreate');

       // Invalidate capacity cache instead of recalculating
       await WorkshopCapacityService.invalidateCapacityCache();

       const duration = Date.now() - startTime;
       MetricsCollector.recordTiming('trigger.time_entry_create.duration', duration);

       StructuredLogger.info(`Time entry ${timeEntryId} creation processed successfully`, { duration });
       return null;
     } catch (error) {
       MetricsCollector.recordError('trigger.time_entry_create');
       StructuredLogger.error('Error in onTimeEntryCreate', error, {
         timeEntryId,
         technicianId: timeEntryData?.technicianId,
         duration: Date.now() - startTime
       });
       throw error;
     }
   });

/**
 * Trigger when time entry is updated (technician completes work)
 * Updates technician availability and metrics (optimized)
 */
export const onTimeEntryEnd = onDocumentUpdated(
  'timeEntries/{timeEntryId}',
  async (event) => {
     const startTime = Date.now();
     const timeEntryId = event.params.timeEntryId;
     const beforeData = event.data?.before.data();
     const afterData = event.data?.after.data();

     if (!beforeData || !afterData) {
       StructuredLogger.error('No time entry data found', null, { timeEntryId });
       return null;
     }

     try {
       MetricsCollector.incrementCounter('trigger.time_entry_end');

       StructuredLogger.info(`Time entry ${timeEntryId} updated`, {
         technicianId: afterData.technicianId,
         workOrderId: afterData.workOrderId,
         started: beforeData.endAt ? false : true,
         completed: afterData.endAt ? true : false
       });

       // Only proceed if time entry was just completed (endAt was added)
       if (!beforeData.endAt && afterData.endAt) {
         // Update technician availability to available with retry
         await retryTransaction(async () => {
           await updateTechnicianAvailabilitySimple(afterData.technicianId, true);
         }, 'updateTechnicianAvailabilityOnTimeEntryEnd');

         // Invalidate caches instead of recalculating immediately
         await WorkshopCapacityService.invalidateCapacityCache();
         await TechnicianMetricsService.invalidateMetricsCache();

         // Don't calculate metrics here - let scheduled function handle it
       }

       const duration = Date.now() - startTime;
       MetricsCollector.recordTiming('trigger.time_entry_end.duration', duration);

       StructuredLogger.info(`Time entry ${timeEntryId} update processed successfully`, { duration });
       return null;
     } catch (error) {
       MetricsCollector.recordError('trigger.time_entry_end');
       StructuredLogger.error('Error in onTimeEntryEnd', error, {
         timeEntryId,
         technicianId: afterData?.technicianId,
         duration: Date.now() - startTime
       });
       throw error;
     }
   });


/**
 * Update technician availability
 */
async function updateTechnicianAvailability(
  transaction: admin.firestore.Transaction,
  technicianId: string,
  isAvailable: boolean
): Promise<void> {
  const technicianRef = db.collection('users').doc(technicianId);
  const technicianDoc = await transaction.get(technicianRef);

  if (technicianDoc.exists) {
    const currentData = technicianDoc.data();
    transaction.update(technicianRef, {
      availability: {
        ...currentData?.availability,
        isAvailable,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

/**
 * Trigger when user document is created
 * Assigns roles based on email lists from Firestore
 */
export const onUserDocumentCreated = onDocumentCreated(
  'users/{userId}',
  async (event) => {
    const startTime = Date.now();
    const userId = event.params.userId;
    const userData = event.data?.data();

    if (!userData) {
      StructuredLogger.error('No user data found', null, { userId });
      return null;
    }

    try {
      MetricsCollector.incrementCounter('trigger.user_document_created');

      StructuredLogger.info(`User document created for ${userId}`, {
        email: userData.email
      });

      // Fetch role assignments from Firestore
      const roleAssignmentsRef = db.collection('roleAssignments').doc('singleton');
      const roleAssignmentsSnap = await roleAssignmentsRef.get();

      if (!roleAssignmentsSnap.exists) {
        StructuredLogger.warn('Role assignments document not found, skipping role assignment', { userId });
        return null;
      }

      const roleAssignments = roleAssignmentsSnap.data();
      const ownerEmails = roleAssignments?.ownerEmails || [];
      const employeeEmails = roleAssignments?.employeeEmails || [];

      let assignedRole = userData.role; // Default to existing role

      if (ownerEmails.includes(userData.email)) {
        assignedRole = 'admin';
      } else if (employeeEmails.includes(userData.email)) {
        assignedRole = 'technician';
      }

      // Update role if it changed
      if (assignedRole !== userData.role) {
        await retryTransaction(async () => {
          await db.collection('users').doc(userId).update({
            role: assignedRole,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }, 'assignUserRoleOnCreation');

        StructuredLogger.info(`Assigned role ${assignedRole} to user ${userData.email}`, {
          userId,
          email: userData.email,
          originalRole: userData.role,
          assignedRole
        });
      } else {
        StructuredLogger.debug('No role change needed for user', { userId, email: userData.email, role: assignedRole });
      }

      const duration = Date.now() - startTime;
      MetricsCollector.recordTiming('trigger.user_document_created.duration', duration);

      StructuredLogger.info(`User document creation processed successfully`, { userId, duration });

      return null;
    } catch (error) {
      MetricsCollector.recordError('trigger.user_document_created');
      StructuredLogger.error('Error in onUserDocumentCreated', error, {
        userId,
        duration: Date.now() - startTime
      });
      throw error;
    }
  });

/**
 * Update technician availability (simple version without transaction)
 */
async function updateTechnicianAvailabilitySimple(technicianId: string, isAvailable: boolean): Promise<void> {
  try {
    const technicianRef = db.collection('users').doc(technicianId);
    await technicianRef.update({
      'availability.isAvailable': isAvailable,
      'availability.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error('Error updating technician availability:', error);
    throw error;
  }
}
