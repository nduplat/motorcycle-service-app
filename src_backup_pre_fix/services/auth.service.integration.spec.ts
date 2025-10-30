import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CostMonitoringService } from './cost-monitoring.service';

describe('AuthService Integration', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        Router,
        CostMonitoringService
      ]
    });

    service = TestBed.inject(AuthService);
  });

  it('should initialize without errors', () => {
    expect(service).toBeTruthy();
  });

  it('should have auth state observable', () => {
    expect(service.getAuthState()).toBeDefined();
  });

  it('should have user observable', () => {
    expect(service.waitForUser()).toBeDefined();
  });
});