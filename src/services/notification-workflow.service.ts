/**
 * Notification Workflow Service - Servicio de Flujo de Trabajo de Notificaciones
 *
 * Implements the complete notification system flow as described in workflow-diagrams.md:
 * event occurs → determine notification type & target → check user preferences →
 * notifications enabled? → generate message content → include metadata? (QR codes, links, etc.) →
 * send to system notification service → queue for delivery → deliver via multiple channels →
 * mark as sent & log.
 *
 * Implementa el flujo completo del sistema de notificaciones como se describe en workflow-diagrams.md.
 */

import { Injectable, inject } from '@angular/core';
import { NotificationService, NotificationCategory } from './notification.service';
import { EventBusService, NotificationEvent } from './event-bus.service';
import { UserService } from './user.service';
import { QrCodeService } from './qr-code.service';
import { Timestamp } from 'firebase/firestore';
import { db } from '../firebase.config';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { limit as firestoreLimit } from 'firebase/firestore';
import { Observable, from, BehaviorSubject } from 'rxjs';

export interface NotificationWorkflowEvent {
  type: 'assignment' | 'status_change' | 'appointment_created' | 'appointment_assigned' |
        'work_order_completed' | 'queue_called' | 'maintenance_reminder' | 'inventory_alert';
  entityId: string;
  entityType: 'appointment' | 'work_order' | 'queue_entry' | 'inventory_item' | 'vehicle';
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface NotificationTarget {
  userId: string;
  channels: ('in_app' | 'push' | 'email' | 'sms')[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface NotificationMessage {
  title: string;
  message: string;
  category: NotificationCategory;
  metadata?: Record<string, any>;
  qrCodeData?: string;
  links?: string[];
}

export interface QueuedNotification {
  id?: string;
  workflowEventId: string;
  target: NotificationTarget;
  message: NotificationMessage;
  status: 'queued' | 'processing' | 'sent' | 'failed';
  queuedAt: Timestamp;
  sentAt?: Timestamp;
  deliveredChannels: string[];
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationWorkflowService {
  private notificationService = inject(NotificationService);
  private eventBus = inject(EventBusService);
  private userService = inject(UserService);
  private qrCodeService = inject(QrCodeService);

  private workflowQueue = new BehaviorSubject<QueuedNotification[]>([]);
  private processingQueue = false;

  constructor() {
    this.setupEventListeners();
    this.startQueueProcessor();
  }

  /**
   * Main entry point for the notification workflow
   * Punto de entrada principal para el flujo de trabajo de notificaciones
   */
  async processEvent(event: NotificationWorkflowEvent): Promise<void> {
    try {
      console.log('🔄 Processing notification workflow event:', event);

      // Step 1: Determine notification type & target
      const targets = await this.determineNotificationTargets(event);
      if (targets.length === 0) {
        console.log('ℹ️ No notification targets found for event:', event.type);
        return;
      }

      // Step 2-4: Check user preferences and filter enabled notifications
      const enabledTargets = await this.filterEnabledNotifications(targets);

      if (enabledTargets.length === 0) {
        console.log('ℹ️ No users have notifications enabled for this event');
        return;
      }

      // Step 5-6: Generate message content with metadata
      const messages = await this.generateMessages(event, enabledTargets);

      // Step 7-8: Queue notifications for delivery
      await this.queueNotifications(event, messages);

    } catch (error) {
      console.error('❌ Error processing notification workflow event:', error);
      throw error;
    }
  }

  /**
   * Step 1: Determine notification type and targets based on event
   * Paso 1: Determinar el tipo de notificación y objetivos basados en el evento
   */
  private async determineNotificationTargets(event: NotificationWorkflowEvent): Promise<NotificationTarget[]> {
    const targets: NotificationTarget[] = [];

    switch (event.type) {
      case 'assignment':
        targets.push(...await this.getAssignmentTargets(event));
        break;
      case 'status_change':
        targets.push(...await this.getStatusChangeTargets(event));
        break;
      case 'appointment_created':
        targets.push(...await this.getAppointmentTargets(event));
        break;
      case 'appointment_assigned':
        targets.push(...await this.getAppointmentAssignedTargets(event));
        break;
      case 'work_order_completed':
        targets.push(...await this.getWorkOrderCompletedTargets(event));
        break;
      case 'queue_called':
        targets.push(...await this.getQueueCalledTargets(event));
        break;
      case 'maintenance_reminder':
        targets.push(...await this.getMaintenanceReminderTargets(event));
        break;
      case 'inventory_alert':
        targets.push(...await this.getInventoryAlertTargets(event));
        break;
    }

    return targets;
  }

  /**
   * Step 2-4: Filter targets based on user preferences
   * Pasos 2-4: Filtrar objetivos basados en preferencias de usuario
   */
  private async filterEnabledNotifications(targets: NotificationTarget[]): Promise<NotificationTarget[]> {
    const enabledTargets: NotificationTarget[] = [];

    for (const target of targets) {
      try {
        const preferences = await this.notificationService.getUserPreferences(target.userId);
        if (!preferences) {
          // Default to enabled if no preferences set
          enabledTargets.push(target);
          continue;
        }

        // Check if notifications are enabled for this category
        const categoryKey = this.getPreferenceKeyForEvent(target);
        if (preferences[categoryKey as keyof typeof preferences]) {
          enabledTargets.push(target);
        }
      } catch (error) {
        console.warn(`Error checking preferences for user ${target.userId}:`, error);
        // Default to enabled on error
        enabledTargets.push(target);
      }
    }

    return enabledTargets;
  }

  /**
   * Step 5-6: Generate message content with metadata
   * Pasos 5-6: Generar contenido del mensaje con metadatos
   */
  private async generateMessages(
    event: NotificationWorkflowEvent,
    targets: NotificationTarget[]
  ): Promise<{ target: NotificationTarget; message: NotificationMessage }[]> {
    const messages: { target: NotificationTarget; message: NotificationMessage }[] = [];

    for (const target of targets) {
      const message = await this.generateMessageForTarget(event, target);
      if (message) {
        messages.push({ target, message });
      }
    }

    return messages;
  }

  /**
   * Step 7-8: Queue notifications for delivery
   * Pasos 7-8: Poner en cola notificaciones para entrega
   */
  private async queueNotifications(
    event: NotificationWorkflowEvent,
    messageData: { target: NotificationTarget; message: NotificationMessage }[]
  ): Promise<void> {
    const workflowEventId = await this.logWorkflowEvent(event);

    const queuedNotifications: QueuedNotification[] = messageData.map(({ target, message }) => ({
      workflowEventId,
      target,
      message,
      status: 'queued' as const,
      queuedAt: Timestamp.fromDate(new Date()),
      deliveredChannels: [],
      retryCount: 0,
      maxRetries: 3
    }));

    // Add to queue
    const currentQueue = this.workflowQueue.value;
    this.workflowQueue.next([...currentQueue, ...queuedNotifications]);

    // Save to Firestore for persistence
    await this.saveQueuedNotifications(queuedNotifications);
  }

  /**
   * Process the notification queue
   * Procesar la cola de notificaciones
   */
  private async startQueueProcessor(): Promise<void> {
    setInterval(async () => {
      if (this.processingQueue) return;

      this.processingQueue = true;
      try {
        const queue = this.workflowQueue.value;
        const pendingNotifications = queue.filter(n => n.status === 'queued');

        for (const notification of pendingNotifications) {
          await this.processQueuedNotification(notification);
        }
      } catch (error) {
        console.error('Error processing notification queue:', error);
      } finally {
        this.processingQueue = false;
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Step 9: Deliver via multiple channels
   * Paso 9: Entregar a través de múltiples canales
   */
  private async processQueuedNotification(notification: QueuedNotification): Promise<void> {
    try {
      // Update status to processing
      await this.updateQueuedNotificationStatus(notification.id!, 'processing');

      // Step 9: Deliver via multiple channels
      const deliveredChannels: string[] = [];

      for (const channel of notification.target.channels) {
        try {
          await this.deliverViaChannel(notification, channel);
          deliveredChannels.push(channel);
        } catch (error) {
          console.error(`Failed to deliver via ${channel}:`, error);
        }
      }

      // Step 10: Mark as sent & log
      if (deliveredChannels.length > 0) {
        await this.markAsSent(notification, deliveredChannels);
      } else {
        await this.markAsFailed(notification, 'No channels delivered successfully');
      }

    } catch (error) {
      console.error('Error processing queued notification:', error);
      await this.handleDeliveryFailure(notification, error as Error);
    }
  }

  /**
   * Deliver notification via specific channel
   * Entregar notificación a través de canal específico
   */
  private async deliverViaChannel(notification: QueuedNotification, channel: string): Promise<void> {
    switch (channel) {
      case 'in_app':
        await this.deliverInApp(notification);
        break;
      case 'push':
        await this.deliverPush(notification);
        break;
      case 'email':
        await this.deliverEmail(notification);
        break;
      case 'sms':
        await this.deliverSMS(notification);
        break;
      default:
        throw new Error(`Unknown delivery channel: ${channel}`);
    }
  }

  // ===== TARGET DETERMINATION METHODS =====

  private async getAssignmentTargets(event: NotificationWorkflowEvent): Promise<NotificationTarget[]> {
    const targets: NotificationTarget[] = [];

    // Notify assigned technician
    if (event.metadata?.technicianId) {
      targets.push({
        userId: event.metadata.technicianId,
        channels: ['in_app', 'push'],
        priority: 'high'
      });
    }

    // Notify customer if applicable
    if (event.metadata?.customerId) {
      targets.push({
        userId: event.metadata.customerId,
        channels: ['in_app', 'push', 'sms'],
        priority: 'medium'
      });
    }

    return targets;
  }

  private async getStatusChangeTargets(event: NotificationWorkflowEvent): Promise<NotificationTarget[]> {
    const targets: NotificationTarget[] = [];

    // Notify relevant users based on entity type
    if (event.entityType === 'work_order' && event.metadata?.customerId) {
      targets.push({
        userId: event.metadata.customerId,
        channels: ['in_app', 'push'],
        priority: event.metadata.status === 'completed' ? 'high' : 'medium'
      });
    }

    return targets;
  }

  private async getAppointmentTargets(event: NotificationWorkflowEvent): Promise<NotificationTarget[]> {
    return [{
      userId: event.metadata?.customerId || '',
      channels: ['in_app', 'push', 'email'],
      priority: 'medium'
    }];
  }

  private async getAppointmentAssignedTargets(event: NotificationWorkflowEvent): Promise<NotificationTarget[]> {
    const targets: NotificationTarget[] = [];

    if (event.metadata?.technicianId) {
      targets.push({
        userId: event.metadata.technicianId,
        channels: ['in_app', 'push'],
        priority: 'high'
      });
    }

    if (event.metadata?.customerId) {
      targets.push({
        userId: event.metadata.customerId,
        channels: ['in_app', 'push', 'sms'],
        priority: 'medium'
      });
    }

    return targets;
  }

  private async getWorkOrderCompletedTargets(event: NotificationWorkflowEvent): Promise<NotificationTarget[]> {
    return [{
      userId: event.metadata?.customerId || '',
      channels: ['in_app', 'push', 'sms'],
      priority: 'high'
    }];
  }

  private async getQueueCalledTargets(event: NotificationWorkflowEvent): Promise<NotificationTarget[]> {
    const targets: NotificationTarget[] = [];

    if (event.metadata?.customerId) {
      targets.push({
        userId: event.metadata.customerId,
        channels: ['in_app', 'push', 'sms'],
        priority: 'critical'
      });
    }

    if (event.metadata?.technicianId) {
      targets.push({
        userId: event.metadata.technicianId,
        channels: ['in_app', 'push'],
        priority: 'high'
      });
    }

    return targets;
  }

  private async getMaintenanceReminderTargets(event: NotificationWorkflowEvent): Promise<NotificationTarget[]> {
    return [{
      userId: event.metadata?.customerId || '',
      channels: ['in_app', 'push', 'email'],
      priority: 'medium'
    }];
  }

  private async getInventoryAlertTargets(event: NotificationWorkflowEvent): Promise<NotificationTarget[]> {
    // Get all admin users
    const adminUsers = this.userService.getUsersByRole('admin');

    return adminUsers.map(user => ({
      userId: user.id,
      channels: ['in_app', 'push', 'email'],
      priority: 'high'
    }));
  }

  // ===== MESSAGE GENERATION METHODS =====

  private async generateMessageForTarget(
    event: NotificationWorkflowEvent,
    target: NotificationTarget
  ): Promise<NotificationMessage | null> {
    let message: NotificationMessage | null = null;

    switch (event.type) {
      case 'assignment':
        message = await this.generateAssignmentMessage(event, target);
        break;
      case 'status_change':
        message = await this.generateStatusChangeMessage(event, target);
        break;
      case 'appointment_created':
        message = await this.generateAppointmentCreatedMessage(event, target);
        break;
      case 'appointment_assigned':
        message = await this.generateAppointmentAssignedMessage(event, target);
        break;
      case 'work_order_completed':
        message = await this.generateWorkOrderCompletedMessage(event, target);
        break;
      case 'queue_called':
        message = await this.generateQueueCalledMessage(event, target);
        break;
      case 'maintenance_reminder':
        message = await this.generateMaintenanceReminderMessage(event, target);
        break;
      case 'inventory_alert':
        message = await this.generateInventoryAlertMessage(event, target);
        break;
    }

    return message;
  }

  private async generateAssignmentMessage(
    event: NotificationWorkflowEvent,
    target: NotificationTarget
  ): Promise<NotificationMessage> {
    const isTechnician = target.userId === event.metadata?.technicianId;
    const qrCodeData = isTechnician ?
      this.qrCodeService.generateQrCodeDataUrl('assignment', event.entityId) : undefined;

    return {
      title: isTechnician ? 'Nueva Asignación' : 'Servicio Asignado',
      message: isTechnician ?
        `Se te ha asignado un nuevo ${event.entityType === 'appointment' ? 'cita' : 'trabajo'}.` :
        `Tu ${event.entityType === 'appointment' ? 'cita' : 'orden de trabajo'} ha sido asignada.`,
      category: 'service_orders',
      metadata: {
        entityId: event.entityId,
        entityType: event.entityType,
        assignmentType: 'auto'
      },
      qrCodeData
    };
  }

  private async generateStatusChangeMessage(
    event: NotificationWorkflowEvent,
    target: NotificationTarget
  ): Promise<NotificationMessage> {
    const status = event.metadata?.status || 'unknown';
    let title = 'Actualización de Estado';
    let message = `El estado de tu ${event.entityType} ha cambiado a: ${status}`;

    if (status === 'completed' || status === 'ready_for_pickup') {
      title = '¡Servicio Completado!';
      message = `Tu ${event.entityType === 'work_order' ? 'orden de trabajo' : 'cita'} está lista.`;
    }

    return {
      title,
      message,
      category: 'service_orders',
      metadata: {
        entityId: event.entityId,
        entityType: event.entityType,
        newStatus: status
      }
    };
  }

  private async generateAppointmentCreatedMessage(
    event: NotificationWorkflowEvent,
    target: NotificationTarget
  ): Promise<NotificationMessage> {
    return {
      title: 'Cita Recibida',
      message: 'Hemos recibido tu solicitud de cita. Te notificaremos cuando sea confirmada.',
      category: 'appointments',
      metadata: {
        entityId: event.entityId,
        entityType: event.entityType
      }
    };
  }

  private async generateAppointmentAssignedMessage(
    event: NotificationWorkflowEvent,
    target: NotificationTarget
  ): Promise<NotificationMessage> {
    const isTechnician = target.userId === event.metadata?.technicianId;
    const technicianName = event.metadata?.technicianName || 'un técnico';

    return {
      title: isTechnician ? 'Nueva Cita Asignada' : 'Cita Confirmada',
      message: isTechnician ?
        `Se te ha asignado una nueva cita.` :
        `Tu cita ha sido confirmada con ${technicianName}.`,
      category: 'appointments',
      metadata: {
        entityId: event.entityId,
        entityType: event.entityType,
        technicianName
      }
    };
  }

  private async generateWorkOrderCompletedMessage(
    event: NotificationWorkflowEvent,
    target: NotificationTarget
  ): Promise<NotificationMessage> {
    return {
      title: '¡Servicio Completado!',
      message: 'Tu orden de trabajo ha sido completada. Ya puedes recoger tu vehículo.',
      category: 'service_orders',
      metadata: {
        entityId: event.entityId,
        entityType: event.entityType,
        status: 'completed'
      }
    };
  }

  private async generateQueueCalledMessage(
    event: NotificationWorkflowEvent,
    target: NotificationTarget
  ): Promise<NotificationMessage> {
    const isTechnician = target.userId === event.metadata?.technicianId;
    const qrCodeData = this.qrCodeService.generateQrCodeDataUrl('queue-entry', event.entityId);

    return {
      title: isTechnician ? 'Cliente Asignado' : '¡Es tu turno!',
      message: isTechnician ?
        `Se te ha asignado el cliente en la cola.` :
        `Tu turno en la cola ha sido llamado. Código: ${event.metadata?.verificationCode || 'N/A'}`,
      category: 'queue',
      metadata: {
        entityId: event.entityId,
        entityType: event.entityType,
        verificationCode: event.metadata?.verificationCode,
        position: event.metadata?.position
      },
      qrCodeData
    };
  }

  private async generateMaintenanceReminderMessage(
    event: NotificationWorkflowEvent,
    target: NotificationTarget
  ): Promise<NotificationMessage> {
    return {
      title: 'Recordatorio de Mantenimiento',
      message: `Es momento de programar mantenimiento para tu vehículo: ${event.metadata?.serviceName || 'servicio programado'}.`,
      category: 'maintenance_reminders',
      metadata: {
        entityId: event.entityId,
        entityType: event.entityType,
        serviceName: event.metadata?.serviceName,
        dueDate: event.metadata?.dueDate
      }
    };
  }

  private async generateInventoryAlertMessage(
    event: NotificationWorkflowEvent,
    target: NotificationTarget
  ): Promise<NotificationMessage> {
    const alertType = event.metadata?.alertType || 'low_stock';
    const productName = event.metadata?.productName || 'producto';

    let title = 'Alerta de Inventario';
    let message = `Alerta de inventario para ${productName}`;

    switch (alertType) {
      case 'out_of_stock':
        title = 'Producto Agotado';
        message = `El producto "${productName}" se ha agotado.`;
        break;
      case 'critical':
        title = 'Stock Crítico';
        message = `Stock crítico para "${productName}". Cantidad actual: ${event.metadata?.currentStock || 0}`;
        break;
      case 'low_stock':
        title = 'Stock Bajo';
        message = `Stock bajo para "${productName}". Cantidad actual: ${event.metadata?.currentStock || 0}`;
        break;
    }

    return {
      title,
      message,
      category: 'inventory',
      metadata: {
        entityId: event.entityId,
        entityType: event.entityType,
        alertType,
        productName,
        currentStock: event.metadata?.currentStock,
        minStock: event.metadata?.minStock
      }
    };
  }

  // ===== DELIVERY METHODS =====

  private async deliverInApp(notification: QueuedNotification): Promise<void> {
    // Use existing notification service to create in-app notification
    await this.notificationService.createCategorizedNotification(
      notification.message.category,
      notification.message.title,
      notification.message.message,
      {
        userId: notification.target.userId,
        priority: notification.target.priority,
        additionalMeta: {
          ...notification.message.metadata,
          workflowEventId: notification.workflowEventId,
          deliveredVia: 'in_app'
        }
      }
    );
  }

  private async deliverPush(notification: QueuedNotification): Promise<void> {
    // Use existing push notification functionality
    await this.notificationService.sendPushNotification(
      notification.target.userId,
      notification.message.title,
      notification.message.message,
      notification.message.metadata
    );
  }

  private async deliverEmail(notification: QueuedNotification): Promise<void> {
    // TODO: Implement email delivery service
    console.log('📧 Email delivery not yet implemented:', notification);
    // This would integrate with an email service like SendGrid, Mailgun, etc.
  }

  private async deliverSMS(notification: QueuedNotification): Promise<void> {
    // TODO: Implement SMS delivery service
    console.log('📱 SMS delivery not yet implemented:', notification);
    // This would integrate with an SMS service like Twilio, AWS SNS, etc.
  }

  // ===== UTILITY METHODS =====

  private getPreferenceKeyForEvent(target: NotificationTarget): string {
    // This would map target context to preference keys
    // For now, return a default
    return 'pushNotifications';
  }

  private async logWorkflowEvent(event: NotificationWorkflowEvent): Promise<string> {
    const docRef = await addDoc(collection(db, "notificationWorkflowEvents"), {
      ...event,
      loggedAt: serverTimestamp()
    });
    return docRef.id;
  }

  private async saveQueuedNotifications(notifications: QueuedNotification[]): Promise<void> {
    const batch = [];
    for (const notification of notifications) {
      const docRef = await addDoc(collection(db, "queuedNotifications"), {
        ...notification,
        createdAt: serverTimestamp()
      });
      notification.id = docRef.id;
    }
  }

  private async updateQueuedNotificationStatus(id: string, status: QueuedNotification['status']): Promise<void> {
    await updateDoc(doc(db, "queuedNotifications", id), {
      status,
      updatedAt: serverTimestamp()
    });
  }

  private async markAsSent(notification: QueuedNotification, channels: string[]): Promise<void> {
    await updateDoc(doc(db, "queuedNotifications", notification.id!), {
      status: 'sent',
      sentAt: serverTimestamp(),
      deliveredChannels: channels,
      updatedAt: serverTimestamp()
    });

    // Update local queue
    const currentQueue = this.workflowQueue.value;
    const updatedQueue = currentQueue.map(n =>
      n.id === notification.id ? { ...n, status: 'sent' as const, deliveredChannels: channels } : n
    );
    this.workflowQueue.next(updatedQueue);
  }

  private async markAsFailed(notification: QueuedNotification, errorMessage: string): Promise<void> {
    await updateDoc(doc(db, "queuedNotifications", notification.id!), {
      status: 'failed',
      errorMessage,
      updatedAt: serverTimestamp()
    });

    // Update local queue
    const currentQueue = this.workflowQueue.value;
    const updatedQueue = currentQueue.map(n =>
      n.id === notification.id ? { ...n, status: 'failed' as const, errorMessage } : n
    );
    this.workflowQueue.next(updatedQueue);
  }

  private async handleDeliveryFailure(notification: QueuedNotification, error: Error): Promise<void> {
    notification.retryCount++;

    if (notification.retryCount < notification.maxRetries) {
      // Reset status to queued for retry
      await this.updateQueuedNotificationStatus(notification.id!, 'queued');
      const currentQueue = this.workflowQueue.value;
      const updatedQueue = currentQueue.map(n =>
        n.id === notification.id ? { ...n, status: 'queued' as const, retryCount: notification.retryCount } : n
      );
      this.workflowQueue.next(updatedQueue);
    } else {
      await this.markAsFailed(notification, `Max retries exceeded: ${error.message}`);
    }
  }

  private setupEventListeners(): void {
    // Listen to event bus for relevant events
    this.eventBus.events$.subscribe(event => {
      this.handleEventBusEvent(event);
    });
  }

  private async handleEventBusEvent(event: NotificationEvent): Promise<void> {
    // Convert event bus events to workflow events
    const workflowEvent = this.convertToWorkflowEvent(event);
    if (workflowEvent) {
      await this.processEvent(workflowEvent);
    }
  }

  private convertToWorkflowEvent(event: NotificationEvent): NotificationWorkflowEvent | null {
    switch (event.type) {
      case 'appointment.created':
        return {
          type: 'appointment_created',
          entityId: event.entity.id,
          entityType: 'appointment',
          metadata: { customerId: event.entity.clientId },
          timestamp: new Date()
        };
      case 'appointment.assigned':
        return {
          type: 'appointment_assigned',
          entityId: event.entity.id,
          entityType: 'appointment',
          metadata: {
            customerId: event.entity.clientId,
            technicianId: event.entity.assignedTo
          },
          timestamp: new Date()
        };
      case 'work_order.status_changed':
        return {
          type: event.entity.status === 'ready_for_pickup' ? 'work_order_completed' : 'status_change',
          entityId: event.entity.id,
          entityType: 'work_order',
          metadata: {
            customerId: event.entity.clientId,
            status: event.entity.status
          },
          timestamp: new Date()
        };
      case 'queue.called':
        return {
          type: 'queue_called',
          entityId: event.entity.id,
          entityType: 'queue_entry',
          metadata: {
            customerId: event.entity.customerId,
            technicianName: event.technicianName,
            verificationCode: event.entity.verificationCode,
            position: event.entity.position
          },
          timestamp: new Date()
        };
      default:
        return null;
    }
  }

  // Public methods for manual triggering
  async triggerAssignmentNotification(assignmentData: {
    entityId: string;
    entityType: 'appointment' | 'work_order';
    technicianId: string;
    customerId?: string;
  }): Promise<void> {
    await this.processEvent({
      type: 'assignment',
      entityId: assignmentData.entityId,
      entityType: assignmentData.entityType,
      metadata: assignmentData,
      timestamp: new Date()
    });
  }

  async triggerStatusChangeNotification(statusData: {
    entityId: string;
    entityType: 'appointment' | 'work_order';
    customerId: string;
    status: string;
  }): Promise<void> {
    await this.processEvent({
      type: 'status_change',
      entityId: statusData.entityId,
      entityType: statusData.entityType,
      metadata: statusData,
      timestamp: new Date()
    });
  }

  async triggerMaintenanceReminder(reminderData: {
    entityId: string;
    customerId: string;
    serviceName: string;
    dueDate?: Date;
  }): Promise<void> {
    await this.processEvent({
      type: 'maintenance_reminder',
      entityId: reminderData.entityId,
      entityType: 'vehicle',
      metadata: reminderData,
      timestamp: new Date()
    });
  }

  async triggerInventoryAlert(alertData: {
    entityId: string;
    productName: string;
    alertType: 'low_stock' | 'out_of_stock' | 'critical';
    currentStock: number;
    minStock: number;
  }): Promise<void> {
    await this.processEvent({
      type: 'inventory_alert',
      entityId: alertData.entityId,
      entityType: 'inventory_item',
      metadata: alertData,
      timestamp: new Date()
    });
  }

  // Get queue status for monitoring
  getQueuedNotifications(): Observable<QueuedNotification[]> {
    return this.workflowQueue.asObservable();
  }

  // Get workflow events for auditing
  async getWorkflowEvents(limit: number = 50): Promise<any[]> {
    const q = query(
      collection(db, "notificationWorkflowEvents"),
      orderBy('loggedAt', 'desc'),
      firestoreLimit(limit)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}