import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Job, JobType, JobStatus, JobData } from '../../src/models/job';

// Initialize Firebase Admin
const db = admin.firestore();

/**
 * Job Workers - Firebase Functions for background job processing.
 *
 * Purpose: Process background jobs queued by the JobQueueService.
 * Handles different job types with proper error handling and retry logic.
 *
 * Features:
 * - Scheduled job processing
 * - Priority-based job execution
 * - Automatic retry with exponential backoff
 * - Job status updates
 * - Error logging and monitoring
 *
 * References: Called by scheduled functions and manual triggers
 */

// ========================================
// JOB PROCESSING FUNCTIONS
// ========================================

/**
 * Process pending jobs - Main worker function
 * Runs every minute to process high-priority jobs
 */
export const processPendingJobs = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('America/Bogota')
  .onRun(async (context) => {
    console.log('🔄 Starting job processing cycle');

    try {
      const jobsProcessed = await processJobsBatch(10); // Process up to 10 jobs per cycle
      console.log(`✅ Job processing cycle completed. Processed ${jobsProcessed} jobs`);
    } catch (error) {
      console.error('❌ Error in job processing cycle:', error);
    }
  });

/**
 * Process urgent jobs - High frequency for critical jobs
 * Runs every 30 seconds for urgent jobs only
 */
export const processUrgentJobs = functions.pubsub
  .schedule('every 30 seconds')
  .timeZone('America/Bogota')
  .onRun(async (context) => {
    console.log('🚨 Processing urgent jobs');

    try {
      const urgentJobsProcessed = await processJobsBatch(5, ['urgent']); // Only urgent jobs
      console.log(`✅ Urgent job processing completed. Processed ${urgentJobsProcessed} jobs`);
    } catch (error) {
      console.error('❌ Error processing urgent jobs:', error);
    }
  });

/**
 * Manual job trigger - HTTP endpoint for manual job processing
 */
export const triggerJobProcessing = functions.https.onCall(async (data, context) => {
  // Verify authentication (admin/technician only)
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const userRole = userDoc.data()?.role;

  if (!['admin', 'technician'].includes(userRole)) {
    throw new functions.https.HttpsError('permission-denied', 'Solo administradores y técnicos pueden procesar jobs manualmente');
  }

  const { jobId, priority, limit = 5 } = data;

  try {
    let jobsProcessed = 0;

    if (jobId) {
      // Process specific job
      await processJob(jobId);
      jobsProcessed = 1;
    } else {
      // Process batch of jobs
      jobsProcessed = await processJobsBatch(limit, priority ? [priority] : undefined);
    }

    return {
      success: true,
      jobsProcessed,
      message: `Procesados ${jobsProcessed} jobs exitosamente`
    };
  } catch (error: any) {
    console.error('Error in manual job processing:', error);
    throw new functions.https.HttpsError('internal', `Error procesando jobs: ${error.message}`);
  }
});

/**
 * Retry failed jobs - Scheduled retry processor
 * Runs every 5 minutes to retry failed jobs
 */
export const retryFailedJobs = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('America/Bogota')
  .onRun(async (context) => {
    console.log('🔄 Processing job retries');

    try {
      const retriesProcessed = await processJobRetries();
      console.log(`✅ Job retry processing completed. Processed ${retriesProcessed} retries`);
    } catch (error) {
      console.error('❌ Error in job retry processing:', error);
    }
  });

// ========================================
// CORE PROCESSING LOGIC
// ========================================

/**
 * Process a batch of pending jobs
 */
async function processJobsBatch(limit: number = 10, priorities?: string[]): Promise<number> {
  // Get pending jobs ordered by priority and creation time
  let query = db.collection('jobs')
    .where('status', 'in', ['pending', 'retrying'])
    .orderBy('createdAt', 'asc')
    .limit(limit);

  // Filter by priority if specified
  if (priorities && priorities.length > 0) {
    query = query.where('priority', 'in', priorities);
  }

  const snapshot = await query.get();

  if (snapshot.empty) {
    console.log('ℹ️ No pending jobs to process');
    return 0;
  }

  let processedCount = 0;

  // Process jobs sequentially to avoid overwhelming the system
  for (const doc of snapshot.docs) {
    try {
      const job = { id: doc.id, ...doc.data() } as Job;

      // Check if job is ready for retry (if it's retrying)
      if (job.status === 'retrying' && job.nextRetryAt) {
        const nextRetryTime = job.nextRetryAt.toDate();
        if (nextRetryTime > new Date()) {
          console.log(`⏰ Job ${job.id} not ready for retry yet`);
          continue; // Skip this job, not ready for retry
        }
      }

      await processJob(job.id);
      processedCount++;

      // Small delay between jobs to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`❌ Error processing job ${doc.id}:`, error);
      // Continue with next job even if one fails
    }
  }

  return processedCount;
}

