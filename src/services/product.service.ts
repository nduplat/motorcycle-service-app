import { Injectable, signal, inject, effect } from '@angular/core';
import { Product, Timestamp, StockMovement } from '../models';
import { Observable, from } from 'rxjs';
import { functions, db } from '../firebase.config';
import { httpsCallable } from 'firebase/functions';
import { addDoc, collection, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ProductValidationService } from './product-validation.service';
import { StockMovementService } from './stock-movement.service';
import { AuditService } from './audit.service';
import { AuthService } from './auth.service';
import { CacheService } from './cache.service';
import { filterProducts, ProductFilterOptions } from '../utils/product-filters';

// Debounce utility for search operations
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Remove fromFirestore function as we'll use callable functions


@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private products = signal<Product[]>([]);
  private hasLoaded = false;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private validationService = inject(ProductValidationService);
  private stockMovementService = inject(StockMovementService);
  private auditService = inject(AuditService);
  private authService = inject(AuthService);
  private cacheService = inject(CacheService);

  constructor() {
    // Subscribe to auth state changes for reactive loading
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        console.log('🔍 ProductService: User authenticated, loading products');
        this.loadProducts();
      } else {
        console.log('🔍 ProductService: User not authenticated, clearing products');
        this.products.set([]);
        this.hasLoaded = false;
      }
    });
  }

  private async loadProducts(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh) {
      const cachedData = await this.cacheService.get<Product[]>('product-data');
      if (cachedData) {
        this.products.set(cachedData);
        this.hasLoaded = true;
        return;
      }
    }

    // Get current user from AuthService
    const currentUser = this.authService.currentUser();

    console.log("🔍 ProductService: Loading products - Auth check:", {
      isAuthenticated: !!currentUser,
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      userRole: currentUser?.role
    });

    if (!currentUser) {
      console.warn("🔍 ProductService: No authenticated user - cannot load products");
      return;
    }

    try {
      const getProductsCallable = httpsCallable(functions, 'getProducts');
      const result = await getProductsCallable({ page: 1, pageSize: 1000 }); // Load all products for now
      const productsData = (result.data as any).products || [];

      console.log(`🔍 ProductService: Successfully loaded ${productsData.length} products`);

      // Update cache
      this.cacheService.set('product-data', productsData, this.CACHE_TTL);

      this.products.set(productsData);
      this.hasLoaded = true;
    } catch (error: any) {
      console.error("🔍 ProductService: Error fetching products:", {
        message: error.message,
        code: error.code,
        userRole: currentUser?.role,
        isPermissionError: error.code === 'permission-denied'
      });

      // If cache exists and fetch fails, use cached data
      const cachedData = await this.cacheService.get<Product[]>('product-data');
      if (cachedData) {
        console.warn("🔍 ProductService: Using cached product data due to fetch error");
        this.products.set(cachedData);
        this.hasLoaded = true;
      }
    }
  }

  // Method to refresh cache manually
  async refreshProducts(): Promise<void> {
    await this.loadProducts(true);
  }

  // Invalidate cache when data changes
  public invalidateCache(): void {
    // Note: Cache invalidation is now handled by the new CacheService
    // This method is kept for backward compatibility
    this.filteredProductsCache = null;
  }

  getProducts() {
    // Trigger lazy loading if not loaded
    if (!this.hasLoaded) {
      this.loadProducts();
    }
    return this.products.asReadonly();
  }

  private ensureProductsLoaded() {
    if (!this.hasLoaded) {
      // Trigger loading but don't wait for it
      this.loadProducts();
    }
  }

  getProduct(id: string): Observable<Product | undefined> {
    return from(new Promise<Product | undefined>(async (resolve, reject) => {
        try {
            const getProductCallable = httpsCallable(functions, 'getProduct');
            const result = await getProductCallable({ productId: id });
            resolve((result.data as any));
        } catch(e) {
            reject(e);
        }
    }));
  }

  addProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Observable<Product> {
    return from(new Promise<Product>(async (resolve, reject) => {
      try {
        // Check authentication
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        // Validate product data
        const existingProducts = this.products();
        const validation = await this.validationService.validateProduct(product, existingProducts);
        if (!validation.isValid) {
          reject(new Error(`Validation failed: ${validation.errors.join(', ')}`));
          return;
        }

        // If there are warnings, log them but don't fail
        if (validation.warnings.length > 0) {
          console.warn('Product validation warnings:', validation.warnings);
        }

        const docRef = await addDoc(collection(db, "products"), {
          ...product,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        const newProduct = { ...product, id: docRef.id, createdAt: { toDate: () => new Date() }, updatedAt: { toDate: () => new Date() } };
        this.products.update(products => [...products, newProduct as Product]);

        // Invalidate cache
        this.invalidateCache();

        // Audit logging
        await this.auditService.logProductChange(docRef.id, 'create', product);

        resolve(newProduct as Product);
      } catch (e) {
        reject(e);
      }
    }));
  }

  updateProduct(updatedProduct: Product): Observable<Product> {
     return from(new Promise<Product>(async (resolve, reject) => {
       try {
         // Check authentication
         const currentUser = this.authService.currentUser();
         if (!currentUser) {
           reject(new Error('User not authenticated'));
           return;
         }

         // Validate product data
         const existingProducts = this.products();
         const validation = await this.validationService.validateProduct(updatedProduct, existingProducts);
         if (!validation.isValid) {
           reject(new Error(`Validation failed: ${validation.errors.join(', ')}`));
           return;
         }

         // If there are warnings, log them but don't fail
         if (validation.warnings.length > 0) {
           console.warn('Product validation warnings:', validation.warnings);
         }

         const docRef = doc(db, "products", updatedProduct.id);
         const { id, ...dataToUpdate } = updatedProduct;

         // Get the original product for change tracking
         const originalProduct = this.products().find(p => p.id === updatedProduct.id);

         await updateDoc(docRef, { ...dataToUpdate, updatedAt: serverTimestamp() });
         this.products.update(products =>
           products.map(p => p.id === updatedProduct.id ? updatedProduct : p)
         );

         // Invalidate cache
         this.invalidateCache();

         // Audit logging - log the changes
         if (originalProduct) {
           const changes: Record<string, any> = {};
           Object.keys(dataToUpdate).forEach(key => {
             if ((originalProduct as any)[key] !== (dataToUpdate as any)[key]) {
               changes[key] = { from: (originalProduct as any)[key], to: (dataToUpdate as any)[key] };
             }
           });
           if (Object.keys(changes).length > 0) {
             await this.auditService.logProductChange(updatedProduct.id, 'update', changes);
           }
         }

         resolve(updatedProduct);
       } catch (e) {
         reject(e);
       }
     }));
   }

  deleteProduct(id: string): Observable<boolean> {
     return from(new Promise<boolean>(async (resolve, reject) => {
       try {
         // Check authentication
         const currentUser = this.authService.currentUser();
         if (!currentUser) {
           reject(new Error('User not authenticated'));
           return;
         }

         // Soft delete - mark as inactive
         const docRef = doc(db, "products", id);
         await updateDoc(docRef, {
           isActive: false,
           updatedAt: serverTimestamp()
         });

         // Update local state
         this.products.update(products =>
           products.map(p => p.id === id ? { ...p, isActive: false } : p)
         );

         // Invalidate cache
         this.invalidateCache();

         // Audit logging
         await this.auditService.logProductChange(id, 'delete', { isActive: false });

         resolve(true);
       } catch (e) {
         reject(e);
       }
     }));
   }

  // Enhanced methods for filtering and stock management
  private filteredProductsCache: { filters: any; result: Product[]; timestamp: number } | null = null;
  private readonly FILTER_CACHE_TTL = 30 * 1000; // 30 seconds for filter results

  getFilteredProducts(filters?: ProductFilterOptions): Product[] {
    // Ensure products are loaded
    this.ensureProductsLoaded();

    // Check filter cache
    const filterKey = JSON.stringify(filters);
    if (this.filteredProductsCache &&
        this.filteredProductsCache.filters === filterKey &&
        (Date.now() - this.filteredProductsCache.timestamp) < this.FILTER_CACHE_TTL) {
      return this.filteredProductsCache.result;
    }

    const products = this.products();
    const filtered = filterProducts(products, filters || {});

    // Cache the result
    this.filteredProductsCache = {
      filters: filterKey,
      result: filtered,
      timestamp: Date.now()
    };

    return filtered;
  }

  // Debounced search method for external use
  private debouncedSearchCallback?: (results: Product[]) => void;
  private debouncedSearch = debounce((searchTerm: string, callback: (results: Product[]) => void) => {
    const results = this.products().filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    callback(results);
  }, 300);

  searchProducts(searchTerm: string, callback: (results: Product[]) => void): void {
    this.debouncedSearch(searchTerm, callback);
  }

  updateStock(productId: string, newStock: number, reason: string, userId?: string): Observable<void> {
    return from(new Promise<void>(async (resolve, reject) => {
      try {
        const product = this.products().find(p => p.id === productId);
        if (!product) {
          reject(new Error('Product not found'));
          return;
        }

        const stockDifference = newStock - (product.stock || 0);

        // Create stock movement record
        await this.stockMovementService.createMovement({
          productId,
          quantity: stockDifference,
          type: 'adjustment',
          reason,
          createdBy: userId,
          createdAt: { toDate: () => new Date() }
        } as Omit<StockMovement, 'id'>);

        // Update product stock
        const docRef = doc(db, "products", productId);
        await updateDoc(docRef, {
          stock: newStock,
          updatedAt: serverTimestamp()
        });

        // Update local state
        this.products.update(products =>
          products.map(p => p.id === productId ? { ...p, stock: newStock } : p)
        );

        // Invalidate cache
        this.invalidateCache();

        // Audit logging
        await this.auditService.logStockMovement(productId, 'stock_update', stockDifference, userId);

        resolve();
      } catch (e) {
        reject(e);
      }
    }));
  }

  getLowStockProducts(): Product[] {
    this.ensureProductsLoaded();
    return this.products().filter(p => p.minStock && p.stock <= p.minStock);
  }

  getProductsByCompatibility(motorcycleId: string): Product[] {
    this.ensureProductsLoaded();
    return this.products().filter(p =>
      p.compatibility && p.compatibility.includes(motorcycleId) && p.isActive !== false
    );
  }

  transferProductToLocation(productId: string, newLocationId: string, userId?: string): Observable<void> {
    return from(new Promise<void>(async (resolve, reject) => {
      try {
        const product = this.products().find(p => p.id === productId);
        if (!product) {
          reject(new Error('Product not found'));
          return;
        }

        const oldLocationId = product.workshopLocationId;

        // Update product location
        const docRef = doc(db, "products", productId);
        await updateDoc(docRef, {
          workshopLocationId: newLocationId,
          updatedAt: serverTimestamp()
        });

        // Update local state
        this.products.update(products =>
          products.map(p => p.id === productId ? { ...p, workshopLocationId: newLocationId } : p)
        );

        // Invalidate cache
        this.invalidateCache();

        // Audit logging
        await this.auditService.logProductChange(productId, 'location_transfer', {
          from: oldLocationId,
          to: newLocationId
        }, userId);

        resolve();
      } catch (e) {
        reject(e);
      }
    }));
  }

  getProductsByLocation(locationId: string): Product[] {
    this.ensureProductsLoaded();
    return this.products().filter(p => p.workshopLocationId === locationId && p.isActive !== false);
  }

  reserveProduct(productId: string, quantity: number, workOrderId: string, userId?: string): Observable<void> {
    return from(new Promise<void>(async (resolve, reject) => {
      try {
        const product = this.products().find(p => p.id === productId);
        if (!product) {
          reject(new Error('Product not found'));
          return;
        }

        const availableStock = (product.stock || 0) - (product.reservedStock || 0);
        if (availableStock < quantity) {
          reject(new Error('Insufficient available stock'));
          return;
        }

        const newReservedStock = (product.reservedStock || 0) + quantity;

        // Update product reserved stock
        const docRef = doc(db, "products", productId);
        await updateDoc(docRef, {
          reservedStock: newReservedStock,
          updatedAt: serverTimestamp()
        });

        // Create stock movement for reservation
        await this.stockMovementService.createMovement({
          productId,
          quantity: -quantity, // Negative for reservation
          type: 'reservation',
          referenceId: workOrderId,
          reason: `Reserved for work order ${workOrderId}`,
          createdBy: userId,
          createdAt: { toDate: () => new Date() }
        } as Omit<StockMovement, 'id'>);

        // Update local state
        this.products.update(products =>
          products.map(p => p.id === productId ? { ...p, reservedStock: newReservedStock } : p)
        );

        // Invalidate cache
        this.invalidateCache();

        // Audit logging
        await this.auditService.logProductChange(productId, 'reserve', {
          quantity,
          workOrderId,
          newReservedStock
        }, userId);

        resolve();
      } catch (e) {
        reject(e);
      }
    }));
  }

  releaseReservation(productId: string, quantity: number, workOrderId: string, userId?: string): Observable<void> {
    return from(new Promise<void>(async (resolve, reject) => {
      try {
        const product = this.products().find(p => p.id === productId);
        if (!product) {
          reject(new Error('Product not found'));
          return;
        }

        const currentReserved = product.reservedStock || 0;
        if (currentReserved < quantity) {
          reject(new Error('Cannot release more than reserved quantity'));
          return;
        }

        const newReservedStock = currentReserved - quantity;

        // Update product reserved stock
        const docRef = doc(db, "products", productId);
        await updateDoc(docRef, {
          reservedStock: newReservedStock,
          updatedAt: serverTimestamp()
        });

        // Create stock movement for release
        await this.stockMovementService.createMovement({
          productId,
          quantity: quantity, // Positive for release
          type: 'reservation',
          referenceId: workOrderId,
          reason: `Released reservation for work order ${workOrderId}`,
          createdBy: userId,
          createdAt: { toDate: () => new Date() }
        } as Omit<StockMovement, 'id'>);

        // Update local state
        this.products.update(products =>
          products.map(p => p.id === productId ? { ...p, reservedStock: newReservedStock } : p)
        );

        // Invalidate cache
        this.invalidateCache();

        // Audit logging
        await this.auditService.logProductChange(productId, 'release_reservation', {
          quantity,
          workOrderId,
          newReservedStock
        }, userId);

        resolve();
      } catch (e) {
        reject(e);
      }
    }));
  }

  getAvailableStock(productId: string): number {
    this.ensureProductsLoaded();
    const product = this.products().find(p => p.id === productId);
    if (!product) return 0;
    return (product.stock || 0) - (product.reservedStock || 0);
  }

  getReservedProducts(): Product[] {
    this.ensureProductsLoaded();
    return this.products().filter(p => (p.reservedStock || 0) > 0 && p.isActive !== false);
  }
}