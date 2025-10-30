import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { ClientFlowGuard } from './client-flow.guard';
import { AuthService } from '../services/auth.service';
import { ClientFlowService } from '../services/client-flow.service';
import { UserVehicleService } from '../services/user-vehicle.service';
/// <reference types="jest" />

describe('ClientFlowGuard', () => {
  let guard: ClientFlowGuard;
  let authServiceSpy: jest.SpyInstance;
  let flowServiceSpy: jest.SpyInstance;
  let userVehicleServiceSpy: jest.SpyInstance;
  let routerSpy: jest.SpyInstance;

  beforeEach(() => {
    const authSpy = {
      waitForAuth: jest.fn().mockResolvedValue(true),
      currentUser: jest.fn()
    };
    const flowSpy = {
      flowState: jest.fn().mockReturnValue({ isAuthenticated: true })
    };
    const userVehicleSpy = {
      getVehiclesForUser: jest.fn().mockReturnValue({
        toPromise: jest.fn().mockResolvedValue([
          { id: '1', userId: '1', plate: 'ABC123' }
        ])
      })
    };
    const routerSpyObj = {
      navigate: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        ClientFlowGuard,
        { provide: AuthService, useValue: authSpy },
        { provide: ClientFlowService, useValue: flowSpy },
        { provide: UserVehicleService, useValue: userVehicleSpy },
        { provide: Router, useValue: routerSpyObj }
      ]
    });

    guard = TestBed.inject(ClientFlowGuard);
    authServiceSpy = authSpy.currentUser;
    flowServiceSpy = flowSpy.flowState;
    userVehicleServiceSpy = userVehicleSpy.getVehiclesForUser;
    routerSpy = routerSpyObj.navigate;
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('should allow access for authenticated customer with registered motorcycles', async () => {
    authServiceSpy.mockReturnValue({ id: '1', role: 'customer', email: 'test@example.com' });
    userVehicleServiceSpy.mockReturnValue({
      toPromise: jest.fn().mockResolvedValue([
        { id: '1', userId: '1', plate: 'ABC123' }
      ])
    });

    const result = await guard.canActivate();

    expect(result).toBe(true);
  });

  it('should deny access for customer without registered motorcycles', async () => {
    authServiceSpy.mockReturnValue({ id: '1', role: 'customer', email: 'test@example.com' });
    userVehicleServiceSpy.mockReturnValue({
      toPromise: jest.fn().mockResolvedValue([])
    });

    const result = await guard.canActivate();

    expect(result).toBe(false);
    expect(routerSpy).toHaveBeenCalledWith(['/account'], {
      queryParams: { error: 'incomplete_profile', message: 'Debes registrar al menos una motocicleta para acceder al flujo de cliente' }
    });
  });

  it('should deny access for admin user', async () => {
    authServiceSpy.mockReturnValue({ id: '1', role: 'admin', email: 'admin@example.com' });

    const result = await guard.canActivate();

    expect(result).toBe(false);
    expect(routerSpy).toHaveBeenCalledWith(['/'], { queryParams: { error: 'access_denied' } });
  });

  it('should deny access for unauthenticated user', async () => {
    authServiceSpy.mockReturnValue(null);

    const result = await guard.canActivate();

    expect(result).toBe(false);
    expect(routerSpy).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/queue/join' } });
  });
});