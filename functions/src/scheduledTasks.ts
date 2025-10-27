import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { WorkshopCapacityService, TimeCoordinationService, SmartAssignmentService, TechnicianMetricsService } from './services';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

/**
 * Retry a database operation with exponential backoff
 */
async function retryDatabaseOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      logger.warn(`${operationName} failed (attempt ${attempt}/${MAX_RETRIES}):`, error.message);

      // Don't retry certain errors
      if (error.code === 'PERMISSION_DENIED' || error.code === 'INVALID_ARGUMENT') {
        throw error;
      }

      if (attempt === MAX_RETRIES) {
        break;
      }

      // Exponential backoff
      const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Validate data dependencies before executing scheduled tasks
 */
async function validateDataDependencies(): Promise<{ isValid: boolean; missingCollections: string[] }> {
  const requiredCollections = [
    'users',
    'workOrders',
    'appointments',
    'costMonitoring'
  ];

  const missingCollections: string[] = [];

  try {
    for (const collection of requiredCollections) {
      const snapshot = await db.collection(collection).limit(1).get();
      // Just check if we can query the collection
      if (snapshot.empty && collection !== 'costMonitoring') {
        // costMonitoring might be empty initially, that's ok
        missingCollections.push(collection);
      }
    }
  } catch (error) {
    logger.error('Error validating data dependencies:', error);
    return { isValid: false, missingCollections: requiredCollections };
  }

  return { isValid: missingCollections.length === 0, missingCollections };
}

// Firebase pricing constants (keep in sync with client-side service)
const FIREBASE_PRICING = {
  firestore: {
    reads: 0.00000006, // per document read ($0.06 per 1M reads)
    writes: 0.00000018, // per document write ($0.18 per 1M writes)
    deletes: 0.000000002, // per document delete ($0.02 per 1M deletes)
  },
  storage: {
    storage: 0.00000002685546875, // per GB per month ($0.026 per GB)
    operations: {
      upload: 0.000000005, // per operation ($0.005 per 1K operations)
      download: 0.00000000012, // per GB downloaded ($0.12 per GB)
      delete: 0.0000000005, // per operation ($0.0005 per operation)
    }
  },
  functions: {
    invocations: 0.0000004, // per invocation ($0.40 per 1M invocations)
    gbSeconds: 0.0000025, // per GB-second ($0.0000025)
    cpuTime: 0.00001, // per GHz-second ($0.01 per 1000 GHz-seconds)
  },
  hosting: {
    storage: 0.00000002685546875, // per GB per month ($0.026 per GB)
    transfer: 0.00000000015, // per GB transferred ($0.15 per GB)
  }
};

// Initialize Firebase Admin (should be done in index.ts, but ensuring here)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Cost alert thresholds (configurable)
const COST_THRESHOLDS = {
  total: 10, // $10 per period
  firestore: 5, // $5 for Firestore
  functions: 2, // $2 for Functions
  storage: 1 // $1 for Storage
};

// Interface for monthly metrics
interface MonthlyMetrics {
  month: string;
  totalWorkOrders: number;
  completionRate: number;
  totalRevenue: number;
  [key: string]: any; // Allow additional properties
}


/**
 * Calculate workshop capacity
 * Runs every 4 hours to update current workshop capacity metrics
 */
export const calculateCapacityHourly = onSchedule(
  {
    schedule: '0 */4 * * *', // Every 4 hours at minute 0
    timeZone: 'America/Bogota'
  },
  async (event) => {
   try {
     logger.info('Starting calculateCapacityHourly function');

     // Validate data dependencies
     const validation = await validateDataDependencies();
     if (!validation.isValid) {
       logger.warn('Data dependencies validation failed:', validation.missingCollections);
       // Continue anyway, as some collections might be optional
     }

     // Use WorkshopCapacityService to calculate current capacity with retry
     const capacityData = await retryDatabaseOperation(
       () => WorkshopCapacityService.calculateCurrentCapacity(),
       'WorkshopCapacityService.calculateCurrentCapacity'
     );

     const now = new Date();
     const capacityRecord = {
       ...capacityData,
       timestamp: admin.firestore.FieldValue.serverTimestamp()
     };

     // Store in Firestore with retry
     await retryDatabaseOperation(
       () => db.collection('workshopCapacity').doc(`hourly_${now.toISOString().split('T')[0]}_${now.getHours()}`).set(capacityRecord),
       'Store workshop capacity record'
     );

     logger.info('calculateCapacityHourly completed successfully', capacityRecord);
   } catch (error) {
     logger.error('Error in calculateCapacityHourly:', error);
     throw error;
   }
});

/**
 * Optimize daily schedule
 * Runs daily at 6 AM to optimize appointments and work order assignments
 */
