import { Injectable, inject } from '@angular/core';
import {
  EmployeeSchedule,
  TimeBlock,
  ShiftConfig,
  BreakConfig,
  User,
  WorkshopCapacity,
  Timestamp,
  ServiceItem
} from '../models';
import { db } from '../firebase.config';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp as FirestoreTimestamp
} from 'firebase/firestore';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class EmployeeScheduleService {
  private authService = inject(AuthService);
  private firestoreCallCount = 0;
  private activeEmployees: User[] = [];
  private employeesCacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Pagination state for available employees
  private readonly EMPLOYEES_PAGE_SIZE = 20;
  private employeesLastDoc: any = null;
  private employeesHasMore = false;
  private employeesCurrentList: User[] = [];

  constructor() {
    console.log('📅 EmployeeScheduleService: Initializing employee schedule service');
  }

  private logFirestoreCall(method: string, details?: string) {
    this.firestoreCallCount++;
    const logMessage = `📅 EmployeeScheduleService: Firestore call #${this.firestoreCallCount} - ${method}${details ? ': ' + details : ''}`;
    console.log(logMessage);

    // Threshold alert for high read operations
    const THRESHOLD = 50;
    if (this.firestoreCallCount > THRESHOLD) {
      console.warn(`🚨 ALERT: High Firestore call count detected! Total calls: ${this.firestoreCallCount}. Method: ${method}. Details: ${details || 'N/A'}`);
      // Could emit event or send notification here
    }

    // Detailed logging for performance monitoring
    if (this.firestoreCallCount % 10 === 0) {
      console.info(`📊 Performance Monitor: ${this.firestoreCallCount} Firestore calls made in this session. Last call: ${method}`);
    }
  }

  private async loadActiveEmployees(): Promise<User[]> {
    const now = Date.now();
    if (this.activeEmployees.length > 0 && (now - this.employeesCacheTimestamp) < this.CACHE_DURATION) {
      console.log('📅 EmployeeScheduleService: Using cached active employees');
      return this.activeEmployees;
    }

    console.log('📅 EmployeeScheduleService: Loading active employees from Firestore');
    const employeesQuery = query(
      collection(db, 'users'),
      where('role', 'in', ['technician', 'employee', 'front_desk']),
      where('active', '==', true)
    );
    this.logFirestoreCall('getDocs', 'users query for active employees');
    const employeesSnap = await getDocs(employeesQuery);
    this.activeEmployees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    this.employeesCacheTimestamp = now;
    console.log(`📅 EmployeeScheduleService: Cached ${this.activeEmployees.length} active employees`);
    return this.activeEmployees;
  }

  /**
   * Create a new employee schedule
   */
  async createSchedule(employeeId: string, date: Date, shifts: ShiftConfig[], breaks: BreakConfig[] = []): Promise<EmployeeSchedule> {
    try {
      console.log('📅 EmployeeScheduleService: Creating schedule for employee:', employeeId, 'on date:', date);

      // Validate employee exists and has appropriate role
      const employee = await this.getEmployeeById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      if (!['technician', 'employee', 'front_desk'].includes(employee.role)) {
        throw new Error('User is not an employee');
      }

      // Check if schedule already exists for this date
      const existingSchedule = await this.getEmployeeSchedule(employeeId, date);
      if (existingSchedule) {
        throw new Error('Schedule already exists for this employee on this date');
      }

      // Calculate total hours
      const totalHours = this.calculateWorkingHours(shifts, breaks);

      const scheduleId = `${employeeId}_${date.toISOString().split('T')[0]}`;
      const schedule: EmployeeSchedule = {
        id: scheduleId,
        employeeId,
        date: FirestoreTimestamp.fromDate(date),
        shifts,
        breaks,
        timeBlocks: [],
        totalHours,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };

      const scheduleRef = doc(db, 'employeeSchedules', scheduleId);
      await setDoc(scheduleRef, schedule);

      console.log('📅 EmployeeScheduleService: Schedule created successfully:', scheduleId);
      return schedule;
    } catch (error) {
      console.error('📅 EmployeeScheduleService: Error creating schedule:', error);
      throw error;
    }
  }

  /**
   * Update an existing employee schedule
   */
  async updateSchedule(scheduleId: string, updates: Partial<EmployeeSchedule>): Promise<EmployeeSchedule> {
    try {
      console.log('📅 EmployeeScheduleService: Updating schedule:', scheduleId);

      const scheduleRef = doc(db, 'employeeSchedules', scheduleId);
      const scheduleSnap = await getDoc(scheduleRef);

      if (!scheduleSnap.exists()) {
        throw new Error('Schedule not found');
      }

      const currentSchedule = scheduleSnap.data() as EmployeeSchedule;

      // Recalculate total hours if shifts or breaks are updated
      let totalHours = currentSchedule.totalHours;
      if (updates.shifts || updates.breaks) {
        const shifts = updates.shifts || currentSchedule.shifts;
        const breaks = updates.breaks || currentSchedule.breaks;
        totalHours = this.calculateWorkingHours(shifts, breaks);
      }

      const updateData = {
        ...updates,
        totalHours,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(scheduleRef, updateData);

      // Return the updated schedule with the new data
      const updatedSchedule: EmployeeSchedule = {
        ...currentSchedule,
        ...updates,
        totalHours,
        updatedAt: FirestoreTimestamp.now() as any, // Use current timestamp for return
      };

      console.log('📅 EmployeeScheduleService: Schedule updated successfully:', scheduleId);
      return updatedSchedule;
    } catch (error) {
      console.error('📅 EmployeeScheduleService: Error updating schedule:', error);
      throw error;
    }
  }

  /**
   * Get employee schedule for a specific date
   */
  async getEmployeeSchedule(employeeId: string, date: Date): Promise<EmployeeSchedule | null> {
    try {
      console.log('📅 EmployeeScheduleService: Getting schedule for employee:', employeeId, 'on date:', date);

      const scheduleId = `${employeeId}_${date.toISOString().split('T')[0]}`;
      const scheduleRef = doc(db, 'employeeSchedules', scheduleId);
      this.logFirestoreCall('getDoc', `employeeSchedules/${scheduleId}`);
      const scheduleSnap = await getDoc(scheduleRef);

      if (!scheduleSnap.exists()) {
        return null;
      }

      return scheduleSnap.data() as EmployeeSchedule;
    } catch (error) {
      console.error('📅 EmployeeScheduleService: Error getting employee schedule:', error);
      throw error;
    }
  }

  /**
   * Get available time slots for a specific date and workshop location
   */
  async getAvailableSlots(date: Date, workshopLocationId?: string, durationMinutes: number = 60): Promise<{ startTime: Date; endTime: Date }[]> {
    try {
      console.log('📅 EmployeeScheduleService: Getting available slots for date:', date, 'location:', workshopLocationId);

      // Get all employee schedules for this date in a single batch query
      const dateString = date.toISOString().split('T')[0];
      const schedulesQuery = query(
        collection(db, 'employeeSchedules'),
        where('date', '==', FirestoreTimestamp.fromDate(date))
      );
      this.logFirestoreCall('getDocs', `employeeSchedules query for date ${dateString}`);
      const schedulesSnap = await getDocs(schedulesQuery);
      const allSchedules = schedulesSnap.docs.map(doc => doc.data() as EmployeeSchedule);

      // Get all employees and filter by those with schedules
      const employeesQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['technician', 'employee', 'front_desk']),
        where('active', '==', true)
      );
      this.logFirestoreCall('getDocs', 'users query for active employees');
      const employeesSnap = await getDocs(employeesQuery);
      const allEmployees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

      // Create a map of employee schedules for quick lookup
      const scheduleMap = new Map<string, EmployeeSchedule>();
      allSchedules.forEach(schedule => {
        scheduleMap.set(schedule.employeeId, schedule);
      });

      // Filter employees who have schedules for this date
      const availableEmployees = allEmployees.filter(employee => scheduleMap.has(employee.id));

      if (availableEmployees.length === 0) {
        return [];
      }

      // Get workshop capacity if location specified
      let maxConcurrent = availableEmployees.length; // Default to number of available employees
      if (workshopLocationId) {
        const capacity = await this.getWorkshopCapacity(workshopLocationId, date);
        maxConcurrent = Math.min(maxConcurrent, capacity?.maxTechnicians || maxConcurrent);
      }

      console.log(`📅 EmployeeScheduleService: Checking availability for ${availableEmployees.length} employees, max concurrent: ${maxConcurrent}`);

      // For simplicity, assume standard business hours 8:00-18:00
      const businessStart = new Date(date);
      businessStart.setHours(8, 0, 0, 0);
      const businessEnd = new Date(date);
      businessEnd.setHours(18, 0, 0, 0);

      const slots: { startTime: Date; endTime: Date }[] = [];
      let currentTime = new Date(businessStart);

      while (currentTime.getTime() + durationMinutes * 60000 <= businessEnd.getTime()) {
        const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60000);

        // Check if this slot has enough available employees using cached schedules
        const availableCount = this.countAvailableEmployeesAtTimeCached(availableEmployees, scheduleMap, currentTime, slotEnd);

        if (availableCount >= Math.min(1, maxConcurrent)) { // At least 1 employee available
          slots.push({ startTime: new Date(currentTime), endTime: new Date(slotEnd) });
        }

        // Move to next slot (30-minute intervals)
        currentTime.setMinutes(currentTime.getMinutes() + 30);
      }

      console.log(`📅 EmployeeScheduleService: Found ${slots.length} available slots after ${this.firestoreCallCount} Firestore calls`);
      return slots;
    } catch (error) {
      console.error('📅 EmployeeScheduleService: Error getting available slots:', error);
      throw error;
    }
  }

  /**
   * Check if an employee is available at a specific time
   */
  async isEmployeeAvailable(employeeId: string, startTime: Date, endTime: Date): Promise<boolean> {
    try {
      console.log('📅 EmployeeScheduleService: Checking availability for employee:', employeeId, 'from', startTime, 'to', endTime);

      // Get employee schedule for the date
      const schedule = await this.getEmployeeSchedule(employeeId, startTime);
      if (!schedule) {
        return false; // No schedule means not available
      }

      // Check if the time falls within any shift
      const isWithinShift = schedule.shifts.some(shift => {
        const shiftStart = this.parseTime(shift.startTime);
        const shiftEnd = this.parseTime(shift.endTime);

        const requestedStart = startTime.getHours() * 60 + startTime.getMinutes();
        const requestedEnd = endTime.getHours() * 60 + endTime.getMinutes();

        return requestedStart >= shiftStart && requestedEnd <= shiftEnd;
      });

      if (!isWithinShift) {
        return false;
      }

      // Check for conflicts with breaks
      const hasBreakConflict = schedule.breaks.some(breakConfig => {
        const breakStart = this.parseTime(breakConfig.startTime);
        const breakEnd = breakStart + breakConfig.durationMinutes;

        const requestedStart = startTime.getHours() * 60 + startTime.getMinutes();
        const requestedEnd = endTime.getHours() * 60 + endTime.getMinutes();

        return !(requestedEnd <= breakStart || requestedStart >= breakEnd);
      });

      if (hasBreakConflict) {
        return false;
      }

      // Check for existing time blocks (appointments, etc.)
      const hasTimeBlockConflict = schedule.timeBlocks.some(block => {
        const blockStart = block.startTime.toDate();
        const blockEnd = block.endTime.toDate();

        return !(endTime <= blockStart || startTime >= blockEnd);
      });

      return !hasTimeBlockConflict;
    } catch (error) {
      console.error('📅 EmployeeScheduleService: Error checking employee availability:', error);
      throw error;
    }
  }

  /**
    * Get first page of employees available for a service at a specific date and time
    */
   async getEmployeesAvailableForService(date: Date, workshopLocationId?: string, serviceId?: string): Promise<User[]> {
     try {
       console.log('📅 EmployeeScheduleService: Getting first page of available employees for date:', date.toISOString(), 'location:', workshopLocationId);

       // Get all employees (technicians, employees, front_desk) from cache
       const allEmployees = await this.loadActiveEmployees();
       console.log('📅 EmployeeScheduleService: DEBUG - Using', allEmployees.length, 'active employees with roles technician/employee/front_desk');

       // Get all employee schedules for this date in a single batch query
       const schedulesQuery = query(
         collection(db, 'employeeSchedules'),
         where('date', '==', FirestoreTimestamp.fromDate(date))
       );
       this.logFirestoreCall('getDocs', `employeeSchedules query for date ${date.toISOString().split('T')[0]}`);
       const schedulesSnap = await getDocs(schedulesQuery);
       const allSchedules = schedulesSnap.docs.map(doc => doc.data() as EmployeeSchedule);
       console.log('📅 EmployeeScheduleService: DEBUG - Fetched', allSchedules.length, 'employee schedules for date');

       // Create a map of employee schedules for quick lookup
       const scheduleMap = new Map<string, EmployeeSchedule>();
       allSchedules.forEach(schedule => {
         scheduleMap.set(schedule.employeeId, schedule);
       });

       // Filter by workshop location if specified
       let filteredEmployees = allEmployees;
       if (workshopLocationId) {
         // For now, assume all employees can work at any location
         filteredEmployees = allEmployees;
       }

       // Filter by availability on the date (employees with schedules)
       const availableEmployees = filteredEmployees.filter(employee => scheduleMap.has(employee.id));
       console.log('📅 EmployeeScheduleService: DEBUG - After filtering by schedules:', availableEmployees.length, 'available employees');

       // If service specified, filter by required skills
       if (serviceId) {
         const service = await this.getServiceById(serviceId);
         if (service?.requiredSkills) {
           const skillFiltered = availableEmployees.filter(employee => {
             const skills = employee.technicianProfile?.skills || [];
             return service.requiredSkills!.every(skill => skills.includes(skill));
           });
           console.log('📅 EmployeeScheduleService: DEBUG - After skill filtering:', skillFiltered.length, 'employees match required skills');
           this.employeesCurrentList = skillFiltered.slice(0, this.EMPLOYEES_PAGE_SIZE);
           this.employeesLastDoc = skillFiltered.length > this.EMPLOYEES_PAGE_SIZE ? skillFiltered[this.EMPLOYEES_PAGE_SIZE - 1] : null;
           this.employeesHasMore = skillFiltered.length > this.EMPLOYEES_PAGE_SIZE;
           return this.employeesCurrentList;
         }
       }

       console.log('📅 EmployeeScheduleService: Found', availableEmployees.length, 'available employees');
       this.employeesCurrentList = availableEmployees.slice(0, this.EMPLOYEES_PAGE_SIZE);
       this.employeesLastDoc = availableEmployees.length > this.EMPLOYEES_PAGE_SIZE ? availableEmployees[this.EMPLOYEES_PAGE_SIZE - 1] : null;
       this.employeesHasMore = availableEmployees.length > this.EMPLOYEES_PAGE_SIZE;
       return this.employeesCurrentList;
     } catch (error) {
       console.error('📅 EmployeeScheduleService: Error getting available employees:', error);
       throw error;
     }
   }

   /**
    * Load more employees for pagination
    */
   loadMoreEmployees(): User[] {
     if (!this.employeesHasMore || !this.employeesLastDoc) {
       return [];
     }

     // For simplicity, since we have the full list cached, just return next page
     // In a real implementation with server-side pagination, this would query Firestore
     const allAvailable = this.employeesCurrentList; // This is not the full list, need to refactor

     // Actually, since we load all and filter in memory, pagination is client-side
     const startIndex = this.employeesCurrentList.length;
     const nextPage = allAvailable.slice(startIndex, startIndex + this.EMPLOYEES_PAGE_SIZE);

     if (nextPage.length > 0) {
       this.employeesCurrentList = [...this.employeesCurrentList, ...nextPage];
       this.employeesLastDoc = nextPage.length === this.EMPLOYEES_PAGE_SIZE ? nextPage[nextPage.length - 1] : null;
       this.employeesHasMore = nextPage.length === this.EMPLOYEES_PAGE_SIZE;
     }

     return nextPage;
   }

   getEmployeesPaginationState() {
     return {
       hasMore: this.employeesHasMore,
       currentCount: this.employeesCurrentList.length
     };
   }

  /**
   * Create a time block for an employee
   */
  async createTimeBlock(employeeId: string, startTime: Date, endTime: Date, type: 'work' | 'break' | 'maintenance', workshopLocationId?: string): Promise<TimeBlock> {
    try {
      console.log('📅 EmployeeScheduleService: Creating time block for employee:', employeeId, 'type:', type);

      // Validate the time block doesn't conflict
      const hasConflict = await this.validateScheduleConflict(employeeId, startTime, endTime);
      if (hasConflict) {
        throw new Error('Time block conflicts with existing schedule');
      }

      const timeBlockId = `${employeeId}_${startTime.getTime()}_${endTime.getTime()}`;
      const timeBlock: TimeBlock = {
        id: timeBlockId,
        startTime: FirestoreTimestamp.fromDate(startTime),
        endTime: FirestoreTimestamp.fromDate(endTime),
        type,
        technicianId: employeeId,
        workshopLocationId,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };

      const timeBlockRef = doc(db, 'timeBlocks', timeBlockId);
      await setDoc(timeBlockRef, timeBlock);

      // Update the employee's schedule to include this time block
      const schedule = await this.getEmployeeSchedule(employeeId, startTime);
      if (schedule) {
        const updatedTimeBlocks = [...schedule.timeBlocks, timeBlock];
        await this.updateSchedule(schedule.id, { timeBlocks: updatedTimeBlocks });
      }

      console.log('📅 EmployeeScheduleService: Time block created successfully:', timeBlockId);
      return timeBlock;
    } catch (error) {
      console.error('📅 EmployeeScheduleService: Error creating time block:', error);
      throw error;
    }
  }

  /**
   * Get time blocks for an employee on a specific date
   */
  async getTimeBlocks(employeeId: string, date: Date): Promise<TimeBlock[]> {
    try {
      console.log('📅 EmployeeScheduleService: Getting time blocks for employee:', employeeId, 'on date:', date);

      const schedule = await this.getEmployeeSchedule(employeeId, date);
      if (!schedule) {
        return [];
      }

      // Also get time blocks from the timeBlocks collection for this date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const timeBlocksQuery = query(
        collection(db, 'timeBlocks'),
        where('technicianId', '==', employeeId),
        where('startTime', '>=', FirestoreTimestamp.fromDate(startOfDay)),
        where('startTime', '<=', FirestoreTimestamp.fromDate(endOfDay))
      );

      const timeBlocksSnap = await getDocs(timeBlocksQuery);
      const timeBlocks = timeBlocksSnap.docs.map(doc => doc.data() as TimeBlock);

      console.log('📅 EmployeeScheduleService: Found', timeBlocks.length, 'time blocks');
      return timeBlocks;
    } catch (error) {
      console.error('📅 EmployeeScheduleService: Error getting time blocks:', error);
      throw error;
    }
  }

  /**
   * Validate if a time slot conflicts with existing schedule
   */
  async validateScheduleConflict(employeeId: string, startTime: Date, endTime: Date): Promise<boolean> {
    try {
      console.log('📅 EmployeeScheduleService: Validating schedule conflict for employee:', employeeId);

      return !(await this.isEmployeeAvailable(employeeId, startTime, endTime));
    } catch (error) {
      console.error('📅 EmployeeScheduleService: Error validating schedule conflict:', error);
      throw error;
    }
  }

  /**
   * Calculate total working hours from shifts and breaks
   */
  calculateWorkingHours(shifts: ShiftConfig[], breaks: BreakConfig[]): number {
    let totalMinutes = 0;

    for (const shift of shifts) {
      const startMinutes = this.parseTime(shift.startTime);
      const endMinutes = this.parseTime(shift.endTime);
      totalMinutes += endMinutes - startMinutes;
    }

    // Subtract break time
    for (const breakConfig of breaks) {
      totalMinutes -= breakConfig.durationMinutes;
    }

    return Math.max(0, totalMinutes / 60); // Convert to hours
  }

  // Helper methods

  private async getEmployeeById(employeeId: string): Promise<User | null> {
    try {
      const userRef = doc(db, 'users', employeeId);
      const userSnap = await getDoc(userRef);
      return userSnap.exists() ? ({ id: userSnap.id, ...userSnap.data() } as User) : null;
    } catch (error) {
      console.error('📅 EmployeeScheduleService: Error getting employee:', error);
      return null;
    }
  }

  private async getWorkshopCapacity(workshopLocationId: string, date: Date): Promise<WorkshopCapacity | null> {
    try {
      const capacityId = `${workshopLocationId}_${date.toISOString().split('T')[0]}`;
      const capacityRef = doc(db, 'workshopCapacities', capacityId);
      const capacitySnap = await getDoc(capacityRef);
      return capacitySnap.exists() ? capacitySnap.data() as WorkshopCapacity : null;
    } catch (error) {
      console.error('📅 EmployeeScheduleService: Error getting workshop capacity:', error);
      return null;
    }
  }

  private async countAvailableEmployeesAtTime(employees: User[], startTime: Date, endTime: Date): Promise<number> {
    let count = 0;
    for (const employee of employees) {
      if (await this.isEmployeeAvailable(employee.id, startTime, endTime)) {
        count++;
      }
    }
    return count;
  }

  private countAvailableEmployeesAtTimeCached(employees: User[], scheduleMap: Map<string, EmployeeSchedule>, startTime: Date, endTime: Date): number {
    let count = 0;
    for (const employee of employees) {
      const schedule = scheduleMap.get(employee.id);
      if (schedule && this.isEmployeeAvailableCached(schedule, startTime, endTime)) {
        count++;
      }
    }
    return count;
  }

  private isEmployeeAvailableCached(schedule: EmployeeSchedule, startTime: Date, endTime: Date): boolean {
    // Check if the time falls within any shift
    const isWithinShift = schedule.shifts.some(shift => {
      const shiftStart = this.parseTime(shift.startTime);
      const shiftEnd = this.parseTime(shift.endTime);

      const requestedStart = startTime.getHours() * 60 + startTime.getMinutes();
      const requestedEnd = endTime.getHours() * 60 + endTime.getMinutes();

      return requestedStart >= shiftStart && requestedEnd <= shiftEnd;
    });

    if (!isWithinShift) {
      return false;
    }

    // Check for conflicts with breaks
    const hasBreakConflict = schedule.breaks.some(breakConfig => {
      const breakStart = this.parseTime(breakConfig.startTime);
      const breakEnd = breakStart + breakConfig.durationMinutes;

      const requestedStart = startTime.getHours() * 60 + startTime.getMinutes();
      const requestedEnd = endTime.getHours() * 60 + endTime.getMinutes();

      return !(requestedEnd <= breakStart || requestedStart >= breakEnd);
    });

    if (hasBreakConflict) {
      return false;
    }

    // Check for existing time blocks (appointments, etc.)
    const hasTimeBlockConflict = schedule.timeBlocks.some(block => {
      const blockStart = block.startTime.toDate();
      const blockEnd = block.endTime.toDate();

      return !(endTime <= blockStart || startTime >= blockEnd);
    });

    return !hasTimeBlockConflict;
  }

  private async getServiceById(serviceId: string): Promise<ServiceItem | null> {
    try {
      const serviceRef = doc(db, 'services', serviceId);
      const serviceSnap = await getDoc(serviceRef);
      return serviceSnap.exists() ? serviceSnap.data() as ServiceItem : null;
    } catch (error) {
      console.error('📅 EmployeeScheduleService: Error getting service:', error);
      return null;
    }
  }

  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }
}