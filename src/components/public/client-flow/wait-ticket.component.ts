/**
 * Wait Ticket Component - Step 4 of Client Flow
 *
 * Displays the queue ticket information and provides options for the user.
 * Features:
 * - Queue position and verification code display
 * - QR code for verification
 * - Estimated wait time
 * - Real-time queue updates
 * - Download QR code option
 * - Exit options
 */

import { ChangeDetectionStrategy, Component, inject, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ClientFlowService } from '../../../services/client-flow.service';
import { QueueService } from '../../../services/queue.service';
import { NotificationService } from '../../../services/notification.service';
import { QueueEntry } from '../../../models';

@Component({
  selector: 'app-wait-ticket',
  templateUrl: './wait-ticket.component.html',
  styleUrls: ['./wait-ticket.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule]
})
export class WaitTicketComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private flowService = inject(ClientFlowService);
  private queueService = inject(QueueService);
  private notificationService = inject(NotificationService);

  // Flow state
  readonly flowState = this.flowService.flowState;

  // Queue entry details
  readonly queueEntry = computed(() => this.flowState().queueEntry);
  readonly ticketNumber = computed(() => {
    const entry = this.queueEntry();
    return entry ? `Q${entry.position.toString().padStart(3, '0')}` : '';
  });

  readonly verificationCode = computed(() => {
    const entry = this.queueEntry();
    return entry?.verificationCode || '';
  });

  readonly estimatedWaitTime = computed(() => {
    const entry = this.queueEntry();
    return entry?.estimatedWaitTime || 0;
  });

  readonly qrCodeDataUrl = computed(() => {
    const entry = this.queueEntry();
    return entry?.qrCodeDataUrl || '';
  });

  // Computed display values
  readonly formattedWaitTime = computed(() => {
    const minutes = this.estimatedWaitTime();
    if (minutes < 60) {
      return `${minutes} minutos`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  });

  readonly serviceSummary = computed(() => {
    const flow = this.flowState();
    const motorcycle = flow.selectedMotorcycle;
    const service = flow.selectedService;

    return {
      motorcycle: motorcycle ? `${motorcycle.brand} ${motorcycle.model}` : 'No especificada',
      service: service?.title || 'No especificado',
      plate: flow.licensePlate || 'No especificada',
      mileage: flow.currentMileage ? `${flow.currentMileage.toLocaleString()} km` : 'No especificado'
    };
  });

  // Real-time updates
  private updateInterval: any;

  ngOnInit(): void {
    this.startRealTimeUpdates();
  }

  ngOnDestroy(): void {
    this.stopRealTimeUpdates();
  }

  private startRealTimeUpdates(): void {
    // Update queue status every 30 seconds
    this.updateInterval = setInterval(() => {
      this.queueService.refreshQueueData();
    }, 30000);
  }

  private stopRealTimeUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  onDownloadQRCode(): void {
    const qrCodeUrl = this.qrCodeDataUrl();
    if (!qrCodeUrl) return;

    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `ticket-qr-${this.ticketNumber()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  onShareTicket(): void {
    const ticketInfo = `¡Hola! Mi turno en Blue Dragon Motors es ${this.ticketNumber()}. Código: ${this.verificationCode()}`;

    if (navigator.share) {
      navigator.share({
        title: 'Mi turno en Blue Dragon Motors',
        text: ticketInfo,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(ticketInfo).then(() => {
        alert('Información del turno copiada al portapapeles');
      });
    }
  }

  onGoHome(): void {
    // Clear the flow and navigate home
    this.flowService.resetFlow();
    this.router.navigate(['/']);
  }

  onStartNewRequest(): void {
    // Reset flow and start over
    this.flowService.resetFlow();
    // Flow will automatically go to first step
  }

  onViewQueueStatus(): void {
    // Could navigate to a queue status page or show modal
    // For now, just refresh the data
    this.queueService.refreshQueueData();
  }

  // Template helpers
  getTicketIcon(): string {
    return '🎫';
  }

  getStatusMessage(): string {
    const entry = this.queueEntry();
    if (!entry) return 'Procesando...';

    switch (entry.status) {
      case 'waiting':
        return 'Esperando ser atendido';
      case 'called':
        return '¡Es su turno! Presente el código de verificación';
      case 'served':
        return 'Servicio completado';
      case 'cancelled':
        return 'Turno cancelado';
      case 'no_show':
        return 'No se presentó';
      default:
        return 'Estado desconocido';
    }
  }

  getStatusColor(): string {
    const entry = this.queueEntry();
    if (!entry) return '#7f8c8d';

    switch (entry.status) {
      case 'waiting':
        return '#f39c12';
      case 'called':
        return '#27ae60';
      case 'served':
        return '#3498db';
      case 'cancelled':
        return '#e74c3c';
      case 'no_show':
        return '#95a5a6';
      default:
        return '#7f8c8d';
    }
  }

  isUrgent(): boolean {
    const waitTime = this.estimatedWaitTime();
    return waitTime > 120; // More than 2 hours
  }

  formatPosition(position: number): string {
    return position.toString().padStart(3, '0');
  }

  formatVerificationCode(code: string): string {
    // Format as XXX-XXX if 6 digits
    if (code.length === 6) {
      return `${code.slice(0, 3)}-${code.slice(3)}`;
    }
    return code;
  }
}