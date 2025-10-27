import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ServiceHealthService, ServiceHealthStatus } from './service-health.service';
import { ToastService } from './toast.service';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: (status: ServiceHealthStatus | BudgetStatus | CacheStatus | RateLimitStatus) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMinutes: number; // Minimum time between alerts
  channels: ('toast' | 'email' | 'sms' | 'console')[];
  recipients?: string[]; // Specific recipients for this alert
  escalationEnabled?: boolean;
  escalationDelayMinutes?: number; // Time before escalating
  escalationChannels?: ('email' | 'sms')[]; // Channels to use for escalation
  category: 'system' | 'budget' | 'cache' | 'rate_limit' | 'ai_service';
}

export interface Alert {
  id: string;
  ruleId: string;
  service: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  details?: any;
  category: 'system' | 'budget' | 'cache' | 'rate_limit' | 'ai_service';
  escalated?: boolean;
  escalationTimestamp?: Date;
}

export interface BudgetStatus {
  currentUsage: number;
  budgetLimit: number;
  percentage: number;
  context: 'chatbot' | 'scanner' | 'workOrder' | 'productSearch';
}

export interface CacheStatus {
  hitRate: number;
  totalRequests: number;
  cacheHits: number;
  context: string;
}

export interface RateLimitStatus {
  userId: string;
  requestCount: number;
  limit: number;
  windowMinutes: number;
  blocked: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AlertingService {
  private http = inject(HttpClient);
  private healthService = inject(ServiceHealthService);
  private toastService = inject(ToastService);

  private alertRules: AlertRule[] = [];
  private activeAlerts: Alert[] = [];
  private alertHistory: Alert[] = [];
  private lastAlertTimes = new Map<string, Date>();

  constructor() {
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    this.alertRules = [
      // System Health Rules
      {
        id: 'firebase-unhealthy',
        name: 'Firebase Services Unhealthy',
        description: 'Firebase services are reporting unhealthy status',
        condition: (status) => 'service' in status && status.service === 'firebase' && status.status === 'unhealthy',
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 5,
        channels: ['toast', 'console'],
        category: 'system'
      },
      {
        id: 'backend-system-unhealthy',
        name: 'Backend System Unhealthy',
        description: 'Backend system health check is failing',
        condition: (status) => 'service' in status && status.service === 'backend-system' && status.status === 'unhealthy',
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 5,
        channels: ['toast', 'console'],
        category: 'system'
      },
      {
        id: 'groq-ai-unhealthy',
        name: 'AI Service Unhealthy',
        description: 'Groq AI service is not responding',
        condition: (status) => 'service' in status && status.service === 'groq-ai' && status.status === 'unhealthy',
        severity: 'high',
        enabled: true,
        cooldownMinutes: 10,
        channels: ['toast', 'console'],
        category: 'ai_service'
      },
      {
        id: 'circuit-breaker-open',
        name: 'Circuit Breaker Open',
        description: 'Circuit breaker is open, indicating service degradation',
        condition: (status) => 'service' in status && status.service === 'circuit-breaker' && status.status === 'degraded',
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 15,
        channels: ['console'],
        category: 'system'
      },
      {
        id: 'rate-limiter-active',
        name: 'Rate Limiter Active',
        description: 'Rate limiter is blocking requests',
        condition: (status) => 'service' in status && status.service === 'rate-limiter' && status.status === 'degraded',
        severity: 'low',
        enabled: true,
        cooldownMinutes: 30,
        channels: ['console'],
        category: 'rate_limit'
      },
      // Budget Rules
      {
        id: 'budget-warning-80',
        name: 'Budget Warning (80%)',
        description: 'Budget usage has reached 80% threshold',
        condition: (status) => 'percentage' in status && status.percentage >= 80 && status.percentage < 100,
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 60,
        channels: ['toast', 'email'],
        recipients: ['admin@bluedragonmotors.com'],
        category: 'budget',
        escalationEnabled: true,
        escalationDelayMinutes: 30,
        escalationChannels: ['sms']
      },
      {
        id: 'budget-critical-100',
        name: 'Budget Critical (100%)',
        description: 'Budget usage has reached 100% - emergency shutdown',
        condition: (status) => 'percentage' in status && status.percentage >= 100,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 15,
        channels: ['toast', 'email', 'sms'],
        recipients: ['admin@bluedragonmotors.com', 'manager@bluedragonmotors.com'],
        category: 'budget',
        escalationEnabled: false
      },
      // Cache Rules
      {
        id: 'cache-hit-rate-low',
        name: 'Cache Hit Rate Low',
        description: 'Cache hit rate has dropped below 50%',
        condition: (status) => 'hitRate' in status && status.hitRate < 50,
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 30,
        channels: ['console', 'email'],
        recipients: ['admin@bluedragonmotors.com'],
        category: 'cache'
      },
      // Rate Limiting Rules
      {
        id: 'rate-limit-exceeded',
        name: 'Rate Limit Exceeded',
        description: 'User has exceeded rate limit and is being blocked',
        condition: (status) => 'blocked' in status && status.blocked === true,
        severity: 'high',
        enabled: true,
        cooldownMinutes: 5,
        channels: ['console'],
        category: 'rate_limit'
      }
    ];
  }

  /**
   * Add a custom alert rule
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newRule: AlertRule = { ...rule, id };
    this.alertRules.push(newRule);
    return id;
  }

  /**
   * Remove an alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const index = this.alertRules.findIndex(rule => rule.id === ruleId);
    if (index !== -1) {
      this.alertRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Enable or disable an alert rule
   */
  setAlertRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.alertRules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return [...this.activeAlerts];
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 50): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Manually resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();

