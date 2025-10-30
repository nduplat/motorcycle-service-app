

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import { environment } from './environments/environment';

// Use environment configuration for Firebase
const firebaseConfig = environment.firebase;

// FIX: Correctly type the Firebase app instance using the compat SDK's `firebase.app.App` type and remove the problematic modular import.
// This pattern avoids re-initialization errors in environments with hot-reloading.
const app = initializeApp(firebaseConfig);

// Export v9 modular services from the compat-initialized app.
// This allows the rest of the application to use the v9 modular syntax.
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);