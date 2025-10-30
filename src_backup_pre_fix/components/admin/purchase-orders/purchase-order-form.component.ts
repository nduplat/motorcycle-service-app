import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
// FIX: Import `FormGroup` to correctly type the `createItem` method's return value.
import { FormBuilder, ReactiveFormsModule, Validators, FormArray, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PurchaseOrderService } from '../../../services/purchase-order.service';
import { ProductService } from '../../../services/product.service';
import { SupplierService } from '../../../services/supplier.service';
import { StockMovementService } from '../../../services/stock-movement.service';
import { AuthService } from '../../../services/auth.service';
import { PurchaseOrder } from '../../../models';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { switchMap, of } from 'rxjs';

@Component({
  selector: 'app-purchase-order-form',
  templateUrl: './purchase-order-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LoaderComponent]
})
export class PurchaseOrderFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  
  private poService = inject(PurchaseOrderService);
  private stockMovementService = inject(StockMovementService);
  private authService = inject(AuthService);
  
  productService = inject(ProductService);
  supplierService = inject(SupplierService);
  
  isSubmitting = signal(false);
  isLoading = signal(true);
  poId = signal<string | null>(null);
  originalPO: PurchaseOrder | undefined;

  pageTitle = computed(() => this.poId() ? 'Editar Orden de Compra' : 'Crear Nueva Orden de Compra');
  
  poForm = this.fb.group({
    supplierId: ['', Validators.required],
    status: ['draft' as PurchaseOrder['status'], Validators.required],
    items: this.fb.array([]),
  });

  statuses: PurchaseOrder['status'][] = ['draft', 'ordered', 'received', 'cancelled'];
  
  get items() {
    return this.poForm.get('items') as FormArray;
  }
  
  createItem(): FormGroup {
    return this.fb.group({
      productId: ['', Validators.required],
      qty: [1, [Validators.required, Validators.min(1)]],
      unitCost: [0, [Validators.required, Validators.min(0)]],
    });
  }
  
  addItem(): void {
    this.items.push(this.createItem());
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (id) {
          this.poId.set(id);
          return this.poService.getPurchaseOrder(id);
        }
        this.isLoading.set(false);
        this.addItem(); // Start with one item for new POs
        return of(undefined);
      })
    ).subscribe(po => {
      if (po) {
        this.originalPO = po;
        this.poForm.patchValue({
          supplierId: po.supplierId,
          status: po.status
        });
        po.items.forEach(item => {
            this.items.push(this.fb.group(item));
        });
      }
      this.isLoading.set(false);
    });
  }
  
  onSubmit(): void {
    if (this.poForm.invalid) {
      this.poForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const formValue = this.poForm.getRawValue();
    const currentId = this.poId();

    const poData = {
        supplierId: formValue.supplierId,
        status: formValue.status,
        items: formValue.items,
    }

    const operation = currentId
      ? this.poService.updatePurchaseOrder({ ...poData, id: currentId } as PurchaseOrder)
      : this.poService.addPurchaseOrder(poData as Omit<PurchaseOrder, 'id'|'createdAt'|'updatedAt'>);
      
    operation.subscribe({
      next: () => this.router.navigate(['/admin/purchase-orders']),
      error: () => this.isSubmitting.set(false)
    });
  }

  receiveOrder(): void {
      if (!this.originalPO) return;
      
      this.isSubmitting.set(true);
      const currentUser = this.authService.currentUser();
      if (!currentUser) {
          alert("Error: Usuario no encontrado.");
          this.isSubmitting.set(false);
          return;
      }

      this.stockMovementService.receivePurchaseOrder(this.originalPO, currentUser.id).subscribe({
          next: () => {
              alert('Orden de compra recibida y stock actualizado con éxito.');
              this.router.navigate(['/admin/purchase-orders']);
          },
          error: (err) => {
              alert('Error al procesar la recepción de la orden.');
              console.error(err);
              this.isSubmitting.set(false);
          }
      });
  }
}