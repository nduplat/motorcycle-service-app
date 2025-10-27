import { Timestamp, FieldValue } from 'firebase/firestore';

/**
 * Firebase Timestamp and FieldValue types for consistent date/time handling across the application.
 * Used for all timestamp fields in models to ensure compatibility with Firestore operations.
 *
 * Tipos Timestamp y FieldValue de Firebase para manejo consistente de fecha/hora en la aplicación.
 * Se utiliza en todos los campos de timestamp en los modelos para asegurar compatibilidad con operaciones de Firestore.
 */
export { Timestamp, FieldValue };

/**
 * User roles in the motorcycle workshop system.
 * Defines access levels and permissions for different user types.
 *
 * Roles de usuario en el sistema del taller de motocicletas.
 * Define niveles de acceso y permisos para diferentes tipos de usuarios.
 */
export type Role = "admin" | "technician" | "customer";

/**
 * Supported currencies for pricing and transactions.
 * COP (Colombian Peso) and USD are primary, but allows custom currencies.
 *
 * Monedas soportadas para precios y transacciones.
 * COP (Peso Colombiano) y USD son primarias, pero permite monedas personalizadas.
 */
export type Currency = "COP" | "USD" | string;

/**
 * Payment methods accepted by the workshop.
 * Used in invoices and payment records.
 *
 * Métodos de pago aceptados por el taller.
 * Se utiliza en facturas y registros de pagos.
 */
export type PaymentMethod = "cash" | "card" | "bank_transfer" | "mobile_pay" | "credit" | "other";

/**
 * Statuses for invoices throughout their lifecycle.
 * Tracks payment and issuance state.
 *
 * Estados de las facturas a lo largo de su ciclo de vida.
 * Rastrea el estado de pago y emisión.
 */
export type InvoiceStatus = "draft" | "issued" | "paid" | "partially_paid" | "cancelled" | "refunded";

/**
 * Statuses for work orders in the repair process.
 * Indicates current state of vehicle repair/service.
 *
 * Estados de las órdenes de trabajo en el proceso de reparación.
 * Indica el estado actual de reparación/servicio del vehículo.
 */
export type WorkOrderStatus = "open" | "in_progress" | "waiting_parts" | "ready_for_pickup" | "delivered" | "cancelled";

/**
 * Motorcycle engine displacement categories.
 * Used for categorization and filtering of motorcycles.
 *
 * Categorías de cilindrada de motores de motocicletas.
 * Se utiliza para categorización y filtrado de motocicletas.
 */
export type MotorcycleCategory = "bajo_cc" | "mediano_cc" | "alto_cc";

/**
 * Motorcycle body types/styles.
 * Comprehensive list covering all major motorcycle categories.
 *
 * Tipos/cuerpos de motocicletas.
 * Lista completa que cubre todas las categorías principales de motocicletas.
 */
export type MotorcycleType = "naked" | "sport" | "touring" | "cruiser" | "off_road" | "adventure" | "scooter" | "cafe_racer" | "bobber" | "chopper" | "custom" | "vintage";

/**
 * Fuel types for motorcycles.
 * Includes traditional and emerging fuel technologies.
 *
 * Tipos de combustible para motocicletas.
 * Incluye tecnologías tradicionales y emergentes de combustible.
 */
export type MotorcycleFuelType = "gasoline" | "electric" | "hybrid";

/**
 * Transmission types for motorcycles.
 * Covers manual, automatic, and semi-automatic options.
 *
 * Tipos de transmisión para motocicletas.
 * Cubre opciones manuales, automáticas y semi-automáticas.
 */
export type MotorcycleTransmission = "manual" | "automatic" | "semi_automatic";

/**
 * Statuses for queue entries in the workshop queue system.
 * Tracks customer position and service state.
 *
 * Estados de las entradas de cola en el sistema de cola del taller.
 * Rastrea la posición del cliente y el estado del servicio.
 */
export type QueueEntryStatus = "waiting" | "called" | "in_service" | "served" | "cancelled" | "no_show";

/**
 * Service types for queue entries.
 * Distinguishes between scheduled appointments and direct walk-ins.
 *
 * Tipos de servicio para entradas de cola.
 * Distingue entre citas programadas y llegadas directas.
 */
/**
 * Utility function to convert Firebase timestamp types to JavaScript Date.
 * Handles Date, Timestamp, and FieldValue types safely.
 *
 * Función de utilidad para convertir tipos de timestamp de Firebase a JavaScript Date.
 * Maneja tipos Date, Timestamp y FieldValue de forma segura.
 */
export function toDate(value: Date | Timestamp | FieldValue): Date {
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as Timestamp).toDate();
  }
  // For FieldValue or other cases, return current date as fallback
  console.warn('Unable to convert timestamp value to Date:', value);
  return new Date();
}
export type QueueServiceType = "appointment" | "direct_work_order";