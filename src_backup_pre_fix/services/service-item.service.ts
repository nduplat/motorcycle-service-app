
import { Injectable, signal, inject, effect } from '@angular/core';
import { ServiceItem } from '../models';
import { Observable, from } from 'rxjs';
import { db } from '../firebase.config';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, DocumentData, DocumentSnapshot } from 'firebase/firestore';
import { AuthService } from './auth.service';

const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
    const data = snapshot.data() as any;
    return { ...data, id: snapshot.id } as T;
};

@Injectable({
  providedIn: 'root'
})
export class ServiceItemService {
  private services = signal<ServiceItem[]>([]);
  private authService = inject(AuthService);

  constructor() {
    // Subscribe to auth state changes for reactive loading
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        console.log('ServiceItemService: User authenticated, loading services');
        this.loadServices();
      } else {
        console.log('ServiceItemService: User not authenticated, clearing services');
        this.services.set([]);
      }
    });
  }

  private async loadServices() {
    // Get current user from AuthService
    const currentUser = this.authService.currentUser();

    console.log("ServiceItemService: Loading services - Auth check:", {
      isAuthenticated: !!currentUser,
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      userRole: currentUser?.role
    });

    if (!currentUser) {
      console.warn("ServiceItemService: No authenticated user - cannot load services");
      return;
    }

    try {
      console.log("ServiceItemService: Attempting to load services collection");
      const querySnapshot = await getDocs(collection(db, "services"));
      const servicesData = querySnapshot.docs.map(doc => fromFirestore<ServiceItem>(doc));
      console.log(`ServiceItemService: Successfully loaded ${servicesData.length} services`);
      this.services.set(servicesData);
    } catch(error: any) {
      console.error("ServiceItemService: Error fetching services:", {
        message: error.message,
        code: error.code,
        userRole: currentUser?.role,
        isPermissionError: error.code === 'permission-denied'
      });
    }
  }

  getServices() {
    return this.services.asReadonly();
  }

  getServiceAsMap() {
    const map = new Map<string, ServiceItem>();
    this.services().forEach(service => map.set(service.id, service));
    return map;
  }

  addServiceItem(service: Omit<ServiceItem, 'id' | 'createdAt' | 'updatedAt'>): Observable<ServiceItem> {
    return from(new Promise<ServiceItem>(async (resolve, reject) => {
      try {
        // Check authentication
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        const docRef = await addDoc(collection(db, "services"), {
          ...service,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        const newService = {
            ...service,
            id: docRef.id,
            createdAt: { toDate: () => new Date() },
            updatedAt: { toDate: () => new Date() }
        } as ServiceItem;
        this.services.update(s => [...s, newService]);
        resolve(newService);
      } catch (e) { reject(e); }
    }));
  }

  updateServiceItem(updatedService: ServiceItem): Observable<ServiceItem> {
    return from(new Promise<ServiceItem>(async (resolve, reject) => {
      try {
        // Check authentication
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        const docRef = doc(db, "services", updatedService.id);
        const { id, ...dataToUpdate } = updatedService;
        await updateDoc(docRef, { ...dataToUpdate, updatedAt: serverTimestamp() });
        this.services.update(s => s.map(serv => serv.id === updatedService.id ? updatedService : serv));
        resolve(updatedService);
      } catch (e) { reject(e); }
    }));
  }

  deleteServiceItem(id: string): Observable<boolean> {
      return from(new Promise<boolean>(async (resolve, reject) => {
       try {
         // Check authentication
         const currentUser = this.authService.currentUser();
         if (!currentUser) {
           reject(new Error('User not authenticated'));
           return;
         }

         await deleteDoc(doc(db, "services", id));
         this.services.update(s => s.filter(serv => serv.id !== id));
         resolve(true);
       } catch (e) { reject(e); }
     }));
    }
}
