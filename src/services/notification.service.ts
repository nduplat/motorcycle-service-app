/**
 * Notification Service - Servicio de Notificaciones
 *
 * Comprehensive notification management system for Blue Dragon Motors workshop.
 * Sistema integral de gestión de notificaciones para el taller de motocicletas Blue Dragon Motors.
 *
 * Features / Características:
 * - Real-time notifications / Notificaciones en tiempo real
 * - Categorized notifications / Notificaciones categorizadas
 * - Automated notifications / Notificaciones automatizadas
 * - Template-based notifications / Notificaciones basadas en plantillas
 * - Push notifications / Notificaciones push
 * - Sound and vibration alerts / Alertas de sonido y vibración
 * - User preferences management / Gestión de preferencias de usuario
 * - Maintenance reminders / Recordatorios de mantenimiento
 * - Inventory alerts / Alertas de inventario
 * - Queue notifications / Notificaciones de cola
 * - Appointment reminders / Recordatorios de citas
 *
 * This service consolidates functionality from:
 * Este servicio consolida funcionalidad de:
 * - notification.service.ts (main/base functionality)
 * - automated-notification.service.ts (automated notifications)
 * - notification-manager.service.ts (event-driven notifications)
 * - notification-template.service.ts (template management)
 * - low-stock-notification.service.ts (inventory alerts)
 * - maintenance-notification.service.ts (maintenance reminders)
 */

import { Injectable, signal, OnDestroy, inject } from '@angular/core';
import { Notification as NotificationModel, MaintenanceReminder, NotificationPreferences, UserVehicle, Appointment, NotificationTemplate, WorkOrder, QueueEntry, UserProfile } from '../models';
import { Timestamp } from 'firebase/firestore';
import { of, delay, Observable, from, combineLatest } from 'rxjs';
import { db } from '../firebase.config';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where, DocumentData, DocumentSnapshot, onSnapshot, writeBatch } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { UserService } from './user.service';
import { UserVehicleService } from './user-vehicle.service';
import { WorkOrderService } from './work-order.service';
import { AppointmentService } from './appointment.service';
import { QueueService } from './queue.service';
import { EventBusService, NotificationEvent, MaintenanceReminderEvent } from './event-bus.service';
import { QrCodeService } from './qr-code.service';

export type NotificationCategory =
  | 'inventory'           // Stock alerts, low stock, out of stock / Alertas de stock, stock bajo, agotado
  | 'service_orders'      // Work order updates, status changes / Actualizaciones de órdenes de servicio, cambios de estado
  | 'appointments'        // Appointment reminders, scheduling / Recordatorios de citas, programación
  | 'queue'              // Queue status, position updates / Estado de cola, actualizaciones de posición
  | 'marketing'          // Promotions, offers, newsletters / Promociones, ofertas, boletines
  | 'users'              // User account updates, registrations / Actualizaciones de cuenta de usuario, registros
  | 'maintenance_reminders'; // Service reminders, maintenance alerts / Recordatorios de servicio, alertas de mantenimiento

interface NotificationData {
  userId?: string;
  title: string;
  message: string;
  meta?: Record<string, any>;
}

interface Promotion {
  title?: string;
  message?: string;
}

interface FirebaseNotification {
  title?: string;
  body?: string;
  userId?: string;
}



const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
    const data = snapshot.data() as any;
    return { ...data, id: snapshot.id } as T;
};

