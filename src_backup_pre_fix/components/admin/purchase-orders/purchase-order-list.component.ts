import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PurchaseOrderService } from '../../../services/purchase-order.service';
import { SupplierService } from '../../../services/supplier.service';
import { ProductService } from '../../../services/product.service';
import { PurchaseOrder } from '../../../models';

@Component({
  selector: 'app-purchase-order-list',
  templateUrl: './purchase-order-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class PurchaseOrderListComponent {
  private purchaseOrderService = inject(PurchaseOrderService);
  private supplierService = inject(SupplierService);
  private productService = inject(ProductService);

  private suppliers = this.supplierService.getSuppliers();
  private products = this.productService.getProducts();

  private supplierMap = computed(() => new Map(this.suppliers().map(s => [s.id, s.name])));
  private productMap = computed(() => new Map(this.products().map(p => [p.id, p])));
  
  purchaseOrders = computed(() => {
    return this.purchaseOrderService.getPurchaseOrders()().map(po => ({
      ...po,
      supplierName: this.supplierMap().get(po.supplierId) || 'Desconocido',
      totalCost: po.items.reduce((acc, item) => {
          const product = this.productMap().get(item.productId);
          const cost = item.unitCost ?? product?.purchasePrice ?? 0;
          return acc + (cost * item.qty);
      }, 0)
    })).sort((a,b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
  });

  getStatusClass(status: PurchaseOrder['status']): string {
    const statusClasses = {
      draft: 'bg-gray-200 text-gray-800',
      ordered: 'bg-blue-200 text-blue-800',
      received: 'bg-green-200 text-green-800',
      partially_received: 'bg-yellow-200 text-yellow-800',
      cancelled: 'bg-red-200 text-red-800',
    };
    return statusClasses[status] || 'bg-gray-200 text-gray-800';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  }
  
  formatDate(date: { toDate: () => Date }): string {
    return date.toDate().toLocaleDateString('es-CO', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }
}
