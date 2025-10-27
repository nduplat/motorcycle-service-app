import { Injectable, signal, inject, effect } from '@angular/core';
import { Motorcycle, MotorcycleCategory, MotorcycleType, Vehicle, MotorcycleAssignment } from '../models';
import { of, delay, Observable, from } from 'rxjs';
import { db } from '../firebase.config';
import { collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, DocumentData, DocumentSnapshot, query, where, orderBy } from 'firebase/firestore';
import { MotorcycleCategorizationService } from './motorcycle-categorization.service';
import { AuthService } from './auth.service';

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

  constructor() {
    // Subscribe to auth state changes for reactive loading
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        console.log('MotorcycleService: User authenticated, loading motorcycles');
        this.loadMotorcycles();
      } else {
        console.log('MotorcycleService: User not authenticated, clearing motorcycles');
        this.motorcycles.set([]);
      }
    });
  }

  private async loadMotorcycles() {
    // Get current user from AuthService
    const currentUser = this.authService.currentUser();

    console.log("MotorcycleService: Loading motorcycles - Auth check:", {
      isAuthenticated: !!currentUser,
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      userRole: currentUser?.role
    });

    if (!currentUser) {
      console.warn("MotorcycleService: No authenticated user - cannot load motorcycles");
      return;
    }

    try {
      console.log("MotorcycleService: Attempting to load motorcycles collection");
      const querySnapshot = await getDocs(collection(db, "motorcycles"));
      const motorcyclesData = querySnapshot.docs.map(doc => fromFirestore<Motorcycle>(doc));
      console.log(`MotorcycleService: Successfully loaded ${motorcyclesData.length} motorcycles`);
      this.motorcycles.set(motorcyclesData);
    } catch (error: any) {
      console.error("MotorcycleService: Error fetching motorcycles:", {
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
          console.warn('MotorcycleService: PERMISSION_DENIED - User lacks permission to read motorcycles');
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
          console.warn('MotorcycleService: UNKNOWN_ERROR - Unknown error fetching motorcycles');
      }
    }
  }

  getMotorcycles() {
    return this.motorcycles.asReadonly();
  }
  
  getVehiclesForUser(userId: string): Observable<Vehicle[]> {
    return from(new Promise<Vehicle[]>(async (resolve, reject) => {
        try {
            const q = query(collection(db, "vehicles"), where("ownerId", "==", userId));
            const querySnapshot = await getDocs(q);
            resolve(querySnapshot.docs.map(doc => fromFirestore<Vehicle>(doc)));
        } catch(e) { reject(e); }
    }));
  }

  addMotorcycle(motorcycle: Omit<Motorcycle, 'id'>): Observable<Motorcycle> {
    return from(new Promise<Motorcycle>(async (resolve, reject) => {
      try {
        // Check authentication
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        // Auto-complete and validate motorcycle data
        const completedMotorcycle = this.categorizationService.autoComplete(motorcycle);
        const validation = this.categorizationService.validateMotorcycle(completedMotorcycle);

        if (!validation.isValid) {
          reject(new Error(`Validation failed: ${validation.errors.join(', ')}`));
          return;
        }

        // Add timestamps using serverTimestamp for Firestore
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
        resolve(newMotorcycle);
      } catch (e: any) {
        console.error('MotorcycleService: Error adding motorcycle:', {
          message: e.message,
          code: e.code,
          networkOnline: navigator.onLine,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        });

        // Handle specific Firebase errors
        switch (e.code) {
          case 'permission-denied':
            console.warn('MotorcycleService: PERMISSION_DENIED - User lacks permission to add motorcycles');
            reject(new Error('No tienes permisos para agregar motocicletas'));
            break;
          case 'unavailable':
            console.warn('MotorcycleService: SERVICE_UNAVAILABLE - Firestore service temporarily unavailable');
            reject(new Error('Servicio temporalmente no disponible'));
            break;
          case 'internal':
            console.error('MotorcycleService: FIREBASE_INTERNAL_ERROR - Firebase internal error occurred');
            reject(new Error('Error interno del servicio'));
            break;
          case 'deadline-exceeded':
            console.warn('MotorcycleService: DEADLINE_EXCEEDED - Request timed out');
            reject(new Error('La solicitud ha expirado'));
            break;
          case 'resource-exhausted':
            console.warn('MotorcycleService: RESOURCE_EXHAUSTED - Quota exceeded or rate limited');
            reject(new Error('Límite de recursos excedido'));
            break;
          default:
            console.warn('MotorcycleService: UNKNOWN_ERROR - Unknown error adding motorcycle');
            reject(new Error(e.message || 'Error desconocido al agregar motocicleta'));
        }
      }
    }));
  }

  updateMotorcycle(updatedMotorcycle: Motorcycle): Observable<Motorcycle> {
    return from(new Promise<Motorcycle>(async (resolve, reject) => {
      try {
        // Check authentication
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
        resolve(updatedMotorcycle);
      } catch(e) {
        reject(e);
      }
    }));
  }

  deleteMotorcycle(id: string): Observable<boolean> {
      return from(new Promise<boolean>(async (resolve, reject) => {
        try {
          // Check authentication
          const currentUser = this.authService.currentUser();
          if (!currentUser) {
            reject(new Error('User not authenticated'));
            return;
          }

         await deleteDoc(doc(db, "motorcycles", id));
         this.motorcycles.update(motos => motos.filter(moto => moto.id !== id));
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

  // ========== PLATE-BASED OPERATIONS ==========

  /**
   * Find motorcycle by license plate
   */
  findMotorcycleByPlate(plate: string): Observable<Motorcycle | null> {
    return from(new Promise<Motorcycle | null>(async (resolve, reject) => {
      try {
        // Check authentication
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        // Query motorcycles by plate
        const q = query(collection(db, "motorcycles"), where("plate", "==", plate));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          resolve(null);
          return;
        }

        const motorcycle = fromFirestore<Motorcycle>(querySnapshot.docs[0]);

        // Check if user has access to this motorcycle
        if (!await this.checkUserHasAccessToMotorcycle(currentUser.id, motorcycle.id)) {
          reject(new Error('No tienes acceso a esta motocicleta'));
          return;
        }

        resolve(motorcycle);
      } catch (error) {
        console.error('Error finding motorcycle by plate:', error);
        reject(error);
      }
    }));
  }

  /**
   * Create motorcycle catalog entry from plate data
   */
  createMotorcycleFromPlate(plate: string, userData: any): Observable<Motorcycle> {
    return from(new Promise<Motorcycle>(async (resolve, reject) => {
      try {
        // Check authentication
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        // Check if plate already exists
        const existingMotorcycle = await this.findMotorcycleByPlate(plate).toPromise();
        if (existingMotorcycle) {
          reject(new Error('Ya existe una motocicleta registrada con esta placa'));
          return;
        }

        // Create motorcycle with plate
        const motorcycleData: Omit<Motorcycle, 'id' | 'createdAt' | 'updatedAt'> = {
          brand: userData.brand || 'Desconocida',
          model: userData.model || 'Desconocido',
          year: userData.year || new Date().getFullYear(),
          plate: plate,
          isActive: true
        };

        // Auto-complete and validate
        const completedMotorcycle = this.categorizationService.autoComplete(motorcycleData);
        const validation = this.categorizationService.validateMotorcycle(completedMotorcycle);

        if (!validation.isValid) {
          reject(new Error(`Validation failed: ${validation.errors.join(', ')}`));
          return;
        }

        // Add to Firestore
        const docRef = await addDoc(collection(db, "motorcycles"), {
          ...completedMotorcycle,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        const newMotorcycle = {
          ...completedMotorcycle,
          id: docRef.id,
          createdAt: { toDate: () => new Date() },
          updatedAt: { toDate: () => new Date() }
        } as Motorcycle;

        // Update local state
        this.motorcycles.update(motos => [...motos, newMotorcycle]);

        // Create assignment for the user
        await this.createMotorcycleAssignment({
          userId: currentUser.id,
          motorcycleId: newMotorcycle.id,
          plate: plate,
          assignedBy: currentUser.id,
          status: 'active',
          mileageKm: userData.mileageKm,
          notes: `Asignación creada al registrar motocicleta con placa ${plate}`
        });

        resolve(newMotorcycle);
      } catch (error) {
        console.error('Error creating motorcycle from plate:', error);
        reject(error);
      }
    }));
  }

  /**
   * Get or create motorcycle by plate (combined lookup/create method)
   */
  getOrCreateMotorcycleByPlate(plate: string, userData: any): Observable<Motorcycle> {
    return from(new Promise<Motorcycle>(async (resolve, reject) => {
      try {
        // Check authentication
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        // First try to find existing motorcycle
        const existingMotorcycle = await this.findMotorcycleByPlate(plate).toPromise();

        if (existingMotorcycle) {
          resolve(existingMotorcycle);
          return;
        }

        // If not found, create new one
        const newMotorcycle = await this.createMotorcycleFromPlate(plate, userData).toPromise();
        if (newMotorcycle) {
          resolve(newMotorcycle);
        } else {
          reject(new Error('Failed to create motorcycle'));
        }

      } catch (error) {
        console.error('Error in getOrCreateMotorcycleByPlate:', error);
        reject(error);
      }
    }));
  }

  // ========== ASSIGNMENT CHECKING METHODS ==========

  /**
   * Check if user has access to a specific motorcycle
   */
  private async checkUserHasAccessToMotorcycle(userId: string, motorcycleId: string): Promise<boolean> {
    try {
      // Query motorcycle assignments
      const q = query(
        collection(db, 'motorcycleAssignments'),
        where('userId', '==', userId),
        where('motorcycleId', '==', motorcycleId),
        where('status', '==', 'active')
      );

      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking user motorcycle access:', error);
      return false;
    }
  }

  /**
   * Create motorcycle assignment
   */
  private async createMotorcycleAssignment(assignment: Omit<MotorcycleAssignment, 'id' | 'assignedAt' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const assignmentData = {
        ...assignment,
        assignedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "motorcycleAssignments"), assignmentData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating motorcycle assignment:', error);
      throw error;
    }
  }

  /**
   * Get user's assigned motorcycles
   */
  getUserAssignedMotorcycles(userId?: string): Observable<Motorcycle[]> {
    return from(new Promise<Motorcycle[]>(async (resolve, reject) => {
      try {
        const currentUser = this.authService.currentUser();
        const targetUserId = userId || currentUser?.id;

        if (!targetUserId) {
          reject(new Error('User not authenticated'));
          return;
        }

        // Get user's assignments
        const assignmentsQuery = query(
          collection(db, 'motorcycleAssignments'),
          where('userId', '==', targetUserId),
          where('status', '==', 'active')
        );

        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        const motorcycleIds = assignmentsSnapshot.docs.map(doc => doc.data()['motorcycleId'] as string);

        if (motorcycleIds.length === 0) {
          resolve([]);
          return;
        }

        // Get motorcycles by IDs
        const motorcycles: Motorcycle[] = [];
        for (const motorcycleId of motorcycleIds) {
          const motorcycleDoc = await getDoc(doc(db, 'motorcycles', motorcycleId));
          if (motorcycleDoc.exists()) {
            motorcycles.push(fromFirestore<Motorcycle>(motorcycleDoc));
          }
        }

        resolve(motorcycles);
      } catch (error) {
        console.error('Error getting user assigned motorcycles:', error);
        reject(error);
      }
    }));
  }

  /**
   * Check if user can access motorcycle by plate
   */
  canUserAccessMotorcycleByPlate(userId: string, plate: string): Observable<boolean> {
    return from(new Promise<boolean>(async (resolve, reject) => {
      try {
        // Find motorcycle by plate
        const motorcycle = await this.findMotorcycleByPlate(plate).toPromise();
        if (!motorcycle) {
          resolve(false);
          return;
        }

        // Check access
        const hasAccess = await this.checkUserHasAccessToMotorcycle(userId, motorcycle.id);
        resolve(hasAccess);
      } catch (error) {
        console.error('Error checking user access by plate:', error);
        reject(error);
      }
    }));
  }
}