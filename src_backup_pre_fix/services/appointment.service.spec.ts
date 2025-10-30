
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { AppointmentService } from './appointment.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { EventBusService } from './event-bus.service';
import { ServiceItemService } from './service-item.service';
import { SchedulingService } from './scheduling.service';
import { CostMonitoringService } from './cost-monitoring.service';
/// <reference types="jest" />

describe('AppointmentService', () => {
  let service: AppointmentService;
  let authServiceSpy: jest.SpyInstance;
  let userServiceSpy: jest.SpyInstance;
  let eventBusSpy: jest.SpyInstance;
  let serviceItemServiceSpy: jest.SpyInstance;
  let schedulingServiceSpy: jest.SpyInstance;
  let costMonitoringServiceSpy: jest.SpyInstance;

  beforeEach(() => {
    const authSpy = {
      currentUser: jest.fn().mockReturnValue({ id: '1', role: 'admin' })
    };
    const userSpy = {
      getTechnicians: jest.fn().mockReturnValue([])
    };
    const eventBusSpyObj = {
      emit: jest.fn()
    };
    const serviceItemSpy = {};
    const schedulingSpy = {
      autoAssignTechnician: jest.fn().mockReturnValue('tech1')
    };
    const costSpy = {
      trackFirestoreRead: jest.fn(),
      trackFirestoreWrite: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        AppointmentService,
        { provide: AuthService, useValue: authSpy },
        { provide: UserService, useValue: userSpy },
        { provide: EventBusService, useValue: eventBusSpyObj },
        { provide: ServiceItemService, useValue: serviceItemSpy },
        { provide: SchedulingService, useValue: schedulingSpy },
        { provide: CostMonitoringService, useValue: costSpy }
      ]
    });

    service = TestBed.inject(AppointmentService);
    authServiceSpy = authSpy.currentUser;
    userServiceSpy = userSpy.getTechnicians;
    eventBusSpy = eventBusSpyObj.emit;
    schedulingServiceSpy = schedulingSpy.autoAssignTechnician;
    costMonitoringServiceSpy = costSpy.trackFirestoreRead;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return appointments', () => {
    const appointments = service.getAppointments();
    expect(appointments).toBeDefined();
  });

  it('should get appointments for date', () => {
    const date = new Date();
    const result = service.getAppointmentsForDate(date);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should get available slots', () => {
    const date = new Date();
    const slots = service.getAvailableSlots(date, 'tech1', 60);
    expect(Array.isArray(slots)).toBe(true);
  });

  it('should get available technicians', () => {
    const technicians = service.getAvailableTechnicians();
    expect(Array.isArray(technicians)).toBe(true);
  });
});