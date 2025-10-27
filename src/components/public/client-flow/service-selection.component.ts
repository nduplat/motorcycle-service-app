/**
 * Service Selection Component - Step 3 of Client Flow
 *
 * Handles service selection from the available catalog.
 * Features:
 * - Service catalog browsing with filtering
 * - Service details display
 * - Selection validation
 * - Price and duration information
 */

import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientFlowService } from '../../../services/client-flow.service';
import { ServiceItem } from '../../../models';

@Component({
  selector: 'app-service-selection',
  templateUrl: './service-selection.component.html',
  styleUrls: ['./service-selection.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class ServiceSelectionComponent implements OnInit {
  readonly flowService = inject(ClientFlowService);

  // Component state
  selectedService = signal<ServiceItem | null>(null);
  searchTerm = signal<string>('');
  selectedCategory = signal<string>('');
  isValidating = signal<boolean>(false);
  validationError = signal<string | null>(null);

  // Flow state
  readonly flowState = this.flowService.flowState;
  readonly canProceed = this.flowService.canProceedToNext;

  // Available services with filtering
  readonly availableServices = computed(() => {
    let services = this.flowService.availableServices();

    // Apply search filter
    const search = this.searchTerm().toLowerCase().trim();
    if (search) {
      services = services.filter(service =>
        service.title?.toLowerCase().includes(search) ||
        service.description?.toLowerCase().includes(search) ||
        service.code?.toLowerCase().includes(search)
      );
    }

    // Apply category filter
    const category = this.selectedCategory();
    if (category) {
      services = services.filter(service => service.type === category);
    }

    return services;
  });

  // Available categories
  readonly availableCategories = computed(() => {
    const categories = new Set<string>();
    this.flowService.availableServices().forEach(service => {
      if (service.type) {
        categories.add(service.type);
      }
    });
    return Array.from(categories).sort();
  });

  // Computed properties
  readonly isServiceSelected = computed(() => {
    return this.selectedService() !== null;
  });

  readonly selectedServiceDetails = computed(() => {
    const service = this.selectedService();
    if (!service) return null;

    return {
      title: service.title || 'Servicio sin nombre',
      description: service.description || 'Sin descripción',
      price: service.price ? `$${service.price.toLocaleString('es-CO')}` : 'Precio no disponible',
      duration: service.estimatedHours ? `${service.estimatedHours} horas` : 'Duración no especificada',
      type: service.type || 'General',
      skills: service.requiredSkills || []
    };
  });

  readonly hasServices = computed(() => {
    return this.availableServices().length > 0;
  });

  ngOnInit(): void {
    this.initializeFromFlowState();
  }

  private initializeFromFlowState(): void {
    // Pre-fill from flow state if available
    const flowService = this.flowState().selectedService;
    if (flowService) {
      this.selectedService.set(flowService);
    }
  }

  onServiceSelect(service: ServiceItem): void {
    this.selectedService.set(service);
    this.flowService.setSelectedService(service);
    this.clearValidationError();
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  onCategoryChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedCategory.set(select.value);
  }

  onClearFilters(): void {
    this.searchTerm.set('');
    this.selectedCategory.set('');
  }

  onConfirmSelection(): void {
    const service = this.selectedService();
    if (!service) {
      this.validationError.set('Debe seleccionar un servicio');
      return;
    }

    this.isValidating.set(true);
    this.validationError.set(null);

    try {
      // Update flow service
      this.flowService.setSelectedService(service);

      // Proceed to next step
      this.flowService.nextStep();

    } catch (error: any) {
      this.validationError.set(error.message || 'Error al seleccionar el servicio');
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

  private clearValidationError(): void {
    this.validationError.set(null);
  }

  // Template helpers
  getServiceIcon(): string {
    return this.isServiceSelected() ? '🔧' : '❓';
  }

  getServiceDisplayName(service: ServiceItem): string {
    return service.title || service.code || 'Servicio sin nombre';
  }

  getServicePrice(service: ServiceItem): string {
    return service.price ? `$${service.price.toLocaleString('es-CO')}` : 'Precio no disponible';
  }

  getServiceDuration(service: ServiceItem): string {
    return service.estimatedHours ? `${service.estimatedHours}h` : 'N/A';
  }

  getServiceTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'maintenance': 'Mantenimiento',
      'repair': 'Reparación',
      'inspection': 'Inspección',
      'customization': 'Personalización'
    };
    return labels[type] || type;
  }

  isServiceSelectedById(serviceId: string): boolean {
    const selected = this.selectedService();
    return selected?.id === serviceId;
  }
}