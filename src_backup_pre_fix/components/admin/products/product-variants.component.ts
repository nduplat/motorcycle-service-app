import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormArray } from '@angular/forms';

@Component({
  selector: 'app-product-variants',
  templateUrl: './product-variants.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule]
})
export class ProductVariantsComponent {
  productForm = input.required<FormGroup>();

  variantsFormArray = computed(() => this.productForm().get('variants') as FormArray);

  addVariant(): void {
    // This will be handled by the parent component
  }

  removeVariant(index: number): void {
    // This will be handled by the parent component
  }

  addVariantAttribute(variantIndex: number): void {
    // This will be handled by the parent component
  }

  removeVariantAttribute(variantIndex: number, attributeKey: string): void {
    // This will be handled by the parent component
  }

  getVariantStockBadgeClass(variant: any): string {
    const stock = variant?.stock || 0;
    if (stock === 0) return 'bg-red-100 text-red-800';
    if (stock <= 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  }
}