/**
 * Admin Queue Management Component - Digiturno System
 *
 * USAGE:
 * - View current queue status and waiting customers
 * - Call next customer in queue with notification
 * - Mark customers as served when service is complete
 * - Cancel entries or mark as no-show if needed
 * - Monitor queue statistics and average wait times
 *
 * TESTING:
 * 1. Login as admin and navigate to /admin/queue
 * 2. Verify queue status display (open/closed, count, avg wait)
 * 3. Add test entries via /queue/join
 * 4. Test "Call Next" button - should update entry status and send notification
 * 5. Test "Mark as Served" on called entries
 * 6. Test "Cancel" and "No Show" actions with confirmations
 * 7. Verify real-time updates when entries change
 */

import { lastValueFrom } from 'rxjs';
import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QueueService } from '../../../services/queue.service';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { WorkshopCapacityService } from '../../../services/workshop-capacity.service';
import { EmployeeScheduleService } from '../../../services/employee-schedule.service';
// import { GroqService, GroqMessage } from '../../../services/groq.service'; // REMOVED: AI services eliminated for cost savings
import { QueueEntry, UserProfile, User } from '../../../models';
import { toDate } from '../../../models/types';
import { serverTimestamp } from 'firebase/firestore';
import { PaginationComponent, PaginationMeta } from '../../shared/ui/pagination.component';
import { CodeValidationComponent } from '../code-validation.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-queue-management',
  templateUrl: './queue-management.component.html',
  styleUrls: ['./queue-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent, CodeValidationComponent],
})
export class QueueManagementComponent implements OnInit {
  private queueService = inject(QueueService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private workshopCapacityService = inject(WorkshopCapacityService);
  private employeeScheduleService = inject(EmployeeScheduleService);
  // private groqService = inject(GroqService); // REMOVED: AI services eliminated for cost savings
  private router = inject(Router);

  queueEntries = this.queueService.getQueueEntries();
  queueStatus = this.queueService.getQueueStatus();

  constructor() {
    // Watch for queue entries changes
  }
  isCalling = signal(false);
  isProcessingAutoAssignment = signal(false);
  activeTab = signal<'current' | 'history' | 'settings'>('current');
  selectedEntry = signal<QueueEntry | null>(null);
  showEntryDetails = signal(false);
  operatingHours = signal<any>(null);
  isUpdatingHours = signal(false);
  isUpdatingStatus = signal(false);
  isClearingQueue = signal(false);
  isAutoAssigning = signal(false);
  isCalculatingWaitTimes = signal(false);

  // New features state
  availableTechnicians = signal<User[]>([]);
  waitTimeEstimations = signal<Map<string, number>>(new Map());
  isPrioritizing = signal(false);

  // AI Assistant state - REMOVED: AI services eliminated for cost savings
  showAI = signal(false);
  // aiMessages = signal<GroqMessage[]>([
  //   { role: 'assistant', content: '¡Hola! Soy tu asistente de IA. ¿Cómo puedo ayudarte con la gestión de la cola?' }
  // ]);
  aiMessages = signal<any[]>([
    { role: 'assistant', content: 'Asistente IA no disponible - servicios eliminados por ahorro de costos.' }
  ]);
  aiInput = signal('');
  isAILoading = signal(false);

  // Search and mobile state
  searchTerm = signal('');
  mobileMenuOpen = signal(false);

  // Pagination state
  currentPage = signal(1);
  pageSize = signal(10);

  async ngOnInit() {
    await this.loadAvailableTechnicians();
    await this.calculateWaitTimes();
  }
  async callNext() {
    this.isCalling.set(true);
    try {
      const currentUser = this.authService.currentUser();
      if (!currentUser) {
        return;
      }

      const calledEntry = await this.queueService.callNext(currentUser.id);

      if (calledEntry && calledEntry.workOrderId) {
        this.router.navigate(['/admin/work-orders', calledEntry.workOrderId]);
      }
    } catch (error) {
      // Error handled silently or through service
    } finally {
      this.isCalling.set(false);
    }
  }

  async serveEntry(entryId: string) {
    try {
      await this.queueService.serveEntry(entryId);
    } catch (error) {
      // Error handled silently
    }
  }

  async cancelEntry(entryId: string) {
    if (confirm('¿Estás seguro de cancelar esta entrada de cola?')) {
      try {
        await this.queueService.cancelEntry(entryId);
      } catch (error) {
        // Error handled silently
      }
    }
  }

  async markNoShow(entryId: string) {
    if (confirm('¿Marcar este cliente como "No se presentó"?')) {
      try {
        const entry = this.queueEntries().find(e => e.id === entryId);
        if (entry) {
          const updatedEntry = { ...entry, status: 'no_show' as const, updatedAt: serverTimestamp() as any };
          await this.queueService.updateQueueEntry(updatedEntry);
        }
      } catch (error) {
        // Error handled silently
      }
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'waiting': return 'Esperando';
      case 'called': return 'Llamado';
      case 'served': return 'Atendido';
      case 'cancelled': return 'Cancelado';
      case 'no_show': return 'No se presentó';
      default: return status;
    }
  }

  getAssignedTechnicianName(entry: QueueEntry): string {
    if (!entry.assignedTo) return 'No asignado';
    const technician = this.userService.getUserById(entry.assignedTo);
    return technician ? technician.name : 'Técnico desconocido';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'waiting': return 'status-waiting';
      case 'called': return 'status-called';
      case 'served': return 'status-served';
      case 'cancelled': return 'status-cancelled';
      case 'no_show': return 'status-no-show';
      default: return '';
    }
  }

