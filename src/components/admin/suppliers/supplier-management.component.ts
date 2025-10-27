import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupplierService } from '../../../services/supplier.service';
import { Supplier } from '../../../models';
import { LoaderComponent } from '../../shared/loader/loader.component';

@Component({
  selector: 'app-supplier-management',
  templateUrl: './supplier-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, LoaderComponent],
})
export class SupplierManagementComponent {
  private fb = inject(FormBuilder);
  supplierService = inject(SupplierService);

  suppliers = this.supplierService.getSuppliers();
  
  isSubmitting = signal(false);
  editingSupplierId = signal<string | null>(null);

  formTitle = computed(() => this.editingSupplierId() ? 'Editar Proveedor' : 'Añadir Nuevo Proveedor');

  supplierForm = this.fb.group({
    name: ['', Validators.required],
    contactName: [''],
    phone: [''],
    email: ['', [Validators.email]],
    address: [''],
  });

  editSupplier(supplier: Supplier): void {
    this.editingSupplierId.set(supplier.id);
    this.supplierForm.patchValue(supplier);
  }

  cancelEdit(): void {
    this.editingSupplierId.set(null);
    this.supplierForm.reset();
  }

  deleteSupplier(id: string): void {
    if (confirm('¿Estás seguro de que quieres eliminar este proveedor?')) {
        this.supplierService.deleteSupplier(id).subscribe();
    }
  }

  onSubmit(): void {
    if (this.supplierForm.invalid) {
      return;
    }
    this.isSubmitting.set(true);
    
    const formData = this.supplierForm.value as Omit<Supplier, 'id'|'createdAt'|'updatedAt'>;
    const editingId = this.editingSupplierId();

    const operation = editingId
      ? this.supplierService.updateSupplier({ id: editingId, ...formData } as Supplier)
      : this.supplierService.addSupplier(formData);

    operation.subscribe({
      next: () => {
        this.cancelEdit();
        this.isSubmitting.set(false);
      },
      error: () => {
        this.isSubmitting.set(false);
      }
    });
  }
}
