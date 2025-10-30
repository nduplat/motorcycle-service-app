import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { MotorcycleAssignment, Timestamp } from '../models';
import { Observable, from } from 'rxjs';
import { db } from '../firebase.config';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where, DocumentData, DocumentSnapshot, onSnapshot } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { MotorcycleAssignmentService } from './motorcycle-assignment.service';

const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
    const data = snapshot.data() as any;
    return { ...data, id: snapshot.id } as T;
};

@Injectable({
  providedIn: 'root'
})
export class UserVehicleService {
  private allUserVehicles = signal<MotorcycleAssignment[]>([]);
  private isLoading = signal(true);
  private loadingError = signal<string | null>(null);
  private cache: MotorcycleAssignment[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes for vehicle data
  private authService = inject(AuthService);
  private motorcycleAssignmentService = inject(MotorcycleAssignmentService);

  // Computed signals for external access
  userVehicles = computed(() => this.allUserVehicles());
  isDataLoading = computed(() => this.isLoading());
  dataError = computed(() => this.loadingError());

  constructor() {
    // Subscribe to auth state changes for reactive loading
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        console.log('UserVehicleService: User authenticated, loading user vehicle assignments');
        this.loadAllUserVehicles();
      } else {
        console.log('UserVehicleService: User not authenticated, clearing user vehicle assignments');
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

      console.log("UserVehicleService: Loading user vehicle assignments - Auth check:", {
        isAuthenticated: !!currentUser,
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        userRole: currentUser?.role
      });

      if (!currentUser) {
        console.warn("UserVehicleService: No authenticated user - cannot load user vehicle assignments");
        this.isLoading.set(false);
        return;
      }

      const assignments = await this.motorcycleAssignmentService.getUserAssignments(currentUser.id);

      // Update cache
      this.cache = assignments;
      this.cacheTimestamp = now;

      this.allUserVehicles.set(assignments);
      this.isLoading.set(false);

    } catch (error: any) {
      console.error('Error loading user vehicle assignments:', error);
      this.loadingError.set(error.message || 'Error loading user vehicle assignments');
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

  getVehiclesForUser(userId: string): Observable<MotorcycleAssignment[]> {
    return from(this.motorcycleAssignmentService.getUserAssignments(userId));
  }

  getVehicleByPlate(plate: string): Observable<MotorcycleAssignment | undefined> {
    return from(this.motorcycleAssignmentService.getAssignmentByPlate(plate).then(assignment => assignment || undefined));
  }

  getVehiclesByPlate(plate: string): Observable<MotorcycleAssignment[]> {
    return from(this.motorcycleAssignmentService.getAssignmentByPlate(plate).then(assignment => assignment ? [assignment] : []));
  }

  addUserVehicle(assignment: Omit<MotorcycleAssignment, 'id' | 'createdAt' | 'updatedAt' | 'assignedAt' | 'assignedBy'>): Observable<MotorcycleAssignment> {
    return from(new Promise<MotorcycleAssignment>(async (resolve, reject) => {
      try {
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        const newAssignmentId = await this.motorcycleAssignmentService.createAssignment({
          ...assignment,
          userId: currentUser.id,
          assignedBy: currentUser.id,
          status: 'active',
          mileageKm: assignment.mileageKm || 0,
          cylinderCapacity: assignment.cylinderCapacity || 0,
          brand: assignment.brand || 'Unknown',
          model: assignment.model || 'Unknown',
          year: assignment.year || new Date().getFullYear(),
          displacementCc: assignment.displacementCc || 0,
          category: assignment.category || 'Unknown',
          type: assignment.type || 'Unknown',
          isActive: assignment.isActive !== undefined ? assignment.isActive : true,
        });

        const newAssignment = await this.motorcycleAssignmentService.getAssignmentByPlate(newAssignmentId);

        if (newAssignment) {
          this.allUserVehicles.update(assignments => [...assignments, newAssignment]);
          this.invalidateCache();
          resolve(newAssignment);
        } else {
          reject(new Error('Failed to retrieve new assignment'));
        }
      } catch (e) {
        reject(e);
      }
    }));
  }

  deleteUserVehicle(plate: string): Observable<boolean> {
      return from(new Promise<boolean>(async (resolve, reject) => {
       try {
         const currentUser = this.authService.currentUser();
         if (!currentUser) {
           reject(new Error('User not authenticated'));
           return;
         }

         // Assuming a method to deactivate/delete assignment by plate
         await this.motorcycleAssignmentService.updateAssignment(plate, { status: 'inactive' });

         this.allUserVehicles.update(assignments => assignments.filter(a => a.plate !== plate));

         this.invalidateCache();

         resolve(true);
       } catch (e) {
          reject(e);
       }
     }));
    }
}