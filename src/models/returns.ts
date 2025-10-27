import { Timestamp } from './types';

/**
 * Return Order Item - Individual item in a return order
 */
export interface ReturnOrderItem {
  productId: string;
  qty: number;
  reason?: string;
}

/**
 * Return Order Status - Status values for return orders
 */
export type ReturnOrderStatus = "requested" | "approved" | "completed" | "rejected";

/**
 * Warranty Claim Status - Status values for warranty claims
 */
export type WarrantyClaimStatus = "pending" | "approved" | "in_progress" | "completed" | "rejected";

/**
 * ReturnOrder Model - Product returns from customers.
 *
 * Purpose: Handles returns of products sold to customers, tracking items,
 * reasons, and approval status for returns processing.
 *
 * Propósito: Maneja devoluciones de productos vendidos a clientes, rastreando artículos,
 * razones y estado de aprobación para procesamiento de devoluciones.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'returnOrders', auto-generated id
 * - Query: Use Firestore query() on 'returnOrders' collection by customerId, status
 * - Delete: Use Firestore deleteDoc() when return is processed
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'returnOrders', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'returnOrders' por customerId, status
 * - Eliminar: Usar Firestore deleteDoc() cuando la devolución es procesada
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface ReturnOrder {
  id: string;
  originalInvoiceId?: string;
  customerId: string;
  items: ReturnOrderItem[];
  status: ReturnOrderStatus;
  createdAt: Timestamp;
}

/**
 * WarrantyClaim Model - Warranty service requests.
 *
 * Purpose: Manages warranty claims for products or services, tracking the claim
 * process and resolution.
 *
 * Propósito: Gestiona reclamos de garantía para productos o servicios, rastreando el proceso
 * de reclamo y resolución.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'warrantyClaims', auto-generated id
 * - Query: Use Firestore query() on 'warrantyClaims' collection by customerId, status
 * - Delete: Use Firestore deleteDoc() when claim is resolved
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'warrantyClaims', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'warrantyClaims' por customerId, status
 * - Eliminar: Usar Firestore deleteDoc() cuando el reclamo es resuelto
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface WarrantyClaim {
  id: string;
  workOrderId?: string;
  invoiceId?: string;
  customerId: string;
  productId?: string;
  description?: string;
  status: WarrantyClaimStatus;
  createdAt: Timestamp;
}