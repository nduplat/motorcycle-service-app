import { Injectable, inject } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { ScheduleWorkflowService } from './schedule-workflow.service';

export interface WorkshopCapacity {
  availableTechnicians: number;
  totalCapacity: number;
  currentLoad: number;
  technicianAvailability?: any[];
  utilizationPercentage?: number;
  activeWorkOrders?: number;
  todaysAppointments?: number;
  cached?: boolean;
  calculatedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class WorkshopCapacityService {
  private scheduleWorkflowService = inject(ScheduleWorkflowService);

  calculateCurrentCapacity(): Observable<WorkshopCapacity> {
    return from(this.scheduleWorkflowService.calculateCapacityWorkflow().then(result => ({
      availableTechnicians: result.availableTechnicians,
      totalCapacity: result.totalCapacity,
      currentLoad: result.usedCapacity,
      technicianAvailability: [], // Could be populated with more detailed data if needed
      utilizationPercentage: result.utilizationPercentage,
      activeWorkOrders: result.activeWorkOrders,
      todaysAppointments: result.todaysAppointments,
      cached: result.cached,
      calculatedAt: result.calculatedAt
    })));
  }

  getBottleneckAnalysis(): Observable<{
    bottlenecks: Array<{
      type: 'technician' | 'time_slot' | 'equipment' | 'process';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      impact: number;
      recommendations: string[];
    }>;
    overallEfficiency: number;
    criticalBottlenecks: number;
  }> {
    return of({
      bottlenecks: [],
      overallEfficiency: 85,
      criticalBottlenecks: 0
    });
  }

  canAccommodateService(serviceDuration: number, date: Date): Observable<{ canAccommodate: boolean }> {
    return of({ canAccommodate: true });
  }

  getOptimalAppointmentSlots(date: Date, serviceDuration: number): Observable<Array<{ startTime: Date }>> {
    return of([]);
  }

  getCapacityForDate(date: Date): Observable<WorkshopCapacity> {
    return from(this.scheduleWorkflowService.calculateCapacityWorkflow().then(result => ({
      availableTechnicians: result.availableTechnicians,
      totalCapacity: result.totalCapacity,
      currentLoad: result.usedCapacity,
      technicianAvailability: [], // Could be populated with more detailed data if needed
      utilizationPercentage: result.utilizationPercentage,
      activeWorkOrders: result.activeWorkOrders,
      todaysAppointments: result.todaysAppointments,
      cached: result.cached,
      calculatedAt: result.calculatedAt
    })));
  }
}