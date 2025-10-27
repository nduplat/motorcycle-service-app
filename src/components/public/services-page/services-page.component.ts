import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServiceItemService } from '../../../services/service-item.service';
import { AuthService } from '../../../services/auth.service';
import { ChatbotComponent } from '../../shared/chatbot.component';

@Component({
  selector: 'app-services-page',
  imports: [RouterLink, ChatbotComponent],
  templateUrl: './services-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesPageComponent {
  private serviceItemService = inject(ServiceItemService);
  private authService = inject(AuthService);

  services = this.serviceItemService.getServices();
  appointmentLink = computed(() => this.authService.isCustomer() ? '/appointments' : '/login');

  formatCurrency(value: number | undefined): string {
    if (value === undefined) return 'Consultar';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  }

  onProductSelected(product: any) {
    console.log('Product selected:', product);
    // Handle product selection - could navigate to product detail or add to cart
  }
}
