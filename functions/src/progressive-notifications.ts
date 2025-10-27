import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { StructuredLogger, MetricsCollector } from './services';

// Initialize Firebase Admin (should be done in index.ts, but ensuring here)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Type definitions for Firestore data
interface FirestoreQueueEntry {
  id: string;
  customerId: string;
  serviceType: string;
  status: string;
  position: number;
  joinedAt: admin.firestore.Timestamp;
  estimatedWaitTime?: number;
  assignedTo?: string;
  workOrderId?: string;
  notes?: string;
  qrCodeDataUrl?: string;
  verificationCode?: string;
  expiresAt?: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  motorcycleId?: string;
  plate: string;
  mileageKm: number;
}

interface FirestoreUser {
  id: string;
  email: string;
  displayName: string;
  name: string;
  role: string;
  phone?: string;
  technicianProfile?: {
    technicianId: string;
    skills?: string[];
    hourlyRate?: number;
    certifications?: string[];
    employmentStartAt?: admin.firestore.Timestamp;
  };
  availability?: {
    isAvailable: boolean;
    lastUpdated: admin.firestore.Timestamp;
    reason?: string;
  };
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

interface FirestoreNotificationPreferences {
  id: string;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  queueNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

// Notification message templates
const NOTIFICATION_TEMPLATES = {
  POSITION_2: {
    title: 'FALTAN 2 CLIENTES',
    message: 'Su turno está próximo. Prepárese para ser atendido.',
    sms: 'Blue Dragon Motors: FALTAN 2 CLIENTES. Su turno está próximo. Prepárese para ser atendido.'
  },
  POSITION_1: {
    title: 'ERES EL SIGUIENTE',
    message: 'Es su turno. Por favor diríjase al mostrador.',
    sms: 'Blue Dragon Motors: ERES EL SIGUIENTE. Por favor diríjase al mostrador.'
  },
  CALLED: {
    title: 'TE ESTAMOS LLAMANDO',
    message: 'Su servicio ha sido llamado. Por favor acérquese.',
    sms: 'Blue Dragon Motors: TE ESTAMOS LLAMANDO. Su servicio ha sido llamado. Por favor acérquese.'
  },
  IN_SERVICE: {
    title: 'SERVICIO INICIADO',
    message: 'Su servicio ha comenzado. Gracias por su paciencia.',
    sms: 'Blue Dragon Motors: SERVICIO INICIADO. Su servicio ha comenzado. Gracias por su paciencia.'
  },
  COMPLETED: {
    title: 'SERVICIO COMPLETADO',
    message: 'Su servicio ha sido completado. Puede recoger su vehículo.',
    sms: 'Blue Dragon Motors: SERVICIO COMPLETADO. Su servicio ha sido completado. Puede recoger su vehículo.'
  }
};

/**
 * Check if user has enabled queue notifications
 */
async function shouldSendNotification(userId: string, type: 'sms' | 'push' | 'in_app'): Promise<boolean> {
  try {
    const preferencesDoc = await db.collection('notificationPreferences').doc(userId).get();
    if (!preferencesDoc.exists) {
      // Default to enabled if no preferences set
      return true;
    }

    const preferences = preferencesDoc.data() as FirestoreNotificationPreferences;

    // Check quiet hours
    if (preferences.quietHours?.enabled) {
      const now = new Date();
      const currentTime = now.getHours() * 100 + now.getMinutes();
      const startTime = parseInt(preferences.quietHours.start.replace(':', ''));
      const endTime = parseInt(preferences.quietHours.end.replace(':', ''));

      if (startTime < endTime) {
        // Same day quiet hours
        if (currentTime >= startTime && currentTime <= endTime) {
          return false;
        }
      } else {
        // Overnight quiet hours
        if (currentTime >= startTime || currentTime <= endTime) {
          return false;
        }
      }
    }

    // Check specific notification type
    switch (type) {
      case 'sms':
        return preferences.smsNotifications !== false && preferences.queueNotifications !== false;
      case 'push':
        return preferences.pushNotifications !== false && preferences.queueNotifications !== false;
      case 'in_app':
        return preferences.queueNotifications !== false;
      default:
        return false;
    }
  } catch (error) {
    StructuredLogger.warn('Error checking notification preferences, defaulting to enabled', { userId, type, error });
    return true;
  }
}

/**
 * Send SMS notification using Twilio
 */
async function sendSMS(phoneNumber: string, message: string, customerId: string, queueEntryId: string): Promise<void> {
  try {
    MetricsCollector.incrementCounter('progressive_notifications.sms_sent');

    // Get Twilio credentials from environment
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio credentials not configured');
    }

    // For now, create a record for SMS sending (would integrate with Twilio in production)
    await db.collection('smsNotifications').add({
      to: phoneNumber,
      message: message,
      customerId: customerId,
      queueEntryId: queueEntryId,
      status: 'pending',
      provider: 'twilio',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    StructuredLogger.info('SMS notification queued', {
      phoneNumber,
      customerId,
      queueEntryId,
      messageLength: message.length
    });
  } catch (error) {
    MetricsCollector.recordError('progressive_notifications.sms_failed');
    StructuredLogger.error('Error sending SMS', error, {
      phoneNumber,
      customerId,
      queueEntryId
    });
    throw error;
  }
}

/**
 * Send push notification using Firebase Cloud Messaging
 */
async function sendPushNotification(
  userId: string,
  title: string,
  message: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    MetricsCollector.incrementCounter('progressive_notifications.push_sent');

    // Get user's FCM tokens
    const tokensSnapshot = await db.collection('fcmTokens')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();

    if (tokensSnapshot.empty) {
      StructuredLogger.warn('No active FCM tokens found for user', { userId });
      return;
    }

    const tokens = tokensSnapshot.docs.map(doc => doc.data().token as string);

    // Send through FCM (would use admin.messaging().sendMulticast in production)
    // For now, create a record for push notification sending
    await db.collection('pushNotifications').add({
      userId: userId,
      title: title,
      message: message,
      data: data || {},
      tokens: tokens,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    StructuredLogger.info('Push notification queued', {
      userId,
      tokenCount: tokens.length,
      title
    });
  } catch (error) {
    MetricsCollector.recordError('progressive_notifications.push_failed');
    StructuredLogger.error('Error sending push notification', error, {
      userId,
      title
    });
    throw error;
  }
}

/**
 * Send in-app notification
 */
async function sendInAppNotification(
  userId: string,
  title: string,
  message: string,
  meta?: Record<string, any>
): Promise<void> {
  try {
    MetricsCollector.incrementCounter('progressive_notifications.in_app_sent');

    await db.collection('notifications').add({
      userId: userId,
      title: title,
      message: message,
      read: false,
      meta: {
        ...meta,
        type: 'queue_progressive',
        generatedBy: 'progressive_notifications'
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    StructuredLogger.info('In-app notification sent', {
      userId,
      title
    });
  } catch (error) {
    MetricsCollector.recordError('progressive_notifications.in_app_failed');
    StructuredLogger.error('Error sending in-app notification', error, {
      userId,
      title
    });
    throw error;
  }
}

/**
 * Send progressive notification to customer
 */
async function sendProgressiveNotification(
  queueEntry: FirestoreQueueEntry,
  notificationType: keyof typeof NOTIFICATION_TEMPLATES
): Promise<void> {
  const startTime = Date.now();

  try {
    MetricsCollector.incrementCounter('progressive_notifications.sent');

    const template = NOTIFICATION_TEMPLATES[notificationType];
    const customerId = queueEntry.customerId;

    // Get customer details
    const customerDoc = await db.collection('users').doc(customerId).get();
    if (!customerDoc.exists) {
      throw new Error(`Customer ${customerId} not found`);
    }

    const customer = customerDoc.data() as FirestoreUser;

    // Send notifications based on user preferences
    const notificationPromises = [];

    // SMS notification
    if (customer.phone && await shouldSendNotification(customerId, 'sms')) {
      notificationPromises.push(
        sendSMS(customer.phone, template.sms, customerId, queueEntry.id)
      );
    }

    // Push notification (if applicable for customers)
    if (await shouldSendNotification(customerId, 'push')) {
      notificationPromises.push(
        sendPushNotification(customerId, template.title, template.message, {
          queueEntryId: queueEntry.id,
          notificationType: notificationType.toLowerCase(),
          position: queueEntry.position.toString()
        })
      );
    }

    // In-app notification (always send)
    if (await shouldSendNotification(customerId, 'in_app')) {
      notificationPromises.push(
        sendInAppNotification(customerId, template.title, template.message, {
          queueEntryId: queueEntry.id,
          notificationType: notificationType.toLowerCase(),
          position: queueEntry.position,
          plate: queueEntry.plate
        })
      );
    }

    await Promise.all(notificationPromises);

    const duration = Date.now() - startTime;
    MetricsCollector.recordTiming('progressive_notifications.send_duration', duration);

    StructuredLogger.info('Progressive notification sent successfully', {
      queueEntryId: queueEntry.id,
      customerId,
      notificationType,
      duration,
      channels: notificationPromises.length
    });
  } catch (error) {
    MetricsCollector.recordError('progressive_notifications.send_failed');
    StructuredLogger.error('Error sending progressive notification', error, {
      queueEntryId: queueEntry.id,
      notificationType,
      duration: Date.now() - startTime
    });
    throw error;
  }
}

/**
 * Send technician notification for queue updates
 */
async function sendTechnicianNotification(
  technicianId: string,
  queueEntry: FirestoreQueueEntry,
  action: string
): Promise<void> {
  try {
    const title = `Actualización de Cola: ${action}`;
    const message = `Cliente ${queueEntry.plate} - Posición ${queueEntry.position}`;

    // Send push notification to technician
    if (await shouldSendNotification(technicianId, 'push')) {
      await sendPushNotification(technicianId, title, message, {
        queueEntryId: queueEntry.id,
        action: action,
        customerId: queueEntry.customerId,
        plate: queueEntry.plate
      });
    }

    // Send in-app notification
    if (await shouldSendNotification(technicianId, 'in_app')) {
      await sendInAppNotification(technicianId, title, message, {
        queueEntryId: queueEntry.id,
        action: action,
        customerId: queueEntry.customerId,
        plate: queueEntry.plate,
        position: queueEntry.position
      });
    }

    StructuredLogger.info('Technician notification sent', {
      technicianId,
      queueEntryId: queueEntry.id,
      action
    });
  } catch (error) {
    StructuredLogger.error('Error sending technician notification', error, {
      technicianId,
      queueEntryId: queueEntry.id,
      action
    });
    // Don't throw - technician notification failure shouldn't block customer notifications
  }
}

/**
 * Cloud Function triggered on queue entry updates
 */
export const onQueueUpdate = onDocumentUpdated(
  'queueEntries/{queueEntryId}',
  async (event) => {
    const startTime = Date.now();
    const queueEntryId = event.params.queueEntryId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) {
      StructuredLogger.error('No queue entry data found', null, { queueEntryId });
      return null;
    }

    const beforeEntry = { id: queueEntryId, ...beforeData } as FirestoreQueueEntry;
    const afterEntry = { id: queueEntryId, ...afterData } as FirestoreQueueEntry;

    try {
      MetricsCollector.incrementCounter('progressive_notifications.queue_update_trigger');

      StructuredLogger.info('Queue entry updated, checking for progressive notifications', {
        queueEntryId,
        beforeStatus: beforeEntry.status,
        afterStatus: afterEntry.status,
        beforePosition: beforeEntry.position,
        afterPosition: afterEntry.position
      });

      // Check for position-based notifications
      if (beforeEntry.position !== afterEntry.position) {
        // Position changed - check for progressive notifications
        if (afterEntry.position === 2) {
          await sendProgressiveNotification(afterEntry, 'POSITION_2');
        } else if (afterEntry.position === 1) {
          await sendProgressiveNotification(afterEntry, 'POSITION_1');
        }
      }

      // Check for status-based notifications
      if (beforeEntry.status !== afterEntry.status) {
        switch (afterEntry.status) {
          case 'called':
            await sendProgressiveNotification(afterEntry, 'CALLED');
            // Notify assigned technician if any
            if (afterEntry.assignedTo) {
              await sendTechnicianNotification(afterEntry.assignedTo, afterEntry, 'Cliente Llamado');
            }
            break;
          case 'in_service':
            await sendProgressiveNotification(afterEntry, 'IN_SERVICE');
            if (afterEntry.assignedTo) {
              await sendTechnicianNotification(afterEntry.assignedTo, afterEntry, 'Servicio Iniciado');
            }
            break;
          case 'completed':
            await sendProgressiveNotification(afterEntry, 'COMPLETED');
            if (afterEntry.assignedTo) {
              await sendTechnicianNotification(afterEntry.assignedTo, afterEntry, 'Servicio Completado');
            }
            break;
        }
      }

      const duration = Date.now() - startTime;
      MetricsCollector.recordTiming('progressive_notifications.queue_update_duration', duration);

      StructuredLogger.info('Queue update processing completed', {
        queueEntryId,
        duration
      });

      return null;
    } catch (error) {
      MetricsCollector.recordError('progressive_notifications.queue_update_failed');
      StructuredLogger.error('Error processing queue update', error, {
        queueEntryId,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
);

/**
 * Scheduled function to send periodic reminders for stale queue entries
 */
export const sendPeriodicReminders = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'America/Bogota',
    retryCount: 3,
    maxRetrySeconds: 60,
  },
  async (event) => {
    const startTime = Date.now();

    try {
      MetricsCollector.incrementCounter('progressive_notifications.periodic_reminders_trigger');

      StructuredLogger.info('Starting periodic reminders check');

      // Find queue entries that have been waiting too long
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Get entries waiting more than 30 minutes but less than 1 hour (to avoid spam)
      const staleEntriesSnapshot = await db.collection('queueEntries')
        .where('status', '==', 'waiting')
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(thirtyMinutesAgo))
        .where('createdAt', '>', admin.firestore.Timestamp.fromDate(oneHourAgo))
        .get();

      const staleEntries = staleEntriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FirestoreQueueEntry));

      StructuredLogger.info(`Found ${staleEntries.length} stale queue entries for reminders`);

      // Send reminders to customers
      const reminderPromises = staleEntries.map(async (entry) => {
        try {
          const waitTimeMinutes = Math.floor((Date.now() - entry.createdAt.toDate().getTime()) / (1000 * 60));

          const reminderMessage = {
            title: 'Recordatorio de Espera',
            message: `Han pasado ${waitTimeMinutes} minutos desde que se unió a la cola. Su posición actual es #${entry.position}.`,
            sms: `Blue Dragon Motors: Han pasado ${waitTimeMinutes} minutos desde que se unió a la cola. Su posición actual es #${entry.position}.`
          };

          // Get customer details
          const customerDoc = await db.collection('users').doc(entry.customerId).get();
          if (!customerDoc.exists) return;

          const customer = customerDoc.data() as FirestoreUser;

          // Send SMS reminder if enabled
          if (customer.phone && await shouldSendNotification(entry.customerId, 'sms')) {
            await sendSMS(customer.phone, reminderMessage.sms, entry.customerId, entry.id);
          }

          // Send in-app reminder
          if (await shouldSendNotification(entry.customerId, 'in_app')) {
            await sendInAppNotification(entry.customerId, reminderMessage.title, reminderMessage.message, {
              queueEntryId: entry.id,
              waitTimeMinutes,
              position: entry.position,
              type: 'periodic_reminder'
            });
          }

          StructuredLogger.info('Periodic reminder sent', {
            queueEntryId: entry.id,
            customerId: entry.customerId,
            waitTimeMinutes,
            position: entry.position
          });
        } catch (error) {
          StructuredLogger.error('Error sending periodic reminder', error, {
            queueEntryId: entry.id,
            customerId: entry.customerId
          });
        }
      });

      await Promise.all(reminderPromises);

      const duration = Date.now() - startTime;
      MetricsCollector.recordTiming('progressive_notifications.periodic_reminders_duration', duration);

      StructuredLogger.info('Periodic reminders completed', {
        entriesProcessed: staleEntries.length,
        duration
      });
    } catch (error) {
      MetricsCollector.recordError('progressive_notifications.periodic_reminders_failed');
      StructuredLogger.error('Error in periodic reminders function', error, {
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
);