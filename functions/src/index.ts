import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';

const corsHandler = cors({ origin: true });

// Inicializar Firebase Admin
admin.initializeApp();

// ========================================
// HEALTH CHECK
// ========================================
export const healthCheck = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
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
});

// ========================================
// AUTH TRIGGERS
// ========================================
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  try {
    await admin.firestore().collection('users').doc(user.uid).set({
      email: user.email,
      role: 'customer', // Por defecto
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      displayName: user.displayName || '',
      phoneNumber: user.phoneNumber || '',
      photoURL: user.photoURL || ''
    }, { merge: true });

    console.log(`User created: ${user.uid}`);
  } catch (error) {
    console.error('Error creating user document:', error);
  }
});

// ========================================
// FIRESTORE TRIGGERS
// ========================================
export const onWorkOrderUpdate = functions.firestore
  .document('workOrders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // GUARD: Only proceed if status actually changed to prevent loops
    if (before.status === after.status) {
      console.log(`Work order ${context.params.orderId} status unchanged (${after.status}), skipping notification`);
      return;
    }

    // GUARD: Only notify for meaningful status changes, not internal updates
    const meaningfulStatuses = ['pending', 'in_progress', 'completed', 'cancelled', 'on_hold'];
    if (!meaningfulStatuses.includes(after.status)) {
      console.log(`Work order ${context.params.orderId} status ${after.status} not meaningful for notification, skipping`);
      return;
    }

    const customerId = after.customerId;

    if (customerId) {
      try {
        const userDoc = await admin.firestore().collection('users').doc(customerId).get();
        const fcmToken = userDoc.data()?.fcmToken;

        if (fcmToken) {
          await admin.messaging().send({
            token: fcmToken,
            notification: {
              title: 'Actualización de Orden',
              body: `Tu orden cambió a: ${getStatusText(after.status)}`
            },
            data: {
              orderId: context.params.orderId,
              status: after.status,
              type: 'work_order_update'
            }
          });

          console.log(`Notification sent to ${customerId} for order ${context.params.orderId} status change: ${before.status} -> ${after.status}`);
        } else {
          console.log(`No FCM token for customer ${customerId}, skipping notification`);
        }
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    } else {
      console.log(`No customerId for work order ${context.params.orderId}, skipping notification`);
    }
  });

// ========================================
// CALLABLE FUNCTIONS
// ========================================
export const createWorkOrder = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { customerId, vehicleId, services, priority, notes } = data;

  // Validación básica
  if (!customerId || !services || services.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos');
  }

  try {
    // Crear work order
    const workOrderRef = admin.firestore().collection('workOrders').doc();

    await workOrderRef.set({
      customerId,
      vehicleId: vehicleId || null,
      services,
      priority: priority || 'medium',
      status: 'pending',
      notes: notes || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth.uid,
      assignedTo: null, // Asignación manual
      estimatedCompletionTime: null,
      totalCost: 0
    });

    console.log(`Work order created: ${workOrderRef.id}`);
    return { id: workOrderRef.id, success: true };
  } catch (error: any) {
    console.error('Error creating work order:', error);
    throw new functions.https.HttpsError('internal', `Error al crear orden: ${error.message}`);
  }
});

