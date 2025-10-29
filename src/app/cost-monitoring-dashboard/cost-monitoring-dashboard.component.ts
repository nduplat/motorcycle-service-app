import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartConfiguration, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { Subject, takeUntil } from 'rxjs';

import { AICostMonitoringService, AICostData, BudgetStatus } from '../../services/ai-cost-monitoring.service';
import { AlertingService, Alert } from '../../services/alerting.service';

@Component({
  selector: 'app-cost-monitoring-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    BaseChartDirective,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    MatChipsModule,
    MatButtonModule
  ],
  templateUrl: './cost-monitoring-dashboard.component.html'
})
export class CostMonitoringDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  costData: AICostData | null = null;
  budgetStatus: BudgetStatus | null = null;
  budgetPercentage = 0;
  projectedMonthEnd = 0;
  totalCalls = 0;
  savingsFromCache = 0;
  recommendations: string[] = [];

  // Alerting data
  activeAlerts: Alert[] = [];
  alertStats: any = {};
  escalationCandidates: Alert[] = [];

  // Chart configurations
  public lineChartData: ChartConfiguration['data'] = {
    datasets: [],
    labels: []
  };

  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: (context) => `$${context.parsed.y?.toFixed(2) || '0.00'}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'USD'
        }
      }
    }
  };

  public barChartData: ChartConfiguration['data'] = {
    datasets: [],
    labels: []
  };

  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Llamadas AI'
        }
      }
    }
  };

  // Table data
  displayedColumns: string[] = ['context', 'calls', 'cost', 'cacheHit', 'efficiency'];

  constructor(
    private costMonitoringService: AICostMonitoringService,
    private alertingService: AlertingService
  ) {}

  ngOnInit(): void {
    this.loadCostData();
    this.loadAlertData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCostData(): void {
    this.costMonitoringService.getCostData()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.costData = data;
          this.updateCalculations();
          this.updateCharts();
        },
        error: (error) => {
          console.error('Error loading cost data:', error);
          // Use mock data as fallback
          this.costData = this.costMonitoringService['getMockData']();
          this.updateCalculations();
          this.updateCharts();
        }
      });
  }

  private updateCalculations(): void {
    if (!this.costData) return;

    this.budgetStatus = this.costMonitoringService.getBudgetStatusInfo(this.costData);
    this.budgetPercentage = (this.costData.currentMonth / this.costData.budget) * 100;
    this.projectedMonthEnd = this.costMonitoringService.getProjectedMonthEnd(this.costData.currentMonth);
    this.totalCalls = this.costData.aiCalls + this.costData.cachedResponses;
    this.savingsFromCache = parseFloat((this.costData.cachedResponses * 0.002).toFixed(2));
    this.recommendations = this.costMonitoringService.getRecommendations(this.costData);
  }

  private updateCharts(): void {
    if (!this.costData) return;

    // Line chart for daily costs
    this.lineChartData = {
      labels: this.costData.dailyCosts.map(d => d.date),
      datasets: [
        {
          data: this.costData.dailyCosts.map(d => d.cost),
          label: 'Costo Diario',
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    };

    // Bar chart for calls by context
    this.barChartData = {
      labels: this.costData.byContext.map(c => c.name),
      datasets: [
        {
          data: this.costData.byContext.map(c => c.calls),
          label: 'Llamadas AI',
          backgroundColor: '#3b82f6',
          borderColor: '#2563eb',
          borderWidth: 1
        }
      ]
    };
  }

  getStatusColor(percentage: number): string {
    if (percentage < 50) return 'text-green-600';
    if (percentage < 80) return 'text-yellow-600';
    return 'text-red-600';
  }

  getEfficiencyClass(cached: number): string {
    if (cached >= 80) return 'bg-green-100 text-green-800';
    if (cached >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  }

  getEfficiencyText(cached: number): string {
    if (cached >= 80) return 'Excelente';
    if (cached >= 60) return 'Buena';
    return 'Mejorar';
  }

  private loadAlertData(): void {
    this.activeAlerts = this.alertingService.getActiveAlerts();
    this.alertStats = this.alertingService.getAlertStats();
    this.escalationCandidates = this.alertingService.getEscalationCandidates();
  }

  resolveAlert(alertId: string): void {
    if (this.alertingService.resolveAlert(alertId)) {
      this.loadAlertData(); // Refresh data
    }
  }

  async escalateAlert(alertId: string): Promise<void> {
    const success = await this.alertingService.escalateAlertManually(alertId);
    if (success) {
      this.loadAlertData(); // Refresh data
    }
  }

  getAlertSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }

  getAlertCategoryIcon(category: string): string {
    switch (category) {
      case 'budget': return 'account_balance_wallet';
      case 'cache': return 'cached';
      case 'rate_limit': return 'speed';
      case 'ai_service': return 'smart_toy';
      case 'system': return 'settings';
      default: return 'warning';
    }
  }

  refreshData(): void {
    this.loadCostData();
    this.loadAlertData();
  }

  // Test alert methods for development
  triggerBudgetAlert(percentage: number): void {
    this.alertingService.triggerBudgetAlert(percentage, 'chatbot');
    this.loadAlertData();
  }

  triggerCacheAlert(hitRate: number): void {
    this.alertingService.triggerCacheAlert(hitRate, 'ai_cost_monitoring');
    this.loadAlertData();
  }

  triggerRateLimitAlert(userId: string): void {
    this.alertingService.triggerRateLimitAlert(userId, true);
    this.loadAlertData();
  }
}