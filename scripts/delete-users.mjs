import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBYKHbMIs8EDeXYpffggpbhYW2lSRac8ro",
  authDomain: "bbddmm-387a7.firebaseapp.com",
  projectId: "bbddmm-387a7",
  storageBucket: "bbddmm-387a7.firebasestorage.app",
  messagingSenderId: "647494031256",
  appId: "1:647494031256:web:a7fa67efda4b85b1003ded"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteUsers() {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    const usersToDelete = [];

    querySnapshot.forEach((document) => {
      const data = document.data();
      if (data.email && data.email.endsWith('@blued-motors.com')) {
        usersToDelete.push({ id: document.id, email: data.email, name: data.name });
      }
    });

    console.log('Users to delete:', usersToDelete);

    for (const user of usersToDelete) {
      console.log(`Deleting user: ${user.email} (${user.name})`);
      await deleteDoc(doc(db, 'users', user.id));
    }

    console.log(`Deleted ${usersToDelete.length} users`);
  } catch (error) {
    console.error('Error deleting users:', error);
  }
}

deleteUsers();