import { Injectable, inject } from '@angular/core';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase.config';
import { AuthService } from './auth.service';

export interface MotorcycleAssignment {
  id?: string;
  userId: string;
  motorcycleId: string | null;
  assignedBy: string;
  status: string;
  plate: string;
  mileageKm: number;
  cylinderCapacity: number;
  notes: string | null;
  assignedAt: any;
  createdAt: any;
  updatedAt: any;
}

@Injectable({
  providedIn: 'root'
})
export class MotorcycleAssignmentService {
  private authService = inject(AuthService);

  async createAssignment(assignment: Omit<MotorcycleAssignment, 'id' | 'assignedAt' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const user = this.authService.currentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const assignmentData = {
      ...assignment,
      assignedBy: user.id,
      assignedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'motorcycleAssignments'), assignmentData);
    return docRef.id;
  }

  async checkPlateUniqueness(plate: string): Promise<boolean> {
    const q = query(collection(db, 'motorcycleAssignments'), where('plate', '==', plate), where('status', '==', 'active'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  }
}