  setActiveTab(tab: 'current' | 'history' | 'settings') {
    this.activeTab.set(tab);
    if (tab === 'settings') {
      this.loadOperatingHours();
    }
  }

  viewEntryDetails(entry: QueueEntry) {
    this.selectedEntry.set(entry);
    this.showEntryDetails.set(true);
  }

  closeEntryDetails() {
    this.showEntryDetails.set(false);
    this.selectedEntry.set(null);
  }

  private loadOperatingHours() {
    const hours = this.queueService.getOperatingHours();
    this.operatingHours.set(hours || {
      monday: { open: '07:00', close: '17:30', enabled: true },
      tuesday: { open: '07:00', close: '17:30', enabled: true },
      wednesday: { open: '07:00', close: '17:30', enabled: true },
      thursday: { open: '07:00', close: '17:30', enabled: true },
      friday: { open: '07:00', close: '17:30', enabled: true },
      saturday: { open: '07:00', close: '17:30', enabled: true },
      sunday: { open: '07:00', close: '17:30', enabled: false }
    });
  }

  async updateOperatingHours() {
    this.isUpdatingHours.set(true);
    try {
      await this.queueService.updateOperatingHours(this.operatingHours());
    } catch (error) {
      // Error handled silently
    } finally {
      this.isUpdatingHours.set(false);
    }
  }

  async toggleQueueStatus() {
    this.isUpdatingStatus.set(true);
    try {
      await this.queueService.toggleQueueStatus();
    } catch (error) {
      // Error handled silently
    } finally {
      this.isUpdatingStatus.set(false);
    }
  }

  async clearQueue() {
    if (confirm('¿Estás seguro de limpiar toda la cola? Esto eliminará todas las entradas activas (esperando y llamadas).')) {
      this.isClearingQueue.set(true);
      try {
        await this.queueService.clearQueue();
        // Reset pagination to first page
        this.currentPage.set(1);
      } catch (error) {
        // Error handled silently
      } finally {
        this.isClearingQueue.set(false);
      }
    }
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
  }

  onPageSizeChange(pageSize: number) {
    this.pageSize.set(pageSize);
    this.currentPage.set(1); // Reset to first page when page size changes
  }

  getDayName(day: string): string {
    const dayNames: { [key: string]: string } = {
      monday: 'Lunes',
      tuesday: 'Martes',
      wednesday: 'Miércoles',
      thursday: 'Jueves',
      friday: 'Viernes',
      saturday: 'Sábado',
      sunday: 'Domingo'
    };
    return dayNames[day] || day;
  }

  // Computed signals for filtering entries
  allCurrentEntries = computed(() => {
    return this.queueEntries().filter(entry =>
      entry.status === 'waiting' || entry.status === 'called'
    );
  });

  currentEntries = computed(() => {
    const allEntries = this.allCurrentEntries();
    const page = this.currentPage();
    const size = this.pageSize();
    const startIndex = (page - 1) * size;
    const endIndex = startIndex + size;
    return allEntries.slice(startIndex, endIndex);
  });

