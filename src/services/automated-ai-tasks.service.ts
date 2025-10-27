import { Injectable, inject } from '@angular/core';
import { AIAssistantService } from './ai-assistant.service';
import { NotificationService } from './notification.service';
import { QueueService } from './queue.service';
import { InventoryReportsService } from './inventory-reports.service';

@Injectable({
  providedIn: 'root'
})
export class AutomatedAITasksService {
  private aiAssistantService = inject(AIAssistantService);
  private notificationService = inject(NotificationService);
  private queueService = inject(QueueService);
  private inventoryReportsService = inject(InventoryReportsService);

  private intervals: NodeJS.Timeout[] = [];

  constructor() {
    this.startAutomatedTasks();
  }

  private startAutomatedTasks(): void {
    // Generate smart notifications every 30 minutes
    const notificationInterval = setInterval(() => {
      this.runSmartNotifications();
    }, 30 * 60 * 1000); // 30 minutes

    // Generate daily report at 6 AM
    const dailyReportInterval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 6 && now.getMinutes() === 0) {
        this.generateDailyReport();
      }
    }, 60 * 1000); // Check every minute

    // Monitor queue efficiency every 15 minutes
    const queueMonitorInterval = setInterval(() => {
      this.monitorQueueEfficiency();
    }, 15 * 60 * 1000); // 15 minutes

    // Monitor inventory health every hour
    const inventoryMonitorInterval = setInterval(() => {
      this.monitorInventoryHealth();
    }, 60 * 60 * 1000); // 1 hour

    this.intervals = [
      notificationInterval,
      dailyReportInterval,
      queueMonitorInterval,
      inventoryMonitorInterval
    ];
  }

  private async runSmartNotifications(): Promise<void> {
    try {
      console.log('Running automated smart notifications...');
      await this.aiAssistantService.generateSmartNotifications();
      console.log('Smart notifications completed');
    } catch (error) {
      console.error('Error in automated smart notifications:', error);
    }
  }

  private async generateDailyReport(): Promise<void> {
    try {
      console.log('Generating automated daily report...');
      const report = await this.aiAssistantService.generateDailyReport();

      if (report) {
        // Send daily report to admin users
        const adminUsers = ['admin1', 'admin2']; // In a real app, get from user service
        await this.notificationService.createSmartNotification(
          `Reporte diario generado: ${report.summary}`,
          adminUsers
        );
        console.log('Daily report generated and sent');
      }
    } catch (error) {
      console.error('Error generating daily report:', error);
    }
  }

  private async monitorQueueEfficiency(): Promise<void> {
    try {
      console.log('Monitoring queue efficiency...');
      const queueReport = await this.aiAssistantService.analyzeQueueEfficiency();

      // Check for critical insights
      const criticalInsights = queueReport.insights.filter(i => i.priority === 'critical');

      if (criticalInsights.length > 0) {
        const alertMessage = `Alertas críticas en la cola: ${criticalInsights.map(i => i.title).join(', ')}`;
        await this.notificationService.createSmartNotification(alertMessage);
        console.log('Queue efficiency alerts sent');
      }
    } catch (error) {
      console.error('Error monitoring queue efficiency:', error);
    }
  }

  private async monitorInventoryHealth(): Promise<void> {
    try {
      console.log('Monitoring inventory health...');
      const inventoryReport = await this.aiAssistantService.analyzeInventoryHealth();

      // Check for critical inventory issues
      const criticalInsights = inventoryReport.insights.filter(i => i.priority === 'critical');

      if (criticalInsights.length > 0) {
        const alertMessage = `Problemas críticos de inventario: ${criticalInsights.map(i => i.title).join(', ')}`;
        await this.notificationService.createSmartNotification(alertMessage);
        console.log('Inventory health alerts sent');
      }
    } catch (error) {
      console.error('Error monitoring inventory health:', error);
    }
  }

  // Manual trigger methods for testing/admin purposes
  async triggerSmartNotifications(): Promise<void> {
    await this.runSmartNotifications();
  }

  async triggerDailyReport(): Promise<void> {
    await this.generateDailyReport();
  }

  async triggerQueueMonitoring(): Promise<void> {
    await this.monitorQueueEfficiency();
  }

  async triggerInventoryMonitoring(): Promise<void> {
    await this.monitorInventoryHealth();
  }

  // Cleanup method
  destroy(): void {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  }

  // Get status of automated tasks
  getTaskStatus(): {
    smartNotifications: boolean;
    dailyReports: boolean;
    queueMonitoring: boolean;
    inventoryMonitoring: boolean;
  } {
    return {
      smartNotifications: this.intervals.length >= 1,
      dailyReports: this.intervals.length >= 2,
      queueMonitoring: this.intervals.length >= 3,
      inventoryMonitoring: this.intervals.length >= 4
    };
  }
}