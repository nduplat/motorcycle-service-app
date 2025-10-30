
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

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

export const createAppointment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { customerId, vehicleId, serviceTypes, scheduledAt, estimatedDuration, notes } = data;

  if (!customerId || !vehicleId || !serviceTypes || !scheduledAt) {
    throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos para crear la cita.');
  }

  try {
    const newAppointmentData = {
      customerId,
      vehicleId,
      serviceTypes,
      scheduledAt: admin.firestore.Timestamp.fromDate(new Date(scheduledAt)),
      estimatedDuration: estimatedDuration || 60,
      notes: notes || '',
      status: 'scheduled', // Default status
      number: `APT-${Date.now().toString().slice(-6)}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth.uid,
    };

    const docRef = await admin.firestore().collection('appointments').add(newAppointmentData);

    return { id: docRef.id, success: true, number: newAppointmentData.number, status: newAppointmentData.status };
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    throw new functions.https.HttpsError('internal', `Error al crear la cita: ${error.message}`);
  }
});

export const assignTechnician = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { appointmentId, technicianId } = data;

  if (!appointmentId || !technicianId) {
    throw new functions.https.HttpsError('invalid-argument', 'appointmentId and technicianId are required.');
  }

  try {
    const appointmentRef = admin.firestore().collection('appointments').doc(appointmentId);
    await appointmentRef.update({
      assignedTo: technicianId,
      status: 'scheduled',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error assigning technician:', error);
    throw new functions.https.HttpsError('internal', `Error assigning technician: ${error.message}`);
  }
});

export const updateAppointmentStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { appointmentId, status, workOrderId } = data;

  if (!appointmentId || !status) {
    throw new functions.https.HttpsError('invalid-argument', 'appointmentId and status are required.');
  }

  try {
    const appointmentRef = admin.firestore().collection('appointments').doc(appointmentId);
    const dataToUpdate: any = { 
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (workOrderId) {
      dataToUpdate.workOrderId = workOrderId;
    }

    await appointmentRef.update(dataToUpdate);

    return { success: true };
  } catch (error: any) {
    console.error('Error updating appointment status:', error);
    throw new functions.https.HttpsError('internal', `Error updating appointment status: ${error.message}`);
  }
});