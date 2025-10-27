import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

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

console.log('🏢 Starting workshop locations seeding...');

// Workshop locations data
const workshopLocations = [
  {
    name: 'Sede Principal Bogotá',
    code: 'BOG',
    address: 'Carrera 15 # 89-12, Bogotá, Colombia',
    city: 'Bogotá',
    phone: '+57 601 234 5678',
    active: true
  },
  {
    name: 'Sucursal Medellín',
    code: 'MED',
    address: 'Carrera 43A # 1-50, El Poblado, Medellín, Colombia',
    city: 'Medellín',
    phone: '+57 604 345 6789',
    active: true
  },
  {
    name: 'Sucursal Cali',
    code: 'CAL',
    address: 'Avenida 6N # 23-45, Cali, Colombia',
    city: 'Cali',
    phone: '+57 602 456 7890',
    active: true
  },
  {
    name: 'Sucursal Barranquilla',
    code: 'BAR',
    address: 'Carrera 53 # 79-120, Barranquilla, Colombia',
    city: 'Barranquilla',
    phone: '+57 605 567 8901',
    active: true
  },
  {
    name: 'Sucursal Cartagena',
    code: 'CTG',
    address: 'Bocagrande, Carrera 1 # 10-10, Cartagena, Colombia',
    city: 'Cartagena',
    phone: '+57 605 678 9012',
    active: true
  }
];

// Function to seed locations
async function seedLocations() {
  try {
    console.log(`📍 Seeding ${workshopLocations.length} workshop locations`);

    for (const location of workshopLocations) {
      try {
        await addDoc(collection(db, 'workshopLocations'), {
          ...location,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log(`✅ Created location: ${location.name} (${location.code})`);
      } catch (error) {
        console.error(`❌ Error creating location ${location.name}:`, error);
      }
    }

    console.log('🎉 Workshop locations seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding locations:', error);
    throw error;
  }
}

// Run the seeding
seedLocations().then(() => {
  console.log('✅ Workshop locations seeding process finished');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Workshop locations seeding failed:', error);
  process.exit(1);
});