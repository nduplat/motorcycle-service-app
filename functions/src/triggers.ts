import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (should be done in index.ts, but ensuring here)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Trigger when work order status changes
 * Sends simple notification to customer
 */
export const onWorkOrderUpdate = functions.firestore
  .document('workOrders/{orderId}')
  .onUpdate(async (change: any, context: any) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only notify if status changed
    if (before.status !== after.status) {
      const customerId = after.customerId;

      if (customerId) {
        const userDoc = await admin.firestore().collection('users').doc(customerId).get();
        const fcmToken = userDoc.data()?.fcmToken;

        if (fcmToken) {
          await admin.messaging().send({
            token: fcmToken,
            notification: {
              title: 'Actualización de Orden',
              body: `Tu orden cambió a: ${after.status}`
            },
            data: {
              orderId: context.params.orderId,
              status: after.status
            }
          });
        }
      }
    }
  });



/**
 * Trigger when user is created
 * Sets up basic user profile
 */
export const onUserCreated = functions.auth.user().onCreate(async (user: any) => {
  await admin.firestore().collection('users').doc(user.uid).set({
    email: user.email,
    role: 'customer', // Default role
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    displayName: user.displayName || '',
    phoneNumber: user.phoneNumber || ''
  }, { merge: true });
});

/**
 * Cleanup old data to control costs
 */
export const cleanupOldData = functions.pubsub
  .schedule('0 2 * * 0') // Sundays 2am
  .timeZone('America/Bogota')
  .onRun(async (context: any) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Delete old notifications
    const oldNotifications = await admin.firestore()
      .collection('notifications')
      .where('createdAt', '<', sixMonthsAgo)
      .limit(500)
      .get();

    const batch = admin.firestore().batch();
    oldNotifications.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log(`Deleted ${oldNotifications.size} old notifications`);
  });
