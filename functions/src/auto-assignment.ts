import { onDocumentCreated } from 'firebase-functions/v2/firestore';
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

interface FirestoreWorkOrder {
  id: string;
  clientId: string;
  vehicleId: string;
  services: string[];
  products: string[];
  status: string;
  totalPrice: number;
  createdAt: admin.firestore.Timestamp;
  assignedTo?: string;
  number?: string;
  parts?: any[];
  updatedAt?: admin.firestore.Timestamp;
}


interface FirestoreMotorcycle {
  id: string;
  brand: string;
  model: string;
  year: number;
  plate?: string;
  mileageKm?: number;
  userId: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

interface TechnicianScore {
  technicianId: string;
  technician: FirestoreUser;
  totalScore: number;
  breakdown: {
    skillsMatch: number;
    workloadBalance: number;
    rating: number;
    brandExperience: number;
    timeSinceLastAssignment: number;
  };
}

/**
 * Calculate technician scores based on multiple criteria
 */
async function calculateTechnicianScores(queueEntry: FirestoreQueueEntry): Promise<TechnicianScore[]> {
  const startTime = Date.now();

  try {
    MetricsCollector.incrementCounter('auto_assignment.score_calculation');

    // Get all technicians
    const techniciansSnapshot = await db.collection('users')
      .where('role', '==', 'technician')
      .where('technicianProfile', '!=', null)
      .get();

    const technicians = techniciansSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as FirestoreUser)).filter(tech =>
      tech.availability?.isAvailable !== false &&
      tech.technicianProfile?.skills &&
      tech.technicianProfile.skills.length > 0
    );

    if (technicians.length === 0) {
      StructuredLogger.warn('No available technicians found');
      return [];
    }

    // Get motorcycle details for brand matching
    let motorcycle: FirestoreMotorcycle | null = null;
    if (queueEntry.motorcycleId) {
      const motorcycleDoc = await db.collection('motorcycles').doc(queueEntry.motorcycleId).get();
      if (motorcycleDoc.exists) {
        motorcycle = { id: motorcycleDoc.id, ...motorcycleDoc.data() } as FirestoreMotorcycle;
      }
    }

    // Get required skills from service type (simplified - in real implementation, get from service catalog)
    const requiredSkills = ['basic_maintenance']; // Default skills

    // Calculate scores for each technician
    const scores: TechnicianScore[] = [];

    for (const technician of technicians) {
      const score = await calculateIndividualScore(technician, queueEntry, motorcycle, requiredSkills);
      scores.push(score);
    }

    // Sort by total score descending
    scores.sort((a, b) => b.totalScore - a.totalScore);

    const duration = Date.now() - startTime;
    MetricsCollector.recordTiming('auto_assignment.score_calculation.duration', duration);

    StructuredLogger.info('Technician scores calculated', {
      technicianCount: technicians.length,
      topScore: scores[0]?.totalScore || 0,
      duration
    });

    return scores;
  } catch (error) {
    MetricsCollector.recordError('auto_assignment.score_calculation');
    StructuredLogger.error('Error calculating technician scores', error, {
      queueEntryId: queueEntry.id,
      duration: Date.now() - startTime
    });
    throw error;
  }
}

/**
 * Calculate individual technician score
 */
