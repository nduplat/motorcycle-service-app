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

console.log('🏍️ Iniciando el sembrado de la base de datos de motocicletas TVS...');

const motorcycleData = {
  'TVS': [
    // === Apache Series (Performance) ===
    { model: 'Apache RR 310', displacementCc: 312, type: 'racing', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Apache RTR 310', displacementCc: 312, type: 'naked', years: [2023, 2024] },
    { model: 'Apache RTR 200 4V', displacementCc: 197, type: 'naked', years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Apache RTR 180', displacementCc: 177, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Apache RTR 160 4V', displacementCc: 159, type: 'naked', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Apache RTR 160', displacementCc: 159, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },

    // === Modern Classics / Cruisers ===
    { model: 'Ronin', displacementCc: 225, type: 'cruiser', years: [2022, 2023, 2024] },

    // === Commuter (Premium) ===
    { model: 'Raider 125', displacementCc: 124, type: 'naked', years: [2021, 2022, 2023, 2024] },

    // === Commuter (Standard) ===
    { model: 'Radeon', displacementCc: 109, type: 'naked', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Star City Plus', displacementCc: 109, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Sport', displacementCc: 109, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Victor', displacementCc: 109, type: 'naked', years: [2016, 2017, 2018, 2019, 2020] },
    { model: 'Phoenix 125', displacementCc: 124, type: 'naked', years: [2015, 2016, 2017] },
    
    // === Scooters ===
    { model: 'Ntorq 125', displacementCc: 124, type: 'scooter', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Jupiter 125', displacementCc: 124, type: 'scooter', years: [2021, 2022, 2023, 2024] },
    { model: 'Jupiter 110', displacementCc: 109, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Zest 110', displacementCc: 109, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Scooty Pep Plus', displacementCc: 87, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Wego', displacementCc: 109, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019] },

    // === Electric ===
    { model: 'iQube Electric', displacementCc: 0, type: 'scooter', years: [2020, 2021, 2022, 2023, 2024] }, // 0 cc for electric
    { model: 'X', displacementCc: 0, type: 'scooter', years: [2024] },

    // === Moped ===
    { model: 'XL 100', displacementCc: 99, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
  ]
};

// Función para generar las motocicletas desde los datos
function generateMotorcycles() {
  const motorcycles = [];
  const seen = new Set(); // Para rastrear combinaciones únicas

  const brand = 'TVS';
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
  if (cc === 0) return 'electrica'; // Categoría para eléctricas
  if (cc <= 250) return 'bajo_cc';
  if (cc <= 650) return 'mediano_cc';
  return 'alto_cc';
}

// Función para sembrar la base de datos
async function seedMotorcycles() {
  try {
    const motorcycles = generateMotorcycles();
    console.log(`📊 Generados ${motorcycles.length} registros de motocicletas TVS`);

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