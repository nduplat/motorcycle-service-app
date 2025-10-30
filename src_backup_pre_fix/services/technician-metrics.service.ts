import { Injectable, signal, inject } from '@angular/core';
import { Observable, from, of, BehaviorSubject, combineLatest } from 'rxjs';
import { map, catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TechnicianMetrics, TechnicianKPIs, TimeEntryMetrics } from '../models';
import { db } from '../firebase.config';
import { collection, query, where, orderBy, limit, getDocs, Timestamp, onSnapshot, Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class TechnicianMetricsService {
  private authService = inject(AuthService);
  private technicianKPIs = signal<TechnicianKPIs | null>(null);

  // Real-time subscription
  private realtimeSubscription: any = null;

  // Trend analysis state
  private trendSubject = new BehaviorSubject<{ technicianId: string; period: 'daily' | 'weekly' | 'monthly' }>({
    technicianId: '',
    period: 'monthly'
  });

  constructor() {
    this.startRealtimeUpdates();
    this.setupTrendAnalysis();
  }

  getTechnicianMetrics(technicianId: string, period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Observable<TechnicianMetrics | null> {
    return from(this.fetchTechnicianMetrics(technicianId, period)).pipe(
      map(metrics => metrics || null),
      catchError(() => of(null))
    );
  }

  getTechnicianKPIs() {
    return this.technicianKPIs.asReadonly();
  }

  getAllTechnicianMetrics(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Observable<TechnicianMetrics[]> {
    return from(this.fetchAllTechnicianMetrics(period)).pipe(
      catchError(() => of([]))
    );
  }

  getTechnicianMetricsHistory(technicianId: string, months: number = 6): Observable<TechnicianMetrics[]> {
    return from(this.fetchTechnicianMetricsHistory(technicianId, months)).pipe(
      catchError(() => of([]))
    );
  }

  private async fetchTechnicianMetrics(technicianId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<TechnicianMetrics | null> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getTime() - (dayOfWeek * 24 * 60 * 60 * 1000));
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const metricsQuery = query(
      collection(db, 'technicianMetrics'),
      where('technicianId', '==', technicianId),
      where('periodStart', '>=', Timestamp.fromDate(startDate)),
      where('periodEnd', '<=', Timestamp.fromDate(now)),
      orderBy('periodStart', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(metricsQuery);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as TechnicianMetrics;
    }

    // If no metrics found, calculate from work orders and time entries
    return this.calculateTechnicianMetrics(technicianId, startDate, now);
  }

  private async fetchAllTechnicianMetrics(period: 'daily' | 'weekly' | 'monthly'): Promise<TechnicianMetrics[]> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getTime() - (dayOfWeek * 24 * 60 * 60 * 1000));
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const metricsQuery = query(
      collection(db, 'technicianMetrics'),
      where('periodStart', '>=', Timestamp.fromDate(startDate)),
      where('periodEnd', '<=', Timestamp.fromDate(now)),
      orderBy('periodStart', 'desc')
    );

    const querySnapshot = await getDocs(metricsQuery);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TechnicianMetrics));
  }

  private async fetchTechnicianMetricsHistory(technicianId: string, months: number): Promise<TechnicianMetrics[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - months, 1);

    const historyQuery = query(
      collection(db, 'technicianMetrics'),
      where('technicianId', '==', technicianId),
      where('periodStart', '>=', Timestamp.fromDate(startDate)),
      where('periodEnd', '<=', Timestamp.fromDate(endDate)),
      orderBy('periodStart', 'desc')
    );

    const querySnapshot = await getDocs(historyQuery);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TechnicianMetrics));
  }

  private async calculateTechnicianMetrics(technicianId: string, startDate: Date, endDate: Date): Promise<TechnicianMetrics | null> {
    try {
      // Query completed work orders for the technician in the period
      const workOrdersQuery = query(
        collection(db, 'workOrders'),
        where('assignedTo', '==', technicianId),
        where('status', '==', 'delivered'),
        where('updatedAt', '>=', Timestamp.fromDate(startDate)),
        where('updatedAt', '<=', Timestamp.fromDate(endDate))
      );

      const timeEntriesQuery = query(
        collection(db, 'timeEntries'),
        where('technicianId', '==', technicianId),
        where('startAt', '>=', Timestamp.fromDate(startDate)),
        where('endAt', '<=', Timestamp.fromDate(endDate))
      );

      const [workOrdersSnapshot, timeEntriesSnapshot] = await Promise.all([
        getDocs(workOrdersQuery),
        getDocs(timeEntriesQuery)
      ]);

      const completedWorkOrders = workOrdersSnapshot.docs.length;
      const totalHoursWorked = timeEntriesSnapshot.docs.reduce((total, doc) => {
        const data = doc.data();
        return total + (data.minutes || 0) / 60;
      }, 0);

      const averageJobDuration = completedWorkOrders > 0 ? (totalHoursWorked * 60) / completedWorkOrders : 0;
      const efficiencyRate = totalHoursWorked > 0 ? Math.min((completedWorkOrders / totalHoursWorked) * 100, 100) : 0;

      const metrics: TechnicianMetrics = {
        id: `${technicianId}_${startDate.toISOString().split('T')[0]}`,
        technicianId,
        periodStart: Timestamp.fromDate(startDate),
        periodEnd: Timestamp.fromDate(endDate),
        completedWorkOrders,
        totalHoursWorked,
        averageJobDuration,
        efficiencyRate,
        reworkCount: 0, // Would need additional logic to calculate
        onTimeCompletionRate: 100, // Would need additional logic to calculate
        revenueGenerated: 0, // Would need to calculate from work orders
        utilizationRate: totalHoursWorked > 0 ? Math.min((totalHoursWorked / 8) * 100, 100) : 0, // Assuming 8-hour workday
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      return metrics;
    } catch (error) {
      console.error('Error calculating technician metrics:', error);
      return null;
    }
  }

  // Real-time updates
  private startRealtimeUpdates(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    let queryConstraints: any[] = [];
    if (currentUser.role === 'technician') {
      queryConstraints = [where('technicianId', '==', currentUser.id)];
    }

    this.realtimeSubscription = onSnapshot(
      query(collection(db, 'technicianMetrics'), ...queryConstraints),
      (snapshot) => {
        // Update KPIs when metrics change
        this.loadTechnicianKPIs();
      },
      (error) => {
        console.error('Error in real-time technician metrics subscription:', error);
      }
    );
  }

  // KPI calculation with trends
  private async loadTechnicianKPIs(): Promise<void> {
    try {
      const currentUser = this.authService.currentUser();
      if (!currentUser) return;

      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get current metrics
      const currentMetrics = await this.fetchTechnicianMetrics(currentUser.id, 'monthly');
      // For previous metrics, we'd need to modify fetchTechnicianMetrics to accept a custom date range
      // For now, use history data
      const history = await this.fetchTechnicianMetricsHistory(currentUser.id, 2);
      const previousMetrics = history.length > 1 ? history[1] : null;

      if (!currentMetrics) return;

      // Calculate trends
      const efficiencyTrend = previousMetrics ?
        ((currentMetrics.efficiencyRate - previousMetrics.efficiencyRate) / previousMetrics.efficiencyRate) * 100 : 0;

      const trendDirection: 'up' | 'down' | 'stable' =
        efficiencyTrend > 5 ? 'up' :
        efficiencyTrend < -5 ? 'down' : 'stable';

      // Get all technicians' metrics for benchmarking
      const allMetrics = await this.fetchAllTechnicianMetrics('monthly');
      const avgEfficiency = allMetrics.reduce((sum, m) => sum + m.efficiencyRate, 0) / allMetrics.length;
      const benchmarkComparison = ((currentMetrics.efficiencyRate - avgEfficiency) / avgEfficiency) * 100;

      // Calculate goal progress (simplified - assuming 8 hours/day, 20 days/month)
      const monthlyGoalHours = 8 * 20;
      const dailyGoalHours = 8;
      const weeklyGoalHours = 8 * 5;

      const monthlyProgress = Math.min((currentMetrics.totalHoursWorked / monthlyGoalHours) * 100, 100);
      const weeklyProgress = Math.min(((currentMetrics.totalHoursWorked / 4) / weeklyGoalHours) * 100, 100); // Assuming current month has 4 weeks
      const dailyProgress = Math.min((currentMetrics.totalHoursWorked / 20 / dailyGoalHours) * 100, 100); // Assuming 20 work days

      // Skills utilization (simplified - would need actual skills data)
      const skillsUtilization = {
        'brakes': 85,
        'electrical': 70,
        'engine': 90,
        'suspension': 60
      };

      // Customer satisfaction trend (mock data - would come from actual ratings)
      const customerSatisfactionTrend = Array.from({ length: 30 }, () => Math.random() * 20 + 80);

      const kpis: TechnicianKPIs = {
        technicianId: currentUser.id,
        currentEfficiency: currentMetrics.efficiencyRate,
        trendDirection,
        trendPercentage: Math.abs(efficiencyTrend),
        benchmarkComparison,
        dailyGoalProgress: dailyProgress,
        weeklyGoalProgress: weeklyProgress,
        monthlyGoalProgress: monthlyProgress,
        skillsUtilization,
        customerSatisfactionTrend,
        averageResolutionTime: currentMetrics.averageJobDuration,
        reworkRate: (currentMetrics.reworkCount / Math.max(currentMetrics.completedWorkOrders, 1)) * 100,
        utilizationRate: currentMetrics.utilizationRate,
        periodStart: FirestoreTimestamp.fromDate(monthAgo),
        periodEnd: FirestoreTimestamp.fromDate(now),
        updatedAt: FirestoreTimestamp.fromDate(now)
      };

      this.technicianKPIs.set(kpis);
    } catch (error) {
      console.error('Error loading technician KPIs:', error);
    }
  }

  // Trend analysis
  private setupTrendAnalysis(): void {
    this.trendSubject.pipe(
      debounceTime(500),
      distinctUntilChanged((prev, curr) =>
        prev.technicianId === curr.technicianId && prev.period === curr.period
      )
    ).subscribe(({ technicianId, period }) => {
      if (technicianId) {
        this.loadTechnicianKPIs();
      }
    });
  }

  // Enhanced metrics with trend analysis
  getTechnicianMetricsWithTrends(technicianId: string, periods: number = 6): Observable<TechnicianMetrics[]> {
    return from(this.fetchTechnicianMetricsHistory(technicianId, periods)).pipe(
      map(metrics => {
        // Add trend calculations
        return metrics.map((metric, index) => {
          if (index < metrics.length - 1) {
            const previous = metrics[index + 1];
            const efficiencyTrend = ((metric.efficiencyRate - previous.efficiencyRate) / previous.efficiencyRate) * 100;
            const completionTrend = ((metric.completedWorkOrders - previous.completedWorkOrders) / Math.max(previous.completedWorkOrders, 1)) * 100;

            return {
              ...metric,
              trends: {
                efficiencyChange: efficiencyTrend,
                completionChange: completionTrend,
                utilizationChange: ((metric.utilizationRate - previous.utilizationRate) / previous.utilizationRate) * 100
              }
            };
          }
          return { ...metric, trends: null };
        });
      }),
      catchError(() => of([]))
    );
  }

  // Predictive analytics
  getPredictedPerformance(technicianId: string): Observable<{
    predictedEfficiency: number;
    confidence: number;
    factors: string[];
  }> {
    return from(this.calculatePredictedPerformance(technicianId)).pipe(
      catchError(() => of({
        predictedEfficiency: 0,
        confidence: 0,
        factors: []
      }))
    );
  }

  private async calculatePredictedPerformance(technicianId: string): Promise<{
    predictedEfficiency: number;
    confidence: number;
    factors: string[];
  }> {
    try {
      const history = await this.fetchTechnicianMetricsHistory(technicianId, 3);
      if (history.length < 2) {
        return {
          predictedEfficiency: 0,
          confidence: 0,
          factors: ['Insufficient historical data']
        };
      }

      // Simple linear regression for prediction
      const efficiencies = history.map(h => h.efficiencyRate).reverse();
      const avgEfficiency = efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length;
      const trend = efficiencies.length > 1 ?
        (efficiencies[efficiencies.length - 1] - efficiencies[0]) / (efficiencies.length - 1) : 0;

      const predictedEfficiency = Math.max(0, Math.min(100, avgEfficiency + trend));

      // Calculate confidence based on data consistency
      const variance = efficiencies.reduce((sum, eff) => sum + Math.pow(eff - avgEfficiency, 2), 0) / efficiencies.length;
      const confidence = Math.max(0, Math.min(100, 100 - Math.sqrt(variance)));

      const factors = [];
      if (trend > 0) factors.push('Improving trend');
      if (trend < 0) factors.push('Declining trend');
      if (avgEfficiency > 80) factors.push('High baseline performance');
      if (variance < 25) factors.push('Consistent performance');

      return {
        predictedEfficiency,
        confidence,
        factors
      };
    } catch (error) {
      console.error('Error calculating predicted performance:', error);
      return {
        predictedEfficiency: 0,
        confidence: 0,
        factors: ['Calculation error']
      };
    }
  }
}