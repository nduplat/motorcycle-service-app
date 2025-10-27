import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { QueueService } from '../../services/queue.service';
import { TechnicianMetricsService } from '../../services/technician-metrics.service';
import { UserService } from '../../services/user.service';
import { QueueEntry, TechnicianMetrics, User } from '../../models';
import { toDate } from '../../models/types';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe]
})
export class AdminDashboardComponent {
  private queueService = inject(QueueService);
  private technicianMetricsService = inject(TechnicianMetricsService);
  private userService = inject(UserService);
  private router = inject(Router);

  // Real-time metrics computed signals
  waitingCount = computed(() =>
    this.queueService.getQueueEntries()().filter(entry => entry.status === 'waiting').length
  );

  calledCount = computed(() =>
    this.queueService.getQueueEntries()().filter(entry => entry.status === 'called').length
  );

  servedCount = computed(() =>
    this.queueService.getQueueEntries()().filter(entry => entry.status === 'served').length
  );

  noShowCount = computed(() =>
    this.queueService.getQueueEntries()().filter(entry => entry.status === 'no_show').length
  );

  avgWaitTime = computed(() => {
    const queueStatus = this.queueService.getQueueStatus()();
    return queueStatus?.averageWaitTime || 0;
  });

  technicianUtilization = computed(() => {
    const technicians = this.userService.getUsersByRole('technician');
    if (technicians.length === 0) return 0;

    // For cost-efficiency, we'll use a simple calculation based on current queue load
    // In a real implementation, this would aggregate metrics from TechnicianMetricsService
    const activeEntries = this.queueService.getQueueEntries()().filter(
      entry => entry.status === 'waiting' || entry.status === 'called'
    ).length;

    // Assume each technician can handle 2 concurrent clients
    const maxConcurrentCapacity = technicians.length * 2;
    const utilization = maxConcurrentCapacity > 0 ? (activeEntries / maxConcurrentCapacity) * 100 : 0;

    return Math.min(100, Math.max(0, utilization));
  });

  // Critical alerts system
  longWaitAlert = computed(() => {
    const now = new Date();
    const waitingEntries = this.queueService.getQueueEntries()().filter(entry => entry.status === 'waiting');

    return waitingEntries.some(entry => {
      const joinedAt = toDate(entry.joinedAt);
      const waitTimeMinutes = (now.getTime() - joinedAt.getTime()) / (1000 * 60);
      return waitTimeMinutes > 60;
    });
  });

  noTechniciansAlert = computed(() => {
    const technicians = this.userService.getUsersByRole('technician');
    const availableTechnicians = technicians.filter(tech =>
      tech.availability?.isAvailable !== false
    );
    return availableTechnicians.length === 0;
  });

  queueSizeAlert = computed(() => {
    const activeEntries = this.queueService.getQueueEntries()().filter(
      entry => entry.status === 'waiting' || entry.status === 'called'
    );
    return activeEntries.length > 10;
  });

  // Combined alerts for template
  alerts = computed(() => {
    const alerts = [];
    if (this.longWaitAlert()) {
      alerts.push({
        type: 'long_wait',
        title: 'Espera prolongada',
        message: 'Clientes esperando más de 60 minutos',
        severity: 'critical' as const
      });
    }
    if (this.noTechniciansAlert()) {
      alerts.push({
        type: 'no_technicians',
        title: 'Sin técnicos disponibles',
        message: 'No hay técnicos disponibles para atender',
        severity: 'critical' as const
      });
    }
    if (this.queueSizeAlert()) {
      alerts.push({
        type: 'queue_overflow',
        title: 'Cola llena',
        message: 'Más de 10 clientes en cola',
        severity: 'warning' as const
      });
    }
    return alerts;
  });

  // Navigation methods
  navigateToQueue() {
    this.router.navigate(['/admin/queue']);
  }

  navigateToTechnicians() {
    this.router.navigate(['/admin/users'], { queryParams: { role: 'technician' } });
  }

  navigateToReports() {
    this.router.navigate(['/admin/reports']);
  }
}
