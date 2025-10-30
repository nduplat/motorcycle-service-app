/**
 * Client Flow Guard
 *
 * Guards the client flow routes to ensure:
 * - User is authenticated
 * - User has appropriate role (customer)
 * - Flow state is properly initialized
 * - Prevents unauthorized access to the flow
 */

import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ClientFlowService } from '../services/client-flow.service';
import { UserVehicleService } from '../services/user-vehicle.service';

@Injectable({
  providedIn: 'root'
})
export class ClientFlowGuard implements CanActivate {
  private authService = inject(AuthService);
  private flowService = inject(ClientFlowService);
  private userVehicleService = inject(UserVehicleService);
  private router = inject(Router);

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    try {
      // Wait for authentication to be resolved
      await this.authService.waitForAuth();

      const currentUser = this.authService.currentUser();

      // Check if user is authenticated
      if (!currentUser) {
        console.log('ClientFlowGuard: User not authenticated, redirecting to login');
        // Guardar origen QR si existe
        const source = route.queryParams['source'];
        const location = route.queryParams['location'];

        this.router.navigate(['/login'], {
          queryParams: {
            returnUrl: '/queue/join',
            source,
            location
          }
        });
        return false;
      }

      // Check if user has customer role
      const allowedRoles = ['customer'];
      if (!allowedRoles.includes(currentUser.role)) {
        console.log('ClientFlowGuard: User does not have required role:', currentUser.role);
        this.router.navigate(['/'], {
          queryParams: { error: 'access_denied' }
        });
        return false;
      }

      // Check if user has registered motorcycles (complete profile)
      try {
        const userVehicles = await this.userVehicleService.getVehiclesForUser(currentUser.id).toPromise();
        if (!userVehicles || userVehicles.length === 0) {
          console.log('ClientFlowGuard: User has no registered motorcycles, redirecting to account setup');
          this.router.navigate(['/account'], {
            queryParams: { error: 'incomplete_profile', message: 'Debes registrar al menos una motocicleta para acceder al flujo de cliente' }
          });
          return false;
        }
        console.log('ClientFlowGuard: User has', userVehicles.length, 'registered motorcycles');
      } catch (error) {
        console.error('ClientFlowGuard: Error checking user vehicles:', error);
        this.router.navigate(['/'], {
          queryParams: { error: 'profile_check_error' }
        });
        return false;
      }

      // Initialize flow service if needed
      if (!this.flowService.flowState().isAuthenticated) {
        console.log('ClientFlowGuard: Initializing flow service');
        // Flow service will handle its own initialization
      }

      console.log('ClientFlowGuard: Access granted for user:', currentUser.email);
      return true;

    } catch (error) {
      console.error('ClientFlowGuard: Error during activation check:', error);
      this.router.navigate(['/'], {
        queryParams: { error: 'auth_error' }
      });
      return false;
    }
  }
}