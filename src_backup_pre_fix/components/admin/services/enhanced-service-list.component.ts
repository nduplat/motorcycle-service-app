import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ServiceItemService } from '../../../services/service-item.service';
import { AdvancedServiceService, SortField, SortDirection } from '../../../services/advanced-service.service';
import { ServiceItem } from '../../../models';
import { ServiceType } from '../../../models/types';
import { PaginationComponent } from '../../shared/ui/pagination.component';

@Component({
  selector: 'app-enhanced-service-list',
  templateUrl: './enhanced-service-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PaginationComponent],
})
export class EnhancedServiceListComponent {
  private fb = inject(FormBuilder);
  private serviceItemService = inject(ServiceItemService);
  private advancedServiceService = inject(AdvancedServiceService);

  // State signals
  isSubmitting = signal(false);
  editingServiceId = signal<string | null>(null);
  showFilters = signal(false);
  showBulkActions = signal(false);

  // Service data
  services = this.advancedServiceService.paginatedServices;
  serviceStats = this.advancedServiceService.serviceStats;

  // Pagination
  currentPage = computed(() => this.advancedServiceService.getCurrentPage());
  totalPages = this.advancedServiceService.totalPages;
  totalItems = this.advancedServiceService.totalItems;
  hasNextPage = this.advancedServiceService.hasNextPage;
  hasPreviousPage = this.advancedServiceService.hasPreviousPage;

  // Sorting
  sortField = computed(() => this.advancedServiceService.getSortField());
  sortDirection = computed(() => this.advancedServiceService.getSortDirection());

  // Selection
  selectedServiceIds = computed(() => this.advancedServiceService.getSelectedCount());

  // Filter options
  availableTypes = this.advancedServiceService.availableTypes;
  availableSkills = this.advancedServiceService.availableSkills;

  // Form states
  formTitle = computed(() => this.editingServiceId() ? 'Editar Servicio' : 'Añadir Nuevo Servicio');

  serviceTypes: ServiceType[] = [ServiceType.MAINTENANCE, ServiceType.REPAIR, ServiceType.INSPECTION, ServiceType.CUSTOMIZATION];

  // Filter form
  filterForm = this.fb.group({
    search: [''],
    type: [''],
    priceMin: [null as number | null],
    priceMax: [null as number | null],
    hoursMin: [null as number | null],
    hoursMax: [null as number | null],
    skills: [[] as string[]],
    isActive: [null as boolean | null]
  });

  // Service form
  serviceForm = this.fb.group({
    code: [''],
    title: ['', Validators.required],
    description: [''],
    type: [ServiceType.MAINTENANCE, Validators.required],
    estimatedHours: [1, [Validators.required, Validators.min(0.5)]],
    price: [0, [Validators.required, Validators.min(0)]],
    partsSuggested: [[] as string[]],
    requiredSkills: [''],
    compatibleBrands: [''],
    compatibleModels: [''],
    isActive: [true],
    notificationDays: [30, [Validators.min(1)]]
  });

  // Computed properties
  selectedCount = computed(() => this.advancedServiceService.getSelectedCount());
  hasSelection = computed(() => this.selectedCount() > 0);

  // Methods
  ngOnInit() {
    // Initialize with default values
    this.filterForm.patchValue({
      search: '',
      type: '',
      priceMin: null,
      priceMax: null,
      hoursMin: null,
      hoursMax: null,
      skills: [],
      isActive: null
    });
  }

  // Sorting methods
  sortBy(field: SortField) {
    const currentField = this.sortField();
    const currentDirection = this.sortDirection();

    let newDirection: SortDirection = 'asc';
    if (field === currentField && currentDirection === 'asc') {
      newDirection = 'desc';
    }

    this.advancedServiceService.setSorting(field, newDirection);
  }

  getSortIcon(field: SortField): string {
    const currentField = this.sortField();
    const currentDirection = this.sortDirection();

    if (field !== currentField) return '↕️';
    return currentDirection === 'asc' ? '↑' : '↓';
  }

  // Filtering methods
  toggleFilters() {
    this.showFilters.set(!this.showFilters());
  }

  applyFilters() {
    const filters = this.filterForm.value;
    this.advancedServiceService.setSearchTerm(filters.search || '');
    this.advancedServiceService.setTypeFilter(filters.type || '');
    this.advancedServiceService.setPriceRange(filters.priceMin ?? null, filters.priceMax ?? null);
    this.advancedServiceService.setHoursRange(filters.hoursMin ?? null, filters.hoursMax ?? null);
    this.advancedServiceService.setSkillsFilter(filters.skills || []);
    this.advancedServiceService.setActiveFilter(filters.isActive ?? null);
  }

  clearFilters() {
    this.filterForm.reset({
      search: '',
      type: '',
      priceMin: null,
      priceMax: null,
      hoursMin: null,
      hoursMax: null,
      skills: [],
      isActive: null
    });
    this.advancedServiceService.clearFilters();
  }

  // Selection methods
  toggleServiceSelection(serviceId: string) {
    this.advancedServiceService.toggleServiceSelection(serviceId);
    this.showBulkActions.set(this.hasSelection());
  }

  toggleSelectAll() {
    if (this.selectedCount() === this.services().length) {
      this.advancedServiceService.clearSelection();
    } else {
      this.advancedServiceService.selectAllServices();
    }
    this.showBulkActions.set(this.hasSelection());
  }

  isServiceSelected(serviceId: string): boolean {
    return this.advancedServiceService.isServiceSelected(serviceId);
  }