  paginationMeta = computed((): PaginationMeta => {
    const totalItems = this.allCurrentEntries().length;
    const currentPage = this.currentPage();
    const pageSize = this.pageSize();
    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      currentPage,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      startIndex: totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1,
      endIndex: Math.min(currentPage * pageSize, totalItems)
    };
  });

  historyEntries = computed(() => {
    return this.queueEntries().filter(entry =>
      entry.status === 'served' || entry.status === 'cancelled' || entry.status === 'no_show'
    ).sort((a, b) => toDate(b.updatedAt).getTime() - toDate(a.updatedAt).getTime());
  });

  // Critical alerts system (reused from AdminDashboardComponent)
  longWaitAlert = computed(() => {
    const now = new Date();
    const waitingEntries = this.queueEntries().filter(entry => entry.status === 'waiting');

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
    const activeEntries = this.queueEntries().filter(
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

  // Quick metrics for dashboard
  waitingCount = computed(() =>
    this.queueEntries().filter(entry => entry.status === 'waiting').length
  );

  calledCount = computed(() =>
    this.queueEntries().filter(entry => entry.status === 'called').length
  );

  avgWaitTime = computed(() => {
    const queueStatus = this.queueStatus();
    return queueStatus?.averageWaitTime || 0;
  });

  availableTechniciansCount = computed(() => {
    return this.availableTechnicians().length;
  });

  // New feature methods

  async loadAvailableTechnicians() {
    try {
      const today = new Date();
      const technicians = await this.employeeScheduleService.getEmployeesAvailableForService(today);
      this.availableTechnicians.set(technicians);
    } catch (error) {
      // Error handled silently
    }
  }

  async calculateWaitTimes() {
    this.isCalculatingWaitTimes.set(true);
    try {
      const currentEntries = this.allCurrentEntries();
      const newEstimations = new Map<string, number>();

      for (const entry of currentEntries) {
        try {
          // Calculate wait time based on position and current capacity
          const position = entry.position;
          const capacity = await lastValueFrom(this.workshopCapacityService.calculateCurrentCapacity());

          // Simple estimation: position * average service time / available technicians
          const avgServiceTime = 30; // minutes
          const estimatedWait = Math.max(0, (position - 1) * avgServiceTime / Math.max(1, capacity.availableTechnicians));

          newEstimations.set(entry.id, Math.round(estimatedWait));
        } catch (error) {
          newEstimations.set(entry.id, 0);
        }
      }

      this.waitTimeEstimations.set(newEstimations);
    } catch (error) {
      // Error handled silently
    } finally {
      this.isCalculatingWaitTimes.set(false);
    }
  }

  async autoAssignFromQueue() {
    this.isAutoAssigning.set(true);
    try {
      const waitingEntries = this.queueEntries().filter(entry => entry.status === 'waiting');
      const availableTechnicians = await this.employeeScheduleService.getEmployeesAvailableForService(new Date());

      if (availableTechnicians.length === 0) {
        return;
      }

      let technicianIndex = 0;
      for (const entry of waitingEntries) {
        try {
          // Assign to next available technician in round-robin fashion
          const technician = availableTechnicians[technicianIndex % availableTechnicians.length];
          technicianIndex++;

          // Assign the technician to the queue entry
          const updatedEntry = { ...entry, assignedTo: technician.id, updatedAt: serverTimestamp() as any };
          await this.queueService.updateQueueEntry(updatedEntry);
        } catch (error) {
          // Error handled silently
        }
      }
    } catch (error) {
      // Error handled silently
    } finally {
      this.isAutoAssigning.set(false);
    }
  }

  async prioritizeQueue() {
    this.isPrioritizing.set(true);
    try {
      const entries = [...this.queueEntries().filter(entry => entry.status === 'waiting')];

      // Sort by priority: emergency first, then by wait time, then by join time
      entries.sort((a, b) => {
        // Priority based on service type (emergency > appointment > immediate)
        const priorityOrder = { 'emergency': 3, 'appointment': 2, 'immediate': 1 };
        const aPriority = priorityOrder[a.serviceType as keyof typeof priorityOrder] || 1;
        const bPriority = priorityOrder[b.serviceType as keyof typeof priorityOrder] || 1;

        if (aPriority !== bPriority) return bPriority - aPriority;

        // Then by wait time (longer wait = higher priority)
        const aWait = this.waitTimeEstimations().get(a.id) || 0;
        const bWait = this.waitTimeEstimations().get(b.id) || 0;
        if (aWait !== bWait) return bWait - aWait;

        // Finally by join time (FIFO)
        return toDate(a.joinedAt).getTime() - toDate(b.joinedAt).getTime();
      });

      // Update positions
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const newPosition = i + 1;
        if (entry.position !== newPosition) {
          const updatedEntry = { ...entry, position: newPosition, updatedAt: serverTimestamp() as any };
          await this.queueService.updateQueueEntry(updatedEntry);
        }
      }
    } catch (error) {
      // Error handled silently
    } finally {
      this.isPrioritizing.set(false);
    }
  }

  getEstimatedWaitTime(entryId: string): number {
    return this.waitTimeEstimations().get(entryId) || 0;
  }

  getPriorityLevel(entry: QueueEntry): string {
    const waitTime = this.getEstimatedWaitTime(entry.id);
    if (waitTime > 60) return 'high';
    if (waitTime > 30) return 'medium';
    return 'low';
  }

  // New computed signals for search and filtering
  filteredCurrentEntries = computed(() => {
    const entries = this.allCurrentEntries();
    const search = this.searchTerm().toLowerCase();

    if (!search) return entries;

    return entries.filter(entry =>
      entry.customerId?.toLowerCase().includes(search) ||
      entry.serviceType?.toLowerCase().includes(search) ||
      entry.notes?.toLowerCase().includes(search) ||
      entry.verificationCode?.toLowerCase().includes(search)
    );
  });

  filteredHistoryEntries = computed(() => {
    const entries = this.historyEntries();
    const search = this.searchTerm().toLowerCase();

    if (!search) return entries;

    return entries.filter(entry =>
      entry.customerId?.toLowerCase().includes(search) ||
      entry.serviceType?.toLowerCase().includes(search) ||
      entry.notes?.toLowerCase().includes(search) ||
      entry.verificationCode?.toLowerCase().includes(search)
    );
  });

  // AI Assistant methods - REMOVED: AI services eliminated for cost savings
  async sendAIMessage() {
    const input = this.aiInput().trim();
    if (!input) return;

    // const userMessage: GroqMessage = { role: 'user', content: input };
    const userMessage: any = { role: 'user', content: input };
    this.aiMessages.update(messages => [...messages, userMessage]);
    this.aiInput.set('');
    this.isAILoading.set(true);

    try {
      // REMOVED: AI services eliminated for cost savings
      // const response = await this.groqService.chatCompletion(messages, {
      //   temperature: 0.7,
      //   max_tokens: 1000
      // });

      // Fallback response
      const aiResponse: any = {
        role: 'assistant',
        content: 'Lo siento, el asistente IA no está disponible. Los servicios de IA han sido eliminados para reducir costos. Por favor, continúa con la gestión manual de la cola.'
      };

      this.aiMessages.update(messages => [...messages, aiResponse]);
    } catch (error) {
      console.error('Error sending AI message:', error);
      const errorMessage: any = {
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu consulta. Por favor, intenta de nuevo.'
      };
      this.aiMessages.update(messages => [...messages, errorMessage]);
    } finally {
      this.isAILoading.set(false);
    }
  }

  private createQueueContext(): string {
    const waiting = this.waitingCount();
    const called = this.calledCount();
    const avgWait = this.avgWaitTime();
    const technicians = this.availableTechniciansCount();

    return `Clientes esperando: ${waiting}, Llamados: ${called}, Tiempo promedio de espera: ${avgWait} minutos, Técnicos disponibles: ${technicians}`;
  }

  toggleAI() {
    this.showAI.update(show => !show);
    this.mobileMenuOpen.set(false);
  }

  closeAI() {
    this.showAI.set(false);
  }

  // Mobile menu methods
  toggleMobileMenu() {
    this.mobileMenuOpen.update(open => !open);
  }

  closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }

  // TrackBy function for AI messages
  trackByMessage(index: number, message: any): any {
    return message.content + index;
  }
}