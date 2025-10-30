import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

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

