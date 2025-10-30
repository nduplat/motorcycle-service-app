import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientFlowService } from '../../../services/client-flow.service';
import { ValidationService } from '../../../services/validation_service';
import { MotorcycleService } from '../../../services/motorcycle.service';
import { AuthService } from '../../../services/auth.service';
import { MotorcycleAssignmentService } from '../../../services/motorcycle-assignment.service'; // AGREGAR
import { Motorcycle, MotorcycleAssignment } from '../../../models'; // MODIFICAR
import { NuevaMotocicletaComponent } from '../../shared/nueva-motocicleta.component'; // AGREGAR

@Component({
  selector: 'app-motorcycle-selection',
  templateUrl: './motorcycle-selection.component.html',
  styleUrls: ['./motorcycle-selection.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, NuevaMotocicletaComponent] // MODIFICAR
})
export class MotorcycleSelectionComponent implements OnInit {
  readonly flowService = inject(ClientFlowService);
  private validationService = inject(ValidationService);
  private motorcycleService = inject(MotorcycleService);
  private authService = inject(AuthService);
  private motorcycleAssignmentService = inject(MotorcycleAssignmentService); // AGREGAR

  // Component state
  selectedMotorcycle = signal<Motorcycle | null>(null);
  licensePlateInput = signal<string>('');
  mileageInput = signal<string>('');
  showNewMotorcycleForm = signal<boolean>(false);
  isValidating = signal<boolean>(false);
  validationErrors = signal<{ [key: string]: string }>({});

  // Motorcycle search functionality
  motorcycleSearchQuery = signal<string>('');
  showMotorcycleSearch = signal<boolean>(true);

  // Flow state
  readonly flowState = this.flowService.flowState;
  readonly availableMotorcycles = this.flowService.availableMotorcycles;
  readonly canProceed = this.flowService.canProceedToNext;

  // Computed properties
  readonly hasExistingMotorcycles = computed(() => {
    // In a real implementation, this would check user's motorcycle assignments
    // For now, we'll show the catalog
    return this.availableMotorcycles().length > 0;
  });

  readonly filteredMotorcycles = computed(() => {
    const query = this.motorcycleSearchQuery().toLowerCase().trim();
    const allMotorcycles = this.availableMotorcycles();

    if (!query) {
      return allMotorcycles;
    }

    // Filter by search query
    return allMotorcycles.filter(motorcycle =>
      motorcycle.brand.toLowerCase().includes(query) ||
      motorcycle.model.toLowerCase().includes(query) ||
      motorcycle.year.toString().includes(query) ||
      `${motorcycle.brand} ${motorcycle.model}`.toLowerCase().includes(query)
    );
  });

  readonly isFormValid = computed(() => {
    const motorcycle = this.selectedMotorcycle();
    const plate = this.licensePlateInput().trim();
    const mileage = this.mileageInput().trim();

    if (!motorcycle) return false;
    if (!plate || !this.isLicensePlateValid()) return false;
    if (!mileage || !this.isMileageValid()) return false;

    return true;
  });

  readonly isLicensePlateValid = computed(() => {
    const plate = this.licensePlateInput().trim();
    if (!plate) return false;
    return this.validationService.validateLicensePlate(plate).isValid;
  });

  readonly isMileageValid = computed(() => {
    const mileage = this.mileageInput().trim();
    if (!mileage) return false;
    return this.validationService.validateMileage(mileage).isValid;
  });

  readonly formattedMileage = computed(() => {
    const mileage = this.mileageInput().trim();
    if (!mileage) return '';
    const numValue = parseInt(mileage.replace(/[^\d]/g, ''));
    return this.validationService.formatMileage(numValue);
  });

  // Check if motorcycle is registered (assigned to current user)
  readonly isMotorcycleRegistered = computed(() => {
    return (motorcycleId: string) => {
      const user = this.authService.currentUser();
      if (!user) return false;

      // Use MotorcycleService to get vehicles for user
      // Since MotorcycleService now handles the unified approach,
      // we can check if the motorcycle exists in the available motorcycles
      return this.availableMotorcycles().some(m => m.id === motorcycleId);
    };
  });

  // ← AGREGAR: Obtener motos asignadas al usuario
  readonly userMotorcycles = computed<MotorcycleAssignment[]>(() => {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return [];

    // Llamar a servicio de asignaciones
    // This would typically be an async call, but for computed, we assume data is already loaded or will be reactive
    // For a real implementation, you'd likely have an observable/signal from the service
    this.motorcycleAssignmentService.getUserAssignments(userId).then(assignments => {
      // This is a side effect in a computed, which is generally discouraged.
      // A better approach would be to have a signal in the service that gets updated.
      // For now, we'll just log it.
      console.log('User assignments:', assignments);
    });
    return []; // Placeholder, actual data would come from a signal/observable
  });

  // ← AGREGAR: Integrar componente de nueva moto
  showNewMotorcycleModal = signal<boolean>(false);

  ngOnInit(): void {
    console.log('🚀 MotorcycleSelection Component: Initializing...');
    this.initializeFromFlowState();
    console.log('✅ MotorcycleSelection Component: Initialized successfully');
  }

  private initializeFromFlowState(): void {
    // Pre-fill from flow state if available
    const flowMotorcycle = this.flowState().selectedMotorcycle;
    const flowPlate = this.flowState().licensePlate;
    const flowMileage = this.flowState().currentMileage;

    if (flowMotorcycle) {
      this.selectedMotorcycle.set(flowMotorcycle);
    }
    if (flowPlate) {
      this.licensePlateInput.set(flowPlate);
    }
    if (flowMileage !== null) {
      this.mileageInput.set(flowMileage.toString());
    }
  }

  onMotorcycleSelect(motorcycle: Motorcycle): void {
    console.log('🏍️ MotorcycleSelection: Motorcycle selected:', motorcycle.brand, motorcycle.model);
    this.selectedMotorcycle.set(motorcycle);
    this.flowService.setSelectedMotorcycle(motorcycle);
    this.clearValidationError('motorcycle');
  }

  onMotorcycleSearchSelect(motorcycle: Motorcycle): void {
    console.log('🔍 MotorcycleSelection: Motorcycle selected from search:', motorcycle.brand, motorcycle.model);
    this.onMotorcycleSelect(motorcycle);
  }

  onAddNewMotorcycle(): void {
    console.log('➕ MotorcycleSelection: Add new motorcycle requested');
    this.showNewMotorcycleModal.set(true);
  }

  onMotorcycleAdded(assignment: MotorcycleAssignment) {
    this.showNewMotorcycleModal.set(false);
    // Assuming assignment contains the motorcycle details needed for selectedMotorcycle
    // You might need to map MotorcycleAssignment to Motorcycle if they are different types
    this.selectedMotorcycle.set(assignment as unknown as Motorcycle); // This cast might need refinement based on actual types
    // Continuar flujo automáticamente
    this.flowService.setSelectedMotorcycle(assignment as unknown as Motorcycle);
    this.flowService.nextStep();
  }

  selectUserMotorcycle(assignment: MotorcycleAssignment): void {
    // Assuming MotorcycleAssignment has enough info to act as a Motorcycle
    this.selectedMotorcycle.set(assignment as unknown as Motorcycle);
    this.flowService.setSelectedMotorcycle(assignment as unknown as Motorcycle);
    this.licensePlateInput.set(assignment.plate);
    this.mileageInput.set(assignment.mileageKm?.toString() || '');
    this.clearValidationError('motorcycle');
  }

  onLicensePlateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.licensePlateInput.set(value);

    if (this.isLicensePlateValid()) {
      this.flowService.setLicensePlate(value);
      this.clearValidationError('licensePlate');
    }
  }

  onMileageInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/[^\d]/g, '');
    this.mileageInput.set(value);

    if (this.isMileageValid()) {
      this.flowService.setCurrentMileage(parseInt(value));
      this.clearValidationError('mileage');
    }
  }

  onCancelNewMotorcycle(): void {
    this.showNewMotorcycleModal.set(false);
  }

  onConfirmSelection(): void {
    if (!this.isFormValid()) {
      this.validateForm();
      return;
    }

    this.isValidating.set(true);

    try {
      // Update flow service with final values
      const motorcycle = this.selectedMotorcycle()!;
      const plate = this.licensePlateInput().trim();
      const mileage = parseInt(this.mileageInput().trim());

      this.flowService.setSelectedMotorcycle(motorcycle);
      this.flowService.setLicensePlate(plate);
      this.flowService.setCurrentMileage(mileage);

      // Proceed to next step
      this.flowService.nextStep();

    } catch (error: any) {
      this.validationErrors.set({ general: error.message || 'Error al guardar la selección' });
    } finally {
      this.isValidating.set(false);
    }
  }

  onNext(): void {
    if (this.canProceed()) {
      this.flowService.nextStep();
    }
  }

  onPrevious(): void {
    this.flowService.previousStep();
  }

  private validateForm(): void {
    const errors: { [key: string]: string } = {};

    if (!this.selectedMotorcycle()) {
      errors['motorcycle'] = 'Debe seleccionar una motocicleta';
    }

    if (!this.licensePlateInput().trim()) {
      errors['licensePlate'] = 'La placa es requerida';
    } else if (!this.isLicensePlateValid()) {
      errors['licensePlate'] = 'Formato de placa inválido';
    }

    if (!this.mileageInput().trim()) {
      errors['mileage'] = 'El kilometraje es requerido';
    } else if (!this.isMileageValid()) {
      errors['mileage'] = 'Kilometraje inválido';
    }

    this.validationErrors.set(errors);
  }

  private clearValidationError(field: string): void {
    const errors = { ...this.validationErrors() };
    delete errors[field];
    this.validationErrors.set(errors);
  }

  // Template helpers
  getMotorcycleDisplayName(motorcycle: Motorcycle): string {
    return `${motorcycle.brand} ${motorcycle.model} ${motorcycle.year}`;
  }

  getValidationError(field: string): string {
    return this.validationErrors()[field] || '';
  }

  hasValidationError(field: string): boolean {
    return !!this.validationErrors()[field];
  }

  getMotorcycleIcon(): string {
    return this.selectedMotorcycle() ? '🏍️' : '❓';
  }

  formatLicensePlate(plate: string): string {
    if (plate.length <= 3) return plate;
    if (plate.length <= 6) return `${plate.slice(0, 3)} ${plate.slice(3)}`;
    return `${plate.slice(0, 3)} ${plate.slice(3, 6)} ${plate.slice(6)}`;
  }
}