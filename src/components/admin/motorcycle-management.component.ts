
import { ChangeDetectionStrategy, Component, inject, signal, computed, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MotorcycleService } from '../../services/motorcycle.service';
import { AuthService } from '../../services/auth.service';
// FIX: Import Motorcycle from index.ts instead of Vehicle from non-existent file.
import { Motorcycle, Brand } from '../../models';
import { LoaderComponent } from '../shared/loader/loader.component';
import { from } from 'rxjs';
// TODO: Create a BrandService to handle brand operations instead of direct Firebase calls

@Component({
  selector: 'app-motorcycle-management-unused',
  templateUrl: './motorcycle-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
export class MotorcycleManagementComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  motorcycleService = inject(MotorcycleService);

  motorcycles = this.motorcycleService.getMotorcycles();

  isSubmitting = signal(false);
  editingMotorcycleId = signal<string | null>(null);

  formTitle = computed(() => this.editingMotorcycleId() ? 'Edit Motorcycle' : 'Add New Motorcycle');

  // Brand management
  activeTab = signal<'motorcycles' | 'brands'>('motorcycles');
  brands = signal<Brand[]>([]);
  isBrandSubmitting = signal(false);
  editingBrandId = signal<string | null>(null);

  brandFormTitle = computed(() => this.editingBrandId() ? 'Editar Marca' : 'Nueva Marca');

  motorcycleForm = this.fb.group({
    brand: ['', Validators.required],
    model: ['', Validators.required],
    year: [new Date().getFullYear(), [Validators.required, Validators.min(1900)]],
    displacementCc: [null as number | null],
  });

  brandForm = this.fb.group({
    name: ['', Validators.required],
    country: [''],
    foundedYear: [null as number | null, [Validators.min(1800), Validators.max(new Date().getFullYear())]],
  });

  constructor() {
    // Load brands on component initialization
    this.loadBrands();
  }

  private async loadBrands(): Promise<void> {
    try {
      // TODO: Replace with BrandService when created
      // For now, use a simple array of popular brands
      const popularBrands: any[] = [
        { id: '1', name: 'Honda', country: 'Japan', foundedYear: 1948, logoUrl: '', website: 'https://www.honda.com', description: 'Leading motorcycle manufacturer', isActive: true },
        { id: '2', name: 'Yamaha', country: 'Japan', foundedYear: 1955, logoUrl: '', website: 'https://www.yamaha-motor.com', description: 'Global motorcycle brand', isActive: true },
        { id: '3', name: 'Kawasaki', country: 'Japan', foundedYear: 1896, logoUrl: '', website: 'https://www.kawasaki.com', description: 'Performance motorcycles', isActive: true },
        { id: '4', name: 'Suzuki', country: 'Japan', foundedYear: 1909, logoUrl: '', website: 'https://www.suzuki.com', description: 'Diverse motorcycle lineup', isActive: true },
        { id: '5', name: 'BMW', country: 'Germany', foundedYear: 1916, logoUrl: '', website: 'https://www.bmw-motorrad.com', description: 'Premium motorcycles', isActive: true }
      ];
      this.brands.set(popularBrands);
    } catch (error) {
      console.error('Error loading brands:', error);
    }
  }

  // FIX: Use Motorcycle type to match the service and form data.
  editMotorcycle(motorcycle: Motorcycle): void {
    this.editingMotorcycleId.set(motorcycle.id);
    this.motorcycleForm.patchValue(motorcycle);
  }

  cancelEdit(): void {
    this.editingMotorcycleId.set(null);
    this.motorcycleForm.reset({ year: new Date().getFullYear() });
  }

  deleteMotorcycle(id: string): void {
    if (confirm('Are you sure you want to delete this motorcycle?')) {
        this.motorcycleService.deleteMotorcycle(id).subscribe();
    }
  }

  onSubmit(): void {
    if (this.motorcycleForm.invalid) {
      return;
    }
    this.isSubmitting.set(true);

    // FIX: Use Motorcycle type to match what motorcycleService expects.
    const formData = this.motorcycleForm.value as Omit<Motorcycle, 'id'>;
    const editingId = this.editingMotorcycleId();

    const operation = editingId
      ? this.motorcycleService.updateMotorcycle({ id: editingId, ...formData })
      : this.motorcycleService.addMotorcycle(formData);

    operation.subscribe({
      next: () => {
        this.cancelEdit();
        this.isSubmitting.set(false);
      },
      error: () => {
        // In a real app, show an error toast
        this.isSubmitting.set(false);
      }
    });
  }

  openBrandModal(): void {
    const brandName = prompt('Ingrese el nombre de la nueva marca:');
    if (brandName && brandName.trim()) {
      // For now, just show a confirmation. In a real implementation,
      // this would save to a brands collection or update the motorcycle service
      alert(`Marca "${brandName.trim()}" agregada exitosamente.`);
    }
  }

  // Brand management methods
  editBrand(brand: Brand): void {
    this.editingBrandId.set(brand.id);
    this.brandForm.patchValue(brand);
  }

  cancelBrandEdit(): void {
    this.editingBrandId.set(null);
    this.brandForm.reset();
  }

  async deleteBrand(id: string): Promise<void> {
    if (confirm('¿Estás seguro de que quieres eliminar esta marca?')) {
      try {
        // TODO: Replace with BrandService when created
        // For now, just remove from local state
        this.brands.update(brands => brands.filter(b => b.id !== id));
        console.log('Brand deleted successfully (local only)');
      } catch (error) {
        console.error('Error deleting brand:', error);
        alert('Error al eliminar la marca');
      }
    }
  }

  async onBrandSubmit(): Promise<void> {
    if (this.brandForm.invalid) {
      return;
    }
    this.isBrandSubmitting.set(true);

    try {
      const formData = this.brandForm.value as Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>;
      const editingId = this.editingBrandId();

      if (editingId) {
        // TODO: Replace with BrandService when created
        // For now, just update local state
        this.brands.update(brands =>
          brands.map(b => b.id === editingId ? { ...b, ...formData } : b)
        );
        console.log('Brand updated successfully (local only)');
      } else {
        // TODO: Replace with BrandService when created
        // For now, just add to local state
        const newBrand: any = {
          id: Date.now().toString(),
          ...formData
        };
        this.brands.update(brands => [...brands, newBrand]);
        console.log('Brand created successfully (local only)');
      }

      this.cancelBrandEdit();
    } catch (error) {
      console.error('Error saving brand:', error);
      alert('Error al guardar la marca');
    } finally {
      this.isBrandSubmitting.set(false);
    }
  }

  getMotorcycleCountForBrand(brandName: string): number {
    return this.motorcycles().filter(m => m.brand === brandName).length;
  }
}