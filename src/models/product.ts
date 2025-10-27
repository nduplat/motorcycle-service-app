import { Timestamp } from './types';

/**
 * Product Model - Represents parts and products in inventory.
 *
 * Purpose: Manages workshop inventory including parts, accessories, and consumables.
 * Tracks stock levels, pricing, and compatibility with motorcycles.
 *
 * Propósito: Gestiona el inventario del taller incluyendo partes, accesorios y consumibles.
 * Rastrea niveles de stock, precios y compatibilidad con motocicletas.
 *
 * CRUD Operations:
 * - Save: Use Firestore setDoc() with collection 'products', auto-generated id
 * - Query: Use Firestore query() on 'products' collection with filters (category, brand, stock)
 * - Delete: Use Firestore deleteDoc() (soft delete recommended via isActive flag)
 *
 * Operaciones CRUD:
 * - Guardar: Usar Firestore setDoc() con colección 'products', id auto-generado
 * - Consultar: Usar Firestore query() en colección 'products' con filtros (categoría, marca, stock)
 * - Eliminar: Usar Firestore deleteDoc() (borrado suave recomendado vía flag isActive)
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface Product {
  id: string; // Firestore doc id (collection: products)
  name: string;
  description?: string;
  price: number;
  stock: number;
  compatibleBrands: string[];
  compatibleModels: string[];
  // Legacy field, kept for backward compatibility
  compatibility?: string[];
  images?: string[];
  dimensionsCm?: { w?: number; h?: number; d?: number };
  workshopLocationId?: string;
  brand?: string;
  sku?: string;
  minStock?: number;
  isActive?: boolean;
  categoryId?: string;
  sellingPrice?: number;
  barcode?: string;
  variants?: ProductVariant[];
  reservedStock?: number;
  purchasePrice?: number;
  taxPercent?: number;
}

/**
 * ProductVariant - Variations of a base product.
 *
 * Purpose: Handles product variations like different sizes, colors, or specifications
 * while maintaining a single product record.
 *
 * Propósito: Maneja variaciones de producto como diferentes tamaños, colores o especificaciones
 * mientras mantiene un único registro de producto.
 *
 * CRUD Operations:
 * - Save: Updated as part of Product document in variants array
 * - Query: Retrieved as part of Product document
 * - Delete: Removed from variants array in Product update
 *
 * Operaciones CRUD:
 * - Guardar: Actualizado como parte del documento Product en array variants
 * - Consultar: Recuperado como parte del documento Product
 * - Eliminar: Removido del array variants en actualización de Product
 *
 * References: Exported from src/models/index.ts
 * Referencias: Exportado desde src/models/index.ts
 */
export interface ProductVariant {
  id: string;
  name?: string; // e.g., "left/right", "size L" - ej. "izquierda/derecha", "talla L"
  sku?: string;
  stock?: number;
  additionalPrice?: number; // price delta over base product - precio delta sobre producto base
  attributes?: Record<string, any>;
}