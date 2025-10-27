import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBYKHbMIs8EDeXYpffggpbhYW2lSRac8ro",
  authDomain: "bbddmm-387a7.firebaseapp.com",
  projectId: "bbddmm-387a7",
  storageBucket: "bbddmm-387a7.firebasestorage.app",
  messagingSenderId: "647494031256",
  appId: "1:647494031256:web:a7fa67efda4b85b1003ded"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateUserRole(email, newRole) {
  try {
    console.log(`🔍 Searching for user with email: ${email}`);

    // Query for the user by email
    const usersQuery = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(usersQuery);

    if (querySnapshot.empty) {
      console.log(`❌ No user found with email: ${email}`);
      return false;
    }

    // Get the first matching user (should be unique)
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    console.log(`✅ Found user: ${userData.name} (${userData.email})`);
    console.log(`   Current role: ${userData.role}`);

    // Update the role
    const userRef = doc(db, "users", userDoc.id);
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: serverTimestamp()
    });

    console.log(`✅ Successfully updated role to: ${newRole}`);
    return true;

  } catch (error) {
    console.error('❌ Error updating user role:', error);
    return false;
  }
}

// Main execution
async function main() {
  const email = 'armonix432@gmail.com';
  const newRole = 'technician';

  console.log('🚀 Starting user role update...');
  console.log(`   Email: ${email}`);
  console.log(`   New Role: ${newRole}`);

  const success = await updateUserRole(email, newRole);

  if (success) {
    console.log('🎉 User role update completed successfully!');
  } else {
    console.log('❌ User role update failed!');
    process.exit(1);
  }
}

// Run the script
main().then(() => {
  console.log('✅ Script execution finished');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script execution failed:', error);
  process.exit(1);
});