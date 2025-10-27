import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QueueService } from '../../services/queue.service';
import { WorkOrderService } from '../../services/work-order.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { QueueEntry, WorkOrder } from '../../models';
import { toDate } from '../../models/types';

@Component({
  selector: 'app-code-validator',
  template: `
    <div class="code-validator-container">
      <div class="validator-card">
        <h3 class="validator-title">Validar Código de Cliente</h3>
        <p class="validator-subtitle">Ingresa el código de 4 dígitos proporcionado por el cliente</p>

        <form (ngSubmit)="validateCode()" class="code-form">
          <div class="code-input-container">
            <input
              type="text"
              [(ngModel)]="enteredCode"
              name="code"
              maxlength="4"
              pattern="[0-9]{4}"
              placeholder="0000"
              class="code-input"
              #codeInput
              required
            />
          </div>

          <button
            type="submit"
            [disabled]="!enteredCode || enteredCode.length !== 4 || isValidating()"
            class="validate-button"
          >
            <span *ngIf="!isValidating()">Validar Código</span>
            <span *ngIf="isValidating()" class="loading-spinner"></span>
          </button>
        </form>

        @if (validationMessage()) {
          <div class="message" [class.error]="!isValidCode()" [class.success]="isValidCode()">
            {{ validationMessage() }}
          </div>
        }

        @if (queueEntry() && isValidCode()) {
          <div class="entry-details">
            <h4>Detalles del Turno</h4>
            <div class="detail-item">
              <span class="label">Cliente:</span>
              <span class="value">{{ customerName() }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Servicio:</span>
              <span class="value">{{ queueEntry()!.serviceType === 'appointment' ? 'Cita Programada' : 'Servicio Directo' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Notas:</span>
              <span class="value">{{ queueEntry()!.notes || 'Sin notas' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Expira en:</span>
              <span class="value">{{ getTimeRemaining() }}</span>
            </div>

            <button
              (click)="openWorkOrder()"
              [disabled]="isCreatingWorkOrder()"
              class="open-work-order-button"
            >
              <span *ngIf="!isCreatingWorkOrder()">Abrir Orden de Trabajo</span>
              <span *ngIf="isCreatingWorkOrder()" class="loading-spinner"></span>
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .code-validator-container {
      max-width: 500px;
      margin: 0 auto;
    }

    .validator-card {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
    }

    .validator-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: #111827;
      margin-bottom: 0.5rem;
      text-align: center;
    }

    .validator-subtitle {
      color: #6b7280;
      text-align: center;
      margin-bottom: 2rem;
    }

    .code-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .code-input-container {
      display: flex;
      justify-content: center;
    }

    .code-input {
      width: 120px;
      height: 60px;
      text-align: center;
      font-size: 2rem;
      font-weight: 600;
      border: 2px solid #d1d5db;
      border-radius: 8px;
      background: white;
      transition: border-color 0.2s;
    }

    .code-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .validate-button {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .validate-button:hover:not(:disabled) {
      background: #2563eb;
    }

    .validate-button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    .message {
      padding: 0.75rem;
      border-radius: 6px;
      text-align: center;
      font-weight: 500;
    }

    .message.error {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
    }

    .message.success {
      background: #f0fdf4;
      color: #16a34a;
      border: 1px solid #bbf7d0;
    }

    .entry-details {
      margin-top: 2rem;
      padding: 1.5rem;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .entry-details h4 {
      margin: 0 0 1rem 0;
      color: #111827;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .detail-item .label {
      font-weight: 500;
      color: #6b7280;
    }

    .detail-item .value {
      color: #111827;
    }

    .open-work-order-button {
      width: 100%;
      margin-top: 1rem;
      background: #10b981;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .open-work-order-button:hover:not(:disabled) {
      background: #059669;
    }

    .open-work-order-button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    .loading-spinner {
      display: inline-block;
      width: 1rem;
      height: 1rem;
      border: 2px solid transparent;
      border-top: 2px solid currentColor;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule]
})
export class CodeValidatorComponent {
  private queueService = inject(QueueService);
  private workOrderService = inject(WorkOrderService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private router = inject(Router);

  enteredCode = signal('');
  isValidating = signal(false);
  isCreatingWorkOrder = signal(false);
  validationMessage = signal<string | null>(null);
  isValidCode = signal(false);
  queueEntry = signal<QueueEntry | null>(null);

  customerName = computed(() => {
    const entry = this.queueEntry();
    return entry ? this.getCustomerName(entry.customerId) : '';
  });

  validateCode() {
    if (!this.enteredCode() || this.enteredCode().length !== 4) return;

    this.isValidating.set(true);
    this.validationMessage.set(null);
    this.isValidCode.set(false);
    this.queueEntry.set(null);

    // Check if code is valid
    const isValid = this.queueService.isCodeValid(this.enteredCode());

    if (isValid) {
      const entry = this.queueService.getEntryByCode(this.enteredCode());
      if (entry) {
        this.queueEntry.set(entry);
        this.isValidCode.set(true);
        this.validationMessage.set('Código válido. Puedes abrir la orden de trabajo.');
      } else {
        this.validationMessage.set('Error interno: no se pudo encontrar el turno.');
      }
    } else {
      this.validationMessage.set('Código inválido o expirado. Verifica e intenta nuevamente.');
    }

    this.isValidating.set(false);
  }

  getCustomerName(customerId: string): string {
    const user = this.userService.getUserById(customerId);
    return user ? user.name : 'Cliente desconocido';
  }

  getTimeRemaining(): string {
    const entry = this.queueEntry();
    if (!entry || !entry.expiresAt) return 'Desconocido';

    const now = new Date();
    const expiresAt = toDate(entry.expiresAt);
    const diffMs = expiresAt.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expirado';

    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  openWorkOrder() {
    const entry = this.queueEntry();
    if (!entry) return;

    this.isCreatingWorkOrder.set(true);

    // Check user permissions before navigating to admin route
    const currentUser = this.authService.currentUser();
    if (!currentUser || !this.authService.hasRole(['admin', 'technician'])) {
      this.validationMessage.set('No tienes permisos para crear órdenes de trabajo.');
      this.isCreatingWorkOrder.set(false);
      return;
    }

    // Check if work order already exists for this queue entry
    // For now, we'll create a new one or navigate to existing
    // This is a simplified implementation

    // Navigate to work order creation with pre-filled data
    this.router.navigate(['/admin/work-orders/new'], {
      queryParams: {
        queueEntryId: entry.id,
        customerId: entry.customerId,
        serviceType: entry.serviceType,
        notes: entry.notes
      }
    });

    this.isCreatingWorkOrder.set(false);
  }
}