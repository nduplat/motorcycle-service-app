import { Injectable, signal, inject } from '@angular/core';
import { User, Role } from '../models';
import { Timestamp } from 'firebase/firestore';
import { db } from '../firebase.config';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp, DocumentData, DocumentSnapshot, query, where, deleteDoc, orderBy, limit, startAfter } from 'firebase/firestore';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { UserValidationService } from './user-validation.service';
import { AuthService } from './auth.service';
import { CostMonitoringService } from './cost-monitoring.service';

// Cache interface for user data
interface UserCache {
  data: User[];
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

// Debounce utility for search operations
function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
    const data = snapshot.data() as any;
    return { ...data, id: snapshot.id } as T;
};

// Utility function to remove undefined values from objects recursively
function removeUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(removeUndefined) as T;
  }

  const cleaned = {} as Record<string, unknown>;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = (obj as Record<string, unknown>)[key];
      if (value !== undefined) {
        cleaned[key] = removeUndefined(value);
      }
    }
  }
  return cleaned as T;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private users = signal<User[]>([]);
  private cache: UserCache | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly PAGE_SIZE = 50;
  private lastDoc: DocumentSnapshot | null = null;
  private hasMore = signal(true);
  private isLoadingMore = signal(false);
  private validationService = inject(UserValidationService);
  private authService = inject(AuthService);
  private costMonitoringService = inject(CostMonitoringService);

  constructor() {
    // Subscribe to authentication state changes
    this.authService.getAuthState().subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.loadUsers();
      } else {
        this.users.set([]);
      }
    });
  }

  async loadUsers(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh && this.cache && (Date.now() - this.cache.timestamp) < this.cache.ttl) {
      this.users.set(this.cache.data);
      return;
    }

    const currentUser = this.authService.currentUser();

    console.log("🔍 UserService: Loading users - Auth check:", {
      isAuthenticated: !!currentUser,
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      userRole: currentUser?.role
    });

    if (!currentUser) {
      console.log("🔍 UserService: No authenticated user - cannot load users");
      return;
    }

    const isAdmin = currentUser.role === 'admin';
    const staffRoles = ['admin', 'manager', 'technician', 'front_desk', 'employee'];
    const isStaff = staffRoles.includes(currentUser.role);

    console.log("🔍 UserService: Permission check:", {
      userRole: currentUser.role,
      isAdmin,
      isStaff,
      staffRoles
    });

    let usersData: User[] = [];

    if (!isAdmin && !forceRefresh && this.cache && (Date.now() - this.cache.timestamp) < this.cache.ttl) {
      this.users.set(this.cache.data);
      this.hasMore.set(false);
      return;
    }

    try {
      if (isAdmin) {
        // Admins load users with pagination
        console.log("🔍 UserService: Loading users for admin with pagination");
        const baseQuery = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(this.PAGE_SIZE));
        const querySnapshot = await getDocs(baseQuery);
        this.costMonitoringService.trackFirestoreRead(querySnapshot.docs.length);
        usersData = querySnapshot.docs.map(doc => fromFirestore<User>(doc));
        this.lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        this.hasMore.set(usersData.length === this.PAGE_SIZE);
      } else if (isStaff) {
        // For staff (non-admin), load their own profile, technicians, and customers (for queue management)
        console.log("🔍 UserService: Loading limited user data for staff (non-admin)");
        const currentUserDoc = await getDoc(doc(db, "users", currentUser.id));
        if (currentUserDoc.exists()) {
          usersData.push(fromFirestore<User>(currentUserDoc));
        }

        // Load technicians for assignment purposes
        console.log("🔍 UserService: Loading technicians for staff");
        const techniciansQuery = query(collection(db, "users"), where("role", "==", "technician"));
        const techniciansSnapshot = await getDocs(techniciansQuery);
        this.costMonitoringService.trackFirestoreRead(techniciansSnapshot.docs.length);
        const techniciansData = techniciansSnapshot.docs.map(doc => fromFirestore<User>(doc));
        usersData.push(...techniciansData);

        // Load customers for queue management
        console.log("🔍 UserService: Loading customers for staff");
        const customersQuery = query(collection(db, "users"), where("role", "==", "customer"));
        const customersSnapshot = await getDocs(customersQuery);
        this.costMonitoringService.trackFirestoreRead(customersSnapshot.docs.length);
        const customersData = customersSnapshot.docs.map(doc => fromFirestore<User>(doc));
        usersData.push(...customersData);

        console.log(`Successfully loaded ${usersData.length} users for staff (self + technicians + customers)`);
        this.hasMore.set(false);
      } else {
        // For customers, only load their own profile
        console.log("🔍 UserService: Loading only own profile for non-staff user");
        const currentUserDoc = await getDoc(doc(db, "users", currentUser.id));
        this.costMonitoringService.trackFirestoreRead();
        if (currentUserDoc.exists()) {
          usersData.push(fromFirestore<User>(currentUserDoc));
        }
        console.log(`Successfully loaded ${usersData.length} users for non-staff (own profile only)`);
        this.hasMore.set(false);
      }

      if (!isAdmin) {
        // Update cache only for non-admin
        this.cache = {
          data: usersData,
          timestamp: Date.now(),
          ttl: this.CACHE_TTL
        };
      }

      this.users.set(usersData);
    } catch (error: any) {
      console.error("Error fetching users:", error);

      // If cache exists and fetch fails, use cached data
      if (this.cache) {
        this.users.set(this.cache.data);
      } else {
        this.users.set([]);
      }
    }
  }

  // Method to refresh cache manually
  async refreshUsers(): Promise<void> {
    await this.loadUsers(true);
  }

  async loadMoreUsers(): Promise<void> {
    if (!this.hasMore() || this.isLoadingMore()) {
      return;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser || !this.lastDoc) {
      return;
    }

    const isAdmin = currentUser.role === 'admin';
    if (!isAdmin) {
      return; // only admin has pagination
    }

    this.isLoadingMore.set(true);

    try {
      const baseQuery = query(
        collection(db, "users"),
        orderBy("createdAt", "desc"),
        startAfter(this.lastDoc),
        limit(this.PAGE_SIZE)
      );
      const querySnapshot = await getDocs(baseQuery);
      const newUsers = querySnapshot.docs.map(doc => fromFirestore<User>(doc));
      console.log(`🔍 UserService: Loaded ${newUsers.length} more users`);

      if (newUsers.length > 0) {
        this.users.update(current => [...current, ...newUsers]);
        this.lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      }

      this.hasMore.set(newUsers.length === this.PAGE_SIZE);
    } catch (error: any) {
      console.error("🔍 UserService: Error loading more users:", error);
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  // Invalidate cache when data changes
  private invalidateCache(): void {
    this.cache = null;
  }

  getUsers() {
    return this.users.asReadonly();
  }

  getUsersAsMap() {
    const map = new Map<string, User>();
    this.users().forEach(user => map.set(user.id, user));
    return map;
  }

  getPaginationState() {
    return {
      hasMore: this.hasMore.asReadonly(),
      isLoadingMore: this.isLoadingMore.asReadonly()
    };
  }

  getTechnicians(): User[] {
    return this.users().filter(u => u.role === 'technician');
  }

  // Search and filter methods
  private searchCache: { term: string; filters: { role?: Role; active?: boolean; createdAfter?: Date; createdBefore?: Date; } | undefined; result: User[]; timestamp: number } | null = null;
  private readonly SEARCH_CACHE_TTL = 30 * 1000; // 30 seconds for search results

  searchUsers(searchTerm: string, filters?: {
    role?: Role;
    active?: boolean;
    createdAfter?: Date;
    createdBefore?: Date;
  }): User[] {
    // Check search cache
    const cacheKey = JSON.stringify({ term: searchTerm, filters });
    if (this.searchCache &&
        this.searchCache.term + JSON.stringify(this.searchCache.filters) === cacheKey &&
        (Date.now() - this.searchCache.timestamp) < this.SEARCH_CACHE_TTL) {
      return this.searchCache.result;
    }

    let filteredUsers = this.users();

    // Text search
    if (searchTerm?.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filteredUsers = filteredUsers.filter(user =>
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.phone?.toLowerCase().includes(term)
      );
    }

    // Apply filters
    if (filters) {
      if (filters.role) {
        filteredUsers = filteredUsers.filter(user => user.role === filters.role);
      }

      if (filters.active !== undefined) {
        filteredUsers = filteredUsers.filter(user => user.active === filters.active);
      }

      if (filters.createdAfter) {
        filteredUsers = filteredUsers.filter(user =>
          user.createdAt.toDate() >= filters.createdAfter!
        );
      }

      if (filters.createdBefore) {
        filteredUsers = filteredUsers.filter(user =>
          user.createdAt.toDate() <= filters.createdBefore!
        );
      }
    }

    // Cache the result
    this.searchCache = {
      term: searchTerm,
      filters,
      result: filteredUsers,
      timestamp: Date.now()
    };

    return filteredUsers;
  }

  // Debounced search method for external use
  private debouncedSearchCallback?: (results: User[]) => void;
  private debouncedSearch = debounce((searchTerm: string, filters: { role?: Role; active?: boolean; createdAfter?: Date; createdBefore?: Date; } | undefined, callback: (results: User[]) => void) => {
    const results = this.searchUsers(searchTerm, filters);
    callback(results);
  }, 300);

  searchUsersDebounced(searchTerm: string, filters: { role?: Role; active?: boolean; createdAfter?: Date; createdBefore?: Date; } | undefined, callback: (results: User[]) => void): void {
    this.debouncedSearch(searchTerm, filters, callback);
  }

  getUsersByRole(role: Role): User[] {
    return this.users().filter(u => u.role === role);
  }

  getActiveUsers(): User[] {
    return this.users().filter(u => u.active !== false);
  }

  getInactiveUsers(): User[] {
    return this.users().filter(u => u.active === false);
  }

  getUsersCreatedInDateRange(startDate: Date, endDate: Date): User[] {
    return this.users().filter(user => {
      const createdDate = user.createdAt.toDate();
      return createdDate >= startDate && createdDate <= endDate;
    });
  }

  getUserById(id: string): User | undefined {
    return this.users().find(u => u.id === id);
  }

  // Deactivate user (soft delete)
  deactivateUser(userId: string): Observable<User> {
    return from(new Promise<User>(async (resolve, reject) => {
      try {
        const currentUser = this.authService.currentUser();
        const targetUser = this.getUserById(userId);

        if (!targetUser) {
          reject(new Error('User not found'));
          return;
        }

        // Cannot deactivate admin unless you're an admin
        if (targetUser.role === 'admin' && currentUser?.role !== 'admin') {
          reject(new Error('Cannot deactivate admin accounts'));
          return;
        }

        // Cannot deactivate yourself
        if (currentUser?.id === userId) {
          reject(new Error('Cannot deactivate your own account'));
          return;
        }

        const docRef = doc(db, "users", userId);
        await updateDoc(docRef, {
          active: false,
          updatedAt: serverTimestamp()
        });

        const updatedUser = { ...targetUser, active: false };
        this.users.update(users =>
          users.map(u => u.id === userId ? updatedUser : u)
        );

        // Invalidate cache
        this.invalidateCache();

        console.log(`User deactivated: ${updatedUser.email} by ${currentUser?.email || 'system'}`);
        resolve(updatedUser);
      } catch (e: any) {
        console.error('Error deactivating user:', e);
        reject(new Error(e.message || 'Failed to deactivate user'));
      }
    })).pipe(
      catchError(error => throwError(() => error))
    );
  }

  // Reactivate user
  reactivateUser(userId: string): Observable<User> {
    return from(new Promise<User>(async (resolve, reject) => {
      try {
        const currentUser = this.authService.currentUser();
        const targetUser = this.getUserById(userId);

        if (!targetUser) {
          reject(new Error('User not found'));
          return;
        }

        const docRef = doc(db, "users", userId);
        await updateDoc(docRef, {
          active: true,
          updatedAt: serverTimestamp()
        });

        const updatedUser = { ...targetUser, active: true };
        this.users.update(users =>
          users.map(u => u.id === userId ? updatedUser : u)
        );

        // Invalidate cache
        this.invalidateCache();

        console.log(`User reactivated: ${updatedUser.email} by ${currentUser?.email || 'system'}`);
        resolve(updatedUser);
      } catch (e: any) {
        console.error('Error reactivating user:', e);
        reject(new Error(e.message || 'Failed to reactivate user'));
      }
    })).pipe(
      catchError(error => throwError(() => error))
    );
  }

  // Delete user permanently (only for super admins)
  deleteUser(userId: string): Observable<void> {
    return from(new Promise<void>(async (resolve, reject) => {
      try {
        const currentUser = this.authService.currentUser();

        if (currentUser?.role !== 'admin') {
          reject(new Error('Only admins can permanently delete users'));
          return;
        }

        const targetUser = this.getUserById(userId);
        if (!targetUser) {
          reject(new Error('User not found'));
          return;
        }

        // Cannot delete admin accounts
        if (targetUser.role === 'admin') {
          reject(new Error('Cannot delete admin accounts'));
          return;
        }

        // Cannot delete yourself
        if (currentUser.id === userId) {
          reject(new Error('Cannot delete your own account'));
          return;
        }

        await deleteDoc(doc(db, "users", userId));
        this.users.update(users => users.filter(u => u.id !== userId));

        // Invalidate cache
        this.invalidateCache();

        console.log(`User permanently deleted: ${targetUser.email} by ${currentUser.email}`);
        resolve();
      } catch (e: any) {
        console.error('Error deleting user:', e);
        reject(new Error(e.message || 'Failed to delete user'));
      }
    })).pipe(
      catchError(error => throwError(() => error))
    );
  }

  addUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Observable<User> {
    return from(new Promise<User>(async (resolve, reject) => {
      try {
        // Check authentication
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        // Validate user data
        const validation = this.validationService.validateUserCreation(user, currentUser.role);

        if (!validation.isValid) {
          reject(new Error(`Validation failed: ${validation.errors.join(', ')}`));
          return;
        }

        // Check for duplicate email
        const existingUserQuery = query(collection(db, "users"), where("email", "==", user.email));
        const existingUsers = await getDocs(existingUserQuery);

        if (!existingUsers.empty) {
          reject(new Error('A user with this email already exists'));
          return;
        }

        const docRef = await addDoc(collection(db, "users"), {
          ...user,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        const newUser: User = {
          ...user,
          id: docRef.id,
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        };

        this.users.update(users => [...users, newUser]);

        // Invalidate cache
        this.invalidateCache();

        // Log audit event (we'll implement this later)
        console.log(`User created: ${newUser.email} by ${currentUser.email || 'system'}`);

        resolve(newUser);
      } catch (e: any) {
        console.error('Error creating user:', e);
        reject(new Error(e.message || 'Failed to create user'));
      }
    })).pipe(
      catchError(error => {
        console.error('User creation failed:', error);
        return throwError(() => error);
      })
    );
  }

  updateUser(updatedUser: Partial<User> & { id: string }): Observable<User> {
    return from(new Promise<User>(async (resolve, reject) => {
      try {
        // Check authentication
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          reject(new Error('User not authenticated'));
          return;
        }

        const targetUser = this.getUserById(updatedUser.id);

        if (!targetUser) {
          reject(new Error('User not found'));
          return;
        }

        // Validate user data
        const validation = this.validationService.validateUserUpdate(updatedUser, currentUser.role, targetUser.role);

        if (!validation.isValid) {
          reject(new Error(`Validation failed: ${validation.errors.join(', ')}`));
          return;
        }

        // Check for duplicate email if email is being changed
        if (updatedUser.email && updatedUser.email !== targetUser.email) {
          const existingUserQuery = query(collection(db, "users"), where("email", "==", updatedUser.email));
          const existingUsers = await getDocs(existingUserQuery);

          if (!existingUsers.empty) {
            reject(new Error('A user with this email already exists'));
            return;
          }
        }

        const docRef = doc(db, "users", updatedUser.id);
        const { id, ...dataToUpdate } = updatedUser;
        const updateData = removeUndefined({ ...dataToUpdate, updatedAt: serverTimestamp() });

        try {
          await updateDoc(docRef, updateData);
        } catch (firestoreError: any) {
          console.error('Firestore update failed:', {
            code: firestoreError.code,
            message: firestoreError.message,
            userId: updatedUser.id,
            fields: Object.keys(dataToUpdate)
          });
          throw firestoreError;
        }

        let fullyUpdatedUser: User | undefined;
        this.users.update(users =>
          users.map(u => {
            if (u.id === updatedUser.id) {
              fullyUpdatedUser = { ...u, ...updatedUser };
              return fullyUpdatedUser;
            }
            return u;
          })
        );

        // Invalidate cache
        this.invalidateCache();

        // Log audit event
        console.log(`User updated: ${fullyUpdatedUser!.email} by ${currentUser.email || 'system'}`);

        resolve(fullyUpdatedUser!);
      } catch (e: any) {
        console.error('Error updating user:', e);
        reject(new Error(e.message || 'Failed to update user'));
      }
    })).pipe(
      catchError(error => {
        console.error('User update failed:', error);
        return throwError(() => error);
      })
    );
  }

  updateUserRole(userId: string, newRole: Role): Observable<User> {
    return from(new Promise<User>(async (resolve, reject) => {
      try {
        const currentUser = this.authService.currentUser();
        if (currentUser?.role !== 'admin') {
          return reject(new Error('Only admins can change user roles.'));
        }

        if (currentUser.id === userId) {
          return reject(new Error('Cannot change your own role.'));
        }

        const targetUser = this.getUserById(userId);
        if (!targetUser) {
          return reject(new Error('User not found.'));
        }

        if (targetUser.role === 'admin') {
          return reject(new Error('Cannot change the role of another admin.'));
        }

        const docRef = doc(db, "users", userId);
        await updateDoc(docRef, { 
          role: newRole,
          updatedAt: serverTimestamp()
        });

        const updatedUser = { ...targetUser, role: newRole };
        this.users.update(users =>
          users.map(u => (u.id === userId ? updatedUser : u))
        );

        this.invalidateCache();
        console.log(`User role updated: ${updatedUser.email} to ${newRole} by ${currentUser.email}`);
        resolve(updatedUser);
      } catch (e: any) {
        console.error('Error updating user role:', e);
        reject(new Error(e.message || 'Failed to update user role'));
      }
    })).pipe(
      catchError(error => throwError(() => error))
    );
  }

  updateMyAvailability(isAvailable: boolean, reason?: string): Observable<void> {
    return from(new Promise<void>(async (resolve, reject) => {
      try {
        const currentUser = this.authService.currentUser();
        if (!currentUser) {
          return reject(new Error('User not authenticated.'));
        }

        const assignableRoles: Role[] = ['technician', 'employee', 'front_desk'];
        if (!assignableRoles.includes(currentUser.role)) {
          return reject(new Error('User role cannot have availability status.'));
        }

        const docRef = doc(db, "users", currentUser.id);
        const availabilityData = {
          isAvailable,
          reason: reason || (isAvailable ? '' : 'No disponible'),
          lastUpdated: serverTimestamp()
        };

        await updateDoc(docRef, { availability: availabilityData });

        // Update local state
        this.users.update(users =>
          users.map(u => 
            u.id === currentUser.id 
              ? { ...u, availability: { ...availabilityData, lastUpdated: Timestamp.now() } } 
              : u
          )
        );
        this.authService.currentUser.update(u => u ? ({...u, availability: {...availabilityData, lastUpdated: Timestamp.now()}}) : null);

        this.invalidateCache();
        console.log(`User ${currentUser.email} availability updated to ${isAvailable}`);
        resolve();
      } catch (e: any) {
        console.error('Error updating availability:', e);
        reject(new Error(e.message || 'Failed to update availability'));
      }
    })).pipe(
      catchError(error => throwError(() => error))
    );
  }
}