import { Timestamp } from './types';

/**
 * StockMovement Model - Inventory transaction ledger.
 *
 * Purpose: Single source of truth for all inventory changes. Tracks purchases,
 * sales, adjustments, returns, and transfers with full audit trail.
 *
 * Propósito: Fuente única de verdad para todos los cambios de inventario. Rastrea compras,
 * ventas, ajustes, devoluciones y transferencias con rastro de auditoría completo.
 *
 * CRUD Operations:
 * - Save: Use Firestore addDoc() with collection 'stockMovements', auto-generated id
 * - Query: Use Firestore query() on 'stockMovements' collection by productId, type, date range
 * - Delete: Never delete - immutable audit trail
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore addDoc() con colección 'stockMovements', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'stockMovements' por productId, type, rango de fechas
 * - Eliminar: Nunca eliminar - rastro de auditoría inmutable
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface StockMovement {
  id: string;
  productId: string;
  variantId?: string;
  workshopLocationId?: string; // workshop location for the movement - ubicación del taller para el movimiento
  quantity: number; // positive in, negative out - positivo entrada, negativo salida
  type: "purchase" | "sale" | "adjustment" | "return" | "waste" | "transfer" | "reservation";
  referenceId?: string; // e.g., invoiceId, poId, workOrderId - ej. invoiceId, poId, workOrderId
  reason?: string;
  createdBy?: string; // user id - id de usuario
  createdAt: Timestamp;
}

/**
 * InventoryLocation Model - Storage locations for products.
 *
 * Purpose: Defines physical or logical storage locations within the workshop
 * for inventory organization and stock tracking.
 *
 * Propósito: Define ubicaciones físicas o lógicas de almacenamiento dentro del taller
 * para organización de inventario y seguimiento de stock.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'inventoryLocations', auto-generated id
 * - Query: Use Firestore query() on 'inventoryLocations' collection, usually cached
 * - Delete: Use Firestore deleteDoc() or set active to false
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'inventoryLocations', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'inventoryLocations', usualmente cacheado
 * - Eliminar: Usar Firestore deleteDoc() o configurar active a false
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface InventoryLocation {
  id: string;
  name: string; // e.g., "Bodega principal", "Anaquel A2"
  description?: string;
  address?: string; // if different warehouse - si es diferente bodega
  active?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}