const toTimestamp = (date: Date): Timestamp => Timestamp.fromDate(date);

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private systemNotifications = signal<NotificationModel[]>([]);
  private maintenanceReminders = signal<MaintenanceReminder[]>([]);
  private templates = signal<NotificationTemplate[]>([]);
  private notificationsUnsubscribe: (() => void) | null = null;
  private remindersUnsubscribe: (() => void) | null = null;
  private templatesUnsubscribe: (() => void) | null = null;
  private preferencesCache = new Map<string, { preferences: NotificationPreferences; timestamp: number }>();
  private readonly PREFERENCES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private userService = inject(UserService);
  private userVehicleService = inject(UserVehicleService);
  private workOrderService = inject(WorkOrderService);
  private appointmentService = inject(AppointmentService);
  private queueService = inject(QueueService);
  private eventBus = inject(EventBusService);
  private qrCodeService = inject(QrCodeService);


  private setupRealtimeListeners() {
    let notificationsThrottle: NodeJS.Timeout | null = null;
    let remindersThrottle: NodeJS.Timeout | null = null;

    // Real-time listener for system notifications with throttling
    this.notificationsUnsubscribe = onSnapshot(
      collection(db, "notifications"),
      (querySnapshot) => {
        // Throttle updates to prevent excessive re-renders
        if (notificationsThrottle) return;

        notificationsThrottle = setTimeout(() => {
          const notifications = querySnapshot.docs.map(doc => fromFirestore<NotificationModel>(doc));
          this.systemNotifications.set(notifications);
          notificationsThrottle = null;
        }, 500); // Update at most every 500ms
      },
      (error) => {
        // Only log permission errors in development, ignore in production
        if (error.code !== 'permission-denied') {
          console.error("Error listening to notifications:", error);
        }
      }
    );

    // Real-time listener for maintenance reminders with throttling
    this.remindersUnsubscribe = onSnapshot(
      collection(db, "maintenanceReminders"),
      (querySnapshot) => {
        // Throttle updates to prevent excessive re-renders
        if (remindersThrottle) return;

        remindersThrottle = setTimeout(() => {
          const reminders = querySnapshot.docs.map(doc => fromFirestore<MaintenanceReminder>(doc));
          this.maintenanceReminders.set(reminders);
          remindersThrottle = null;
        }, 500); // Update at most every 500ms
      },
      (error) => {
        // Only log permission errors in development, ignore in production
        if (error.code !== 'permission-denied') {
          console.error("Error listening to maintenance reminders:", error);
        }
      }
    );

    // Real-time listener for notification templates
    this.templatesUnsubscribe = onSnapshot(
      collection(db, "notificationTemplates"),
      (querySnapshot) => {
        const templates = querySnapshot.docs.map(doc => fromFirestore<NotificationTemplate>(doc));
        this.templates.set(templates);
      },
      (error) => {
        console.error("Error listening to notification templates:", error);
      }
    );
  }

  ngOnDestroy() {
    // Clean up listeners when service is destroyed
    if (this.notificationsUnsubscribe) {
      this.notificationsUnsubscribe();
    }
    if (this.remindersUnsubscribe) {
      this.remindersUnsubscribe();
    }
  }

  getSystemNotifications() {
    return this.systemNotifications.asReadonly();
  }

  getMaintenanceReminders() {
    return this.maintenanceReminders.asReadonly();
  }

  addSystemNotification(notification: Omit<NotificationModel, 'id' | 'createdAt' | 'read'>): Observable<NotificationModel> {
    return from(new Promise<NotificationModel>(async (resolve, reject) => {
        try {
            // Validate notification data
            if (!notification.title || !notification.title.trim()) {
                throw new Error('Notification title is required');
            }

            const newNotificationData = {
                ...notification,
                read: false,
                createdAt: serverTimestamp(),
            };

            const docRef = await addDoc(collection(db, "notifications"), newNotificationData);

            const createdNotification: NotificationModel = {
                ...notification,
                id: docRef.id,
                read: false,
                createdAt: toTimestamp(new Date()),
            };

            this.systemNotifications.update(notifications => [createdNotification, ...notifications]);

            // Show browser notification if permission granted
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification(createdNotification.title, {
                        body: createdNotification.message,
                        icon: '/assets/logo.PNG', // Add icon if available
                        tag: `notification-${docRef.id}` // Prevent duplicate notifications
                    });
                } catch (browserError) {
                    console.warn('Browser notification failed:', browserError);
                }
            }

            resolve(createdNotification);
        } catch(error: any) {
            console.error('Error creating notification:', error);
            reject(new Error(`Failed to create notification: ${error.message || 'Unknown error'}`));
        }
    }));
  }
  
  markAsRead(id: string): Observable<boolean> {
      return from(new Promise<boolean>(async (resolve, reject) => {
          try {
            if (!id || typeof id !== 'string') {
                throw new Error('Invalid notification ID');
            }

            const docRef = doc(db, "notifications", id);
            await updateDoc(docRef, { read: true });

            this.systemNotifications.update(notifications =>
                notifications.map(n => n.id === id ? { ...n, read: true } : n)
            );

            resolve(true);
          } catch (error: any) {
            console.error('Error marking notification as read:', error);
            reject(new Error(`Failed to mark notification as read: ${error.message || 'Unknown error'}`));
          }
      }));
  }

  markAllAsRead(userId: string): Observable<boolean> {
    return from(new Promise<boolean>(async (resolve, reject) => {
      try {
        // Get all unread notifications for this user
        const userNotifications = this.systemNotifications().filter(n => n.userId === userId && !n.read);

        if (userNotifications.length === 0) {
          resolve(true);
          return;
        }

        // Update each notification in Firestore
        const updatePromises = userNotifications.map(notification => {
          const docRef = doc(db, "notifications", notification.id);
          return updateDoc(docRef, { read: true });
        });

        await Promise.all(updatePromises);

        // Update local state
        this.systemNotifications.update(notifications =>
          notifications.map(n => n.userId === userId ? { ...n, read: true } : n)
        );

        resolve(true);
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
        reject(error);
      }
    }));
  }

  requestPermission(): Promise<NotificationPermission> {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        Notification.requestPermission().then(permission => {
          resolve(permission);
        });
      } else {
        resolve('denied');
      }
    });
  }

  // Request all necessary permissions for loud notifications
  async requestAllPermissions(): Promise<{ notifications: NotificationPermission; vibration: boolean }> {
    const notifications = await this.requestPermission();

    // Vibration permission check (no actual permission needed, just capability)
    const vibration = typeof navigator !== 'undefined' && 'vibrate' in navigator;

    return { notifications, vibration };
  }

  getNotificationsForUser(userId: string): NotificationModel[] {
    return this.systemNotifications().filter(n => n.userId === userId);
  }

  // Get recent notifications (last 50 for performance)
  getRecentNotifications(limit: number = 50): NotificationModel[] {
    return this.systemNotifications()
      .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())
      .slice(0, limit);
  }

  // Get unread count for a user
  getUnreadCount(userId?: string): number {
    if (userId) {
      return this.systemNotifications().filter(n => n.userId === userId && !n.read).length;
    }
    return this.systemNotifications().filter(n => !n.read).length;
  }

  // Clean up old notifications (older than 90 days)
  async cleanupOldNotifications(): Promise<void> {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // Get all notifications from Firestore
      const querySnapshot = await getDocs(collection(db, "notifications"));
      const oldNotifications = querySnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.createdAt?.toDate() < ninetyDaysAgo;
      });

      // Delete old notifications in batches
      const batchSize = 10;
      for (let i = 0; i < oldNotifications.length; i += batchSize) {
        const batch = oldNotifications.slice(i, i + batchSize);
        // Note: In a real implementation, you'd use Firestore batch writes
        // For now, we'll just log what would be deleted
        console.log(`Would delete ${batch.length} old notifications`);
      }

      // Update local state to remove old notifications
      this.systemNotifications.update(notifications =>
        notifications.filter(n => n.createdAt.toDate() >= ninetyDaysAgo)
      );

    } catch (error: any) {
      // Only log non-permission errors
      if (error.code !== 'permission-denied') {
        console.error('Error cleaning up old notifications:', error);
      }
    }
  }

  // Notification preferences management
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    // Check cache first
    const cached = this.preferencesCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < this.PREFERENCES_CACHE_TTL) {
      return cached.preferences;
    }

    try {
      const docRef = doc(db, "notificationPreferences", userId);
      const docSnap = await getDoc(docRef);

      let preferences: NotificationPreferences;
      if (docSnap.exists()) {
        preferences = fromFirestore<NotificationPreferences>(docSnap);
      } else {
        // Return default preferences if none exist
        preferences = this.getDefaultPreferences(userId);
      }

      // Cache the preferences
      this.preferencesCache.set(userId, { preferences, timestamp: Date.now() });

      return preferences;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      const defaultPrefs = this.getDefaultPreferences(userId);
      // Cache default preferences on error
      this.preferencesCache.set(userId, { preferences: defaultPrefs, timestamp: Date.now() });
      return defaultPrefs;
    }
  }

  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
      const docRef = doc(db, "notificationPreferences", userId);
      const existingPrefs = await this.getUserPreferences(userId) || this.getDefaultPreferences(userId);

      const updateData = {
        ...preferences,
        updatedAt: serverTimestamp()
      };

      await updateDoc(docRef, updateData);

      // Invalidate cache
      this.preferencesCache.delete(userId);

      // Return updated preferences with proper timestamp
      return {
        ...existingPrefs,
        ...preferences,
        updatedAt: { toDate: () => new Date() } as Timestamp
      };
    } catch (error) {
      console.error('Error updating user preferences:', error);
      // Invalidate cache on error too
      this.preferencesCache.delete(userId);
      throw error;
    }
  }

  private getDefaultPreferences(userId: string): NotificationPreferences {
    return {
      id: userId,
      userId,
      emailNotifications: true,
      pushNotifications: true,
      smsNotifications: false,
      // Category-specific preferences
      inventoryAlerts: false, // Only for admins/managers
      serviceOrderUpdates: true,
      appointmentReminders: true,
      queueNotifications: true,
      marketingNotifications: false,
      userNotifications: true,
      maintenanceReminders: true,
      soundEnabled: true, // Enable loud beep by default
      vibrationEnabled: true, // Enable vibration by default
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      },
      createdAt: { toDate: () => new Date() } as Timestamp,
      updatedAt: { toDate: () => new Date() } as Timestamp
    };
  }

  // Check if notification should be sent based on user preferences
  async shouldSendNotification(userId: string, notificationType: keyof NotificationPreferences): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId);
      if (!preferences) return true; // Default to sending if no preferences

      // Check if the notification type is enabled
      if (notificationType in preferences && typeof preferences[notificationType] === 'boolean') {
        if (!preferences[notificationType as keyof NotificationPreferences]) {
          return false;
        }
      }

      // Check quiet hours
      if (preferences.quietHours.enabled) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [startHour, startMinute] = preferences.quietHours.start.split(':').map(Number);
        const [endHour, endMinute] = preferences.quietHours.end.split(':').map(Number);
        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;

        if (startTime <= endTime) {
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

      return true;
    } catch (error) {
      console.error('Error checking notification preferences:', error);
      return true; // Default to sending on error
    }
  }

  // Push notification management (Firebase Cloud Messaging)
  private messaging: Messaging | null = null;

  async initializePushNotifications(): Promise<void> {
     try {
       // Initialize push notifications in production environments
       const isLocalhost = typeof window !== 'undefined' &&
         (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

       // Enable push notifications for production or when explicitly configured
       const enablePushNotifications = !isLocalhost || (typeof window !== 'undefined' && (window as any).FIREBASE_PUSH_ENABLED === 'true');

       if (!enablePushNotifications) {
         console.log('🔍 [DEBUG] Push notifications disabled (localhost without explicit enable)');
         return;
       }

      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        this.messaging = getMessaging();

        // Register service worker for FCM
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registered:', registration);

        // Handle incoming messages
        onMessage(this.messaging, (payload) => {
          console.log('Message received:', payload);
          // Handle foreground messages
          if (payload.notification) {
            this.showLocalNotification(payload.notification);
          }
        });
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  async requestPushPermission(userId: string): Promise<string | null> {
    try {
      if (!this.messaging) {
        await this.initializePushNotifications();
      }

      if (!this.messaging) {
        throw new Error('Messaging not available');
      }

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(this.messaging, {
          vapidKey: 'YOUR_VAPID_KEY_HERE' // This should be configured in Firebase
        });

        // Store the token for the user
        await this.storeFCMToken(userId, token);

        return token;
      } else {
        console.warn('Push notification permission denied');
        return null;
      }
    } catch (error) {
      console.error('Error requesting push permission:', error);
      return null;
    }
  }

  private async storeFCMToken(userId: string, token: string): Promise<void> {
    try {
      const docRef = doc(db, "userFCMTokens", userId);
      await updateDoc(docRef, {
        token,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error storing FCM token:', error);
    }
  }

  private showLocalNotification(notification: FirebaseNotification): void {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title || 'Nueva Notificación', {
        body: notification.body,
        icon: '/assets/logo.PNG',
        badge: '/assets/logo.PNG'
      });

      // Play sound and vibration when browser notification is shown
      // We need to get the userId somehow - this might be called from different contexts
      // For now, we'll try to play alerts if we can determine it's for a user notification
      if (notification.userId) {
        this.playLoudBeep(notification.userId).catch(() => {});
        this.vibrateIntensely(notification.userId).catch(() => {});
      }
    }
  }

  // Play loud continuous beep sound like restaurant pagers
  private async playLoudBeep(userId: string): Promise<void> {
    console.log('🔊 playLoudBeep called for user:', userId);
    try {
      // Only play sound if this is running on the user's device (not admin creating notification)
      // For now, we'll assume this is called from the client side
      const preferences = await this.getUserPreferences(userId);
      console.log('🔊 User preferences loaded:', preferences);
      if (!preferences?.soundEnabled) {
        console.log('🔊 Sound disabled in preferences');
        return;
      }

      if (typeof window !== 'undefined') {
        console.log('🔊 Window available, checking AudioContext...');
        // Try Web Audio API first (works on most modern browsers)
        if ('AudioContext' in window || 'webkitAudioContext' in window) {
          console.log('🔊 Using Web Audio API');
          await this.playWebAudioBeep();
          console.log('🔊 Web Audio beep completed');
        } else {
          console.log('🔊 Web Audio API not available, using fallback');
          // Fallback: try HTML5 Audio with a data URL beep
          await this.playFallbackBeep();
          console.log('🔊 Fallback beep completed');
        }
      } else {
        console.log('🔊 Window not available');
      }
    } catch (error) {
      console.error('🔊 Audio playback failed:', error);
    }
  }

  // Web Audio API implementation
  private async playWebAudioBeep(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Resume context if suspended (required by autoplay policies)
        if (audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            this.createAndPlayBeep(audioContext, resolve);
          });
        } else {
          this.createAndPlayBeep(audioContext, resolve);
        }
      } catch (error) {
        console.warn('Web Audio failed, trying fallback:', error);
        resolve();
      }
    });
  }

  private createAndPlayBeep(audioContext: AudioContext, resolve: () => void): void {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // High-pitched beep like pagers (800 Hz)
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.type = 'square'; // Harsh sound

    // Loud volume (80%)
    gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);

    // Create pulsing effect for more pager-like sound
    const now = audioContext.currentTime;
    for (let i = 0; i < 4; i++) {
      const startTime = now + i * 0.5;
      const endTime = startTime + 0.3;
      gainNode.gain.setValueAtTime(0.8, startTime);
      gainNode.gain.setValueAtTime(0, endTime);
    }

    oscillator.start(now);
    oscillator.stop(now + 2); // 2 seconds total

    oscillator.onended = () => resolve();
  }

  // Fallback beep using Audio element with data URL
  private async playFallbackBeep(): Promise<void> {
    return new Promise((resolve) => {
      try {
        // Create a simple beep sound as data URL (440Hz sine wave)
        const sampleRate = 44100;
        const duration = 2; // 2 seconds
        const frequency = 800; // 800Hz
        const samples = sampleRate * duration;
        const buffer = new ArrayBuffer(44 + samples * 2);
        const view = new DataView(buffer);

        // WAV header
        const writeString = (offset: number, string: string) => {
          for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
          }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + samples * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, samples * 2, true);

        // Generate beep samples
        for (let i = 0; i < samples; i++) {
          const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.8;
          view.setInt16(44 + i * 2, sample * 32767, true);
        }

        const blob = new Blob([buffer], { type: 'audio/wav' });
        const audio = new Audio(URL.createObjectURL(blob));
        audio.volume = 0.8;

        audio.onended = () => {
          URL.revokeObjectURL(audio.src);
          resolve();
        };

        audio.play().catch(() => resolve());
      } catch (error) {
        console.warn('Fallback audio failed:', error);
        resolve();
      }
    });
  }

  // Strong vibration pattern like restaurant pagers
  private async vibrateIntensely(userId: string): Promise<void> {
    console.log('📳 vibrateIntensely called for user:', userId);
    try {
      const preferences = await this.getUserPreferences(userId);
      console.log('📳 Vibration preferences loaded:', preferences?.vibrationEnabled);
      if (!preferences?.vibrationEnabled) {
        console.log('📳 Vibration disabled in preferences');
        return;
      }

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        console.log('📳 Vibration API available, vibrating...');
        // More intense pattern for mobile: longer vibrations, shorter pauses
        // Pattern: vibrate 600ms, pause 150ms, repeat 6 times for ~5 seconds total
        const pattern = [600, 150, 600, 150, 600, 150, 600, 150, 600, 150, 600];

        // Check if vibration is supported and not blocked
        const result = navigator.vibrate(pattern);
        console.log('📳 Vibration result:', result, 'pattern length:', pattern.length);
        if (result === false) {
          console.warn('📳 Vibration not supported or blocked');
        } else {
          console.log('📳 Vibration started successfully');
        }
      } else {
        console.warn('📳 Vibration API not available');
      }
    } catch (error) {
      console.error('📳 Vibration failed:', error);
    }
  }

  // Initialize audio context on user interaction (call this on app startup or user interaction)
  async initializeAudio(): Promise<void> {
    if (typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window)) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        console.log('Audio context initialized');
      } catch (error) {
        console.warn('Failed to initialize audio context:', error);
      }
    }
  }

  // Public method to trigger sound and vibration for a notification (call this from components)
  async playNotificationAlert(userId: string): Promise<void> {
    try {
      await Promise.all([
        this.playLoudBeep(userId),
        this.vibrateIntensely(userId)
      ]);
    } catch (error) {
      console.warn('Failed to play notification alert:', error);
    }
  }

  // Check if notification should have loud sound and vibration
  private shouldPlayLoudNotification(notification: NotificationModel): boolean {
    // All employee notifications
    if (!notification.userId) return false; // Broadcast notifications don't target users

    const meta = notification.meta || {};
    const category = meta.category as NotificationCategory;

    // Critical priority notifications always play loud
    if (meta.priority === 'critical') return true;

    // Category-specific loud notifications
    switch (category) {
      case 'maintenance_reminders':
        return true; // Maintenance reminders are critical
      case 'queue':
        return true; // Queue notifications need immediate attention
      case 'appointments':
        return true; // Appointment reminders
      case 'inventory':
        return meta.priority === 'high'; // Only high priority inventory alerts
      case 'service_orders':
        return meta.priority === 'high'; // Only high priority service order updates
      default:
        return false;
    }
  }

  // Create categorized notification
  async createCategorizedNotification(
    category: NotificationCategory,
    title: string,
    message: string,
    options: {
      userId?: string;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      requiresSound?: boolean;
      requiresVibration?: boolean;
      targetAudience?: 'all' | 'admins' | 'technicians' | 'customers' | 'specific_user';
      additionalMeta?: Record<string, any>;
    } = {}
  ): Promise<NotificationModel[]> {
    const {
      userId,
      priority = 'medium',
      requiresSound,
      requiresVibration,
      targetAudience = 'specific_user',
      additionalMeta = {}
    } = options;

    const notifications: NotificationModel[] = [];
    const meta = {
      category,
      priority,
      requiresSound: requiresSound ?? this.shouldPlayLoudNotification({ title, message, meta: { category, priority } } as any),
      requiresVibration: requiresVibration ?? this.shouldPlayLoudNotification({ title, message, meta: { category, priority } } as any),
      targetAudience,
      ...additionalMeta
    };

    // Check user preferences before sending
    if (userId) {
      const shouldSend = await this.shouldSendNotification(userId, this.getPreferenceKeyForCategory(category));
      if (!shouldSend) {
        console.log(`Notification blocked by user preferences: ${category} for user ${userId}`);
        return [];
      }
    }

    // Create notification based on target audience
    if (targetAudience === 'all') {
      // Broadcast notification
      const notification = await this.addSystemNotification({
        title,
        message,
        userId: undefined, // Broadcast
        meta
      }).toPromise();
      if (notification) notifications.push(notification);
    } else if (targetAudience === 'admins') {
      // Send to all admin users (this would need user service integration)
      // For now, broadcast to admins
      const notification = await this.addSystemNotification({
        title: `[ADMIN] ${title}`,
        message,
        userId: undefined, // Broadcast to admins
        meta: { ...meta, adminOnly: true }
      }).toPromise();
      if (notification) notifications.push(notification);
    } else if (userId) {
      // Send to specific user
      const notification = await this.addSystemNotification({
        title,
        message,
        userId,
        meta
      }).toPromise();
      if (notification) notifications.push(notification);
    }

    return notifications;
  }

  // Helper method to map categories to preference keys
  private getPreferenceKeyForCategory(category: NotificationCategory): keyof NotificationPreferences {
    switch (category) {
      case 'inventory': return 'inventoryAlerts';
      case 'service_orders': return 'serviceOrderUpdates';
      case 'appointments': return 'appointmentReminders';
      case 'queue': return 'queueNotifications';
      case 'marketing': return 'marketingNotifications';
      case 'users': return 'userNotifications';
      case 'maintenance_reminders': return 'maintenanceReminders';
      default: return 'pushNotifications'; // Fallback
    }
  }

  // Create maintenance reminder notification
  async createMaintenanceReminder(
    customerId: string,
    vehicleInfo: { brand: string; model: string; year: number; plate?: string },
    serviceName: string,
    dueInfo: { dueDate?: Date; dueMileage?: number; currentMileage?: number },
    priority: 'critical' | 'recommended' | 'optional' = 'recommended'
  ): Promise<NotificationModel[]> {
    const vehicleDesc = `${vehicleInfo.brand} ${vehicleInfo.model} ${vehicleInfo.year}${vehicleInfo.plate ? ` (${vehicleInfo.plate})` : ''}`;

    let title = 'Recordatorio de Mantenimiento';
    let message = `Es momento de programar el mantenimiento "${serviceName}" para tu ${vehicleDesc}.`;

    if (dueInfo.dueDate) {
      const daysUntilDue = Math.ceil((dueInfo.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue <= 0) {
        title = '¡Mantenimiento Vencido!';
        message = `El mantenimiento "${serviceName}" de tu ${vehicleDesc} está vencido. Te recomendamos programar una cita lo antes posible.`;
      } else if (daysUntilDue <= 7) {
        title = 'Mantenimiento Próximo';
        message = `El mantenimiento "${serviceName}" de tu ${vehicleDesc} vence en ${daysUntilDue} día(s).`;
      }
    }

    if (dueInfo.dueMileage && dueInfo.currentMileage) {
      const mileageDiff = dueInfo.dueMileage - dueInfo.currentMileage;
      if (mileageDiff <= 0) {
        message += ` Has superado los ${Math.abs(mileageDiff)} km recomendados para este servicio.`;
      } else if (mileageDiff <= 1000) {
        message += ` Te quedan aproximadamente ${mileageDiff} km para este servicio.`;
      }
    }

    return this.createCategorizedNotification(
      'maintenance_reminders',
      title,
      message,
      {
        userId: customerId,
        priority: priority === 'critical' ? 'critical' : priority === 'recommended' ? 'high' : 'medium',
        targetAudience: 'specific_user',
        additionalMeta: {
          vehicleInfo,
          serviceName,
          dueInfo,
          maintenanceType: 'scheduled'
        }
      }
    );
  }

  // Create queue notification
  async createQueueNotification(
    customerId: string,
    queueInfo: { position: number; estimatedWaitTime?: number; ticketNumber?: string },
    status: 'joined' | 'called' | 'ready' | 'delayed'
  ): Promise<NotificationModel[]> {
    let title = 'Actualización de Cola';
    let message = '';

    switch (status) {
      case 'joined':
        title = '¡Te has unido a la cola!';
        message = `Estás en la posición ${queueInfo.position} de la cola.${queueInfo.estimatedWaitTime ? ` Tiempo estimado de espera: ${queueInfo.estimatedWaitTime} minutos.` : ''}${queueInfo.ticketNumber ? ` Tu número de ticket es: ${queueInfo.ticketNumber}` : ''}`;
        break;
      case 'called':
        title = '¡Es tu turno!';
        message = `Tu turno ha llegado. Por favor dirígete al área de servicio. Posición: ${queueInfo.position}`;
        break;
      case 'ready':
        title = 'Tu servicio está listo';
        message = 'Tu motocicleta está lista para ser recogida. Por favor acércate a recepción.';
        break;
      case 'delayed':
        title = 'Demora en la cola';
        message = `Hay una demora en el servicio. Tu posición actual es ${queueInfo.position}.${queueInfo.estimatedWaitTime ? ` Nuevo tiempo estimado: ${queueInfo.estimatedWaitTime} minutos.` : ''}`;
        break;
    }

    return this.createCategorizedNotification(
      'queue',
      title,
      message,
      {
        userId: customerId,
        priority: status === 'called' ? 'critical' : 'high',
        targetAudience: 'specific_user',
        additionalMeta: {
          queueInfo,
          status,
          notificationType: 'queue_update'
        }
      }
    );
  }


  // Send push notification via FCM (would typically be done server-side)
  async sendPushNotification(userId: string, title: string, body: string, data?: any): Promise<void> {
    try {
      // Get user's FCM token
      const tokenDoc = await getDoc(doc(db, "userFCMTokens", userId));
      if (!tokenDoc.exists()) {
        console.warn('No FCM token found for user:', userId);
        return;
      }

      const token = tokenDoc.data()?.token;
      if (!token) {
        console.warn('Invalid FCM token for user:', userId);
        return;
      }

      // In a real implementation, this would be sent via Firebase Admin SDK
      // For now, we'll just log it
      console.log('Would send push notification:', { token, title, body, data });

    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // Send templated notification to multiple users
  sendBulkTemplatedNotification(
    templateId: string,
    parameters: Record<string, any>,
    userIds: string[]
  ): Observable<NotificationModel[]> {
    return from(new Promise<NotificationModel[]>(async (resolve, reject) => {
      try {
        // Get template first
        const template = this.templates().find(t => t.id === templateId);
        if (!template) {
          throw new Error('Template not found');
        }

        // Render template with parameters
        const rendered = this.renderTemplate(template, parameters);

        const batch = writeBatch(db);
        const notifications: NotificationModel[] = [];

        for (const userId of userIds) {
          const docRef = doc(collection(db, "notifications"));
          const notificationData = {
            title: rendered.title,
            message: rendered.message,
            userId,
            read: false,
            createdAt: serverTimestamp(),
            meta: {
              templateId,
              generatedBy: 'bulk_template',
              parameters
            }
          };

          batch.set(docRef, notificationData);

          const notification: NotificationModel = {
            ...notificationData,
            id: docRef.id,
            createdAt: toTimestamp(new Date()),
          };

          notifications.push(notification);
        }

        await batch.commit();

        // Update local state
        this.systemNotifications.update(current => [...current, ...notifications]);

        resolve(notifications);
      } catch (error: any) {
        console.error('Error sending bulk templated notification:', error);
        reject(new Error(`Failed to send bulk templated notification: ${error.message || 'Unknown error'}`));
      }
    }));
  }

  // Send notification to multiple users
  sendBulkNotification(
    notification: Omit<NotificationModel, 'id' | 'createdAt' | 'read'>,
    userIds: string[]
  ): Observable<NotificationModel[]> {
    return from(new Promise<NotificationModel[]>(async (resolve, reject) => {
      try {
        const batch = writeBatch(db);
        const notifications: NotificationModel[] = [];

        for (const userId of userIds) {
          const docRef = doc(collection(db, "notifications"));
          const notificationData = {
            ...notification,
            userId,
            read: false,
            createdAt: serverTimestamp(),
          };

          batch.set(docRef, notificationData);

          const createdNotification: NotificationModel = {
            ...notificationData,
            id: docRef.id,
            createdAt: toTimestamp(new Date()),
          };

          notifications.push(createdNotification);
        }

        await batch.commit();

        // Update local state
        this.systemNotifications.update(current => [...current, ...notifications]);

        resolve(notifications);
      } catch (error: any) {
        console.error('Error sending bulk notification:', error);
        reject(new Error(`Failed to send bulk notification: ${error.message || 'Unknown error'}`));
      }
    }));
  }

  // Send notification using a template
  sendTemplatedNotification(
    templateId: string,
    parameters: Record<string, any>,
    targetUserId?: string // undefined = broadcast to all
  ): Observable<NotificationModel> {
    return from(new Promise<NotificationModel>(async (resolve, reject) => {
      try {
        // Get template
        const template = this.templates().find(t => t.id === templateId);

        if (!template) {
          throw new Error('Template not found');
        }

        // Render template with parameters
        const rendered = this.renderTemplate(template, parameters);

        // Create notification with template metadata
        const notification = await this.addSystemNotification({
          title: rendered.title,
          message: rendered.message,
          userId: targetUserId,
          meta: {
            templateId,
            generatedBy: 'template',
            parameters
          }
        }).toPromise();

        if (notification) {
          resolve(notification);
        } else {
          reject(new Error('Failed to create notification'));
        }
      } catch (error: any) {
        console.error('Error sending templated notification:', error);
        reject(new Error(`Failed to send templated notification: ${error.message || 'Unknown error'}`));
      }
    }));
  }

  // Automated notification methods for customer loyalty
  async sendAppointmentReminder(appointment: Appointment): Promise<void> {
    try {
      const scheduledDate = appointment.scheduledAt.toDate();
      const now = new Date();
      const reminderTime = new Date(scheduledDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours before

      if (now >= reminderTime && now < scheduledDate) {
        if (appointment.clientId) {
          const shouldSend = await this.shouldSendNotification(appointment.clientId, 'appointmentReminders');
          if (shouldSend) {
            await this.addSystemNotification({
              title: 'Recordatorio de Cita',
              message: `Recuerda tu cita programada para ${scheduledDate.toLocaleDateString('es-CO')} a las ${scheduledDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`,
              userId: appointment.clientId,
              meta: { type: 'appointment_reminder' }
            }).toPromise();
          }
        }
      }
    } catch (error) {
      console.error('Error sending appointment reminder:', error);
    }
  }


  async sendPromotionNotification(userId: string, promotion: Promotion): Promise<void> {
    try {
      const shouldSend = await this.shouldSendNotification(userId, 'marketingNotifications');
      if (shouldSend) {
        await this.addSystemNotification({
          title: promotion.title || 'Promoción Especial',
          message: promotion.message || '¡No te pierdas esta oferta!',
          userId,
          meta: { type: 'promotion' }
        }).toPromise();
      }
    } catch (error) {
      console.error('Error sending promotion notification:', error);
    }
  }

  async sendServiceReminder(vehicleId: string, lastServiceDate: Date): Promise<void> {
    try {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000); // approx 6 months

      if (lastServiceDate < sixMonthsAgo) {
        // Find user via UserVehicle
        try {
          const userVehicleDoc = await getDoc(doc(db, "userVehicles", vehicleId));
          if (userVehicleDoc.exists()) {
            const userVehicle = fromFirestore<UserVehicle>(userVehicleDoc);
            const user = this.userService.getUsers()().find(u => u.id === userVehicle.userId);
            if (user) {
              const shouldSend = await this.shouldSendNotification(user.id, 'maintenanceReminders');
              if (shouldSend) {
                // Generate personalized maintenance reminder
                const daysSinceLastService = Math.floor((now.getTime() - lastServiceDate.getTime()) / (1000 * 60 * 60 * 24));
                const message = `Hola ${user.name}, han pasado ${daysSinceLastService} días desde tu último mantenimiento. Te recomendamos programar una cita para mantener tu motocicleta en óptimas condiciones.`;

                await this.addSystemNotification({
                  title: 'Recordatorio de Mantenimiento',
                  message: message,
                  userId: user.id,
                  meta: { type: 'maintenance_reminder' }
                }).toPromise();
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user vehicle:', error);
        }
      }
    } catch (error) {
      console.error('Error sending service reminder:', error);
    }
  }

  // Enhanced notification creation
  async createSmartNotification(context: string, targetUsers?: string[]): Promise<NotificationModel[]> {
    try {
      const notifications: NotificationModel[] = [];

      // Generate smart notification content based on context
      let title = 'Notificación Importante';
      let message = context;

      // Basic context analysis for better notifications
      if (context.toLowerCase().includes('mantenimiento') || context.toLowerCase().includes('service')) {
        title = 'Recordatorio de Mantenimiento';
        message = `Es momento de programar el mantenimiento de tu motocicleta. ${context}`;
      } else if (context.toLowerCase().includes('cita') || context.toLowerCase().includes('appointment')) {
        title = 'Recordatorio de Cita';
        message = `Recuerda tu cita programada. ${context}`;
      } else if (context.toLowerCase().includes('urgente') || context.toLowerCase().includes('urgent')) {
        title = 'Notificación Urgente';
        message = `Atención requerida: ${context}`;
      }

      if (targetUsers && targetUsers.length > 0) {
        // Send to specific users
        for (const userId of targetUsers) {
          const notification = await this.addSystemNotification({
            title,
            message,
            userId,
            meta: { type: 'smart_generated', context }
          }).toPromise();
          if (notification) notifications.push(notification);
        }
      } else {
        // Broadcast notification
        const notification = await this.addSystemNotification({
          title,
          message,
          meta: { type: 'smart_generated', context }
        }).toPromise();
        if (notification) notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error creating smart notification:', error);
      throw error;
    }
  }

  // ========== AUTOMATED NOTIFICATION FEATURES ==========

  constructor() {
    console.log('🔊 NotificationService: Initializing notification service');
    console.log('🔊 NotificationService: AudioContext available:', typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window));
    console.log('🔊 NotificationService: Vibration available:', typeof navigator !== 'undefined' && 'vibrate' in navigator);
    // Enable real-time listeners with proper throttling
    this.setupRealtimeListeners();
    // Setup automated notifications
    this.setupAutomatedNotifications();
    // Setup event bus listeners for notification manager
    this.setupEventBusListeners();
  }

  private setupAutomatedNotifications() {
    // Run daily at a specific time, e.g., midnight
    this.scheduleDailyNotifications();
  }

  private scheduleDailyNotifications() {
    // Calculate time until next midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // Next midnight

    const timeUntilMidnight = midnight.getTime() - now.getTime();

    // Schedule first run
    setTimeout(() => {
      this.runDailyNotifications();
      // Then run every 24 hours
      setInterval(() => {
        this.runDailyNotifications();
      }, 24 * 60 * 60 * 1000);
    }, timeUntilMidnight);
  }

  async runDailyNotifications(): Promise<void> {
    try {
      console.log('Running daily automated notifications...');

      await this.sendAppointmentReminders();
      await this.sendServiceReminders();
      await this.sendPromotions();

      console.log('Daily automated notifications completed.');
    } catch (error) {
      console.error('Error running daily notifications:', error);
    }
  }

  private async sendAppointmentReminders(): Promise<void> {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const appointments = this.appointmentService.getAppointmentsForDate(tomorrow);

      for (const appointment of appointments) {
        if (appointment.status === 'scheduled' || appointment.status === 'confirmed') {
          await this.sendAppointmentReminder(appointment);
        }
      }
    } catch (error) {
      console.error('Error sending appointment reminders:', error);
    }
  }

  private async sendServiceReminders(): Promise<void> {
    try {
      // Get all completed work orders
      const workOrders = this.workOrderService.getWorkOrders()().filter(wo =>
        wo.status === 'ready_for_pickup' || wo.status === 'delivered'
      );

      // Group by vehicleId and find last service
      const vehicleLastService = new Map<string, Date>();
      for (const wo of workOrders) {
        const lastDate = vehicleLastService.get(wo.vehicleId);
        const woDate = wo.createdAt.toDate();
        if (!lastDate || woDate > lastDate) {
          vehicleLastService.set(wo.vehicleId, woDate);
        }
      }

      // Check vehicles without recent service
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      for (const [vehicleId, lastServiceDate] of vehicleLastService) {
        if (lastServiceDate < sixMonthsAgo) {
          await this.sendServiceReminder(vehicleId, lastServiceDate);
        }
      }
    } catch (error) {
      console.error('Error sending service reminders:', error);
    }
  }

  private async sendPromotions(): Promise<void> {
    try {
      // Example: Send promotions to customers who haven't had service in 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const workOrders = this.workOrderService.getWorkOrders()().filter(wo =>
        wo.status === 'ready_for_pickup' || wo.status === 'delivered'
      );

      const activeCustomers = new Set<string>();
      for (const wo of workOrders) {
        if (wo.createdAt.toDate() > threeMonthsAgo) {
          activeCustomers.add(wo.clientId);
        }
      }

      // For simplicity, send to all customers not active in 3 months
      // In real implementation, this would be more sophisticated
      const allUsers = this.userService.getUsers()().filter(u => u.role === 'customer');
      for (const user of allUsers) {
        if (!activeCustomers.has(user.id)) {
          const promotion = {
            title: '¡Oferta Especial!',
            message: 'Descuento del 20% en tu próximo servicio de mantenimiento.'
          };
          await this.sendPromotionNotification(user.id, promotion);
        }
      }
    } catch (error) {
      console.error('Error sending promotions:', error);
    }
  }

  // ========== NOTIFICATION MANAGER FEATURES ==========

  private setupEventBusListeners() {
    this.eventBus.events$.subscribe(event => {
      this.handleEvent(event);
    });
  }

  private async handleEvent(event: NotificationEvent): Promise<void> {
    const notifications = await this.generateNotificationsForEvent(event);
    for (const notification of notifications) {
      this.addSystemNotification(notification).subscribe();
    }
  }

  private async generateNotificationsForEvent(event: NotificationEvent): Promise<NotificationData[]> {
    switch (event.type) {
      case 'appointment.created':
        return Promise.resolve(this.handleAppointmentCreated(event.entity));
      case 'appointment.assigned':
        return Promise.resolve(this.handleAppointmentAssigned(event.entity));
      case 'appointment.status_changed':
        return Promise.resolve(this.handleAppointmentStatusChanged(event.entity, event.newStatus));
      case 'work_order.status_changed':
        return Promise.resolve(this.handleWorkOrderStatusChanged(event.entity));
      case 'work_order.completed':
        return this.handleWorkOrderCompleted(event.entity, event.lastServiceDate);
      case 'queue.called':
        return Promise.resolve(this.handleQueueCalled(event.entity, event.technicianName));
      case 'queue.entry_added':
        return Promise.resolve(this.handleQueueEntryAdded(event.entity));
      case 'queue.auto_assigned':
        return Promise.resolve(this.handleQueueAutoAssigned(event.entity, event.technician));
      case 'maintenance.reminder_created':
        return Promise.resolve(this.handleMaintenanceReminderCreated(event.reminder, event.customer));
      // Add other cases here
      default:
        return Promise.resolve([]);
    }
  }

  private handleAppointmentCreated(appointment: Appointment): any[] {
    const customerMessage = {
      userId: appointment.clientId,
      title: 'Tu Cita ha sido Recibida',
      message: `Hemos recibido tu solicitud de cita #${appointment.number} para el ${appointment.scheduledAt.toDate().toLocaleString('es-CO')}. Te notificaremos cuando sea confirmada.`,
    };

    // Notify all admins/front-desk that a new appointment needs approval
    const adminMessage = {
      userId: null, // Broadcast to relevant roles
      title: 'Nueva Cita Pendiente de Aprobación',
      message: `La cita #${appointment.number} para el cliente ${appointment.clientId} requiere asignación y confirmación.`,
      meta: { appointmentId: appointment.id, requiredRoles: ['admin', 'front_desk'] }
    };
    return [customerMessage, adminMessage];
  }

  private handleAppointmentAssigned(appointment: Appointment): any[] {
    const technician = this.userService.getUserById(appointment.assignedTo!);
    if (!technician) return [];

    const technicianMessage = {
      userId: technician.id,
      title: 'Nueva Cita Asignada',
      message: `Se te ha asignado la cita #${appointment.number} para el ${appointment.scheduledAt.toDate().toLocaleString('es-CO')}.`,
      meta: { appointmentId: appointment.id }
    };

    const customerMessage = {
      userId: appointment.clientId,
      title: '¡Tu Cita ha sido Confirmada!',
      message: `Tu cita #${appointment.number} ha sido confirmada con nuestro técnico ${technician.name}.`,
      meta: { appointmentId: appointment.id }
    };
    return [technicianMessage, customerMessage];
  }

  private async handleAppointmentStatusChanged(appointment: Appointment, newStatus: string): Promise<any[]> {
    const messages: any[] = [];

    // Send reminder if appointment is confirmed
    if (newStatus === 'confirmed') {
      try {
        if (appointment.clientId) {
          const shouldSend = await this.shouldSendNotification(appointment.clientId, 'appointmentReminders');
          if (shouldSend) {
            messages.push({
              userId: appointment.clientId,
              title: 'Recordatorio de Cita',
              message: `Recuerda tu cita programada para ${appointment.scheduledAt.toDate().toLocaleDateString('es-CO')} a las ${appointment.scheduledAt.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`,
              meta: { type: 'appointment_reminder' }
            });
          }
        }
      } catch (error) {
        console.error('Error sending appointment reminder:', error);
      }
    }

    return messages;
  }

  private async handleQueueCalled(queueEntry: QueueEntry, technicianName: string): Promise<any[]> {
    const messages: any[] = [];

    try {
      const shouldSend = await this.shouldSendNotification(queueEntry.customerId, 'queueNotifications');
      if (shouldSend) {
        const qrCodeDataUrl = this.qrCodeService.generateQrCodeDataUrl('queue-entry', queueEntry.id);
        messages.push({
          userId: queueEntry.customerId,
          title: '¡Es tu turno!',
          message: `Tu turno en la cola ha sido llamado. Te atenderá: ${technicianName}. Código de verificación: ${queueEntry.verificationCode}. Presenta este código al técnico.`,
          meta: {
            queueEntryId: queueEntry.id,
            qrCodeDataUrl: qrCodeDataUrl,
            technicianName: technicianName,
            verificationCode: queueEntry.verificationCode
          }
        });
      }
    } catch (error) {
      console.error('Error sending queue called notification:', error);
    }

    return messages;
  }

  private async handleQueueEntryAdded(queueEntry: QueueEntry): Promise<any[]> {
    const messages: any[] = [];

    try {
      // Get all employees and technicians
      const employees = [
        ...this.userService.getUsersByRole('technician'),
        ...this.userService.getUsersByRole('admin')
      ];

      const customer = this.userService.getUserById(queueEntry.customerId);

      // Use specialized queue notification method
      const queueInfo = {
        position: queueEntry.position,
        estimatedWaitTime: queueEntry.estimatedWaitTime,
        ticketNumber: `Q${queueEntry.position.toString().padStart(3, '0')}`
      };

      for (const employee of employees) {
        try {
          const shouldSend = await this.shouldSendNotification(employee.id, 'queueNotifications');
          if (shouldSend) {
            messages.push({
              userId: employee.id,
              title: 'Nueva Entrada en Cola',
              message: `Nueva entrada en cola: ${customer?.name || 'Cliente'} en posición ${queueInfo.position}. Tiempo estimado: ${queueInfo.estimatedWaitTime} min.`,
              meta: {
                queueEntryId: queueEntry.id,
                queueInfo,
                customerName: customer?.name,
                notificationType: 'queue_update'
              }
            });
          }
        } catch (error) {
          console.error('Error sending queue entry notification to employee:', employee.id, error);
        }
      }
    } catch (error) {
      console.error('Error handling queue entry added:', error);
    }

    return messages;
  }

  private async handleQueueAutoAssigned(queueEntry: QueueEntry, technician: UserProfile): Promise<any[]> {
    const messages: any[] = [];

    try {
      // Notify technician
      const shouldSendTech = await this.shouldSendNotification(technician.id, 'queueNotifications');
      if (shouldSendTech) {
        const qrCodeDataUrl = this.qrCodeService.generateQrCodeDataUrl('queue-entry', queueEntry.id);
        messages.push({
          userId: technician.id,
          title: 'Nuevo Cliente Asignado',
          message: `Se te ha asignado el cliente en posición ${queueEntry.position} de la cola. Servicio: ${queueEntry.serviceType === 'appointment' ? 'Cita' : 'Servicio Directo'}`,
          meta: {
            queueEntryId: queueEntry.id,
            qrCodeDataUrl: qrCodeDataUrl
          }
        });
      }

      // Notify customer
      const shouldSendCustomer = await this.shouldSendNotification(queueEntry.customerId, 'queueNotifications');
      if (shouldSendCustomer) {
        const qrCodeDataUrl = this.qrCodeService.generateQrCodeDataUrl('queue-entry', queueEntry.id);
        messages.push({
          userId: queueEntry.customerId,
          title: '¡Es tu turno!',
          message: `Tu turno en la cola ha sido llamado. Te atenderá: ${technician.name}. Código de verificación: ${queueEntry.verificationCode}. Presenta este código al técnico.`,
          meta: {
            queueEntryId: queueEntry.id,
            qrCodeDataUrl: qrCodeDataUrl,
            technicianName: technician.name,
            technicianId: technician.id,
            verificationCode: queueEntry.verificationCode
          }
        });
      }
    } catch (error) {
      console.error('Error handling queue auto-assigned:', error);
    }

    return messages;
  }

  private async handleMaintenanceReminderCreated(reminder: MaintenanceReminderEvent, customer: UserProfile): Promise<NotificationData[]> {
    const messages: any[] = [];

    try {
      const shouldSend = await this.shouldSendNotification(customer.id, 'maintenanceReminders');
      if (shouldSend) {
        let title = '';
        let message = '';

        switch (reminder.dueType) {
          case 'overdue':
            title = '🚨 Servicio de Mantenimiento Vencido';
            message = `El servicio "${reminder.serviceName}" para tu ${reminder.vehicleId} está vencido. Te recomendamos programarlo lo antes posible.`;
            break;
          case 'due_soon':
            title = '⚠️ Servicio de Mantenimiento Próximo';
            message = `El servicio "${reminder.serviceName}" para tu ${reminder.vehicleId} vencerá pronto. Considera programarlo.`;
            break;
          case 'upcoming':
            title = '📅 Recordatorio de Mantenimiento';
            message = `Te recordamos que el servicio "${reminder.serviceName}" está programado para mantenimiento preventivo.`;
            break;
        }

        messages.push({
          userId: customer.id,
          title,
          message,
          meta: {
            serviceId: reminder.serviceId,
            vehicleId: reminder.vehicleId,
            dueDate: reminder.dueDate,
            priority: reminder.priority
          }
        });
      }
    } catch (error) {
      console.error('Error handling maintenance reminder created:', error);
    }

    return messages;
  }

  private handleWorkOrderStatusChanged(workOrder: WorkOrder): any[] {
    const messages: any[] = [];
    if (!workOrder.clientId) return messages;
    const customer = this.userService.getUserById(workOrder.clientId);
    if (!customer) return messages;

    let title = '';
    let message = '';

    switch (workOrder.status) {
      case 'ready_for_pickup':
        title = '¡Tu Vehículo está Listo!';
        message = `El servicio para tu vehículo (Orden #${workOrder.number}) ha finalizado. Ya puedes pasar a recogerlo.`;
        break;
      case 'in_progress':
        title = 'Servicio en Progreso';
        message = `Hemos comenzado a trabajar en tu vehículo (Orden #${workOrder.number}).`;
        break;
      // Add more status cases here
    }

    if (title && message) {
      messages.push({
        userId: customer.id,
        title,
        message,
        meta: { workOrderId: workOrder.id }
      });
    }
    return messages;
  }

  private async handleWorkOrderCompleted(workOrder: WorkOrder, lastServiceDate?: Date): Promise<any[]> {
    const messages: any[] = [];

    try {
      // Send service reminder for the vehicle
      if (!lastServiceDate) return messages;

      const now = new Date();
      const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000); // approx 6 months

      if (lastServiceDate < sixMonthsAgo) {
        // Find user via UserVehicle
        try {
          const userVehicleDoc = await this.userVehicleService.getVehiclesForUser(workOrder.clientId).toPromise();
          if (userVehicleDoc) {
            for (const vehicle of userVehicleDoc) {
              if (vehicle.id === workOrder.vehicleId) {
                const user = this.userService.getUserById(vehicle.userId);
                if (user) {
                  messages.push({
                    title: 'Recordatorio de Mantenimiento',
                    message: 'Hace más de 6 meses que no realizas mantenimiento a tu vehículo. ¡Programa una cita!',
                    userId: user.id,
                    meta: { type: 'maintenance_reminder' }
                  });
                }
                break;
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user vehicle:', error);
        }
      }
    } catch (error) {
      console.error('Error sending service reminder:', error);
    }

    return messages;
  }

  // ========== TEMPLATE FEATURES ==========

  // Get templates by type
  getTemplatesByType(type: NotificationTemplate['type']): NotificationTemplate[] {
    return this.templates().filter(template => template.type === type && template.isActive);
  }

  // Get template by ID
  getTemplate(id: string): Observable<NotificationTemplate | null> {
    return from(new Promise<NotificationTemplate | null>(async (resolve) => {
      const template = this.templates().find(t => t.id === id) || null;
      resolve(template);
    }));
  }

  // Create template
  createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Observable<NotificationTemplate> {
    return from(new Promise<NotificationTemplate>(async (resolve, reject) => {
      try {
        const newTemplate: NotificationTemplate = {
          ...template,
          id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        };

        const docRef = await addDoc(collection(db, "notificationTemplates"), newTemplate);
        const createdTemplate = { ...newTemplate, id: docRef.id };
        this.templates.update(templates => [...templates, createdTemplate]);
        resolve(createdTemplate);
      } catch (error) {
        reject(error);
      }
    }));
  }

  // Update template
  updateTemplate(id: string, updates: Partial<NotificationTemplate>): Observable<NotificationTemplate> {
    return from(new Promise<NotificationTemplate>(async (resolve, reject) => {
      try {
        const docRef = doc(db, "notificationTemplates", id);
        await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });

        let updatedTemplate: NotificationTemplate | undefined;
        this.templates.update(templates =>
          templates.map(t => {
            if (t.id === id) {
              updatedTemplate = { ...t, ...updates };
              return updatedTemplate;
            }
            return t;
          })
        );
        resolve(updatedTemplate!);
      } catch (error) {
        reject(error);
      }
    }));
  }

  // Delete template
  deleteTemplate(id: string): Observable<boolean> {
    return from(new Promise<boolean>(async (resolve, reject) => {
      try {
        await deleteDoc(doc(db, "notificationTemplates", id));
        this.templates.update(templates => templates.filter(t => t.id !== id));
        resolve(true);
      } catch (error) {
        reject(error);
      }
    }));
  }

  // Render template with parameters
  renderTemplate(template: NotificationTemplate, parameters: Record<string, any>): { title: string; message: string } {
    let title = template.titleTemplate;
    let message = template.messageTemplate;

    // Replace parameters in templates
    Object.entries(parameters).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      title = title.replace(regex, String(value));
      message = message.replace(regex, String(value));
    });

    return { title, message };
  }

  // Get default templates
  getDefaultTemplates(): NotificationTemplate[] {
    const now = Timestamp.fromDate(new Date());
    return [
      {
        id: 'welcome_template',
        name: 'Bienvenida',
        description: 'Plantilla para dar la bienvenida a nuevos usuarios',
        type: 'system',
        titleTemplate: '¡Bienvenido a Blue Dragon Motors, {{userName}}!',
        messageTemplate: 'Hola {{userName}}, gracias por registrarte en nuestro taller. Estamos aquí para ayudarte con todos tus servicios de motocicleta.',
        parameters: [
          { key: 'userName', label: 'Nombre del usuario', type: 'text', required: true, defaultValue: '' }
        ],
        isActive: true,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'appointment_reminder_template',
        name: 'Recordatorio de Cita',
        description: 'Recordatorio automático de citas programadas',
        type: 'appointment',
        titleTemplate: 'Recordatorio: Tu cita en Blue Dragon Motors',
        messageTemplate: 'Hola {{customerName}}, te recordamos que tienes una cita programada para el {{appointmentDate}} a las {{appointmentTime}}. ¡Te esperamos!',
        parameters: [
          { key: 'customerName', label: 'Nombre del cliente', type: 'text', required: true, defaultValue: '' },
          { key: 'appointmentDate', label: 'Fecha de la cita', type: 'date', required: true, defaultValue: '' },
          { key: 'appointmentTime', label: 'Hora de la cita', type: 'text', required: true, defaultValue: '' }
        ],
        isActive: true,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'maintenance_reminder_template',
        name: 'Recordatorio de Mantenimiento',
        description: 'Recordatorio de mantenimiento preventivo',
        type: 'maintenance',
        titleTemplate: 'Es hora de mantenimiento para tu {{motorcycleBrand}} {{motorcycleModel}}',
        messageTemplate: 'Hola {{customerName}}, han pasado {{monthsSinceLastService}} meses desde tu último mantenimiento. Te recomendamos programar una cita para mantener tu motocicleta en óptimas condiciones.',
        parameters: [
          { key: 'customerName', label: 'Nombre del cliente', type: 'text', required: true, defaultValue: '' },
          { key: 'motorcycleBrand', label: 'Marca de la motocicleta', type: 'text', required: true, defaultValue: '' },
          { key: 'motorcycleModel', label: 'Modelo de la motocicleta', type: 'text', required: true, defaultValue: '' },
          { key: 'monthsSinceLastService', label: 'Meses desde último servicio', type: 'number', required: true, defaultValue: '' }
        ],
        isActive: true,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'promotion_template',
        name: 'Promoción Especial',
        description: 'Plantilla para promociones y ofertas especiales',
        type: 'marketing',
        titleTemplate: '¡{{promotionTitle}} en Blue Dragon Motors!',
        messageTemplate: '{{promotionDescription}}. Aprovecha esta oferta limitada. ¡Te esperamos en nuestro taller!',
        parameters: [
          { key: 'promotionTitle', label: 'Título de la promoción', type: 'text', required: true, defaultValue: '' },
          { key: 'promotionDescription', label: 'Descripción de la promoción', type: 'text', required: true, defaultValue: '' }
        ],
        isActive: true,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  // ========== INVENTORY ALERTS ==========

  async createInventoryAlert(
    productInfo: { name: string; sku?: string; currentStock: number; minStock: number },
    alertType: 'low_stock' | 'out_of_stock' | 'critical' | 'reorder_needed',
    location?: string
  ): Promise<NotificationModel[]> {
    let title = 'Alerta de Inventario';
    let message = '';
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    switch (alertType) {
      case 'out_of_stock':
        title = '¡Producto Agotado!';
        message = `El producto "${productInfo.name}" se ha agotado.${location ? ` Ubicación: ${location}` : ''}`;
        priority = 'high';
        break;
      case 'critical':
        title = '¡Stock Crítico!';
        message = `El producto "${productInfo.name}" tiene solo ${productInfo.currentStock} unidades (mínimo: ${productInfo.minStock}).${location ? ` Ubicación: ${location}` : ''}`;
        priority = 'critical';
        break;
      case 'low_stock':
        title = 'Stock Bajo';
        message = `El producto "${productInfo.name}" tiene ${productInfo.currentStock} unidades (mínimo: ${productInfo.minStock}).${location ? ` Ubicación: ${location}` : ''}`;
        priority = 'medium';
        break;
      case 'reorder_needed':
        title = 'Reordenar Producto';
        message = `Es momento de reordenar "${productInfo.name}". Stock actual: ${productInfo.currentStock} (mínimo: ${productInfo.minStock}).${location ? ` Ubicación: ${location}` : ''}`;
        priority = 'low';
        break;
    }

    return this.createCategorizedNotification(
      'inventory',
      title,
      message,
      {
        priority,
        targetAudience: 'admins', // Inventory alerts go to admins/managers
        additionalMeta: {
          productInfo,
          alertType,
          location,
          inventoryAlert: true
        }
      }
    );
  }
  /**
   * Create admin notification - convenience method for admin alerts
   */
  async createAdminNotification(title: string, message: string): Promise<NotificationModel[]> {
    return this.createCategorizedNotification(
      'users',
      `[ADMIN] ${title}`,
      message,
      {
        priority: 'high',
        targetAudience: 'admins',
        additionalMeta: {
          adminNotification: true,
          systemGenerated: true
        }
      }
    );
  }
}