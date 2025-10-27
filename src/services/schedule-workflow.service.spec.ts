import { TestBed } from '@angular/core/testing';
import { ScheduleWorkflowService, CreateScheduleRequest, ScheduleWorkflowResult, AvailabilityCheckRequest, AvailabilityCheckResult } from './schedule-workflow.service';
import { EmployeeScheduleService } from './employee-schedule.service';
import { AuthService } from './auth.service';
import { EmployeeSchedule, ShiftConfig, BreakConfig, User, TimeBlock } from '../models';

describe('ScheduleWorkflowService', () => {
  let service: ScheduleWorkflowService;
  let employeeScheduleServiceSpy: any;
  let authServiceSpy: any;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ScheduleWorkflowService,
        {
          provide: EmployeeScheduleService,
          useValue: jasmine.createSpyObj('EmployeeScheduleService', [
            'createSchedule',
            'getEmployeeSchedule',
            'calculateWorkingHours'
          ])
        },
        {
          provide: AuthService,
          useValue: jasmine.createSpyObj('AuthService', [])
        }
      ]
    });

    service = TestBed.inject(ScheduleWorkflowService);
    employeeScheduleServiceSpy = TestBed.inject(EmployeeScheduleService);
    authServiceSpy = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createScheduleWorkflow', () => {
    const validRequest: CreateScheduleRequest = {
      employeeId: 'emp-123',
      date: new Date('2024-01-15'),
      shifts: [
        {
          id: 'shift-1',
          name: 'Morning Shift',
          startTime: '09:00',
          endTime: '17:00',
          daysOfWeek: [1, 2, 3, 4, 5],
          isActive: true,
          createdAt: {} as any,
          updatedAt: {} as any
        }
      ],
      breaks: [
        {
          id: 'break-1',
          name: 'Lunch Break',
          startTime: '12:00',
          durationMinutes: 60,
          shiftConfigId: 'shift-1',
          isActive: true,
          createdAt: {} as any,
          updatedAt: {} as any
        }
      ]
    };

    const mockEmployee: User = {
      id: 'emp-123',
      uid: 'emp-123',
      role: 'technician',
      active: true,
      email: 'test@example.com',
      displayName: 'Test Employee',
      name: 'Test Employee',
      createdAt: {} as any,
      updatedAt: {} as any
    };

    const mockSchedule: EmployeeSchedule = {
      id: 'emp-123_2024-01-15',
      employeeId: 'emp-123',
      date: {} as any,
      shifts: validRequest.shifts,
      breaks: validRequest.breaks || [],
      timeBlocks: [],
      totalHours: 7,
      createdAt: {} as any,
      updatedAt: {} as any
    };

    beforeEach(() => {
      // Mock the private getEmployeeById method
      spyOn<any>(service, 'validateEmployee').and.callThrough();
      (service as any).validateEmployee = jasmine.createSpy('validateEmployee').and.returnValue(
        Promise.resolve({ valid: true, employee: mockEmployee })
      );

      employeeScheduleServiceSpy.getEmployeeSchedule.and.returnValue(Promise.resolve(null));
      employeeScheduleServiceSpy.calculateWorkingHours.and.returnValue(7);
      employeeScheduleServiceSpy.createSchedule.and.returnValue(Promise.resolve(mockSchedule));
    });

    it('should successfully create a schedule through the workflow', async () => {
      const result: ScheduleWorkflowResult = await service.createScheduleWorkflow(validRequest);

      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      expect(result.schedule?.id).toBe('emp-123_2024-01-15');
      expect(result.error).toBeUndefined();
    });

    it('should fail if employee validation fails', async () => {
      (service as any).validateEmployee = jasmine.createSpy('validateEmployee').and.returnValue(
        Promise.resolve({ valid: false, error: 'Employee not found' })
      );

      const result: ScheduleWorkflowResult = await service.createScheduleWorkflow(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Employee not found');
      expect(result.step).toBe('validate_employee');
      expect(result.schedule).toBeUndefined();
    });

    it('should fail if schedule already exists', async () => {
      employeeScheduleServiceSpy.getEmployeeSchedule.and.returnValue(Promise.resolve(mockSchedule));

      const result: ScheduleWorkflowResult = await service.createScheduleWorkflow(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Schedule already exists for this employee on this date');
      expect(result.step).toBe('check_schedule_exists');
    });

    it('should fail if total hours calculation results in zero or negative', async () => {
      employeeScheduleServiceSpy.calculateWorkingHours.and.returnValue(0);

      const result: ScheduleWorkflowResult = await service.createScheduleWorkflow(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid schedule: total working hours must be greater than 0');
      expect(result.step).toBe('calculate_total_hours');
    });

    it('should handle errors during schedule creation', async () => {
      employeeScheduleServiceSpy.createSchedule.and.throwError('Database connection failed');

      const result: ScheduleWorkflowResult = await service.createScheduleWorkflow(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(result.step).toBe('unknown');
    });

    it('should calculate total hours correctly', async () => {
      await service.createScheduleWorkflow(validRequest);

      expect(employeeScheduleServiceSpy.calculateWorkingHours).toHaveBeenCalledWith(
        validRequest.shifts,
        validRequest.breaks || []
      );
    });

    it('should call createSchedule with correct parameters', async () => {
      await service.createScheduleWorkflow(validRequest);

      expect(employeeScheduleServiceSpy.createSchedule).toHaveBeenCalledWith(
        validRequest.employeeId,
        validRequest.date,
        validRequest.shifts,
        validRequest.breaks || []
      );
    });
  });

  describe('validateEmployee', () => {
    it('should validate a valid employee', async () => {
      const mockEmployee: User = {
        id: 'emp-123',
        uid: 'emp-123',
        role: 'technician',
        active: true,
        email: 'test@example.com',
        displayName: 'Test Employee',
        name: 'Test Employee',
        createdAt: {} as any,
        updatedAt: {} as any
      };

      // Mock the private method access
      const employeeScheduleService = TestBed.inject(EmployeeScheduleService);
      spyOn(employeeScheduleService as any, 'getEmployeeById').and.returnValue(Promise.resolve(mockEmployee));

      const result = await (service as any).validateEmployee('emp-123');

      expect(result.valid).toBe(true);
      expect(result.employee).toBe(mockEmployee);
    });

    it('should reject invalid employee role', async () => {
      const mockEmployee: User = {
        id: 'emp-123',
        uid: 'emp-123',
        role: 'customer', // Invalid role
        active: true,
        email: 'test@example.com',
        displayName: 'Test Employee',
        name: 'Test Employee',
        createdAt: {} as any,
        updatedAt: {} as any
      };

      const employeeScheduleService = TestBed.inject(EmployeeScheduleService);
      spyOn(employeeScheduleService as any, 'getEmployeeById').and.returnValue(Promise.resolve(mockEmployee));

      const result = await (service as any).validateEmployee('emp-123');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('User is not an employee (invalid role)');
    });

    it('should reject inactive employee', async () => {
      const mockEmployee: User = {
        id: 'emp-123',
        uid: 'emp-123',
        role: 'technician',
        active: false, // Inactive
        email: 'test@example.com',
        displayName: 'Test Employee',
        name: 'Test Employee',
        createdAt: {} as any,
        updatedAt: {} as any
      };

      const employeeScheduleService = TestBed.inject(EmployeeScheduleService);
      spyOn(employeeScheduleService as any, 'getEmployeeById').and.returnValue(Promise.resolve(mockEmployee));

      const result = await (service as any).validateEmployee('emp-123');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Employee is not active');
    });

    it('should reject non-existent employee', async () => {
      const employeeScheduleService = TestBed.inject(EmployeeScheduleService);
      spyOn(employeeScheduleService as any, 'getEmployeeById').and.returnValue(Promise.resolve(null));

      const result = await (service as any).validateEmployee('emp-123');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Employee not found');
    });
  });

  describe('checkAvailabilityWorkflow', () => {
    const validRequest: AvailabilityCheckRequest = {
      employeeId: 'emp-123',
      startTime: new Date('2024-01-15T10:00:00'),
      endTime: new Date('2024-01-15T11:00:00')
    };

    const mockSchedule: EmployeeSchedule = {
      id: 'emp-123_2024-01-15',
      employeeId: 'emp-123',
      date: {} as any,
      shifts: [
        {
          id: 'shift-1',
          name: 'Morning Shift',
          startTime: '09:00',
          endTime: '17:00',
          daysOfWeek: [1, 2, 3, 4, 5],
          isActive: true,
          createdAt: {} as any,
          updatedAt: {} as any
        }
      ],
      breaks: [
        {
          id: 'break-1',
          name: 'Lunch Break',
          startTime: '12:00',
          durationMinutes: 60,
          shiftConfigId: 'shift-1',
          isActive: true,
          createdAt: {} as any,
          updatedAt: {} as any
        }
      ],
      timeBlocks: [],
      totalHours: 7,
      createdAt: {} as any,
      updatedAt: {} as any
    };

    beforeEach(() => {
      employeeScheduleServiceSpy.getEmployeeSchedule.and.returnValue(Promise.resolve(mockSchedule));
    });

    it('should return available when employee has schedule and time is within shift', async () => {
      const result: AvailabilityCheckResult = await service.checkAvailabilityWorkflow(validRequest);

      expect(result.available).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.step).toBe('available');
    });

    it('should return not available when no schedule exists', async () => {
      employeeScheduleServiceSpy.getEmployeeSchedule.and.returnValue(Promise.resolve(null));

      const result: AvailabilityCheckResult = await service.checkAvailabilityWorkflow(validRequest);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('No schedule found for this employee on the target date');
      expect(result.step).toBe('get_employee_schedule');
    });

    it('should return not available when time is outside shift hours', async () => {
      const outsideShiftRequest: AvailabilityCheckRequest = {
        ...validRequest,
        startTime: new Date('2024-01-15T18:00:00'), // Outside shift hours
        endTime: new Date('2024-01-15T19:00:00')
      };

      const result: AvailabilityCheckResult = await service.checkAvailabilityWorkflow(outsideShiftRequest);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Requested time is outside of scheduled shift hours');
      expect(result.step).toBe('check_time_within_shift');
    });

    it('should return not available when time conflicts with break', async () => {
      const breakConflictRequest: AvailabilityCheckRequest = {
        ...validRequest,
        startTime: new Date('2024-01-15T12:00:00'), // During lunch break
        endTime: new Date('2024-01-15T12:30:00')
      };

      const result: AvailabilityCheckResult = await service.checkAvailabilityWorkflow(breakConflictRequest);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Requested time conflicts with scheduled break');
      expect(result.step).toBe('check_break_conflicts');
    });

    it('should return not available when time conflicts with existing time block', async () => {
      const scheduleWithTimeBlock: EmployeeSchedule = {
        ...mockSchedule,
        timeBlocks: [
          {
            id: 'block-1',
            startTime: {} as any, // Mock Firestore timestamp
            endTime: {} as any,
            type: 'work',
            technicianId: 'emp-123',
            createdAt: {} as any,
            updatedAt: {} as any
          }
        ]
      };

      // Mock the toDate() method for time blocks
      spyOn(scheduleWithTimeBlock.timeBlocks[0].startTime, 'toDate').and.returnValue(new Date('2024-01-15T10:30:00'));
      spyOn(scheduleWithTimeBlock.timeBlocks[0].endTime, 'toDate').and.returnValue(new Date('2024-01-15T11:30:00'));

      employeeScheduleServiceSpy.getEmployeeSchedule.and.returnValue(Promise.resolve(scheduleWithTimeBlock));

      const result: AvailabilityCheckResult = await service.checkAvailabilityWorkflow(validRequest);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Requested time conflicts with existing appointment or time block');
      expect(result.step).toBe('check_existing_time_blocks');
    });

    it('should handle errors during availability check', async () => {
      employeeScheduleServiceSpy.getEmployeeSchedule.and.throwError('Database connection failed');

      const result: AvailabilityCheckResult = await service.checkAvailabilityWorkflow(validRequest);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Database connection failed');
      expect(result.step).toBe('unknown');
    });
  });
});