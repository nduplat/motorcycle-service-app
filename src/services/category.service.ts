import { Injectable, signal, inject, effect } from '@angular/core';
import { Category, Timestamp } from '../models';
import { Observable, from } from 'rxjs';
import { db } from '../firebase.config';
import { collection, getDocs, addDoc, serverTimestamp, DocumentData, DocumentSnapshot } from 'firebase/firestore';
import { AuthService } from './auth.service';

const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
    const data = snapshot.data() as any;
    return { ...data, id: snapshot.id } as T;
};

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private categories = signal<Category[]>([]);
  private authService = inject(AuthService);

  constructor() {
    // Subscribe to auth state changes for reactive loading
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        console.log('CategoryService: User authenticated, loading categories');
        this.loadCategories();
      } else {
        console.log('CategoryService: User not authenticated, clearing categories');
        this.categories.set([]);
      }
    });
  }
  
  private async loadCategories() {
    // Get current user from AuthService
    const currentUser = this.authService.currentUser();

    console.log("CategoryService: Loading categories - Auth check:", {
      isAuthenticated: !!currentUser,
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      userRole: currentUser?.role
    });

    if (!currentUser) {
      console.warn("CategoryService: No authenticated user - cannot load categories");
      return;
    }

    try {
      console.log("CategoryService: Attempting to load categories collection");
      const querySnapshot = await getDocs(collection(db, "categories"));
      const categoriesData = querySnapshot.docs.map(doc => fromFirestore<Category>(doc));
      console.log(`CategoryService: Successfully loaded ${categoriesData.length} categories`);
      this.categories.set(categoriesData);
    } catch(error: any) {
      console.error("CategoryService: Error fetching categories:", {
        message: error.message,
        code: error.code,
        userRole: currentUser?.role,
        isPermissionError: error.code === 'permission-denied'
      });
    }
  }
  
  getCategories() {
    return this.categories.asReadonly();
  }

  addCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Observable<Category> {
    return from(new Promise<Category>(async (resolve, reject) => {
      try {
        // Check authentication
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        const docRef = await addDoc(collection(db, "categories"), {
          ...category,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        const newCategory = { ...category, id: docRef.id, createdAt: { toDate: () => new Date() }, updatedAt: { toDate: () => new Date() } };
        this.categories.update(categories => [...categories, newCategory as Category]);

        resolve(newCategory as Category);
      } catch (e) {
        reject(e);
      }
    }));
  }
}
