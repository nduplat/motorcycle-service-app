import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../../models';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../services/auth.service';
import { CategoryService } from '../../services/category.service';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class InventoryComponent {
  private productService = inject(ProductService);
  private authService = inject(AuthService);
  private categoryService = inject(CategoryService);
  
  private allProducts = this.productService.getProducts();
  categories = this.categoryService.getCategories();

  searchTerm = signal('');
  selectedCategoryId = signal('');

  canAddProducts = computed(() => this.authService.hasRole(['admin']));

  products = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const categoryId = this.selectedCategoryId();
    
    if (!term && !categoryId) {
        return this.allProducts();
    }
    
    return this.allProducts().filter(product => {
      const nameMatch = term === '' || product.name.toLowerCase().includes(term);
      const categoryMatch = categoryId === '' || product.categoryId === categoryId;
      return nameMatch && categoryMatch;
    });
  });

  updateSearchTerm(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  updateCategory(event: Event): void {
    this.selectedCategoryId.set((event.target as HTMLSelectElement).value);
  }

  formatCurrency(value: number | undefined): string {
    if (value === undefined) return 'N/A';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  }

  getStockBadgeClass(stock: number | undefined): string {
    if(stock === undefined) return 'bg-gray-200 text-gray-800';
    if(stock <= 0) return 'bg-red-200 text-red-800';
    if(stock < 10) return 'bg-yellow-200 text-yellow-800';
    return 'bg-green-200 text-green-800';
  }
}
