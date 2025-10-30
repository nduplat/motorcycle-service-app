import { Timestamp } from './types';

/**
 * User Model - Core user entity for the motorcycle workshop system.
 *
 * Purpose: Represents all users in the system including staff and customers.
 * Contains authentication info, profile data, and role-based permissions.
 *
 * Propósito: Representa todos los usuarios en el sistema incluyendo personal y clientes.
 * Contiene información de autenticación, datos de perfil y permisos basados en roles.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'users', id = user.uid
 * - Query: Use Firestore getDoc() or query() on 'users' collection
 * - Delete: Use Firestore deleteDoc() on 'users' collection (rare, usually deactivate)
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'users', id = user.uid
 * - Consultar: Usar Firestore getDoc() o query() en colección 'users'
 * - Eliminar: Usar Firestore deleteDoc() en colección 'users' (raro, usualmente desactivar)
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface User {
  id: string; // auth uid
  uid: string;
  email: string;
  displayName: string;
  name: string;
  phone?: string;
  role: import('./types').Role;
  avatarUrl?: string;
  active?: boolean;
  technicianProfile?: TechnicianProfile | null;
  availability?: {
    isAvailable: boolean;
    lastUpdated: Timestamp;
    reason?: string; // optional reason for unavailability
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isQrUser?: boolean; // ← AGREGAR
  phoneVerifiedAt?: Timestamp; // ← AGREGAR
  enteredViaQr?: boolean; // ← AGREGAR
}

/**
 * UserProfile - Alias for User interface.
 *
 * Purpose: Provides an alternative name for User interface for backward compatibility.
 *
 * Propósito: Proporciona un nombre alternativo para la interfaz User para compatibilidad hacia atrás.
 *
 * CRUD Operations: Same as User model.
 * Operaciones CRUD: Mismas que el modelo User.
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export type UserProfile = User;

/**
 * TechnicianProfile - Specialized profile for technicians.
 *
 * Purpose: Stores additional information specific to technicians including skills,
 * hourly rates, and certifications.
 *
 * Propósito: Almacena información adicional específica de técnicos incluyendo habilidades,
 * tarifas por hora y certificaciones.
 *
 * CRUD Operations:
 * - Save: Embedded in User document, updated via user update
 * - Query: Retrieved as part of User document
 * - Delete: Removed by setting to null in User update
 *
 * Operaciones CRUD:
 * - Guardar: Incrustado en documento User, actualizado vía actualización de usuario
 * - Consultar: Recuperado como parte del documento User
 * - Eliminar: Removido configurando a null en actualización de User
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface TechnicianProfile {
  technicianId: string;
  skills?: string[]; // e.g., ["electrical","injection"] - ej. ["eléctrica","inyección"]
  hourlyRate?: number;
  certifications?: string[];
  employmentStartAt?: Timestamp;
}