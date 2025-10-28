import { Timestamp } from './types';
import { WorkOrder } from './work-order';

/**
 * Invoice Item - Individual line item on an invoice
 */
export interface InvoiceItem {
  description: string;
  productId?: string;
  qty: number;
  unitPrice: number;
  discount?: number;
  taxPercent?: number;
}


/**
 * Invoice Model - Sales invoices for completed work.
 *
 * Purpose: Records billing for services and products provided to customers.
 * Tracks payment status, amounts, and transaction history.
 *
 * Propósito: Registra la facturación de servicios y productos proporcionados a clientes.
 * Rastrea el estado de pago, montos e historial de transacciones.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'invoices', auto-generated id
 * - Query: Use Firestore query() on 'invoices' collection by customerId, status, date
 * - Delete: Use Firestore deleteDoc() (rare, usually keep for accounting)
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'invoices', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'invoices' por customerId, status, fecha
 * - Eliminar: Usar Firestore deleteDoc() (raro, usualmente mantener para contabilidad)
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface Invoice {
  id: string;
  number?: string; // accounting sequence - secuencia contable
  workOrderId?: string; // optional link - enlace opcional
  customerId: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency?: import('./types').Currency;
  status: import('./types').InvoiceStatus;
  dueDate?: Timestamp;
  paidAt?: Timestamp;
  payments?: Payment[]; // denormalized list of payments - lista desnormalizada de pagos
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Payment Model - Payment records for invoices.
 *
 * Purpose: Tracks individual payments made against invoices, including method,
 * amount, and transaction details.
 *
 * Propósito: Rastrea pagos individuales realizados contra facturas, incluyendo método,
 * monto y detalles de transacción.
 *
 * CRUD Operations:
 * - Save: Use Firestore addDoc() with collection 'payments', auto-generated id
 * - Query: Use Firestore query() on 'payments' collection by invoiceId, paidBy
 * - Delete: Use Firestore deleteDoc() for payment reversals
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore addDoc() con colección 'payments', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'payments' por invoiceId, paidBy
 * - Eliminar: Usar Firestore deleteDoc() para reversiones de pago
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface Payment {
  id: string;
  invoiceId?: string;
  amount: number;
  method: import('./types').PaymentMethod;
  transactionRef?: string; // card auth etc - autenticación de tarjeta, etc.
  paidBy?: string; // user id who recorded - id de usuario que registró
  paidAt: Timestamp;
}
