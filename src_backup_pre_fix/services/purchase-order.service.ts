import { Injectable, signal } from '@angular/core';
import { PurchaseOrder } from '../models';
import { Observable, from } from 'rxjs';
import { db } from '../firebase.config';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp, DocumentData, DocumentSnapshot } from 'firebase/firestore';

const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
    const data = snapshot.data() as any;
    return { ...data, id: snapshot.id } as T;
};

@Injectable({
  providedIn: 'root'
})
export class PurchaseOrderService {
  private purchaseOrders = signal<PurchaseOrder[]>([]);

  constructor() {
    this.loadPurchaseOrders();
  }

  private async loadPurchaseOrders() {
    try {
      const querySnapshot = await getDocs(collection(db, "purchaseOrders"));
      this.purchaseOrders.set(querySnapshot.docs.map(doc => fromFirestore<PurchaseOrder>(doc)));
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
    }
  }

  getPurchaseOrders() {
    return this.purchaseOrders.asReadonly();
  }
  
  getPurchaseOrder(id: string): Observable<PurchaseOrder | undefined> {
    return from(new Promise<PurchaseOrder | undefined>(async (resolve, reject) => {
        try {
            const docRef = doc(db, "purchaseOrders", id);
            const docSnap = await getDoc(docRef);
            if(docSnap.exists()){
                resolve(fromFirestore<PurchaseOrder>(docSnap));
            } else {
                resolve(undefined);
            }
        } catch(e) { reject(e); }
    }));
  }

  addPurchaseOrder(po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>): Observable<PurchaseOrder> {
    return from(new Promise<PurchaseOrder>(async (resolve, reject) => {
      try {
        const docRef = await addDoc(collection(db, "purchaseOrders"), {
          ...po,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        const newPO = { ...po, id: docRef.id, createdAt: { toDate: () => new Date() }, updatedAt: { toDate: () => new Date() } } as PurchaseOrder;
        this.purchaseOrders.update(pos => [...pos, newPO]);
        resolve(newPO);
      } catch (e) { reject(e); }
    }));
  }

  updatePurchaseOrder(updatedPO: Partial<PurchaseOrder> & {id: string}): Observable<PurchaseOrder> {
    return from(new Promise<PurchaseOrder>(async (resolve, reject) => {
      try {
        const docRef = doc(db, "purchaseOrders", updatedPO.id);
        const { id, ...dataToUpdate } = updatedPO;
        await updateDoc(docRef, { ...dataToUpdate, updatedAt: serverTimestamp() });
        this.purchaseOrders.update(pos => pos.map(p => p.id === updatedPO.id ? {...p, ...updatedPO} as PurchaseOrder : p));
        resolve(this.purchaseOrders().find(p => p.id === updatedPO.id)!);
      } catch (e) { reject(e); }
    }));
  }
}