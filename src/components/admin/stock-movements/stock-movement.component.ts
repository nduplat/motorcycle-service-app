import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StockMovementService } from '../../../services/stock-movement.service';
import { ProductService } from '../../../services/product.service';
import { UserService } from '../../../services/user.service';
import { StockMovement } from '../../../models';

@Component({
  selector: 'app-stock-movement',
  templateUrl: './stock-movement.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class StockMovementComponent {
  private stockMovementService = inject(StockMovementService);
  private productService = inject(ProductService);
  private userService = inject(UserService);
  
  private products = this.productService.getProducts();
  private users = this.userService.getUsers();

  private productMap = computed(() => new Map(this.products().map(p => [p.id, p.name])));
  private userMap = computed(() => new Map(this.users().map(u => [u.id, u.name])));

  stockMovements = computed(() => {
    return this.stockMovementService.getStockMovements()().map(m => {
      const product = this.products().find(p => p.id === m.productId);
      let variantName = '';
      if (m.variantId && product?.variants) {
        const variant = product.variants.find(v => v.id === m.variantId);
        if (variant) {
          variantName = variant.name || '';
        }
      }

      return {
        ...m,
        productName: this.productMap().get(m.productId) || 'Producto Desconocido',
        userName: m.createdBy ? (this.userMap().get(m.createdBy) || 'Sistema') : 'Sistema',
        variantName: variantName
      };
    });
  });
  
  getTypeClass(type: StockMovement['type']): string {
    const typeClasses = {
      purchase: 'bg-green-200 text-green-800',
      sale: 'bg-blue-200 text-blue-800',
      adjustment: 'bg-yellow-200 text-yellow-800',
      return: 'bg-purple-200 text-purple-800',
      waste: 'bg-red-200 text-red-800',
      transfer: 'bg-indigo-200 text-indigo-800',
      reservation: 'bg-gray-200 text-gray-800'
    };
    return typeClasses[type] || 'bg-gray-200 text-gray-800';
  }

  formatDate(date: { toDate: () => Date }): string {
    return date.toDate().toLocaleString('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }
}
