import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { AppointmentService } from './appointment.service';
import { WorkOrderService } from './work-order.service';
import { UserService } from './user.service';
import { EmployeeScheduleService } from './employee-schedule.service';
import { CacheService } from './cache.service';
import { Appointment, WorkOrder, User } from '../models';

export interface CapacityPlanningRequest {
  startDate: Date;
  endDate: Date;
  workshopLocationId?: string;
  includeHistoricalData?: boolean;
  forecastHorizon?: number; // days ahead to forecast
}

export interface HistoricalData {
  appointments: Appointment[];
  workOrders: WorkOrder[];
  technicianSchedules: any[];
  dateRange: {
    start: Date;
    end: Date;
  };
}

export interface PatternAnalysis {
  dailyUsage: {
    average: number;
    peak: number;
    low: number;
    standardDeviation: number;
  };
  peakHours: {
    hour: number;
    averageLoad: number;
    peakLoad: number;
  }[];
  seasonalTrends: {
    month: number;
    averageLoad: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }[];
  technicianUtilization: {
    technicianId: string;
    averageUtilization: number;
    peakUtilization: number;
    efficiency: number;
  }[];
}

export interface BaselineCapacity {
  totalTechnicians: number;
  averageCapacityPerDay: number;
  peakCapacityPerDay: number;
  standardCapacityPerDay: number;
}

export interface CapacityAdjustments {
  dayOfWeekFactors: { [day: number]: number }; // 0-6, multiplier
  specialEvents: {
    date: Date;
    factor: number;
    reason: string;
  }[];
  staffChanges: {
    date: Date;
    technicianChange: number;
    reason: string;
  }[];
  seasonalFactors: {
    month: number;
    factor: number;
  }[];
}

export interface CapacityForecast {
  date: Date;
  baselineCapacity: number;
  adjustedCapacity: number;
  expectedLoad: number;
  availableCapacity: number;
  utilizationPercentage: number;
  confidence: number;
}

export interface RiskFactors {
  highUtilizationDays: {
    date: Date;
    utilization: number;
    risk: 'low' | 'medium' | 'high' | 'critical';
  }[];
  technicianShortages: {
    date: Date;
    shortage: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }[];
  peakHourOverloads: {
    date: Date;
    hour: number;
    overload: number;
  }[];
  seasonalRisks: {
    period: string;
    risk: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
  }[];
}

export interface CapacityRecommendations {
  staffing: {
    additionalTechnicians: number;
    dates: Date[];
    priority: 'low' | 'medium' | 'high';
    reason: string;
  }[];
  scheduling: {
    shiftAdjustments: {
      date: Date;
      recommendedShifts: number;
      currentShifts: number;
    }[];
    breakOptimizations: {
      date: Date;
      recommendedBreakReduction: number;
    }[];
  };
  process: {
    automationOpportunities: string[];
    efficiencyImprovements: string[];
    bottleneckResolutions: string[];
  };
}

export interface CapacityPlan {
  request: CapacityPlanningRequest;
  timeFrame: {
    start: Date;
    end: Date;
  };
  historicalData: HistoricalData;
  patternAnalysis: PatternAnalysis;
  baselineCapacity: BaselineCapacity;
  adjustments: CapacityAdjustments;
  forecast: CapacityForecast[];
  confidenceScore: number;
  riskFactors: RiskFactors;
  recommendations: CapacityRecommendations;
  generatedAt: Date;
  validUntil: Date;
}

