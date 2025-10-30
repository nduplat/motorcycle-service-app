import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Job, JobStatus, JobType, JobStats, JobPriority } from '../models';
import { JobQueueService } from '../services/job-queue.service';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-job-monitoring-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="job-dashboard">
      <div class="dashboard-header">
        <h2>📊 Monitoreo de Jobs en Background</h2>
        <div class="stats-overview">
          <div class="stat-card" *ngFor="let stat of statsCards()">
            <div class="stat-icon">{{ stat.icon }}</div>
            <div class="stat-content">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="dashboard-content">
        <div class="filters-section">
          <div class="filter-group">
            <label>Estado:</label>
            <select [(ngModel)]="statusFilter" (change)="applyFilters()">
              <option value="">Todos</option>
              <option *ngFor="let status of jobStatuses" [value]="status">
                {{ getStatusLabel(status) }}
              </option>
            </select>
          </div>

          <div class="filter-group">
            <label>Tipo:</label>
            <select [(ngModel)]="typeFilter" (change)="applyFilters()">
              <option value="">Todos</option>
              <option *ngFor="let type of jobTypes" [value]="type">
                {{ getTypeLabel(type) }}
              </option>
            </select>
          </div>

          <div class="filter-group">
            <label>Prioridad:</label>
            <select [(ngModel)]="priorityFilter" (change)="applyFilters()">
              <option value="">Todas</option>
              <option *ngFor="let priority of jobPriorities" [value]="priority">
                {{ getPriorityLabel(priority) }}
              </option>
            </select>
          </div>

          <button class="refresh-btn" (click)="refreshData()" [disabled]="isLoading()">
            🔄 Actualizar
          </button>
        </div>

        <div class="jobs-table-container">
          <table class="jobs-table" *ngIf="filteredJobs().length > 0; else noJobs">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Creado</th>
                <th>Procesado</th>
                <th>Reintentos</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let job of filteredJobs()" [class]="getJobRowClass(job)">
                <td class="job-id">{{ job.id }}</td>
                <td>
                  <span class="job-type" [class]="'type-' + job.type">
                    {{ getTypeLabel(job.type) }}
                  </span>
                </td>
                <td>
                  <span class="job-status" [class]="'status-' + job.status">
                    {{ getStatusLabel(job.status) }}
                  </span>
                </td>
                <td>
                  <span class="job-priority" [class]="'priority-' + job.priority">
                    {{ getPriorityLabel(job.priority) }}
                  </span>
                </td>
                <td>{{ formatDate(job.createdAt) }}</td>
                <td>{{ job.processingTimeMs ? (job.processingTimeMs / 1000).toFixed(2) + 's' : '-' }}</td>
                <td>
                  <span class="retry-count" [class.retry-warning]="job.retryCount > 0">
                    {{ job.retryCount }}/{{ job.maxRetries }}
                  </span>
                </td>
                <td>
                  <div class="job-actions">
                    <button
                      *ngIf="canRetry(job)"
                      class="action-btn retry-btn"
                      (click)="retryJob(job.id)"
                      title="Reintentar job">
                      🔄
                    </button>
                    <button
                      *ngIf="canCancel(job)"
                      class="action-btn cancel-btn"
                      (click)="cancelJob(job.id)"
                      title="Cancelar job">
                      ❌
                    </button>
                    <button
                      class="action-btn details-btn"
                      (click)="showJobDetails(job)"
                      title="Ver detalles">
                      📋
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <ng-template #noJobs>
            <div class="no-jobs">
              <div class="no-jobs-icon">📭</div>
              <div class="no-jobs-text">No hay jobs que coincidan con los filtros</div>
            </div>
          </ng-template>
        </div>

        <!-- Job Details Modal -->
        <div class="job-details-modal" *ngIf="selectedJob()" (click)="closeJobDetails()" #modal>
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Detalles del Job {{ selectedJob()?.id }}</h3>
              <button class="close-btn" (click)="closeJobDetails()">✕</button>
            </div>

            <div class="modal-body" *ngIf="selectedJob() as job">
              <div class="detail-grid">
                <div class="detail-item">
                  <label>Tipo:</label>
                  <span>{{ getTypeLabel(job.type) }}</span>
                </div>

                <div class="detail-item">
                  <label>Estado:</label>
                  <span class="status-badge" [class]="'status-' + job.status">
                    {{ getStatusLabel(job.status) }}
                  </span>
                </div>

                <div class="detail-item">
                  <label>Prioridad:</label>
                  <span class="priority-badge" [class]="'priority-' + job.priority">
                    {{ getPriorityLabel(job.priority) }}
                  </span>
                </div>

                <div class="detail-item">
                  <label>Creado:</label>
                  <span>{{ formatDate(job.createdAt) }}</span>
                </div>

                <div class="detail-item" *ngIf="job.startedAt">
                  <label>Iniciado:</label>
                  <span>{{ formatDate(job.startedAt) }}</span>
                </div>

                <div class="detail-item" *ngIf="job.completedAt">
                  <label>Completado:</label>
                  <span>{{ formatDate(job.completedAt) }}</span>
                </div>

                <div class="detail-item">
                  <label>Tiempo de procesamiento:</label>
                  <span>{{ job.processingTimeMs ? (job.processingTimeMs / 1000).toFixed(2) + ' segundos' : 'No procesado' }}</span>
                </div>

                <div class="detail-item">
                  <label>Reintentos:</label>
                  <span>{{ job.retryCount }}/{{ job.maxRetries }}</span>
                </div>

                <div class="detail-item" *ngIf="job.createdBy">
                  <label>Creado por:</label>
                  <span>{{ job.createdBy }}</span>
                </div>

                <div class="detail-item" *ngIf="job.workerId">
                  <label>Procesado por:</label>
                  <span>{{ job.workerId }}</span>
                </div>
              </div>

              <div class="job-data-section" *ngIf="selectedJob()?.data">
                <h4>Datos del Job:</h4>
                <pre class="job-data">{{ selectedJob()?.data | json }}</pre>
              </div>

              <div class="job-result-section" *ngIf="selectedJob()?.result">
                <h4>Resultado:</h4>
                <pre class="job-result">{{ selectedJob()?.result | json }}</pre>
              </div>

              <div class="job-error-section" *ngIf="selectedJob()?.error">
                <h4>Error:</h4>
                <pre class="job-error">{{ selectedJob()?.error }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .job-dashboard {
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .dashboard-header {
      margin-bottom: 30px;
    }

    .dashboard-header h2 {
      color: #333;
      margin-bottom: 20px;
      font-size: 1.8rem;
    }

    .stats-overview {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .stat-icon {
      font-size: 2rem;
    }

    .stat-content {
      flex: 1;
    }

    .stat-value {
      font-size: 1.8rem;
      font-weight: bold;
      color: #333;
    }

    .stat-label {
      color: #666;
      font-size: 0.9rem;
    }

    .filters-section {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
      align-items: center;
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .filter-group label {
      font-weight: 500;
      color: #555;
    }

    .filter-group select {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
    }

    .refresh-btn {
      padding: 8px 16px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    }

    .refresh-btn:hover:not(:disabled) {
      background: #0056b3;
    }

    .refresh-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .jobs-table-container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    .jobs-table {
      width: 100%;
      border-collapse: collapse;
    }

    .jobs-table th,
    .jobs-table td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }

    .jobs-table th {
      background: #f8f9fa;
      font-weight: 600;
      color: #333;
    }

    .job-id {
      font-family: monospace;
      font-size: 0.9rem;
      color: #666;
    }

    .job-type, .job-status, .job-priority {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 500;
    }

    /* Status colors */
    .status-pending { background: #fff3cd; color: #856404; }
    .status-processing { background: #cce5ff; color: #004085; }
    .status-completed { background: #d4edda; color: #155724; }
    .status-failed { background: #f8d7da; color: #721c24; }
    .status-retrying { background: #fff3cd; color: #856404; }
    .status-cancelled { background: #e2e3e5; color: #383d41; }

    /* Priority colors */
    .priority-low { background: #e9ecef; color: #495057; }
    .priority-medium { background: #cce5ff; color: #004085; }
    .priority-high { background: #fff3cd; color: #856404; }
    .priority-urgent { background: #f8d7da; color: #721c24; }

    /* Type colors */
    .type-create_work_order { background: #d1ecf1; color: #0c5460; }
    .type-send_notification { background: #d4edda; color: #155724; }
    .type-process_payment { background: #cce5ff; color: #004085; }
    .type-generate_report { background: #fff3cd; color: #856404; }
    .type-sync_inventory { background: #e9ecef; color: #495057; }
    .type-maintenance_reminder { background: #f8d7da; color: #721c24; }
    .type-bulk_operation { background: #d1ecf1; color: #0c5460; }

    .retry-count {
      font-weight: 500;
    }

    .retry-warning {
      color: #856404;
      font-weight: bold;
    }

    .job-actions {
      display: flex;
      gap: 5px;
    }

    .action-btn {
      padding: 6px 8px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: opacity 0.2s;
    }

    .action-btn:hover {
      opacity: 0.8;
    }

    .retry-btn {
      background: #ffc107;
      color: #212529;
    }

    .cancel-btn {
      background: #dc3545;
      color: white;
    }

    .details-btn {
      background: #6c757d;
      color: white;
    }

    .no-jobs {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }

    .no-jobs-icon {
      font-size: 3rem;
      margin-bottom: 15px;
    }

    .no-jobs-text {
      font-size: 1.1rem;
    }

    /* Job Details Modal */
    .job-details-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      max-width: 800px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #eee;
    }

    .modal-header h3 {
      margin: 0;
      color: #333;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #666;
    }

    .close-btn:hover {
      color: #333;
    }

    .modal-body {
      padding: 20px;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .detail-item label {
      font-weight: 500;
      color: #555;
    }

    .detail-item span {
      color: #333;
    }

    .status-badge, .priority-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .job-data-section, .job-result-section, .job-error-section {
      margin-top: 20px;
    }

    .job-data-section h4, .job-result-section h4, .job-error-section h4 {
      margin-bottom: 10px;
      color: #333;
      font-size: 1.1rem;
    }

    .job-data, .job-result {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9rem;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 200px;
      overflow-y: auto;
    }

    .job-error {
      background: #f8d7da;
      color: #721c24;
      padding: 15px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9rem;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 200px;
      overflow-y: auto;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .filters-section {
        flex-direction: column;
        align-items: stretch;
      }

      .filter-group {
        justify-content: space-between;
      }

      .jobs-table {
        font-size: 0.9rem;
      }

      .jobs-table th,
      .jobs-table td {
        padding: 8px 10px;
      }

      .job-actions {
        flex-direction: column;
        gap: 2px;
      }

      .action-btn {
        padding: 4px 6px;
        font-size: 0.8rem;
      }

      .detail-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class JobMonitoringDashboardComponent implements OnInit, OnDestroy {
  private jobQueueService = inject(JobQueueService);
  private authService = inject(AuthService);
  private subscriptions: Subscription[] = [];

  // Signals
  jobs = this.jobQueueService.getJobs();
  jobStats = this.jobQueueService.getJobStats();
  filteredJobs = signal<Job[]>([]);
  selectedJob = signal<Job | null>(null);
  isLoading = signal(false);

  // Filter states
  statusFilter = '';
  typeFilter = '';
  priorityFilter = '';

  // Constants
  jobStatuses = Object.values(JobStatus);
  jobTypes = Object.values(JobType);
  jobPriorities = Object.values(JobPriority);

  ngOnInit() {
    this.loadData();
    this.applyFilters();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadData() {
    this.isLoading.set(true);

    // Data is loaded automatically by the service
    // Just wait a bit for real-time updates
    setTimeout(() => {
      this.isLoading.set(false);
      this.applyFilters();
    }, 1000);
  }

  refreshData() {
    this.loadData();
  }

  applyFilters() {
    const allJobs = this.jobs();
    let filtered = [...allJobs];

    if (this.statusFilter) {
      filtered = filtered.filter(job => job.status === this.statusFilter);
    }

    if (this.typeFilter) {
      filtered = filtered.filter(job => job.type === this.typeFilter);
    }

    if (this.priorityFilter) {
      filtered = filtered.filter(job => job.priority === this.priorityFilter);
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());

    this.filteredJobs.set(filtered);
  }

  get statsCards() {
    return signal(() => {
      const stats = this.jobStats();
      if (!stats) return [];

      return [
        {
          icon: '⏳',
          value: stats.pendingJobs,
          label: 'Pendientes'
        },
        {
          icon: '⚙️',
          value: stats.processingJobs,
          label: 'Procesando'
        },
        {
          icon: '✅',
          value: stats.completedJobs,
          label: 'Completados'
        },
        {
          icon: '❌',
          value: stats.failedJobs,
          label: 'Fallidos'
        },
        {
          icon: '📊',
          value: stats.averageProcessingTime.toFixed(0) + 'ms',
          label: 'Tiempo Promedio'
        },
        {
          icon: '🎯',
          value: stats.successRate.toFixed(1) + '%',
          label: 'Tasa de Éxito'
        }
      ];
    });
  }

  getStatusLabel(status: JobStatus): string {
    const labels = {
      [JobStatus.PENDING]: 'Pendiente',
      [JobStatus.PROCESSING]: 'Procesando',
      [JobStatus.COMPLETED]: 'Completado',
      [JobStatus.FAILED]: 'Fallido',
      [JobStatus.RETRYING]: 'Reintentando',
      [JobStatus.CANCELLED]: 'Cancelado'
    };
    return labels[status] || status;
  }

  getTypeLabel(type: JobType): string {
    const labels = {
      [JobType.CREATE_WORK_ORDER]: 'Crear Orden',
      [JobType.SEND_NOTIFICATION]: 'Enviar Notificación',
      [JobType.PROCESS_PAYMENT]: 'Procesar Pago',
      [JobType.GENERATE_REPORT]: 'Generar Reporte',
      [JobType.SYNC_INVENTORY]: 'Sincronizar Inventario',
      [JobType.MAINTENANCE_REMINDER]: 'Recordatorio Mantenimiento',
      [JobType.BULK_OPERATION]: 'Operación Masiva'
    };
    return labels[type] || type;
  }

  getPriorityLabel(priority: JobPriority): string {
    const labels = {
      [JobPriority.LOW]: 'Baja',
      [JobPriority.MEDIUM]: 'Media',
      [JobPriority.HIGH]: 'Alta',
      [JobPriority.URGENT]: 'Urgente'
    };
    return labels[priority] || priority;
  }

  getJobRowClass(job: Job): string {
    if (job.status === JobStatus.FAILED) return 'failed-job';
    if (job.status === JobStatus.RETRYING) return 'retrying-job';
    if (job.retryCount > 0) return 'retried-job';
    return '';
  }

  canRetry(job: Job): boolean {
    return job.status === JobStatus.FAILED && job.retryCount < job.maxRetries;
  }

  canCancel(job: Job): boolean {
    return job.status === JobStatus.PENDING || job.status === JobStatus.RETRYING;
  }

  async retryJob(jobId: string) {
    try {
      await this.jobQueueService.retryJob(jobId);
      // Success feedback could be added here
    } catch (error) {
      console.error('Error retrying job:', error);
      // Error feedback could be added here
    }
  }

  async cancelJob(jobId: string) {
    try {
      await this.jobQueueService.updateJobStatus(jobId, JobStatus.CANCELLED);
      // Success feedback could be added here
    } catch (error) {
      console.error('Error cancelling job:', error);
      // Error feedback could be added here
    }
  }

  showJobDetails(job: Job) {
    this.selectedJob.set(job);
  }

  closeJobDetails() {
    this.selectedJob.set(null);
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '-';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '-';
    }
  }
}