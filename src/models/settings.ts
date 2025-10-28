import { Timestamp } from './types';

/**
 * Category Model - Product/service categorization.
 *
 * Purpose: Hierarchical categorization system for organizing products and services.
 * Supports nested categories for detailed classification.
 *
 * Propósito: Sistema de categorización jerárquica para organizar productos y servicios.
 * Soporta categorías anidadas para clasificación detallada.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'categories', auto-generated id
 * - Query: Use Firestore query() on 'categories' collection with parentId for hierarchy
 * - Delete: Use Firestore deleteDoc() (cascade delete children if needed)
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'categories', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'categories' con parentId para jerarquía
 * - Eliminar: Usar Firestore deleteDoc() (eliminar en cascada hijos si es necesario)
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null; // For hierarchical categories - Para categorías jerárquicas
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}


/**
 * Customer Model - Customer information and profiles.
 *
 * Purpose: Stores customer contact details, addresses, and references to their vehicles.
 * Central entity for customer relationship management.
 *
 * Propósito: Almacena detalles de contacto de clientes, direcciones y referencias a sus vehículos.
 * Entidad central para gestión de relaciones con clientes.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'customers', auto-generated id
 * - Query: Use Firestore query() on 'customers' collection by documentNumber, email
 * - Delete: Use Firestore deleteDoc() (rare, usually deactivate)
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'customers', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'customers' por documentNumber, email
 * - Eliminar: Usar Firestore deleteDoc() (raro, usualmente desactivar)
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface Customer {
  id: string; // doc id
  name: string;
  documentType?: string; // CC, NIT, DNI... - CC, NIT, DNI...
  documentNumber?: string;
  email?: string;
  phone?: string;
  addresses?: Array<{ label?: string; address: string; city?: string }>;
  defaultVehicleId?: string; // quick reference - referencia rápida
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * WorkshopLocation Model - Physical workshop locations.
 *
 * Purpose: Defines different workshop locations/sucursales with contact info
 * and management assignments.
 *
 * Propósito: Define diferentes ubicaciones físicas del taller/sucursales con información
 * de contacto y asignaciones de gestión.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'workshopLocations', auto-generated id
 * - Query: Use Firestore query() on 'workshopLocations' collection, usually cached
 * - Delete: Use Firestore deleteDoc() or set active to false
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'workshopLocations', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'workshopLocations', usualmente cacheado
 * - Eliminar: Usar Firestore deleteDoc() o configurar active a false
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface WorkshopLocation {
  id: string;
  name: string; // e.g., "Sede Principal Bogotá", "Sucursal Medellín"
  code: string; // short code like "BOG", "MED" - código corto como "BOG", "MED"
  address: string;
  city: string;
  phone?: string;
  managerId?: string; // user id of location manager - id de usuario del gerente de ubicación
  active?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}