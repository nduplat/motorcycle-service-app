export const environment = {
  production: false,
  firebase: {
    // SECURITY NOTE: These Firebase config values are public and safe to expose
    // Firebase uses security rules and authentication for access control
    // DO NOT commit actual API keys to version control - use environment variables
    apiKey: (globalThis as any).process?.env?.['VITE_FIREBASE_API_KEY'] || "AIzaSyBYKHbMIs8EDeXYpffggpbhYW2lSRac8ro",
    authDomain: (globalThis as any).process?.env?.['VITE_FIREBASE_AUTH_DOMAIN'] || "bbddmm-387a7.firebaseapp.com",
    projectId: (globalThis as any).process?.env?.['VITE_FIREBASE_PROJECT_ID'] || "bbddmm-387a7",
    storageBucket: (globalThis as any).process?.env?.['VITE_FIREBASE_STORAGE_BUCKET'] || "bbddmm-387a7.firebasestorage.app",
    messagingSenderId: (globalThis as any).process?.env?.['VITE_FIREBASE_MESSAGING_SENDER_ID'] || "647494031256",
    appId: (globalThis as any).process?.env?.['VITE_FIREBASE_APP_ID'] || "1:647494031256:web:a7fa67efda4b85b1003ded"
  },
  costMonitoring: {
    thresholds: {
      daily: 10, // $10 per day
      monthly: 200 // $200 per month
    },
    alerts: {
      enabled: true,
      firestoreThreshold: 5, // $5 for Firestore
      functionsThreshold: 2, // $2 for Functions
      storageThreshold: 1 // $1 for Storage
    }
  }
};