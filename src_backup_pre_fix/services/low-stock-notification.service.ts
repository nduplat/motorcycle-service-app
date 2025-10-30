import { Injectable, signal, computed, effect } from '@angular/core';
import { ProductService } from './product.service';
import { StockMovementService } from './stock-movement.service';
import { NotificationService } from './notification.service';
import { Product, StockMovement } from '../models';

@Injectable({
  providedIn: 'root'
})
export class LowStockNotificationService {
  private lowStockProducts = signal<Product[]>([]);
  private notificationsSent = new Set<string>();

  constructor(
    private productService: ProductService,
    private stockMovementService: StockMovementService,
    private notificationService: NotificationService
  ) {
    // Only check when products are first loaded or when manually triggered
    // Remove the effect to prevent excessive reads
  }

  private checkLowStock(products: Product[]) {
    const lowStockItems = products.filter(product =>
      product.stock <= (product.minStock || 0) && product.stock > 0
    );

    const criticalStockItems = products.filter(product =>
      product.stock === 0
    );

    // Update low stock products signal
    this.lowStockProducts.set([...lowStockItems, ...criticalStockItems]);

    // Send notifications for new low stock items
    lowStockItems.forEach(product => {
      if (!this.notificationsSent.has(`low-${product.id}`)) {
        this.sendLowStockNotification(product);
        this.notificationsSent.add(`low-${product.id}`);
      }
    });

    // Send notifications for out of stock items
    criticalStockItems.forEach(product => {
      if (!this.notificationsSent.has(`critical-${product.id}`)) {
        this.sendCriticalStockNotification(product);
        this.notificationsSent.add(`critical-${product.id}`);
      }
    });
  }

  private sendLowStockNotification(product: Product) {
    const notification = {
      title: 'Producto con stock bajo',
      message: `${product.name} tiene ${product.stock} unidades restantes (mínimo: ${product.minStock}). Considere reabastecer.`,
      meta: {
        productId: product.id,
        stock: product.stock,
        minStock: product.minStock,
        type: 'low_stock'
      }
    };

    this.notificationService.addSystemNotification(notification).subscribe();
  }

  private sendCriticalStockNotification(product: Product) {
    const notification = {
      title: 'Producto agotado',
      message: `${product.name} está completamente agotado. Es necesario reabastecer urgentemente.`,
      meta: {
        productId: product.id,
        stock: product.stock,
        type: 'out_of_stock'
      }
    };

    this.notificationService.addSystemNotification(notification).subscribe();
  }

  getLowStockProducts() {
    return this.lowStockProducts.asReadonly();
  }

  getLowStockCount() {
    return computed(() => this.lowStockProducts().length);
  }

  getCriticalStockCount() {
    return computed(() =>
      this.lowStockProducts().filter(p => p.stock === 0).length
    );
  }

  // Method to reset notifications (useful for testing or manual triggers)
  resetNotifications() {
    this.notificationsSent.clear();
  }

  private async checkStagnantProducts(products: Product[]) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stagnantProducts: Product[] = [];

    for (const product of products) {
      if (!product.isActive) continue;

      const movements = await this.stockMovementService.getMovementsByProduct(product.id);
      if (movements.length === 0) {
        stagnantProducts.push(product); // Never moved
        continue;
      }

      const lastMovement = movements.sort((a: StockMovement, b: StockMovement) =>
        b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()
      )[0];

      if (lastMovement.createdAt.toDate() < thirtyDaysAgo) {
        stagnantProducts.push(product);
      }
    }

    // Send notifications for stagnant products
    stagnantProducts.forEach(product => {
      if (!this.notificationsSent.has(`stagnant-${product.id}`)) {
        this.sendStagnantProductNotification(product);
        this.notificationsSent.add(`stagnant-${product.id}`);
      }
    });
  }

  private checkIncompleteProducts(products: Product[]) {
    // Check for products with incomplete information (missing images or description)
    // This helps ensure product listings are complete for better customer experience
    const incompleteProducts = products.filter(product => {
      if (!product.isActive) return false;

      return !product.images ||
             product.images.length === 0 ||
             !product.description ||
             product.description.trim().length === 0;
    });

    // Send notifications for incomplete products
    incompleteProducts.forEach(product => {
      if (!this.notificationsSent.has(`incomplete-${product.id}`)) {
        this.sendIncompleteProductNotification(product);
        this.notificationsSent.add(`incomplete-${product.id}`);
      }
    });
  }

  private sendStagnantProductNotification(product: Product) {
    const notification = {
      title: 'Producto sin movimiento',
      message: `${product.name} no ha tenido movimientos de inventario en los últimos 30 días. Considere revisar su rotación.`,
      meta: {
        productId: product.id,
        type: 'stagnant_product'
      }
    };

    this.notificationService.addSystemNotification(notification).subscribe();
  }

  private sendIncompleteProductNotification(product: Product) {
    const issues = [];
    if (!product.images || product.images.length === 0) issues.push('imágenes');
    if (!product.description || product.description.trim().length === 0) issues.push('descripción');

    const notification = {
      title: 'Producto con información incompleta',
      message: `${product.name} le faltan: ${issues.join(', ')}. Complete la información para mejorar la presentación.`,
      meta: {
        productId: product.id,
        type: 'incomplete_product',
        issues
      }
    };

    this.notificationService.addSystemNotification(notification).subscribe();
  }

  // Method to manually check all notification types
  async checkAllNotifications() {
    const products = this.productService.getProducts()();
    this.checkLowStock(products);
    await this.checkStagnantProducts(products);
    this.checkIncompleteProducts(products);
  }

  // Method to manually check stock levels
  checkStockLevels() {
    const products = this.productService.getProducts()();
    this.checkLowStock(products);
  }
}