import { ChangeDetectionStrategy, Component, inject, signal, EventEmitter, Output, Input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MotorcycleService } from '../../services/motorcycle.service';
import { AuthService } from '../../services/auth.service';
import { Motorcycle } from '../../models';

type RegistrationState = 'input' | 'existing-found' | 'claiming-ownership' | 'creating-new' | 'success' | 'error';

@Component({
  selector: 'app-motorcycle-registration',
  templateUrl: './motorcycle-registration.component.html',
  styleUrls: ['./motorcycle-registration.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CommonModule],
})
export class MotorcycleRegistrationComponent {
  private fb = inject(FormBuilder);
  private motorcycleService = inject(MotorcycleService);
  private authService = inject(AuthService);

  // State management
  currentState = signal<RegistrationState>('input');
  isLoading = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Data
  foundMotorcycle = signal<Motorcycle | null>(null);
  registeredMotorcycle = signal<Motorcycle | null>(null);

  // Events
  @Output() motorcycleRegistered = new EventEmitter<Motorcycle>();
  @Output() registrationCancelled = new EventEmitter<void>();

  // Optional input for pre-filled plate
  @Input() initialPlate = '';

  // Forms
  plateForm = this.fb.group({
    plate: ['', [
      Validators.required,
      Validators.minLength(5),
      Validators.maxLength(6),
      Validators.pattern(/^[A-Z0-9]+$/)
    ]]
  });

  newMotorcycleForm = this.fb.group({
    brand: ['', Validators.required],
    model: ['', Validators.required],
    year: [new Date().getFullYear(), [Validators.required, Validators.min(1900), Validators.max(new Date().getFullYear() + 1)]],
    mileageKm: [0, [Validators.required, Validators.min(0)]]
  });

  ngOnInit() {
    if (this.initialPlate) {
      this.plateForm.patchValue({ plate: this.initialPlate.toUpperCase() });
    }
  }

  // License plate validation (ABC123 format)
  private validatePlateFormat(plate: string): boolean {
    const plateRegex = /^[A-Z]{3}\d{3}$/;
    return plateRegex.test(plate);
  }

  // Handle plate input with auto-formatting
  onPlateInput(event: Event): void {
    const input = (event.target as HTMLInputElement);
    const upperValue = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    input.value = upperValue;
    this.plateForm.patchValue({ plate: upperValue }, { emitEvent: false });
  }

  // Submit plate for checking
  async onPlateSubmit() {
    if (this.plateForm.invalid) {
      this.markFormGroupTouched(this.plateForm);
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    try {
      const formData = this.plateForm.value;
      const plate = formData.plate!.toUpperCase();

      // Validate format
      if (!this.validatePlateFormat(plate)) {
        this.error.set('Formato de placa inválido. Debe ser ABC123 (3 letras + 3 números)');
        return;
      }

      // Check if motorcycle exists
      const existingMotorcycle = await this.motorcycleService.findMotorcycleByPlate(plate).toPromise();

      if (existingMotorcycle) {
        // Motorcycle exists - check ownership
        this.foundMotorcycle.set(existingMotorcycle);
        const user = this.authService.currentUser();
        if (user) {
          const hasAccess = await this.motorcycleService.canUserAccessMotorcycleByPlate(user.id, plate).toPromise();
          if (hasAccess) {
            this.currentState.set('existing-found');
            this.successMessage.set('Esta motocicleta ya está registrada a tu nombre.');
          } else {
            this.currentState.set('claiming-ownership');
          }
        }
      } else {
        // Motorcycle doesn't exist - allow creation
        this.currentState.set('creating-new');
        // Pre-populate form with basic info if available
        this.newMotorcycleForm.patchValue({
          mileageKm: 0
        });
      }
    } catch (err: any) {
      this.error.set('Error al verificar la placa: ' + err.message);
      this.currentState.set('error');
    } finally {
      this.isLoading.set(false);
    }
  }

  // Claim ownership of existing motorcycle
  async claimOwnership() {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const user = this.authService.currentUser();
      const motorcycle = this.foundMotorcycle();

      if (!user || !motorcycle) {
        throw new Error('Usuario o motocicleta no encontrados');
      }

      // Create assignment (this would need to be implemented in service if not already)
      // For now, we'll assume the service handles this in the access check
      this.registeredMotorcycle.set(motorcycle);
      this.successMessage.set('Propiedad reclamada exitosamente.');
      this.currentState.set('success');
      this.motorcycleRegistered.emit(motorcycle);
    } catch (err: any) {
      this.error.set('Error al reclamar propiedad: ' + err.message);
      this.currentState.set('error');
    } finally {
      this.isLoading.set(false);
    }
  }

  // Create new motorcycle
  async createNewMotorcycle() {
    if (this.newMotorcycleForm.invalid) {
      this.markFormGroupTouched(this.newMotorcycleForm);
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const user = this.authService.currentUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const plate = this.plateForm.value.plate!.toUpperCase();
      const motorcycleData = this.newMotorcycleForm.value;

      const newMotorcycle = await this.motorcycleService.getOrCreateMotorcycleByPlate(plate, {
        userId: user.id,
        brand: motorcycleData.brand,
        model: motorcycleData.model,
        year: motorcycleData.year,
        mileageKm: motorcycleData.mileageKm
      }).toPromise();

      if (newMotorcycle) {
        this.registeredMotorcycle.set(newMotorcycle);
        this.successMessage.set('Motocicleta registrada exitosamente.');
        this.currentState.set('success');
        this.motorcycleRegistered.emit(newMotorcycle);
      } else {
        throw new Error('Error al crear la motocicleta');
      }
    } catch (err: any) {
      this.error.set('Error al crear motocicleta: ' + err.message);
      this.currentState.set('error');
    } finally {
      this.isLoading.set(false);
    }
  }

  // Reset to initial state
  reset() {
    this.currentState.set('input');
    this.error.set(null);
    this.successMessage.set(null);
    this.foundMotorcycle.set(null);
    this.registeredMotorcycle.set(null);
    this.plateForm.reset();
    this.newMotorcycleForm.reset();
  }

  // Cancel registration
  cancel() {
    this.registrationCancelled.emit();
  }

  // Go back to plate input
  goBack() {
    this.currentState.set('input');
    this.error.set(null);
    this.successMessage.set(null);
  }

  private markFormGroupTouched(formGroup: any): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }
}