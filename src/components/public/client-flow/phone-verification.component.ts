/**
 * Phone Verification Component - Step 1 of Client Flow
 *
 * Handles phone number input and validation for the client onboarding flow.
 * Features:
 * - Phone number input with formatting
 * - Real-time validation
 * - Pre-filling from user profile
 * - Error handling and user feedback
 * - Responsive design
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientFlowService } from '../../../services/client-flow.service';
import { ValidationService } from '../../../services/validation_service';

@Component({
  selector: 'app-phone-verification',
  templateUrl: './phone-verification.component.html',
  styleUrls: ['./phone-verification.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class PhoneVerificationComponent implements OnInit {
  readonly flowService = inject(ClientFlowService);
  private validationService = inject(ValidationService);

  // Component state
  phoneInput = signal<string>('');
  isValidating = signal<boolean>(false);
  validationError = signal<string | null>(null);
  showConfirmation = signal<boolean>(false);

  // Flow state
  readonly flowState = this.flowService.flowState;
  readonly canProceed = this.flowService.canProceedToNext;

  // Computed properties
  readonly isPhoneValid = computed(() => {
    const phone = this.phoneInput().trim();
    if (!phone) return false;
    return this.validationService.validatePhone(phone).isValid;
  });

  readonly formattedPhone = computed(() => {
    const phone = this.phoneInput().trim();
    if (!phone) return '';
    return this.validationService.formatPhone(phone);
  });

  readonly validationMessage = computed(() => {
    const phone = this.phoneInput().trim();
    if (!phone) return null;

    const validation = this.validationService.validatePhone(phone);
    return validation.isValid ? null : validation.message;
  });

  readonly hasExistingPhone = computed(() => {
    const user = this.flowState().user;
    return user?.phone && this.validationService.validatePhone(user.phone).isValid;
  });

  ngOnInit(): void {
    this.initializePhoneInput();
  }

  private initializePhoneInput(): void {
    // Pre-fill with existing phone if available and valid
    const existingPhone = this.flowState().phone;
    if (existingPhone && this.validationService.validatePhone(existingPhone).isValid) {
      this.phoneInput.set(existingPhone);
    }
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, ''); // Only allow digits
    this.phoneInput.set(value);

    // Clear validation error when user starts typing
    if (this.validationError()) {
      this.validationError.set(null);
    }

    // Auto-update flow service
    if (this.isPhoneValid()) {
      this.flowService.setPhone(value);
    }
  }

  onUseExistingPhone(): void {
    const existingPhone = this.flowState().user?.phone;
    if (existingPhone) {
      this.phoneInput.set(existingPhone);
      this.flowService.setPhone(existingPhone);
      this.showConfirmation.set(true);
    }
  }

  onConfirmPhone(): void {
    const phone = this.phoneInput().trim();
    if (!this.isPhoneValid()) {
      this.validationError.set('Por favor ingresa un número de teléfono válido');
      return;
    }

    this.isValidating.set(true);
    this.validationError.set(null);

    try {
      // Update flow service
      this.flowService.setPhone(phone);

      // Show confirmation and proceed
      this.showConfirmation.set(true);

      // Auto-proceed after a short delay
      setTimeout(() => {
        this.onNext();
      }, 1500);

    } catch (error: any) {
      this.validationError.set(error.message || 'Error al validar el teléfono');
    } finally {
      this.isValidating.set(false);
    }
  }

  onNext(): void {
    if (this.canProceed()) {
      this.flowService.nextStep();
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.isPhoneValid() && !this.isValidating()) {
      this.onConfirmPhone();
    }
  }

  // Template helpers
  getInputPlaceholder(): string {
    return 'Ejemplo: 3123456789';
  }

  getPhoneIcon(): string {
    return this.isPhoneValid() ? '✅' : '📱';
  }

  getValidationStatusClass(): string {
    const phone = this.phoneInput().trim();
    if (!phone) return '';
    return this.isPhoneValid() ? 'valid' : 'invalid';
  }

  formatPhoneForDisplay(phone: string): string {
    if (!phone) return '';
    return this.validationService.formatPhone(phone);
  }
}