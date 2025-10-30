import { Injectable } from '@angular/core';
import { db } from '../firebase.config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { AuditLog } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AuditService {

  async logChange(entity: string, entityId: string, action: string, changes?: Record<string, any>, performedBy?: string): Promise<void> {
    try {
      const auditLog: any = {
        entity,
        entityId,
        action,
        performedAt: serverTimestamp()
      };

      // Only add optional fields if they have values
      if (changes !== undefined) {
        auditLog.changes = changes;
      }
      if (performedBy !== undefined) {
        auditLog.performedBy = performedBy;
      }

      await addDoc(collection(db, 'auditLog'), auditLog);
    } catch (error) {
      console.error('Error logging audit:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  async logProductChange(productId: string, action: string, changes?: Record<string, any>, performedBy?: string): Promise<void> {
    await this.logChange('products', productId, action, changes, performedBy);
  }

  async logStockMovement(productId: string, action: string, quantity: number, performedBy?: string): Promise<void> {
    await this.logChange('stockMovements', productId, action, { quantity }, performedBy);
  }

  async logMotorcycleAssignmentChange(assignmentId: string, action: string, changes?: Record<string, any>, performedBy?: string): Promise<void> {
    await this.logChange('motorcycleAssignments', assignmentId, action, changes, performedBy);
  }
}