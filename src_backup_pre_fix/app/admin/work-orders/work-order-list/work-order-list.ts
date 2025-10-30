import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkOrderService } from '../../../../services/work-order.service';
import { WorkOrder } from '../../../../models/index';

@Component({
  selector: 'app-work-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './work-order-list.html'
})
export class WorkOrderListComponent {
  workOrders: WorkOrder[] = [];
  filteredWorkOrders: WorkOrder[] = [];
  selectedStatus: string = '';

  private workOrderService = inject(WorkOrderService);
  private router = inject(Router);

  constructor() {
    effect(() => {
      const orders = this.workOrderService.getWorkOrders()();
      this.workOrders = orders;
      this.filteredWorkOrders = orders;
    });
  }

  filterWorkOrders(): void {
    if (this.selectedStatus) {
      this.filteredWorkOrders = this.workOrders.filter(order => order.status === this.selectedStatus);
    } else {
      this.filteredWorkOrders = this.workOrders;
    }
  }

  navigateToEdit(orderId: string): void {
    this.router.navigate(['/admin/work-orders/edit', orderId]);
  }

  createNewWorkOrder(): void {
    this.router.navigate(['/admin/work-orders/new']);
  }
}