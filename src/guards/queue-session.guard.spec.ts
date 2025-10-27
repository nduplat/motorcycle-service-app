import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { QueueSessionGuard } from './queue-session.guard';
import { QueueSessionService } from '../services/queue-session.service';
/// <reference types="jest" />

describe('QueueSessionGuard', () => {
  let guard: QueueSessionGuard;
  let queueSessionServiceSpy: jest.SpyInstance;
  let routerSpy: jest.SpyInstance;

  beforeEach(() => {
    const queueSpy = {
      createSession: jest.fn().mockReturnValue({ id: 'session1' })
    };
    const routerSpyObj = {
      navigate: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        QueueSessionGuard,
        { provide: QueueSessionService, useValue: queueSpy },
        { provide: Router, useValue: routerSpyObj }
      ]
    });

    guard = TestBed.inject(QueueSessionGuard);
    queueSessionServiceSpy = queueSpy.createSession;
    routerSpy = routerSpyObj.navigate;
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('should allow access and create session', () => {
    const result = guard.canActivate();

    expect(result).toBe(true);
    expect(queueSessionServiceSpy).toHaveBeenCalled();
  });
});