      // Move to history
      this.alertHistory.push(alert);
      this.activeAlerts = this.activeAlerts.filter(a => a.id !== alertId);

      console.log(`Alert resolved: ${alert.message}`);
      return true;
    }
    return false;
  }

  /**
   * Check health status and trigger alerts
   */
  private async checkAndAlert(): Promise<void> {
    try {
      const healthStatuses = await this.healthService.checkAllServices();

      for (const status of healthStatuses) {
        for (const rule of this.alertRules) {
          if (!rule.enabled) continue;

          if (rule.condition(status)) {
            await this.triggerAlert(rule, status);
          } else {
            // Check if we should resolve existing alerts for this rule and service
            this.checkForAlertResolution(rule.id, status.service);
          }
        }
      }
    } catch (error) {
      console.error('Error in alert checking:', error);
    }
  }

  /**
   * Trigger an alert if cooldown period has passed
   */
  private async triggerAlert(rule: AlertRule, status: ServiceHealthStatus | BudgetStatus | CacheStatus | RateLimitStatus): Promise<void> {
    const serviceKey = 'service' in status ? status.service : rule.category;
    const alertKey = `${rule.id}-${serviceKey}`;
    const lastAlertTime = this.lastAlertTimes.get(alertKey);
    const now = new Date();

    // Check cooldown
    if (lastAlertTime) {
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      if (now.getTime() - lastAlertTime.getTime() < cooldownMs) {
        return; // Still in cooldown
      }
    }

    // Check if alert already exists
    const existingAlert = this.activeAlerts.find(a =>
      a.ruleId === rule.id && a.service === serviceKey && !a.resolved
    );

    if (existingAlert) {
      // Update existing alert timestamp
      existingAlert.timestamp = now;
      return;
    }

    // Create new alert
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      service: 'service' in status ? status.service : rule.category,
      message: `${rule.name}: ${'errorMessage' in status ? status.errorMessage || 'Condition met' : 'Alert condition met'}`,
      severity: rule.severity,
      timestamp: now,
      resolved: false,
      category: rule.category,
      details: 'service' in status ? {
        status: status.status,
        responseTime: status.responseTime,
        lastChecked: status.lastChecked
      } : status
    };

    this.activeAlerts.push(alert);
    this.lastAlertTimes.set(alertKey, now);

    // Send notifications
    await this.sendAlertNotifications(alert, rule.channels);

    console.warn(`Alert triggered: ${alert.message} (Severity: ${rule.severity})`);
  }

  /**
   * Check if alerts should be resolved when service recovers
   */
  private checkForAlertResolution(ruleId: string, service: string): void {
    const alertsToResolve = this.activeAlerts.filter(a =>
      a.ruleId === ruleId && a.service === service && !a.resolved
    );

    // Also check for budget/cache/rate limit alerts that may need resolution
    const rule = this.alertRules.find(r => r.id === ruleId);
    if (rule && ['budget', 'cache', 'rate_limit'].includes(rule.category)) {
      const categoryAlerts = this.activeAlerts.filter(a =>
        a.ruleId === ruleId && a.category === rule.category && !a.resolved
      );
      alertsToResolve.push(...categoryAlerts);
    }

    alertsToResolve.forEach(alert => {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.alertHistory.push(alert);
      console.log(`Alert auto-resolved: ${alert.message}`);
    });

    this.activeAlerts = this.activeAlerts.filter(a => !alertsToResolve.includes(a));
  }

  /**
   * Send alert notifications through configured channels
   */
  private async sendAlertNotifications(alert: Alert, channels: string[]): Promise<void> {
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'toast':
            this.sendToastNotification(alert);
            break;
          case 'email':
            await this.sendEmailNotification(alert);
            break;
          case 'sms':
            await this.sendSmsNotification(alert);
            break;
          case 'console':
            this.sendConsoleNotification(alert);
            break;
        }
      } catch (error) {
        console.error(`Failed to send alert via ${channel}:`, error);
      }
    }
  }

  /**
   * Send toast notification
   */
  private sendToastNotification(alert: Alert): void {
    const severityTypes = {
      low: 'info' as const,
      medium: 'warning' as const,
      high: 'error' as const,
      critical: 'error' as const
    };

    this.toastService.show({
      message: alert.message,
      type: severityTypes[alert.severity],
      duration: 10000 // 10 seconds
    });
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: Alert): Promise<void> {
    try {
      const emailData = {
        to: 'admin@bluedragonmotors.com',
        subject: `Alert: ${alert.service} - ${alert.severity.toUpperCase()}`,
        body: alert.message,
        details: alert.details,
        timestamp: alert.timestamp.toISOString(),
        severity: alert.severity
      };

      // Send email via backend API
      await this.http.post('/api/send-alert-email', emailData).toPromise();

      console.log(`Email alert sent: ${alert.message}`);
    } catch (error) {
      console.error('Failed to send email alert:', error);
      // Fallback to console logging
      console.log(`EMAIL ALERT: ${alert.message} (Severity: ${alert.severity})`);
      throw error; // Re-throw to be caught by caller
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSmsNotification(alert: Alert): Promise<void> {
    try {
      const smsData = {
        to: '+573001234567', // Default admin number - should be configurable
        message: `ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`,
        priority: alert.severity,
        timestamp: alert.timestamp.toISOString(),
        category: alert.category
      };

      // Send SMS via backend API
      await this.http.post('/api/send-alert-sms', smsData).toPromise();

      console.log(`SMS alert sent: ${alert.message}`);
    } catch (error) {
      console.error('Failed to send SMS alert:', error);
      // Fallback to console logging
      console.log(`SMS ALERT: ${alert.message} (Severity: ${alert.severity})`);
      throw error; // Re-throw to be caught by caller
    }
  }

  /**
   * Send console notification
   */
  private sendConsoleNotification(alert: Alert): void {
    const logLevel = alert.severity === 'critical' ? 'error' :
                    alert.severity === 'high' ? 'error' :
                    alert.severity === 'medium' ? 'warn' : 'info';

    console[logLevel](`ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`, alert.details);
  }

  /**
   * Start the monitoring loop
   */
  private startMonitoring(): void {
    // Initial check
    this.checkAndAlert();

    // Check every 2 minutes
    setInterval(() => {
      this.checkAndAlert().catch(error => {
        console.error('Alert monitoring failed:', error);
      });
    }, 2 * 60 * 1000);

    // Start escalation monitoring
    this.startEscalationMonitoring();
  }

  /**
   * Start escalation monitoring for unresolved alerts
   */
  private startEscalationMonitoring(): void {
    setInterval(() => {
      this.checkAndEscalateAlerts().catch(error => {
        console.error('Alert escalation failed:', error);
      });
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Check and escalate unresolved alerts
   */
  private async checkAndEscalateAlerts(): Promise<void> {
    const now = new Date();

    for (const alert of this.activeAlerts) {
      if (alert.resolved) continue;

      const rule = this.alertRules.find(r => r.id === alert.ruleId);
      if (!rule?.escalationEnabled || !rule.escalationDelayMinutes) continue;

      const alertAgeMinutes = (now.getTime() - alert.timestamp.getTime()) / (1000 * 60);

      if (alertAgeMinutes >= rule.escalationDelayMinutes && !alert.escalated) {
        await this.escalateAlert(alert, rule);
      }
    }
  }

  /**
   * Escalate an alert to additional channels
   */
  private async escalateAlert(alert: Alert, rule: AlertRule): Promise<void> {
    if (!rule.escalationChannels || rule.escalationChannels.length === 0) return;

    console.warn(`🚨 Escalating alert: ${alert.message}`);

    alert.escalated = true;
    alert.escalationTimestamp = new Date();

    // Send escalation notifications
    await this.sendAlertNotifications(alert, rule.escalationChannels);

    // Log escalation in history
    this.alertHistory.push({
      ...alert,
      message: `[ESCALATED] ${alert.message}`,
      details: {
        ...alert.details,
        escalatedAt: alert.escalationTimestamp,
        escalationChannels: rule.escalationChannels
      }
    });
  }

  /**
   * Manually escalate an alert
   */
  async escalateAlertManually(alertId: string): Promise<boolean> {
    const alert = this.activeAlerts.find(a => a.id === alertId);
    if (!alert || alert.resolved || alert.escalated) return false;

    const rule = this.alertRules.find(r => r.id === alert.ruleId);
    if (!rule?.escalationEnabled) return false;

    await this.escalateAlert(alert, rule);
    return true;
  }

  /**
   * Get escalation candidates (alerts that can be escalated)
   */
  getEscalationCandidates(): Alert[] {
    const now = new Date();

    return this.activeAlerts.filter(alert => {
      if (alert.resolved || alert.escalated) return false;

      const rule = this.alertRules.find(r => r.id === alert.ruleId);
      if (!rule?.escalationEnabled || !rule.escalationDelayMinutes) return false;

      const alertAgeMinutes = (now.getTime() - alert.timestamp.getTime()) / (1000 * 60);
      return alertAgeMinutes >= rule.escalationDelayMinutes;
    });
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    totalActive: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    recentHistory: number;
    escalatedCount: number;
  } {
    const bySeverity = this.activeAlerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byCategory = this.activeAlerts.reduce((acc, alert) => {
      acc[alert.category] = (acc[alert.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalActive: this.activeAlerts.length,
      bySeverity,
      byCategory,
      recentHistory: this.alertHistory.filter(a =>
        a.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length,
      escalatedCount: this.activeAlerts.filter(a => a.escalated).length
    };
  }

  /**
   * Get detailed alert history with filtering
   */
  getAlertHistoryDetailed(options: {
    limit?: number;
    category?: string;
    severity?: string;
    resolved?: boolean;
    escalated?: boolean;
    startDate?: Date;
    endDate?: Date;
  } = {}): Alert[] {
    const {
      limit = 100,
      category,
      severity,
      resolved,
      escalated,
      startDate,
      endDate
    } = options;

    let filtered = [...this.alertHistory];

    if (category) {
      filtered = filtered.filter(a => a.category === category);
    }

    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }

    if (resolved !== undefined) {
      filtered = filtered.filter(a => a.resolved === resolved);
    }

    if (escalated !== undefined) {
      filtered = filtered.filter(a => a.escalated === escalated);
    }

    if (startDate) {
      filtered = filtered.filter(a => a.timestamp >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter(a => a.timestamp <= endDate);
    }

    return filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Export alert history to CSV
   */
  exportAlertHistoryToCSV(options: {
    category?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}): string {
    const alerts = this.getAlertHistoryDetailed({ ...options, limit: 1000 });

    const headers = ['Timestamp', 'Category', 'Severity', 'Service', 'Message', 'Resolved', 'Escalated', 'Escalation Time'];
    const rows = alerts.map(alert => [
      alert.timestamp.toISOString(),
      alert.category,
      alert.severity,
      alert.service,
      `"${alert.message.replace(/"/g, '""')}"`,
      alert.resolved ? 'Yes' : 'No',
      alert.escalated ? 'Yes' : 'No',
      alert.escalationTimestamp ? alert.escalationTimestamp.toISOString() : ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Clear old alert history (older than specified days)
   */
  clearOldAlertHistory(daysToKeep: number = 90): number {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const initialCount = this.alertHistory.length;

    this.alertHistory = this.alertHistory.filter(alert =>
      alert.timestamp > cutoffDate
    );

    const removedCount = initialCount - this.alertHistory.length;
    console.log(`Cleared ${removedCount} old alerts from history`);
    return removedCount;
  }

  /**
   * Get alert trends over time
   */
  getAlertTrends(days: number = 30): {
    dailyCounts: Array<{ date: string; count: number; bySeverity: Record<string, number> }>;
    topServices: Array<{ service: string; count: number }>;
    averageResolutionTime: number; // in minutes
  } {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const relevantAlerts = this.alertHistory.filter(a => a.timestamp > cutoffDate);

    // Daily counts
    const dailyMap = new Map<string, { count: number; bySeverity: Record<string, number> }>();
    for (const alert of relevantAlerts) {
      const dateKey = alert.timestamp.toISOString().split('T')[0];
      const dayData = dailyMap.get(dateKey) || { count: 0, bySeverity: {} };
      dayData.count++;
      dayData.bySeverity[alert.severity] = (dayData.bySeverity[alert.severity] || 0) + 1;
      dailyMap.set(dateKey, dayData);
    }

    const dailyCounts = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top services
    const serviceCounts = new Map<string, number>();
    for (const alert of relevantAlerts) {
      serviceCounts.set(alert.service, (serviceCounts.get(alert.service) || 0) + 1);
    }

    const topServices = Array.from(serviceCounts.entries())
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Average resolution time
    const resolvedAlerts = relevantAlerts.filter(a => a.resolved && a.resolvedAt);
    const totalResolutionTime = resolvedAlerts.reduce((sum, alert) => {
      return sum + (alert.resolvedAt!.getTime() - alert.timestamp.getTime());
    }, 0);

    const averageResolutionTime = resolvedAlerts.length > 0
      ? totalResolutionTime / resolvedAlerts.length / (1000 * 60) // Convert to minutes
      : 0;

    return {
      dailyCounts,
      topServices,
      averageResolutionTime
    };
  }

  /**
   * Manually trigger budget alert for testing
   */
  triggerBudgetAlert(percentage: number, context: 'chatbot' | 'scanner' | 'workOrder' | 'productSearch'): void {
    const budgetStatus: BudgetStatus = {
      currentUsage: percentage * 10, // Mock calculation
      budgetLimit: 10,
      percentage,
      context
    };

    this.checkAndAlertForStatus(budgetStatus);
  }

  /**
   * Manually trigger cache alert for testing
   */
  triggerCacheAlert(hitRate: number, context: string): void {
    const cacheStatus: CacheStatus = {
      hitRate,
      totalRequests: 1000,
      cacheHits: Math.floor(1000 * hitRate / 100),
      context
    };

    this.checkAndAlertForStatus(cacheStatus);
  }

  /**
   * Manually trigger rate limit alert for testing
   */
  triggerRateLimitAlert(userId: string, blocked: boolean): void {
    const rateLimitStatus: RateLimitStatus = {
      userId,
      requestCount: 100,
      limit: 50,
      windowMinutes: 15,
      blocked
    };

    this.checkAndAlertForStatus(rateLimitStatus);
  }

  /**
   * Get alert channels and recipients for a rule
   */
  getAlertChannels(ruleId: string): { channels: string[]; recipients?: string[] } {
    const rule = this.alertRules.find(r => r.id === ruleId);
    if (!rule) return { channels: [] };

    return {
      channels: rule.channels,
      recipients: rule.recipients
    };
  }

  /**
   * Update alert rule configuration
   */
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const ruleIndex = this.alertRules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) return false;

    this.alertRules[ruleIndex] = { ...this.alertRules[ruleIndex], ...updates };
    console.log(`Alert rule ${ruleId} updated:`, updates);
    return true;
  }

  /**
   * Get alert rules by category
   */
  getAlertRulesByCategory(category: string): AlertRule[] {
    return this.alertRules.filter(rule => rule.category === category);
  }

  /**
   * Configure alert channels and recipients for a rule
   */
  configureAlertChannels(ruleId: string, channels: ('toast' | 'email' | 'sms' | 'console')[], recipients?: string[]): boolean {
    const rule = this.alertRules.find(r => r.id === ruleId);
    if (!rule) return false;

    rule.channels = channels;
    if (recipients) {
      rule.recipients = recipients;
    }

    console.log(`Alert channels configured for ${ruleId}:`, { channels, recipients });
    return true;
  }

  /**
   * Get available notification channels
   */
  getAvailableChannels(): string[] {
    return ['toast', 'email', 'sms', 'console'];
  }

  /**
   * Validate email recipients
   */
  validateEmailRecipients(emails: string[]): { valid: string[]; invalid: string[] } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid: string[] = [];
    const invalid: string[] = [];

    emails.forEach(email => {
      if (emailRegex.test(email.trim())) {
        valid.push(email.trim());
      } else {
        invalid.push(email.trim());
      }
    });

    return { valid, invalid };
  }

  /**
   * Validate SMS recipients (phone numbers)
   */
  validateSmsRecipients(phoneNumbers: string[]): { valid: string[]; invalid: string[] } {
    // Basic phone number validation (supports international format)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const valid: string[] = [];
    const invalid: string[] = [];

    phoneNumbers.forEach(phone => {
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
      if (phoneRegex.test(cleanPhone)) {
        valid.push(cleanPhone);
      } else {
        invalid.push(phone);
      }
    });

    return { valid, invalid };
  }

  /**
   * Get alert configuration summary
   */
  getAlertConfigurationSummary(): {
    totalRules: number;
    byCategory: Record<string, number>;
    configuredChannels: Record<string, number>;
    escalationEnabled: number;
  } {
    const byCategory: Record<string, number> = {};
    const configuredChannels: Record<string, number> = {};
    let escalationEnabled = 0;

    this.alertRules.forEach(rule => {
      // Count by category
      byCategory[rule.category] = (byCategory[rule.category] || 0) + 1;

      // Count channels
      rule.channels.forEach(channel => {
        configuredChannels[channel] = (configuredChannels[channel] || 0) + 1;
      });

      // Count escalation enabled
      if (rule.escalationEnabled) {
        escalationEnabled++;
      }
    });

    return {
      totalRules: this.alertRules.length,
      byCategory,
      configuredChannels,
      escalationEnabled
    };
  }

  /**
   * Check and alert for a specific status (used for manual triggering)
   */
  private async checkAndAlertForStatus(status: ServiceHealthStatus | BudgetStatus | CacheStatus | RateLimitStatus): Promise<void> {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      if (rule.condition(status)) {
        await this.triggerAlert(rule, status);
      }
    }
  }
}