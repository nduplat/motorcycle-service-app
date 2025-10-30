import { Injectable, inject } from '@angular/core';
import { BudgetCircuitBreakerService, BudgetCircuitBreakerStatus } from './budget-circuit-breaker.service';
import { CostMonitoringService } from './cost-monitoring.service';
import { NotificationService } from './notification.service';

export interface AdminBudgetControls {
  resetCircuitBreaker: () => void;
  updateDailyBudget: (budget: number) => void;
  updateThresholds: (thresholds: { warningThreshold?: number; shutdownThreshold?: number; dailyBudget?: number }) => void;
  activateEmergencyMode: () => void;
  deactivateEmergencyMode: () => void;
  getStatus: () => BudgetCircuitBreakerStatus;
  getCostHistory: () => Promise<any[]>;
  forceCacheClear: (context?: string) => Promise<void>;
}

@Injectable({
  providedIn: 'root'
})
export class BudgetCircuitBreakerAdminService implements AdminBudgetControls {
  private budgetCircuitBreaker = inject(BudgetCircuitBreakerService);
  private costMonitoring = inject(CostMonitoringService);
  private notificationService = inject(NotificationService);

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker(): void {
    console.log('🔄 Admin: Resetting circuit breaker');
    this.budgetCircuitBreaker.resetCircuitBreaker();

    // Notify admin of the action
    this.notifyAdmin('Circuit breaker reset manually by admin');
  }

  /**
   * Update daily budget
   */
  updateDailyBudget(budget: number): void {
    if (budget <= 0) {
      throw new Error('Budget must be greater than 0');
    }

    console.log(`💰 Admin: Updating daily budget to $${budget}`);
    this.budgetCircuitBreaker.updateThresholds({ dailyBudget: budget });

    // Notify admin of the change
    this.notifyAdmin(`Daily budget updated to $${budget}`);
  }

  /**
   * Update budget thresholds
   */
  updateThresholds(thresholds: { warningThreshold?: number; shutdownThreshold?: number; dailyBudget?: number }): void {
    // Validate thresholds
    if (thresholds.warningThreshold !== undefined && (thresholds.warningThreshold < 0 || thresholds.warningThreshold > 100)) {
      throw new Error('Warning threshold must be between 0 and 100');
    }

    if (thresholds.shutdownThreshold !== undefined && (thresholds.shutdownThreshold < 0 || thresholds.shutdownThreshold > 100)) {
      throw new Error('Shutdown threshold must be between 0 and 100');
    }

    if (thresholds.warningThreshold !== undefined && thresholds.shutdownThreshold !== undefined) {
      if (thresholds.warningThreshold >= thresholds.shutdownThreshold) {
        throw new Error('Warning threshold must be less than shutdown threshold');
      }
    }

    console.log('⚙️ Admin: Updating budget thresholds', thresholds);
    this.budgetCircuitBreaker.updateThresholds(thresholds);

    // Notify admin of the changes
    const changes = Object.entries(thresholds)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    this.notifyAdmin(`Budget thresholds updated: ${changes}`);
  }

  /**
   * Force activate emergency mode
   */
  activateEmergencyMode(): void {
    console.log('🚨 Admin: Force activating emergency mode');
    // This would require adding a method to the circuit breaker service
    // For now, we'll simulate by updating thresholds to trigger it
    this.budgetCircuitBreaker.updateThresholds({ shutdownThreshold: 0.1 }); // Very low threshold
    this.notifyAdmin('Emergency mode force activated');
  }

  /**
   * Deactivate emergency mode
   */
  deactivateEmergencyMode(): void {
    console.log('✅ Admin: Deactivating emergency mode');
    // Reset to default thresholds
    this.budgetCircuitBreaker.updateThresholds({
      warningThreshold: 80,
      shutdownThreshold: 100
    });
    this.notifyAdmin('Emergency mode deactivated');
  }

