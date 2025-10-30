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
