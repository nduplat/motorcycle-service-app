import { Injectable, inject } from '@angular/core';
import { TimeEntryService } from './time-entry.service';
import { UserService } from './user.service';
import { WorkOrderService } from './work-order.service';
import { TimeEntry, User, WorkOrder } from '../models';

export interface TimeReport {
  technicianId: string;
  technicianName: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalEntries: number;
    totalMinutes: number;
    totalPausedMinutes: number;
    billableMinutes: number;
    efficiency: number; // percentage
  };
  entries: TimeEntryReport[];
  workOrders: WorkOrderSummary[];
}

export interface TimeEntryReport {
  id: string;
  workOrderId: string;
  workOrderNumber?: string;
  startAt: Date;
  endAt?: Date;
  totalMinutes: number;
  pausedMinutes: number;
  billableMinutes: number;
  pauses: PauseReport[];
  status: 'active' | 'completed';
}

export interface PauseReport {
  pauseAt: Date;
  resumeAt?: Date;
  duration: number; // minutes
  reason?: string;
}

export interface WorkOrderSummary {
  id: string;
  number?: string;
  totalTime: number; // minutes
  billableTime: number; // minutes
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class TimeReportService {
  private timeEntryService = inject(TimeEntryService);
  private userService = inject(UserService);
  private workOrderService = inject(WorkOrderService);

  /**
   * Generate comprehensive time report for a technician
   */
  async generateTechnicianReport(
    technicianId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TimeReport> {
    try {
      // Get technician info
      const technician = this.userService.getUserById(technicianId);
      if (!technician) {
        throw new Error('Technician not found');
      }

      // Get time entries
      const timeEntries = await this.timeEntryService.getTimeEntriesForTechnician(
        technicianId,
        startDate,
        endDate
      );

      // Process entries
      const entries = await this.processTimeEntries(timeEntries);

      // Get work order summaries
      const workOrders = await this.generateWorkOrderSummaries(technicianId, timeEntries);

      // Calculate summary
      const summary = this.calculateSummary(entries);

      return {
        technicianId,
        technicianName: technician.name,
        period: { startDate, endDate },
        summary,
        entries,
        workOrders
      };
    } catch (error) {
      console.error('Error generating technician report:', error);
      throw error;
    }
  }

  /**
   * Generate team time report
   */
  async generateTeamReport(
    technicianIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<TimeReport[]> {
    const reports: TimeReport[] = [];

    for (const technicianId of technicianIds) {
      try {
        const report = await this.generateTechnicianReport(technicianId, startDate, endDate);
        reports.push(report);
      } catch (error) {
        console.error(`Error generating report for technician ${technicianId}:`, error);
        // Continue with other technicians
      }
    }

    return reports;
  }

  /**
   * Generate work order time report
   */
  async generateWorkOrderReport(workOrderId: string): Promise<any> {
    try {
      // Get work order
      const workOrder = await this.workOrderService.getWorkOrder(workOrderId).toPromise();
      if (!workOrder) {
        throw new Error('Work order not found');
      }

      // Get time entries for this work order
      const timeEntries = await this.timeEntryService.getTimeEntriesForWorkOrder(workOrderId);

      // Process entries
      const entries = await this.processTimeEntries(timeEntries);

      // Calculate totals
      const totalMinutes = entries.reduce((sum, entry) => sum + entry.totalMinutes, 0);
      const totalPausedMinutes = entries.reduce((sum, entry) => sum + entry.pausedMinutes, 0);
      const totalBillableMinutes = entries.reduce((sum, entry) => sum + entry.billableMinutes, 0);

      return {
        workOrderId,
        workOrderNumber: workOrder.number,
        clientId: workOrder.clientId,
        totalMinutes,
        totalPausedMinutes,
        totalBillableMinutes,
        entries,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error generating work order report:', error);
      throw error;
    }
  }

  /**
   * Process time entries into report format
   */
  private async processTimeEntries(timeEntries: TimeEntry[]): Promise<TimeEntryReport[]> {
    const entries: TimeEntryReport[] = [];

    for (const entry of timeEntries) {
      // Get work order info
      let workOrderNumber: string | undefined;
      try {
        const workOrder = await this.workOrderService.getWorkOrder(entry.workOrderId).toPromise();
        workOrderNumber = workOrder?.number;
      } catch (error) {
        console.warn(`Could not get work order ${entry.workOrderId}:`, error);
      }

      // Process pauses
      const pauses: PauseReport[] = [];
      if (entry.pauses) {
        for (const pause of entry.pauses) {
          const pauseStart = pause.pauseAt.toDate();
          const pauseEnd = pause.resumeAt ? pause.resumeAt.toDate() : new Date();
          const duration = Math.floor((pauseEnd.getTime() - pauseStart.getTime()) / (1000 * 60));

          pauses.push({
            pauseAt: pauseStart,
            resumeAt: pause.resumeAt?.toDate(),
            duration,
            reason: pause.reason
          });
        }
      }

      // Calculate times
      const startTime = entry.startAt.toDate();
      const endTime = entry.endAt ? entry.endAt.toDate() : new Date();
      const totalMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      const pausedMinutes = pauses.reduce((sum, pause) => sum + pause.duration, 0);
      const billableMinutes = totalMinutes - pausedMinutes;

      entries.push({
        id: entry.id,
        workOrderId: entry.workOrderId,
        workOrderNumber,
        startAt: startTime,
        endAt: entry.endAt?.toDate(),
        totalMinutes,
        pausedMinutes,
        billableMinutes,
        pauses,
        status: entry.endAt ? 'completed' : 'active'
      });
    }

    return entries;
  }

  /**
   * Generate work order summaries
   */
  private async generateWorkOrderSummaries(
    technicianId: string,
    timeEntries: TimeEntry[]
  ): Promise<WorkOrderSummary[]> {
    const workOrderMap = new Map<string, WorkOrderSummary>();

    for (const entry of timeEntries) {
      if (!workOrderMap.has(entry.workOrderId)) {
        try {
          const workOrder = await this.workOrderService.getWorkOrder(entry.workOrderId).toPromise();
          if (workOrder) {
            workOrderMap.set(entry.workOrderId, {
              id: entry.workOrderId,
              number: workOrder.number,
              totalTime: 0,
              billableTime: 0,
              status: workOrder.status
            });
          }
        } catch (error) {
          console.warn(`Could not get work order ${entry.workOrderId}:`, error);
        }
      }

      // Calculate time for this entry
      const startTime = entry.startAt.toDate();
      const endTime = entry.endAt ? entry.endAt.toDate() : new Date();
      const totalMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));

      let pausedMinutes = 0;
      if (entry.pauses) {
        for (const pause of entry.pauses) {
          const pauseStart = pause.pauseAt.toDate();
          const pauseEnd = pause.resumeAt ? pause.resumeAt.toDate() : endTime;
          pausedMinutes += Math.floor((pauseEnd.getTime() - pauseStart.getTime()) / (1000 * 60));
        }
      }

      const billableMinutes = totalMinutes - pausedMinutes;

      const summary = workOrderMap.get(entry.workOrderId);
      if (summary) {
        summary.totalTime += totalMinutes;
        summary.billableTime += billableMinutes;
      }
    }

    return Array.from(workOrderMap.values());
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(entries: TimeEntryReport[]): TimeReport['summary'] {
    const totalEntries = entries.length;
    const totalMinutes = entries.reduce((sum, entry) => sum + entry.totalMinutes, 0);
    const totalPausedMinutes = entries.reduce((sum, entry) => sum + entry.pausedMinutes, 0);
    const billableMinutes = entries.reduce((sum, entry) => sum + entry.billableMinutes, 0);
    const efficiency = totalMinutes > 0 ? (billableMinutes / totalMinutes) * 100 : 0;

    return {
      totalEntries,
      totalMinutes,
      totalPausedMinutes,
      billableMinutes,
      efficiency
    };
  }

  /**
   * Export report to CSV
   */
  exportToCSV(report: TimeReport): string {
    const headers = [
      'Work Order',
      'Start Time',
      'End Time',
      'Total Minutes',
      'Paused Minutes',
      'Billable Minutes',
      'Status'
    ];

    const rows = report.entries.map(entry => [
      entry.workOrderNumber || entry.workOrderId,
      entry.startAt.toISOString(),
      entry.endAt?.toISOString() || '',
      entry.totalMinutes.toString(),
      entry.pausedMinutes.toString(),
      entry.billableMinutes.toString(),
      entry.status
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  }
}