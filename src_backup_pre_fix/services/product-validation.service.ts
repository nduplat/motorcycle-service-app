import { Injectable } from '@angular/core';
import { Product, Category, Motorcycle } from '../models';
import { CategoryService } from './category.service';
import { MotorcycleService } from './motorcycle.service';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ProductValidationService {

  constructor(
    private categoryService: CategoryService,
    private motorcycleService: MotorcycleService
  ) {}

  async validateProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>, existingProducts?: Product[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!product.name || product.name.trim().length < 2) {
      errors.push('Name is required and must be at least 2 characters long');
    }

    if (!product.categoryId) {
      errors.push('Category is required');
    } else {
      // Check if category exists - wait for categories to load if needed
      let categories = this.categoryService.getCategories()();
      let attempts = 0;
      while (categories.length === 0 && attempts < 10) {
        // Wait for categories to load
        await new Promise(resolve => setTimeout(resolve, 50));
        categories = this.categoryService.getCategories()();
        attempts++;
      }
      const categoryExists = categories.some((cat: Category) => cat.id === product.categoryId);
      if (!categoryExists) {
        console.warn('Available categories:', categories.map(c => ({ id: c.id, name: c.name })));
        console.warn('Selected category ID:', product.categoryId);
        errors.push(`Selected category does not exist. Available: ${categories.map(c => c.name).join(', ')}`);
      }
    }

    if (product.sellingPrice === undefined || product.sellingPrice <= 0) {
      errors.push('Selling price must be a positive number');
    }

    if (product.stock === undefined || product.stock < 0 || !Number.isInteger(product.stock)) {
      errors.push('Stock must be a non-negative integer');
    }

    // Unique validations
    if (product.sku && existingProducts) {
      const skuExists = existingProducts.some(p => p.sku === product.sku && p.id !== (product as any).id);
      if (skuExists) {
        errors.push('SKU must be unique');
      }
    }

    if (product.barcode && existingProducts) {
      const barcodeExists = existingProducts.some(p => p.barcode === product.barcode && p.id !== (product as any).id);
      if (barcodeExists) {
        errors.push('Barcode must be unique');
      }
    }

    // Business rule validations
    if (product.purchasePrice !== undefined && product.sellingPrice !== undefined) {
      if (product.purchasePrice > product.sellingPrice) {
        warnings.push('Purchase price is higher than selling price');
      }
    }

    if (product.minStock !== undefined && product.stock !== undefined) {
      if (product.minStock > product.stock) {
        warnings.push('Minimum stock is higher than current stock - this may trigger immediate alerts');
      }
    }

    if (product.taxPercent !== undefined) {
      if (product.taxPercent < 0 || product.taxPercent > 100) {
        errors.push('Tax percent must be between 0 and 100');
      }
    }

    // Images validation
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        if (!this.isValidUrl(image)) {
          errors.push(`Invalid image URL: ${image}`);
        }
      }
    }

    // Compatibility validation
    if (product.compatibility && product.compatibility.length > 0) {
      const motorcycles = this.motorcycleService.getMotorcycles()();
      const motorcycleIds = motorcycles.map((m: Motorcycle) => m.id);
      for (const compId of product.compatibility) {
        if (!motorcycleIds.includes(compId)) {
          errors.push(`Invalid motorcycle compatibility ID: ${compId}`);
        }
      }
    }

    // Variant validations
    if (product.variants && product.variants.length > 0) {
      for (let i = 0; i < product.variants.length; i++) {
        const variant = product.variants[i];
        if (variant.sku && variant.sku.trim() && existingProducts) {
          const conflictingProduct = existingProducts.find(p =>
            p.variants?.some(v => v.sku === variant.sku!.trim()) ||
            p.sku === variant.sku!.trim()
          );
          if (conflictingProduct) {
            errors.push(`Variant ${i + 1} SKU "${variant.sku.trim()}" already exists (conflicts with product: ${conflictingProduct.name})`);
          }
        }
        if (variant.stock !== undefined && (variant.stock < 0 || !Number.isInteger(variant.stock))) {
          errors.push(`Variant ${i + 1} stock must be a non-negative integer`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}