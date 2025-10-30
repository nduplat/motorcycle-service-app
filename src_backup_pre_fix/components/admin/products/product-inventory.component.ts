import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-product-inventory',
  templateUrl: './product-inventory.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule]
})
export class ProductInventoryComponent {
  productForm = input.required<FormGroup>();
  workshopLocations = input<any[]>();
  suppliers = input<any[]>();

  isFieldInvalid(fieldName: string): boolean {
    const field = this.productForm().get(fieldName);
    return !!(field?.invalid && (field?.dirty || field?.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.productForm().get(fieldName);
    if (!field?.errors) return '';

    if (field.errors['required']) return 'Este campo es obligatorio';
    if (field.errors['min'] && field.errors['min'].min !== undefined) return `Valor mínimo: ${field.errors['min'].min}`;
    if (field.errors['max'] && field.errors['max'].max !== undefined) return `Valor máximo: ${field.errors['max'].max}`;

    return 'Campo inválido';
  }

  // Computed stock status
  stockStatus = computed(() => {
    const stock = this.productForm().get('stock')?.value || 0;
    const minStock = this.productForm().get('minStock')?.value || 0;

    if (stock === 0) return 'out_of_stock';
    if (stock <= minStock) return 'low_stock';
    return 'in_stock';
  });

  stockStatusMessage = computed(() => {
    const status = this.stockStatus();
    switch (status) {
      case 'out_of_stock': return 'Producto Agotado';
      case 'low_stock': return 'Stock Bajo - Reabastecer';
      default: return 'Stock Saludable';
    }
  });

  stockStatusColor = computed(() => {
    const status = this.stockStatus();
    switch (status) {
      case 'out_of_stock': return 'bg-red-100 text-red-800';
      case 'low_stock': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-green-100 text-green-800';
    }
  });
}