export interface CapacityPlanningResult {
  success: boolean;
  capacityPlan?: CapacityPlan;
  error?: string;
  step?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CapacityPlanningService {
  private appointmentService = inject(AppointmentService);
  private workOrderService = inject(WorkOrderService);
  private userService = inject(UserService);
  private employeeScheduleService = inject(EmployeeScheduleService);
  private cacheService = inject(CacheService);

  /**
   * Execute the Capacity Planning Process workflow
   * Follows the workflow: capacity planning request → determine time frame → gather historical data → analyze patterns → calculate baseline capacity → apply adjustments → generate forecast → calculate confidence score → identify risk factors → generate recommendations → return capacity plan
   */
  async capacityPlanningWorkflow(request: CapacityPlanningRequest): Promise<CapacityPlanningResult> {
    try {
      console.log('🔄 CapacityPlanningService: Starting capacity planning workflow');

      // Step 1: Determine Time Frame
      const timeFrame = await this.determineTimeFrame(request);
      if (!timeFrame) {
        return {
          success: false,
          error: 'Invalid time frame',
          step: 'determine_time_frame'
        };
      }

      // Step 2: Gather Historical Data
      const historicalData = await this.gatherHistoricalData(timeFrame);

      // Step 3: Analyze Patterns
      const patternAnalysis = await this.analyzePatterns(historicalData);

      // Step 4: Calculate Baseline Capacity
      const baselineCapacity = await this.calculateBaselineCapacity(patternAnalysis, historicalData);

      // Step 5: Apply Adjustments
      const adjustments = await this.applyAdjustments(timeFrame);

      // Step 6: Generate Forecast
      const forecast = await this.generateForecast(
        baselineCapacity,
        adjustments,
        patternAnalysis,
        timeFrame
      );

      // Step 7: Calculate Confidence Score
      const confidenceScore = await this.calculateConfidenceScore(forecast, historicalData);

      // Step 8: Identify Risk Factors
      const riskFactors = await this.identifyRiskFactors(forecast, patternAnalysis);

      // Step 9: Generate Recommendations
      const recommendations = await this.generateRecommendations(riskFactors, forecast, patternAnalysis);

      // Step 10: Return Capacity Plan
      const capacityPlan: CapacityPlan = {
        request,
        timeFrame,
        historicalData,
        patternAnalysis,
        baselineCapacity,
        adjustments,
        forecast,
        confidenceScore,
        riskFactors,
        recommendations,
        generatedAt: new Date(),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Valid for 7 days
      };

      console.log('✅ CapacityPlanningService: Capacity planning workflow completed successfully');
      return {
        success: true,
        capacityPlan
      };

    } catch (error) {
      console.error('❌ CapacityPlanningService: Capacity planning workflow failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        step: 'unknown'
      };
    }
  }

  /**
   * Get capacity planning results as Observable (for Angular components)
   */
  getCapacityPlan(request: CapacityPlanningRequest): Observable<CapacityPlanningResult> {
    return from(this.capacityPlanningWorkflow(request));
  }

  /**
   * Step 1: Determine Time Frame
   */
  private async determineTimeFrame(request: CapacityPlanningRequest): Promise<{ start: Date; end: Date }> {
    console.log('🔍 CapacityPlanningService: Determining time frame');

    // Validate date range
    if (request.startDate >= request.endDate) {
      throw new Error('Start date must be before end date');
    }

    // Ensure reasonable date range (not too far in the past/future)
    const maxHistoricalDays = 365; // 1 year back
    const maxForecastDays = 90; // 3 months ahead

    const now = new Date();
    const historicalStart = new Date(now.getTime() - maxHistoricalDays * 24 * 60 * 60 * 1000);
    const forecastEnd = new Date(now.getTime() + maxForecastDays * 24 * 60 * 60 * 1000);

    // Adjust start date if too far in the past
    const adjustedStart = request.startDate < historicalStart ? historicalStart : request.startDate;

    // Adjust end date if too far in the future
    const adjustedEnd = request.endDate > forecastEnd ? forecastEnd : request.endDate;

    // If forecast horizon is specified, extend end date accordingly
    if (request.forecastHorizon && request.forecastHorizon > 0) {
      const forecastEndDate = new Date(now.getTime() + request.forecastHorizon * 24 * 60 * 60 * 1000);
      const finalEnd = forecastEndDate < adjustedEnd ? adjustedEnd : forecastEndDate;
      // But don't exceed max forecast days
      const finalAdjustedEnd = finalEnd > forecastEnd ? forecastEnd : finalEnd;
      return {
        start: adjustedStart,
        end: finalAdjustedEnd
      };
    }

    console.log('✅ CapacityPlanningService: Time frame determined:', adjustedStart, 'to', adjustedEnd);
    return {
      start: adjustedStart,
      end: adjustedEnd
    };
  }

  /**
   * Step 2: Gather Historical Data
   */
  private async gatherHistoricalData(timeFrame: { start: Date; end: Date }): Promise<HistoricalData> {
    console.log('🔍 CapacityPlanningService: Gathering historical data for period:', timeFrame.start, 'to', timeFrame.end);

    try {
      // Get appointments within the time frame
      const appointments = await this.getAppointmentsInRange(timeFrame.start, timeFrame.end);

      // Get work orders within the time frame
      const workOrders = await this.getWorkOrdersInRange(timeFrame.start, timeFrame.end);

      // Get technician schedules for the period
      const technicianSchedules = await this.getTechnicianSchedulesInRange(timeFrame.start, timeFrame.end);

      console.log(`✅ CapacityPlanningService: Gathered ${appointments.length} appointments, ${workOrders.length} work orders, and ${technicianSchedules.length} schedule entries`);

      return {
        appointments,
        workOrders,
        technicianSchedules,
        dateRange: timeFrame
      };
    } catch (error) {
      console.error('❌ CapacityPlanningService: Error gathering historical data:', error);
      throw new Error(`Failed to gather historical data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Helper: Get appointments within date range
   */
  private async getAppointmentsInRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
    // Get all appointments and filter by date range
    // Note: In a real implementation, you'd want to query the database with date filters
    const allAppointments = this.appointmentService.getAppointments()();

    return allAppointments.filter(apt => {
      const aptDate = apt.scheduledAt?.toDate ? apt.scheduledAt.toDate() : apt.scheduledAt;
      return aptDate >= startDate && aptDate <= endDate;
    });
  }

  /**
   * Helper: Get work orders within date range
   */
  private async getWorkOrdersInRange(startDate: Date, endDate: Date): Promise<WorkOrder[]> {
    // Get all work orders and filter by date range
    const allWorkOrders = this.workOrderService.getWorkOrders()();

    return allWorkOrders.filter(wo => {
      const woDate = wo.createdAt?.toDate ? wo.createdAt.toDate() : wo.createdAt;
      return woDate >= startDate && woDate <= endDate;
    });
  }

  /**
   * Helper: Get technician schedules within date range
   */
  private async getTechnicianSchedulesInRange(startDate: Date, endDate: Date): Promise<any[]> {
    const schedules: any[] = [];
    const technicians = this.userService.getTechnicians();

    // Get schedules for each technician within the date range
    for (const technician of technicians) {
      try {
        // Use the existing method to get schedule for each day in range
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const schedule = await this.employeeScheduleService.getEmployeeSchedule(technician.id, currentDate);
          if (schedule) {
            schedules.push(schedule);
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } catch (error) {
        console.warn(`⚠️ CapacityPlanningService: Could not get schedules for technician ${technician.id}:`, error);
      }
    }

    return schedules;
  }

  /**
   * Step 3: Analyze Patterns
   */
  private async analyzePatterns(historicalData: HistoricalData): Promise<PatternAnalysis> {
    console.log('🔍 CapacityPlanningService: Analyzing patterns from historical data');

    const { appointments, workOrders, technicianSchedules, dateRange } = historicalData;

    // Analyze daily usage patterns
    const dailyUsage = this.analyzeDailyUsage(appointments, workOrders, dateRange);

    // Analyze peak hours
    const peakHours = this.analyzePeakHours(appointments, workOrders);

    // Analyze seasonal trends
    const seasonalTrends = this.analyzeSeasonalTrends(appointments, workOrders, dateRange);

    // Analyze technician utilization
    const technicianUtilization = this.analyzeTechnicianUtilization(technicianSchedules, appointments, workOrders);

    console.log('✅ CapacityPlanningService: Pattern analysis completed');

    return {
      dailyUsage,
      peakHours,
      seasonalTrends,
      technicianUtilization
    };
  }

  /**
   * Helper: Analyze daily usage patterns
   */
  private analyzeDailyUsage(appointments: Appointment[], workOrders: WorkOrder[], dateRange: { start: Date; end: Date }): PatternAnalysis['dailyUsage'] {
    const dailyCounts: { [date: string]: number } = {};

    // Count appointments per day
    appointments.forEach(apt => {
      const date = apt.scheduledAt?.toDate ? apt.scheduledAt.toDate() : apt.scheduledAt;
      const dateObj = date instanceof Date ? date : new Date(date.seconds * 1000);
      const dateKey = dateObj.toISOString().split('T')[0];
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    });

    // Count work orders per day
    workOrders.forEach(wo => {
      const date = wo.createdAt?.toDate ? wo.createdAt.toDate() : wo.createdAt;
      const dateObj = date instanceof Date ? date : new Date(date.seconds * 1000);
      const dateKey = dateObj.toISOString().split('T')[0];
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    });

    const counts = Object.values(dailyCounts);
    if (counts.length === 0) {
      return { average: 0, peak: 0, low: 0, standardDeviation: 0 };
    }

    const average = counts.reduce((sum, count) => sum + count, 0) / counts.length;
    const peak = Math.max(...counts);
    const low = Math.min(...counts);

    // Calculate standard deviation
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - average, 2), 0) / counts.length;
    const standardDeviation = Math.sqrt(variance);

    return { average, peak, low, standardDeviation };
  }

  /**
   * Helper: Analyze peak hours
   */
  private analyzePeakHours(appointments: Appointment[], workOrders: WorkOrder[]): PatternAnalysis['peakHours'] {
    const hourlyCounts: { [hour: number]: { appointments: number; workOrders: number; total: number } } = {};

    // Initialize hours 0-23
    for (let hour = 0; hour < 24; hour++) {
      hourlyCounts[hour] = { appointments: 0, workOrders: 0, total: 0 };
    }

    // Count appointments by hour
    appointments.forEach(apt => {
      const date = apt.scheduledAt?.toDate ? apt.scheduledAt.toDate() : apt.scheduledAt;
      const dateObj = date instanceof Date ? date : new Date(date.seconds * 1000);
      const hour = dateObj.getHours();
      hourlyCounts[hour].appointments++;
      hourlyCounts[hour].total++;
    });

    // Count work orders by hour (using createdAt as proxy)
    workOrders.forEach(wo => {
      const date = wo.createdAt?.toDate ? wo.createdAt.toDate() : wo.createdAt;
      const dateObj = date instanceof Date ? date : new Date(date.seconds * 1000);
      const hour = dateObj.getHours();
      hourlyCounts[hour].workOrders++;
      hourlyCounts[hour].total++;
    });

    // Convert to peak hours analysis
    const peakHours: PatternAnalysis['peakHours'] = [];
    const totalActivities = Object.values(hourlyCounts).reduce((sum, hour) => sum + hour.total, 0);

    if (totalActivities > 0) {
      for (let hour = 0; hour < 24; hour++) {
        const count = hourlyCounts[hour];
        const averageLoad = count.total;
        const peakLoad = count.total; // In this simple analysis, current load is peak

        peakHours.push({
          hour,
          averageLoad,
          peakLoad
        });
      }

      // Sort by average load descending
      peakHours.sort((a, b) => b.averageLoad - a.averageLoad);
    }

    return peakHours;
  }

  /**
   * Helper: Analyze seasonal trends
   */
  private analyzeSeasonalTrends(appointments: Appointment[], workOrders: WorkOrder[], dateRange: { start: Date; end: Date }): PatternAnalysis['seasonalTrends'] {
    const monthlyCounts: { [month: number]: number } = {};

    // Initialize months 0-11
    for (let month = 0; month < 12; month++) {
      monthlyCounts[month] = 0;
    }

    // Count activities by month
    [...appointments, ...workOrders].forEach(item => {
      const date = 'scheduledAt' in item
        ? (item.scheduledAt?.toDate ? item.scheduledAt.toDate() : item.scheduledAt)
        : (item.createdAt?.toDate ? item.createdAt.toDate() : item.createdAt);
      const dateObj = date instanceof Date ? date : new Date(date.seconds * 1000);
      const month = dateObj.getMonth();
      monthlyCounts[month]++;
    });

    const seasonalTrends: PatternAnalysis['seasonalTrends'] = [];
    const totalActivities = Object.values(monthlyCounts).reduce((sum, count) => sum + count, 0);

    if (totalActivities > 0) {
      const averageMonthly = totalActivities / 12;

      for (let month = 0; month < 12; month++) {
        const count = monthlyCounts[month];
        const averageLoad = count;
        const trend = count > averageMonthly ? 'increasing' : count < averageMonthly ? 'decreasing' : 'stable';

        seasonalTrends.push({
          month,
          averageLoad,
          trend
        });
      }
    }

    return seasonalTrends;
  }

  /**
   * Helper: Analyze technician utilization
   */
  private analyzeTechnicianUtilization(technicianSchedules: any[], appointments: Appointment[], workOrders: WorkOrder[]): PatternAnalysis['technicianUtilization'] {
    const technicians = this.userService.getTechnicians();
    const utilization: PatternAnalysis['technicianUtilization'] = [];

    technicians.forEach(tech => {
      // Count assignments for this technician
      const techAppointments = appointments.filter(apt => apt.assignedTo === tech.id);
      const techWorkOrders = workOrders.filter(wo => wo.assignedTo === tech.id);

      const totalAssignments = techAppointments.length + techWorkOrders.length;

      // Calculate utilization (simplified - assuming 8 hours/day, 5 days/week baseline)
      const assumedCapacity = 8 * 5; // 8 hours/day * 5 days/week
      const averageUtilization = assumedCapacity > 0 ? (totalAssignments / assumedCapacity) * 100 : 0;

      // Peak utilization (simplified)
      const peakUtilization = averageUtilization;

      // Efficiency (placeholder - would need more complex calculation)
      const efficiency = 85; // Assume 85% efficiency

      utilization.push({
        technicianId: tech.id,
        averageUtilization,
        peakUtilization,
        efficiency
      });
    });

    return utilization;
  }

  /**
   * Step 4: Calculate Baseline Capacity
   */
  private async calculateBaselineCapacity(patternAnalysis: PatternAnalysis, historicalData: HistoricalData): Promise<BaselineCapacity> {
    console.log('🧮 CapacityPlanningService: Calculating baseline capacity');

    const technicians = this.userService.getTechnicians();
    const totalTechnicians = technicians.length;

    // Calculate average capacity per day based on pattern analysis
    // Assuming 8 hours per technician per day as baseline
    const hoursPerTechnicianPerDay = 8;
    const averageCapacityPerDay = totalTechnicians * hoursPerTechnicianPerDay;

    // Calculate peak capacity (higher during peak hours)
    const peakHourMultiplier = patternAnalysis.peakHours.length > 0
      ? Math.max(...patternAnalysis.peakHours.map(ph => ph.averageLoad)) / patternAnalysis.dailyUsage.average
      : 1.2; // Default 20% increase during peak hours
    const peakCapacityPerDay = averageCapacityPerDay * peakHourMultiplier;

    // Standard capacity (normal operating hours)
    const standardCapacityPerDay = averageCapacityPerDay * 0.9; // Assuming 90% utilization during standard hours

    console.log(`✅ CapacityPlanningService: Baseline capacity calculated - Total techs: ${totalTechnicians}, Avg capacity: ${averageCapacityPerDay}, Peak: ${peakCapacityPerDay}`);

    return {
      totalTechnicians,
      averageCapacityPerDay,
      peakCapacityPerDay,
      standardCapacityPerDay
    };
  }

  /**
   * Step 5: Apply Adjustments
   */
  private async applyAdjustments(timeFrame: { start: Date; end: Date }): Promise<CapacityAdjustments> {
    console.log('🔧 CapacityPlanningService: Applying capacity adjustments');

    // Day of week factors (typical patterns)
    const dayOfWeekFactors: { [day: number]: number } = {
      0: 0.8, // Sunday - lower capacity
      1: 1.0, // Monday - normal
      2: 1.0, // Tuesday - normal
      3: 1.0, // Wednesday - normal
      4: 1.0, // Thursday - normal
      5: 0.9, // Friday - slightly lower (people leave early)
      6: 0.7  // Saturday - lower capacity
    };

    // Special events (holidays, events that affect capacity)
    const specialEvents: CapacityAdjustments['specialEvents'] = [];
    const currentDate = new Date(timeFrame.start);

    while (currentDate <= timeFrame.end) {
      // Example: Reduce capacity on holidays
      if (this.isHoliday(currentDate)) {
        specialEvents.push({
          date: new Date(currentDate),
          factor: 0.5, // 50% capacity on holidays
          reason: 'Holiday'
        });
      }

      // Example: Increase capacity during peak season
      if (this.isPeakSeason(currentDate)) {
        specialEvents.push({
          date: new Date(currentDate),
          factor: 1.2, // 20% increase during peak season
          reason: 'Peak season'
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Staff changes (technicians starting/leaving)
    const staffChanges: CapacityAdjustments['staffChanges'] = [
      // Example: New technician starting
      // { date: new Date('2025-11-01'), technicianChange: 1, reason: 'New hire' }
    ];

    // Seasonal factors
    const seasonalFactors: CapacityAdjustments['seasonalFactors'] = [
      { month: 0, factor: 0.9 },  // January - post-holiday slowdown
      { month: 1, factor: 0.95 }, // February
      { month: 2, factor: 1.0 },  // March
      { month: 3, factor: 1.05 }, // April - spring maintenance
      { month: 4, factor: 1.1 },  // May
      { month: 5, factor: 1.15 }, // June - summer peak
      { month: 6, factor: 1.2 },  // July - peak season
      { month: 7, factor: 1.15 }, // August
      { month: 8, factor: 1.1 },  // September
      { month: 9, factor: 1.05 }, // October
      { month: 10, factor: 0.9 }, // November - pre-holiday
      { month: 11, factor: 0.8 }  // December - holiday season
    ];

    console.log('✅ CapacityPlanningService: Adjustments applied');

    return {
      dayOfWeekFactors,
      specialEvents,
      staffChanges,
      seasonalFactors
    };
  }

  /**
   * Helper: Check if date is a holiday
   */
  private isHoliday(date: Date): boolean {
    // Simplified holiday check - in real implementation, would check against holiday calendar
    const month = date.getMonth();
    const day = date.getDate();

    // Example holidays (Colombian context)
    const holidays = [
      { month: 0, day: 1 },   // New Year
      { month: 2, day: 24 },  // St. Joseph's Day
      { month: 4, day: 1 },   // Labor Day
      { month: 5, day: 29 },  // Sacred Heart
      { month: 6, day: 20 },  // Independence Day
      { month: 7, day: 7 },   // Battle of Boyaca
      { month: 7, day: 20 },  // Assumption
      { month: 10, day: 5 },  // All Saints
      { month: 10, day: 12 }, // Independence of Cartagena
      { month: 11, day: 8 },  // Immaculate Conception
      { month: 11, day: 25 }  // Christmas
    ];

    return holidays.some(holiday => holiday.month === month && holiday.day === day);
  }

  /**
   * Helper: Check if date is in peak season
   */
  private isPeakSeason(date: Date): boolean {
    const month = date.getMonth();
    // Peak season: June, July, August (summer vacation period)
    return month >= 5 && month <= 7;
  }

  /**
   * Step 6: Generate Forecast
   */
  private async generateForecast(
    baselineCapacity: BaselineCapacity,
    adjustments: CapacityAdjustments,
    patternAnalysis: PatternAnalysis,
    timeFrame: { start: Date; end: Date }
  ): Promise<CapacityForecast[]> {
    console.log('🔮 CapacityPlanningService: Generating capacity forecast');

    const forecast: CapacityForecast[] = [];
    const currentDate = new Date(timeFrame.start);

    while (currentDate <= timeFrame.end) {
      // Start with baseline capacity
      let adjustedCapacity = baselineCapacity.averageCapacityPerDay;

      // Apply day of week factor
      const dayOfWeek = currentDate.getDay();
      const dayFactor = adjustments.dayOfWeekFactors[dayOfWeek] || 1.0;
      adjustedCapacity *= dayFactor;

      // Apply seasonal factor
      const month = currentDate.getMonth();
      const seasonalFactor = adjustments.seasonalFactors.find(sf => sf.month === month)?.factor || 1.0;
      adjustedCapacity *= seasonalFactor;

      // Apply special events
      const specialEvent = adjustments.specialEvents.find(se =>
        se.date.toDateString() === currentDate.toDateString()
      );
      if (specialEvent) {
        adjustedCapacity *= specialEvent.factor;
      }

      // Apply staff changes (cumulative effect)
      const staffChange = adjustments.staffChanges
        .filter(sc => sc.date <= currentDate)
        .reduce((total, sc) => total + sc.technicianChange, 0);
      adjustedCapacity += staffChange * 8; // Assuming 8 hours per technician

      // Estimate expected load based on historical patterns
      const expectedLoad = this.estimateExpectedLoad(currentDate, patternAnalysis, baselineCapacity);

      // Calculate available capacity
      const availableCapacity = Math.max(0, adjustedCapacity - expectedLoad);

      // Calculate utilization percentage
      const utilizationPercentage = adjustedCapacity > 0 ? (expectedLoad / adjustedCapacity) * 100 : 0;

      // Calculate confidence (simplified - higher for dates closer to now)
      const daysDiff = Math.abs((currentDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      const confidence = Math.max(0.5, Math.min(0.95, 1 - (daysDiff / 90))); // Higher confidence for nearer dates

      forecast.push({
        date: new Date(currentDate),
        baselineCapacity: baselineCapacity.averageCapacityPerDay,
        adjustedCapacity,
        expectedLoad,
        availableCapacity,
        utilizationPercentage,
        confidence
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`✅ CapacityPlanningService: Forecast generated for ${forecast.length} days`);
    return forecast;
  }

  /**
   * Helper: Estimate expected load for a date
   */
  private estimateExpectedLoad(date: Date, patternAnalysis: PatternAnalysis, baselineCapacity: BaselineCapacity): number {
    // Use historical patterns to estimate load
    const dayOfWeek = date.getDay();
    const month = date.getMonth();

    // Base load from daily usage patterns
    let estimatedLoad = patternAnalysis.dailyUsage.average;

    // Adjust for day of week patterns
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Weekend
      estimatedLoad *= 0.7; // Lower load on weekends
    }

    // Adjust for seasonal patterns
    const seasonalTrend = patternAnalysis.seasonalTrends.find(st => st.month === month);
    if (seasonalTrend) {
      if (seasonalTrend.trend === 'increasing') {
        estimatedLoad *= 1.1;
      } else if (seasonalTrend.trend === 'decreasing') {
        estimatedLoad *= 0.9;
      }
    }

    // Add some randomness based on standard deviation
    const randomFactor = 1 + (Math.random() - 0.5) * 0.2; // ±10% randomness
    estimatedLoad *= randomFactor;

    return Math.max(0, estimatedLoad);
  }

  /**
   * Step 7: Calculate Confidence Score
   */
  private async calculateConfidenceScore(forecast: CapacityForecast[], historicalData: HistoricalData): Promise<number> {
    console.log('📊 CapacityPlanningService: Calculating confidence score');

    if (forecast.length === 0) return 0;

    // Calculate average confidence from forecast
    const avgForecastConfidence = forecast.reduce((sum, f) => sum + f.confidence, 0) / forecast.length;

    // Adjust based on historical data quality
    const historicalDataQuality = this.assessHistoricalDataQuality(historicalData);

    // Adjust based on forecast horizon
    const forecastHorizon = Math.max(...forecast.map(f =>
      Math.abs((f.date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    ));
    const horizonFactor = Math.max(0.7, 1 - (forecastHorizon / 365)); // Reduce confidence for longer horizons

    // Overall confidence score
    const confidenceScore = (avgForecastConfidence * 0.4) + (historicalDataQuality * 0.4) + (horizonFactor * 0.2);

    console.log(`✅ CapacityPlanningService: Confidence score calculated: ${Math.round(confidenceScore * 100)}%`);
    return Math.round(confidenceScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Helper: Assess historical data quality
   */
  private assessHistoricalDataQuality(historicalData: HistoricalData): number {
    const { appointments, workOrders, technicianSchedules } = historicalData;

    // Quality factors
    const dataVolume = Math.min(1, (appointments.length + workOrders.length) / 1000); // Normalize to 1000+ records
    const scheduleCoverage = technicianSchedules.length > 0 ? 0.8 : 0.4; // Bonus for having schedule data
    const timeSpan = this.calculateHistoricalTimeSpan(historicalData.dateRange);

    // Quality score based on data volume, coverage, and time span
    return (dataVolume * 0.5) + (scheduleCoverage * 0.3) + (timeSpan * 0.2);
  }

  /**
   * Helper: Calculate historical time span quality
   */
  private calculateHistoricalTimeSpan(dateRange: { start: Date; end: Date }): number {
    const days = Math.abs((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    // Higher score for longer historical periods (up to 1 year = 365 days)
    return Math.min(1, days / 365);
  }

  /**
   * Step 8: Identify Risk Factors
   */
  private async identifyRiskFactors(forecast: CapacityForecast[], patternAnalysis: PatternAnalysis): Promise<RiskFactors> {
    console.log('⚠️ CapacityPlanningService: Identifying risk factors');

    const highUtilizationDays: RiskFactors['highUtilizationDays'] = [];
    const technicianShortages: RiskFactors['technicianShortages'] = [];
    const peakHourOverloads: RiskFactors['peakHourOverloads'] = [];
    const seasonalRisks: RiskFactors['seasonalRisks'] = [];

    // Analyze forecast for high utilization days
    forecast.forEach(day => {
      if (day.utilizationPercentage >= 90) {
        highUtilizationDays.push({
          date: day.date,
          utilization: day.utilizationPercentage,
          risk: day.utilizationPercentage >= 100 ? 'critical' :
                day.utilizationPercentage >= 95 ? 'high' : 'medium'
        });
      }

      // Check for technician shortages
      if (day.availableCapacity < 0) {
        technicianShortages.push({
          date: day.date,
          shortage: Math.abs(day.availableCapacity),
          severity: Math.abs(day.availableCapacity) > day.baselineCapacity * 0.5 ? 'critical' :
                   Math.abs(day.availableCapacity) > day.baselineCapacity * 0.25 ? 'high' : 'medium'
        });
      }
    });

    // Analyze peak hour overloads from pattern analysis
    patternAnalysis.peakHours.forEach(hour => {
      if (hour.averageLoad > patternAnalysis.dailyUsage.average * 1.5) { // 50% above average
        peakHourOverloads.push({
          date: new Date(), // Would need specific date context
          hour: hour.hour,
          overload: hour.averageLoad - patternAnalysis.dailyUsage.average
        });
      }
    });

    // Analyze seasonal risks
    patternAnalysis.seasonalTrends.forEach(trend => {
      if (trend.trend === 'increasing' && trend.averageLoad > patternAnalysis.dailyUsage.average * 1.3) {
        seasonalRisks.push({
          period: `Month ${trend.month + 1}`,
          risk: 'High seasonal demand may exceed capacity',
          impact: 'high'
        });
      }
    });

    // Add general seasonal risks
    if (patternAnalysis.seasonalTrends.some(st => st.trend === 'increasing')) {
      seasonalRisks.push({
        period: 'Peak season',
        risk: 'Increased demand during peak periods may strain resources',
        impact: 'medium'
      });
    }

    console.log(`✅ CapacityPlanningService: Identified ${highUtilizationDays.length} high utilization days, ${technicianShortages.length} shortage periods, ${peakHourOverloads.length} peak hour overloads, and ${seasonalRisks.length} seasonal risks`);

    return {
      highUtilizationDays,
      technicianShortages,
      peakHourOverloads,
      seasonalRisks
    };
  }

  /**
   * Step 9: Generate Recommendations
   */
  private async generateRecommendations(
    riskFactors: RiskFactors,
    forecast: CapacityForecast[],
    patternAnalysis: PatternAnalysis
  ): Promise<CapacityRecommendations> {
    console.log('💡 CapacityPlanningService: Generating recommendations');

    const staffing: CapacityRecommendations['staffing'] = [];
    const scheduling: CapacityRecommendations['scheduling'] = {
      shiftAdjustments: [],
      breakOptimizations: []
    };
    const process: CapacityRecommendations['process'] = {
      automationOpportunities: [],
      efficiencyImprovements: [],
      bottleneckResolutions: []
    };

    // Generate staffing recommendations based on risk factors
    riskFactors.technicianShortages.forEach(shortage => {
      const additionalTechs = Math.ceil(shortage.shortage / 8); // Assuming 8 hours per technician
      staffing.push({
        additionalTechnicians: additionalTechs,
        dates: [shortage.date],
        priority: shortage.severity === 'critical' ? 'high' :
                 shortage.severity === 'high' ? 'medium' : 'low',
        reason: `Capacity shortage of ${shortage.shortage.toFixed(1)} hours on ${shortage.date.toLocaleDateString()}`
      });
    });

    // Generate scheduling recommendations
    riskFactors.highUtilizationDays.forEach(day => {
      scheduling.shiftAdjustments.push({
        date: day.date,
        recommendedShifts: Math.ceil(day.utilization / 80), // Target 80% utilization
        currentShifts: 1, // Assuming 1 shift currently
      });
    });

    // Break optimization recommendations
    if (patternAnalysis.peakHours.some(ph => ph.averageLoad > patternAnalysis.dailyUsage.average * 1.2)) {
      scheduling.breakOptimizations.push({
        date: new Date(), // Would need specific dates
        recommendedBreakReduction: 15 // minutes
      });
    }

    // Process improvement recommendations
    if (riskFactors.peakHourOverloads.length > 0) {
      process.bottleneckResolutions.push(
        'Implement peak hour prioritization system',
        'Add buffer time between appointments during peak hours',
        'Consider staggered start times for technicians'
      );
    }

    if (patternAnalysis.technicianUtilization.some(tu => tu.averageUtilization < 70)) {
      process.efficiencyImprovements.push(
        'Cross-train technicians for better workload distribution',
        'Implement skill-based task assignment',
        'Optimize technician scheduling based on efficiency metrics'
      );
    }

    if (riskFactors.seasonalRisks.length > 0) {
      process.automationOpportunities.push(
        'Automated seasonal capacity scaling',
        'Predictive staffing based on seasonal patterns',
        'Dynamic pricing during peak seasons'
      );
    }

    // General recommendations
    if (forecast.some(f => f.utilizationPercentage > 85)) {
      process.efficiencyImprovements.push(
        'Implement appointment buffer times',
        'Add capacity monitoring alerts',
        'Create contingency staffing plans'
      );
    }

    console.log(`✅ CapacityPlanningService: Generated ${staffing.length} staffing recommendations, ${scheduling.shiftAdjustments.length} scheduling adjustments, and ${process.automationOpportunities.length + process.efficiencyImprovements.length + process.bottleneckResolutions.length} process improvements`);

    return {
      staffing,
      scheduling,
      process
    };
  }
}