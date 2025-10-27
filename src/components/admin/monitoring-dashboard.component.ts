import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
import { ServiceHealthService, ServiceHealthStatus } from '../../services/service-health.service';
import { AlertingService, Alert } from '../../services/alerting.service';

interface SystemMetrics {
  timestamp: string;
  currentMetrics: any;
  recentMetrics: any[];
  uptime: number;
  memoryUsage: any;
  version: string;
}

interface BackupHistory {
  id: string;
  type: string;
  timestamp: any;
  status: string;
  size?: number;
  collections?: string[];
  fileCount?: number;
  duration?: number;
  errorMessage?: string;
}

interface AlertStats {
  totalActive: number;
  bySeverity: { critical?: number; high?: number; medium?: number; low?: number };
  recentHistory: number;
}

@Component({
  selector: 'app-monitoring-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="monitoring-dashboard">
      <h2>System Monitoring Dashboard</h2>

      <!-- Overall System Health -->
      <div class="health-overview">
        <h3>System Health</h3>
        <div class="health-status" [class]="getOverallHealthClass()">
          <span class="status-indicator"></span>
          <span class="status-text">{{ getOverallHealthText() }}</span>
        </div>
      </div>

      <!-- Service Health Cards -->
      <div class="services-grid">
        <div *ngFor="let status of healthStatuses" class="service-card" [class]="getServiceCardClass(status)">
          <h4>{{ status.service | titlecase }}</h4>
          <div class="service-status">
            <span class="status-badge" [class]="getStatusBadgeClass(status.status)">
              {{ status.status | titlecase }}
            </span>
            <span class="response-time" *ngIf="status.responseTime">
              {{ status.responseTime }}ms
            </span>
          </div>
          <div class="last-checked">
            Last checked: {{ status.lastChecked | date:'short' }}
          </div>
          <div class="error-message" *ngIf="status.errorMessage">
            {{ status.errorMessage }}
          </div>
        </div>
      </div>

      <!-- Active Alerts -->
      <div class="alerts-section" *ngIf="activeAlerts.length > 0">
        <h3>Active Alerts</h3>
        <div class="alerts-list">
          <div *ngFor="let alert of activeAlerts" class="alert-item" [class]="getAlertClass(alert.severity)">
            <div class="alert-header">
              <span class="alert-severity">{{ alert.severity | titlecase }}</span>
              <span class="alert-service">{{ alert.service }}</span>
              <button class="resolve-btn" (click)="resolveAlert(alert.id)">Resolve</button>
            </div>
            <div class="alert-message">{{ alert.message }}</div>
            <div class="alert-time">{{ alert.timestamp | date:'short' }}</div>
          </div>
        </div>
      </div>

      <!-- System Metrics -->
      <div class="metrics-section" *ngIf="systemMetrics">
        <h3>System Metrics</h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <h4>Function Calls</h4>
            <div class="metric-value">{{ getTotalFunctionCalls() }}</div>
          </div>
          <div class="metric-card">
            <h4>Error Rate</h4>
            <div class="metric-value">{{ getErrorRate() }}%</div>
          </div>
          <div class="metric-card">
            <h4>Memory Usage</h4>
            <div class="metric-value">{{ getMemoryUsage() }} MB</div>
          </div>
          <div class="metric-card">
            <h4>Uptime</h4>
            <div class="metric-value">{{ getUptime() }}</div>
          </div>
        </div>
      </div>

      <!-- Recent Backups -->
      <div class="backups-section" *ngIf="recentBackups.length > 0">
        <h3>Recent Backups</h3>
        <div class="backups-list">
          <div *ngFor="let backup of recentBackups" class="backup-item" [class]="getBackupClass(backup.status)">
            <div class="backup-header">
              <span class="backup-type">{{ backup.type | titlecase }}</span>
              <span class="backup-status">{{ backup.status | titlecase }}</span>
            </div>
            <div class="backup-details">
              <span *ngIf="backup.size">Size: {{ formatBytes(backup.size) }}</span>
              <span *ngIf="backup.collections">Collections: {{ backup.collections?.length }}</span>
              <span *ngIf="backup.fileCount">Files: {{ backup.fileCount }}</span>
              <span *ngIf="backup.duration">Duration: {{ backup.duration }}ms</span>
            </div>
            <div class="backup-time">{{ backup.timestamp?.toDate() | date:'short' }}</div>
            <div class="backup-error" *ngIf="backup.errorMessage">{{ backup.errorMessage }}</div>
          </div>
        </div>
      </div>

      <!-- Alert Statistics -->
      <div class="alert-stats">
        <h3>Alert Statistics (24h)</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Active Alerts</span>
            <span class="stat-value">{{ alertStats.totalActive }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Critical</span>
            <span class="stat-value">{{ alertStats.bySeverity['critical'] || 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">High</span>
            <span class="stat-value">{{ alertStats.bySeverity['high'] || 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Recent History</span>
            <span class="stat-value">{{ alertStats.recentHistory }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .monitoring-dashboard {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .health-overview {
      margin-bottom: 30px;
    }

    .health-status {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.2em;
      font-weight: bold;
    }

    .status-indicator {
      width: 16px;
      height: 16px;
      border-radius: 50%;
    }

    .status-indicator.healthy { background-color: #4caf50; }
    .status-indicator.degraded { background-color: #ff9800; }
    .status-indicator.unhealthy { background-color: #f44336; }

    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .service-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 16px;
      background: white;
    }

    .service-card.healthy { border-color: #4caf50; }
    .service-card.degraded { border-color: #ff9800; }
    .service-card.unhealthy { border-color: #f44336; }

    .service-status {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 8px 0;
    }

    .status-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.9em;
      font-weight: bold;
    }

    .status-badge.healthy { background-color: #e8f5e8; color: #2e7d32; }
    .status-badge.degraded { background-color: #fff3e0; color: #ef6c00; }
    .status-badge.unhealthy { background-color: #ffebee; color: #c62828; }

    .response-time {
      font-size: 0.9em;
      color: #666;
    }

    .last-checked {
      font-size: 0.8em;
      color: #999;
    }

    .error-message {
      font-size: 0.9em;
      color: #f44336;
      margin-top: 8px;
    }

    .alerts-section {
      margin-bottom: 30px;
    }

    .alerts-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .alert-item {
      border-left: 4px solid;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 4px;
    }

    .alert-item.critical { border-left-color: #f44336; background: #ffebee; }
    .alert-item.high { border-left-color: #ff9800; background: #fff3e0; }
    .alert-item.medium { border-left-color: #2196f3; background: #e3f2fd; }
    .alert-item.low { border-left-color: #4caf50; background: #e8f5e8; }

    .alert-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .alert-severity {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 0.8em;
    }

    .alert-service {
      font-weight: bold;
    }

    .resolve-btn {
      background: #4caf50;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8em;
    }

    .resolve-btn:hover {
      background: #45a049;
    }

    .alert-message {
      margin-bottom: 4px;
    }

    .alert-time {
      font-size: 0.8em;
      color: #666;
    }

    .metrics-section {
      margin-bottom: 30px;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }

    .metric-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      background: white;
    }

    .metric-value {
      font-size: 2em;
      font-weight: bold;
      color: #2196f3;
      margin-top: 8px;
    }

    .backups-section {
      margin-bottom: 30px;
    }

    .backups-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .backup-item {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 12px;
      background: white;
    }

    .backup-item.completed { border-color: #4caf50; }
    .backup-item.failed { border-color: #f44336; }

    .backup-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .backup-type {
      font-weight: bold;
    }

    .backup-status {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: bold;
    }

    .backup-status.completed { background: #e8f5e8; color: #2e7d32; }
    .backup-status.failed { background: #ffebee; color: #c62828; }

    .backup-details {
      display: flex;
      gap: 15px;
      font-size: 0.9em;
      color: #666;
      margin-bottom: 4px;
    }

    .backup-time {
      font-size: 0.8em;
      color: #999;
    }

    .backup-error {
      font-size: 0.9em;
      color: #f44336;
      margin-top: 4px;
    }

    .alert-stats {
      margin-bottom: 30px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
    }

    .stat-item {
      text-align: center;
      padding: 16px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
    }

    .stat-label {
      display: block;
      font-size: 0.9em;
      color: #666;
      margin-bottom: 8px;
    }

    .stat-value {
      display: block;
      font-size: 2em;
      font-weight: bold;
      color: #2196f3;
    }
  `]
})
export class MonitoringDashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private healthService = inject(ServiceHealthService);
  private alertingService = inject(AlertingService);

  healthStatuses: ServiceHealthStatus[] = [];
  activeAlerts: Alert[] = [];
  systemMetrics: SystemMetrics | null = null;
  recentBackups: BackupHistory[] = [];
  alertStats: AlertStats = { totalActive: 0, bySeverity: {}, recentHistory: 0 };

  private subscriptions: Subscription[] = [];
  private refreshInterval?: Subscription;

  ngOnInit() {
    this.loadData();
    this.startAutoRefresh();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.refreshInterval) {
      this.refreshInterval.unsubscribe();
    }
  }

  private loadData() {
    // Load health statuses
    this.healthStatuses = this.healthService.getAllHealthStatuses();

    // Load active alerts
    this.activeAlerts = this.alertingService.getActiveAlerts();

    // Load alert statistics
    this.alertStats = this.alertingService.getAlertStats();

    // Load system metrics
    this.loadSystemMetrics();

    // Load recent backups
    this.loadRecentBackups();
  }

  private async loadSystemMetrics() {
    try {
      const response = await fetch('/api/systemMetrics');
      if (response.ok) {
        this.systemMetrics = await response.json();
      }
    } catch (error) {
      console.error('Failed to load system metrics:', error);
    }
  }

  private async loadRecentBackups() {
    try {
      // This would typically come from a service that queries Firestore
      // For now, we'll simulate with empty array
      this.recentBackups = [];
    } catch (error) {
      console.error('Failed to load recent backups:', error);
    }
  }

  private startAutoRefresh() {
    this.refreshInterval = interval(30000).subscribe(() => { // Refresh every 30 seconds
      this.loadData();
    });
  }

  getOverallHealthClass(): string {
    const overall = this.healthService.getOverallHealth();
    return `status-${overall.status}`;
  }

  getOverallHealthText(): string {
    const overall = this.healthService.getOverallHealth();
    return `${overall.status.charAt(0).toUpperCase() + overall.status.slice(1)} (${overall.services.filter(s => s.status === 'healthy').length}/${overall.services.length} services healthy)`;
  }

  getServiceCardClass(status: ServiceHealthStatus): string {
    return status.status;
  }

  getStatusBadgeClass(status: string): string {
    return status;
  }

  getAlertClass(severity: string): string {
    return severity;
  }

  getBackupClass(status: string): string {
    return status;
  }

  resolveAlert(alertId: string) {
    if (this.alertingService.resolveAlert(alertId)) {
      this.loadData(); // Refresh the data
    }
  }

  getTotalFunctionCalls(): number {
    if (!this.systemMetrics?.currentMetrics) return 0;
    return Object.values(this.systemMetrics.currentMetrics).reduce((sum: number, metric: any) => sum + (metric.count || 0), 0);
  }

  getErrorRate(): string {
    const total = this.getTotalFunctionCalls();
    if (!this.systemMetrics?.currentMetrics || total === 0) return '0.00';

    const errors = Object.values(this.systemMetrics.currentMetrics).reduce((sum: number, metric: any) => sum + (metric.errors || 0), 0);
    return ((errors / total) * 100).toFixed(2);
  }

  getMemoryUsage(): string {
    if (!this.systemMetrics?.memoryUsage) return '0';
    return (this.systemMetrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(1);
  }

  getUptime(): string {
    if (!this.systemMetrics?.uptime) return '0s';
    const uptime = this.systemMetrics.uptime;
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}