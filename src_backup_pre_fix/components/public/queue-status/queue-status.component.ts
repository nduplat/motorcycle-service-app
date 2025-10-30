/**
 * Queue Status Component - Real-time Queue Tracking
 *
 * Allows customers to track their queue position in real-time without being logged in.
 * Provides comprehensive queue status information, QR code regeneration, and service history.
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { QueueService } from '../../../services/queue.service';
import { QueueEntry, QueueStatus as QueueStatusModel } from '../../../models';
import { QrCodeService } from '../../../services/qr-code.service';
import { ToastService } from '../../../services/toast.service';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase.config';

interface ServiceHistory {
  id: string;
  serviceType: string;
  status: string;
  createdAt: Date;
  completedAt?: Date;
  technicianName?: string;
  rating?: number;
  feedback?: string;
}

interface FeedbackData {
  rating: number;
  comment: string;
}

@Component({
  selector: 'app-queue-status',
  templateUrl: './queue-status.component.html',
  styleUrls: ['./queue-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class QueueStatusComponent implements OnInit, OnDestroy {
  // ========== SERVICES ==========
  private queueService = inject(QueueService);
  private qrCodeService = inject(QrCodeService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  // ========== COMPONENT STATE ==========
  searchInput = signal<string>('');
  isSearching = signal(false);
  searchError = signal<string | null>(null);

  // Current queue entry data
  currentEntry = signal<QueueEntry | null>(null);
  queueStatus = signal<QueueStatusModel | null>(null);
  serviceHistory = signal<ServiceHistory[]>([]);

  // Real-time listeners
  private entryUnsubscribe: (() => void) | null = null;
  private statusUnsubscribe: (() => void) | null = null;
  private historyUnsubscribe: (() => void) | null = null;

  // Feedback system
  showFeedbackForm = signal(false);
  feedbackData = signal<FeedbackData>({ rating: 0, comment: '' });
  isSubmittingFeedback = signal(false);

  // QR Code regeneration
  isRegeneratingQR = signal(false);

  // ========== COMPUTED PROPERTIES ==========
  hasActiveEntry = computed(() => {
    const entry = this.currentEntry();
    return entry && ['waiting', 'called'].includes(entry.status);
  });

  hasCompletedEntry = computed(() => {
    const entry = this.currentEntry();
    return entry && ['served', 'cancelled', 'no_show'].includes(entry.status);
  });

  canLeaveFeedback = computed(() => {
    const entry = this.currentEntry();
    return entry && entry.status === 'served' && !this.hasFeedback();
  });

  hasFeedback = computed(() => {
    const entry = this.currentEntry();
    return entry && entry.status === 'served' && this.serviceHistory().some(h => h.id === entry.id && h.rating);
  });

  estimatedWaitTime = computed(() => {
    const entry = this.currentEntry();
    const status = this.queueStatus();
    if (!entry || !status) return null;

    if (entry.estimatedWaitTime) {
      return Math.ceil(entry.estimatedWaitTime / 60); // Convert to minutes
    }

    // Fallback calculation based on position
    const avgWaitTime = status.averageWaitTime || 15; // Default 15 minutes
    return entry.position * avgWaitTime;
  });

  queuePosition = computed(() => {
    const entry = this.currentEntry();
    return entry?.position || 0;
  });

  technicianName = computed(() => {
    const entry = this.currentEntry();
    if (!entry?.assignedTo) return null;

    // In a real implementation, you'd fetch technician name from user service
    // For now, return a placeholder
    return 'Técnico asignado';
  });

  // ========== LIFECYCLE METHODS ==========
  ngOnInit() {
    // Check for URL parameters (direct link sharing)
    const urlParams = new URLSearchParams(window.location.search);
    const queueId = urlParams.get('id');
    const plate = urlParams.get('plate');

    if (queueId) {
      this.searchInput.set(queueId);
      this.searchQueueEntry();
    } else if (plate) {
      this.searchInput.set(plate);
      this.searchQueueEntry();
    }

    // Load global queue status
    this.loadQueueStatus();
  }

  ngOnDestroy() {
    this.cleanupListeners();
  }

  // ========== SEARCH FUNCTIONALITY ==========
  async searchQueueEntry() {
    const searchTerm = this.searchInput().trim();
    if (!searchTerm) {
      this.searchError.set('Por favor ingresa un ID de cola o placa');
      return;
    }

    this.isSearching.set(true);
    this.searchError.set(null);
    this.currentEntry.set(null);
    this.cleanupListeners();

    try {
      let entry: QueueEntry | null = null;

      // Try searching by queue entry ID first
      if (searchTerm.startsWith('Q') || /^\d+$/.test(searchTerm)) {
        entry = await this.searchByQueueId(searchTerm);
      }

      // If not found, try searching by verification code
      if (!entry && searchTerm.length === 4) {
        entry = await this.searchByVerificationCode(searchTerm);
      }

      // If still not found, try searching by plate number
      if (!entry) {
        entry = await this.searchByPlate(searchTerm);
      }

      if (entry) {
        this.currentEntry.set(entry);
        this.loadServiceHistory(entry.customerId);
        this.setupRealTimeListeners(entry.id);
        this.toastService.success('Entrada encontrada exitosamente');
      } else {
        this.searchError.set('No se encontró ninguna entrada activa con ese ID, código o placa');
      }
    } catch (error) {
      console.error('Search error:', error);
      this.searchError.set('Error al buscar la entrada. Intenta de nuevo.');
    } finally {
      this.isSearching.set(false);
    }
  }

  private async searchByQueueId(searchTerm: string): Promise<QueueEntry | null> {
    try {
      // Remove 'Q' prefix if present and pad with zeros
      const cleanId = searchTerm.replace(/^Q/i, '').padStart(3, '0');

      // Query for entries with this position (this is a simplified approach)
      // In a real implementation, you'd need to map position to entry ID
      const entriesRef = collection(db, 'queueEntries');
      const q = query(entriesRef, where('status', 'in', ['waiting', 'called']), orderBy('position'));
      const snapshot = await getDocs(q);

      for (const doc of snapshot.docs) {
        const entry = { ...doc.data(), id: doc.id } as QueueEntry;
        if (entry.position.toString().padStart(3, '0') === cleanId) {
          return entry;
        }
      }
    } catch (error) {
      console.error('Error searching by queue ID:', error);
    }
    return null;
  }

  private async searchByVerificationCode(code: string): Promise<QueueEntry | null> {
    try {
      const entriesRef = collection(db, 'queueEntries');
      const q = query(entriesRef, where('verificationCode', '==', code), where('status', 'in', ['waiting', 'called']));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as QueueEntry;
      }
    } catch (error) {
      console.error('Error searching by verification code:', error);
    }
    return null;
  }

  private async searchByPlate(plate: string): Promise<QueueEntry | null> {
    try {
      // First find user vehicles with this plate
      const userVehiclesRef = collection(db, 'userVehicles');
      const vehicleQuery = query(userVehiclesRef, where('plate', '==', plate.toUpperCase()));
      const vehicleSnapshot = await getDocs(vehicleQuery);

      if (!vehicleSnapshot.empty) {
        const userId = vehicleSnapshot.docs[0].data()['userId'];

        // Now find active queue entries for this user
        const entriesRef = collection(db, 'queueEntries');
        const entryQuery = query(entriesRef, where('customerId', '==', userId), where('status', 'in', ['waiting', 'called']));
        const entrySnapshot = await getDocs(entryQuery);

        if (!entrySnapshot.empty) {
          return { ...entrySnapshot.docs[0].data(), id: entrySnapshot.docs[0].id } as QueueEntry;
        }
      }
    } catch (error) {
      console.error('Error searching by plate:', error);
    }
    return null;
  }

  getHistoryIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'waiting': 'fa-clock',
      'called': 'fa-bell',
      'in_service': 'fa-wrench',
      'served': 'fa-check-circle',
      'cancelled': 'fa-times-circle',
      'no_show': 'fa-user-slash'
    };
    return iconMap[status] || 'fa-question-circle';
  }

  // ========== REAL-TIME LISTENERS ==========
  private setupRealTimeListeners(entryId: string) {
    // Listen to specific queue entry changes
    this.entryUnsubscribe = onSnapshot(doc(db, 'queueEntries', entryId), (doc) => {
      if (doc.exists()) {
        const entry = { ...doc.data(), id: doc.id } as QueueEntry;
        this.currentEntry.set(entry);

        // If entry was completed, refresh history
        if (['served', 'cancelled', 'no_show'].includes(entry.status)) {
          this.loadServiceHistory(entry.customerId);
        }
      } else {
        // Entry was deleted
        this.currentEntry.set(null);
        this.toastService.info('Esta entrada ya no está disponible');
      }
    });
  }

  private loadQueueStatus() {
    this.statusUnsubscribe = onSnapshot(doc(db, 'queueStatus', 'singleton'), (doc) => {
      if (doc.exists()) {
        this.queueStatus.set({ ...doc.data(), id: 'singleton' } as QueueStatusModel);
      }
    });
  }

  private async loadServiceHistory(customerId: string) {
    try {
      const entriesRef = collection(db, 'queueEntries');
      const q = query(
        entriesRef,
        where('customerId', '==', customerId),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      this.historyUnsubscribe = onSnapshot(q, (snapshot) => {
        const history: ServiceHistory[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            serviceType: data['serviceType'] || 'Servicio',
            status: data['status'] || 'unknown',
            createdAt: data['createdAt']?.toDate() || new Date(),
            completedAt: data['updatedAt']?.toDate(),
            technicianName: data['assignedTo'] ? 'Técnico asignado' : undefined,
            rating: data['rating'],
            feedback: data['feedback']
          };
        });
        this.serviceHistory.set(history);
      });
    } catch (error) {
      console.error('Error loading service history:', error);
    }
  }

  private cleanupListeners() {
    if (this.entryUnsubscribe) {
      this.entryUnsubscribe();
      this.entryUnsubscribe = null;
    }
    if (this.statusUnsubscribe) {
      this.statusUnsubscribe();
      this.statusUnsubscribe = null;
    }
    if (this.historyUnsubscribe) {
      this.historyUnsubscribe();
      this.historyUnsubscribe = null;
    }
  }

  // ========== QR CODE FUNCTIONALITY ==========
  async regenerateQRCode() {
    const entry = this.currentEntry();
    if (!entry) return;

    this.isRegeneratingQR.set(true);
    try {
      const qrCodeDataUrl = this.qrCodeService.generateQrCodeDataUrl('queue-entry', entry.id);

      // Update the entry with new QR code
      await this.queueService.updateQueueEntry({
        ...entry,
        qrCodeDataUrl,
        updatedAt: new Date()
      });

      this.toastService.success('Código QR regenerado exitosamente');
    } catch (error) {
      console.error('Error regenerating QR code:', error);
      this.toastService.error('Error al regenerar el código QR');
    } finally {
      this.isRegeneratingQR.set(false);
    }
  }

  downloadQRCode() {
    const entry = this.currentEntry();
    if (!entry?.qrCodeDataUrl) return;

    const link = document.createElement('a');
    link.href = entry.qrCodeDataUrl;
    link.download = `queue-qr-${entry.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  shareQueueLink() {
    const entry = this.currentEntry();
    if (!entry) return;

    const shareUrl = `${window.location.origin}/queue-status?id=${entry.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      this.toastService.success('Enlace copiado al portapapeles');
    }).catch(() => {
      this.toastService.error('Error al copiar el enlace');
    });
  }

  // ========== FEEDBACK SYSTEM ==========
  openFeedbackForm() {
    this.showFeedbackForm.set(true);
    this.feedbackData.set({ rating: 0, comment: '' });
  }

  closeFeedbackForm() {
    this.showFeedbackForm.set(false);
    this.feedbackData.set({ rating: 0, comment: '' });
  }

  setRating(rating: number) {
    this.feedbackData.update(data => ({ ...data, rating }));
  }

  async submitFeedback() {
    const entry = this.currentEntry();
    const feedback = this.feedbackData();

    if (!entry || !feedback.rating) {
      this.toastService.error('Por favor selecciona una calificación');
      return;
    }

    this.isSubmittingFeedback.set(true);
    try {
      // For now, we'll just show success since feedback collection needs to be implemented
      // In a real implementation, you'd create a feedback document in a separate collection
      console.log('Feedback submitted:', { entryId: entry.id, rating: feedback.rating, comment: feedback.comment });

      this.toastService.success('¡Gracias por tu feedback!');
      this.closeFeedbackForm();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      this.toastService.error('Error al enviar el feedback');
    } finally {
      this.isSubmittingFeedback.set(false);
    }
  }

  // ========== UTILITY METHODS ==========
  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'waiting': 'Esperando',
      'called': 'Llamado',
      'in_service': 'En servicio',
      'served': 'Completado',
      'cancelled': 'Cancelado',
      'no_show': 'No se presentó'
    };
    return statusMap[status] || status;
  }

  getStatusColor(status: string): string {
    const colorMap: { [key: string]: string } = {
      'waiting': 'text-blue-600',
      'called': 'text-orange-600',
      'in_service': 'text-purple-600',
      'served': 'text-green-600',
      'cancelled': 'text-red-600',
      'no_show': 'text-gray-600'
    };
    return colorMap[status] || 'text-gray-600';
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatWaitTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  }

  goBack() {
    this.router.navigate(['/']);
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.searchQueueEntry();
    }
  }
}