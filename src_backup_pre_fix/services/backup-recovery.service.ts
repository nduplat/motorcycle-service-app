import { Injectable } from '@angular/core';
import { ProductService } from './product.service';
import { StockMovementService } from './stock-movement.service';
import { AuditService } from './audit.service';
import { Product, StockMovement, AuditLog } from '../models';
import { db } from '../firebase.config';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';

export interface BackupData {
  timestamp: Date;
  products: Product[];
  stockMovements: StockMovement[];
  auditLogs: AuditLog[];
  metadata: {
    totalProducts: number;
    totalMovements: number;
    totalAuditLogs: number;
    version: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class BackupRecoveryService {

  constructor(
    private productService: ProductService,
    private stockMovementService: StockMovementService,
    private auditService: AuditService
  ) {}

  async createBackup(): Promise<BackupData> {
    const timestamp = new Date();

    // Get all current data
    const products = this.productService.getProducts()();
    const stockMovements = this.stockMovementService.getStockMovements()();

    // Get recent audit logs (last 30 days)
    const auditLogs = await this.getRecentAuditLogs(30);

    const backupData: BackupData = {
      timestamp,
      products,
      stockMovements,
      auditLogs,
      metadata: {
        totalProducts: products.length,
        totalMovements: stockMovements.length,
        totalAuditLogs: auditLogs.length,
        version: '1.0'
      }
    };

    // Download as JSON file
    this.downloadBackup(backupData);

    return backupData;
  }

  async exportProductsReport(): Promise<void> {
    const products = this.productService.getProducts()();
    const csvContent = this.convertProductsToCSV(products);
    this.downloadCSV(csvContent, `products-export-${new Date().toISOString().split('T')[0]}.csv`);
  }

  async exportStockMovementsReport(startDate?: Date, endDate?: Date): Promise<void> {
    let movements = this.stockMovementService.getStockMovements()();

    if (startDate) {
      movements = movements.filter(m => m.createdAt.toDate() >= startDate);
    }
    if (endDate) {
      movements = movements.filter(m => m.createdAt.toDate() <= endDate);
    }

    const csvContent = this.convertMovementsToCSV(movements);
    const dateSuffix = startDate ? `-${startDate.toISOString().split('T')[0]}` : '';
    this.downloadCSV(csvContent, `stock-movements${dateSuffix}.csv`);
  }

  async recoverStockToPointInTime(targetDate: Date): Promise<void> {
    // This is a simplified recovery mechanism
    // In a real implementation, this would be much more complex and should be done with caution

    console.warn('Stock recovery initiated. This operation should be performed with extreme caution.');

    const movements = this.stockMovementService.getStockMovements()()
      .filter(m => m.createdAt.toDate() <= targetDate)
      .sort((a, b) => a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime());

    // Group movements by product
    const productMovements = new Map<string, StockMovement[]>();
    movements.forEach(movement => {
      if (!productMovements.has(movement.productId)) {
        productMovements.set(movement.productId, []);
      }
      productMovements.get(movement.productId)!.push(movement);
    });

    // Calculate stock for each product at the target date
    const stockUpdates: { productId: string; stock: number }[] = [];
    productMovements.forEach((movements, productId) => {
      const totalStock = movements.reduce((sum, m) => sum + m.quantity, 0);
      stockUpdates.push({ productId, stock: totalStock });
    });

    // Log the recovery operation
    await this.auditService.logChange('system', 'stock_recovery', 'Stock recovery to point in time', {
      targetDate: targetDate.toISOString(),
      affectedProducts: stockUpdates.length
    });

    // In a real implementation, you would update the products here
    // For safety, we'll just log what would be done
    console.log('Stock recovery simulation:', stockUpdates);
  }

  async getStockHistory(productId: string, daysBack: number = 90): Promise<StockMovement[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const movements = await this.stockMovementService.getMovementsByProduct(productId);
    return movements
      .filter((m: StockMovement) => m.createdAt.toDate() >= startDate)
      .sort((a: StockMovement, b: StockMovement) => a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime());
  }

  async validateDataIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for products with negative stock
    const products = this.productService.getProducts()();
    const negativeStockProducts = products.filter(p => (p.stock || 0) < 0);
    if (negativeStockProducts.length > 0) {
      issues.push(`${negativeStockProducts.length} products have negative stock`);
      recommendations.push('Review and correct negative stock values');
    }

    // Check for products without recent movements
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const stagnantProducts: Product[] = [];

    for (const p of products) {
      if (!p.isActive) continue;
      const movements = await this.stockMovementService.getMovementsByProduct(p.id);
      if (movements.length === 0 || movements.every((m: StockMovement) => m.createdAt.toDate() < thirtyDaysAgo)) {
        stagnantProducts.push(p);
      }
    }

    if (stagnantProducts.length > 0) {
      recommendations.push(`${stagnantProducts.length} products haven't moved in 30+ days - consider stock review`);
    }

    // Check stock consistency (compare calculated vs stored)
    for (const product of products.slice(0, 10)) { // Check first 10 for performance
      const calculatedStock = await this.stockMovementService.recalculateStock(product.id);
      if (calculatedStock !== (product.stock || 0)) {
        issues.push(`Stock inconsistency for product ${product.name}: stored=${product.stock}, calculated=${calculatedStock}`);
        recommendations.push('Run stock recalculation for affected products');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  private async getRecentAuditLogs(daysBack: number): Promise<AuditLog[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // This is a simplified version - in reality, you'd query Firestore
      // For now, return empty array as audit logs aren't stored in a queryable way
      return [];
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
  }

  private downloadBackup(data: BackupData): void {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory-backup-${data.timestamp.toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private convertProductsToCSV(products: Product[]): string {
    const headers = ['ID', 'Name', 'SKU', 'Category', 'Stock', 'Min Stock', 'Selling Price', 'Location', 'Active'];
    const rows = products.map(p => [
      p.id,
      p.name,
      p.sku || '',
      p.categoryId || '',
      p.stock?.toString() || '0',
      p.minStock?.toString() || '',
      p.sellingPrice?.toString() || '',
      p.workshopLocationId || '',
      p.isActive !== false ? 'Yes' : 'No'
    ]);

    return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
  }

  private convertMovementsToCSV(movements: StockMovement[]): string {
    const headers = ['Date', 'Product ID', 'Quantity', 'Type', 'Reference', 'Reason', 'User'];
    const rows = movements.map(m => [
      m.createdAt.toDate().toISOString(),
      m.productId,
      m.quantity.toString(),
      m.type,
      m.referenceId || '',
      m.reason || '',
      m.createdBy || ''
    ]);

    return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
  }

  private downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}