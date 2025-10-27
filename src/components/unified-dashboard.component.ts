import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { AdminDashboardComponent } from './admin/admin-dashboard.component';
import { EmployeeDashboardComponent } from './employee/employee-dashboard.component';
import { CapacityDashboardComponent } from './admin/capacity-dashboard/capacity-dashboard.component';
import { Role } from '../models';

@Component({
  selector: 'app-unified-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    AdminDashboardComponent,
    EmployeeDashboardComponent,
    CapacityDashboardComponent
  ],
  template: `
    @if(isAdminOrManager()) {
      <div class="space-y-8">
        <app-admin-dashboard></app-admin-dashboard>
        <hr class="my-8 border-t-2 border-dashed border-border"/>
        <app-capacity-dashboard></app-capacity-dashboard>
      </div>
    } @else if(isStaff()) {
      <app-employee-dashboard></app-employee-dashboard>
    } @else {
      <div class="p-8 text-center">
        <h1 class="text-2xl font-bold text-destructive">Acceso No Autorizado</h1>
        <p class="text-muted-foreground">No tienes los permisos necesarios para ver este dashboard.</p>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UnifiedDashboardComponent {
  private authService = inject(AuthService);
  private currentUser = this.authService.currentUser;

  private adminRoles: Role[] = ['admin'];
  private staffRoles: Role[] = ['technician'];

  isAdminOrManager = computed(() => {
    const userRole = this.currentUser()?.role;
    return userRole ? this.adminRoles.includes(userRole) : false;
  });

  isStaff = computed(() => {
    const userRole = this.currentUser()?.role;
    return userRole ? this.staffRoles.includes(userRole) : false;
  });
}
