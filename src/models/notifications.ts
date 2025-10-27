import { Timestamp } from './types';

/**
 * Notification Model - System and user notifications.
 *
 * Purpose: Handles all types of notifications including system alerts, appointment
 * reminders, and maintenance notifications with customizable content.
 *
 * Propósito: Maneja todos los tipos de notificaciones incluyendo alertas del sistema, recordatorios
 * de citas y notificaciones de mantenimiento con contenido personalizable.
 *
 * CRUD Operations:
 * - Save: Use Firestore addDoc() with collection 'notifications', auto-generated id
 * - Query: Use Firestore query() on 'notifications' collection by userId, read status
 * - Delete: Use Firestore deleteDoc() when notification is dismissed
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore addDoc() con colección 'notifications', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'notifications' por userId, estado de lectura
 * - Eliminar: Usar Firestore deleteDoc() cuando la notificación es descartada
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface Notification {
  id: string;
  userId?: string; // null -> broadcast
  title: string;
  message?: string;
  read?: boolean;
  meta?: {
    workOrderId?: string;
    qrCodeDataUrl?: string;
    templateId?: string; // ID of the template used to generate this notification
    generatedBy?: string; // How it was generated (manual, automated, template)
    parameters?: Record<string, unknown>; // Parameters used to generate the notification
    [key: string]: unknown;
  };
  createdAt: Timestamp;
}

/**
 * NotificationTemplate Model - Reusable notification templates.
 *
 * Purpose: Defines templates for automated notifications with placeholders
 * for dynamic content generation.
 *
 * Propósito: Define plantillas para notificaciones automatizadas con marcadores de posición
 * para generación de contenido dinámico.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'notificationTemplates', auto-generated id
 * - Query: Use Firestore query() on 'notificationTemplates' collection by type
 * - Delete: Use Firestore deleteDoc() or set isActive to false
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'notificationTemplates', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'notificationTemplates' por type
 * - Eliminar: Usar Firestore deleteDoc() o configurar isActive a false
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface NotificationTemplate {
  id: string;
  name: string;
  description?: string;
  type: 'marketing' | 'appointment' | 'maintenance' | 'system' | 'custom';
  titleTemplate: string; // Template string with placeholders like {{userName}}, {{serviceName}} - Cadena de plantilla con marcadores como {{userName}}, {{serviceName}}
  messageTemplate: string; // Template string with placeholders - Cadena de plantilla con marcadores
  parameters: NotificationParameter[]; // Available parameters for this template - Parámetros disponibles para esta plantilla
  isActive: boolean;
  createdBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * NotificationParameter Model - Template parameter definitions.
 *
 * Purpose: Defines available parameters for notification templates with validation
 * and user interface hints.
 *
 * Propósito: Define parámetros disponibles para plantillas de notificación con validación
 * y pistas de interfaz de usuario.
 *
 * CRUD Operations:
 * - Save: Stored in notificationTemplates.parameters array
 * - Query: Retrieved as part of NotificationTemplate
 * - Delete: Removed from parameters array in template update
 *
 * Operaciones CRUD:
 * - Guardar: Almacenado en array notificationTemplates.parameters
 * - Consultar: Recuperado como parte de NotificationTemplate
 * - Eliminar: Removido del array parameters en actualización de plantilla
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface NotificationParameter {
  key: string; // e.g., 'userName', 'serviceName', 'discountPercent' - ej. 'userName', 'serviceName', 'discountPercent'
  label: string; // Human readable label - Etiqueta legible por humanos
  type: 'text' | 'number' | 'date' | 'select' | 'user' | 'service' | 'product';
  required: boolean;
  defaultValue?: string | number | boolean | null;
  options?: { label: string; value: string | number | boolean }[]; // For select type - Para tipo select
  placeholder?: string;
}

/**
 * NotificationPreferences Model - User notification settings.
 *
 * Purpose: Stores user preferences for different types of notifications
 * and delivery methods.
 *
 * Propósito: Almacena preferencias de usuario para diferentes tipos de notificaciones
 * y métodos de entrega.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'notificationPreferences', id = userId
 * - Query: Use Firestore getDoc() on 'notificationPreferences' collection
 * - Delete: Use Firestore deleteDoc() to reset to defaults
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'notificationPreferences', id = userId
 * - Consultar: Usar Firestore getDoc() en colección 'notificationPreferences'
 * - Eliminar: Usar Firestore deleteDoc() para restablecer a valores predeterminados
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface NotificationPreferences {
  id: string;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  // Category-specific preferences - Preferencias específicas de categoría
  inventoryAlerts: boolean;
  serviceOrderUpdates: boolean;
  appointmentReminders: boolean;
  queueNotifications: boolean;
  marketingNotifications: boolean;
  userNotifications: boolean;
  maintenanceReminders: boolean;
  soundEnabled: boolean; // Enable loud beep sound - Habilitar sonido de pitido fuerte
  vibrationEnabled: boolean; // Enable strong vibration - Habilitar vibración fuerte
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format - formato HH:MM
    end: string;   // HH:MM format - formato HH:MM
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}