export const optimizeDailySchedule = onSchedule(
  {
    schedule: '0 6 * * *', // Daily at 6 AM
    timeZone: 'America/Bogota'
  },
  async (event) => {
     try {
       logger.info('Starting optimizeDailySchedule function');

       // Validate data dependencies
       const validation = await validateDataDependencies();
       if (!validation.isValid) {
         logger.warn('Data dependencies validation failed:', validation.missingCollections);
         // Continue anyway, as some collections might be optional
       }

       // Use SmartAssignmentService to optimize daily schedule with retry
       const optimizationResult = await retryDatabaseOperation(
         () => SmartAssignmentService.optimizeDailySchedule(),
         'SmartAssignmentService.optimizeDailySchedule'
       );

       const today = new Date();
       today.setHours(0, 0, 0, 0);

       const result = {
         ...optimizationResult,
         date: today.toISOString().split('T')[0],
         timestamp: admin.firestore.FieldValue.serverTimestamp()
       };

       // Store optimization results with retry
       await retryDatabaseOperation(
         () => db.collection('scheduleOptimizations').add(result),
         'Store schedule optimization results'
       );

       logger.info('optimizeDailySchedule completed successfully', result);
     } catch (error) {
       logger.error('Error in optimizeDailySchedule:', error);
       throw error;
     }
   });

/**
 * Check for delayed jobs
 * Runs every hour to identify and notify about delayed work orders
 */
export const checkDelayedJobs = onSchedule(
  {
    schedule: '0 * * * *', // Every hour
    timeZone: 'America/Bogota'
  },
  async (event) => {
     try {
       logger.info('Starting checkDelayedJobs function');

       // Validate data dependencies
       const validation = await validateDataDependencies();
       if (!validation.isValid) {
         logger.warn('Data dependencies validation failed:', validation.missingCollections);
         // Continue anyway, as some collections might be optional
       }

       // Use TimeCoordinationService to notify delayed jobs with retry
       const delayedJobsCount = await retryDatabaseOperation(
         () => TimeCoordinationService.notifyDelayedJobs(),
         'TimeCoordinationService.notifyDelayedJobs'
       );

       // Store delayed jobs summary with retry
       if (delayedJobsCount > 0) {
         await retryDatabaseOperation(
           () => db.collection('delayedJobsChecks').add({
             timestamp: admin.firestore.FieldValue.serverTimestamp(),
             delayedJobsCount,
             checkedAt: admin.firestore.FieldValue.serverTimestamp()
           }),
           'Store delayed jobs summary'
         );
       }

       logger.info('checkDelayedJobs completed successfully', { delayedJobsCount });
     } catch (error) {
       logger.error('Error in checkDelayedJobs:', error);
       throw error;
     }
   });

/**
 * Calculate monthly metrics
 * Runs on the 1st of each month to calculate comprehensive monthly performance metrics
 */
export const calculateMonthlyMetrics = onSchedule(
  {
    schedule: '0 0 1 * *', // Monthly on the 1st at midnight
    timeZone: 'America/Bogota'
  },
  async (event) => {
     try {
       logger.info('Starting calculateMonthlyMetrics function');

       // Validate data dependencies
       const validation = await validateDataDependencies();
       if (!validation.isValid) {
         logger.warn('Data dependencies validation failed:', validation.missingCollections);
         // Continue anyway, as some collections might be optional
       }

       // Use TechnicianMetricsService to calculate monthly metrics with retry
       const monthlyMetrics = await retryDatabaseOperation(
         () => TechnicianMetricsService.calculateMonthlyMetrics(),
         'TechnicianMetricsService.calculateMonthlyMetrics'
       ) as MonthlyMetrics;

       const currentMonth = new Date();
       currentMonth.setDate(1);

       // Store monthly metrics with retry
       await retryDatabaseOperation(
         () => db.collection('monthlyMetrics').doc(monthlyMetrics.month).set(monthlyMetrics),
         'Store monthly metrics'
       );

       logger.info('calculateMonthlyMetrics completed successfully', {
         month: monthlyMetrics.month,
         totalWorkOrders: monthlyMetrics.totalWorkOrders,
         completionRate: monthlyMetrics.completionRate,
         totalRevenue: monthlyMetrics.totalRevenue
       });
     } catch (error) {
       logger.error('Error in calculateMonthlyMetrics:', error);
       throw error;
     }
   });

/**
 * Monitor Firebase costs and usage
 * Runs hourly to track usage and check for cost alerts
 */
