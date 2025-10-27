import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CostMonitoringService } from './cost-monitoring.service';
/// <reference types="jest" />

describe('AuthService', () => {
  let service: AuthService;
  let routerSpy: jest.SpyInstance;
  let costMonitoringSpy: jest.SpyInstance;

  beforeEach(() => {
    const routerSpyObj = { navigate: jest.fn() };
    const costMonitoringSpyObj = { trackFirestoreRead: jest.fn(), trackFirestoreWrite: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpyObj },
        { provide: CostMonitoringService, useValue: costMonitoringSpyObj }
      ]
    });

    service = TestBed.inject(AuthService);
    routerSpy = routerSpyObj.navigate;
    costMonitoringSpy = costMonitoringSpyObj.trackFirestoreRead;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with null currentUser', () => {
    expect(service.currentUser()).toBeNull();
  });

  it('should return false for hasRole when no user is logged in', () => {
    const result = service.hasRole(['admin']);
    expect(result).toBe(false);
  });

  it('should navigate to home on logout', async () => {
    await service.logout();
    expect(routerSpy).toHaveBeenCalledWith(['/']);
  });
});