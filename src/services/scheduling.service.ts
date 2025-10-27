import { Injectable, inject } from '@angular/core';
import { WorkOrderService } from './work-order.service';
import { UserService } from './user.service';
import { ServiceItemService } from './service-item.service';
import { SessionService } from './session.service';
import { Appointment, WorkOrder, UserProfile } from '../models';

export type TechnicianStatus = 'available' | 'busy' | 'fully_booked';

export interface TechnicianWorkload {
  technician: UserProfile;
  status: TechnicianStatus;
  activeServices: number;
  isAvailableForAssignment: boolean;
  activeWork: {
    appointments: Appointment[];
    workOrders: WorkOrder[];
  };
  scheduledAppointments: Appointment[];
}

@Injectable({
  providedIn: 'root'
})
export class SchedulingService {
  private userService = inject(UserService);
  private serviceItemService = inject(ServiceItemService);
  private sessionService = inject(SessionService);

  private MAX_ACTIVE_SERVICES = 2;

  // Method to calculate technician data with provided appointments
  private calculateTechnicianData(allAppointments: any[] = [], allWorkOrders: any[] = []) {
    const technicians = this.userService.getTechnicians();

    return technicians.map(tech => {
      const activeAppointments = allAppointments.filter(apt => apt.assignedTo === tech.id && apt.status === 'in_progress');
      const activeWorkOrders = allWorkOrders.filter(wo => wo.assignedTo === tech.id && wo.status === 'in_progress');

      const scheduledAppointments = allAppointments.filter(apt => apt.assignedTo === tech.id && apt.status === 'scheduled');

      const activeServices = activeAppointments.length + activeWorkOrders.length;
      const isAvailable = tech.active !== false && activeServices < this.MAX_ACTIVE_SERVICES;

      let status: TechnicianStatus = 'available';
      if (activeServices >= this.MAX_ACTIVE_SERVICES) {
        status = 'fully_booked';
      } else if (activeServices > 0) {
        status = 'busy';
      }

      return {
        technician: tech,
        status,
        activeServices,
        isAvailableForAssignment: isAvailable,
        activeWork: {
          appointments: activeAppointments,
          workOrders: activeWorkOrders
        },
        scheduledAppointments
      };
    });
  }

  /**
   * Provides a real-time list of all technicians with their current workload and status.
   */
  getTechnicianWorkloads(allAppointments: any[] = [], allWorkOrders: any[] = []): TechnicianWorkload[] {
    return this.calculateTechnicianData(allAppointments, allWorkOrders);
  }

  /**
   * Gets the detailed status and workload for a single technician.
   * @param technicianId The ID of the technician.
   * @param allAppointments Optional array of all appointments.
   * @param allWorkOrders Optional array of all work orders.
   * @returns A `TechnicianWorkload` object or `undefined` if the technician is not found.
   */
  getTechnicianStatus(technicianId: string, allAppointments: any[] = [], allWorkOrders: any[] = []): TechnicianWorkload | undefined {
    return this.calculateTechnicianData(allAppointments, allWorkOrders).find(t => t.technician.id === technicianId);
  }

  /**
   * Finds the best available technician for a new assignment based on workload and skills.
   * @param requiredSkills An optional array of skills required for the task.
   * @param allAppointments Optional array of all appointments.
   * @param allWorkOrders Optional array of all work orders.
   * @returns The best `UserProfile` for the job, or `undefined` if no one is available.
   */
  findBestAvailableTechnician(requiredSkills: string[] = [], allAppointments: any[] = [], allWorkOrders: any[] = []): UserProfile | undefined {
    const availableTechnicians = this.calculateTechnicianData(allAppointments, allWorkOrders)
      .filter(t => t.isAvailableForAssignment)
      .sort((a, b) => a.activeServices - b.activeServices); // Sort by least busy

    if (requiredSkills.length === 0) {
      return availableTechnicians[0]?.technician;
    }

    // Filter by skills
    const eligibleTechnicians = availableTechnicians.filter(t => {
      const techSkills = t.technician.technicianProfile?.skills || [];
      return requiredSkills.every(skill => techSkills.includes(skill));
    });

    return eligibleTechnicians[0]?.technician;
  }

  /**
   * Checks if assigning a new task to a technician would violate the "two active services" rule.
   * Also checks if the technician is available based on their session (not logged out at 10 PM).
   * @param technicianId The ID of the technician to check.
   * @param allAppointments Optional array of all appointments.
   * @param allWorkOrders Optional array of all work orders.
   * @returns `true` if the technician can be assigned another task, `false` otherwise.
   */
  canAssignTask(technicianId: string, allAppointments: any[] = [], allWorkOrders: any[] = []): boolean {
    const techStatus = this.getTechnicianStatus(technicianId, allAppointments, allWorkOrders);
    const technician = this.userService.getUserById(technicianId);

    // Check workload availability
    const workloadAvailable = techStatus?.isAvailableForAssignment ?? false;

    // Check session availability (not logged out at 10 PM)
    const sessionAvailable = technician ? this.sessionService.isUserAvailableForQueue(technician) : false;

    // Check manual availability setting
    const manualAvailable = technician?.availability?.isAvailable ?? true; // Default to available if not set

    return workloadAvailable && sessionAvailable && manualAvailable;
  }

  /**
   * Automatically assigns the best available technician to an appointment.
   * @param appointment The appointment to assign.
   * @returns The ID of the assigned technician, or undefined if none available.
   */
  autoAssignTechnician(appointment: any, existingAppointments: any[] = []): string | undefined {
    const serviceInfo = this.serviceItemService.getServices()().find(s => s.title === appointment.serviceTypes[0]);
    const requiredSkills = serviceInfo?.requiredSkills || [];

    // Use the centralized scheduling service to find the best available technician
    const bestTechnician = this.findBestAvailableTechnician(requiredSkills);

    if (!bestTechnician) {
      return undefined;
    }

    // Additional check for time-slot conflicts using provided appointments
    const appointmentDate = appointment.scheduledAt.toDate();
    const techAppointments = existingAppointments.filter(a => a.assignedTo === bestTechnician.id);
    const newAptStart = appointmentDate;
    const newAptEnd = new Date(newAptStart.getTime() + appointment.estimatedDuration * 60000);

    const hasConflict = techAppointments.some(existingApt => {
      const existingStart = existingApt.scheduledAt.toDate();
      const existingEnd = new Date(existingStart.getTime() + existingApt.estimatedDuration * 60000);
      return newAptStart < existingEnd && newAptEnd > existingStart;
    });

    if (hasConflict) {
      // The best technician by workload has a conflict, so we can't assign.
      // A more advanced implementation could try the next best technician.
      return undefined;
    }

    return bestTechnician.id;
  }
}