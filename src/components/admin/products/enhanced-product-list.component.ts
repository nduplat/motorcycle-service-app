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
              [attr.d]="currentSort().direction === 'asc'
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
  selector: 'app-enhanced-product-list',
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-3xl font-bold">Gestión Profesional de Productos</h1>
          <p class="text-muted-foreground mt-1">Sistema avanzado de inventario con filtros, ordenamiento y acciones masivas</p>
        </div>
        <div class="flex gap-3">
          <button
            (click)="exportToCSV()"
            class="px-4 py-2 bg-secondary text-secondary-foreground rounded-md font-medium hover:bg-secondary/80 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar CSV
          </button>
          <a routerLink="/admin/products/new" class="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nuevo Producto
          </a>
        </div>
      </div>

      <!-- Statistics Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="bg-card p-6 rounded-xl border border-border shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Total Productos</p>
              <p class="text-2xl font-bold">{{ statistics().totalProducts }}</p>
            </div>
            <div class="p-3 bg-blue-100 rounded-full">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-card p-6 rounded-xl border border-border shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Productos Activos</p>
              <p class="text-2xl font-bold text-green-600">{{ statistics().activeProducts }}</p>
            </div>
            <div class="p-3 bg-green-100 rounded-full">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-card p-6 rounded-xl border border-border shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Stock Bajo</p>
              <p class="text-2xl font-bold text-yellow-600">{{ statistics().lowStockProducts }}</p>
            </div>
            <div class="p-3 bg-yellow-100 rounded-full">
              <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-card p-6 rounded-xl border border-border shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Agotados</p>
              <p class="text-2xl font-bold text-red-600">{{ statistics().outOfStockProducts }}</p>
            </div>
            <div class="p-3 bg-red-100 rounded-full">
              <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Advanced Filters -->
      <div class="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Filtros Avanzados</h2>
          <button
            (click)="clearAllFilters()"
            class="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80">
            Limpiar Filtros
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Search -->
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Buscar</label>
            <input
              type="text"
              [value]="currentFilters().search || ''"
              (input)="updateFilter('search', $any($event.target).value)"
              placeholder="Nombre, SKU, marca..."
              class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm">
          </div>

          <!-- Category -->
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Categoría</label>
            <select
              [value]="currentFilters().categoryId || ''"
              (change)="updateFilter('categoryId', $any($event.target).value)"
              class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm">
              <option value="">Todas las categorías</option>
              @for(cat of categories(); track cat.id) {
                <option [value]="cat.id">{{ cat.name }}</option>
              }
            </select>
          </div>

          <!-- Brand -->
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Marca</label>
            <select
              [value]="currentFilters().brand || ''"
              (change)="updateFilter('brand', $any($event.target).value)"
              class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm">
              <option value="">Todas las marcas</option>
              @for(brand of availableBrands(); track brand) {
                <option [value]="brand">{{ brand }}</option>
              }
            </select>
          </div>

          <!-- Stock Status -->
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Estado de Stock</label>
            <select
              [value]="currentFilters().stockStatus || 'all'"
              (change)="updateFilter('stockStatus', $any($event.target).value)"
              class="w-full px-3 py-2 bg-background border border-border rounded-md text-sm">
              <option value="all">Todos</option>
              <option value="in_stock">En stock</option>
              <option value="low_stock">Stock bajo</option>
              <option value="out_of_stock">Agotado</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Bulk Actions Bar -->
      @if (selectedCount() > 0) {
        <div class="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium">{{ selectedCount() }} productos seleccionados</span>
              <button
                (click)="clearSelection()"
                class="text-xs text-primary hover:underline">
                Limpiar selección
              </button>
            </div>
            <div class="flex gap-2">
              <button
                (click)="bulkActivate()"
                class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                Activar
              </button>
              <button
                (click)="bulkDeactivate()"
                class="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700">
                Desactivar
              </button>
              <button
                (click)="bulkDelete()"
                class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Products Table -->
      <div class="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div class="border-b border-border px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <h2 class="text-lg font-semibold">Productos ({{ paginationMeta().totalItems }})</h2>
              @if (selectedCount() > 0) {
                <span class="text-sm text-muted-foreground">{{ selectedCount() }} seleccionados</span>
              }
            </div>
            <div class="flex items-center gap-2">
              <button
                (click)="selectAllVisible()"
                class="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80">
                Seleccionar visibles
              </button>
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left text-foreground">
            <thead class="bg-secondary/50">
              <tr>
                <th class="px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    [checked]="isAllSelected()"
                    (change)="toggleSelectAll()"
                    class="rounded border-border">
                </th>
                <th class="px-6 py-3">
                  <button
                    (click)="toggleSort('name')"
                    class="flex items-center gap-2 font-medium hover:text-primary">
                    Nombre
                    <app-sort-icon [field]="'name'" [currentSort]="currentSort()" />
                  </button>
                </th>
                <th class="px-6 py-3">
                  <button
                    (click)="toggleSort('sku')"
                    class="flex items-center gap-2 font-medium hover:text-primary">
                    SKU
                    <app-sort-icon [field]="'sku'" [currentSort]="currentSort()" />
                  </button>
                </th>
                <th class="px-6 py-3">
                  <button
                    (click)="toggleSort('brand')"
                    class="flex items-center gap-2 font-medium hover:text-primary">
                    Marca
                    <app-sort-icon [field]="'brand'" [currentSort]="currentSort()" />
                  </button>
                </th>
                <th class="px-6 py-3">Categoría</th>
                <th class="px-6 py-3">
                  <button
                    (click)="toggleSort('stock')"
                    class="flex items-center gap-2 font-medium hover:text-primary">
                    Stock
                    <app-sort-icon [field]="'stock'" [currentSort]="currentSort()" />
                  </button>
                </th>
                <th class="px-6 py-3">
                  <button
                    (click)="toggleSort('sellingPrice')"
                    class="flex items-center gap-2 font-medium hover:text-primary">
                    Precio
                    <app-sort-icon [field]="'sellingPrice'" [currentSort]="currentSort()" />
                  </button>
                </th>
                <th class="px-6 py-3">Estado</th>
                <th class="px-6 py-3">Variantes</th>
                <th class="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for(product of paginatedProducts(); track product.id) {
                <tr class="border-b border-border hover:bg-secondary/50">
                  <td class="px-4 py-4">
                    <input
                      type="checkbox"
                      [checked]="isProductSelected(product.id)"
                      (change)="toggleProductSelection(product.id)"
                      class="rounded border-border">
                  </td>
                  <td class="px-6 py-4 font-medium">{{ product.name }}</td>
                  <td class="px-6 py-4 font-mono text-sm">{{ product.sku || 'N/A' }}</td>
                  <td class="px-6 py-4">{{ product.brand || 'N/A' }}</td>
                  <td class="px-6 py-4">{{ getCategoryName(product.categoryId) }}</td>
                  <td class="px-6 py-4">
                    <span [class]="getStockBadgeClass(product)">
                      {{ product.stock || 0 }}
                    </span>
                  </td>
                  <td class="px-6 py-4">{{ formatCurrency(product.sellingPrice) }}</td>
                  <td class="px-6 py-4">
                    <span [class]="product.isActive ? 'text-green-600' : 'text-red-600'">
                      {{ product.isActive ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    @if (product.variants && product.variants.length > 0) {
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium">{{ product.variants.length }}</span>
                        <button
                          (click)="toggleVariants(product.id)"
                          class="text-xs text-primary hover:underline">
                          {{ expandedVariants().has(product.id) ? 'Ocultar' : 'Ver' }}
                        </button>
                      </div>
                    } @else {
                      <span class="text-sm text-muted-foreground">Sin variantes</span>
                    }
                  </td>
                  <td class="px-6 py-4 text-right">
                    <div class="flex gap-2 justify-end">
                      <a [routerLink]="['/admin/products', product.id, 'edit']" title="Editar" class="p-1 text-muted-foreground hover:text-primary">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
                        </svg>
                      </a>
                      <button (click)="deleteProduct(product.id)" title="Eliminar" class="p-1 text-muted-foreground hover:text-destructive">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- Variants Row -->
                @if (expandedVariants().has(product.id) && product.variants) {
                  <tr class="bg-secondary/20">
                    <td colspan="10" class="px-6 py-4">
                      <div class="space-y-3">
                        <h4 class="font-medium text-sm">Variantes de {{ product.name }}</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          @for(variant of product.variants; track variant.id) {
                            <div class="bg-background border border-border rounded-lg p-3">
                              <div class="flex justify-between items-start mb-2">
                                <span class="font-medium text-sm">{{ variant.name }}</span>
                                <span [class]="getVariantStockBadgeClass(variant)" class="text-xs px-2 py-1 rounded">
                                  Stock: {{ variant.stock || 0 }}
                                </span>
                              </div>
                              @if (variant.sku) {
                                <p class="text-xs text-muted-foreground">SKU: {{ variant.sku }}</p>
                              }
                              @if (variant.additionalPrice) {
                                <p class="text-xs text-green-600">+{{ formatCurrency(variant.additionalPrice) }}</p>
                              }
                              @if (variant.attributes && Object.keys(variant.attributes).length > 0) {
                                <div class="mt-2">
                                  @for(attr of Object.keys(variant.attributes); track attr) {
                                    <span class="inline-block text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded mr-1 mb-1">
                                      {{ attr }}: {{ variant.attributes[attr] }}
                                    </span>
                                  }
                                </div>
                              }
                            </div>
                          }
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              } @empty {
                <tr>
                  <td colspan="10" class="text-center py-16 text-muted-foreground">
                    <div class="space-y-2">
                      <svg class="w-12 h-12 mx-auto text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <p>No se encontraron productos con los filtros aplicados.</p>
                      <button (click)="clearAllFilters()" class="text-primary hover:underline text-sm">
                        Limpiar filtros
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <app-pagination
          [meta]="paginationMeta()"
          (pageChange)="onPageChange($event)"
          (pageSizeChange)="onPageSizeChange($event)" />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PaginationComponent, SortIconComponent],
})
export class EnhancedProductListComponent {
  private advancedProductService = inject(AdvancedProductService);
  private categoryService = inject(CategoryService);
  private supplierService = inject(SupplierService);

  // Reactive data
  paginatedProducts = this.advancedProductService.paginatedProducts;
  paginationMeta = this.advancedProductService.paginationMeta;
  statistics = this.advancedProductService.statistics;
  currentFilters = computed(() => this.advancedProductService.getCurrentFilters());
  currentSort = computed(() => this.advancedProductService.getCurrentSort());
  selectedCount = computed(() => this.advancedProductService.getSelectedCount());

  // Local state
  expandedVariants = signal<Set<string>>(new Set());
  categories = this.categoryService.getCategories();

  availableBrands = computed(() => {
    const products = this.advancedProductService.products();
    const brands = new Set<string>();
    products.forEach((p: any) => {
      if (p.brand) brands.add(p.brand);
    });
    return Array.from(brands).sort();
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

  getCategoryName(categoryId: string | undefined): string {
    if (!categoryId) return 'N/A';
    const category = this.categories().find(c => c.id === categoryId);
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
    this.advancedProductService.exportToCSV();
  }
}
