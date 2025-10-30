import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { CategoryService } from '../../../services/category.service';

@Component({
  selector: 'app-product-basic-info',
  templateUrl: './product-basic-info.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule]
})
export class ProductBasicInfoComponent {
  productForm = input.required<FormGroup>();
  categories = input<any[]>();

  isFieldInvalid(fieldName: string): boolean {
    const field = this.productForm().get(fieldName);
    return !!(field?.invalid && (field?.dirty || field?.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.productForm().get(fieldName);
    if (!field?.errors) return '';

    if (field.errors['required']) return 'Este campo es obligatorio';
    if (field.errors['minLength']) return `Mínimo ${field.errors['minLength'].requiredLength} caracteres`;
    if (field.errors['maxLength']) return `Máximo ${field.errors['maxLength'].requiredLength} caracteres`;
    if (field.errors['min'] && field.errors['min'].min !== undefined) return `Valor mínimo: ${field.errors['min'].min}`;
    if (field.errors['max'] && field.errors['max'].max !== undefined) return `Valor máximo: ${field.errors['max'].max}`;
    if (field.errors['pattern']) return 'Formato inválido';

    return 'Campo inválido';
  }
}