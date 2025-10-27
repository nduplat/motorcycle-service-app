
import { Injectable, signal } from '@angular/core';
import { StockMovement, WorkOrder } from '../models';
import { Observable, from } from 'rxjs';
import { db } from '../firebase.config';
import { collection, getDocs, doc, serverTimestamp, writeBatch, addDoc, updateDoc, getDoc, DocumentData, DocumentSnapshot } from 'firebase/firestore';
import { PurchaseOrder } from '../models';

const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
    const data = snapshot.data() as any;
    return { ...data, id: snapshot.id } as T;
};

@Injectable({
  providedIn: 'root'
})
export class StockMovementService {
  private stockMovements = signal<StockMovement[]>([]);

  constructor() {
    // Only load movements when needed to prevent excessive reads
    // this.loadStockMovements();
  }

  public async loadStockMovements() {
    try {
      const querySnapshot = await getDocs(collection(db, "stockMovements"));
      this.stockMovements.set(querySnapshot.docs.map(d => fromFirestore<StockMovement>(d)).sort((a,b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()));
    } catch (error) {
      console.error("Error fetching stock movements:", error);
    }
  }

  getStockMovements() {
    return this.stockMovements.asReadonly();
  }

  async getMovementsByProduct(productId: string): Promise<StockMovement[]> {
    // Load movements if not already loaded
    if (this.stockMovements().length === 0) {
      await this.loadStockMovements();
    }
    return this.stockMovements().filter(movement => movement.productId === productId);
  }

  async recalculateStock(productId: string): Promise<number> {
    try {
      // Get all movements for this product
      const movements = await this.getMovementsByProduct(productId);

      // Calculate total stock from movements
      const totalStock = movements.reduce((sum, movement) => sum + movement.quantity, 0);

      // Update the product stock in Firestore
      const productRef = doc(db, "products", productId);
      await updateDoc(productRef, {
        stock: totalStock,
        updatedAt: serverTimestamp()
      });

      return totalStock;
    } catch (error) {
      console.error('Error recalculating stock:', error);
      throw error;
    }
  }

  receivePurchaseOrder(po: PurchaseOrder, userId: string): Observable<void> {
    return from(new Promise<void>(async (resolve, reject) => {
      try {
        const batch = writeBatch(db);

        for (const item of po.items) {
          // Get current product stock
          const productRef = doc(db, "products", item.productId);
          const productSnap = await getDoc(productRef);
          if (!productSnap.exists()) {
            throw new Error(`Product with id ${item.productId} not found.`);
          }
          const currentStock = productSnap.data()?.stock || 0;
          const newStock = currentStock + item.qty;

          // 1. Create Stock Movement record
          const movementRef = doc(collection(db, "stockMovements"));
          batch.set(movementRef, {
            productId: item.productId,
            quantity: item.qty,
            type: "purchase",
            referenceId: po.id,
            createdBy: userId,
            createdAt: serverTimestamp(),
          });

          // 2. Update Product stock
          batch.update(productRef, {
            stock: newStock,
            updatedAt: serverTimestamp()
          });
        }

        // 3. Update PO status
        const poRef = doc(db, "purchaseOrders", po.id);
        batch.update(poRef, { status: "received", updatedAt: serverTimestamp() });

        await batch.commit();
        // Reload movements to reflect changes
        this.loadStockMovements();
        resolve();

      } catch (e) { 
          console.error("Transaction to receive PO failed:", e);
          reject(e); 
      }
    }));
  }

  createMovement(movement: Omit<StockMovement, 'id'>): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const movementRef = doc(collection(db, "stockMovements"));
        await addDoc(collection(db, "stockMovements"), {
          ...movement,
          createdAt: serverTimestamp(),
        });

        // Reload movements to update local state
        this.loadStockMovements();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  createMovementsForInvoice(invoice: any, userId: string): Observable<void> {
    return from(new Promise<void>(async (resolve, reject) => {
      try {
        const batch = writeBatch(db);

        // Process each invoice item that has a product
        for (const item of (invoice.items || [])) {
          if (item.productId && item.qty > 0) {
            // Get current product stock
            const productRef = doc(db, "products", item.productId);
            const productSnap = await getDoc(productRef);
            if (!productSnap.exists()) {
              throw new Error(`Product with id ${item.productId} not found.`);
            }
            const currentStock = productSnap.data()?.stock || 0;
            const newStock = currentStock - item.qty;

            // Create stock movement for sale
            const movementRef = doc(collection(db, "stockMovements"));
            batch.set(movementRef, {
              productId: item.productId,
              quantity: -item.qty, // Negative for sale
              type: "sale",
              referenceId: invoice.id,
              reason: `Sale via invoice ${invoice.number || invoice.id}`,
              createdBy: userId,
              createdAt: serverTimestamp(),
            });

            // Update product stock
            batch.update(productRef, {
              stock: newStock,
              updatedAt: serverTimestamp()
            });
          }
        }

        await batch.commit();
        // Reload movements
        this.loadStockMovements();
        resolve();

      } catch (e) {
        console.error("Transaction for invoice stock movement failed:", e);
        reject(e);
      }
    }));
  }

  createMovementsForReturn(returnOrder: any, userId: string): Observable<void> {
    return from(new Promise<void>(async (resolve, reject) => {
      try {
        const batch = writeBatch(db);

        // Process each return item
        for (const item of (returnOrder.items || [])) {
          if (item.productId && item.qty > 0) {
            // Get current product stock
            const productRef = doc(db, "products", item.productId);
            const productSnap = await getDoc(productRef);
            if (!productSnap.exists()) {
              throw new Error(`Product with id ${item.productId} not found.`);
            }
            const currentStock = productSnap.data()?.stock || 0;
            const newStock = currentStock + item.qty;

            // Create stock movement for return
            const movementRef = doc(collection(db, "stockMovements"));
            batch.set(movementRef, {
              productId: item.productId,
              quantity: item.qty, // Positive for return
              type: "return",
              referenceId: returnOrder.id,
              reason: `Return ${item.reason || ''}`,
              createdBy: userId,
              createdAt: serverTimestamp(),
            });

            // Update product stock
            batch.update(productRef, {
              stock: newStock,
              updatedAt: serverTimestamp()
            });
          }
        }

        await batch.commit();
        // Reload movements
        this.loadStockMovements();
        resolve();

      } catch (e) {
        console.error("Transaction for return stock movement failed:", e);
        reject(e);
      }
    }));
  }

  createMovementsForWorkOrder(wo: WorkOrder, userId: string): Observable<void> {
    return from(new Promise<void>(async (resolve, reject) => {
      if (!wo.parts || wo.parts.length === 0) {
        resolve();
        return;
      }
      try {
        const batch = writeBatch(db);

        for (const item of wo.parts) {
          // Get current product stock
          const productRef = doc(db, "products", item.productId);
          const productSnap = await getDoc(productRef);
          if (!productSnap.exists()) {
            throw new Error(`Product with id ${item.productId} not found.`);
          }
          const currentStock = productSnap.data()?.stock || 0;
          const newStock = currentStock - item.qty;

          // 1. Create Stock Movement record
          const movementRef = doc(collection(db, "stockMovements"));
          batch.set(movementRef, {
            productId: item.productId,
            quantity: -item.qty, // Negative quantity for sale
            type: "sale",
            referenceId: wo.id,
            createdBy: userId,
            createdAt: serverTimestamp(),
          });

          // 2. Update Product stock
          batch.update(productRef, {
            stock: newStock,
            updatedAt: serverTimestamp()
          });
        }

        await batch.commit();
        // Reload movements
        this.loadStockMovements();
        resolve();

      } catch (e) {
        console.error("Transaction for WO stock movement failed:", e);
        reject(e);
      }
    }));
  }
}