  // Bulk operations
  async bulkActivate() {
    if (confirm(`¿Activar ${this.selectedCount()} servicios seleccionados?`)) {
      this.isSubmitting.set(true);
      try {
        await this.advancedServiceService.bulkActivateServices();
      } finally {
        this.isSubmitting.set(false);
      }
    }
  }

  async bulkDeactivate() {
    if (confirm(`¿Desactivar ${this.selectedCount()} servicios seleccionados?`)) {
      this.isSubmitting.set(true);
      try {
        await this.advancedServiceService.bulkDeactivateServices();
      } finally {
        this.isSubmitting.set(false);
      }
    }
  }

  async bulkDelete() {
    if (confirm(`¿Eliminar ${this.selectedCount()} servicios seleccionados? Esta acción no se puede deshacer.`)) {
      this.isSubmitting.set(true);
      try {
        await this.advancedServiceService.bulkDeleteServices();
      } finally {
        this.isSubmitting.set(false);
      }
    }
  }

  // CRUD operations
  editService(service: ServiceItem) {
    this.editingServiceId.set(service.id);

    const partsSuggestedIds = service.partsSuggested?.map(p => p.productId) || [];

    this.serviceForm.patchValue({
      code: service.code || '',
      title: service.title,
      description: service.description || '',
      type: service.type || ServiceType.MAINTENANCE,
      estimatedHours: service.estimatedHours || 1,
      price: service.price || 0,
      partsSuggested: partsSuggestedIds,
      requiredSkills: service.requiredSkills?.join(', ') || '',
      compatibleBrands: service.compatibleBrands?.join(', ') || '',
      compatibleModels: service.compatibleModels?.join(', ') || '',
      isActive: service.isActive !== false,
      notificationDays: service.notificationDays || 30
    });
  }

  cancelEdit() {
    this.editingServiceId.set(null);
    this.serviceForm.reset({
      code: '',
      title: '',
      description: '',
      type: ServiceType.MAINTENANCE,
      estimatedHours: 1,
      price: 0,
      partsSuggested: [],
      requiredSkills: '',
      compatibleBrands: '',
      compatibleModels: '',
      isActive: true,
      notificationDays: 30
    });
  }

  async onSubmit() {
    if (this.serviceForm.invalid) return;

    this.isSubmitting.set(true);
    try {
      const formValue = this.serviceForm.getRawValue();
      const editingId = this.editingServiceId();

      const partsSuggestedForModel = formValue.partsSuggested
        ? formValue.partsSuggested.map((id: string) => ({ productId: id, qty: 1 }))
        : [];

      const serviceData = {
        code: formValue.code || undefined,
        title: formValue.title,
        description: formValue.description || undefined,
        type: formValue.type,
        estimatedHours: formValue.estimatedHours,
        price: formValue.price,
        partsSuggested: partsSuggestedForModel,
        requiredSkills: formValue.requiredSkills ? formValue.requiredSkills.split(',').map((s: string) => s.trim()) : [],
        compatibleBrands: formValue.compatibleBrands ? formValue.compatibleBrands.split(',').map((s: string) => s.trim()) : [],
        compatibleModels: formValue.compatibleModels ? formValue.compatibleModels.split(',').map((s: string) => s.trim()) : [],
        isActive: formValue.isActive,
        notificationDays: formValue.notificationDays
      };

      if (editingId) {
        await this.serviceItemService.updateServiceItem({ id: editingId, ...serviceData } as ServiceItem).toPromise();
      } else {
        await this.serviceItemService.addServiceItem(serviceData as Omit<ServiceItem, 'id' | 'createdAt' | 'updatedAt'>).toPromise();
      }

      this.cancelEdit();
    } finally {
      this.isSubmitting.set(false);
    }
  }

  deleteService(service: ServiceItem) {
    if (confirm(`¿Eliminar el servicio "${service.title}"?`)) {
      this.serviceItemService.deleteServiceItem(service.id).subscribe();
    }
  }

  // Pagination
  goToPage(page: number) {
    this.advancedServiceService.setPage(page);
  }

  changePageSize(size: number) {
    this.advancedServiceService.setPageSize(size);
  }

  // Export
  exportToCSV() {
    const services = this.advancedServiceService.getSortedServices();
    const headers = [
      'Código',
      'Título',
      'Descripción',
      'Tipo',
      'Horas Estimadas',
      'Precio',
      'Habilidades Requeridas',
      'Estado',
      'Fecha Creación'
    ];

    const csvContent = [
      headers.join(','),
      ...services.map(service => [
        service.code || '',
        `"${service.title || ''}"`,
        `"${service.description || ''}"`,
        service.type || '',
        service.estimatedHours || '',
        service.price || '',
        `"${service.requiredSkills?.join('; ') || ''}"`,
        service.isActive !== false ? 'Activo' : 'Inactivo',
        service.createdAt?.toDate().toLocaleDateString('es-CO') || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `servicios_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Utility methods
  formatCurrency(value: number | undefined): string {
    if (value === undefined) return 'N/A';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  }

  formatDate(date: { toDate: () => Date }): string {
    return date.toDate().toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getTypeLabel(type: ServiceType): string {
    const labels = {
      [ServiceType.MAINTENANCE]: 'Mantenimiento',
      [ServiceType.REPAIR]: 'Reparación',
      [ServiceType.INSPECTION]: 'Inspección',
      [ServiceType.CUSTOMIZATION]: 'Personalización'
    };
    return labels[type] || type;
  }

  getStatusBadge(service: ServiceItem): { text: string; class: string } {
    if (service.isActive === false) {
      return { text: 'Inactivo', class: 'bg-red-100 text-red-800' };
    }
    return { text: 'Activo', class: 'bg-green-100 text-green-800' };
  }
}