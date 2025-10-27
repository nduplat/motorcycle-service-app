import { Injectable, inject } from '@angular/core';
import { ProductService } from './product.service';
import { StockMovementService } from './stock-movement.service';
import { MotorcycleService } from './motorcycle.service';
import { Product, StockMovement } from '../models';

export interface StockReport {
  productId: string;
  productName: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  minStock: number;
  locationId?: string;
  status: 'normal' | 'low' | 'critical' | 'out_of_stock';
}

export interface ProductRotationReport {
  productId: string;
  productName: string;
  totalSold: number;
  totalPurchased: number;
  currentStock: number;
  rotationRate: number; // sold / average stock
  lastMovementDate?: Date;
  daysSinceLastMovement: number;
}

export interface CompatibilityAnalysis {
  motorcycleId: string;
  motorcycleName: string;
  productCount: number;
  totalValue: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    usage: number;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryReportsService {

  private motorcycleService = inject(MotorcycleService);

  constructor(
    private productService: ProductService,
    private stockMovementService: StockMovementService
  ) {}

  getStockReportByLocation(locationId?: string): StockReport[] {
    const products = locationId
      ? this.productService.getProductsByLocation(locationId)
      : this.productService.getProducts()();

    return products.map(product => {
      const availableStock = this.productService.getAvailableStock(product.id);
      const status = this.getStockStatus(product, availableStock);

      return {
        productId: product.id,
        productName: product.name,
        currentStock: product.stock || 0,
        reservedStock: product.reservedStock || 0,
        availableStock,
        minStock: product.minStock || 0,
        locationId: product.workshopLocationId,
        status
      };
    });
  }

  getLowStockReport(): StockReport[] {
    return this.getStockReportByLocation().filter(report => report.status !== 'normal');
  }

  async getProductRotationReport(daysBack: number = 90): Promise<ProductRotationReport[]> {
    const products = this.productService.getProducts()();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const reports: ProductRotationReport[] = [];

    for (const product of products) {
      const movements = await this.stockMovementService.getMovementsByProduct(product.id);
      const filteredMovements = movements.filter((m: StockMovement) => m.createdAt.toDate() >= cutoffDate);

      const sold = filteredMovements
        .filter((m: StockMovement) => m.type === 'sale')
        .reduce((sum: number, m: StockMovement) => sum + Math.abs(m.quantity), 0);

      const purchased = filteredMovements
        .filter((m: StockMovement) => m.type === 'purchase')
        .reduce((sum: number, m: StockMovement) => sum + m.quantity, 0);

      const averageStock = this.calculateAverageStock(product, filteredMovements, daysBack);
      const rotationRate = averageStock > 0 ? sold / averageStock : 0;

      const lastMovement = filteredMovements
        .sort((a: StockMovement, b: StockMovement) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())[0];

      const daysSinceLastMovement = lastMovement
        ? Math.floor((new Date().getTime() - lastMovement.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24))
        : Infinity;

      reports.push({
        productId: product.id,
        productName: product.name,
        totalSold: sold,
        totalPurchased: purchased,
        currentStock: product.stock || 0,
        rotationRate,
        lastMovementDate: lastMovement?.createdAt.toDate(),
        daysSinceLastMovement
      });
    }

    return reports.sort((a, b) => b.totalSold - a.totalSold);
  }

  async getTopSellingProducts(limit: number = 10): Promise<ProductRotationReport[]> {
    const reports = await this.getProductRotationReport();
    return reports.slice(0, limit);
  }

  getCompatibilityAnalysis(): CompatibilityAnalysis[] {
    const products = this.productService.getProducts()();
    const motorcycles = this.motorcycleService.getMotorcycles()();
    const compatibilityMap = new Map<string, CompatibilityAnalysis>();

    // Create a map for quick motorcycle name lookup
    const motorcycleMap = new Map<string, string>();
    motorcycles.forEach(motorcycle => {
      motorcycleMap.set(motorcycle.id, `${motorcycle.brand} ${motorcycle.model} ${motorcycle.year}`);
    });

    products.forEach(product => {
      if (product.compatibility && product.compatibility.length > 0) {
        product.compatibility.forEach(motorcycleId => {
          if (!compatibilityMap.has(motorcycleId)) {
            const motorcycleName = motorcycleMap.get(motorcycleId) || `Motorcycle ${motorcycleId}`;
            compatibilityMap.set(motorcycleId, {
              motorcycleId,
              motorcycleName,
              productCount: 0,
              totalValue: 0,
              topProducts: []
            });
          }

          const analysis = compatibilityMap.get(motorcycleId)!;
          analysis.productCount++;
          analysis.totalValue += (product.sellingPrice || 0) * (product.stock || 0);

          // Track product usage (simplified - in reality would use sales data)
          const existingProduct = analysis.topProducts.find(p => p.productId === product.id);
          if (existingProduct) {
            existingProduct.usage++;
          } else {
            analysis.topProducts.push({
              productId: product.id,
              productName: product.name,
              usage: 1
            });
          }
        });
      }
    });

    // Sort top products for each motorcycle
    compatibilityMap.forEach(analysis => {
      analysis.topProducts.sort((a, b) => b.usage - a.usage);
      analysis.topProducts = analysis.topProducts.slice(0, 5); // Top 5 products
    });

    return Array.from(compatibilityMap.values())
      .sort((a, b) => b.productCount - a.productCount);
  }

  getInventoryValueReport(): {
    totalValue: number;
    byCategory: Record<string, number>;
    byLocation: Record<string, number>;
  } {
    const products = this.productService.getProducts()();
    let totalValue = 0;
    const byCategory: Record<string, number> = {};
    const byLocation: Record<string, number> = {};

    products.forEach(product => {
      if (product.isActive !== false) {
        const value = (product.sellingPrice || 0) * (product.stock || 0);
        totalValue += value;

        // By category
        const category = product.categoryId || 'uncategorized';
        byCategory[category] = (byCategory[category] || 0) + value;

        // By location
        const location = product.workshopLocationId || 'unassigned';
        byLocation[location] = (byLocation[location] || 0) + value;
      }
    });

    return { totalValue, byCategory, byLocation };
  }

  private getStockStatus(product: Product, availableStock: number): 'normal' | 'low' | 'critical' | 'out_of_stock' {
    if (availableStock <= 0) return 'out_of_stock';
    if (product.minStock && availableStock <= product.minStock) return 'low';
    if (product.minStock && availableStock <= product.minStock * 0.5) return 'critical';
    return 'normal';
  }

  private calculateAverageStock(product: Product, movements: StockMovement[], daysBack: number): number {
    // Simplified calculation - in a real implementation, you'd track stock levels over time
    // For now, return current stock as approximation
    return product.stock || 0;
  }
}