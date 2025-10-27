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

console.log('🏍️ Iniciando el sembrado de la base de datos de motocicletas Suzuki...');

const motorcycleData = {
  'Suzuki': [
    // === Supersport ===
    { model: 'Hayabusa', displacementCc: 1340, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'GSX-R1000R', displacementCc: 999, type: 'racing', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'GSX-R1000', displacementCc: 999, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'GSX-R750', displacementCc: 750, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'GSX-R600', displacementCc: 599, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'GSX-8R', displacementCc: 776, type: 'racing', years: [2024] },
    { model: 'GSX250R', displacementCc: 248, type: 'racing', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Gixxer SF 250', displacementCc: 249, type: 'racing', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Gixxer SF', displacementCc: 155, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },

    // === Street / Naked ===
    { model: 'GSX-S1000', displacementCc: 999, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Katana', displacementCc: 999, type: 'naked', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'GSX-8S', displacementCc: 776, type: 'naked', years: [2023, 2024] },
    { model: 'GSX-S750', displacementCc: 749, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'SV650', displacementCc: 645, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Gixxer 250', displacementCc: 249, type: 'naked', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Gixxer', displacementCc: 155, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'GW250 Inazuma', displacementCc: 248, type: 'naked', years: [2015, 2016, 2017] },
    { model: 'TU250X', displacementCc: 249, type: 'naked', years: [2015, 2016, 2017, 2018, 2019] },
    
    // === Sport Touring ===
    { model: 'GSX-S1000GT+', displacementCc: 999, type: 'touring', years: [2022, 2023, 2024] },
    { model: 'GSX-S1000F', displacementCc: 999, type: 'touring', years: [2016, 2017, 2018, 2019, 2020] },

    // === Adventure / V-Strom ===
    { model: 'V-Strom 1050DE', displacementCc: 1037, type: 'adventure', years: [2023, 2024] },
    { model: 'V-Strom 1050', displacementCc: 1037, type: 'adventure', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'V-Strom 1000XT', displacementCc: 1037, type: 'adventure', years: [2018, 2019] },
    { model: 'V-Strom 1000', displacementCc: 1037, type: 'adventure', years: [2015, 2016, 2017, 2018] },
    { model: 'V-Strom 800DE', displacementCc: 776, type: 'adventure', years: [2023, 2024] },
    { model: 'V-Strom 650XT', displacementCc: 645, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'V-Strom 650', displacementCc: 645, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'V-Strom 250', displacementCc: 248, type: 'adventure', years: [2017, 2018, 2019, 2020] },
    
    // === Cruiser / Boulevard ===
    { model: 'Boulevard M109R B.O.S.S.', displacementCc: 1783, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Boulevard C90 B.O.S.S.', displacementCc: 1462, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019] },
    { model: 'Boulevard M90', displacementCc: 1462, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019] },
    { model: 'Boulevard C50T', displacementCc: 805, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Boulevard C50', displacementCc: 805, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Boulevard M50', displacementCc: 805, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019] },
    { model: 'Boulevard S40', displacementCc: 652, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Intruder 150', displacementCc: 155, type: 'cruiser', years: [2017, 2018, 2019, 2020, 2021] },

    // === Dual Sport ===
    { model: 'DR650S', displacementCc: 644, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'DR-Z400S', displacementCc: 398, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'DR200S', displacementCc: 199, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    
    // === Scooters ===
    { model: 'Burgman 650 Executive', displacementCc: 638, type: 'scooter', years: [2015, 2016, 2017, 2018] },
    { model: 'Burgman 400', displacementCc: 399, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Burgman 200', displacementCc: 200, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022] },
    { model: 'Burgman Street 125EX', displacementCc: 124, type: 'scooter', years: [2022, 2023, 2024] },
    { model: 'Access 125', displacementCc: 124, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Avenis 125', displacementCc: 124, type: 'scooter', years: [2022, 2023, 2024] },
  ]
};

// Función para generar las motocicletas desde los datos
function generateMotorcycles() {
  const motorcycles = [];
  const seen = new Set(); // Para rastrear combinaciones únicas

  const brand = 'Suzuki';
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
  if (cc <= 250) return 'bajo_cc';
  if (cc <= 650) return 'mediano_cc';
  return 'alto_cc';
}

// Función para sembrar la base de datos
async function seedMotorcycles() {
  try {
    const motorcycles = generateMotorcycles();
    console.log(`📊 Generados ${motorcycles.length} registros de motocicletas Suzuki`);

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