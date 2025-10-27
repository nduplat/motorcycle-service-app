import { Injectable, inject } from '@angular/core';
// import { AIAssistantService } from './ai-assistant.service'; // REMOVED: AI services eliminated for cost savings
import { NotificationService } from './notification.service';
import { QueueService } from './queue.service';
import { InventoryReportsService } from './inventory-reports.service';

@Injectable({
  providedIn: 'root'
})
export class AutomatedAITasksService {
  // private aiAssistantService = inject(AIAssistantService); // REMOVED: AI services eliminated for cost savings
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
      // REMOVED: AI services eliminated for cost savings
      // await this.aiAssistantService.generateSmartNotifications();
      console.log('Smart notifications disabled - AI services removed for cost optimization');
    } catch (error) {
      console.error('Error in automated smart notifications:', error);
    }
  }

  private async generateDailyReport(): Promise<void> {
    try {
      console.log('Generating automated daily report...');
      // REMOVED: AI services eliminated for cost savings
      // const report = await this.aiAssistantService.generateDailyReport();

      // Basic manual report generation instead
      const queueStatus = this.queueService.getQueueStatus()();
      const lowStockItems = this.inventoryReportsService.getLowStockReport();

      const basicReport = {
        date: new Date().toISOString().split('T')[0],
        queueStatus: queueStatus ? {
          currentCount: queueStatus.currentCount,
          averageWaitTime: queueStatus.averageWaitTime
        } : null,
        lowStockCount: lowStockItems.length,
        summary: `Cola: ${queueStatus?.currentCount || 0} clientes, Inventario: ${lowStockItems.length} productos bajos`
      };

      // Send basic daily report to admin users
      const adminUsers = ['admin1', 'admin2']; // In a real app, get from user service
      await this.notificationService.createSmartNotification(
        `Reporte diario básico: ${basicReport.summary}`,
        adminUsers
      );
      console.log('Basic daily report generated and sent');
    } catch (error) {
      console.error('Error generating daily report:', error);
    }
  }

  private async monitorQueueEfficiency(): Promise<void> {
    try {
      console.log('Monitoring queue efficiency...');
      // REMOVED: AI services eliminated for cost savings
      // const queueReport = await this.aiAssistantService.analyzeQueueEfficiency();

      // Basic manual queue monitoring instead
      const queueStatus = this.queueService.getQueueStatus()();

      if (queueStatus && queueStatus.averageWaitTime && queueStatus.averageWaitTime > 45) {
        const alertMessage = `Alerta: Tiempo de espera promedio alto (${queueStatus.averageWaitTime} minutos) con ${queueStatus.currentCount} clientes en cola`;
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
      // REMOVED: AI services eliminated for cost savings
      // const inventoryReport = await this.aiAssistantService.analyzeInventoryHealth();

      // Basic manual inventory monitoring instead
      const lowStockItems = this.inventoryReportsService.getLowStockReport();

      if (lowStockItems.length > 0) {
        const criticalItems = lowStockItems.filter(item => item.status === 'critical');
        if (criticalItems.length > 0) {
          const alertMessage = `Productos críticos bajos en stock: ${criticalItems.slice(0, 3).map(item => item.productName).join(', ')}`;
          await this.notificationService.createSmartNotification(alertMessage);
          console.log('Inventory health alerts sent');
        }
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