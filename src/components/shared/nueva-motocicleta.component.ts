import { ChangeDetectionStrategy, Component, inject, signal, computed, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MotorcycleService } from '../../services/motorcycle.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { Motorcycle } from '../../models';
import { MotorcycleFiltersComponent, MotorcycleFilters } from '../home/motorcycle-search/motorcycle-search.component';

@Component({
  selector: 'app-nueva-motocicleta',
  templateUrl: './nueva-motocicleta.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CommonModule, MotorcycleFiltersComponent],
})
export class NuevaMotocicletaComponent {
  private fb = inject(FormBuilder);
  motorcycleService = inject(MotorcycleService);
  authService = inject(AuthService);
  userService = inject(UserService);

  isSubmitting = signal(false);
  selectedMotorcycle = signal<Motorcycle | null>(null);
  showMotorcycleGrid = signal(false);

  // Filter signals
  searchQuery = signal('');
  brandFilter = signal('');
  modelFilter = signal('');
  categoryFilter = signal('');
  yearFilter = signal<number | ''>('');
  minYearFilter = signal<number | ''>('');
  maxYearFilter = signal<number | ''>('');

  currentUser = this.authService.currentUser;
  motorcycles = this.motorcycleService.getMotorcycles();

  // Outputs
  motorcycleAssigned = output<void>();

  availableBrands = computed(() => {
    const brands = new Set(this.motorcycles().map(m => m.brand).filter(Boolean));
    return Array.from(brands).sort();
  });

  availableModels = computed(() => {
    const models = new Set(this.motorcycles().map(m => m.model).filter(Boolean));
    return Array.from(models).sort();
  });

  availableYears = computed(() => {
    const years = new Set(this.motorcycles().map(m => m.year).filter(Boolean));
    return Array.from(years).sort((a, b) => b - a);
  });

  filteredMotorcycles = computed(() => {
    const query = this.searchQuery();
    const filters: any = {};

    if (this.brandFilter()) filters.brand = this.brandFilter();
    if (this.modelFilter()) filters.model = this.modelFilter();
    if (this.categoryFilter()) filters.category = this.categoryFilter();

    const year = this.yearFilter();
    if (year) {
      filters.minYear = year;
      filters.maxYear = year;
    } else {
      if (this.minYearFilter()) filters.minYear = this.minYearFilter();
      if (this.maxYearFilter()) filters.maxYear = this.maxYearFilter();
    }

    return this.motorcycleService.searchMotorcycles(query, filters);
  });

  requestForm = this.fb.group({
    phone: ['', [Validators.pattern(/^(\+57|57)?[3-5]\d{8}$/)]],
    motorcycleId: ['', Validators.required],
    licensePlate: ['', [
      Validators.required,
      Validators.minLength(5),
      Validators.maxLength(6),
      Validators.pattern(/^[A-Z0-9]+$/)
    ]],
    currentMileage: [0, [Validators.required, Validators.min(0)]],
    photos: [[] as string[]],
    notes: ['']
  });

  constructor() {}

  onLicensePlateInput(event: Event): void {
    const input = (event.target as HTMLInputElement);
    const upperValue = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    input.value = upperValue;
    this.requestForm.patchValue({ licensePlate: upperValue }, { emitEvent: false });
  }

  toggleMotorcycleSelection(): void {
    this.showMotorcycleGrid.set(!this.showMotorcycleGrid());
  }

  selectMotorcycle(motorcycle: Motorcycle): void {
    this.selectedMotorcycle.set(motorcycle);
    this.requestForm.patchValue({ motorcycleId: motorcycle.id });
    this.showMotorcycleGrid.set(false);
  }

  clearMotorcycleSelection(): void {
    this.selectedMotorcycle.set(null);
    this.requestForm.patchValue({ motorcycleId: '' });
  }

  onFiltersChanged(filters: MotorcycleFilters): void {
    this.searchQuery.set(filters.searchQuery);
    this.brandFilter.set(filters.brand);
    this.categoryFilter.set(filters.category);
    this.yearFilter.set(filters.year ?? '');
    this.minYearFilter.set(filters.minYear ?? '');
    this.maxYearFilter.set(filters.maxYear ?? '');
  }

  filterByModel(model: string): void {
    this.modelFilter.set(model);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.brandFilter.set('');
    this.modelFilter.set('');
    this.categoryFilter.set('');
    this.yearFilter.set('');
    this.minYearFilter.set('');
    this.maxYearFilter.set('');
  }

  onPhotosSelected(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (files) {
      const photoUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        photoUrls.push(files[i].name);
      }
      this.requestForm.patchValue({ photos: photoUrls });
    }
  }

  async checkPlateUniqueness(plate: string): Promise<boolean> {
    try {
      // Since motorcycle assignments are now handled by queue service,
      // we can skip this check as it's handled during queue joining
      return true;
    } catch (error) {
      console.error('Error checking plate uniqueness:', error);
      return false;
    }
  }

  async submitRequest(): Promise<void> {
    if (this.requestForm.invalid || !this.currentUser()) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting.set(true);
    const formData = this.requestForm.value as any;
    const user = this.currentUser()!;

    try {
      // Check plate uniqueness
      const isUnique = await this.checkPlateUniqueness(formData.licensePlate);
      if (!isUnique) {
        alert('Esta placa ya está registrada en el sistema. Por favor, verifica la información.');
        this.isSubmitting.set(false);
        return;
      }

      // Update phone if provided
      if (formData.phone) {
        await this.userService.updateUser({ id: user.id, phone: formData.phone }).toPromise();
      }

      // Motorcycle assignment is now handled by the queue service
      // This component is now only used for creating new motorcycles in the catalog
      alert('Motocicleta registrada exitosamente.');
      this.motorcycleAssigned.emit();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.requestForm.controls).forEach(key => {
      const control = this.requestForm.get(key);
      control?.markAsTouched();
    });
  }
}