/**
 * Process a single job
 */
async function processJob(jobId: string): Promise<void> {
  const jobRef = db.collection('jobs').doc(jobId);
  const jobDoc = await jobRef.get();

  if (!jobDoc.exists) {
    console.warn(`⚠️ Job ${jobId} not found`);
    return;
  }

  const job = { id: jobDoc.id, ...jobDoc.data() } as Job;

  // Double-check status to prevent race conditions
  if (job.status !== 'pending' && job.status !== 'retrying') {
    console.log(`⏭️ Job ${jobId} status is ${job.status}, skipping`);
    return;
  }

  console.log(`🔄 Processing job ${jobId} (${job.type})`);

  try {
    // Update job status to processing
    await jobRef.update({
      status: JobStatus.PROCESSING,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Process based on job type
    const result = await processJobByType(job);

    // Mark as completed
    await jobRef.update({
      status: JobStatus.COMPLETED,
      result,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      processingTimeMs: Date.now() - (job.startedAt?.toDate().getTime() || Date.now()),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Job ${jobId} completed successfully`);

  } catch (error: any) {
    console.error(`❌ Job ${jobId} failed:`, error);

    const isRetryable = isRetryableError(error);

    if (isRetryable && job.retryCount < job.maxRetries) {
      // Schedule retry with exponential backoff
      await scheduleJobRetry(jobRef, job);
    } else {
      // Mark as permanently failed
      await jobRef.update({
        status: JobStatus.FAILED,
        error: error.message,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        processingTimeMs: Date.now() - (job.startedAt?.toDate().getTime() || Date.now()),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }
}

/**
 * Process job based on its type
 */
async function processJobByType(job: Job): Promise<any> {
  switch (job.type) {
    case JobType.CREATE_WORK_ORDER:
      return await processCreateWorkOrder(job.data);
    case JobType.SEND_NOTIFICATION:
      return await processSendNotification(job.data);
    case JobType.PROCESS_PAYMENT:
      return await processPayment(job.data);
    case JobType.GENERATE_REPORT:
      return await processGenerateReport(job.data);
    case JobType.SYNC_INVENTORY:
      return await processSyncInventory(job.data);
    case JobType.MAINTENANCE_REMINDER:
      return await processMaintenanceReminder(job.data);
    case JobType.BULK_OPERATION:
      return await processBulkOperation(job.data);
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

/**
 * Schedule a job for retry with exponential backoff
 */
async function scheduleJobRetry(jobRef: FirebaseFirestore.DocumentReference, job: Job): Promise<void> {
  const retryCount = job.retryCount + 1;
  const delayMs = Math.min(1000 * Math.pow(2, retryCount), 300000); // Max 5 minutes
  const nextRetryAt = new Date(Date.now() + delayMs);

  await jobRef.update({
    status: JobStatus.RETRYING,
    retryCount,
    nextRetryAt: admin.firestore.Timestamp.fromDate(nextRetryAt),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`🔄 Job ${job.id} scheduled for retry ${retryCount}/${job.maxRetries} in ${delayMs}ms`);
}

/**
 * Process job retries
 */
async function processJobRetries(): Promise<number> {
  const now = new Date();

  // Find jobs ready for retry
  const retryJobs = await db.collection('jobs')
    .where('status', '==', 'retrying')
    .where('nextRetryAt', '<=', now)
    .limit(20)
    .get();

  let retryCount = 0;

  for (const doc of retryJobs.docs) {
    try {
      await processJob(doc.id);
      retryCount++;
    } catch (error) {
      console.error(`❌ Error retrying job ${doc.id}:`, error);
    }
  }

  return retryCount;
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;

  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';

  const retryablePatterns = [
    'timeout', 'network', 'temporary', 'unavailable', 'deadline',
    'resource_exhausted', 'aborted', 'internal', 'unknown'
  ];

  return retryablePatterns.some(pattern =>
    errorMessage.includes(pattern) || errorCode.includes(pattern)
  );
}

// ========================================
// JOB TYPE PROCESSORS
// ========================================

/**
 * Process work order creation
 */
async function processCreateWorkOrder(data: JobData): Promise<any> {
  if (!data.workOrderData) throw new Error('Missing workOrderData');

  console.log('🔧 Creating work order:', data.workOrderData);

  // Create work order document
  const workOrderRef = db.collection('workOrders').doc();
  const workOrderData = {
    ...data.workOrderData,
    id: workOrderRef.id,
    status: 'open',
    totalPrice: 0, // Will be calculated
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await workOrderRef.set(workOrderData);

  console.log(`✅ Work order created: ${workOrderRef.id}`);
  return { workOrderId: workOrderRef.id };
}

/**
 * Process notification sending
 */
async function processSendNotification(data: JobData): Promise<any> {
  if (!data.notificationData) throw new Error('Missing notificationData');

  console.log('📢 Sending notification:', data.notificationData.title);

  // Create notification document
  const notificationRef = db.collection('notifications').doc();
  const notificationData = {
    title: data.notificationData.title,
    message: data.notificationData.message,
    userId: data.notificationData.userId,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    meta: {
      generatedBy: 'background_job',
      jobType: 'notification'
    }
  };

  await notificationRef.set(notificationData);

  // Send push notification if user has FCM token
  if (data.notificationData.userId) {
    try {
      const userDoc = await db.collection('users').doc(data.notificationData.userId).get();
      const fcmToken = userDoc.data()?.fcmToken;

      if (fcmToken) {
        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: data.notificationData.title,
            body: data.notificationData.message
          },
          data: {
            notificationId: notificationRef.id,
            type: 'background_notification'
          }
        });
        console.log(`📱 Push notification sent to user ${data.notificationData.userId}`);
      }
    } catch (pushError) {
      console.warn('Failed to send push notification:', pushError);
      // Don't fail the job for push notification errors
    }
  }

  console.log(`✅ Notification sent: ${notificationRef.id}`);
  return { notificationId: notificationRef.id };
}

/**
 * Process payment (placeholder)
 */
async function processPayment(data: JobData): Promise<any> {
  if (!data.paymentData) throw new Error('Missing paymentData');

  console.log('💳 Processing payment:', data.paymentData);

  // Simulate payment processing
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Update work order status if payment successful
  if (data.paymentData.workOrderId) {
    await db.collection('workOrders').doc(data.paymentData.workOrderId).update({
      status: 'paid',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  return { paymentId: `payment_${Date.now()}`, status: 'processed' };
}

/**
 * Process report generation (placeholder)
 */
async function processGenerateReport(data: JobData): Promise<any> {
  if (!data.reportData) throw new Error('Missing reportData');

  console.log('📊 Generating report:', data.reportData.type);

  // Simulate report generation
  await new Promise(resolve => setTimeout(resolve, 2000));

  return { reportId: `report_${Date.now()}`, format: data.reportData.format };
}

/**
 * Process inventory sync (placeholder)
 */
async function processSyncInventory(data: JobData): Promise<any> {
  if (!data.inventoryData) throw new Error('Missing inventoryData');

  console.log('📦 Syncing inventory:', data.inventoryData.operation);

  // Simulate inventory sync
  await new Promise(resolve => setTimeout(resolve, 500));

  return { syncedItems: data.inventoryData.items?.length || 0 };
}

/**
 * Process maintenance reminder
 */
async function processMaintenanceReminder(data: JobData): Promise<any> {
  if (!data.reminderData) throw new Error('Missing reminderData');

  console.log('🔧 Processing maintenance reminder:', data.reminderData);

  // Create maintenance reminder document
  const reminderRef = db.collection('maintenanceReminders').doc();
  const reminderData = {
    customerId: data.reminderData.customerId,
    vehicleId: data.reminderData.vehicleId,
    serviceId: data.reminderData.serviceId,
    dueType: 'upcoming' as const,
    dueDate: data.reminderData.dueDate,
    dueMileage: data.reminderData.dueMileage,
    priority: 'recommended' as const,
    status: 'pending' as const,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await reminderRef.set(reminderData);

  // Create notification for the customer
  const notificationRef = db.collection('notifications').doc();
  await notificationRef.set({
    userId: data.reminderData.customerId,
    title: 'Recordatorio de Mantenimiento',
    message: `Es momento de programar mantenimiento para su vehículo.`,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    meta: {
      reminderId: reminderRef.id,
      type: 'maintenance_reminder'
    }
  });

  console.log(`✅ Maintenance reminder created: ${reminderRef.id}`);
  return { reminderId: reminderRef.id, notificationId: notificationRef.id };
}

/**
 * Process bulk operation (placeholder)
 */
async function processBulkOperation(data: JobData): Promise<any> {
  if (!data.bulkData) throw new Error('Missing bulkData');

  console.log('📋 Processing bulk operation:', data.bulkData.operation);

  // Simulate bulk operation processing
  await new Promise(resolve => setTimeout(resolve, 3000));

  return { processedItems: data.bulkData.items.length };
}

// ========================================
// MONITORING AND CLEANUP
// ========================================

/**
 * Clean up old completed jobs
 */
export const cleanupOldJobs = functions.pubsub
  .schedule('every 24 hours')
  .timeZone('America/Bogota')
  .onRun(async (context) => {
    console.log('🧹 Cleaning up old jobs');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Find old completed/failed jobs
      const oldJobs = await db.collection('jobs')
        .where('status', 'in', ['completed', 'failed'])
        .where('completedAt', '<', thirtyDaysAgo)
        .limit(500)
        .get();

      if (!oldJobs.empty) {
        const batch = db.batch();
        oldJobs.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        console.log(`🗑️ Cleaned up ${oldJobs.size} old jobs`);
      } else {
        console.log('ℹ️ No old jobs to clean up');
      }
    } catch (error) {
      console.error('❌ Error cleaning up old jobs:', error);
    }
  });

/**
 * Job monitoring and alerting
 */
export const monitorJobQueue = functions.pubsub
  .schedule('every 10 minutes')
  .timeZone('America/Bogota')
  .onRun(async (context) => {
    console.log('📊 Monitoring job queue health');

    try {
      // Count jobs by status
      const allJobs = await db.collection('jobs').get();
      const stats = {
        total: allJobs.size,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        retrying: 0
      };

      allJobs.docs.forEach(doc => {
        const status = doc.data().status;
        if (stats.hasOwnProperty(status)) {
          stats[status as keyof typeof stats]++;
        }
      });

      console.log('📈 Job queue stats:', stats);

      // Alert if too many failed jobs
      if (stats.failed > 10) {
        console.warn(`⚠️ High number of failed jobs: ${stats.failed}`);

        // Create admin notification
        await db.collection('notifications').add({
          title: 'Alerta: Muchos Jobs Fallidos',
          message: `${stats.failed} jobs han fallado. Revisar el sistema de procesamiento.`,
          userId: null, // Broadcast to admins
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          meta: {
            type: 'system_alert',
            alertType: 'failed_jobs',
            stats
          }
        });
      }

      // Alert if queue is backing up
      if (stats.pending > 50) {
        console.warn(`⚠️ Job queue backing up: ${stats.pending} pending jobs`);

        await db.collection('notifications').add({
          title: 'Alerta: Cola de Jobs Llena',
          message: `${stats.pending} jobs pendientes. El sistema puede estar lento.`,
          userId: null, // Broadcast to admins
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          meta: {
            type: 'system_alert',
            alertType: 'queue_backup',
            stats
          }
        });
      }

    } catch (error) {
      console.error('❌ Error monitoring job queue:', error);
    }
  });

export const cleanupOldData = functions.pubsub
  .schedule('0 2 * * 0') // Domingos 2am
  .timeZone('America/Bogota')
  .onRun(async (context) => {
    const db = admin.firestore();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    try {
      // Eliminar notificaciones viejas (más de 6 meses)
      const oldNotifications = await db
        .collection('notifications')
        .where('createdAt', '<', sixMonthsAgo)
        .limit(500)
        .get();

      if (oldNotifications.size > 0) {
        const batch = db.batch();
        oldNotifications.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        console.log(`Deleted ${oldNotifications.size} old notifications`);
      }

      // Eliminar entradas de queue completadas (más de 3 meses)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const oldQueueEntries = await db
        .collection('queue')
        .where('status', '==', 'completed')
        .where('updatedAt', '<', threeMonthsAgo)
        .limit(500)
        .get();

      if (oldQueueEntries.size > 0) {
        const batch = db.batch();
        oldQueueEntries.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        console.log(`Deleted ${oldQueueEntries.size} old queue entries`);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });