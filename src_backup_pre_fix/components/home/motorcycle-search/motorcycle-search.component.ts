import { Component, input, output, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

export interface MotorcycleFilters {
  searchQuery: string;
  brand: string;
  category: string;
  type: string;
  year: number | null;
  minYear: number | null;
  maxYear: number | null;
}

export interface FilterOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-motorcycle-filters',
  templateUrl: './motorcycle-search.component.html',
  standalone: true,
  imports: [ReactiveFormsModule]
})
export class MotorcycleFiltersComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private fb = inject(FormBuilder);

  // Inputs
  availableBrands = input<string[]>([]);
  availableTypes = input<FilterOption[]>([]);
  availableYears = input<number[]>([]);
  resultCount = input<number>(0);
  loading = input<boolean>(false);
  compact = input<boolean>(false);
  showAdvancedFilters = input<boolean>(true);
  placeholder = input<string>('Buscar por marca o modelo...');
  debounceTime = input<number>(300);

  // Outputs
  filtersChanged = output<MotorcycleFilters>();
  resetFilters = output<void>();

  // Internal state
  showYearRange = signal(false);
  activeFiltersCount = signal(0);

  // Form
  filtersForm: FormGroup = this.fb.group({
    searchQuery: [''],
    brand: [''],
    category: [''],
    type: [''],
    year: [''],
    minYear: [''],
    maxYear: ['']
  });

  // Computed properties
  categoryOptions = computed(() => [
    { value: '', label: 'Todos los tamaños' },
    { value: 'bajo_cc', label: '🐣 Pequeñas (hasta 250cc)' },
    { value: 'mediano_cc', label: '🦅 Medianas (250-650cc)' },
    { value: 'alto_cc', label: '🦈 Grandes (más de 650cc)' }
  ]);

  brandOptions = computed(() => [
    { value: '', label: 'Todas las marcas' },
    ...this.availableBrands().map(brand => ({ value: brand, label: brand }))
  ]);

  typeOptions = computed(() => [
    { value: '', label: 'Todos los tipos' },
    ...this.availableTypes()
  ]);

  yearOptions = computed(() => [
    { value: '', label: 'Cualquier año' },
    ...this.availableYears().map(year => ({ value: year.toString(), label: year.toString() }))
  ]);

  activeFiltersList = computed(() => {
    const filters = this.getCurrentFilters();
    const activeFilters: Array<{key: string, label: string, value: string}> = [];

    if (filters.searchQuery) {
      activeFilters.push({
        key: 'searchQuery',
        label: 'Búsqueda',
        value: `"${filters.searchQuery}"`
      });
    }

    if (filters.brand) {
      activeFilters.push({
        key: 'brand',
        label: 'Marca',
        value: filters.brand
      });
    }

    if (filters.category) {
      const categoryLabel = this.categoryOptions().find(opt => opt.value === filters.category)?.label || filters.category;
      activeFilters.push({
        key: 'category',
        label: 'Categoría',
        value: categoryLabel
      });
    }

    if (filters.type) {
      const typeLabel = this.availableTypes().find(opt => opt.value === filters.type)?.label || filters.type;
      activeFilters.push({
        key: 'type',
        label: 'Tipo',
        value: typeLabel
      });
    }

    if (filters.year) {
      activeFilters.push({
        key: 'year',
        label: 'Año',
        value: filters.year.toString()
      });
    }

    if (filters.minYear) {
      activeFilters.push({
        key: 'minYear',
        label: 'Desde',
        value: filters.minYear.toString()
      });
    }

    if (filters.maxYear) {
      activeFilters.push({
        key: 'maxYear',
        label: 'Hasta',
        value: filters.maxYear.toString()
      });
    }

    return activeFilters;
  });

  hasActiveFilters = computed(() => this.activeFiltersList().length > 0);

  ngOnInit() {
    this.setupFormSubscription();
    this.setupYearRangeLogic();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupFormSubscription() {
    this.filtersForm.valueChanges
      .pipe(
        debounceTime(this.debounceTime()),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.emitFilters();
        this.updateActiveFiltersCount();
      });
  }

  private setupYearRangeLogic() {
    this.filtersForm.get('year')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(year => {
        this.showYearRange.set(!year);
        if (year) {
          this.filtersForm.patchValue({
            minYear: '',
            maxYear: ''
          }, { emitEvent: false });
        }
      });
  }

  private emitFilters() {
    const formValue = this.filtersForm.value;
    const filters: MotorcycleFilters = {
      searchQuery: formValue.searchQuery || '',
      brand: formValue.brand || '',
      category: formValue.category || '',
      type: formValue.type || '',
      year: formValue.year ? parseInt(formValue.year) : null,
      minYear: formValue.minYear ? parseInt(formValue.minYear) : null,
      maxYear: formValue.maxYear ? parseInt(formValue.maxYear) : null
    };

    this.filtersChanged.emit(filters);
  }

  private updateActiveFiltersCount() {
    this.activeFiltersCount.set(this.activeFiltersList().length);
  }

  private getCurrentFilters(): MotorcycleFilters {
    const formValue = this.filtersForm.value;
    return {
      searchQuery: formValue.searchQuery || '',
      brand: formValue.brand || '',
      category: formValue.category || '',
      type: formValue.type || '',
      year: formValue.year ? parseInt(formValue.year) : null,
      minYear: formValue.minYear ? parseInt(formValue.minYear) : null,
      maxYear: formValue.maxYear ? parseInt(formValue.maxYear) : null
    };
  }

  clearAllFilters() {
    this.filtersForm.reset();
    this.showYearRange.set(false);
    this.resetFilters.emit();
  }

  removeFilter(key: string) {
    this.filtersForm.patchValue({ [key]: '' });
  }

  toggleYearRange() {
    this.showYearRange.set(!this.showYearRange());
  }

  // Public methods for external control
  setFilters(filters: Partial<MotorcycleFilters>) {
    const formValue: any = {};
    
    if (filters.searchQuery !== undefined) formValue.searchQuery = filters.searchQuery;
    if (filters.brand !== undefined) formValue.brand = filters.brand;
    if (filters.category !== undefined) formValue.category = filters.category;
    if (filters.type !== undefined) formValue.type = filters.type;
    if (filters.year !== undefined) formValue.year = filters.year?.toString() || '';
    if (filters.minYear !== undefined) formValue.minYear = filters.minYear?.toString() || '';
    if (filters.maxYear !== undefined) formValue.maxYear = filters.maxYear?.toString() || '';

    this.filtersForm.patchValue(formValue);
  }

  getFilters(): MotorcycleFilters {
    return this.getCurrentFilters();
  }
}