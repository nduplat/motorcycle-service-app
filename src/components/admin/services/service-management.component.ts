
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EnhancedServiceListComponent } from './enhanced-service-list.component';

@Component({
  selector: 'app-service-management',
  template: '<app-enhanced-service-list></app-enhanced-service-list>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EnhancedServiceListComponent],
})
export class ServiceManagementComponent {
}
