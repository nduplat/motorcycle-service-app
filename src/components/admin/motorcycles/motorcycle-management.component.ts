import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MotorcycleService } from '../../../services/motorcycle.service';
import { AuthService } from '../../../services/auth.service';
import { Motorcycle, MotorcycleCategory, MotorcycleType, MotorcycleFuelType, MotorcycleTransmission, Brand } from '../../../models';
import { Timestamp } from 'firebase/firestore';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { db } from '../../../firebase.config';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

@Component({
  selector: 'app-motorcycle-management',
  templateUrl: './motorcycle-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
})
export class MotorcycleManagementComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  motorcycleService = inject(MotorcycleService);

  // UI State
  isSubmitting = signal(false);
  editingMotorcycleId = signal<string | null>(null);
  showAdvancedForm = signal(false);
  activeTab = signal<'list' | 'grouped' | 'add'>('list');

  // Filtering and Search
  searchQuery = signal('');
  selectedCategory = signal<MotorcycleCategory | ''>('');
  selectedType = signal<MotorcycleType | ''>('');
  selectedBrand = signal<string>('');
  selectedYear = signal<number | ''>('');

  // Pagination
  currentPage = signal(1);
  pageSize = signal(20);

  // Sorting
  sortField = signal<'brand' | 'model' | 'category' | 'type' | 'displacementCc' | 'year' | 'isActive' | ''>('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Multiple Selection
  selectedMotorcycles = signal<Set<string>>(new Set());
  selectAll = signal(false);

  // Data
  motorcycles = this.motorcycleService.getMotorcycles();
  popularBrands = this.motorcycleService.getPopularBrands();
  popularTypes = this.motorcycleService.getPopularTypes();
  availableYears = computed(() => this.motorcycleService.getAvailableYears());

  // Brand Management
  brands = signal<Brand[]>([]);
  editingBrandId = signal<string | null>(null);
  showBrandForm = signal(false);

  // Popular motorcycle brands for dropdown
  popularMotorcycleBrands = [
    'Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'BMW', 'Ducati', 'Triumph',
    'KTM', 'Harley-Davidson', 'Aprilia', 'MV Agusta', 'Benelli', 'CFMoto',
    'Indian', 'Moto Guzzi', 'Royal Enfield', 'Bajaj', 'TVS', 'Hero',
    'Piaggio', 'Vespa', 'Can-Am', 'Arctic Cat', 'Polaris'
  ];

  // Computed properties
  formTitle = computed(() => this.editingMotorcycleId() ? 'Editar Motocicleta' : 'Añadir Nueva Motocicleta');

  filteredMotorcycles = computed(() => {
    const query = this.searchQuery();
    const filters: any = {};

    if (this.selectedCategory()) filters.category = this.selectedCategory();
    if (this.selectedType()) filters.type = this.selectedType();
    if (this.selectedBrand()) filters.brand = this.selectedBrand();
    if (this.selectedYear()) filters.minYear = filters.maxYear = this.selectedYear();

    let results = this.motorcycleService.searchMotorcycles(query, filters);

    // Apply sorting
    const sortField = this.sortField();
    const sortDirection = this.sortDirection();

    if (sortField) {
      results = [...results].sort((a, b) => {
        let aValue: any = a[sortField as keyof Motorcycle];
        let bValue: any = b[sortField as keyof Motorcycle];

        // Handle special cases
        if (sortField === 'brand') {
          aValue = (a.brand || '').toLowerCase();
          bValue = (b.brand || '').toLowerCase();
        } else if (sortField === 'model') {
          aValue = (a.model || '').toLowerCase();
          bValue = (b.model || '').toLowerCase();
        } else if (sortField === 'isActive') {
          aValue = a.isActive !== false; // true for active, false for inactive
          bValue = b.isActive !== false;
        } else {
          aValue = a[sortField as keyof Motorcycle];
          bValue = b[sortField as keyof Motorcycle];
        }

        // Handle null/undefined values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
        if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

        // Compare values
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return results;
  });

  // Pagination computed properties
  totalPages = computed(() => Math.ceil(this.filteredMotorcycles().length / this.pageSize()));
  paginatedMotorcycles = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize();
    const endIndex = startIndex + this.pageSize();
    return this.filteredMotorcycles().slice(startIndex, endIndex);
  });

  // Selection helpers
  isSelected = (id: string) => this.selectedMotorcycles().has(id);
  isAllSelected = computed(() => {
    const currentPageMotorcycles = this.paginatedMotorcycles();
    return currentPageMotorcycles.length > 0 &&
           currentPageMotorcycles.every(motorcycle => this.selectedMotorcycles().has(motorcycle.id));
  });

  groupedByCategory = computed(() => this.motorcycleService.getMotorcyclesGroupedByCategory());
  groupedByType = computed(() => this.motorcycleService.getMotorcyclesGroupedByType());
  groupedByBrand = computed(() => this.motorcycleService.getMotorcyclesGroupedByBrand());

  // Form with comprehensive fields
  motorcycleForm = this.fb.group({
    // Basic Information
    brand: ['', Validators.required],
    model: ['', Validators.required],
    year: [new Date().getFullYear(), [Validators.required, Validators.min(1900), Validators.max(new Date().getFullYear() + 1)]],
    plate: [''],

    // Engine & Performance
    displacementCc: [null as number | null, [Validators.min(50), Validators.max(3000)]],
    engineType: [''],
    fuelType: ['gasoline' as MotorcycleFuelType],
    transmission: ['manual' as MotorcycleTransmission],
    cylinders: [null as number | null, [Validators.min(1), Validators.max(6)]],
    valvesPerCylinder: [null as number | null, [Validators.min(1), Validators.max(8)]],
    cooling: ['air' as 'air' | 'liquid' | 'oil'],

    // Performance
    maxPowerHp: [null as number | null, [Validators.min(1), Validators.max(1000)]],
    maxTorqueNm: [null as number | null, [Validators.min(1), Validators.max(500)]],
    topSpeedKmh: [null as number | null, [Validators.min(50), Validators.max(400)]],

    // Physical Characteristics
    weightKg: [null as number | null, [Validators.min(50), Validators.max(500)]],
    fuelCapacityL: [null as number | null, [Validators.min(1), Validators.max(50)]],
    fuelEfficiencyKml: [null as number | null, [Validators.min(5), Validators.max(100)]],
    seatHeightMm: [null as number | null, [Validators.min(500), Validators.max(1000)]],
    wheelbaseMm: [null as number | null, [Validators.min(1000), Validators.max(2000)]],
    groundClearanceMm: [null as number | null, [Validators.min(100), Validators.max(500)]],

    // Features
    abs: [false],
    tractionControl: [false],
    quickShifter: [false],
    cruiseControl: [false],
    heatedSeats: [false],
    adjustableSuspension: [false],
    bluetooth: [false],
    usbCharging: [false],

    // Classification (auto-filled but editable)
    type: ['' as MotorcycleType | ''],
    subType: [''],

    // Business
    basePrice: [null as number | null, [Validators.min(0)]],
    currency: ['COP'],

    // Media & Documentation
    images: [[] as string[]],
    brochureUrl: [''],
    manualUrl: [''],

    // Additional
    description: [''],
    notes: [''],
    tags: [[] as string[]],
    isActive: [true]
  });

  // Brand Form
  brandForm = this.fb.group({
    name: ['', Validators.required],
    country: [''],
    foundedYear: [null as number | null, [Validators.min(1800), Validators.max(new Date().getFullYear())]],
    logoUrl: [''],
    website: [''],
    description: [''],
    isActive: [true]
  });

  constructor() {
    // Load brands
    this.loadBrands();

    // Auto-categorize when displacement changes
    this.motorcycleForm.get('displacementCc')?.valueChanges.subscribe(cc => {
      if (cc) {
        const category = this.motorcycleService.categorizationService.categorizeByCC(cc);
        // Category is computed automatically, no need to set it in form
      }
    });

    // Auto-suggest type based on brand/model
    this.motorcycleForm.get('brand')?.valueChanges.subscribe(() => this.autoSuggestType());
    this.motorcycleForm.get('model')?.valueChanges.subscribe(() => this.autoSuggestType());
  }

  private async loadBrands(): Promise<void> {
    try {
      const querySnapshot = await getDocs(collection(db, 'brands'));
      const brandsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Brand[];
      this.brands.set(brandsData);
    } catch (error) {
      console.error('Error loading brands:', error);
    }
  }

  private autoSuggestType(): void {
    const brand = this.motorcycleForm.get('brand')?.value;
    const model = this.motorcycleForm.get('model')?.value;

    if (brand && model) {
      const suggestedType = this.motorcycleService.categorizationService.suggestType({
        brand,
        model,
        description: this.motorcycleForm.get('description')?.value || undefined
      });

      if (suggestedType && !this.motorcycleForm.get('type')?.value) {
        this.motorcycleForm.patchValue({ type: suggestedType });
      }
    }
  }

  // Navigation
  setActiveTab(tab: 'list' | 'grouped' | 'add'): void {
    this.activeTab.set(tab);
    if (tab === 'add') {
      this.cancelEdit();
    }
  }

  // CRUD Operations
  editMotorcycle(motorcycle: Motorcycle): void {
    this.editingMotorcycleId.set(motorcycle.id);
    this.motorcycleForm.patchValue(motorcycle);
    this.activeTab.set('add');
  }

  cancelEdit(): void {
    this.editingMotorcycleId.set(null);
    this.motorcycleForm.reset({
      year: new Date().getFullYear(),
      fuelType: 'gasoline',
      transmission: 'manual',
      cooling: 'air',
      currency: 'COP',
      isActive: true,
      images: [],
      tags: []
    });
  }

  deleteMotorcycle(id: string): void {
    const motorcycle = this.motorcycles().find(m => m.id === id);
    if (confirm(`¿Estás seguro de que quieres eliminar "${motorcycle?.brand} ${motorcycle?.model}"?`)) {
        this.motorcycleService.deleteMotorcycle(id).subscribe({
          next: () => {
            // Success - signal will update automatically
          },
          error: (error) => {
            alert(`Error al eliminar motocicleta: ${error.message}`);
          }
        });
    }
  }

  onSubmit(): void {
    if (this.motorcycleForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting.set(true);

    const formData = this.motorcycleForm.value as any;
    const editingId = this.editingMotorcycleId();

    // Validate motorcycle data
    const validation = this.motorcycleService.validateMotorcycle(formData);
    if (!validation.isValid) {
      alert(`Errores de validación:\n${validation.errors.join('\n')}`);
      this.isSubmitting.set(false);
      return;
    }

    const operation = editingId
      ? this.motorcycleService.updateMotorcycle({ id: editingId, ...formData } as Motorcycle)
      : this.motorcycleService.addMotorcycle(formData);

    operation.subscribe({
      next: () => {
        this.cancelEdit();
        this.isSubmitting.set(false);
        this.activeTab.set('list');
      },
      error: (error) => {
        alert(`Error al guardar motocicleta: ${error.message}`);
        this.isSubmitting.set(false);
      }
    });
  }

  private markFormGroupTouched(): void {
    Object.keys(this.motorcycleForm.controls).forEach(key => {
      const control = this.motorcycleForm.get(key);
      control?.markAsTouched();
    });
  }

  // Filtering and Search
  updateSearch(query: string): void {
    this.searchQuery.set(query);
  }

  filterByCategory(category: MotorcycleCategory | ''): void {
    this.selectedCategory.set(category);
  }

  filterByType(type: MotorcycleType | ''): void {
    this.selectedType.set(type);
  }

  filterByBrand(brand: string): void {
    this.selectedBrand.set(brand);
  }

  filterByYear(year: number | ''): void {
    this.selectedYear.set(year);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set('');
    this.selectedType.set('');
    this.selectedBrand.set('');
    this.selectedYear.set('');
    this.sortField.set('');
    this.sortDirection.set('asc');
    this.currentPage.set(1);
    this.selectedMotorcycles.set(new Set());
    this.selectAll.set(false);
  }

  // Sorting methods
  sortBy(field: 'brand' | 'model' | 'category' | 'type' | 'displacementCc' | 'year' | 'isActive'): void {
    if (this.sortField() === field) {
      // Toggle direction if same field
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, start with ascending
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.currentPage.set(1); // Reset to first page when sorting
  }

  getSortIcon(field: string): string {
    if (this.sortField() !== field) return '↕️';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  // Pagination methods
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      // Clear selection when changing pages
      this.selectedMotorcycles.set(new Set());
      this.selectAll.set(false);
    }
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.selectedMotorcycles.set(new Set());
    this.selectAll.set(false);
  }

  // Selection methods
  toggleSelectMotorcycle(id: string): void {
    const selected = new Set(this.selectedMotorcycles());
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    this.selectedMotorcycles.set(selected);
    this.updateSelectAllState();
  }

  toggleSelectAll(): void {
    const currentPageMotorcycles = this.paginatedMotorcycles();
    const selected = new Set(this.selectedMotorcycles());

    if (this.isAllSelected()) {
      // Deselect all on current page
      currentPageMotorcycles.forEach(motorcycle => selected.delete(motorcycle.id));
    } else {
      // Select all on current page
      currentPageMotorcycles.forEach(motorcycle => selected.add(motorcycle.id));
    }

    this.selectedMotorcycles.set(selected);
    this.updateSelectAllState();
  }

  private updateSelectAllState(): void {
    this.selectAll.set(this.isAllSelected());
  }

  clearSelection(): void {
    this.selectedMotorcycles.set(new Set());
    this.selectAll.set(false);
  }

  // Pagination helpers
  getPageNumber(index: number): number {
    const total = this.totalPages();
    if (total <= 7) return index + 1;

    const current = this.currentPage();
    if (current <= 4) {
      return index + 1;
    } else if (current >= total - 3) {
      return total - 6 + index;
    } else {
      return current - 3 + index;
    }
  }

  getVisiblePages(): number[] {
    const total = this.totalPages();
    const pages: number[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      const current = this.currentPage();
      if (current <= 4) {
        for (let i = 1; i <= 7; i++) {
          pages.push(i);
        }
      } else if (current >= total - 3) {
        for (let i = total - 6; i <= total; i++) {
          pages.push(i);
        }
      } else {
        for (let i = current - 3; i <= current + 3; i++) {
          pages.push(i);
        }
      }
    }

    return pages;
  }

  // Bulk operations
  bulkActivate(): void {
    const selectedIds = Array.from(this.selectedMotorcycles());
    if (selectedIds.length === 0) {
      alert('Selecciona al menos una motocicleta');
      return;
    }

    if (confirm(`¿Activar ${selectedIds.length} motocicleta(s)?`)) {
      // Implementation would go here - for now just clear selection
      this.clearSelection();
      alert('Funcionalidad de activación masiva próximamente');
    }
  }

  bulkDeactivate(): void {
    const selectedIds = Array.from(this.selectedMotorcycles());
    if (selectedIds.length === 0) {
      alert('Selecciona al menos una motocicleta');
      return;
    }

    if (confirm(`¿Desactivar ${selectedIds.length} motocicleta(s)?`)) {
      // Implementation would go here - for now just clear selection
      this.clearSelection();
      alert('Funcionalidad de desactivación masiva próximamente');
    }
  }

  bulkDelete(): void {
    const selectedIds = Array.from(this.selectedMotorcycles());
    if (selectedIds.length === 0) {
      alert('Selecciona al menos una motocicleta');
      return;
    }

    if (confirm(`¿Eliminar ${selectedIds.length} motocicleta(s)? Esta acción no se puede deshacer.`)) {
      // Implementation would go here - for now just clear selection
      this.clearSelection();
      alert('Funcionalidad de eliminación masiva próximamente');
    }
  }

  // Utility methods
  getCCRangeLabel(category: MotorcycleCategory): string {
    return this.motorcycleService.getCCRangeLabel(category);
  }

  getCCRangeColor(category: MotorcycleCategory): string {
    return this.motorcycleService.getCCRangeColor(category);
  }

  getTypeLabel(type: MotorcycleType): string {
    return this.motorcycleService.getTypeLabel(type);
  }

  getTypeColor(type: MotorcycleType): string {
    return this.motorcycleService.getTypeColor(type);
  }

  toggleAdvancedForm(): void {
    this.showAdvancedForm.set(!this.showAdvancedForm());
  }

  exportMotorcycles(): void {
    alert('Funcionalidad de exportación próximamente');
  }

  // Brand Management CRUD
  addBrand(): void {
    this.editingBrandId.set(null);
    this.brandForm.reset({ isActive: true });
    this.showBrandForm.set(true);
  }

  editBrand(brand: Brand): void {
    this.editingBrandId.set(brand.id);
    this.brandForm.patchValue(brand);
    this.showBrandForm.set(true);
  }

  cancelBrandEdit(): void {
    this.editingBrandId.set(null);
    this.brandForm.reset({ isActive: true });
    this.showBrandForm.set(false);
  }

  async saveBrand(): Promise<void> {
    if (this.brandForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    try {
      const formData = this.brandForm.value as Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>;
      const editingId = this.editingBrandId();

      if (editingId) {
        // Update existing brand
        await updateDoc(doc(db, 'brands', editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        this.brands.update(brands =>
          brands.map(b => b.id === editingId ? { ...b, ...formData } : b)
        );
        console.log('Brand updated successfully');
      } else {
        // Add new brand
        const docRef = await addDoc(collection(db, 'brands'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        const newBrand: Brand = {
          id: docRef.id,
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        } as Brand;
        this.brands.update(brands => [...brands, newBrand]);
        console.log('Brand created successfully');
      }

      this.cancelBrandEdit();
    } catch (error) {
      console.error('Error saving brand:', error);
      alert('Error al guardar la marca');
    }
  }

  async deleteBrand(id: string): Promise<void> {
    const brand = this.brands().find(b => b.id === id);
    if (confirm(`¿Estás seguro de que quieres eliminar la marca "${brand?.name}"?`)) {
      try {
        await deleteDoc(doc(db, 'brands', id));
        this.brands.update(brands => brands.filter(b => b.id !== id));
        console.log('Brand deleted successfully');
      } catch (error) {
        console.error('Error deleting brand:', error);
        alert('Error al eliminar la marca');
      }
    }
  }

}