/**
 * Comprehensive Health Check Cloud Function for Blue Dragon Motors
 * ================================================================
 *
 * This Cloud Function provides detailed health checks for all backend services,
 * including Firestore, Firebase Auth, Storage, and scheduled functions.
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { StructuredLogger, MetricsCollector } from './services';

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  errorMessage?: string;
  details?: any;
}

interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: HealthCheckResult[];
  overall: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
  };
}

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:4200').split(',').map((s: string) => s.trim());

function setCorsHeaders(req: any, res: any) {
  const origin = req.headers.origin;
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin || allowedOrigins[0]);
  }
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Check Firestore connectivity and basic operations
 */
async function checkFirestoreHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Test basic read operation
    await db.collection('healthCheck').doc('test').get();
    const responseTime = Date.now() - startTime;

    // Test write operation (will be cleaned up by TTL or manually)
    await db.collection('healthCheck').doc('test').set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      test: true
    });

    return {
      service: 'firestore',
      status: 'healthy',
      responseTime,
      details: {
        canRead: true,
        canWrite: true,
        collections: ['healthCheck']
      }
    };
  } catch (error: any) {
    return {
      service: 'firestore',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      errorMessage: error.message,
      details: { error: error.code || 'UNKNOWN_ERROR' }
    };
  }
}

/**
 * Check Firebase Auth service
 */
async function checkAuthHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Test listing users (limited to 1 to avoid performance issues)
    const listResult = await auth.listUsers(1);
    const responseTime = Date.now() - startTime;

    return {
      service: 'firebase-auth',
      status: 'healthy',
      responseTime,
      details: {
        canListUsers: true,
        userCount: listResult.users.length
      }
    };
  } catch (error: any) {
    return {
      service: 'firebase-auth',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      errorMessage: error.message,
      details: { error: error.code || 'UNKNOWN_ERROR' }
    };
  }
}

/**
 * Check Firebase Storage service
 */
async function checkStorageHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Test listing buckets/files (limited scope)
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({ maxResults: 1 });
    const responseTime = Date.now() - startTime;

    return {
      service: 'firebase-storage',
      status: 'healthy',
      responseTime,
      details: {
        canListFiles: true,
        bucketName: bucket.name,
        fileCount: files.length
      }
    };
  } catch (error: any) {
    return {
      service: 'firebase-storage',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      errorMessage: error.message,
      details: { error: error.code || 'UNKNOWN_ERROR' }
    };
  }
}

/**
 * Check scheduled functions status by querying recent metrics
 */
async function checkScheduledFunctionsHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Check if scheduled functions have run recently (within last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const metricsSnapshot = await db.collection('functionMetrics')
      .where('timestamp', '>', admin.firestore.Timestamp.fromDate(yesterday))
      .limit(10)
      .get();

    const recentMetrics = metricsSnapshot.docs.map(doc => doc.data());
    const responseTime = Date.now() - startTime;

    // Check for critical scheduled functions
    const expectedFunctions = ['calculateCapacityHourly', 'optimizeDailySchedule', 'calculateMonthlyMetrics'];
    const activeFunctions = recentMetrics.flatMap(m => Object.keys(m).filter(k => k !== 'timestamp'));

    const missingFunctions = expectedFunctions.filter(fn =>
      !activeFunctions.some(activeFn => activeFn.includes(fn))
    );

    const status = missingFunctions.length === 0 ? 'healthy' : 'degraded';

    return {
      service: 'scheduled-functions',
      status,
      responseTime,
      details: {
        recentMetricsCount: recentMetrics.length,
        activeFunctions: [...new Set(activeFunctions)],
        missingFunctions,
        lastActivity: recentMetrics.length > 0 ?
          Math.max(...recentMetrics.map(m => m.timestamp?.toMillis?.() || 0)) : null
      }
    };
  } catch (error: any) {
    return {
      service: 'scheduled-functions',
      status: 'degraded',
      responseTime: Date.now() - startTime,
      errorMessage: error.message,
      details: { error: error.code || 'UNKNOWN_ERROR' }
    };
  }
}

/**
 * Check system resources and performance
 */
async function checkSystemHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Get current metrics
    const metrics = MetricsCollector.getMetrics();
    const responseTime = Date.now() - startTime;

    // Analyze metrics for health indicators
    const totalOperations = Object.values(metrics).reduce((sum, m) => sum + m.count, 0);
    const totalErrors = Object.values(metrics).reduce((sum, m) => sum + m.errors, 0);
    const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;

    // Determine status based on error rate
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorRate > 10) status = 'unhealthy';
    else if (errorRate > 5) status = 'degraded';

    return {
      service: 'system-metrics',
      status,
      responseTime,
      details: {
        totalOperations,
        totalErrors,
        errorRate: Math.round(errorRate * 100) / 100,
        metricsCount: Object.keys(metrics).length,
        uptime: process.uptime()
      }
    };
  } catch (error: any) {
    return {
      service: 'system-metrics',
      status: 'degraded',
      responseTime: Date.now() - startTime,
      errorMessage: error.message
    };
  }
}

/**
 * Main health check endpoint
 */
export const systemHealth = onRequest(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET.' });
    return;
  }

  const startTime = Date.now();

  try {
    StructuredLogger.info('Health check initiated');

    // Run all health checks in parallel
    const healthChecks = await Promise.all([
      checkFirestoreHealth(),
      checkAuthHealth(),
      checkStorageHealth(),
      checkScheduledFunctionsHealth(),
      checkSystemHealth()
    ]);

    // Calculate overall status
    const healthyServices = healthChecks.filter(h => h.status === 'healthy').length;
    const degradedServices = healthChecks.filter(h => h.status === 'degraded').length;
    const unhealthyServices = healthChecks.filter(h => h.status === 'unhealthy').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyServices > 0) overallStatus = 'unhealthy';
    else if (degradedServices > 0) overallStatus = 'degraded';

    const response: SystemHealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: healthChecks,
      overall: {
        totalServices: healthChecks.length,
        healthyServices,
        degradedServices,
        unhealthyServices
      }
    };

    const totalResponseTime = Date.now() - startTime;
    StructuredLogger.info('Health check completed', {
      status: overallStatus,
      totalResponseTime,
      healthyServices,
      degradedServices,
      unhealthyServices
    });

    // Set HTTP status code based on overall health
    const httpStatus = overallStatus === 'healthy' ? 200 :
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(httpStatus).json(response);

  } catch (error: any) {
    StructuredLogger.error('Health check failed', error);

    const errorResponse: SystemHealthResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: [],
      overall: {
        totalServices: 0,
        healthyServices: 0,
        degradedServices: 0,
        unhealthyServices: 1
      }
    };

    res.status(503).json(errorResponse);
  }
});

/**
 * Detailed metrics endpoint for monitoring systems
 */
export const systemMetrics = onRequest(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET.' });
    return;
  }

  try {
    const metrics = MetricsCollector.getMetrics();

    // Get recent function metrics from Firestore
    const recentMetricsSnapshot = await db.collection('functionMetrics')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const recentMetrics = recentMetricsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      timestamp: new Date().toISOString(),
      currentMetrics: metrics,
      recentMetrics,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      version: process.version
    });

  } catch (error: any) {
    StructuredLogger.error('Metrics endpoint failed', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error.message
    });
  }
});