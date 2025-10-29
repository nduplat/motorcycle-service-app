import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { UserVehicle, Timestamp } from '../models';
import { Observable, from } from 'rxjs';
import { db } from '../firebase.config';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where, DocumentData, DocumentSnapshot, onSnapshot } from 'firebase/firestore';
import { AuthService } from './auth.service';

const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
    const data = snapshot.data() as any;
    return { ...data, id: snapshot.id } as T;
};

@Injectable({
  providedIn: 'root'
})
export class UserVehicleService {
  private allUserVehicles = signal<UserVehicle[]>([]);
  private isLoading = signal(true);
  private loadingError = signal<string | null>(null);
  private cache: UserVehicle[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes for vehicle data
  private authService = inject(AuthService);

  // Computed signals for external access
  userVehicles = computed(() => this.allUserVehicles());
  isDataLoading = computed(() => this.isLoading());
  dataError = computed(() => this.loadingError());

  constructor() {
    // Subscribe to auth state changes for reactive loading
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        console.log('UserVehicleService: User authenticated, loading user vehicles');
        this.loadAllUserVehicles();
      } else {
        console.log('UserVehicleService: User not authenticated, clearing user vehicles');
        this.allUserVehicles.set([]);
        this.isLoading.set(false);
        this.loadingError.set(null);
      }
    });
  }

  private async loadAllUserVehicles(forceRefresh = false) {
    // Check cache first
    const now = Date.now();
    if (!forceRefresh && this.cache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      this.allUserVehicles.set(this.cache);
      this.isLoading.set(false);
      return;
    }

    try {
      this.isLoading.set(true);
      this.loadingError.set(null);

      // Get current user from AuthService
      const currentUser = this.authService.currentUser();

      console.log("UserVehicleService: Loading user vehicles - Auth check:", {
        isAuthenticated: !!currentUser,
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userRole: currentUser?.role
      });

      if (!currentUser) {
        console.warn("UserVehicleService: No authenticated user - cannot load user vehicles");
        this.isLoading.set(false);
        return;
      }

      let q;
      if (currentUser.role === 'customer') {
        q = query(collection(db, "userVehicles"), where("userId", "==", currentUser.id));
      } else {
        q = query(collection(db, "userVehicles"));
      }
      const querySnapshot = await getDocs(q);
      const vehicles = querySnapshot.docs.map(doc => fromFirestore<UserVehicle>(doc));

      // Update cache
      this.cache = vehicles;
      this.cacheTimestamp = now;

      this.allUserVehicles.set(vehicles);
      this.isLoading.set(false);

      // Set up real-time listener for updates (temporarily disabled)
      /*
      onSnapshot(q, (snapshot) => {
        const updatedVehicles = snapshot.docs.map(doc => fromFirestore<UserVehicle>(doc));
        this.allUserVehicles.set(updatedVehicles);
      });
      */

    } catch (error: any) {
      console.error('Error loading user vehicles:', error);
      this.loadingError.set(error.message || 'Error loading user vehicles');
      this.isLoading.set(false);

      // If cache exists and fetch fails, use cached data
      if (this.cache) {
        this.allUserVehicles.set(this.cache);
        this.isLoading.set(false);
      }
    }
  }

  // Method to refresh cache manually
  async refreshVehicles(): Promise<void> {
    await this.loadAllUserVehicles(true);
  }

  // Invalidate cache when data changes
  private invalidateCache(): void {
    this.cache = null;
  }

  getVehiclesForUser(userId: string): Observable<UserVehicle[]> {
    return from(new Promise<UserVehicle[]>(async (resolve, reject) => {
      try {
        // First try to get from preloaded data
        const preloadedVehicles = this.allUserVehicles().filter(vehicle => vehicle.userId === userId);
        if (preloadedVehicles.length > 0) {
          resolve(preloadedVehicles);
          return;
        }

        // Fallback to direct query if not in preloaded data
        const q = query(collection(db, "userVehicles"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        const vehicles = querySnapshot.docs.map(doc => fromFirestore<UserVehicle>(doc));
        resolve(vehicles);
      } catch (e) {
        reject(e);
      }
    }));
  }

  getVehicleByPlate(plate: string): UserVehicle | undefined {
    return this.allUserVehicles().find(vehicle =>
      vehicle.plate?.toLowerCase() === plate.toLowerCase()
    );
  }

  getVehiclesByPlate(plate: string): UserVehicle[] {
    return this.allUserVehicles().filter(vehicle =>
      vehicle.plate?.toLowerCase() === plate.toLowerCase()
    );
  }

  addUserVehicle(vehicle: Omit<UserVehicle, 'id' | 'createdAt' | 'updatedAt'>): Observable<UserVehicle> {
    return from(new Promise<UserVehicle>(async (resolve, reject) => {
      try {
        // Check authentication
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        const docRef = await addDoc(collection(db, "userVehicles"), {
          ...vehicle,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        const newUserVehicle = {
            ...vehicle,
            id: docRef.id,
            createdAt: { toDate: () => new Date() },
            updatedAt: { toDate: () => new Date() }
        } as UserVehicle;

        // Update local state immediately
        this.allUserVehicles.update(vehicles => [...vehicles, newUserVehicle]);

        // Invalidate cache
        this.invalidateCache();

        resolve(newUserVehicle);
      } catch (e) {
        reject(e);
      }
    }));
  }

  deleteUserVehicle(id: string): Observable<boolean> {
      return from(new Promise<boolean>(async (resolve, reject) => {
       try {
         // Check authentication
         const currentUser = this.authService.currentUser();
         if (!currentUser) {
           reject(new Error('User not authenticated'));
           return;
         }

         await deleteDoc(doc(db, "userVehicles", id));

         // Update local state immediately
         this.allUserVehicles.update(vehicles => vehicles.filter(v => v.id !== id));

         // Invalidate cache
         this.invalidateCache();

         resolve(true);
       } catch (e) {
          reject(e);
       }
     }));
    }
}