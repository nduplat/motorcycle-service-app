import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models';

let guardCallCount = 0;

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  guardCallCount++;
  const currentUser = authService.currentUser();
  const requiredRoles = route.data['requiredRoles'] as Role[];

  console.log(`🔐 AuthGuard: Guard call #${guardCallCount} - Checking access for route:`, state.url);
  console.log('🔐 AuthGuard: Current user:', currentUser ? { email: currentUser.email, role: currentUser.role } : null);
  console.log('🔐 AuthGuard: Required roles:', requiredRoles);

  if (currentUser) {
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = authService.hasRole(requiredRoles);
      console.log('🔐 AuthGuard: User has required role?', hasRole);
      if (hasRole) {
        console.log('🔐 AuthGuard: Access granted');
        return true; // User has the required role
      } else {
        console.log('🔐 AuthGuard: Access denied - redirecting to login with access denied');
        // User is logged in but doesn't have the right role, redirect to login page with access denied
        router.navigate(['/login'], { queryParams: { returnUrl: state.url, access: 'denied' } });
        return false;
      }
    }
    console.log('🔐 AuthGuard: No specific roles required, access granted');
    return true; // User is logged in, and no specific role is required
  }

  console.log('🔐 AuthGuard: No user logged in - redirecting to login');
  // User is not logged in, redirect to login page
  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};