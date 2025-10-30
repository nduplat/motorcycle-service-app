import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../../../models';
import { LazyImageDirective } from '../../shared/lazy-image.directive';

@Component({
  selector: 'app-featured-products',
  templateUrl: './featured-products.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LazyImageDirective],
})
export class FeaturedProductsComponent {
  products = input<Product[]>([]);
  
  formatCurrency(value: number | undefined): string {
    if (value === undefined) return 'N/A';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  }
}
