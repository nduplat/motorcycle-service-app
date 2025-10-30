import { Injectable, inject } from '@angular/core';
import { collection, addDoc, serverTimestamp, query, where, getDocs, setDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.config';
import { AuthService } from './auth.service';
import { MotorcycleAssignment } from '../models'; // Import the full interface

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

    const assignmentData: MotorcycleAssignment = {
      ...assignment,
      id: assignment.plate, // Set ID to plate
      assignedBy: user.id,
      assignedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: assignment.status || 'active', // Ensure status is set
      mileageKm: assignment.mileageKm || 0, // Ensure mileageKm is set
      cylinderCapacity: assignment.cylinderCapacity || 0, // Ensure cylinderCapacity is set
      brand: assignment.brand || 'Unknown',
      model: assignment.model || 'Unknown',
      year: assignment.year || new Date().getFullYear(),
      displacementCc: assignment.displacementCc || 0,
      category: assignment.category || 'Unknown',
      type: assignment.type || 'Unknown',
      isActive: assignment.isActive !== undefined ? assignment.isActive : true,
    } as MotorcycleAssignment;

    await setDoc(doc(db, 'motorcycleAssignments', assignment.plate), assignmentData);
    return assignment.plate;
  }

  async updateAssignment(plate: string, data: Partial<MotorcycleAssignment>): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    const docRef = doc(db, 'motorcycleAssignments', plate);
    await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
  }

  async getAssignmentByPlate(plate: string): Promise<MotorcycleAssignment | null> {
    const docRef = doc(db, 'motorcycleAssignments', plate);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as MotorcycleAssignment;
    }
    return null;
  }

  async checkPlateUniqueness(plate: string): Promise<boolean> {
    const q = query(collection(db, 'motorcycleAssignments'), where('plate', '==', plate));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  }

  async getUserAssignments(userId: string): Promise<MotorcycleAssignment[]> {
    const q = query(
      collection(db, 'motorcycleAssignments'),
      where('userId', '==', userId),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MotorcycleAssignment));
  }

  async createQuickAssignment(data: {
    userId: string;
    motorcycleId: string | null;
    plate: string;
    mileageKm: number;
    cylinderCapacity: number;
    brand?: string;
    model?: string;
    year?: number;
    displacementCc?: number;
    category?: string;
    type?: string;
    isActive?: boolean;
  }): Promise<string> {
    // Verificar placa única
    const isUnique = await this.checkPlateUniqueness(data.plate);
    if (!isUnique) {
      throw new Error('Placa ya registrada');
    }

    // Crear asignación
    return await this.createAssignment({
      ...data,
      status: 'active',
      notes: 'Asignación rápida desde flujo QR',
      quickAssigned: true // ← AGREGAR flag
    } as MotorcycleAssignment);
  }
}
