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

console.log('🏍️ Iniciando el sembrado de la base de datos de motocicletas Hero...');

const motorcycleData = {
  'Hero': [
    // === Performance / Premium ===
    { model: 'Karizma XMR', displacementCc: 210, type: 'racing', years: [2023, 2024] },
    { model: 'Karizma ZMR', displacementCc: 223, type: 'racing', years: [2015, 2016, 2017, 2018, 2019] },
    { model: 'Xtreme 160R', displacementCc: 163, type: 'naked', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'Xtreme 200S', displacementCc: 199, type: 'racing', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Xtreme 200R', displacementCc: 199, type: 'naked', years: [2018, 2019, 2020] },
    { model: 'Hunk', displacementCc: 149, type: 'naked', years: [2015, 2016, 2017, 2018, 2019] },
    { model: 'Achiever 150', displacementCc: 149, type: 'naked', years: [2016, 2017, 2018, 2019, 2020] },

    // === Adventure (XPulse Series) ===
    { model: 'XPulse 200 4V', displacementCc: 199, type: 'adventure', years: [2021, 2022, 2023, 2024] },
    { model: 'XPulse 200T 4V', displacementCc: 199, type: 'touring', years: [2022, 2023, 2024] },
    { model: 'XPulse 200', displacementCc: 199, type: 'adventure', years: [2019, 2020, 2021] },
    { model: 'XPulse 200T', displacementCc: 199, type: 'touring', years: [2019, 2020, 2021] },
    { model: 'Impulse', displacementCc: 149, type: 'adventure', years: [2015, 2016, 2017] },

    // === Commuter (125cc) ===
    { model: 'Super Splendor', displacementCc: 124, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Glamour', displacementCc: 124, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Glamour XTEC', displacementCc: 124, type: 'naked', years: [2021, 2022, 2023, 2024] },
    { model: 'Ignitor', displacementCc: 124, type: 'naked', years: [2015, 2016, 2017, 2018] },

    // === Commuter (100cc - 110cc) ===
    { model: 'Splendor Plus', displacementCc: 97, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Splendor Plus XTEC', displacementCc: 97, type: 'naked', years: [2022, 2023, 2024] },
    { model: 'Splendor iSmart', displacementCc: 113, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021] },
    { model: 'Passion Pro', displacementCc: 113, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Passion XTEC', displacementCc: 113, type: 'naked', years: [2022, 2023, 2024] },
    { model: 'HF Deluxe', displacementCc: 97, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'HF 100', displacementCc: 97, type: 'naked', years: [2021, 2022, 2023, 2024] },
    
    // === Scooters ===
    { model: 'Destini 125 XTEC', displacementCc: 124, type: 'scooter', years: [2022, 2023, 2024] },
    { model: 'Destini 125', displacementCc: 124, type: 'scooter', years: [2018, 2019, 2020, 2021] },
    { model: 'Maestro Edge 125', displacementCc: 124, type: 'scooter', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Maestro Edge 110', displacementCc: 110, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Pleasure+ XTEC', displacementCc: 110, type: 'scooter', years: [2021, 2022, 2023, 2024] },
    { model: 'Pleasure+', displacementCc: 110, type: 'scooter', years: [2019, 2020, 2021] },
    { model: 'Duet', displacementCc: 110, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019] },
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

  const brand = 'Hero';
  const models = motorcycleData[brand];

  for (const modelData of models) {
    for (const year of modelData.years) {
      if (year >= 2015) {
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
    console.log(`📊 Generados ${motorcycles.length} registros de motocicletas Hero`);

    let addedCount = 0;

    for (const motorcycle of motorcycles) {
      try {
        await addDoc(collection(db, 'motorcycles'), motorcycle);
        addedCount++;

        if (addedCount % 50 === 0) {
          console.log(`✅ Añadidas ${addedCount}/${motorcycles.length} motocicletas`);
        }
      } catch (error) {
        console.error(`❌ Error añadiendo ${motorcycle.brand} ${motorcycle.model}:`, error);
      }
    }

    console.log('🎉 ¡Sembrado de motocicletas completado con éxito!');
    console.log(`📊 Total de motocicletas añadidas: ${addedCount}`);

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