export const updateWorkOrderStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { orderId, newStatus, notes } = data;

  if (!orderId || !newStatus) {
    throw new functions.https.HttpsError('invalid-argument', 'orderId y newStatus son requeridos');
  }

  // GUARD: Validate status transitions to prevent invalid states
  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled', 'on_hold', 'waiting_parts'];
  if (!validStatuses.includes(newStatus)) {
    throw new functions.https.HttpsError('invalid-argument', `Status inválido: ${newStatus}`);
  }

  try {
    // Verificar que usuario es técnico o admin
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const userRole = userDoc.data()?.role;

    if (!['admin', 'technician'].includes(userRole)) {
      throw new functions.https.HttpsError('permission-denied', 'Solo técnicos y administradores pueden actualizar órdenes');
    }

    // GUARD: Check current work order exists and get current status
    const workOrderRef = admin.firestore().collection('workOrders').doc(orderId);
    const workOrderDoc = await workOrderRef.get();

    if (!workOrderDoc.exists) {
      throw new functions.https.HttpsError('not-found', `Work order ${orderId} no existe`);
    }

    const currentData = workOrderDoc.data();
    const currentStatus = currentData?.status;

    // GUARD: Prevent unnecessary updates that could trigger loops
    if (currentStatus === newStatus) {
      console.log(`Work order ${orderId} already has status ${newStatus}, skipping update`);
      return { success: true, message: 'Status already set' };
    }

    // Actualizar con campos adicionales para tracking
    const updateData: any = {
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: context.auth.uid,
      lastStatusChange: admin.firestore.FieldValue.serverTimestamp(),
      previousStatus: currentStatus
    };

    if (notes) {
      updateData.notes = notes;
    }

    // Add completion timestamp if moving to completed
    if (newStatus === 'completed' && currentStatus !== 'completed') {
      updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await workOrderRef.update(updateData);

    console.log(`Work order ${orderId} updated from ${currentStatus} to ${newStatus} by ${context.auth.uid}`);
    return { success: true, previousStatus: currentStatus, newStatus };
  } catch (error: any) {
    console.error('Error updating work order:', error);
    throw new functions.https.HttpsError('internal', `Error al actualizar orden: ${error.message}`);
  }
});

export const sendNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { userId, title, body, data: customData } = data;

  if (!userId || !title || !body) {
    throw new functions.https.HttpsError('invalid-argument', 'userId, title y body son requeridos');
  }

  try {
    // Verificar permisos (solo admin/technician pueden enviar notificaciones)
    const senderDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const senderRole = senderDoc.data()?.role;

    if (!['admin', 'technician'].includes(senderRole)) {
      throw new functions.https.HttpsError('permission-denied', 'Permisos insuficientes');
    }

    // Obtener FCM token
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const fcmToken = userDoc.data()?.fcmToken;

    if (!fcmToken) {
      throw new functions.https.HttpsError('failed-precondition', 'Usuario sin token FCM');
    }

    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: customData || {}
    });

    console.log(`Notification sent to ${userId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error sending notification:', error);
    throw new functions.https.HttpsError('internal', `Error al enviar notificación: ${error.message}`);
  }
});

export const getProducts = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  try {
    const snapshot = await admin.firestore().collection('products').get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { products };
  } catch (error: any) {
    console.error('Error getting products:', error);
    throw new functions.https.HttpsError('internal', `Error al obtener productos: ${error.message}`);
  }
});

// ========================================
// SCHEDULED TASKS
// ========================================
export const scheduledBackup = functions.pubsub
  .schedule('0 3 * * *') // 3am diario
  .timeZone('America/Bogota')
  .onRun(async (context) => {
    const db = admin.firestore();
    const storage = admin.storage().bucket();

    try {
      // Backup solo de colecciones críticas
      const collections = ['workOrders', 'users', 'products', 'queue'];
      const backupData: any = {};

      for (const collectionName of collections) {
        const snapshot = await db.collection(collectionName).limit(1000).get();
        backupData[collectionName] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }

      // Guardar en Storage
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `backups/backup-${timestamp}.json`;

      await storage.file(fileName).save(JSON.stringify(backupData), {
        contentType: 'application/json',
        metadata: {
          timestamp: timestamp
        }
      });

      console.log(`Backup created: ${fileName}`);

      // Eliminar backups > 30 días
      const [files] = await storage.getFiles({ prefix: 'backups/' });
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const file of files) {
        const [metadata] = await file.getMetadata();
        if (metadata.timeCreated && new Date(metadata.timeCreated) < thirtyDaysAgo) {
          await file.delete();
          console.log(`Deleted old backup: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Backup error:', error);
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

// ========================================
// HELPER FUNCTIONS
// ========================================
function getStatusText(status: string): string {
  const statusMap: { [key: string]: string } = {
    'pending': 'Pendiente',
    'in_progress': 'En Progreso',
    'completed': 'Completada',
    'cancelled': 'Cancelada',
    'on_hold': 'En Espera'
  };
  return statusMap[status] || status;
}