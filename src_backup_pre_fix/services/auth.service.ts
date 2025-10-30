

import { Injectable, signal, inject, computed } from '@angular/core';
import { UserProfile, Role } from '../models';
import { Timestamp } from 'firebase/firestore';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { db, auth } from '../firebase.config';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { CostMonitoringService } from './cost-monitoring.service';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
  currentUser = signal<UserProfile | null>(null);
  isCustomer = computed(() => this.currentUser()?.role === 'customer');

  // Authentication state signal
  private authState = signal<boolean>(false);
  private authDetermined = signal<boolean>(false);
  public authState$ = toObservable(this.authState);

  // Debug counters
  private handleFirebaseUserCallCount = 0;
  private hasRoleCallCount = 0;

  // Role mapping for backward compatibility
  private roleMapping: Record<string, Role> = {
    'manager': 'admin',
    'front_desk': 'technician',
    'employee': 'technician'
  };

  // Flag to prevent multiple handleFirebaseUser calls per auth session
  private isHandlingAuth = false;
  private costMonitoringService = inject(CostMonitoringService);

  constructor() {
    console.log('🔐 AuthService: Initializing authentication service');

    // Check for existing localStorage data on init
    const storedUser = localStorage.getItem('currentUser');
    console.log('🔐 AuthService: Checking localStorage on init', { hasStoredUser: !!storedUser });
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log('🔐 AuthService: Parsed user from localStorage', { uid: parsedUser.uid, email: parsedUser.email, role: parsedUser.role });
        // Convert timestamps back to Timestamp-like objects
        const userProfile: UserProfile = {
          ...parsedUser,
          createdAt: { toDate: () => new Date(parsedUser.createdAt) },
          updatedAt: { toDate: () => new Date(parsedUser.updatedAt) },
          technicianProfile: parsedUser.technicianProfile ? {
            ...parsedUser.technicianProfile,
            employmentStartAt: parsedUser.technicianProfile.employmentStartAt
              ? { toDate: () => new Date(parsedUser.technicianProfile.employmentStartAt) }
              : undefined
          } : null
        };
        // Set currentUser immediately from localStorage to prevent brief unavailability
        this.currentUser.set(userProfile);
        this.authState.set(true);
        console.log('🔐 AuthService: User profile restored from localStorage');
      } catch (error) {
        console.error('🔐 AuthService: Error parsing localStorage user data', error);
        localStorage.removeItem('currentUser');
      }
    }

    // Listen to Firebase auth state changes
    onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔐 AuthService: onAuthStateChanged fired', { hasUser: !!firebaseUser, uid: firebaseUser?.uid });
      if (firebaseUser) {
        if (this.isHandlingAuth) {
          console.log('🔐 AuthService: Skipping duplicate handleFirebaseUser call');
          return;
        }
        this.isHandlingAuth = true;
        this.handleFirebaseUserCallCount++;
        console.log(`🔐 AuthService: handleFirebaseUser call #${this.handleFirebaseUserCallCount}`);
        await this.handleFirebaseUser(firebaseUser);
        this.authState.set(true);
      } else {
        console.log('🔐 AuthService: No Firebase user, clearing auth state');
        this.isHandlingAuth = false;
        this.currentUser.set(null);
        console.log('🔐 AuthService: Removing currentUser from localStorage');
        localStorage.removeItem('currentUser');
        this.authState.set(false);
      }
      this.authDetermined.set(true);
    });

  }

  async login(email: string, password: string): Promise<boolean> {
    try {
      console.log('🔐 AuthService: Attempting email/password login for:', email);

      // Validate inputs
      if (!email || !password) {
        console.warn('🔐 AuthService: Email and password are required');
        return false;
      }

      // Basic email validation
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        console.warn('🔐 AuthService: Invalid email format');
        return false;
      }

      // Use Firebase Authentication for secure login
      await signInWithEmailAndPassword(auth, email, password);
      console.log('🔐 AuthService: Email/password login successful for:', email);
      return true;

    } catch (error: any) {
      const errorContext = {
        email: email,
        timestamp: new Date().toISOString(),
        errorCode: error.code,
        errorMessage: error.message,
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      console.error("🔐 AuthService: AUTH_LOGIN_FAILED - Error during email/password login:", errorContext);

      // Handle specific Firebase auth errors with detailed codes and messages
      switch (error.code) {
        case 'auth/user-not-found':
          console.warn('🔐 AuthService: AUTH_USER_NOT_FOUND - User account does not exist', { email, timestamp: errorContext.timestamp });
          break;
        case 'auth/wrong-password':
          console.warn('🔐 AuthService: AUTH_INVALID_PASSWORD - Incorrect password provided', { email, timestamp: errorContext.timestamp });
          break;
        case 'auth/invalid-credential':
          console.warn('🔐 AuthService: AUTH_INVALID_CREDENTIALS - Invalid login credentials', { email, timestamp: errorContext.timestamp });
          break;
        case 'auth/too-many-requests':
          console.warn('🔐 AuthService: AUTH_TOO_MANY_REQUESTS - Account temporarily disabled due to many failed login attempts', { email, timestamp: errorContext.timestamp });
          break;
        case 'auth/user-disabled':
          console.warn('🔐 AuthService: AUTH_USER_DISABLED - User account has been disabled', { email, timestamp: errorContext.timestamp });
          break;
        case 'auth/invalid-email':
          console.warn('🔐 AuthService: AUTH_INVALID_EMAIL - Invalid email format', { email, timestamp: errorContext.timestamp });
          break;
        default:
          console.warn('🔐 AuthService: AUTH_LOGIN_UNKNOWN_ERROR - Login failed with unknown error', errorContext);
      }
      return false;
    }
  }

  async logout() {
    try {
      console.log('🔐 AuthService: Signing out user');
      await signOut(auth);
      console.log('🔐 AuthService: Firebase sign out successful');
    } catch (error) {
      console.error('🔐 AuthService: Error signing out:', error);
    }
    this.currentUser.set(null);
    console.log('🔐 AuthService: User logged out');
    this.router.navigate(['/']);
  }

  async signInWithGoogle(): Promise<boolean> {
    try {
      console.log('🔐 AuthService: Starting Google sign-in process');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log('🔐 AuthService: Google sign-in successful:', {
        email: result.user.email,
        displayName: result.user.displayName,
        uid: result.user.uid
      });
      // The auth state change will handle setting the user
      return true;
    } catch (error: any) {
      const errorContext = {
        timestamp: new Date().toISOString(),
        errorCode: error.code,
        errorMessage: error.message,
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      console.error('🔐 AuthService: AUTH_GOOGLE_SIGNIN_FAILED - Error signing in with Google:', errorContext);

      // Handle specific Google sign-in errors
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          console.warn('🔐 AuthService: AUTH_POPUP_CLOSED - User closed the Google sign-in popup', { timestamp: errorContext.timestamp });
          break;
        case 'auth/popup-blocked':
          console.warn('🔐 AuthService: AUTH_POPUP_BLOCKED - Google sign-in popup was blocked by browser', { timestamp: errorContext.timestamp });
          break;
        case 'auth/cancelled-popup-request':
          console.warn('🔐 AuthService: AUTH_POPUP_CANCELLED - Google sign-in popup request was cancelled', { timestamp: errorContext.timestamp });
          break;
        case 'auth/account-exists-with-different-credential':
          console.warn('🔐 AuthService: AUTH_ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL - Account exists with different credential', { timestamp: errorContext.timestamp });
          break;
        default:
          console.warn('🔐 AuthService: AUTH_GOOGLE_UNKNOWN_ERROR - Google sign-in failed with unknown error', errorContext);
      }
      return false;
    }
  }

  async signInWithApple(): Promise<boolean> {
    try {
      console.log('🔐 AuthService: Starting Apple sign-in process');
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      const result = await signInWithPopup(auth, provider);
      console.log('🔐 AuthService: Apple sign-in successful:', {
        email: result.user.email,
        displayName: result.user.displayName,
        uid: result.user.uid
      });
      // The auth state change will handle setting the user
      return true;
    } catch (error: any) {
      const errorContext = {
        timestamp: new Date().toISOString(),
        errorCode: error.code,
        errorMessage: error.message,
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      console.error('🔐 AuthService: AUTH_APPLE_SIGNIN_FAILED - Error signing in with Apple:', errorContext);

      // Handle specific Apple sign-in errors
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          console.warn('🔐 AuthService: AUTH_POPUP_CLOSED - User closed the Apple sign-in popup', { timestamp: errorContext.timestamp });
          break;
        case 'auth/popup-blocked':
          console.warn('🔐 AuthService: AUTH_POPUP_BLOCKED - Apple sign-in popup was blocked by browser', { timestamp: errorContext.timestamp });
          break;
        case 'auth/cancelled-popup-request':
          console.warn('🔐 AuthService: AUTH_POPUP_CANCELLED - Apple sign-in popup request was cancelled', { timestamp: errorContext.timestamp });
          break;
        case 'auth/account-exists-with-different-credential':
          console.warn('🔐 AuthService: AUTH_ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL - Account exists with different credential', { timestamp: errorContext.timestamp });
          break;
        default:
          console.warn('🔐 AuthService: AUTH_APPLE_UNKNOWN_ERROR - Apple sign-in failed with unknown error', errorContext);
      }
      return false;
    }
  }

  private async handleFirebaseUser(firebaseUser: FirebaseUser): Promise<void> {
    try {
      // Check if user exists in Firestore by trying to read their document directly
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      console.log('🔐 AuthService: Attempting to fetch user document from Firestore for UID:', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      this.costMonitoringService.trackFirestoreRead();
      console.log('🔐 AuthService: Firestore document exists?', userDocSnap.exists());

      let userProfile: UserProfile;

      if (!userDocSnap.exists()) {
        console.log('🔐 AuthService: Creating new user profile for:', firebaseUser.email);

        // Create new user profile with default role
        const defaultRole: Role = 'customer';
        const assignableRoles: Role[] = ['technician'];

        const newUser: any = {
          name: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
          email: firebaseUser.email!,
          phone: '',
          role: defaultRole,
          avatarUrl: firebaseUser.photoURL || '',
          active: true,
          technicianProfile: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (assignableRoles.includes(defaultRole)) {
          newUser.availability = {
            isAvailable: true,
            reason: '',
            lastUpdated: serverTimestamp()
          };
        }

        const userDocRef = doc(db, 'users', firebaseUser.uid);
        await setDoc(userDocRef, newUser);
        this.costMonitoringService.trackFirestoreWrite();

        userProfile = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
          ...newUser,
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
        };

      } else {
        console.log('🔐 AuthService: Found existing user profile for:', firebaseUser.email);

        // Use existing user profile
        const data = userDocSnap.data()!;

        // Data migration: If availability is missing, add a default and update Firestore.
        if (!data.availability) {
          const assignableRoles: Role[] = ['technician'];
          const defaultAvailability = {
            isAvailable: assignableRoles.includes(data.role),
            reason: '',
            lastUpdated: serverTimestamp()
          };
          data.availability = defaultAvailability; // Add to in-memory data immediately

          // Asynchronously update the document in Firestore without blocking.
          updateDoc(userDocRef, { availability: defaultAvailability })
            .then(() => console.log(`Migrated availability for user ${data.email}`))
            .catch(err => console.error(`Failed to migrate availability for user ${data.email}`, err));
          this.costMonitoringService.trackFirestoreWrite(); // Track the migration write
        }
        console.log('🔐 AuthService: data.updatedAt type:', typeof data.updatedAt, 'value:', data.updatedAt, 'has toDate:', typeof data.updatedAt?.toDate === 'function');
        console.log('🔐 AuthService: data.createdAt type:', typeof data.createdAt, 'value:', data.createdAt, 'has toDate:', typeof data.createdAt?.toDate === 'function');

        // Normalize timestamps to ensure they are Firestore Timestamps
        const normalizeTimestamp = (value: any): Timestamp => {
          if (value && typeof value.toDate === 'function') {
            return value; // Already a Timestamp
          }
          if (value instanceof Date) {
            return Timestamp.fromDate(value);
          }
          if (typeof value === 'string') {
            return Timestamp.fromDate(new Date(value));
          }
          if (typeof value === 'number') {
            return Timestamp.fromDate(new Date(value));
          }
          // If null, undefined, or invalid, use current time
          return Timestamp.now();
        };

        const normalizedCreatedAt = normalizeTimestamp(data.createdAt);
        const normalizedUpdatedAt = normalizeTimestamp(data.updatedAt);

        // Ensure existing users have a role assigned
        if (!data.role) {
          await updateDoc(userDocRef, { role: 'customer', updatedAt: serverTimestamp() });
          this.costMonitoringService.trackFirestoreWrite();
          data.role = 'customer';
        }

        userProfile = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          name: data.name,
          displayName: data.displayName || data.name,
          email: data.email,
          phone: data.phone,
          role: data.role,
          avatarUrl: data.avatarUrl,
          active: data.active,
          technicianProfile: data.technicianProfile,
          createdAt: normalizedCreatedAt,
          updatedAt: normalizedUpdatedAt,
        };
      }

      this.currentUser.set(userProfile);

      // Store in localStorage
      const userForStorage = {
        ...userProfile,
        createdAt: userProfile.createdAt.toDate().getTime(),
        updatedAt: userProfile.updatedAt.toDate().getTime(),
        technicianProfile: userProfile.technicianProfile
          ? {
              ...userProfile.technicianProfile,
              employmentStartAt: userProfile.technicianProfile.employmentStartAt
                ? userProfile.technicianProfile.employmentStartAt.toDate().getTime()
                : undefined,
            }
          : null,
      };

      console.log('🔐 AuthService: Preparing user data for localStorage storage', { uid: userForStorage.uid, email: userForStorage.email });
      try {
        const serializedData = JSON.stringify(userForStorage);
        console.log('🔐 AuthService: Serialized user data length:', serializedData.length);
        localStorage.setItem('currentUser', serializedData);
        console.log('🔐 AuthService: User profile stored successfully in localStorage');
        // Verify storage
        const verifyStored = localStorage.getItem('currentUser');
        console.log('🔐 AuthService: Verification - data stored in localStorage:', !!verifyStored);
      } catch (error) {
        console.error('🔐 AuthService: Error storing user in localStorage:', error);
      }

    } catch (error: any) {
      const errorContext = {
        firebaseUserId: firebaseUser?.uid,
        firebaseUserEmail: firebaseUser?.email,
        timestamp: new Date().toISOString(),
        errorCode: error.code,
        errorMessage: error.message,
        userAgent: navigator.userAgent,
        url: window.location.href,
        networkOnline: navigator.onLine,
        firebaseConfig: {
          projectId: environment.firebase.projectId,
          authDomain: environment.firebase.authDomain
        }
      };

      console.error('🔐 AuthService: AUTH_HANDLE_FIREBASE_USER_FAILED - Error handling Firebase user:', errorContext);

      // Handle specific Firestore errors
      switch (error.code) {
        case 'permission-denied':
          console.warn('🔐 AuthService: AUTH_PERMISSION_DENIED - Insufficient permissions to access user data', errorContext);
          break;
        case 'not-found':
          console.warn('🔐 AuthService: AUTH_USER_DOCUMENT_NOT_FOUND - User document not found in database', errorContext);
          break;
        case 'unavailable':
          console.warn('🔐 AuthService: AUTH_SERVICE_UNAVAILABLE - Firestore service temporarily unavailable', errorContext);
          break;
        case 'internal':
          console.error('🔐 AuthService: AUTH_FIREBASE_INTERNAL_ERROR - Firebase internal error occurred', errorContext);
          break;
        case 'deadline-exceeded':
          console.warn('🔐 AuthService: AUTH_DEADLINE_EXCEEDED - Request timed out', errorContext);
          break;
        case 'resource-exhausted':
          console.warn('🔐 AuthService: AUTH_RESOURCE_EXHAUSTED - Quota exceeded or rate limited', errorContext);
          break;
        default:
          console.warn('🔐 AuthService: AUTH_HANDLE_USER_UNKNOWN_ERROR - Unknown error handling Firebase user', errorContext);
      }
    }
  }

  hasRole(requiredRoles: Role[]): boolean {
    this.hasRoleCallCount++;
    const user = this.currentUser();
    if (!user) {
      console.log(`🔐 AuthService: hasRole call #${this.hasRoleCallCount} - No current user, denying access`);
      return false;
    }

    // Apply role mapping for backward compatibility
    const mappedRole = this.roleMapping[user.role] || user.role;

    const hasRole = requiredRoles.includes(mappedRole);
    console.log(`🔐 AuthService: hasRole call #${this.hasRoleCallCount}`, {
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      mappedRole,
      requiredRoles,
      hasRole,
      timestamp: new Date().toISOString()
    });
    if (!hasRole) {
      console.warn('🔐 AuthService: Access denied - user role', user.role, '(mapped to', mappedRole, ') not in required roles', requiredRoles);
    }
    return hasRole;
  }

  // Get authentication state as observable that resolves when auth is complete
  getAuthState(): Observable<boolean> {
    return this.authState$;
  }

  // Wait for authentication to be resolved
  waitForAuth(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // If already determined, resolve immediately
      if (this.authDetermined()) {
        resolve(this.authState());
        return;
      }

      // Subscribe to authState$ and wait for determination
      const subscription = this.authState$.subscribe(() => {
        if (this.authDetermined()) {
          subscription.unsubscribe();
          resolve(this.authState());
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        subscription.unsubscribe();
        reject(new Error('Authentication state determination timed out'));
      }, 10000);
    });
  }

  // Wait for current user to be loaded
  waitForUser(): Promise<UserProfile | null> {
    return new Promise((resolve) => {
      const currentUser = this.currentUser();
      if (currentUser !== null) {
        resolve(currentUser);
        return;
      }

      // Listen to changes in currentUser signal
      const subscription = this.authState$.subscribe(() => {
        const user = this.currentUser();
        if (user !== null) {
          subscription.unsubscribe();
          resolve(user);
        }
      });
    });
  }

  // Phone authentication methods
  async sendPhoneOTP(phoneNumber: string): Promise<ConfirmationResult> {
    try {
      console.log('🔐 AuthService: Sending phone OTP for:', phoneNumber);

      // Import RecaptchaVerifier dynamically to avoid issues
      const { RecaptchaVerifier } = await import('firebase/auth');

      // Create reCAPTCHA verifier
      const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          console.log('🔐 AuthService: reCAPTCHA solved');
        },
        'expired-callback': () => {
          console.log('🔐 AuthService: reCAPTCHA expired');
        }
      });

      // Send OTP
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      console.log('🔐 AuthService: Phone OTP sent successfully');

      return confirmationResult;
    } catch (error: any) {
      const errorContext = {
        phoneNumber,
        timestamp: new Date().toISOString(),
        errorCode: error.code,
        errorMessage: error.message,
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      console.error('🔐 AuthService: AUTH_PHONE_OTP_FAILED - Error sending phone OTP:', errorContext);

      // Handle specific phone auth errors
      switch (error.code) {
        case 'auth/invalid-phone-number':
          console.warn('🔐 AuthService: AUTH_INVALID_PHONE_NUMBER - Invalid phone number format', errorContext);
          break;
        case 'auth/missing-phone-number':
          console.warn('🔐 AuthService: AUTH_MISSING_PHONE_NUMBER - Phone number is required', errorContext);
          break;
        case 'auth/too-many-requests':
          console.warn('🔐 AuthService: AUTH_TOO_MANY_REQUESTS - Too many requests', errorContext);
          break;
        case 'auth/quota-exceeded':
          console.warn('🔐 AuthService: AUTH_QUOTA_EXCEEDED - SMS quota exceeded', errorContext);
          break;
        default:
          console.warn('🔐 AuthService: AUTH_PHONE_OTP_UNKNOWN_ERROR - Unknown error sending phone OTP', errorContext);
      }

      throw error;
    }
  }

  async verifyPhoneOTP(confirmationResult: ConfirmationResult, otp: string): Promise<boolean> {
    try {
      console.log('🔐 AuthService: Verifying phone OTP');

      await confirmationResult.confirm(otp);
      console.log('🔐 AuthService: Phone OTP verified successfully');

      return true;
    } catch (error: any) {
      const errorContext = {
        timestamp: new Date().toISOString(),
        errorCode: error.code,
        errorMessage: error.message,
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      console.error('🔐 AuthService: AUTH_PHONE_VERIFY_FAILED - Error verifying phone OTP:', errorContext);

      // Handle specific verification errors
      switch (error.code) {
        case 'auth/invalid-verification-code':
          console.warn('🔐 AuthService: AUTH_INVALID_VERIFICATION_CODE - Invalid OTP code', errorContext);
          break;
        case 'auth/code-expired':
          console.warn('🔐 AuthService: AUTH_CODE_EXPIRED - OTP code has expired', errorContext);
          break;
        case 'auth/invalid-verification-id':
          console.warn('🔐 AuthService: AUTH_INVALID_VERIFICATION_ID - Invalid verification ID', errorContext);
          break;
        default:
          console.warn('🔐 AuthService: AUTH_PHONE_VERIFY_UNKNOWN_ERROR - Unknown error verifying phone OTP', errorContext);
      }

      return false;
    }
  }
}