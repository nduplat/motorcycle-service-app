import { Injectable, signal, inject, effect } from '@angular/core';
import { Motorcycle, MotorcycleCategory, MotorcycleType } from '../models';
import { of, delay, Observable, from } from 'rxjs';
import { db } from '../firebase.config';
import { collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, DocumentData, DocumentSnapshot, query, where, orderBy } from 'firebase/firestore';
import { MotorcycleCategorizationService } from './motorcycle-categorization.service';
import { AuthService } from './auth.service';
import { CacheService } from './cache.service'; // Import CacheService

const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
    const data = snapshot.data() as any;
    return { ...data, id: snapshot.id } as T;
};

@Injectable({
  providedIn: 'root'
})
export class MotorcycleService {
  private motorcycles = signal<Motorcycle[]>([]);
  categorizationService = inject(MotorcycleCategorizationService);
  private authService = inject(AuthService);
  private cacheService = inject(CacheService); // Inject CacheService

  private readonly CATALOG_CACHE_KEY = 'motorcycle_catalog';
  private readonly CATALOG_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for static catalog data

  constructor() {
    // Subscribe to auth state changes for reactive loading
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        console.log('MotorcycleService: User authenticated, loading motorcycles catalog');
        this.loadMotorcycles();
      } else {
        console.log('MotorcycleService: User not authenticated, clearing motorcycles catalog');
        this.motorcycles.set([]);
      }
    });
  }

  private async loadMotorcycles() {
    // Check cache first
    const cachedCatalog = await this.cacheService.get<Motorcycle[]>(this.CATALOG_CACHE_KEY);
    if (cachedCatalog) {
      console.log('MotorcycleService: Loading motorcycles catalog from cache');
      this.motorcycles.set(cachedCatalog);
      return;
    }

    // Get current user from AuthService
    const currentUser = this.authService.currentUser();

    console.log("MotorcycleService: Loading motorcycles catalog - Auth check:", {
      isAuthenticated: !!currentUser,
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      userRole: currentUser?.role
    });

    if (!currentUser) {
      console.warn("MotorcycleService: No authenticated user - cannot load motorcycles catalog");
      return;
    }

    try {
      console.log("MotorcycleService: Attempting to load motorcycles catalog collection");
      const querySnapshot = await getDocs(collection(db, "motorcycles"));
      const motorcyclesData = querySnapshot.docs.map(doc => fromFirestore<Motorcycle>(doc));
      console.log(`MotorcycleService: Successfully loaded ${motorcyclesData.length} motorcycles catalog`);
      this.motorcycles.set(motorcyclesData);

      // Store in cache
      this.cacheService.set(this.CATALOG_CACHE_KEY, motorcyclesData, this.CATALOG_CACHE_TTL, 'catalog', undefined, undefined, undefined, 'low');

    } catch (error: any) {
      console.error("MotorcycleService: Error fetching motorcycles catalog:", {
        message: error.message,
        code: error.code,
        userRole: currentUser?.role,
        isPermissionError: error.code === 'permission-denied',
        networkOnline: navigator.onLine,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });

      // Handle specific Firebase errors
      switch (error.code) {
        case 'permission-denied':
          console.warn('MotorcycleService: PERMISSION_DENIED - User lacks permission to read motorcycles catalog');
          break;
        case 'unavailable':
          console.warn('MotorcycleService: SERVICE_UNAVAILABLE - Firestore service temporarily unavailable');
          break;
        case 'internal':
          console.error('MotorcycleService: FIREBASE_INTERNAL_ERROR - Firebase internal error occurred');
          break;
        case 'deadline-exceeded':
          console.warn('MotorcycleService: DEADLINE_EXCEEDED - Request timed out');
          break;
        case 'resource-exhausted':
          console.warn('MotorcycleService: RESOURCE_EXHAUSTED - Quota exceeded or rate limited');
          break;
        default:
          console.warn('MotorcycleService: UNKNOWN_ERROR - Unknown error fetching motorcycles catalog');
      }
    }
  }

  getMotorcycles() {
    return this.motorcycles.asReadonly();
  }

  // CRUD operations for the motorcycle catalog (if needed, otherwise remove)
  // For now, assuming these are for managing the catalog itself
  addMotorcycle(motorcycle: Omit<Motorcycle, 'id'>): Observable<Motorcycle> {
    return from(new Promise<Motorcycle>(async (resolve, reject) => {
      try {
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        const completedMotorcycle = this.categorizationService.autoComplete(motorcycle);
        const validation = this.categorizationService.validateMotorcycle(completedMotorcycle);

        if (!validation.isValid) {
          reject(new Error(`Validation failed: ${validation.errors.join(', ')}`));
          return;
        }

        const motorcycleWithTimestamps = {
          ...completedMotorcycle,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "motorcycles"), motorcycleWithTimestamps);
        const newMotorcycle = {
          ...completedMotorcycle,
          id: docRef.id,
          createdAt: { toDate: () => new Date() },
          updatedAt: { toDate: () => new Date() }
        } as Motorcycle;
        this.motorcycles.update(motos => [...motos, newMotorcycle]);
        // Invalidate catalog cache on add
        this.cacheService.invalidateByEntity('catalog', this.CATALOG_CACHE_KEY);
        resolve(newMotorcycle);
      } catch (e: any) {
        console.error('MotorcycleService: Error adding motorcycle to catalog:', {
          message: e.message,
          code: e.code,
          networkOnline: navigator.onLine,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        });
        reject(new Error(e.message || 'Error desconocido al agregar motocicleta al catálogo'));
      }
    }));
  }

  updateMotorcycle(updatedMotorcycle: Motorcycle): Observable<Motorcycle> {
    return from(new Promise<Motorcycle>(async (resolve, reject) => {
      try {
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        const docRef = doc(db, "motorcycles", updatedMotorcycle.id);
        const { id, ...dataToUpdate } = updatedMotorcycle;
        await updateDoc(docRef, dataToUpdate);
        this.motorcycles.update(motos =>
          motos.map(moto => moto.id === updatedMotorcycle.id ? updatedMotorcycle : moto)
        );
        // Invalidate catalog cache on update
        this.cacheService.invalidateByEntity('catalog', this.CATALOG_CACHE_KEY);
        resolve(updatedMotorcycle);
      } catch(e) {
        reject(e);
      }
    }));
  }

  deleteMotorcycle(id: string): Observable<boolean> {
      return from(new Promise<boolean>(async (resolve, reject) => {
        try {
          const currentUser = this.authService.currentUser();
          if (!currentUser) {
            reject(new Error('User not authenticated'));
            return;
          }

         await deleteDoc(doc(db, "motorcycles", id));
         this.motorcycles.update(motos => motos.filter(moto => moto.id !== id));
         // Invalidate catalog cache on delete
         this.cacheService.invalidateByEntity('catalog', this.CATALOG_CACHE_KEY);
         resolve(true);
        } catch(e) {
          reject(e);
        }
      }));
    }

  // Enhanced methods for categorization and filtering
  getMotorcyclesGroupedByCategory(): Record<string, Motorcycle[]> {
    return this.categorizationService.groupByCategory(this.motorcycles());
  }

  getMotorcyclesGroupedByType(): Record<string, Motorcycle[]> {
    return this.categorizationService.groupByType(this.motorcycles());
  }

  getMotorcyclesGroupedByBrand(): Record<string, Motorcycle[]> {
    return this.categorizationService.groupByBrand(this.motorcycles());
  }

  searchMotorcycles(query: string, filters?: any): Motorcycle[] {
    return this.categorizationService.searchMotorcycles(this.motorcycles(), query, filters);
  }

  getMotorcyclesByCategory(category: string): Motorcycle[] {
    return this.motorcycles().filter(m => m.category === category);
  }

  getMotorcyclesByType(type: string): Motorcycle[] {
    return this.motorcycles().filter(m => m.type === type);
  }

  getMotorcyclesByBrand(brand: string): Motorcycle[] {
    return this.motorcycles().filter(m => m.brand.toLowerCase() === brand.toLowerCase());
  }

  getMotorcyclesByYear(year: number): Motorcycle[] {
    return this.motorcycles().filter(m => m.year === year);
  }

  getMotorcyclesByYearRange(minYear: number, maxYear: number): Motorcycle[] {
    return this.motorcycles().filter(m => m.year >= minYear && m.year <= maxYear);
  }

  getAvailableYears(): number[] {
    return this.categorizationService.getAvailableYears(this.motorcycles());
  }

  getActiveMotorcycles(): Motorcycle[] {
    return this.motorcycles().filter(m => m.isActive !== false);
  }

  getPopularBrands(): string[] {
    return this.categorizationService.getPopularBrands();
  }

  getPopularTypes(): { type: string; label: string }[] {
    return this.categorizationService.getPopularTypes();
  }

  getCCRangeLabel(category: string): string {
    return this.categorizationService.getCCRangeLabel(category as any);
  }

  getCCRangeColor(category: string): string {
    return this.categorizationService.getCCRangeColor(category as any);
  }

  getTypeLabel(type: string): string {
    return this.categorizationService.getTypeLabel(type as any);
  }

  getTypeColor(type: string): string {
    return this.categorizationService.getTypeColor(type as any);
  }

  validateMotorcycle(motorcycle: Partial<Motorcycle>): { isValid: boolean; errors: string[] } {
    return this.categorizationService.validateMotorcycle(motorcycle);
  }

  autoCompleteMotorcycle(motorcycle: Partial<Motorcycle>): Partial<Motorcycle> {
    return this.categorizationService.autoComplete(motorcycle);
  }

  getUserAssignedMotorcycles(userId: string): Observable<Motorcycle[]> {
    return from(new Promise<Motorcycle[]>(async (resolve, reject) => {
      try {
        // Query motorcycleAssignments collection for active assignments of this user
        const assignmentsQuery = query(
          collection(db, 'motorcycleAssignments'),
          where('userId', '==', userId),
          where('status', '==', 'active')
        );
        const assignmentsSnapshot = await getDocs(assignmentsQuery);

        const motorcycleIds: string[] = [];
        assignmentsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.motorcycleId) {
            motorcycleIds.push(data.motorcycleId);
          }
        });

        if (motorcycleIds.length === 0) {
          resolve([]);
          return;
        }

        // Get the motorcycles from the catalog
        const motorcycles: Motorcycle[] = [];
        for (const motorcycleId of motorcycleIds) {
          try {
            const motorcycleDoc = await getDoc(doc(db, 'motorcycles', motorcycleId));
            if (motorcycleDoc.exists()) {
              const motorcycle = fromFirestore<Motorcycle>(motorcycleDoc);
              motorcycles.push(motorcycle);
            }
          } catch (error) {
            console.error(`Error fetching motorcycle ${motorcycleId}:`, error);
          }
        }

        resolve(motorcycles);
      } catch (error: any) {
        console.error('Error fetching user assigned motorcycles:', error);
        reject(new Error(error.message || 'Error fetching assigned motorcycles'));
      }
    }));
  }
}