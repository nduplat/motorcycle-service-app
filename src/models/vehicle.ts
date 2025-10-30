import { Timestamp } from './types';


/**
 * Motorcycle Model - Catalog of motorcycle models.
 *
 * Purpose: Comprehensive catalog of motorcycle specifications and features.
 * Used for compatibility checking, service recommendations, and customer selection.
 *
 * Propósito: Catálogo completo de especificaciones y características de motocicletas.
 * Usado para verificación de compatibilidad, recomendaciones de servicio y selección de cliente.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'motorcycles', auto-generated id
 * - Query: Use Firestore query() on 'motorcycles' collection with filters (brand, type, category)
 * - Delete: Use Firestore deleteDoc() or set isActive to false
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'motorcycles', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'motorcycles' con filtros (brand, type, category)
 * - Eliminar: Usar Firestore deleteDoc() o configurar isActive a false
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface Motorcycle {
  id: string;
  brand: string;
  model: string;
  year: number;
  displacementCc?: number;

  // Enhanced categorization - Categorización mejorada
  category?: import('./types').MotorcycleCategory; // Auto-calculated based on CC - Auto-calculado basado en CC
  type?: import('./types').MotorcycleType;
  subType?: string; // e.g., "Super Sport", "Dual Sport", etc. - ej. "Super Sport", "Dual Sport", etc.

  // Technical specifications - Especificaciones técnicas
  engineType?: string; // e.g., "4-stroke, 4-cylinder, DOHC" - ej. "4 tiempos, 4 cilindros, DOHC"
  fuelType?: import('./types').MotorcycleFuelType;
  transmission?: import('./types').MotorcycleTransmission;
  cylinders?: number;
  valvesPerCylinder?: number;
  cooling?: "air" | "liquid" | "oil";

  // Performance - Rendimiento
  maxPowerHp?: number;
  maxTorqueNm?: number;
  topSpeedKmh?: number;
  weightKg?: number;
  fuelCapacityL?: number;
  fuelEfficiencyKml?: number;

  // Features and equipment - Características y equipo
  abs?: boolean;
  tractionControl?: boolean;
  quickShifter?: boolean;
  cruiseControl?: boolean;
  heatedSeats?: boolean;
  adjustableSuspension?: boolean;
  bluetooth?: boolean;
  usbCharging?: boolean;

  // Design and styling - Diseño y estilo
  colors?: string[];
  seatHeightMm?: number;
  wheelbaseMm?: number;
  groundClearanceMm?: number;

  // Media and documentation - Medios y documentación
  images?: string[];
  brochureUrl?: string;
  manualUrl?: string;

  // Business information - Información comercial
  basePrice?: number;
  currency?: import('./types').Currency;
  isActive?: boolean;
  tags?: string[]; // Custom tags for filtering - Etiquetas personalizadas para filtrado

  // License plate for workshop motorcycles - Placa para motocicletas del taller
  plate?: string;

  // Metadata - Metadatos
  description?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Brand Model - Motorcycle manufacturers.
 *
 * Purpose: Stores information about motorcycle brands for catalog organization
 * and compatibility matching.
 *
 * Propósito: Almacena información sobre marcas de motocicletas para organización
 * del catálogo y coincidencia de compatibilidad.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'brands', auto-generated id
 * - Query: Use Firestore query() on 'brands' collection, usually cached
 * - Delete: Use Firestore deleteDoc() or set isActive to false
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'brands', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'brands', usualmente cacheado
 * - Eliminar: Usar Firestore deleteDoc() o configurar isActive a false
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface Brand {
  id: string;
  name: string;
  country?: string;
  foundedYear?: number;
  logoUrl?: string;
  website?: string;
  description?: string;
  isActive?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * UserVehicle Model - Specific motorcycle instances owned by users.
 *
 * Purpose: Links users to specific motorcycle instances with additional details
 * like mileage, documents, and maintenance history.
 *
 * Propósito: Vincula usuarios con instancias específicas de motocicletas con detalles adicionales
 * como kilometraje, documentos e historial de mantenimiento.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'userVehicles', auto-generated id
 * - Query: Use Firestore query() on 'userVehicles' collection by userId
 * - Delete: Use Firestore deleteDoc() when user sells/removes vehicle
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'userVehicles', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'userVehicles' por userId
 * - Eliminar: Usar Firestore deleteDoc() cuando usuario vende/remueve vehículo
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */

/**
 * MotorcycleAssignments Model - Assignment of motorcycles to users with plate-based logic.
 *
 * Purpose: Tracks motorcycle assignments using license plates as unique identifiers.
 * Supports plate-based operations and user access control.
 *
 * Propósito: Rastrea asignaciones de motocicletas usando placas como identificadores únicos.
 * Soporta operaciones basadas en placas y control de acceso de usuario.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'motorcycleAssignments', auto-generated id
 * - Query: Use Firestore query() on 'motorcycleAssignments' collection by userId, motorcycleId, or plate
 * - Delete: Use Firestore deleteDoc() when assignment ends
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'motorcycleAssignments', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'motorcycleAssignments' por userId, motorcycleId, o placa
 * - Eliminar: Usar Firestore deleteDoc() cuando la asignación termina
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface MotorcycleAssignment {
  id: string;                // Igual a la placa
  plate: string;             // Obligatorio
  motorcycleId: string;      // ID de la moto base (referencia)
  userId: string;            // Usuario asignado
  assignedBy: string;        // ID del administrador o técnico que asigna
  assignedAt: Timestamp;     // Fecha/hora de asignación
  createdAt: Timestamp;
  updatedAt: Timestamp;
  mileageKm?: number;
  status: 'active' | 'inactive';
  notes?: string | null;

  // Documentos legales - SOAT y Tecnomecánica
  soatUrl?: string;           // URL to SOAT document in Cloud Storage
  tecnoUrl?: string;          // URL to Tecnomecanica document in Cloud Storage
  soatExpiresAt?: Timestamp;  // Fecha de vencimiento del SOAT
  tecnoExpiresAt?: Timestamp; // Fecha de vencimiento de la Tecnomecánica

  // Datos de referencia del modelo original (mantener por compatibilidad)
  brand?: string;
  model?: string;
  year?: number;
  displacementCc?: number;
  category?: string;
  type?: string;
  isActive?: boolean;
  cylinderCapacity?: number; // ← AGREGAR
  quickAssigned?: boolean; // ← AGREGAR
}
