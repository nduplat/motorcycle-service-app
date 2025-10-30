import { Timestamp } from './types';

/**
 * Purchase Order Item - Individual line item on a purchase order
 */
export interface PurchaseOrderItem {
  productId: string;
  variantId?: string;
  qty: number;
  unitCost?: number;
  expectedDate?: Timestamp;
}

/**
 * Purchase Order Status - Status values for purchase orders
 */
export type PurchaseOrderStatus = "draft" | "ordered" | "received" | "partially_received" | "cancelled";

/**
 * PurchaseOrder Model - Purchase orders for inventory replenishment.
 *
 * Purpose: Manages procurement of products from suppliers, tracking ordered items,
 * quantities, costs, and delivery status.
 *
 * Propósito: Gestiona la adquisición de productos de proveedores, rastreando artículos pedidos,
 * cantidades, costos y estado de entrega.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'purchaseOrders', auto-generated id
 * - Query: Use Firestore query() on 'purchaseOrders' collection by supplierId, status
 * - Delete: Use Firestore deleteDoc() (rare, usually keep for history)
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'purchaseOrders', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'purchaseOrders' por supplierId, status
 * - Eliminar: Usar Firestore deleteDoc() (raro, usualmente mantener para historial)
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface PurchaseOrder {
  id: string;
  supplierId: string;
  items: PurchaseOrderItem[];
  status: PurchaseOrderStatus;
  totalEstimated?: number;
  createdBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Supplier Model - Vendor information for purchasing.
 *
 * Purpose: Stores supplier contact information, payment terms, and procurement details
 * for managing vendor relationships and purchasing.
 *
 * Propósito: Almacena información de contacto de proveedores, términos de pago y detalles de adquisición
 * para gestionar relaciones con proveedores y compras.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'suppliers', auto-generated id
 * - Query: Use Firestore query() on 'suppliers' collection, usually cached
 * - Delete: Use Firestore deleteDoc() or mark as inactive
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'suppliers', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'suppliers', usualmente cacheado
 * - Eliminar: Usar Firestore deleteDoc() o marcar como inactivo
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  paymentTerms?: string; // e.g., "30d" - ej. "30d"
  taxId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}