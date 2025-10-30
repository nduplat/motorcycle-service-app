import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray, FormGroup, FormControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { WorkOrderService } from '../../../services/work-order.service';
import { ProductService } from '../../../services/product.service';
import { UserService } from '../../../services/user.service';
import { MotorcycleService } from '../../../services/motorcycle.service';
import { ServiceItemService } from '../../../services/service-item.service';
import { MotorcycleAssignmentService } from '../../../services/motorcycle-assignment.service';
import { WorkOrder, User, Product, WorkOrderStatus, MotorcycleAssignment, ServiceItem, WorkOrderPart } from '../../../models';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { switchMap, of, tap, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-work-order-form',
  templateUrl: './work-order-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LoaderComponent],
})
export class WorkOrderFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  
  private workOrderService = inject(WorkOrderService);
  private userService = inject(UserService);
  private motorcycleService = inject(MotorcycleService);
  private motorcycleAssignmentService = inject(MotorcycleAssignmentService);
  private productService = inject(ProductService);
  private serviceItemService = inject(ServiceItemService);

  isSubmitting = signal(false);
  isLoading = signal(true);
  isEditMode = false;
  
  workOrder = signal<WorkOrder | undefined>(undefined);
  selectedCustomer = signal<User | undefined>(undefined);
  selectedVehicle = signal<MotorcycleAssignment| undefined>(undefined);
  customerVehicles = signal<MotorcycleAssignment[]>([]);
  customerMotorcycleAssignments = signal<MotorcycleAssignment[]>([]);

  // All data signals
  private allUsers = this.userService.getUsers();
  private allProducts = this.productService.getProducts();
  private allServices = this.serviceItemService.getServices();

  // Search controls
  customerSearchCtrl = new FormControl('');
  productSearchCtrl = new FormControl('');
  serviceSearchCtrl = new FormControl('');

  // Search results
  customerSearchResults = signal<User[]>([]);
  productSearchResults = signal<Product[]>([]);
  serviceSearchResults = signal<ServiceItem[]>([]);
  
  statuses: WorkOrderStatus[] = ['open', 'in_progress', 'waiting_parts', 'ready_for_pickup', 'delivered', 'cancelled'];
  
  workOrderForm = this.fb.group({
    clientId: ['', Validators.required],
    vehicleId: ['', Validators.required],
    status: ['open' as WorkOrderStatus, Validators.required],
    items: this.fb.array([]),
  });

  totalAmount = computed(() => {
    return this.items.controls.reduce((total, control) => {
        const item = control.value;
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 1;
        return total + (price * quantity);
    }, 0);
  });

  constructor() {
    // Customer search
    this.customerSearchCtrl.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged(),
    ).subscribe(term => this.searchCustomers(term));

    // Product search
    this.productSearchCtrl.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged(),
    ).subscribe(term => this.searchProducts(term));

    // Service search
    this.serviceSearchCtrl.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged(),
    ).subscribe(term => this.searchServices(term));

    // Vehicle selection
    this.workOrderForm.get('vehicleId')?.valueChanges.subscribe(vehicleId => {
      if (vehicleId) {
        const vehicle = this.customerVehicles().find(v => v.id === vehicleId);
        this.selectedVehicle.set(vehicle);
      } else {
        this.selectedVehicle.set(undefined);
      }
    });
  }

  get items() {
    return this.workOrderForm.get('items') as FormArray;
  }
  
  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (id) {
          this.isEditMode = true;
          return this.workOrderService.getWorkOrder(id);
        }
        this.isEditMode = false;
        this.isLoading.set(false);
        return of(undefined);
      }),
      tap(wo => {
        if (wo) {
          this.workOrder.set(wo);
          this.workOrderForm.patchValue({
            status: wo.status,
            clientId: wo.clientId,
            vehicleId: wo.plate,
          });

          this.items.clear();
          // This logic is simplified. A real implementation would need to fetch service/product details.
          wo.services?.forEach(serviceId => {
              const service = this.allServices().find(s => s.id === serviceId);
              if(service) this.items.push(this.createItem(service, 'service'));
          });
           wo.products?.forEach(productId => {
              const product = this.allProducts().find(p => p.id === productId);
              if(product) this.items.push(this.createItem(product, 'product'));
          });

          const customerProfile = this.allUsers().find(u => u.id === wo.clientId);
          this.selectedCustomer.set(customerProfile);

          // Fetch customer motorcycle assignments and set selected vehicle
          this.motorcycleAssignmentService.getUserAssignments(wo.clientId).then(assignments => {
            this.customerMotorcycleAssignments.set(assignments);
            const assignment = assignments.find(a => a.plate === wo.plate);
            this.selectedVehicle.set(assignment);
          });
        }
        this.isLoading.set(false);
      })
    ).subscribe();
  }
  
  createItem(item: ServiceItem | Product, type: 'service' | 'product', isSuggested: boolean = false): FormGroup {
    const isService = type === 'service';
    const price = isService ? (item as ServiceItem).price : (item as Product).price;
    const name = isService ? (item as ServiceItem).title : (item as Product).name;

    return this.fb.group({
      id: [item.id],
      description: [name, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      price: [price, [Validators.required, Validators.min(0)]],
      type: [type],
      isSuggested: [isSuggested]
    });
  }

  // --- Search and Selection ---
  searchCustomers(term: string | null): void {
    if (!term || term.length < 2) {
        this.customerSearchResults.set([]);
        return;
    }
    const lowerTerm = term.toLowerCase();
    this.customerSearchResults.set(
        this.allUsers().filter(u => 
            u.name.toLowerCase().includes(lowerTerm) || 
            u.email.toLowerCase().includes(lowerTerm)
        )
    );
  }

  selectCustomer(user: User): void {
    this.selectedCustomer.set(user);
    this.workOrderForm.get('clientId')?.setValue(user.id);
    this.customerSearchResults.set([]);
    this.customerSearchCtrl.setValue('');

    this.motorcycleAssignmentService.getUserAssignments(user.id).then(assignments => {
        this.customerMotorcycleAssignments.set(assignments);
        if (assignments.length > 0) {
          this.workOrderForm.get('vehicleId')?.setValue(assignments[0].plate);
          this.selectedVehicle.set(assignments[0]);
        }
    });
  }

  searchProducts(term: string | null): void {
      if(!term || term.length < 2) {
        this.productSearchResults.set([]);
        return;
      }
      const vehicle = this.selectedVehicle();
      this.productSearchResults.set(this.allProducts().filter(p =>
        p.name.toLowerCase().includes(term.toLowerCase()) &&
        (!vehicle || p.compatibleBrands.length === 0 || p.compatibleBrands.includes(vehicle.brand || '')) &&
        (!vehicle || p.compatibleModels.length === 0 || p.compatibleModels.includes(vehicle.model || ''))
      ));
  }

  searchServices(term: string | null): void {
      if(!term || term.length < 2) {
        this.serviceSearchResults.set([]);
        return;
      }
      const vehicle = this.selectedVehicle();
      this.serviceSearchResults.set(this.allServices().filter(s =>
        s.title.toLowerCase().includes(term.toLowerCase()) &&
        (!vehicle || s.compatibleBrands.length === 0 || s.compatibleBrands.includes(vehicle.brand || '')) &&
        (!vehicle || s.compatibleModels.length === 0 || s.compatibleModels.includes(vehicle.model || ''))
      ));
  }

  addService(service: ServiceItem): void {
    this.items.push(this.createItem(service, 'service'));

    // Auto-add suggested products for this service
    if (service.partsSuggested && service.partsSuggested.length > 0) {
      service.partsSuggested.forEach(suggestedPart => {
        const product = this.allProducts().find(p => p.id === suggestedPart.productId);
        if (product) {
          // Check if product is already in the items
          const existingItemIndex = this.items.controls.findIndex(
            item => item.value.id === product.id && item.value.type === 'product'
          );

          if (existingItemIndex === -1) {
            // Product not in items, add it
            const productItem = this.createItem(product, 'product', true);
            productItem.patchValue({ quantity: suggestedPart.qty });
            this.items.push(productItem);
          } else {
            // Product already exists, increase quantity
            const existingItem = this.items.at(existingItemIndex);
            const currentQty = existingItem.value.quantity || 1;
            existingItem.patchValue({ quantity: currentQty + suggestedPart.qty });
          }
        }
      });
    }

    this.serviceSearchCtrl.setValue('');
    this.serviceSearchResults.set([]);
  }

  addProduct(product: Product): void {
    this.items.push(this.createItem(product, 'product'));
    this.productSearchCtrl.setValue('');
    this.productSearchResults.set([]);
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  // --- Save Logic ---
  saveWorkOrder(): void {
    if (this.workOrderForm.invalid) return;

    this.isSubmitting.set(true);
    const formValue = this.workOrderForm.getRawValue();
    const formItems = formValue.items as { id: string, type: 'service' | 'product' }[];

    const workOrderData: Omit<WorkOrder, 'id' | 'createdAt'> = {
      clientId: formValue.clientId || '',
      plate: formValue.vehicleId || '',
      status: formValue.status || 'open',
      services: formItems.filter(i => i.type === 'service').map(i => i.id),
      products: formItems.filter(i => i.type === 'product').map(i => i.id),
      totalPrice: this.totalAmount(),
    };

    if (this.isEditMode) {
      const currentWO = this.workOrder()!;
      this.workOrderService.updateWorkOrder({ ...currentWO, ...workOrderData }).subscribe({
        next: () => this.handleSaveSuccess(),
        error: (err) => this.handleSaveError(err),
      });
    } else {
      this.workOrderService.createWorkOrder(workOrderData).subscribe({
        next: () => this.handleSaveSuccess(),
        error: (err) => this.handleSaveError(err),
      });
    }
  }

  private handleSaveSuccess(): void {
      this.isSubmitting.set(false);
      this.router.navigate(['/admin/work-orders']);
  }

  private handleSaveError(error: any): void {
      console.error("Error saving work order:", error);
      this.isSubmitting.set(false);
  }
}
