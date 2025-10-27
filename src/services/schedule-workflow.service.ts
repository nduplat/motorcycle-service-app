import { Injectable, inject } from '@angular/core';
import { EmployeeScheduleService } from './employee-schedule.service';
import { AuthService } from './auth.service';
import { WorkOrderService } from './work-order.service';
import { AppointmentService } from './appointment.service';
import { UserService } from './user.service';
import { CacheService } from './cache.service';
import { EmployeeSchedule, ShiftConfig, BreakConfig, User, WorkOrder, Appointment } from '../models';

export interface CreateScheduleRequest {
  employeeId: string;
  date: Date;
  shifts: ShiftConfig[];
  breaks?: BreakConfig[];
}

export interface ScheduleWorkflowResult {
  success: boolean;
  schedule?: EmployeeSchedule;
  error?: string;
  step?: string;
}

export interface AvailabilityCheckRequest {
  employeeId: string;
  startTime: Date;
  endTime: Date;
}

export interface AvailabilityCheckResult {
  available: boolean;
  reason?: string;
  step?: string;
}

export interface CapacityCalculationResult {
  totalCapacity: number;
  usedCapacity: number;
  availableCapacity: number;
  utilizationPercentage: number;
  activeWorkOrders: number;
  todaysAppointments: number;
  busyTechnicians: number;
  availableTechnicians: number;
  cached: boolean;
  calculatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ScheduleWorkflowService {
  private employeeScheduleService = inject(EmployeeScheduleService);
  private authService = inject(AuthService);
  private workOrderService = inject(WorkOrderService);
  private appointmentService = inject(AppointmentService);
  private userService = inject(UserService);
  private cacheService = inject(CacheService);

  /**
   * Execute the Schedule Creation and Validation workflow
   * Follows the workflow: create schedule request → validate employee → check schedule exists → calculate total hours → create schedule document → save to Firestore → return created schedule
   */
  async createScheduleWorkflow(request: CreateScheduleRequest): Promise<ScheduleWorkflowResult> {
    try {
      console.log('🔄 ScheduleWorkflowService: Starting schedule creation workflow for employee:', request.employeeId);

      // Step 1: Validate Employee (Role Check)
      const employeeValidation = await this.validateEmployee(request.employeeId);
      if (!employeeValidation.valid) {
        return {
          success: false,
          error: employeeValidation.error,
          step: 'validate_employee'
        };
      }

      // Step 2: Check Schedule Exists for Date
      const scheduleExists = await this.checkScheduleExists(request.employeeId, request.date);
      if (scheduleExists.exists) {
        return {
          success: false,
          error: 'Schedule already exists for this employee on this date',
          step: 'check_schedule_exists'
        };
      }

      // Step 3: Calculate Total Hours (Shifts - Breaks)
      const totalHours = this.calculateTotalHours(request.shifts, request.breaks || []);
      if (totalHours <= 0) {
        return {
          success: false,
          error: 'Invalid schedule: total working hours must be greater than 0',
          step: 'calculate_total_hours'
        };
      }

      // Step 4: Create Schedule Document
      const scheduleDocument = await this.createScheduleDocument(request, totalHours);

      // Step 5: Save to Firestore
      const savedSchedule = await this.saveToFirestore(scheduleDocument);

      // Step 6: Return Created Schedule
      console.log('✅ ScheduleWorkflowService: Schedule creation workflow completed successfully');
      return {
        success: true,
        schedule: savedSchedule
      };

    } catch (error) {
      console.error('❌ ScheduleWorkflowService: Workflow failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        step: 'unknown'
      };
    }
  }

  /**
   * Step 1: Validate Employee (Role Check)
   */
  private async validateEmployee(employeeId: string): Promise<{ valid: boolean; error?: string; employee?: User }> {
    try {
      console.log('🔍 ScheduleWorkflowService: Validating employee:', employeeId);

      // Get employee details
      const employee = await this.employeeScheduleService['getEmployeeById'](employeeId);
      if (!employee) {
        return { valid: false, error: 'Employee not found' };
      }

      // Check role
      if (!['technician', 'employee', 'front_desk'].includes(employee.role)) {
        return { valid: false, error: 'User is not an employee (invalid role)' };
      }

      // Check if employee is active
      if (employee.active === false) {
        return { valid: false, error: 'Employee is not active' };
      }

      console.log('✅ ScheduleWorkflowService: Employee validation passed');
      return { valid: true, employee };
    } catch (error) {
      console.error('❌ ScheduleWorkflowService: Employee validation failed:', error);
      return { valid: false, error: 'Failed to validate employee' };
    }
  }

  /**
   * Step 2: Check Schedule Exists for Date
   */
  private async checkScheduleExists(employeeId: string, date: Date): Promise<{ exists: boolean; error?: string }> {
    try {
      console.log('🔍 ScheduleWorkflowService: Checking if schedule exists for date:', date);

      const existingSchedule = await this.employeeScheduleService.getEmployeeSchedule(employeeId, date);

      if (existingSchedule) {
        console.log('⚠️ ScheduleWorkflowService: Schedule already exists');
        return { exists: true };
      }

      console.log('✅ ScheduleWorkflowService: No existing schedule found');
      return { exists: false };
    } catch (error) {
      console.error('❌ ScheduleWorkflowService: Schedule existence check failed:', error);
      return { exists: false, error: 'Failed to check schedule existence' };
    }
  }

  /**
   * Step 3: Calculate Total Hours (Shifts - Breaks)
   */
  private calculateTotalHours(shifts: ShiftConfig[], breaks: BreakConfig[]): number {
    console.log('🧮 ScheduleWorkflowService: Calculating total hours');

    const totalHours = this.employeeScheduleService.calculateWorkingHours(shifts, breaks);

    console.log('✅ ScheduleWorkflowService: Total hours calculated:', totalHours);
    return totalHours;
  }

  /**
   * Step 4: Create Schedule Document
   */
  private async createScheduleDocument(request: CreateScheduleRequest, totalHours: number): Promise<EmployeeSchedule> {
    console.log('📄 ScheduleWorkflowService: Creating schedule document');

    // Use the existing service method to create the schedule
    const schedule = await this.employeeScheduleService.createSchedule(
      request.employeeId,
      request.date,
      request.shifts,
      request.breaks || []
    );

    console.log('✅ ScheduleWorkflowService: Schedule document created');
    return schedule;
  }

  /**
    * Step 5: Save to Firestore
    */
   private async saveToFirestore(schedule: EmployeeSchedule): Promise<EmployeeSchedule> {
     console.log('💾 ScheduleWorkflowService: Saving to Firestore');

     // The createSchedule method already saves to Firestore, so this step is essentially validation
     // In a more complex scenario, we might have additional validation or processing here

     console.log('✅ ScheduleWorkflowService: Schedule saved to Firestore');
     return schedule;
   }

  /**
   * Execute the Availability Checking Process workflow
   * Follows the workflow: check employee availability → get employee schedule for target date → check schedule exists → check time within any shift → check break conflicts → check existing time blocks (appointments) → return available/not available with reason
   */
  async checkAvailabilityWorkflow(request: AvailabilityCheckRequest): Promise<AvailabilityCheckResult> {
    try {
      console.log('🔄 ScheduleWorkflowService: Starting availability checking workflow for employee:', request.employeeId, 'from', request.startTime, 'to', request.endTime);

      // Step 1: Get Employee Schedule for Target Date
      const schedule = await this.employeeScheduleService.getEmployeeSchedule(request.employeeId, request.startTime);
      if (!schedule) {
        return {
          available: false,
          reason: 'No schedule found for this employee on the target date',
          step: 'get_employee_schedule'
        };
      }

      // Step 2: Check Time Within Any Shift
      const isWithinShift = this.checkTimeWithinShift(schedule, request.startTime, request.endTime);
      if (!isWithinShift) {
        return {
          available: false,
          reason: 'Requested time is outside of scheduled shift hours',
          step: 'check_time_within_shift'
        };
      }

      // Step 3: Check Break Conflicts
      const hasBreakConflict = this.checkBreakConflicts(schedule, request.startTime, request.endTime);
      if (hasBreakConflict) {
        return {
          available: false,
          reason: 'Requested time conflicts with scheduled break',
          step: 'check_break_conflicts'
        };
      }

      // Step 4: Check Existing Time Blocks (Appointments)
      const hasTimeBlockConflict = this.checkTimeBlockConflicts(schedule, request.startTime, request.endTime);
      if (hasTimeBlockConflict) {
        return {
          available: false,
          reason: 'Requested time conflicts with existing appointment or time block',
          step: 'check_existing_time_blocks'
        };
      }

      // Step 5: Return Available
      console.log('✅ ScheduleWorkflowService: Availability checking workflow completed - employee is available');
      return {
        available: true,
        step: 'available'
      };

    } catch (error) {
      console.error('❌ ScheduleWorkflowService: Availability checking workflow failed:', error);
      return {
        available: false,
        reason: error instanceof Error ? error.message : 'Unknown error occurred during availability check',
        step: 'unknown'
      };
    }
  }

  /**
   * Step 2: Check Time Within Any Shift
   */
  private checkTimeWithinShift(schedule: EmployeeSchedule, startTime: Date, endTime: Date): boolean {
    console.log('🔍 ScheduleWorkflowService: Checking if time is within any shift');

    return schedule.shifts.some(shift => {
      const shiftStart = this.parseTime(shift.startTime);
      const shiftEnd = this.parseTime(shift.endTime);

      const requestedStart = startTime.getHours() * 60 + startTime.getMinutes();
      const requestedEnd = endTime.getHours() * 60 + endTime.getMinutes();

      return requestedStart >= shiftStart && requestedEnd <= shiftEnd;
    });
  }

  /**
   * Step 3: Check Break Conflicts
   */
  private checkBreakConflicts(schedule: EmployeeSchedule, startTime: Date, endTime: Date): boolean {
    console.log('🔍 ScheduleWorkflowService: Checking for break conflicts');

    return schedule.breaks.some(breakConfig => {
      const breakStart = this.parseTime(breakConfig.startTime);
      const breakEnd = breakStart + breakConfig.durationMinutes;

      const requestedStart = startTime.getHours() * 60 + startTime.getMinutes();
      const requestedEnd = endTime.getHours() * 60 + endTime.getMinutes();

      // Check for overlap: requested time overlaps with break time
      return !(requestedEnd <= breakStart || requestedStart >= breakEnd);
    });
  }

  /**
   * Step 4: Check Existing Time Blocks (Appointments)
   */
  private checkTimeBlockConflicts(schedule: EmployeeSchedule, startTime: Date, endTime: Date): boolean {
    console.log('🔍 ScheduleWorkflowService: Checking for time block conflicts');

    return schedule.timeBlocks.some(block => {
      const blockStart = block.startTime.toDate();
      const blockEnd = block.endTime.toDate();

      // Check for overlap: requested time overlaps with existing time block
      return !(endTime <= blockStart || startTime >= blockEnd);
    });
  }

  /**
   * Helper method to parse time string to minutes
   */
  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Execute the Capacity Calculation Process workflow
   * Follows the workflow: calculate capacity → check cache (5 min TTL) → get work orders (active) → get appointments (today, active) → get all technicians → count active work orders → count today's appointments → identify busy technicians → count available technicians → calculate metrics (total cap, used cap, available cap, utilization %) → cache results (5 minutes) → return capacity data
   */
  async calculateCapacityWorkflow(): Promise<CapacityCalculationResult> {
    try {
      console.log('🔄 ScheduleWorkflowService: Starting capacity calculation workflow');

      // Step 1: Check Cache (5 min TTL)
      const cacheKey = 'capacity_calculation';
      const cachedResult = await this.cacheService.get<CapacityCalculationResult>(cacheKey);

      if (cachedResult) {
        console.log('✅ ScheduleWorkflowService: Returning cached capacity data');
        return {
          ...cachedResult,
          cached: true
        };
      }

      // Step 2: Get Work Orders (Active)
      const activeWorkOrders = await this.getActiveWorkOrders();

      // Step 3: Get Appointments (Today, Active)
      const todaysActiveAppointments = await this.getTodaysActiveAppointments();

      // Step 4: Get All Technicians
      const allTechnicians = this.getAllTechnicians();

      // Step 5: Count Active Work Orders
      const activeWorkOrdersCount = this.countActiveWorkOrders(activeWorkOrders);

      // Step 6: Count Today's Appointments
      const todaysAppointmentsCount = this.countTodaysAppointments(todaysActiveAppointments);

      // Step 7: Identify Busy Technicians
      const busyTechnicians = this.identifyBusyTechnicians(activeWorkOrders, todaysActiveAppointments, allTechnicians);

      // Step 8: Count Available Technicians
      const availableTechniciansCount = this.countAvailableTechnicians(allTechnicians, busyTechnicians);

      // Step 9: Calculate Metrics
      const metrics = this.calculateCapacityMetrics(
        allTechnicians.length,
        activeWorkOrdersCount,
        todaysAppointmentsCount,
        availableTechniciansCount
      );

      const result: CapacityCalculationResult = {
        totalCapacity: metrics.totalCapacity,
        usedCapacity: metrics.usedCapacity,
        availableCapacity: metrics.availableCapacity,
        utilizationPercentage: metrics.utilizationPercentage,
        activeWorkOrders: activeWorkOrdersCount,
        todaysAppointments: todaysAppointmentsCount,
        busyTechnicians: busyTechnicians.length,
        availableTechnicians: availableTechniciansCount,
        cached: false,
        calculatedAt: new Date()
      };

      // Step 10: Cache Results (5 minutes)
      await this.cacheService.set(cacheKey, result, 5 * 60 * 1000, 'capacity');

      // Step 11: Return Capacity Data
      console.log('✅ ScheduleWorkflowService: Capacity calculation workflow completed successfully');
      return result;

    } catch (error) {
      console.error('❌ ScheduleWorkflowService: Capacity calculation workflow failed:', error);
      throw new Error(`Capacity calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 2: Get Work Orders (Active)
   */
  private async getActiveWorkOrders(): Promise<WorkOrder[]> {
    console.log('🔍 ScheduleWorkflowService: Getting active work orders');

    // Get all work orders and filter for active ones
    // Note: This assumes workOrderService.getWorkOrders() returns all work orders
    // In a real implementation, you might want to add a method to get only active work orders
    const allWorkOrders = this.workOrderService.getWorkOrders()();
    const activeStatuses: WorkOrder['status'][] = ['in_progress', 'waiting_parts'];

    return allWorkOrders.filter(wo => activeStatuses.includes(wo.status));
  }

  /**
   * Step 3: Get Appointments (Today, Active)
   */
  private async getTodaysActiveAppointments(): Promise<Appointment[]> {
    console.log('🔍 ScheduleWorkflowService: Getting today\'s active appointments');

    const today = new Date();
    const activeStatuses: Appointment['status'][] = ['scheduled', 'confirmed', 'in_progress'];

    return this.appointmentService.getAppointmentsForDate(today)
      .filter(apt => activeStatuses.includes(apt.status));
  }

  /**
   * Step 4: Get All Technicians
   */
  private getAllTechnicians(): User[] {
    console.log('🔍 ScheduleWorkflowService: Getting all technicians');

    return this.userService.getTechnicians();
  }

  /**
   * Step 5: Count Active Work Orders
   */
  private countActiveWorkOrders(workOrders: WorkOrder[]): number {
    console.log('🧮 ScheduleWorkflowService: Counting active work orders');

    return workOrders.length;
  }

  /**
   * Step 6: Count Today's Appointments
   */
  private countTodaysAppointments(appointments: Appointment[]): number {
    console.log('🧮 ScheduleWorkflowService: Counting today\'s appointments');

    return appointments.length;
  }

  /**
   * Step 7: Identify Busy Technicians
   */
  private identifyBusyTechnicians(workOrders: WorkOrder[], appointments: Appointment[], allTechnicians: User[]): User[] {
    console.log('🔍 ScheduleWorkflowService: Identifying busy technicians');

    const busyTechnicianIds = new Set<string>();

    // Technicians with active work orders
    workOrders.forEach(wo => {
      if (wo.assignedTo) {
        busyTechnicianIds.add(wo.assignedTo);
      }
    });

    // Technicians with today's active appointments
    appointments.forEach(apt => {
      if (apt.assignedTo) {
        busyTechnicianIds.add(apt.assignedTo);
      }
    });

    return allTechnicians.filter(tech => busyTechnicianIds.has(tech.id));
  }

  /**
   * Step 8: Count Available Technicians
   */
  private countAvailableTechnicians(allTechnicians: User[], busyTechnicians: User[]): number {
    console.log('🧮 ScheduleWorkflowService: Counting available technicians');

    const busyIds = new Set(busyTechnicians.map(tech => tech.id));
    const availableTechnicians = allTechnicians.filter(tech => !busyIds.has(tech.id));

    return availableTechnicians.length;
  }

  /**
   * Step 9: Calculate Metrics
   */
  private calculateCapacityMetrics(
    totalTechnicians: number,
    activeWorkOrders: number,
    todaysAppointments: number,
    availableTechnicians: number
  ): {
    totalCapacity: number;
    usedCapacity: number;
    availableCapacity: number;
    utilizationPercentage: number;
  } {
    console.log('🧮 ScheduleWorkflowService: Calculating capacity metrics');

    // Assuming each technician can handle 8 hours of work per day
    const hoursPerTechnician = 8;
    const totalCapacity = totalTechnicians * hoursPerTechnician;

    // Used capacity is based on active work orders and appointments
    // This is a simplified calculation - in reality, you'd need to calculate actual hours
    const usedCapacity = activeWorkOrders + todaysAppointments;

    const availableCapacity = availableTechnicians * hoursPerTechnician;
    const utilizationPercentage = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0;

    return {
      totalCapacity,
      usedCapacity,
      availableCapacity,
      utilizationPercentage: Math.round(utilizationPercentage * 100) / 100 // Round to 2 decimal places
    };
  }
}