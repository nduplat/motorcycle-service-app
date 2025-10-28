import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (should be done in index.ts, but ensuring here)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Simple health check endpoint
 */
export const healthCheck = functions.https.onRequest(async (req: any, res: any) => {
  try {
    // Test Firestore connectivity
    await admin.firestore().collection('_health').doc('check').get();

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        firestore: 'ok',
        auth: 'ok'
      }
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});