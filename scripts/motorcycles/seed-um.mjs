import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Configuración de Firebase (asegúrate de que sea correcta)
const firebaseConfig = {
  apiKey: "AIzaSyBYKHbMIs8EDeXYpffggpbhYW2lSRac8ro",
  authDomain: "bbddmm-387a7.firebaseapp.com",
  projectId: "bbddmm-387a7",
  storageBucket: "bbddmm-387a7.firebasestorage.app",
  messagingSenderId: "647494031256",
  appId: "1:647494031256:web:a7fa67efda4b85b1003ded"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('🏍️ Iniciando el sembrado de la base de datos de motocicletas UM...');

const motorcycleData = {
  'UM': [
    // === Bajo Cilindrada (≤250cc) ===
    { model: 'UM 125', displacementCc: 125, type: 'naked', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'UM 150', displacementCc: 150, type: 'naked', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'UM 200', displacementCc: 200, type: 'naked', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'UM 250', displacementCc: 250, type: 'naked', years: [2020, 2021, 2022, 2023, 2024] },

    // === Medio Cilindrada (251-650cc) ===
    { model: 'UM 300', displacementCc: 300, type: 'naked', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'UM 400', displacementCc: 400, type: 'naked', years: [2021, 2022, 2023, 2024] },
    { model: 'UM 500', displacementCc: 500, type: 'naked', years: [2022, 2023, 2024] },
    { model: 'UM 600', displacementCc: 600, type: 'naked', years: [2023, 2024] },

    // === Scooters Bajo Cilindrada ===
    { model: 'UM Scooter 125', displacementCc: 125, type: 'scooter', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'UM Scooter 150', displacementCc: 150, type: 'scooter', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'UM Scooter 200', displacementCc: 200, type: 'scooter', years: [2020, 2021, 2022, 2023, 2024] },

    // === Adventure/Touring Medio Cilindrada ===
    { model: 'UM Adventure 300', displacementCc: 300, type: 'adventure', years: [2021, 2022, 2023, 2024] },
    { model: 'UM Touring 400', displacementCc: 400, type: 'touring', years: [2022, 2023, 2024] },
    { model: 'UM Off-Road 250', displacementCc: 250, type: 'off_road', years: [2020, 2021, 2022, 2023, 2024] },

    // === Cruiser Medio Cilindrada ===
    { model: 'UM Cruiser 300', displacementCc: 300, type: 'cruiser', years: [2021, 2022, 2023, 2024] },
    { model: 'UM Cruiser 500', displacementCc: 500, type: 'cruiser', years: [2022, 2023, 2024] },

    // === Sport Bajo Cilindrada ===
    { model: 'UM Sport 125', displacementCc: 125, type: 'sport', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'UM Sport 200', displacementCc: 200, type: 'sport', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'UM Sport 250', displacementCc: 250, type: 'sport', years: [2021, 2022, 2023, 2024] }
  ]
};

// Función para generar una placa de licencia en formato colombiano (3 letras + 2 números + 1 letra)
function generateLicensePlate() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';

  const firstThree = Array.from({length: 3}, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  const twoNumbers = Array.from({length: 2}, () => numbers[Math.floor(Math.random() * numbers.length)]).join('');
  const lastLetter = letters[Math.floor(Math.random() * letters.length)];

  return firstThree + twoNumbers + lastLetter;
}

// Función para generar las motocicletas desde los datos
function generateMotorcycles() {
  const motorcycles = [];
  const seen = new Set(); // Para rastrear combinaciones únicas

  const brand = 'UM';
  const models = motorcycleData[brand];

  for (const modelData of models) {
    for (const year of modelData.years) {
      if (year >= 2018) { // UM motorcycles start from 2018
        const key = `${brand}-${modelData.model}-${year}`;

        // Evitar duplicados
        if (seen.has(key)) continue;
        seen.add(key);

        motorcycles.push({
          brand,
          model: modelData.model,
          year,
          displacementCc: modelData.displacementCc,
          type: modelData.type,
          category: getCategoryFromDisplacement(modelData.displacementCc),
          plate: generateLicensePlate(),
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }
  }

  return motorcycles;
}

// Función auxiliar para determinar la categoría por cilindrada
function getCategoryFromDisplacement(cc) {
  if (cc <= 250) return 'bajo_cc';
  if (cc <= 650) return 'mediano_cc';
  return 'alto_cc';
}

// Función para sembrar la base de datos
async function seedMotorcycles() {
  try {
    const motorcycles = generateMotorcycles();
    console.log(`📊 Generados ${motorcycles.length} registros de motocicletas UM`);

    let addedCount = 0;

    for (const motorcycle of motorcycles) {
      try {
        await addDoc(collection(db, 'motorcycles'), motorcycle);
        addedCount++;

        if (addedCount % 25 === 0) {
          console.log(`✅ Añadidas ${addedCount}/${motorcycles.length} motocicletas`);
        }
      } catch (error) {
        console.error(`❌ Error añadiendo ${motorcycle.brand} ${motorcycle.model}:`, error);
      }
    }

    console.log('🎉 ¡Sembrado de motocicletas UM completado con éxito!');
    console.log(`📊 Total de motocicletas añadidas: ${addedCount}`);
    console.log('🏍️ Motocicletas UM agregadas:');
    console.log('   - Bajo cilindrada (≤250cc): Modelos 125cc, 150cc, 200cc, 250cc');
    console.log('   - Medio cilindrada (251-650cc): Modelos 300cc, 400cc, 500cc, 600cc');
    console.log('   - Tipos: Naked, Scooter, Adventure, Touring, Off-Road, Cruiser, Sport');

  } catch (error) {
    console.error('❌ Error al sembrar la base de datos:', error);
    throw error;
  }
}

// Ejecutar el sembrado
seedMotorcycles().then(() => {
  console.log('✅ Proceso de sembrado finalizado');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Falló el proceso de sembrado:', error);
  process.exit(1);
});