import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { ClientFlowGuard } from './client-flow.guard';
import { AuthService } from '../services/auth.service';
import { ClientFlowService } from '../services/client-flow.service';
/// <reference types="jest" />

describe('ClientFlowGuard', () => {
  let guard: ClientFlowGuard;
  let authServiceSpy: jest.SpyInstance;
  let flowServiceSpy: jest.SpyInstance;
  let routerSpy: jest.SpyInstance;

  beforeEach(() => {
    const authSpy = {
      waitForAuth: jest.fn().mockResolvedValue(true),
      currentUser: jest.fn()
    };
    const flowSpy = {
      flowState: jest.fn().mockReturnValue({ isAuthenticated: true })
    };
    const routerSpyObj = {
      navigate: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        ClientFlowGuard,
        { provide: AuthService, useValue: authSpy },
        { provide: ClientFlowService, useValue: flowSpy },
        { provide: Router, useValue: routerSpyObj }
      ]
    });

    guard = TestBed.inject(ClientFlowGuard);
    authServiceSpy = authSpy.currentUser;
    flowServiceSpy = flowSpy.flowState;
    routerSpy = routerSpyObj.navigate;
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('should allow access for authenticated customer', async () => {
    authServiceSpy.mockReturnValue({ id: '1', role: 'customer', email: 'test@example.com' });

    const result = await guard.canActivate();

    expect(result).toBe(true);
  });

  it('should deny access for unauthenticated user', async () => {
    authServiceSpy.mockReturnValue(null);

    const result = await guard.canActivate();

    expect(result).toBe(false);
    expect(routerSpy).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/queue/join' } });
  });
});