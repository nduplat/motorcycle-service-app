import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MotorcycleService } from '../../../services/motorcycle.service';
import { WorkOrderService } from '../../../services/work-order.service';
import { ProductService } from '../../../services/product.service';
import { Motorcycle, WorkOrder, Product } from '../../../models';

interface ProductUsage {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  workOrderDate: Date;
  workOrderId: string;
}

@Component({
  selector: 'app-inventory-reports',
  templateUrl: './inventory-reports.component.html',
  styleUrls: ['./inventory-reports.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule]
})
export class InventoryReportsComponent implements OnInit {
  private motorcycleService = inject(MotorcycleService);
  private workOrderService = inject(WorkOrderService);
  private productService = inject(ProductService);

  motorcycles = this.motorcycleService.getMotorcycles();
  workOrders = this.workOrderService.getWorkOrders();
  products = this.productService.getProducts();

  selectedVehicleId = signal<string | null>(null);
  searchQuery = signal('');

  filteredMotorcycles = computed(() => {
    const query = this.searchQuery().toLowerCase();
    return this.motorcycles().filter(motorcycle =>
      motorcycle.brand.toLowerCase().includes(query) ||
      motorcycle.model.toLowerCase().includes(query) ||
      motorcycle.plate?.toLowerCase().includes(query)
    );
  });

  selectedVehicle = computed(() => {
    const id = this.selectedVehicleId();
    return id ? this.motorcycles().find(m => m.id === id) : null;
  });

  vehicleWorkOrders = computed(() => {
    const vehicleId = this.selectedVehicleId();
    if (!vehicleId) return [];
    return this.workOrders().filter(wo => wo.plate === vehicleId);
  });

  productUsages = computed(() => {
    const workOrders = this.vehicleWorkOrders();
    const usages: ProductUsage[] = [];

    workOrders.forEach(wo => {
      wo.products.forEach(productId => {
        const product = this.products().find(p => p.id === productId);
        if (product) {
          usages.push({
            productId,
            productName: product.name,
            quantity: 1, // Assuming 1 per product in array, but could be more complex
            price: product.price,
            workOrderDate: wo.createdAt.toDate(),
            workOrderId: wo.id
          });
        }
      });
    });

    return usages;
  });

  totalQuantity = computed(() => {
    return this.productUsages().reduce((sum, usage) => sum + usage.quantity, 0);
  });

  totalCost = computed(() => {
    return this.productUsages().reduce((sum, usage) => sum + (usage.quantity * usage.price), 0);
  });

  ngOnInit(): void {
    // Component initialization if needed
  }

  selectVehicle(vehicleId: string): void {
    this.selectedVehicleId.set(vehicleId);
  }

  clearSelection(): void {
    this.selectedVehicleId.set(null);
  }

  updateSearch(query: string): void {
    this.searchQuery.set(query);
  }
}