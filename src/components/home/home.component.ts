import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HeroComponent } from './hero/hero.component';
import { MotorcycleFiltersComponent } from './motorcycle-search/motorcycle-search.component';
import { FeaturedProductsComponent } from './featured-products/featured-products.component';
import { ServicesComponent } from './services/services.component';
import { ProductService } from '../../services/product.service';
import { ServiceItemService } from '../../services/service-item.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeroComponent,
    //MotorcycleSearchComponent,
    //FeaturedProductsComponent,
    //ServicesComponent
  ]
})
export class HomeComponent {
  private productService = inject(ProductService);
  private serviceItemService = inject(ServiceItemService);

  featuredProducts = computed(() => this.productService.getProducts()().slice(0, 4));
  featuredServices = computed(() => this.serviceItemService.getServices()().slice(0, 4));
}