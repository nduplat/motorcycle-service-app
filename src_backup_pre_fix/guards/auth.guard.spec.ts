import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
/// <reference types="jest" />

describe('authGuard', () => {
  let authServiceSpy: jest.SpyInstance;
  let routerSpy: jest.SpyInstance;

  beforeEach(() => {
    const authSpy = {
      currentUser: jest.fn(),
      hasRole: jest.fn()
    };
    const routerSpyObj = {
      navigate: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpyObj }
      ]
    });

    authServiceSpy = authSpy.currentUser;
    routerSpy = routerSpyObj.navigate;
  });

  it('should allow access when user is logged in and no roles required', () => {
    authServiceSpy.mockReturnValue({ id: '1', role: 'customer' });
    const route = { data: {} } as ActivatedRouteSnapshot;
    const state = { url: '/test' } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBe(true);
  });

  it('should deny access when user is not logged in', () => {
    authServiceSpy.mockReturnValue(null);
    const route = { data: {} } as ActivatedRouteSnapshot;
    const state = { url: '/test' } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBe(false);
    expect(routerSpy).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/test' } });
  });

  it('should allow access when user has required role', () => {
    authServiceSpy.mockReturnValue({ id: '1', role: 'admin' });
    const route = { data: { requiredRoles: ['admin'] } } as any;
    const state = { url: '/admin' } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBe(true);
  });
});