export const monitorFirebaseCosts = onSchedule(
  {
    schedule: '0 * * * *', // Every hour
    timeZone: 'America/Bogota'
  },
  async (event) => {
     try {
       logger.info('Starting monitorFirebaseCosts function');

       // Validate data dependencies (costMonitoring might not exist initially)
       const validation = await validateDataDependencies();
       if (!validation.isValid && !validation.missingCollections.includes('costMonitoring')) {
         logger.warn('Data dependencies validation failed:', validation.missingCollections);
       }

       // Get current usage data from costMonitoring collection with retry
       const now = new Date();
       const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

       const usageSnapshot = await retryDatabaseOperation(
         () => db.collection('costMonitoring')
           .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(oneHourAgo))
           .orderBy('timestamp', 'desc')
           .limit(1)
           .get(),
         'Query cost monitoring data'
       );

       let currentUsage = {
         firestore: { reads: 0, writes: 0, deletes: 0 },
         storage: { uploads: 0, downloads: 0, deletes: 0, storageGB: 0 },
         functions: { invocations: 0, gbSeconds: 0, cpuSeconds: 0 },
         hosting: { storageGB: 0, transferGB: 0 }
       };

       if (!usageSnapshot.empty) {
         const latestRecord = usageSnapshot.docs[0].data();
         currentUsage = latestRecord.usage;
       }

       // Calculate costs
       const costs = calculateCosts(currentUsage);
       const alerts = checkCostAlerts(costs);

       // Save hourly usage record with retry
       const hourlyRecord = {
         timestamp: admin.firestore.FieldValue.serverTimestamp(),
         period: 'hourly',
         usage: currentUsage,
         costs,
         alertsTriggered: alerts
       };

       await retryDatabaseOperation(
         () => db.collection('costMonitoring').add(hourlyRecord),
         'Store hourly cost monitoring record'
       );

       // If there are alerts, create notifications for admins with retry
       if (alerts.length > 0) {
         await retryDatabaseOperation(
           () => createCostAlertNotifications(alerts, costs),
           'Create cost alert notifications'
         );
       }

       logger.info('monitorFirebaseCosts completed successfully', { costs, alerts });
     } catch (error) {
       logger.error('Error in monitorFirebaseCosts:', error);
       throw error;
     }
   });

/**
 * Generate daily cost report
 * Runs daily at 6 AM to create daily cost summaries
 */
export const generateDailyCostReport = onSchedule(
  {
    schedule: '0 6 * * *', // Daily at 6 AM
    timeZone: 'America/Bogota'
  },
  async (event) => {
     try {
       logger.info('Starting generateDailyCostReport function');

       // Validate data dependencies (costMonitoring might not exist initially)
       const validation = await validateDataDependencies();
       if (!validation.isValid && !validation.missingCollections.includes('costMonitoring')) {
         logger.warn('Data dependencies validation failed:', validation.missingCollections);
       }

       const yesterday = new Date();
       yesterday.setDate(yesterday.getDate() - 1);
       yesterday.setHours(0, 0, 0, 0);
       const today = new Date(yesterday);
       today.setDate(today.getDate() + 1);

       // Get all hourly records for yesterday with retry
       const dailyUsageSnapshot = await retryDatabaseOperation(
         () => db.collection('costMonitoring')
           .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(yesterday))
           .where('timestamp', '<', admin.firestore.Timestamp.fromDate(today))
           .where('period', '==', 'hourly')
           .get(),
         'Query daily cost monitoring records'
       );

       if (dailyUsageSnapshot.empty) {
         logger.info('No hourly usage records found for yesterday');
         return;
       }

       // Aggregate daily usage
       const aggregatedUsage = {
         firestore: { reads: 0, writes: 0, deletes: 0 },
         storage: { uploads: 0, downloads: 0, deletes: 0, storageGB: 0 },
         functions: { invocations: 0, gbSeconds: 0, cpuSeconds: 0 },
         hosting: { storageGB: 0, transferGB: 0 }
       };

       let totalAlerts = 0;

       dailyUsageSnapshot.docs.forEach(doc => {
         const record = doc.data();
         aggregatedUsage.firestore.reads += record.usage.firestore.reads || 0;
         aggregatedUsage.firestore.writes += record.usage.firestore.writes || 0;
         aggregatedUsage.firestore.deletes += record.usage.firestore.deletes || 0;

         aggregatedUsage.storage.uploads += record.usage.storage.uploads || 0;
         aggregatedUsage.storage.downloads += record.usage.storage.downloads || 0;
         aggregatedUsage.storage.deletes += record.usage.storage.deletes || 0;
         aggregatedUsage.storage.storageGB += record.usage.storage.storageGB || 0;

         aggregatedUsage.functions.invocations += record.usage.functions.invocations || 0;
         aggregatedUsage.functions.gbSeconds += record.usage.functions.gbSeconds || 0;
         aggregatedUsage.functions.cpuSeconds += record.usage.functions.cpuSeconds || 0;

         aggregatedUsage.hosting.storageGB += record.usage.hosting.storageGB || 0;
         aggregatedUsage.hosting.transferGB += record.usage.hosting.transferGB || 0;

         totalAlerts += record.alertsTriggered?.length || 0;
       });

       // Calculate daily costs
       const dailyCosts = calculateCosts(aggregatedUsage);
       const dailyAlerts = checkCostAlerts(dailyCosts);

       // Save daily record with retry
       const dailyRecord = {
         timestamp: admin.firestore.FieldValue.serverTimestamp(),
         period: 'daily',
         date: yesterday.toISOString().split('T')[0],
         usage: aggregatedUsage,
         costs: dailyCosts,
         alertsTriggered: dailyAlerts,
         totalAlerts
       };

       await retryDatabaseOperation(
         () => db.collection('costMonitoring').add(dailyRecord),
         'Store daily cost monitoring record'
       );

       // Create daily report notification for admins with retry
       await retryDatabaseOperation(
         () => createDailyCostReportNotification(dailyCosts, totalAlerts),
         'Create daily cost report notification'
       );

       logger.info('generateDailyCostReport completed successfully', { dailyCosts, totalAlerts });
     } catch (error) {
       logger.error('Error in generateDailyCostReport:', error);
       throw error;
     }
   });

