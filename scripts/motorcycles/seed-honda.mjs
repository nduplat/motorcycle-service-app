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

console.log('🏍️ Iniciando el sembrado de la base de datos de motocicletas Honda...');

const motorcycleData = {
  'Honda': [
    // === Supersport ===
    { model: 'CBR1000RR-R Fireblade SP', displacementCc: 1000, type: 'racing', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'CBR1000RR', displacementCc: 999, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'CBR600RR', displacementCc: 599, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'CBR650R', displacementCc: 649, type: 'racing', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'CBR650F', displacementCc: 649, type: 'racing', years: [2015, 2016, 2017, 2018] },
    { model: 'CBR500R', displacementCc: 471, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'CBR300R', displacementCc: 286, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022] },
    { model: 'CBR250RR', displacementCc: 249, type: 'racing', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] }, // Principalmente en mercados asiáticos

    // === Naked / Street (Neo-Sports Café & Streetfighters) ===
    { model: 'CB1000R', displacementCc: 998, type: 'naked', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'CB1000 Hornet', displacementCc: 999, type: 'naked', years: [2024] },
    { model: 'CB750 Hornet', displacementCc: 755, type: 'naked', years: [2023, 2024] },
    { model: 'CB650R', displacementCc: 649, type: 'naked', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'CB500F', displacementCc: 471, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'CB500 Hornet', displacementCc: 471, type: 'naked', years: [2024] },
    { model: 'CB300R', displacementCc: 286, type: 'naked', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'CB125R', displacementCc: 125, type: 'naked', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'CB1100EX/RS', displacementCc: 1140, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021] },
    
    // === Adventure & Touring ===
    { model: 'Gold Wing Tour', displacementCc: 1833, type: 'touring', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Gold Wing', displacementCc: 1833, type: 'touring', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'CRF1100L Africa Twin Adventure Sports', displacementCc: 1084, type: 'adventure', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'CRF1100L Africa Twin', displacementCc: 1084, type: 'adventure', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'CRF1000L Africa Twin', displacementCc: 998, type: 'adventure', years: [2016, 2017, 2018, 2019] },
    { model: 'NT1100', displacementCc: 1084, type: 'touring', years: [2022, 2023, 2024] },
    { model: 'XL750 Transalp', displacementCc: 755, type: 'adventure', years: [2023, 2024] },
    { model: 'NC750X', displacementCc: 745, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'CB500X', displacementCc: 471, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023] }, // Rebranded to NX500
    { model: 'NX500', displacementCc: 471, type: 'adventure', years: [2024] },
    { model: 'VFR800X Crossrunner', displacementCc: 782, type: 'touring', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021] },
    { model: 'VFR1200X Crosstourer', displacementCc: 1237, type: 'touring', years: [2015, 2016, 2017, 2018, 2019, 2020] },

    // === Cruiser ===
    { model: 'Rebel 1100T', displacementCc: 1084, type: 'cruiser', years: [2023, 2024] },
    { model: 'Rebel 1100', displacementCc: 1084, type: 'cruiser', years: [2021, 2022, 2023, 2024] },
    { model: 'Rebel 500', displacementCc: 471, type: 'cruiser', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Rebel 300', displacementCc: 286, type: 'cruiser', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Fury', displacementCc: 1312, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022] },
    { model: 'Shadow Phantom', displacementCc: 745, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Shadow Aero', displacementCc: 745, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022] },
    { model: 'CTX1300', displacementCc: 1261, type: 'touring', years: [2015] },
    { model: 'CTX700N', displacementCc: 670, type: 'cruiser', years: [2015, 2016, 2017, 2018] },

    // === Dual Sport / Off-Road ===
    { model: 'XR650L', displacementCc: 644, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'CRF450RL', displacementCc: 449, type: 'adventure', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'CRF300L', displacementCc: 286, type: 'adventure', years: [2021, 2022, 2023, 2024] },
    { model: 'CRF300L Rally', displacementCc: 286, type: 'adventure', years: [2021, 2022, 2023, 2024] },
    { model: 'CRF250L', displacementCc: 250, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020] },
    { model: 'XR150L', displacementCc: 149, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },

    // === Scooters ===
    { model: 'Forza 750', displacementCc: 745, type: 'scooter', years: [2021, 2022, 2023, 2024] },
    { model: 'Forza 350', displacementCc: 330, type: 'scooter', years: [2021, 2022, 2023, 2024] },
    { model: 'Forza 300', displacementCc: 279, type: 'scooter', years: [2018, 2019, 2020] },
    { model: 'ADV350', displacementCc: 330, type: 'scooter', years: [2022, 2023, 2024] },
    { model: 'ADV160', displacementCc: 157, type: 'scooter', years: [2023, 2024] },
    { model: 'ADV150', displacementCc: 149, type: 'scooter', years: [2020, 2021, 2022] },
    { model: 'SH350i', displacementCc: 330, type: 'scooter', years: [2021, 2022, 2023, 2024] },
    { model: 'SH150i', displacementCc: 153, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'PCX160', displacementCc: 157, type: 'scooter', years: [2021, 2022, 2023, 2024] },
    { model: 'PCX150', displacementCc: 149, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020] },
    { model: 'Activa 125', displacementCc: 124, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Dio', displacementCc: 109, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Vision 110', displacementCc: 109, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Elite 125', displacementCc: 124, type: 'scooter', years: [2018, 2019, 2020, 2021, 2022] },

    // === MiniMOTO ===
    { model: 'Grom (MSX125)', displacementCc: 124, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Monkey', displacementCc: 124, type: 'naked', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Super Cub C125', displacementCc: 124, type: 'scooter', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Trail 125 (CT125)', displacementCc: 124, type: 'adventure', years: [2021, 2022, 2023, 2024] },
    { model: 'Navi', displacementCc: 109, type: 'scooter', years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
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

  const brand = 'Honda';
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
    console.log(`📊 Generados ${motorcycles.length} registros de motocicletas Honda`);

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