async function calculateIndividualScore(
  technician: FirestoreUser,
  queueEntry: FirestoreQueueEntry,
  motorcycle: FirestoreMotorcycle | null,
  requiredSkills: string[]
): Promise<TechnicianScore> {
  const breakdown = {
    skillsMatch: 0,
    workloadBalance: 0,
    rating: 0,
    brandExperience: 0,
    timeSinceLastAssignment: 0
  };

  // 1. Skills Match (40 points max)
  const technicianSkills = technician.technicianProfile?.skills || [];
  const matchingSkills = requiredSkills.filter(skill => technicianSkills.includes(skill));
  breakdown.skillsMatch = (matchingSkills.length / requiredSkills.length) * 40;

  // 2. Workload Balance (30 points max)
  const currentWorkload = await getTechnicianCurrentWorkload(technician.id);
  // Lower workload = higher score (inverse relationship)
  breakdown.workloadBalance = Math.max(0, 30 - (currentWorkload * 3)); // Deduct 3 points per active work order

  // 3. Rating (15 points max) - Simplified, using a default rating
  const rating = 4.5; // In real implementation, get from technician metrics
  breakdown.rating = (rating / 5.0) * 15;

  // 4. Brand Experience (10 points max)
  if (motorcycle?.brand) {
    const hasBrandExperience = technicianSkills.some(skill =>
      skill.toLowerCase().includes(motorcycle.brand.toLowerCase())
    );
    breakdown.brandExperience = hasBrandExperience ? 10 : 5; // Full points for brand experience, half otherwise
  } else {
    breakdown.brandExperience = 5; // Default half points
  }

  // 5. Time Since Last Assignment (5 points max)
  const hoursSinceLastAssignment = await getHoursSinceLastAssignment(technician.id);
  // More recent assignments get lower scores to encourage rotation
  breakdown.timeSinceLastAssignment = Math.min(5, hoursSinceLastAssignment / 24); // 1 point per day, max 5

  const totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);

  return {
    technicianId: technician.id,
    technician,
    totalScore,
    breakdown
  };
}

/**
 * Get current workload for a technician
 */
async function getTechnicianCurrentWorkload(technicianId: string): Promise<number> {
  try {
    const activeWorkOrdersSnapshot = await db.collection('workOrders')
      .where('assignedTo', '==', technicianId)
      .where('status', 'in', ['open', 'in_progress', 'waiting_parts'])
      .get();

    return activeWorkOrdersSnapshot.size;
  } catch (error) {
    StructuredLogger.warn('Error getting technician workload, using default', { technicianId, error });
    return 0;
  }
}

/**
 * Get hours since last assignment for workload balancing
 */
