import { Injectable, signal, inject } from '@angular/core';
import { WorkshopLocation } from '../models';
import { db } from '../firebase.config';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { from, Observable } from 'rxjs';

const fromFirestore = <T>(snapshot: any): T => {
  return { ...snapshot.data(), id: snapshot.id } as T;
};

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private locations = signal<WorkshopLocation[]>([]);

  constructor() {
    this.loadLocations();
  }

  private async loadLocations() {
    try {
      const q = query(collection(db, 'workshopLocations'), orderBy('name'));
      const querySnapshot = await getDocs(q);
      this.locations.set(querySnapshot.docs.map(doc => fromFirestore<WorkshopLocation>(doc)));
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  }

  getLocations() {
    return this.locations.asReadonly();
  }

  getActiveLocations() {
    return this.locations().filter(loc => loc.active !== false);
  }

  getLocationById(id: string): WorkshopLocation | undefined {
    return this.locations().find(loc => loc.id === id);
  }

  addLocation(location: Omit<WorkshopLocation, 'id' | 'createdAt' | 'updatedAt'>): Observable<WorkshopLocation> {
    return from(new Promise<WorkshopLocation>(async (resolve, reject) => {
      try {
        const docRef = await addDoc(collection(db, 'workshopLocations'), {
          ...location,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        const newLocation = { ...location, id: docRef.id } as WorkshopLocation;
        this.locations.update(locs => [...locs, newLocation]);
        resolve(newLocation);
      } catch (error: any) {
        reject(new Error(error.message || 'Failed to add location'));
      }
    }));
  }

  updateLocation(location: WorkshopLocation): Observable<WorkshopLocation> {
    return from(new Promise<WorkshopLocation>(async (resolve, reject) => {
      try {
        const { id, ...data } = location;
        await updateDoc(doc(db, 'workshopLocations', id), {
          ...data,
          updatedAt: new Date()
        });

        this.locations.update(locs =>
          locs.map(loc => loc.id === id ? location : loc)
        );
        resolve(location);
      } catch (error: any) {
        reject(new Error(error.message || 'Failed to update location'));
      }
    }));
  }

  deleteLocation(id: string): Observable<boolean> {
    return from(new Promise<boolean>(async (resolve, reject) => {
      try {
        await deleteDoc(doc(db, 'workshopLocations', id));
        this.locations.update(locs => locs.filter(loc => loc.id !== id));
        resolve(true);
      } catch (error: any) {
        reject(new Error(error.message || 'Failed to delete location'));
      }
    }));
  }
}