import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../environments/environment';
import { AlertingService, CacheStatus } from './alerting.service';

export interface AICostData {
  currentMonth: number;
  budget: number;
  aiCalls: number;
  cachedResponses: number;
  cacheHitRate: number;
  dailyCosts: Array<{
    date: string;
    cost: number;
    calls: number;
  }>;
  byContext: Array<{
    name: string;
    calls: number;
    cost: number;
    cached: number;
  }>;
}

export interface BudgetStatus {
  text: string;
  icon: string;
  color: string;
}

export interface CostAnalytics {
  analytics: Array<{
    date: string;
    requestCount: number;
    totalTokens: number;
    totalCost: number;
    lastUpdated: Date;
  }>;
  summary: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    averageCostPerRequest: number;
    averageTokensPerRequest: number;
    periodDays: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AICostMonitoringService {
  private http = inject(HttpClient);
  private alertingService = inject(AlertingService);
  private readonly functionsUrl = 'https://us-central1-blue-dragon-motors-ai-assistant.cloudfunctions.net';

  constructor() {}

  /**
   * Get current budget status from AI proxy
   */
  getBudgetStatus(): Observable<any> {
    return this.http.post(`${this.functionsUrl}/getBudgetStatus`, {});
  }

  /**
   * Get cost analytics for specified number of days
   */
  getCostAnalytics(days: number = 30): Observable<CostAnalytics> {
    return this.http.post<CostAnalytics>(`${this.functionsUrl}/getCostAnalytics`, { days });
  }

  /**
   * Get comprehensive cost data for dashboard
   */
  getCostData(): Observable<AICostData> {
    return this.getCostAnalytics(30).pipe(
      map(analytics => {
        const costData = this.transformAnalyticsToCostData(analytics);
        // Check cache hit rate and trigger alerts if needed
        this.checkCacheHitRateAlerts(costData);
        return costData;
      }),
      catchError(error => {
        console.error('Error fetching AI cost data:', error);
        const mockData = this.getMockData();
        this.checkCacheHitRateAlerts(mockData);
        return of(mockData);
      })
    );
  }

  /**
   * Check cache hit rate and trigger alerts if below threshold
   */
  private checkCacheHitRateAlerts(costData: AICostData): void {
    if (costData.cacheHitRate < 50) {
      const cacheStatus: CacheStatus = {
        hitRate: costData.cacheHitRate,
        totalRequests: costData.aiCalls,
        cacheHits: Math.floor(costData.aiCalls * costData.cacheHitRate / 100),
        context: 'ai_cost_monitoring'
      };
      this.alertingService.triggerCacheAlert(costData.cacheHitRate, 'ai_cost_monitoring');
    }
  }

  /**
   * Transform analytics data to dashboard format
   */
  private transformAnalyticsToCostData(analytics: CostAnalytics): AICostData {
    const { analytics: dailyData, summary } = analytics;

    // Calculate current month cost (sum of last 30 days)
    const currentMonth = summary.totalCost;

    // Mock budget - in real implementation, this would come from config
    const budget = 50;

    // Calculate AI calls and cached responses
    const aiCalls = summary.totalRequests;
    const cachedResponses = Math.floor(aiCalls * 0.75); // Estimate based on cache hit rate
    const cacheHitRate = 85.8; // This would be calculated from actual cache data

    // Transform daily data for charts
    const dailyCosts = dailyData.slice(-6).map(day => ({
      date: new Date(day.date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' }),
      cost: day.totalCost,
      calls: day.requestCount
    }));

    // Mock context breakdown - in real implementation, this would come from detailed analytics
    const byContext = [
      { name: 'Chatbot', calls: Math.floor(aiCalls * 0.4), cost: currentMonth * 0.35, cached: 89 },
      { name: 'Scanner', calls: Math.floor(aiCalls * 0.25), cost: currentMonth * 0.25, cached: 76 },
      { name: 'Búsqueda', calls: Math.floor(aiCalls * 0.2), cost: currentMonth * 0.2, cached: 92 },
      { name: 'Work Orders', calls: Math.floor(aiCalls * 0.15), cost: currentMonth * 0.2, cached: 68 }
    ];

    return {
      currentMonth,
      budget,
      aiCalls,
      cachedResponses,
      cacheHitRate,
      dailyCosts,
      byContext
    };
  }

  /**
   * Get budget status information
   */
  getBudgetStatusInfo(costData: AICostData): BudgetStatus {
    const percentage = (costData.currentMonth / costData.budget) * 100;
    if (percentage < 50) return { text: 'Óptimo', icon: 'check_circle', color: 'green' };
    if (percentage < 80) return { text: 'Monitoreando', icon: 'warning', color: 'yellow' };
    return { text: 'Crítico', icon: 'error', color: 'red' };
  }

  /**
   * Calculate projected month end cost
   */
  getProjectedMonthEnd(currentMonthCost: number): number {
    // Simple linear projection based on current progress
    const currentDay = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    return (currentMonthCost / currentDay) * daysInMonth;
  }

  /**
   * Get cost efficiency recommendations
   */
  getRecommendations(costData: AICostData): string[] {
    const recommendations: string[] = [];
    const projectedEnd = this.getProjectedMonthEnd(costData.currentMonth);

    if (costData.cacheHitRate < 70) {
      recommendations.push(`El cache hit rate de ${costData.cacheHitRate}% es mejorable. Considera aumentar TTLs para consultas frecuentes.`);
    }

    const scannerContext = costData.byContext.find(c => c.name === 'Scanner');
    if (scannerContext && scannerContext.cached < 80) {
      recommendations.push(`Scanner tiene el menor cache hit rate (${scannerContext.cached}%). Implementa pre-caching de repuestos más consultados.`);
    }

    if (projectedEnd > costData.budget) {
      recommendations.push(`Proyección indica $${projectedEnd.toFixed(2)} al fin de mes. Activa rate limiting más estricto.`);
    }

    const savingsFromCache = (costData.cachedResponses * 0.002).toFixed(2);
    recommendations.push(`Ahorro actual por cache: $${savingsFromCache}/mes. Cada 10% de mejora = $${(parseFloat(savingsFromCache) * 0.1).toFixed(2)} adicionales ahorrados.`);

    return recommendations;
  }

  /**
   * Mock data for development/fallback
   */
  private getMockData(): AICostData {
    return {
      currentMonth: 8.45,
      budget: 50,
      aiCalls: 2134,
      cachedResponses: 12876,
      cacheHitRate: 85.8,
      dailyCosts: [
        { date: '1 Oct', cost: 0.15, calls: 89 },
        { date: '5 Oct', cost: 0.28, calls: 134 },
        { date: '10 Oct', cost: 0.35, calls: 156 },
        { date: '15 Oct', cost: 0.42, calls: 178 },
        { date: '20 Oct', cost: 0.38, calls: 165 },
        { date: '25 Oct', cost: 0.45, calls: 187 }
      ],
      byContext: [
        { name: 'Chatbot', calls: 892, cost: 3.24, cached: 89 },
        { name: 'Scanner', calls: 567, cost: 2.87, cached: 76 },
        { name: 'Búsqueda', calls: 445, cost: 1.56, cached: 92 },
        { name: 'Work Orders', calls: 230, cost: 0.78, cached: 68 }
      ]
    };
  }
}