import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Create work order (with validation)
 */
export const createWorkOrder = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { customerId, vehicleId, services, priority } = data;

  // Validation
  if (!customerId || !services || services.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos');
  }

  // Create work order
  const workOrderRef = db.collection('workOrders').add({
    customerId,
    vehicleId,
    status: 'pending',
    services,
    priority: priority || 'medium',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: context.auth.uid,
    assignedTo: null
  });

  return { id: (await workOrderRef).id };
});

/**
 * Update work order status (with permissions)
 */
export const updateWorkOrderStatus = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { orderId, newStatus } = data;

  // Check permissions
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const userRole = userDoc.data()?.role;

  if (!['admin', 'technician'].includes(userRole)) {
    throw new functions.https.HttpsError('permission-denied', 'Permisos insuficientes');
  }

  // Update status
  await db.collection('workOrders').doc(orderId).update({
    status: newStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: context.auth.uid
  });

  return { success: true };
});

/**
 * Send simple notification
 */
export const sendNotification = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { userId, title, body } = data;

  // Get FCM token
  const userDoc = await db.collection('users').doc(userId).get();
  const fcmToken = userDoc.data()?.fcmToken;

  if (!fcmToken) {
    throw new functions.https.HttpsError('failed-precondition', 'Usuario sin token FCM');
  }

  await admin.messaging().send({
    token: fcmToken,
    notification: { title, body }
  });

  return { success: true };
});