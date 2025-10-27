import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ServiceItem } from '../../models';

export interface ServiceSelectionData {
  selectedServices: ServiceItem[];
  totalCost: number;
  estimatedTime: number;
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon?: string;
}

@Component({
  selector: 'app-service-selection',
  templateUrl: './service-selection.component.html',
  styleUrls: ['./service-selection.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class ServiceSelectionComponent implements OnInit {
  @Input() availableServices: ServiceItem[] = [];
  @Input() selectedServiceIds: string[] = [];
  @Input() motorcycleBrand?: string;
  @Input() motorcycleModel?: string;

  @Output() serviceSelectionChange = new EventEmitter<ServiceSelectionData>();

  // State management
  searchQuery = signal('');
  selectedCategory = signal<string>('all');
  selectedServices = signal<Set<string>>(new Set());

  // Service categories
  categories: ServiceCategory[] = [
    { id: 'all', name: 'Todos los Servicios' },
    { id: 'maintenance', name: 'Mantenimiento', icon: '🔧' },
    { id: 'repair', name: 'Reparación', icon: '🔨' },
    { id: 'inspection', name: 'Inspección', icon: '🔍' },
    { id: 'customization', name: 'Personalización', icon: '✨' }
  ];

  ngOnInit() {
    // Initialize selected services from input
    this.selectedServices.set(new Set(this.selectedServiceIds));
    this.emitSelectionChange();
  }

  // Filtered services based on search and category
  filteredServices = computed(() => {
    let services = this.availableServices;

    // Filter by category
    if (this.selectedCategory() !== 'all') {
      services = services.filter(service => service.type === this.selectedCategory());
    }

    // Filter by search query
    if (this.searchQuery()) {
      const query = this.searchQuery().toLowerCase();
      services = services.filter(service =>
        service.title.toLowerCase().includes(query) ||
        service.description?.toLowerCase().includes(query)
      );
    }

    // Filter by motorcycle compatibility if available
    if (this.motorcycleBrand || this.motorcycleModel) {
      services = services.filter(service =>
        service.compatibleBrands.includes(this.motorcycleBrand || '') ||
        service.compatibleModels.includes(this.motorcycleModel || '') ||
        service.compatibleBrands.length === 0 // Include services without brand restrictions
      );
    }

    return services;
  });

  // Selected services data
  selectedServicesData = computed(() => {
    const selectedIds = this.selectedServices();
    return this.availableServices.filter(service => selectedIds.has(service.id));
  });

  // Total cost calculation
  totalCost = computed(() => {
    return this.selectedServicesData().reduce((total, service) => total + (service.price || 0), 0);
  });

  // Estimated time calculation
  estimatedTime = computed(() => {
    return this.selectedServicesData().reduce((total, service) => total + (service.estimatedHours || 0), 0);
  });

  // Service dependencies and recommendations
  getServiceDependencies(service: ServiceItem): ServiceItem[] {
    // Simple dependency logic - in a real app, this would come from a service
    const dependencies: ServiceItem[] = [];

    if (service.type === 'repair') {
      // Repairs might require inspection first
      const inspectionServices = this.availableServices.filter(s =>
        s.type === 'inspection' && !this.selectedServices().has(s.id)
      );
      dependencies.push(...inspectionServices.slice(0, 1)); // Suggest one inspection
    }

    return dependencies;
  }

  getRecommendedServices(service: ServiceItem): ServiceItem[] {
    // Simple recommendation logic based on service type
    const recommendations: ServiceItem[] = [];

    if (service.type === 'maintenance') {
      // After maintenance, recommend inspection
      const inspectionServices = this.availableServices.filter(s =>
        s.type === 'inspection' && !this.selectedServices().has(s.id)
      );
      recommendations.push(...inspectionServices.slice(0, 2));
    }

    return recommendations;
  }

  // Event handlers
  onServiceToggle(service: ServiceItem) {
    const currentSelected = this.selectedServices();
    const newSelected = new Set(currentSelected);

    if (newSelected.has(service.id)) {
      newSelected.delete(service.id);
    } else {
      newSelected.add(service.id);

      // Auto-select dependencies
      const dependencies = this.getServiceDependencies(service);
      dependencies.forEach(dep => newSelected.add(dep.id));
    }

    this.selectedServices.set(newSelected);
    this.emitSelectionChange();
  }

  onCategoryChange(categoryId: string) {
    this.selectedCategory.set(categoryId);
  }

  onSearchChange(query: string) {
    this.searchQuery.set(query);
  }

  onAddRecommended(service: ServiceItem) {
    const currentSelected = this.selectedServices();
    const newSelected = new Set(currentSelected);
    newSelected.add(service.id);
    this.selectedServices.set(newSelected);
    this.emitSelectionChange();
  }

  private emitSelectionChange() {
    const data: ServiceSelectionData = {
      selectedServices: this.selectedServicesData(),
      totalCost: this.totalCost(),
      estimatedTime: this.estimatedTime()
    };
    this.serviceSelectionChange.emit(data);
  }

  // Utility methods
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  }

  formatTime(hours: number): string {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return minutes > 0 ? `${wholeHours}h ${minutes}min` : `${wholeHours}h`;
  }

  isServiceSelected(service: ServiceItem): boolean {
    return this.selectedServices().has(service.id);
  }
}