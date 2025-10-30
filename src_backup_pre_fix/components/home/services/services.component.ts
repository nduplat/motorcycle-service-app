import { ChangeDetectionStrategy, Component, input, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServiceItem } from '../../../models';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-services',
  templateUrl: './services.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class ServicesComponent {
  services = input<ServiceItem[]>([]);
  private authService = inject(AuthService);
  appointmentLink = computed(() => this.authService.isCustomer() ? '/appointments' : '/login');
}
