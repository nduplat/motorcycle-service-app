import { Injectable, signal, computed, inject } from '@angular/core';
import { ServiceItem } from '../models';
import { ServiceItemService } from './service-item.service';
import { db } from '../firebase.config';
import { writeBatch, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

export type SortField = 'title' | 'type' | 'price' | 'estimatedHours' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export interface ServiceFilters {
  search: string;
  type: string;
  priceMin: number | null;
  priceMax: number | null;
  hoursMin: number | null;
  hoursMax: number | null;
  skills: string[];
  isActive: boolean | null;
}

@Injectable({
  providedIn: 'root'
})
export class AdvancedServiceService {
  private serviceItemService = inject(ServiceItemService);

  // State signals
  private services = this.serviceItemService.getServices();
  private currentPage = signal(1);
  private pageSize = signal(10);
  private sortField = signal<SortField>('title');
  private sortDirection = signal<SortDirection>('asc');
  private selectedServiceIds = signal<string[]>([]);

  // Filter signals
  private searchTerm = signal('');
  private typeFilter = signal('');
  private priceMinFilter = signal<number | null>(null);
  private priceMaxFilter = signal<number | null>(null);
  private hoursMinFilter = signal<number | null>(null);
  private hoursMaxFilter = signal<number | null>(null);
  private skillsFilter = signal<string[]>([]);
  private activeFilter = signal<boolean | null>(null);

  // Computed filters object
  private filters = computed(() => ({
    search: this.searchTerm(),
    type: this.typeFilter(),
    priceMin: this.priceMinFilter(),
    priceMax: this.priceMaxFilter(),
    hoursMin: this.hoursMinFilter(),
    hoursMax: this.hoursMaxFilter(),
    skills: this.skillsFilter(),
    isActive: this.activeFilter()
  }));

  // Filtered services
  private filteredServices = computed(() => {
    let filtered = this.services();

    const filters = this.filters();

    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(service =>
        service.title?.toLowerCase().includes(search) ||
        service.description?.toLowerCase().includes(search) ||
        service.code?.toLowerCase().includes(search) ||
        service.requiredSkills?.some(skill => skill.toLowerCase().includes(search))
      );
    }

    // Type filter
    if (filters.type) {
      filtered = filtered.filter(service => service.type === filters.type);
    }

    // Price range filter
    if (filters.priceMin !== null) {
      filtered = filtered.filter(service => (service.price || 0) >= filters.priceMin!);
    }
    if (filters.priceMax !== null) {
      filtered = filtered.filter(service => (service.price || 0) <= filters.priceMax!);
    }

    // Hours range filter
    if (filters.hoursMin !== null) {
      filtered = filtered.filter(service => (service.estimatedHours || 0) >= filters.hoursMin!);
    }
    if (filters.hoursMax !== null) {
      filtered = filtered.filter(service => (service.estimatedHours || 0) <= filters.hoursMax!);
    }

    // Skills filter
    if (filters.skills.length > 0) {
      filtered = filtered.filter(service =>
        filters.skills.every(skill =>
          service.requiredSkills?.includes(skill)
        )
      );
    }

    // Active filter
    if (filters.isActive !== null) {
      filtered = filtered.filter(service => service.isActive !== false); // Default to active if not set
    }

    return filtered;
  });

  // Sorted services
  private sortedServices = computed(() => {
    const services = this.filteredServices();
    const field = this.sortField();
    const direction = this.sortDirection();

    return [...services].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (field) {
        case 'title':
          aValue = a.title || '';
          bValue = b.title || '';
          break;
        case 'type':
          aValue = a.type || '';
          bValue = b.type || '';
          break;
        case 'price':
          aValue = a.price || 0;
          bValue = b.price || 0;
          break;
        case 'estimatedHours':
          aValue = a.estimatedHours || 0;
          bValue = b.estimatedHours || 0;
          break;
        case 'createdAt':
          aValue = a.createdAt?.toDate().getTime() || 0;
          bValue = b.createdAt?.toDate().getTime() || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  });

  // Paginated services
  paginatedServices = computed(() => {
    const services = this.sortedServices();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    const end = start + size;

    return services.slice(start, end);
  });

  // Pagination info
  totalItems = computed(() => this.sortedServices().length);
  totalPages = computed(() => Math.ceil(this.totalItems() / this.pageSize()));
  hasNextPage = computed(() => this.currentPage() < this.totalPages());
  hasPreviousPage = computed(() => this.currentPage() > 1);

  // Statistics
  serviceStats = computed(() => {
    const allServices = this.services();
    const filteredServices = this.filteredServices();

    const totalServices = allServices.length;
    const activeServices = allServices.filter(s => s.isActive !== false).length;
    const maintenanceServices = allServices.filter(s => s.type === 'maintenance').length;
    const repairServices = allServices.filter(s => s.type === 'repair').length;
    const inspectionServices = allServices.filter(s => s.type === 'inspection').length;
    const customizationServices = allServices.filter(s => s.type === 'customization').length;

    const avgPrice = allServices.length > 0
      ? allServices.reduce((sum, s) => sum + (s.price || 0), 0) / allServices.length
      : 0;

    const avgHours = allServices.length > 0
      ? allServices.reduce((sum, s) => sum + (s.estimatedHours || 0), 0) / allServices.length
      : 0;

    const totalValue = allServices.reduce((sum, s) => sum + (s.price || 0), 0);

    return {
      totalServices,
      activeServices,
      maintenanceServices,
      repairServices,
      inspectionServices,
      customizationServices,
      avgPrice,
      avgHours,
      totalValue,
      filteredCount: filteredServices.length
    };
  });

  // Available filter options
  availableTypes = computed(() => {
    const types = new Set(this.services().map(s => s.type).filter(Boolean));
    return Array.from(types).sort();
  });

  availableSkills = computed(() => {
    const skills = new Set<string>();
    this.services().forEach(service => {
      service.requiredSkills?.forEach(skill => skills.add(skill));
    });
    return Array.from(skills).sort();
  });

  // Methods
  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1); // Reset to first page
  }

  setSorting(field: SortField, direction?: SortDirection): void {
    this.sortField.set(field);
    if (direction) {
      this.sortDirection.set(direction);
    } else {
      // Toggle direction if same field
      this.sortDirection.set(
        this.sortField() === field && this.sortDirection() === 'asc' ? 'desc' : 'asc'
      );
    }
  }

  // Filter methods
  setSearchTerm(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1);
  }

  setTypeFilter(type: string): void {
    this.typeFilter.set(type);
    this.currentPage.set(1);
  }

  setPriceRange(min: number | null, max: number | null): void {
    this.priceMinFilter.set(min);
    this.priceMaxFilter.set(max);
    this.currentPage.set(1);
  }

  setHoursRange(min: number | null, max: number | null): void {
    this.hoursMinFilter.set(min);
    this.hoursMaxFilter.set(max);
    this.currentPage.set(1);
  }

  setSkillsFilter(skills: string[]): void {
    this.skillsFilter.set(skills);
    this.currentPage.set(1);
  }

  setActiveFilter(active: boolean | null): void {
    this.activeFilter.set(active);
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.typeFilter.set('');
    this.priceMinFilter.set(null);
    this.priceMaxFilter.set(null);
    this.hoursMinFilter.set(null);
    this.hoursMaxFilter.set(null);
    this.skillsFilter.set([]);
    this.activeFilter.set(null);
    this.currentPage.set(1);
  }

  // Selection methods
  toggleServiceSelection(serviceId: string): void {
    const current = this.selectedServiceIds();
    if (current.includes(serviceId)) {
      this.selectedServiceIds.set(current.filter(id => id !== serviceId));
    } else {
      this.selectedServiceIds.set([...current, serviceId]);
    }
  }

  selectAllServices(): void {
    const allIds = this.paginatedServices().map(s => s.id);
    this.selectedServiceIds.set(allIds);
  }

  clearSelection(): void {
    this.selectedServiceIds.set([]);
  }

  isServiceSelected(serviceId: string): boolean {
    return this.selectedServiceIds().includes(serviceId);
  }

  getSelectedServices(): ServiceItem[] {
    const selectedIds = this.selectedServiceIds();
    return this.services().filter(s => selectedIds.includes(s.id));
  }

  // Bulk operations
  async bulkActivateServices(): Promise<void> {
    const selectedServices = this.getSelectedServices();
    const batch = writeBatch(db);

    for (const service of selectedServices) {
      const docRef = doc(db, "services", service.id);
      batch.update(docRef, {
        isActive: true,
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();
    this.clearSelection();
  }

  async bulkDeactivateServices(): Promise<void> {
    const selectedServices = this.getSelectedServices();
    const batch = writeBatch(db);

    for (const service of selectedServices) {
      const docRef = doc(db, "services", service.id);
      batch.update(docRef, {
        isActive: false,
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();
    this.clearSelection();
  }

  async bulkDeleteServices(): Promise<void> {
    const selectedServices = this.getSelectedServices();
    const batch = writeBatch(db);

    for (const service of selectedServices) {
      const docRef = doc(db, "services", service.id);
      batch.delete(docRef);
    }

    await batch.commit();
    this.clearSelection();
  }

  // Export methods
  exportToCSV(): void {
    const services = this.sortedServices();
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

  // Getters for external access
  getCurrentPage(): number {
    return this.currentPage();
  }

  getPageSize(): number {
    return this.pageSize();
  }

  getSortField(): SortField {
    return this.sortField();
  }

  getSortDirection(): SortDirection {
    return this.sortDirection();
  }

  getFilters(): ServiceFilters {
    return this.filters();
  }

  getSelectedCount(): number {
    return this.selectedServiceIds().length;
  }
}