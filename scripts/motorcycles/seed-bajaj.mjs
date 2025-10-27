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

console.log('🏍️ Iniciando el sembrado de la base de datos de motocicletas Bajaj...');

const motorcycleData = {
  'Bajaj': [
    // === Pulsar Series ===
    { model: 'Pulsar RS200', displacementCc: 199, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Pulsar NS200', displacementCc: 199, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Pulsar N250', displacementCc: 249, type: 'naked', years: [2021, 2022, 2023, 2024] },
    { model: 'Pulsar F250', displacementCc: 249, type: 'naked', years: [2021, 2022, 2023, 2024] },
    { model: 'Pulsar 220F', displacementCc: 220, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Pulsar NS160', displacementCc: 160, type: 'naked', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Pulsar N160', displacementCc: 164, type: 'naked', years: [2022, 2023, 2024] },
    { model: 'Pulsar 180F', displacementCc: 178, type: 'naked', years: [2019, 2020, 2021, 2022] },
    { model: 'Pulsar 180', displacementCc: 178, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021] },
    { model: 'Pulsar 150', displacementCc: 149, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Pulsar P150', displacementCc: 149, type: 'naked', years: [2023, 2024] },
    { model: 'Pulsar 125', displacementCc: 124, type: 'naked', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Pulsar NS125', displacementCc: 124, type: 'naked', years: [2021, 2022, 2023, 2024] },
    
    // === Dominar Series ===
    { model: 'Dominar 400', displacementCc: 373, type: 'touring', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Dominar 250', displacementCc: 248, type: 'touring', years: [2020, 2021, 2022, 2023, 2024] },

    // === Avenger Series ===
    { model: 'Avenger Cruise 220', displacementCc: 220, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Avenger Street 220', displacementCc: 220, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020] },
    { model: 'Avenger Street 160', displacementCc: 160, type: 'cruiser', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Avenger Street 180', displacementCc: 180, type: 'cruiser', years: [2018, 2019] },
    { model: 'Avenger Street 150', displacementCc: 150, type: 'cruiser', years: [2015, 2016, 2017, 2018] },

    // === Platina Series ===
    { model: 'Platina 110 H-Gear', displacementCc: 115, type: 'naked', years: [2019, 2020, 2021] },
    { model: 'Platina 110', displacementCc: 115, type: 'naked', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Platina 100', displacementCc: 102, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },

    // === CT Series ===
    { model: 'CT 125X', displacementCc: 124, type: 'naked', years: [2022, 2023, 2024] },
    { model: 'CT 110X', displacementCc: 115, type: 'naked', years: [2021, 2022, 2023, 2024] },
    { model: 'CT 110', displacementCc: 115, type: 'naked', years: [2019, 2020, 2021] },
    { model: 'CT 100', displacementCc: 102, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021] },

    // === Discover Series ===
    { model: 'Discover 125', displacementCc: 124, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020] },
    { model: 'Discover 150', displacementCc: 144, type: 'naked', years: [2015, 2016, 2017, 2018] },
    { model: 'Discover 110', displacementCc: 115, type: 'naked', years: [2018, 2019, 2020] },
    { model: 'Discover 100', displacementCc: 94, type: 'naked', years: [2015] },

    // === V Series ===
    { model: 'V15', displacementCc: 149, type: 'naked', years: [2016, 2017, 2018, 2019] },
    { model: 'V12', displacementCc: 124, type: 'naked', years: [2017, 2018] },
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

  const brand = 'Bajaj';
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
    console.log(`📊 Generados ${motorcycles.length} registros de motocicletas Bajaj`);

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