import { Product } from '../models';

export interface ProductFilterOptions {
  search?: string;
  categoryId?: string;
  brand?: string;
  workshopLocationId?: string;
  stockStatus?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  priceRange?: { min: number; max: number };
  isActive?: boolean;
  lowStock?: boolean;
}

export function filterProducts(products: Product[], filters: ProductFilterOptions): Product[] {
  let filtered = [...products];

  if (filters.search) {
    const search = filters.search.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.sku?.toLowerCase().includes(search) ||
      p.brand?.toLowerCase().includes(search) ||
      p.description?.toLowerCase().includes(search)
    );
  }

  if (filters.categoryId) {
    filtered = filtered.filter(p => p.categoryId === filters.categoryId);
  }

  if (filters.brand) {
    filtered = filtered.filter(p => p.brand === filters.brand);
  }

  if (filters.workshopLocationId) {
    filtered = filtered.filter(p => p.workshopLocationId === filters.workshopLocationId);
  }

  if (filters.stockStatus && filters.stockStatus !== 'all') {
    filtered = filtered.filter(p => {
      const stock = p.stock || 0;
      const minStock = p.minStock || 0;

      switch (filters.stockStatus) {
        case 'out_of_stock':
          return stock === 0;
        case 'low_stock':
          return stock > 0 && stock <= minStock;
        case 'in_stock':
          return stock > minStock;
        default:
          return true;
      }
    });
  }

  if (filters.priceRange) {
    filtered = filtered.filter(p =>
      (p.sellingPrice || 0) >= filters.priceRange!.min &&
      (p.sellingPrice || 0) <= filters.priceRange!.max
    );
  }

  if (filters.isActive !== undefined) {
    filtered = filtered.filter(p => p.isActive === filters.isActive);
  }

  if (filters.lowStock) {
    filtered = filtered.filter(p => p.minStock && p.stock <= p.minStock);
  }

  return filtered;
}