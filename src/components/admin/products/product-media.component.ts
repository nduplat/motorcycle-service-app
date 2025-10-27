import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { LazyImageDirective } from '../../shared/lazy-image.directive';

@Component({
  selector: 'app-product-media',
  templateUrl: './product-media.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, LazyImageDirective]
})
export class ProductMediaComponent {
  productForm = input.required<FormGroup>();
  images = input<any[]>([]);

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

  onImageSelected(event: any): void {
    // This will be handled by the parent component
  }

  removeImage(image: any): void {
    // This will be handled by the parent component
  }
}