// Helper functions
function calculateCosts(usage: any) {
  const firestore = (
    usage.firestore.reads * FIREBASE_PRICING.firestore.reads +
    usage.firestore.writes * FIREBASE_PRICING.firestore.writes +
    usage.firestore.deletes * FIREBASE_PRICING.firestore.deletes
  );

  const storage = (
    usage.storage.storageGB * FIREBASE_PRICING.storage.storage +
    usage.storage.uploads * FIREBASE_PRICING.storage.operations.upload +
    usage.storage.downloads * FIREBASE_PRICING.storage.operations.download +
    usage.storage.deletes * FIREBASE_PRICING.storage.operations.delete
  );

  const functions = (
    usage.functions.invocations * FIREBASE_PRICING.functions.invocations +
    usage.functions.gbSeconds * FIREBASE_PRICING.functions.gbSeconds +
    usage.functions.cpuSeconds * FIREBASE_PRICING.functions.cpuTime
  );

  const hosting = (
    usage.hosting.storageGB * FIREBASE_PRICING.hosting.storage +
    usage.hosting.transferGB * FIREBASE_PRICING.hosting.transfer
  );

  const total = firestore + storage + functions + hosting;

  return { firestore, storage, functions, hosting, total };
}

function checkCostAlerts(costs: any): string[] {
  const alerts: string[] = [];

  if (costs.total > COST_THRESHOLDS.total) {
    alerts.push(`High total costs: $${costs.total.toFixed(2)}`);
  }

  if (costs.firestore > COST_THRESHOLDS.firestore) {
    alerts.push(`High Firestore costs: $${costs.firestore.toFixed(2)}`);
  }

  if (costs.functions > COST_THRESHOLDS.functions) {
    alerts.push(`High Functions costs: $${costs.functions.toFixed(2)}`);
  }

  if (costs.storage > COST_THRESHOLDS.storage) {
    alerts.push(`High Storage costs: $${costs.storage.toFixed(2)}`);
  }

  return alerts;
}

async function createCostAlertNotifications(alerts: string[], costs: any) {
  // Get admin users
  const adminsSnapshot = await db.collection('users')
    .where('role', '==', 'admin')
    .get();

  const notifications = alerts.map(alert => ({
    type: 'system_alert',
    title: 'Alerta de Costos de Firebase',
    message: alert,
    priority: 'high',
    targetAudience: 'admins',
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    additionalMeta: {
      costBreakdown: costs,
      alertType: 'firebase_cost'
    }
  }));

  // Create notifications for each admin
  for (const adminDoc of adminsSnapshot.docs) {
    for (const notification of notifications) {
      await db.collection('notifications').add({
        ...notification,
        userId: adminDoc.id
      });
    }
  }
}

async function createDailyCostReportNotification(dailyCosts: any, totalAlerts: number) {
  // Get admin users
  const adminsSnapshot = await db.collection('users')
    .where('role', '==', 'admin')
    .get();

  const reportMessage = `Reporte diario de costos: Total $${dailyCosts.total.toFixed(2)}, ${totalAlerts} alertas`;

  // Create notification for each admin
  for (const adminDoc of adminsSnapshot.docs) {
    await db.collection('notifications').add({
      type: 'system_report',
      title: 'Reporte Diario de Costos',
      message: reportMessage,
      userId: adminDoc.id,
      priority: 'medium',
      targetAudience: 'admins',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      additionalMeta: {
        costBreakdown: dailyCosts,
        reportType: 'daily_cost',
        totalAlerts
      }
    });
  }
}