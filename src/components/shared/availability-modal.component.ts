import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { serverTimestamp } from 'firebase/firestore';

@Component({
  selector: 'app-availability-modal',
  template: `
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-icon">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="header-text">
              <h2 class="modal-title">¿Estás disponible hoy?</h2>
              <p class="modal-subtitle">Confirma tu disponibilidad para recibir asignaciones de trabajo</p>
            </div>
          </div>

          <!-- Content -->
          <div class="modal-body">
            <div class="availability-options">
              <button
                (click)="setAvailability(true)"
                [class.selected]="selectedAvailability() === true"
                class="option-button available"
                [disabled]="isUpdating()"
              >
                <div class="option-icon">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <div class="option-content">
                  <h3>Sí, estoy disponible</h3>
                  <p>Recibiré asignaciones de trabajo hoy</p>
                </div>
              </button>

              <button
                (click)="setAvailability(false)"
                [class.selected]="selectedAvailability() === false"
                class="option-button unavailable"
                [disabled]="isUpdating()"
              >
                <div class="option-icon">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </div>
                <div class="option-content">
                  <h3>No, no estoy disponible</h3>
                  <p>No recibiré asignaciones hoy</p>
                </div>
              </button>
            </div>

            @if (selectedAvailability() === false) {
              <div class="reason-section">
                <label class="reason-label">¿Cuál es la razón? (opcional)</label>
                <select
                  [(ngModel)]="unavailabilityReason"
                  class="reason-select"
                  [disabled]="isUpdating()"
                >
                  <option value="">Seleccionar razón...</option>
                  <option value="break">Pausa/Descanso</option>
                  <option value="meeting">Reunión</option>
                  <option value="training">Capacitación</option>
                  <option value="personal">Asuntos personales</option>
                  <option value="maintenance">Mantenimiento</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            }

            <div class="info-box">
              <div class="info-icon">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="info-text">
                <p><strong>Horario del taller:</strong> 8:00 AM - 6:00 PM</p>
                <p>Puedes cambiar tu disponibilidad en cualquier momento desde el panel de empleado.</p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button
              (click)="confirmAvailability()"
              [disabled]="selectedAvailability() === null || isUpdating()"
              class="confirm-button"
            >
              @if (!isUpdating()) {
                <span>Confirmar</span>
              } @else {
                <span class="loading">Guardando...</span>
              }
            </button>
            <button
              (click)="closeModal()"
              class="skip-button"
              [disabled]="isUpdating()"
            >
              Más tarde
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
      backdrop-filter: blur(4px);
    }

    .modal-content {
      background: white;
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      max-width: 480px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      animation: modalSlideIn 0.3s ease-out;
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .modal-header {
      padding: 2rem 2rem 1.5rem;
      text-align: center;
      border-bottom: 1px solid #e5e7eb;
    }

    .header-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #10b981, #059669);
      border-radius: 50%;
      margin-bottom: 1rem;
    }

    .header-icon .icon {
      width: 28px;
      height: 28px;
      color: white;
    }

    .modal-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #111827;
      margin: 0 0 0.5rem 0;
    }

    .modal-subtitle {
      font-size: 1rem;
      color: #6b7280;
      margin: 0;
      line-height: 1.5;
    }

    .modal-body {
      padding: 1.5rem 2rem;
    }

    .availability-options {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .option-button {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      background: white;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
    }

    .option-button:hover:not(:disabled) {
      border-color: #d1d5db;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .option-button.selected.available {
      border-color: #10b981;
      background: #f0fdf4;
    }

    .option-button.selected.unavailable {
      border-color: #f59e0b;
      background: #fffbeb;
    }

    .option-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .option-icon {
      flex-shrink: 0;
    }

    .option-icon.available .icon {
      color: #10b981;
    }

    .option-icon.unavailable .icon {
      color: #f59e0b;
    }

    .option-content h3 {
      font-size: 1.125rem;
      font-weight: 600;
      color: #111827;
      margin: 0 0 0.25rem 0;
    }

    .option-content p {
      font-size: 0.875rem;
      color: #6b7280;
      margin: 0;
      line-height: 1.4;
    }

    .reason-section {
      margin-bottom: 1.5rem;
    }

    .reason-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.5rem;
    }

    .reason-select {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: white;
      font-size: 0.875rem;
      color: #374151;
      transition: border-color 0.2s;
    }

    .reason-select:focus {
      outline: none;
      border-color: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }

    .reason-select:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .info-box {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .info-icon {
      flex-shrink: 0;
      margin-top: 0.125rem;
    }

    .info-icon .icon {
      width: 1.25rem;
      height: 1.25rem;
      color: #6b7280;
    }

    .info-text p {
      margin: 0 0 0.5rem 0;
      font-size: 0.875rem;
      color: #374151;
      line-height: 1.4;
    }

    .info-text p:last-child {
      margin-bottom: 0;
    }

    .modal-footer {
      padding: 1.5rem 2rem 2rem;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
    }

    .confirm-button {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 120px;
    }

    .confirm-button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .confirm-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .skip-button {
      background: white;
      color: #6b7280;
      border: 1px solid #d1d5db;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .skip-button:hover:not(:disabled) {
      background: #f9fafb;
      border-color: #9ca3af;
    }

    .skip-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .loading {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .loading::after {
      content: '';
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top: 2px solid currentColor;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Mobile optimizations */
    @media (max-width: 640px) {
      .modal-overlay {
        padding: 0.5rem;
      }

      .modal-content {
        border-radius: 16px;
        max-height: 95vh;
      }

      .modal-header {
        padding: 1.5rem 1.5rem 1rem;
      }

      .header-icon {
        width: 56px;
        height: 56px;
      }

      .header-icon .icon {
        width: 24px;
        height: 24px;
      }

      .modal-title {
        font-size: 1.375rem;
      }

      .modal-body {
        padding: 1rem 1.5rem;
      }

      .option-button {
        padding: 1rem;
        gap: 0.75rem;
      }

      .option-content h3 {
        font-size: 1rem;
      }

      .option-content p {
        font-size: 0.8125rem;
      }

      .modal-footer {
        padding: 1rem 1.5rem 1.5rem;
        flex-direction: column;
      }

      .confirm-button,
      .skip-button {
        width: 100%;
        padding: 0.875rem;
      }
    }
  `],
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvailabilityModalComponent implements OnInit {
  private authService = inject(AuthService);
  private userService = inject(UserService);

  showModal = signal(false);
  selectedAvailability = signal<boolean | null>(null);
  unavailabilityReason = signal('');
  isUpdating = signal(false);

  ngOnInit() {
    // Check if user needs to set availability
    this.checkAvailabilityRequirement();
  }

  private checkAvailabilityRequirement() {
    const user = this.authService.currentUser();
    if (!user) return;

    // Only show for technicians and employees
    if (!['technician', 'employee'].includes(user.role)) {
      return;
    }

    // Check if user has availability set for today
    const today = new Date().toDateString();
    const lastUpdated = user.availability?.lastUpdated?.toDate()?.toDateString();

    // Show modal if no availability set today or if it's been more than 24 hours
    if (!user.availability || lastUpdated !== today) {
      // Small delay to ensure UI is ready
      setTimeout(() => {
        this.showModal.set(true);
      }, 1000);
    }
  }

  setAvailability(isAvailable: boolean) {
    this.selectedAvailability.set(isAvailable);
    if (!isAvailable) {
      this.unavailabilityReason.set('');
    }
  }

  async confirmAvailability() {
    const availability = this.selectedAvailability();
    if (availability === null) return;

    this.isUpdating.set(true);

    const user = this.authService.currentUser();
    if (!user) return;

    const availabilityData: any = {
      isAvailable: availability,
      lastUpdated: serverTimestamp(),
      reason: availability ? undefined : this.unavailabilityReason()
    };

    try {
      await this.userService.updateUser({ id: user.id, availability: availabilityData }).toPromise();
      this.closeModal();
    } catch (error) {
      console.error('Error updating availability:', error);
    } finally {
      this.isUpdating.set(false);
    }
  }

  closeModal() {
    this.showModal.set(false);
  }
}