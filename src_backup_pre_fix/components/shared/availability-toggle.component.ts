import { ChangeDetectionStrategy, Component, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { Role } from '../../models';

@Component({
  selector: 'app-availability-toggle',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="availability-toggle-container">
      <div class="toggle-card">
        <div class="toggle-header">
          <div class="status-indicator" [class.available]="isAvailable()" [class.unavailable]="!isAvailable()">
            <div class="indicator-dot" [class.pulse]="isAvailable()"></div>
          </div>
          <div class="status-text">
            <h3 class="status-title">{{ isAvailable() ? 'Disponible' : 'No Disponible' }}</h3>
            <p class="status-subtitle">{{ isAvailable() ? 'Listo para recibir trabajos' : 'No recibirás asignaciones' }}</p>
          </div>
        </div>

        <div class="toggle-section">
          <div class="toggle-wrapper">
            <label class="toggle-label">
              <input
                type="checkbox"
                [checked]="isAvailable()"
                (change)="onToggleAvailability($event)"
                [disabled]="isSubmitting() || !isAssignable()"
                class="toggle-input"
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-text">
              @if(isSubmitting()){
                <span>Actualizando...</span>
              } @else {
                <span>{{ isAvailable() ? 'Activado' : 'Desactivado' }}</span>
              }
            </span>
          </div>
        </div>

        @if (!isAvailable() && isAssignable()) {
          <div class="reason-section">
            <label class="reason-label">Razón (opcional)</label>
            <select
              [ngModel]="unavailabilityReason()"
              (ngModelChange)="onReasonChange($event)"
              [disabled]="isSubmitting()"
              class="reason-select"
            >
              <option value="">Seleccionar razón...</option>
              <option value="break">Pausa/Descanso</option>
              <option value="meeting">Reunión</option>
              <option value="training">Capacitación</option>
              <option value="personal">Asuntos personales</option>
              <option value="other">Otro</option>
            </select>
          </div>
        }

        <div class="info-section">
          <p class="info-text">Tu estado de disponibilidad determina si se te pueden asignar nuevas órdenes de trabajo.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ... existing styles ... */
    .toggle-input:disabled + .toggle-slider { cursor: not-allowed; background-color: #e5e7eb; }
    .toggle-text { min-width: 80px; text-align: right; }
  `]
})
export class AvailabilityToggleComponent {
  private authService = inject(AuthService);
  private userService = inject(UserService);

  private currentUser = this.authService.currentUser;
  
  isSubmitting = signal(false);

  // Determines if the current user role is one that should have an availability status.
  isAssignable = computed(() => {
    const userRole = this.currentUser()?.role;
    if (!userRole) return false;
    const assignableRoles: Role[] = ['technician'];
    return assignableRoles.includes(userRole);
  });

  // The current availability status, derived from the user signal.
  isAvailable = computed(() => this.currentUser()?.availability?.isAvailable ?? false);
  
  // The reason for unavailability.
  unavailabilityReason = computed(() => this.currentUser()?.availability?.reason ?? '');

  constructor() {
    // Effect to handle side-effects when user data changes, if necessary.
    effect(() => {
      const user = this.currentUser();
      console.log('Availability Toggle: User updated', user?.availability);
    });
  }

  onToggleAvailability(event: Event): void {
    if (!this.isAssignable()) return;

    const isChecked = (event.target as HTMLInputElement).checked;
    this.updateAvailability(isChecked, isChecked ? '' : this.unavailabilityReason());
  }

  onReasonChange(reason: string): void {
    if (this.isAvailable()) return; // Only update reason if unavailable
    this.updateAvailability(false, reason);
  }

  private updateAvailability(isAvailable: boolean, reason?: string): void {
    this.isSubmitting.set(true);

    this.userService.updateMyAvailability(isAvailable, reason).subscribe({
      next: () => {
        console.log('Availability updated successfully.');
        this.isSubmitting.set(false);
      },
      error: (err) => {
        console.error('Failed to update availability', err);
        // Optionally, show an error message to the user
        alert('Error al actualizar la disponibilidad. Inténtalo de nuevo.');
        this.isSubmitting.set(false);
        // No need to revert, computed signals will handle state from authService
      }
    });
  }
}
