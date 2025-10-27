import { Injectable, signal } from '@angular/core';
import { Supplier } from '../models';
import { db } from '../firebase.config';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, DocumentData, DocumentSnapshot } from 'firebase/firestore';
import { Observable, from } from 'rxjs';

const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
    const data = snapshot.data() as any;
    return { ...data, id: snapshot.id } as T;
};

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private suppliers = signal<Supplier[]>([]);

  constructor() {
    this.loadSuppliers();
  }
  
  private async loadSuppliers() {
    try {
      const querySnapshot = await getDocs(collection(db, "suppliers"));
      this.suppliers.set(querySnapshot.docs.map(doc => fromFirestore<Supplier>(doc)));
    } catch(error) {
      console.error("Error fetching suppliers:", error);
    }
  }
  
  getSuppliers() { 
    return this.suppliers.asReadonly(); 
  }

  addSupplier(supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Observable<Supplier> {
    return from(new Promise<Supplier>(async (resolve, reject) => {
      try {
        const docRef = await addDoc(collection(db, "suppliers"), {
          ...supplier,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        const newSupplier = { 
            ...supplier, 
            id: docRef.id, 
            createdAt: { toDate: () => new Date() }, 
            updatedAt: { toDate: () => new Date() } 
        } as Supplier;
        this.suppliers.update(s => [...s, newSupplier]);
        resolve(newSupplier);
      } catch (e) { reject(e); }
    }));
  }

  updateSupplier(updatedSupplier: Supplier): Observable<Supplier> {
    return from(new Promise<Supplier>(async (resolve, reject) => {
      try {
        const docRef = doc(db, "suppliers", updatedSupplier.id);
        const { id, ...dataToUpdate } = updatedSupplier;
        await updateDoc(docRef, { ...dataToUpdate, updatedAt: serverTimestamp() });
        this.suppliers.update(s => s.map(sup => sup.id === updatedSupplier.id ? updatedSupplier : sup));
        resolve(updatedSupplier);
      } catch (e) { reject(e); }
    }));
  }

  deleteSupplier(id: string): Observable<boolean> {
     return from(new Promise<boolean>(async (resolve, reject) => {
      try {
        await deleteDoc(doc(db, "suppliers", id));
        this.suppliers.update(s => s.filter(sup => sup.id !== id));
        resolve(true);
      } catch (e) { reject(e); }
    }));
  }
}