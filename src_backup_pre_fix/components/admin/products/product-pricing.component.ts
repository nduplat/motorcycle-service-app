import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { CurrencyPipe, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-product-pricing',
  templateUrl: './product-pricing.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CurrencyPipe, DecimalPipe]
})
export class ProductPricingComponent {
  productForm = input.required<FormGroup>();

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

  // Computed profit margin values
  profitMargin = computed(() => {
    const sellingPrice = this.productForm().get('sellingPrice')?.value || 0;
    const purchasePrice = this.productForm().get('purchasePrice')?.value || 0;
    return sellingPrice - purchasePrice;
  });

  profitMarginPercent = computed(() => {
    const sellingPrice = this.productForm().get('sellingPrice')?.value || 0;
    const purchasePrice = this.productForm().get('purchasePrice')?.value || 0;
    if (purchasePrice === 0) return 0;
    return ((sellingPrice - purchasePrice) / purchasePrice) * 100;
  });

  calculatedTax = computed(() => {
    const sellingPrice = this.productForm().get('sellingPrice')?.value || 0;
    const taxPercent = this.productForm().get('taxPercent')?.value || 0;
    return (sellingPrice * taxPercent) / 100;
  });
}