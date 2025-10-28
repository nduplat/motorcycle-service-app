import { ChangeDetectionStrategy, Component, inject, computed, signal, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdvancedProductService, ProductFilters, ProductSort } from '../../../services/advanced-product.service';
import { CategoryService } from '../../../services/category.service';
import { SupplierService } from '../../../services/supplier.service';
import { Product } from '../../../models';
import { PaginationComponent } from '../../shared/ui/pagination.component';

// Sort Icon Component
@Component({
  selector: 'app-sort-icon',
  template: `
    @if (isActive()) {
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              [attr.d]="currentSort.direction === 'asc'
                ? 'M5 15l7-7 7 7'
                : 'M19 9l-7 7-7-7'" />
      </svg>
    } @else {
      <svg class="w-4 h-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortIconComponent {
  field = input.required<string>();
  currentSort = input.required<ProductSort>();

  isActive = computed(() => this.currentSort().field === this.field());
}

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PaginationComponent, SortIconComponent],
})
export class ProductListComponent {
  private advancedProductService = inject(AdvancedProductService);
  private categoryService = inject(CategoryService);
  private supplierService = inject(SupplierService);

  // Reactive data from service
  paginatedProducts = this.advancedProductService.paginatedProducts;
  paginationMeta = this.advancedProductService.paginationMeta;
  statistics = this.advancedProductService.statistics;
  currentFilters = computed(() => this.advancedProductService.getCurrentFilters());
  currentSort = computed(() => this.advancedProductService.getCurrentSort());
  selectedCount = computed(() => this.advancedProductService.getSelectedCount());

  // Local state
  expandedVariants = signal<Set<string>>(new Set());
  categories = this.categoryService.getCategories();
  suppliers = this.supplierService.getSuppliers();

  availableBrands = computed(() => {
    const products = this.advancedProductService.products();
    const brands = new Set<string>();
    products.forEach((p: any) => {
      if (p.brand) brands.add(p.brand);
    });
    return Array.from(brands).sort();
  });

  // Cached computed values for template optimization
  categoryNames = computed(() => {
    const categoryMap = new Map<string, string>();
    this.categories().forEach(cat => {
      categoryMap.set(cat.id, cat.name);
    });
    return categoryMap;
  });

  productsWithComputedValues = computed(() => {
    return this.paginatedProducts().map(product => ({
      ...product,
      categoryName: this.categoryNames().get(product.categoryId || '') || 'N/A',
      stockBadgeClass: this.getStockBadgeClass(product),
      formattedPrice: this.formatCurrency(product.sellingPrice),
      variantsWithComputedValues: product.variants?.map(variant => ({
        ...variant,
        stockBadgeClass: this.getVariantStockBadgeClass(variant),
        formattedAdditionalPrice: variant.additionalPrice ? this.formatCurrency(variant.additionalPrice) : 'N/A'
      })) || []
    }));
  });

  isProductSelected(productId: string): boolean {
    return this.advancedProductService.isProductSelected(productId);
  }

  isAllSelected(): boolean {
    const visibleProducts = this.paginatedProducts();
    if (visibleProducts.length === 0) return false;
    return visibleProducts.every((p: any) => this.isProductSelected(p.id));
  }

  toggleProductSelection(productId: string): void {
    this.advancedProductService.toggleProductSelection(productId);
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.paginatedProducts().forEach(p => {
        if (this.isProductSelected(p.id)) {
          this.toggleProductSelection(p.id);
        }
      });
    } else {
      this.paginatedProducts().forEach((p: any) => {
        if (!this.isProductSelected(p.id)) {
          this.toggleProductSelection(p.id);
        }
      });
    }
  }

  selectAllVisible(): void {
    this.advancedProductService.selectAllProducts();
  }

  clearSelection(): void {
    this.advancedProductService.clearSelection();
  }

  updateFilter(key: keyof ProductFilters, value: any): void {
    const filters = { ...this.currentFilters() };
    if (value === '' || value === null || value === undefined) {
      delete filters[key];
    } else {
      (filters as any)[key] = value;
    }
    this.advancedProductService.setFilters(filters);
  }

  clearAllFilters(): void {
    this.advancedProductService.clearFilters();
  }

  toggleSort(field: ProductSort['field']): void {
    this.advancedProductService.toggleSort(field);
  }

  onPageChange(page: number): void {
    this.advancedProductService.setPage(page);
  }

  onPageSizeChange(pageSize: number): void {
    this.advancedProductService.setPageSize(pageSize);
  }

  toggleVariants(productId: string): void {
    this.expandedVariants.update(expanded => {
      const newExpanded = new Set(expanded);
      if (newExpanded.has(productId)) {
        newExpanded.delete(productId);
      } else {
        newExpanded.add(productId);
      }
      return newExpanded;
    });
  }

  getCategoryName(id: string | undefined): string {
    if (!id) return 'N/A';
    const category = this.categories().find(c => c.id === id);
    return category?.name || 'Desconocida';
  }

  getStockBadgeClass(product: Product): string {
    const stock = product.stock || 0;
    const minStock = product.minStock || 0;

    if (stock === 0) return 'px-2 py-1 text-xs font-medium rounded-full bg-red-200 text-red-800';
    if (stock <= minStock) return 'px-2 py-1 text-xs font-medium rounded-full bg-yellow-200 text-yellow-800';
    return 'px-2 py-1 text-xs font-medium rounded-full bg-green-200 text-green-800';
  }

  getVariantStockBadgeClass(variant: any): string {
    const stock = variant.stock || 0;
    if (stock === 0) return 'bg-red-100 text-red-800';
    if (stock <= 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  }

  formatCurrency(value: number | undefined): string {
    if (value === undefined) return 'N/A';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  }

  bulkActivate(): void {
    if (confirm(`¿Activar ${this.selectedCount()} productos seleccionados?`)) {
      this.advancedProductService.bulkActivateProducts();
    }
  }

  bulkDeactivate(): void {
    if (confirm(`¿Desactivar ${this.selectedCount()} productos seleccionados?`)) {
      this.advancedProductService.bulkDeactivateProducts();
    }
  }

  bulkDelete(): void {
    if (confirm(`¿Eliminar permanentemente ${this.selectedCount()} productos seleccionados? Esta acción no se puede deshacer.`)) {
      this.advancedProductService.bulkDeleteProducts();
    }
  }

  deleteProduct(productId: string): void {
    if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
      this.advancedProductService.bulkDeleteProducts();
    }
  }

  exportToCSV(): void {
    const products = this.advancedProductService.filteredProducts();
    const categories = this.categoryService.getCategories()();
    const categoryMap = new Map<string, string>();
    categories.forEach(cat => {
      categoryMap.set(cat.id, cat.name);
    });

    const headers = [
      'Nombre',
      'SKU',
      'Marca',
      'Categoría',
      'Precio Venta',
      'Stock',
      'Stock Mínimo',
      'Estado',
      'Fecha Creación'
    ];

    const csvData = products.map((product: any) => [
      product.name,
      product.sku || '',
      product.brand || '',
      categoryMap.get(product.categoryId) || '',
      product.sellingPrice || 0,
      product.stock || 0,
      product.minStock || 0,
      product.isActive ? 'Activo' : 'Inactivo',
      product.createdAt?.toDate?.()?.toLocaleDateString('es-CO') || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `productos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
