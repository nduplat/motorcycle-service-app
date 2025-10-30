import { Injectable, signal, computed } from '@angular/core';
import { ProductService } from './product.service';
import { CategoryService } from './category.service';
import { SupplierService } from './supplier.service';
import { Product } from '../models';
import { db } from '../firebase.config';
import { writeBatch, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { filterProducts, ProductFilterOptions } from '../utils/product-filters';

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  brand?: string;
  stockStatus?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  priceRange?: { min: number; max: number };
  isActive?: boolean;
}

export interface ProductSort {
  field: 'name' | 'sku' | 'brand' | 'categoryId' | 'stock' | 'sellingPrice';
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdvancedProductService {
  // Filter and sort state
  private currentFilters = signal<ProductFilters>({});
  private currentSort = signal<ProductSort>({ field: 'name', direction: 'asc' });
  private currentPagination = signal<PaginationOptions>({ page: 1, pageSize: 10 });

  // Selected products for bulk operations
  private selectedProductIds = signal<Set<string>>(new Set());

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private supplierService: SupplierService
  ) {}

  // Get data from services
  private allProducts = computed(() => this.productService.getProducts()());
  private allCategories = computed(() => this.categoryService.getCategories()());
  private allSuppliers = computed(() => this.supplierService.getSuppliers()());

