
import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WorkOrderService } from '../../../services/work-order.service';
import { UserService } from '../../../services/user.service';
import { WorkOrder, WorkOrderStatus } from '../../../models';

@Component({
  selector: 'app-work-order-list',
  templateUrl: './work-order-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class WorkOrderListComponent {
  private workOrderService = inject(WorkOrderService);
  private userService = inject(UserService);
  
  private users = this.userService.getUsers();
  private userMap = computed(() => new Map(this.users().map(u => [u.id, u.name])));

  searchTerm = signal('');
  selectedStatus = signal<WorkOrderStatus | ''>('');

  statuses: WorkOrderStatus[] = ['open', 'in_progress', 'waiting_parts', 'ready_for_pickup', 'delivered', 'cancelled'];

  private allWorkOrders = computed(() => {
    return this.workOrderService.getWorkOrders()().map(wo => ({
      ...wo,
      customerName: this.userMap().get(wo.clientId) || 'Desconocido',
    })).sort((a,b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
  });

  workOrders = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const status = this.selectedStatus();

    return this.allWorkOrders().filter(wo => {
      const termMatch = term === '' ||
                        wo.customerName.toLowerCase().includes(term) ||
                        (wo.number || '').toLowerCase().includes(term);
      const statusMatch = status === '' || wo.status === status;
      return termMatch && statusMatch;
    });
  });

  workOrdersWithComputedValues = computed(() => {
    return this.workOrders().map(wo => ({
      ...wo,
      statusClass: this.getStatusClass(wo.status),
      formattedTotal: this.formatCurrency(wo.totalPrice),
      formattedDate: this.formatDate(wo.createdAt)
    }));
  });

  updateSearchTerm(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  updateStatus(event: Event): void {
    this.selectedStatus.set((event.target as HTMLSelectElement).value as WorkOrderStatus | '');
  }

  getStatusClass(status: WorkOrder['status']): string {
    const statusClasses = {
      open: 'bg-gray-200 text-gray-800',
      in_progress: 'bg-blue-200 text-blue-800',
      waiting_parts: 'bg-yellow-200 text-yellow-800',
      ready_for_pickup: 'bg-green-200 text-green-800',
      delivered: 'bg-purple-200 text-purple-800',
      cancelled: 'bg-red-200 text-red-800',
    };
    return statusClasses[status] || 'bg-gray-200 text-gray-800';
  }

  formatCurrency(value: number | undefined): string {
    if (value === undefined) return 'N/A';
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
