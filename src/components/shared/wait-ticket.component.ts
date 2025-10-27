import { ChangeDetectionStrategy, Component, inject, input, output, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { QueueEntry, ServiceItem } from '../../models';
import { QrCodeService } from '../../services/qr-code.service';
import { QueueService } from '../../services/queue.service';
import { interval, Subscription } from 'rxjs';

export interface WaitTicketData {
  queueEntry: QueueEntry;
  selectedServices: ServiceItem[];
  totalCost: number;
  estimatedTime?: number;
}

@Component({
  selector: 'app-wait-ticket',
  templateUrl: './wait-ticket.component.html',
  styleUrls: ['./wait-ticket.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class WaitTicketComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private qrCodeService = inject(QrCodeService);
  private queueService = inject(QueueService);

  // Input properties
  ticketData = input.required<WaitTicketData>();
  showNavigation = input(true);

  // Output events
  backToTracking = output<void>();

  // State management
  isLoading = signal(false);
  error = signal<string | null>(null);
  qrCodeDataUrl = signal<string>('');
  currentTime = signal(new Date());

  // Computed properties
  queuePosition = computed(() => this.ticketData().queueEntry.position);
  estimatedWaitTime = computed(() => this.ticketData().queueEntry.estimatedWaitTime || 0);
  verificationCode = computed(() => this.ticketData().queueEntry.verificationCode || '');
  assignedTechnician = computed(() => this.ticketData().queueEntry.assignedTo);
  queueStatus = computed(() => this.ticketData().queueEntry.status);

  // Real-time updates subscription
  private updateSubscription?: Subscription;

  ngOnInit() {
    this.generateQRCode();
    this.startRealTimeUpdates();
  }

  ngOnDestroy() {
    this.updateSubscription?.unsubscribe();
  }

  private generateQRCode() {
    try {
      const queueEntry = this.ticketData().queueEntry;
      const qrData = {
        type: 'queue_tracking',
        entryId: queueEntry.id,
        verificationCode: queueEntry.verificationCode,
        customerId: queueEntry.customerId,
        position: queueEntry.position,
        timestamp: new Date().toISOString()
      };

      const qrString = JSON.stringify(qrData);
      const dataUrl = this.qrCodeService.generateQrCodeDataUrl('queue-tracking', queueEntry.id);
      this.qrCodeDataUrl.set(dataUrl);
    } catch (err: any) {
      this.error.set('Error generando código QR: ' + err.message);
    }
  }

  private startRealTimeUpdates() {
    // Update current time every minute for display purposes
    this.updateSubscription = interval(60000).subscribe(() => {
      this.currentTime.set(new Date());
      this.refreshQueueStatus();
    });
  }

  private async refreshQueueStatus() {
    try {
      const entryId = this.ticketData().queueEntry.id;
      const updatedEntry = await this.queueService.getQueueEntry(entryId).toPromise();

      if (updatedEntry) {
        // Update the ticket data with fresh information
        const currentData = this.ticketData();
        currentData.queueEntry = updatedEntry;
        // Note: In a real implementation, you'd need to emit this back to parent
        // For now, we'll just update local state
      }
    } catch (err: any) {
      console.error('Error refreshing queue status:', err);
    }
  }

  // Action handlers
  saveToWallet() {
    // Implement save to digital wallet functionality
    // This would typically use Web Share API or generate a pass file
    if (navigator.share) {
      navigator.share({
        title: 'Blue Dragon Motors - Ticket de Cola',
        text: `Posición #${this.queuePosition()} - Código: ${this.verificationCode()}`,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard or download
      this.copyToClipboard();
    }
  }

  shareTicket() {
    const shareData = {
      title: 'Mi Ticket de Cola - Blue Dragon Motors',
      text: `Estoy en la posición #${this.queuePosition()} de la cola. Código de verificación: ${this.verificationCode()}`,
      url: window.location.href
    };

    if (navigator.share) {
      navigator.share(shareData);
    } else {
      // Fallback: copy text to clipboard
      navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
      // You might want to show a toast notification here
    }
  }

  private copyToClipboard() {
    const text = `Blue Dragon Motors - Ticket de Cola
Posición: #${this.queuePosition()}
Código de Verificación: ${this.verificationCode()}
Tiempo Estimado: ${this.estimatedWaitTime()} minutos`;

    navigator.clipboard.writeText(text);
    // Show success message (would need toast service)
  }

  downloadQR() {
    // Create download link for QR code
    const link = document.createElement('a');
    link.href = this.qrCodeDataUrl();
    link.download = `queue-ticket-${this.verificationCode()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  navigateBack() {
    this.backToTracking.emit();
  }

  goToQueueTracking() {
    this.router.navigate(['/queue-tracking'], {
      queryParams: { entryId: this.ticketData().queueEntry.id }
    });
  }

  // Utility methods
  formatWaitTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  }

  getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'waiting': 'Esperando',
      'called': 'Llamado',
      'in_service': 'En Servicio',
      'served': 'Atendido',
      'cancelled': 'Cancelado',
      'no_show': 'No Presentado'
    };
    return statusMap[status] || status;
  }

  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      'waiting': 'status-waiting',
      'called': 'status-called',
      'in_service': 'status-in-service',
      'served': 'status-served',
      'cancelled': 'status-cancelled',
      'no_show': 'status-no-show'
    };
    return colorMap[status] || 'status-default';
  }
}