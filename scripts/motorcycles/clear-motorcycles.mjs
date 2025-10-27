import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCaTDXcwrPWsetQFphHqWCItl-qPLbvsNs",
  authDomain: "blued-motors.firebaseapp.com",
  projectId: "blued-motors",
  storageBucket: "blued-motors.firebasestorage.app",
  messagingSenderId: "864001185239",
  appId: "1:864001185239:web:980607ab38d4ae9a762792",
  measurementId: "G-8YE2480EJP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('🗑️ Starting motorcycle database cleanup...');

async function clearMotorcycles() {
  try {
    const querySnapshot = await getDocs(collection(db, 'motorcycles'));
    const deletePromises = [];

    querySnapshot.forEach((document) => {
      deletePromises.push(deleteDoc(doc(db, 'motorcycles', document.id)));
    });

    await Promise.all(deletePromises);

    console.log(`✅ Deleted ${deletePromises.length} motorcycles from database`);

  } catch (error) {
    console.error('❌ Error clearing motorcycles:', error);
    throw error;
  }
}

// Run the cleanup
clearMotorcycles().then(() => {
  console.log('✅ Motorcycle cleanup process finished');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Motorcycle cleanup failed:', error);
  process.exit(1);
});