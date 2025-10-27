import { ChangeDetectionStrategy, Component, inject, signal, OnInit, OnDestroy, effect, computed, input } from '@angular/core';
import { Subject } from 'rxjs';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatGridListModule } from '@angular/material/grid-list';
import { AuthService } from '../../services/auth.service';
import { TechnicianMetricsService } from '../../services/technician-metrics.service';
import { TechnicianMetrics } from '../../models';

@Component({
  selector: 'app-metrics',
  templateUrl: './metrics.component.html',
  styleUrls: ['./metrics.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTabsModule, MatChipsModule, MatIconModule, MatButtonModule,
    MatInputModule, MatFormFieldModule, MatProgressBarModule, MatCardModule, MatBadgeModule,
    MatSelectModule, MatDividerModule, MatGridListModule
  ]
})
export class MetricsComponent implements OnInit, OnDestroy {
  isActive = input<boolean>(false);
  authService = inject(AuthService);
  technicianMetricsService = inject(TechnicianMetricsService);

  currentUser = this.authService.currentUser;

  // Metrics signals
  metricsPeriod = signal<'daily' | 'weekly' | 'monthly'>('monthly');
  currentMetrics = signal<TechnicianMetrics | null>(null);
  teamMetrics = signal<TechnicianMetrics[]>([]);
  metricsHistory = signal<TechnicianMetrics[]>([]);
  metricsLoading = signal(false);
  metricsError = signal<string | null>(null);

  // Loading and error states
  loadingStates = signal({
    metrics: false,
    teamMetrics: false,
    metricsHistory: false
  });
  errorStates = signal({
    metrics: null as string | null,
    teamMetrics: null as string | null,
    metricsHistory: null as string | null
  });

  private destroy$ = new Subject<void>();

  constructor() {
    // Load metrics only when tab becomes active
    effect(() => {
      if (this.isActive()) {
        const user = this.currentUser();
        if (user) {
          this.loadMetricsData(user.id);
        }
      }
    });
  }

  ngOnInit(): void {
    // Initial load is handled by the effect in constructor
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadMetricsData(userId: string): Promise<void> {
    await Promise.all([
      this.loadTeamMetrics(),
      this.loadMetricsHistory(userId),
      this.loadPersonalEfficiencyHistory(userId)
    ]);
  }

  private async loadPersonalEfficiencyHistory(userId: string): Promise<void> {
    this.loadingStates.update(states => ({ ...states, metrics: true }));
    this.errorStates.update(errors => ({ ...errors, metrics: null }));

    try {
      const metrics = await this.technicianMetricsService.getTechnicianMetrics(userId, this.metricsPeriod()).toPromise();
      this.currentMetrics.set(metrics ?? null);
    } catch (error) {
      this.currentMetrics.set(null);
      this.errorStates.update(errors => ({ ...errors, metrics: 'Error al cargar las métricas de eficiencia' }));
    } finally {
      this.loadingStates.update(states => ({ ...states, metrics: false }));
    }
  }

  private async loadTeamMetrics(): Promise<void> {
    this.loadingStates.update(states => ({ ...states, teamMetrics: true }));
    this.errorStates.update(errors => ({ ...errors, teamMetrics: null }));

    try {
      const teamMetrics = await this.technicianMetricsService.getAllTechnicianMetrics(this.metricsPeriod()).toPromise();
      this.teamMetrics.set(teamMetrics || []);
    } catch (error) {
      this.teamMetrics.set([]);
      this.errorStates.update(errors => ({ ...errors, teamMetrics: 'Error al cargar las métricas del equipo' }));
    } finally {
      this.loadingStates.update(states => ({ ...states, teamMetrics: false }));
    }
  }

  private async loadMetricsHistory(userId: string): Promise<void> {
    this.loadingStates.update(states => ({ ...states, metricsHistory: true }));
    this.errorStates.update(errors => ({ ...errors, metricsHistory: null }));

    try {
      const history = await this.technicianMetricsService.getTechnicianMetricsHistory(userId, 6).toPromise();
      this.metricsHistory.set(history || []);
    } catch (error) {
      this.metricsHistory.set([]);
      this.errorStates.update(errors => ({ ...errors, metricsHistory: 'Error al cargar el historial de métricas' }));
    } finally {
      this.loadingStates.update(states => ({ ...states, metricsHistory: false }));
    }
  }

  onMetricsPeriodChange(period: 'daily' | 'weekly' | 'monthly'): void {
    this.metricsPeriod.set(period);
    const user = this.currentUser();
    if (user) {
      this.loadPersonalEfficiencyHistory(user.id);
      this.loadTeamMetrics();
    }
  }

  // Computed signals for metrics
  teamAverageEfficiency = computed(() => {
    const teamMetrics = this.teamMetrics();
    if (teamMetrics.length === 0) return 0;
    const total = teamMetrics.reduce((sum, metric) => sum + metric.efficiencyRate, 0);
    return Math.round(total / teamMetrics.length);
  });

  teamAverageCompletedJobs = computed(() => {
    const teamMetrics = this.teamMetrics();
    if (teamMetrics.length === 0) return 0;
    const total = teamMetrics.reduce((sum, metric) => sum + metric.completedWorkOrders, 0);
    return Math.round(total / teamMetrics.length);
  });

  teamAverageHoursWorked = computed(() => {
    const teamMetrics = this.teamMetrics();
    if (teamMetrics.length === 0) return 0;
    const total = teamMetrics.reduce((sum, metric) => sum + metric.totalHoursWorked, 0);
    return Math.round((total / teamMetrics.length) * 10) / 10;
  });

  personalVsTeamEfficiency = computed(() => {
    const personal = this.currentMetrics()?.efficiencyRate || 0;
    const team = this.teamAverageEfficiency();
    return personal - team;
  });

  personalVsTeamJobs = computed(() => {
    const personal = this.currentMetrics()?.completedWorkOrders || 0;
    const team = this.teamAverageCompletedJobs();
    return personal - team;
  });

  personalVsTeamHours = computed(() => {
    const personal = this.currentMetrics()?.totalHoursWorked || 0;
    const team = this.teamAverageHoursWorked();
    return personal - team;
  });

  // Goal tracking (mock data - would be configurable)
  monthlyGoals = computed(() => ({
    jobs: { current: this.currentMetrics()?.completedWorkOrders || 0, target: 25 },
    hours: { current: this.currentMetrics()?.totalHoursWorked || 0, target: 160 },
    efficiency: { current: this.currentMetrics()?.efficiencyRate || 0, target: 85 }
  }));

  goalProgress = computed(() => {
    const goals = this.monthlyGoals();
    return {
      jobs: Math.min((goals.jobs.current / goals.jobs.target) * 100, 100),
      hours: Math.min((goals.hours.current / goals.hours.target) * 100, 100),
      efficiency: Math.min((goals.efficiency.current / goals.efficiency.target) * 100, 100)
    };
  });

  // Chart data for productivity trends
  productivityChartData = computed(() => {
    const history = this.metricsHistory();
    return history.slice(-6).map(metric => ({
      month: metric.periodStart.toDate().toLocaleDateString('es-CO', { month: 'short' }),
      jobs: metric.completedWorkOrders,
      hours: metric.totalHoursWorked,
      efficiency: metric.efficiencyRate
    })).reverse();
  });

  // Customer satisfaction (mock data - would come from ratings system)
  customerSatisfaction = computed(() => {
    const metrics = this.currentMetrics();
    return metrics?.customerRating || 4.2; // Mock rating
  });

  // Utility method for formatting duration
  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
}