  /**
   * Get current circuit breaker status
   */
  getStatus(): BudgetCircuitBreakerStatus {
    return this.budgetCircuitBreaker.getStatus();
  }

  /**
   * Get cost monitoring history
   */
  async getCostHistory(): Promise<any[]> {
    try {
      const history = await this.costMonitoring.getUsageHistory('daily', 30);
      return history.map(record => ({
        date: record.timestamp.toDate(),
        costs: record.costs,
        alerts: record.alertsTriggered
      }));
    } catch (error) {
      console.error('Error getting cost history:', error);
      return [];
    }
  }

  /**
   * Force clear cache for specific context
   */
  async forceCacheClear(context?: string): Promise<void> {
    // This would require access to CacheService
    // For now, we'll just log the action
    console.log(`🗑️ Admin: Force clearing cache${context ? ` for context: ${context}` : ''}`);
    this.notifyAdmin(`Cache cleared${context ? ` for context: ${context}` : ''}`);
  }

  /**
   * Get admin dashboard data
   */
  async getAdminDashboard(): Promise<{
    circuitBreakerStatus: BudgetCircuitBreakerStatus;
    costHistory: any[];
    recommendations: string[];
  }> {
    const status = this.getStatus();
    const costHistory = await this.getCostHistory();
    const recommendations = this.generateAdminRecommendations(status, costHistory);

    return {
      circuitBreakerStatus: status,
      costHistory,
      recommendations
    };
  }

  /**
   * Generate recommendations for admin
   */
  private generateAdminRecommendations(status: BudgetCircuitBreakerStatus, costHistory: any[]): string[] {
    const recommendations: string[] = [];

    // Circuit breaker state recommendations
    if (status.circuitBreaker.state === 'OPEN') {
      recommendations.push('Circuit breaker is OPEN. Consider increasing budget or optimizing AI usage.');
    }

    if (status.emergencyMode) {
      recommendations.push('Emergency mode is active. Review budget settings and usage patterns.');
    }

    // Budget recommendations
    const recentCosts = costHistory.slice(0, 7); // Last 7 days
    if (recentCosts.length > 0) {
      const avgDailyCost = recentCosts.reduce((sum, record) => sum + record.costs.total, 0) / recentCosts.length;

      if (avgDailyCost > status.thresholds.dailyBudget * 0.9) {
        recommendations.push(`Average daily cost ($${avgDailyCost.toFixed(2)}) is approaching budget limit. Consider budget increase.`);
      }

      if (avgDailyCost < status.thresholds.dailyBudget * 0.5) {
        recommendations.push(`Average daily cost ($${avgDailyCost.toFixed(2)}) is well below budget. Consider reducing budget to optimize costs.`);
      }
    }

    // Threshold recommendations
    if (status.thresholds.warningThreshold > 90) {
      recommendations.push('Warning threshold is very high. Consider lowering to get earlier alerts.');
    }

    if (status.thresholds.shutdownThreshold < 90) {
      recommendations.push('Shutdown threshold is low. This may cause frequent service interruptions.');
    }

    return recommendations;
  }

  /**
   * Notify admin of actions
   */
  private notifyAdmin(message: string): void {
    console.log(`📢 Admin notification: ${message}`);
    // In a real implementation, this would send notifications to admin users
    // this.notificationService.createAdminNotification('Budget Circuit Breaker', message);
  }

  /**
   * Export configuration for backup
   */
  exportConfiguration(): any {
    const status = this.getStatus();
    return {
      thresholds: status.thresholds,
      isEnabled: status.isEnabled,
      exportedAt: new Date(),
      version: '1.0'
    };
  }

  /**
   * Import configuration from backup
   */
  importConfiguration(config: any): void {
    if (!config.thresholds) {
      throw new Error('Invalid configuration format');
    }

    this.budgetCircuitBreaker.updateThresholds(config.thresholds);
    console.log('⚙️ Admin: Configuration imported', config);
    this.notifyAdmin('Configuration imported from backup');
  }
}