async function getHoursSinceLastAssignment(technicianId: string): Promise<number> {
  try {
    const lastAssignmentSnapshot = await db.collection('workOrders')
      .where('assignedTo', '==', technicianId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (lastAssignmentSnapshot.empty) {
      return 24 * 7; // 1 week if no previous assignments
    }

    const lastAssignment = lastAssignmentSnapshot.docs[0].data() as FirestoreWorkOrder;
    const lastAssignmentTime = lastAssignment.createdAt.toDate();
    const now = new Date();

    return (now.getTime() - lastAssignmentTime.getTime()) / (1000 * 60 * 60);
  } catch (error) {
    StructuredLogger.warn('Error getting last assignment time, using default', { technicianId, error });
    return 24; // 24 hours default
  }
}

/**
 * Create work order for the assigned technician
 */
async function createWorkOrder(queueEntry: FirestoreQueueEntry, technicianId: string): Promise<string> {
  const startTime = Date.now();

  try {
    MetricsCollector.incrementCounter('auto_assignment.work_order_creation');

    // Get customer and motorcycle details
    const customerDoc = await db.collection('users').doc(queueEntry.customerId).get();
    if (!customerDoc.exists) {
      throw new Error(`Customer ${queueEntry.customerId} not found`);
    }

    let vehicleId = queueEntry.motorcycleId;
    if (!vehicleId) {
      // Create a temporary vehicle record if not provided
      const vehicleRef = db.collection('motorcycles').doc();
      await vehicleRef.set({
        userId: queueEntry.customerId,
        plate: queueEntry.plate,
        mileageKm: queueEntry.mileageKm,
        brand: 'Unknown', // Would need to be determined from service
        model: 'Unknown',
        year: new Date().getFullYear(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      vehicleId = vehicleRef.id;
    }

    // Generate work order number
    const workOrderNumber = await generateWorkOrderNumber();

    // Create work order
    const workOrderData = {
      clientId: queueEntry.customerId,
      vehicleId: vehicleId,
      services: [], // Would be populated based on service type
      products: [], // Parts to be added later
      status: 'open',
      totalPrice: 0, // To be calculated
      assignedTo: technicianId,
      number: workOrderNumber,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const workOrderRef = await db.collection('workOrders').add(workOrderData);

    const duration = Date.now() - startTime;
    MetricsCollector.recordTiming('auto_assignment.work_order_creation.duration', duration);

    StructuredLogger.info('Work order created successfully', {
      workOrderId: workOrderRef.id,
      technicianId,
      customerId: queueEntry.customerId,
      duration
    });

    return workOrderRef.id;
  } catch (error) {
    MetricsCollector.recordError('auto_assignment.work_order_creation');
    StructuredLogger.error('Error creating work order', error, {
      queueEntryId: queueEntry.id,
      technicianId,
      duration: Date.now() - startTime
    });
    throw error;
  }
}

/**
 * Generate unique work order number
 */
async function generateWorkOrderNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Get count of work orders this month for sequential numbering
  const startOfMonth = new Date(year, now.getMonth(), 1);
  const workOrdersThisMonth = await db.collection('workOrders')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfMonth))
    .get();

  const sequenceNumber = String(workOrdersThisMonth.size + 1).padStart(4, '0');

  return `WO-${year}${month}-${sequenceNumber}`;
}

/**
 * Update queue entry with assignment details
 */
async function updateQueueEntry(queueEntryId: string, technicianId: string, workOrderId: string): Promise<void> {
  try {
    MetricsCollector.incrementCounter('auto_assignment.queue_update');

    await db.collection('queueEntries').doc(queueEntryId).update({
      assignedTo: technicianId,
      workOrderId: workOrderId,
      status: 'called', // Update status to indicate assignment
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    StructuredLogger.info('Queue entry updated with assignment', {
      queueEntryId,
      technicianId,
      workOrderId
    });
  } catch (error) {
    MetricsCollector.recordError('auto_assignment.queue_update');
    StructuredLogger.error('Error updating queue entry', error, { queueEntryId, technicianId, workOrderId });
    throw error;
  }
}

/**
 * Send SMS confirmation to customer
 */
async function sendCustomerSMS(queueEntry: FirestoreQueueEntry, technician: FirestoreUser): Promise<void> {
  try {
    MetricsCollector.incrementCounter('auto_assignment.sms_sent');

    // Get customer details
    const customerDoc = await db.collection('users').doc(queueEntry.customerId).get();
    if (!customerDoc.exists) {
      throw new Error(`Customer ${queueEntry.customerId} not found`);
    }
    const customer = customerDoc.data() as FirestoreUser;

    if (!customer.phone) {
      StructuredLogger.warn('Customer has no phone number, skipping SMS', { customerId: queueEntry.customerId });
      return;
    }

    const message = `Blue Dragon Motors: Su servicio ha sido asignado al técnico ${technician.name}. ` +
      `Por favor llegue al taller pronto. Código de verificación: ${queueEntry.verificationCode || 'N/A'}`;

    // In a real implementation, integrate with SMS service like Twilio
    // For now, create a notification record
    await db.collection('smsNotifications').add({
      to: customer.phone,
      message: message,
      customerId: queueEntry.customerId,
      queueEntryId: queueEntry.id,
      technicianId: technician.id,
      status: 'pending', // Would be updated by SMS service
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    StructuredLogger.info('SMS notification queued for customer', {
      customerId: queueEntry.customerId,
      phone: customer.phone,
      technicianId: technician.id
    });
  } catch (error) {
    MetricsCollector.recordError('auto_assignment.sms_failed');
    StructuredLogger.error('Error sending customer SMS', error, {
      queueEntryId: queueEntry.id,
      customerId: queueEntry.customerId
    });
    // Don't throw - SMS failure shouldn't block assignment
  }
}

/**
 * Send push notification to technician
 */
async function sendTechnicianPushNotification(queueEntry: FirestoreQueueEntry, technician: FirestoreUser): Promise<void> {
  try {
    MetricsCollector.incrementCounter('auto_assignment.push_sent');

    const title = 'Nueva Asignación de Trabajo';
    const message = `Se le ha asignado un nuevo trabajo. Cliente: ${queueEntry.plate}, Kilometraje: ${queueEntry.mileageKm}km`;

    // Create in-app notification
    await db.collection('notifications').add({
      type: 'service_orders',
      title: title,
      message: message,
      userId: technician.id,
      priority: 'high',
      targetAudience: 'specific_user',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      additionalMeta: {
        queueEntryId: queueEntry.id,
        customerId: queueEntry.customerId,
        workOrderId: queueEntry.workOrderId
      }
    });

    // In a real implementation, send push notification via FCM
    // For now, this creates an in-app notification that can be pushed via FCM if tokens exist

    StructuredLogger.info('Push notification sent to technician', {
      technicianId: technician.id,
      queueEntryId: queueEntry.id
    });
  } catch (error) {
    MetricsCollector.recordError('auto_assignment.push_failed');
    StructuredLogger.error('Error sending technician push notification', error, {
      technicianId: technician.id,
      queueEntryId: queueEntry.id
    });
    // Don't throw - push failure shouldn't block assignment
  }
}

/**
 * Update technician workload metrics
 */
async function updateTechnicianMetrics(technicianId: string): Promise<void> {
  try {
    MetricsCollector.incrementCounter('auto_assignment.metrics_update');

    // Get current metrics or create new ones
    const metricsRef = db.collection('technicianMetrics').doc(technicianId);
    const metricsDoc = await metricsRef.get();

    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (metricsDoc.exists) {
      // Update existing metrics
      const currentData = metricsDoc.data();
      await metricsRef.update({
        totalAssignments: (currentData?.totalAssignments || 0) + 1,
        assignmentsThisMonth: (currentData?.assignmentsThisMonth || 0) + 1,
        lastAssignmentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Create new metrics record
      await metricsRef.set({
        technicianId: technicianId,
        totalAssignments: 1,
        assignmentsThisMonth: 1,
        monthStart: admin.firestore.Timestamp.fromDate(currentMonth),
        lastAssignmentAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    StructuredLogger.info('Technician metrics updated', { technicianId });
  } catch (error) {
    MetricsCollector.recordError('auto_assignment.metrics_update_failed');
    StructuredLogger.error('Error updating technician metrics', error, { technicianId });
    // Don't throw - metrics failure shouldn't block assignment
  }
}

/**
 * Log assignment event for auditing
 */
async function logAssignmentEvent(
  queueEntry: FirestoreQueueEntry,
  technician: FirestoreUser,
  workOrderId: string,
  scores: TechnicianScore[]
): Promise<void> {
  try {
    MetricsCollector.incrementCounter('auto_assignment.audit_log');

    const auditData = {
      eventType: 'auto_assignment',
      queueEntryId: queueEntry.id,
      customerId: queueEntry.customerId,
      technicianId: technician.id,
      workOrderId: workOrderId,
      assignmentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      scoringDetails: {
        selectedTechnician: {
          id: technician.id,
          name: technician.name,
          score: scores[0]?.totalScore || 0,
          breakdown: scores[0]?.breakdown || {}
        },
        alternativeTechnicians: scores.slice(1, 3).map(s => ({
          id: s.technicianId,
          name: s.technician.name,
          score: s.totalScore
        })),
        totalTechniciansConsidered: scores.length
      },
      queueEntryDetails: {
        serviceType: queueEntry.serviceType,
        plate: queueEntry.plate,
        mileageKm: queueEntry.mileageKm,
        joinedAt: queueEntry.joinedAt
      }
    };

    await db.collection('assignmentAuditLog').add(auditData);

    StructuredLogger.info('Assignment event logged for audit', {
      queueEntryId: queueEntry.id,
      technicianId: technician.id,
      workOrderId
    });
  } catch (error) {
    MetricsCollector.recordError('auto_assignment.audit_log_failed');
    StructuredLogger.error('Error logging assignment event', error, {
      queueEntryId: queueEntry.id,
      technicianId: technician.id
    });
    // Don't throw - audit failure shouldn't block assignment
  }
}

/**
 * Notify managers when no suitable technician is available
 */
async function notifyManagersNoTechnician(queueEntry: FirestoreQueueEntry): Promise<void> {
  try {
    MetricsCollector.incrementCounter('auto_assignment.manager_notification');

    // Get all managers
    const managersSnapshot = await db.collection('users')
      .where('role', '==', 'manager')
      .get();

    const managers = managersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreUser));

    if (managers.length === 0) {
      StructuredLogger.warn('No managers found to notify about failed assignment');
      return;
    }

    // Create notifications for all managers
    const notificationPromises = managers.map(manager =>
      db.collection('notifications').add({
        type: 'system_alert',
        title: 'Asignación Automática Fallida',
        message: `No se pudo asignar automáticamente el trabajo para la placa ${queueEntry.plate}. Se requiere asignación manual.`,
        userId: manager.id,
        priority: 'critical',
        targetAudience: 'specific_user',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        additionalMeta: {
          queueEntryId: queueEntry.id,
          customerId: queueEntry.customerId,
          requiresManualAssignment: true
        }
      })
    );

    await Promise.all(notificationPromises);

    StructuredLogger.info('Managers notified about failed auto-assignment', {
      queueEntryId: queueEntry.id,
      managersNotified: managers.length
    });
  } catch (error) {
    MetricsCollector.recordError('auto_assignment.manager_notification_failed');
    StructuredLogger.error('Error notifying managers', error, { queueEntryId: queueEntry.id });
  }
}

/**
 * Main auto-assignment function triggered on queue entry creation
 */
export const onQueueEntryCreate = onDocumentCreated(
  'queueEntries/{queueEntryId}',
  async (event) => {
    const startTime = Date.now();
    const queueEntryId = event.params.queueEntryId;
    const queueEntryData = event.data?.data();

    if (!queueEntryData) {
      StructuredLogger.error('No queue entry data found', null, { queueEntryId });
      return null;
    }

    const queueEntry = { id: queueEntryId, ...queueEntryData } as FirestoreQueueEntry;

    try {
      MetricsCollector.incrementCounter('auto_assignment.trigger');

      StructuredLogger.info(`Auto-assignment triggered for queue entry ${queueEntryId}`, {
        customerId: queueEntry.customerId,
        serviceType: queueEntry.serviceType,
        plate: queueEntry.plate
      });

      // Calculate technician scores
      const technicianScores = await calculateTechnicianScores(queueEntry);

      if (technicianScores.length === 0) {
        StructuredLogger.warn('No technicians available for assignment', { queueEntryId });

        // Notify managers for manual assignment
        await notifyManagersNoTechnician(queueEntry);

        // Log failed assignment
        await db.collection('assignmentAuditLog').add({
          eventType: 'auto_assignment_failed',
          queueEntryId: queueEntry.id,
          reason: 'no_technicians_available',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          queueEntryDetails: {
            serviceType: queueEntry.serviceType,
            plate: queueEntry.plate,
            mileageKm: queueEntry.mileageKm
          }
        });

        return null;
      }

      // Select the highest-scoring technician
      const selectedTechnician = technicianScores[0];

      StructuredLogger.info('Technician selected for assignment', {
        queueEntryId,
        technicianId: selectedTechnician.technicianId,
        score: selectedTechnician.totalScore,
        breakdown: selectedTechnician.breakdown
      });

      // Create work order
      const workOrderId = await createWorkOrder(queueEntry, selectedTechnician.technicianId);

      // Update queue entry with assignment
      await updateQueueEntry(queueEntryId, selectedTechnician.technicianId, workOrderId);

      // Send notifications
      await Promise.all([
        sendCustomerSMS(queueEntry, selectedTechnician.technician),
        sendTechnicianPushNotification(queueEntry, selectedTechnician.technician)
      ]);

      // Update technician metrics
      await updateTechnicianMetrics(selectedTechnician.technicianId);

      // Log assignment event
      await logAssignmentEvent(queueEntry, selectedTechnician.technician, workOrderId, technicianScores);

      const duration = Date.now() - startTime;
      MetricsCollector.recordTiming('auto_assignment.total_duration', duration);

      StructuredLogger.info(`Auto-assignment completed successfully for queue entry ${queueEntryId}`, {
        technicianId: selectedTechnician.technicianId,
        workOrderId,
        totalScore: selectedTechnician.totalScore,
        duration
      });

      return null;
    } catch (error) {
      MetricsCollector.recordError('auto_assignment.trigger');
      StructuredLogger.error('Error in auto-assignment function', error, {
        queueEntryId,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
);