  // Filtered and sorted products
  filteredProducts = computed(() => {
    const products = this.allProducts();

    // Apply filters using shared utility
    const filters = this.currentFilters();
    const filterOptions: ProductFilterOptions = {
      search: filters.search,
      categoryId: filters.categoryId,
      brand: filters.brand,
      stockStatus: filters.stockStatus,
      priceRange: filters.priceRange,
      isActive: filters.isActive
    };

    let filteredProducts = filterProducts(products, filterOptions);

    // Apply sorting
    const sort = this.currentSort();
    filteredProducts.sort((a, b) => {
      let aValue: any = a[sort.field];
      let bValue: any = b[sort.field];


      if (sort.field === 'categoryId') {
        const aCategory = this.allCategories().find((c: any) => c.id === a.categoryId)?.name || '';
        const bCategory = this.allCategories().find((c: any) => c.id === b.categoryId)?.name || '';
        aValue = aCategory;
        bValue = bCategory;
      }

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sort.direction === 'asc' ? -1 : 1;
      if (bValue == null) return sort.direction === 'asc' ? 1 : -1;

      // Compare values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filteredProducts;
  });

  // Paginated products
  paginatedProducts = computed(() => {
    const products = this.filteredProducts();
    const pagination = this.currentPagination();

    const startIndex = (pagination.page - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;

    return products.slice(startIndex, endIndex);
  });

  // Pagination metadata
  paginationMeta = computed(() => {
    const totalItems = this.filteredProducts().length;
    const pagination = this.currentPagination();

    return {
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pagination.pageSize),
      hasNextPage: pagination.page < Math.ceil(totalItems / pagination.pageSize),
      hasPreviousPage: pagination.page > 1,
      startIndex: (pagination.page - 1) * pagination.pageSize + 1,
      endIndex: Math.min(pagination.page * pagination.pageSize, totalItems)
    };
  });

  // Statistics
  statistics = computed(() => {
    const products = this.allProducts();
    const filteredProducts = this.filteredProducts();

    return {
      totalProducts: products.length,
      filteredProducts: filteredProducts.length,
      activeProducts: products.filter((p: any) => p.isActive).length,
      inactiveProducts: products.filter((p: any) => !p.isActive).length,
      outOfStockProducts: products.filter((p: any) => (p.stock || 0) === 0).length,
      lowStockProducts: products.filter((p: any) => {
        const stock = p.stock || 0;
        const minStock = p.minStock || 0;
        return stock > 0 && stock <= minStock;
      }).length,
      totalValue: products.reduce((sum: number, p: any) => sum + ((p.stock || 0) * (p.sellingPrice || 0)), 0),
      averagePrice: products.length > 0 ? products.reduce((sum: number, p: any) => sum + (p.sellingPrice || 0), 0) / products.length : 0
    };
  });

  // Filter methods
  setFilters(filters: Partial<ProductFilters>): void {
    this.currentFilters.update(current => ({ ...current, ...filters }));
    this.resetPagination();
  }

  clearFilters(): void {
    this.currentFilters.set({});
    this.resetPagination();
  }

  // Sort methods
  setSort(sort: ProductSort): void {
    this.currentSort.set(sort);
  }

  toggleSort(field: ProductSort['field']): void {
    const currentSort = this.currentSort();
    if (currentSort.field === field) {
      this.currentSort.update(sort => ({
        ...sort,
        direction: sort.direction === 'asc' ? 'desc' : 'asc'
      }));
    } else {
      this.currentSort.set({ field, direction: 'asc' });
    }
  }

  // Pagination methods
  setPage(page: number): void {
    this.currentPagination.update(pagination => ({ ...pagination, page }));
  }

  setPageSize(pageSize: number): void {
    this.currentPagination.update(pagination => ({ ...pagination, pageSize, page: 1 }));
  }

  nextPage(): void {
    const meta = this.paginationMeta();
    if (meta.hasNextPage) {
      this.setPage(meta.currentPage + 1);
    }
  }

  previousPage(): void {
    const meta = this.paginationMeta();
    if (meta.hasPreviousPage) {
      this.setPage(meta.currentPage - 1);
    }
  }

  private resetPagination(): void {
    this.currentPagination.update(pagination => ({ ...pagination, page: 1 }));
  }

  // Selection methods for bulk operations
  toggleProductSelection(productId: string): void {
    this.selectedProductIds.update(selected => {
      const newSelected = new Set(selected);
      if (newSelected.has(productId)) {
        newSelected.delete(productId);
      } else {
        newSelected.add(productId);
      }
      return newSelected;
    });
  }

  selectAllProducts(): void {
    const allProductIds = new Set(this.filteredProducts().map((p: any) => p.id));
    this.selectedProductIds.set(allProductIds);
  }

  clearSelection(): void {
    this.selectedProductIds.set(new Set());
  }

  isProductSelected(productId: string): boolean {
    return this.selectedProductIds().has(productId);
  }

  getSelectedProducts(): Product[] {
    const selectedIds = this.selectedProductIds();
    return this.allProducts().filter((p: any) => selectedIds.has(p.id));
  }

  getSelectedCount(): number {
    return this.selectedProductIds().size;
  }

  // Bulk operations
  async bulkActivateProducts(): Promise<void> {
    const selectedProducts = this.getSelectedProducts();
    const batch = writeBatch(db);

    for (const product of selectedProducts) {
      const docRef = doc(db, "products", product.id);
      batch.update(docRef, {
        isActive: true,
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();
    // Invalidate product service cache
    this.productService.invalidateCache();
    this.clearSelection();
  }

  async bulkDeactivateProducts(): Promise<void> {
    const selectedProducts = this.getSelectedProducts();
    const batch = writeBatch(db);

    for (const product of selectedProducts) {
      const docRef = doc(db, "products", product.id);
      batch.update(docRef, {
        isActive: false,
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();
    // Invalidate product service cache
    this.productService.invalidateCache();
    this.clearSelection();
  }

  async bulkDeleteProducts(): Promise<void> {
    const selectedProducts = this.getSelectedProducts();
    const batch = writeBatch(db);

    for (const product of selectedProducts) {
      const docRef = doc(db, "products", product.id);
      batch.delete(docRef);
    }

    await batch.commit();
    // Invalidate product service cache
    this.productService.invalidateCache();
    this.clearSelection();
  }



  // Getters for external access
  getCurrentFilters(): ProductFilters {
    return this.currentFilters();
  }

  getCurrentSort(): ProductSort {
    return this.currentSort();
  }

  getCurrentPagination(): PaginationOptions {
    return this.currentPagination();
  }

  getSelectedProductIds(): Set<string> {
    return this.selectedProductIds();
  }

  // Public getter for products
  get products(): any {
    return this.allProducts;
  }

  // CSV export functionality
  generateCSV(): string {
    const products = this.filteredProducts();
    if (products.length === 0) {
      return 'No hay productos para exportar';
    }

    // CSV headers
    const headers = [
      'Nombre',
      'SKU',
      'Marca',
      'Categoría',
      'Stock',
      'Precio de Venta',
      'Estado',
      'Stock Mínimo',
      'Descripción'
    ];

    // CSV rows
    const rows = products.map((product: any) => [
      product.name || '',
      product.sku || '',
      product.brand || '',
      this.getCategoryName(product.categoryId),
      product.stock || 0,
      product.sellingPrice || 0,
      product.isActive ? 'Activo' : 'Inactivo',
      product.minStock || 0,
      product.description || ''
    ]);

    // Combine headers and rows
    const csvData = [headers, ...rows];

    // Convert to CSV string
    return csvData.map(row =>
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  }

  private getCategoryName(categoryId: string | undefined): string {
    if (!categoryId) return 'N/A';
    const category = this.allCategories().find((c: any) => c.id === categoryId);
    return category?.name || 'Desconocida';
  }
}