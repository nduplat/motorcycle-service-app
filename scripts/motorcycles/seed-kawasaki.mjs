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

console.log('🏍️ Iniciando el sembrado de la base de datos de motocicletas Kawasaki...');

const motorcycleData = {
  'Kawasaki': [
    // === Supersport / Ninja Series ===
    { model: 'Ninja H2R', displacementCc: 998, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] }, // Supercharged
    { model: 'Ninja H2', displacementCc: 998, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] }, // Supercharged
    { model: 'Ninja ZX-10RR', displacementCc: 998, type: 'racing', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Ninja ZX-10R', displacementCc: 998, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Ninja ZX-6R', displacementCc: 636, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Ninja 650', displacementCc: 649, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Ninja 500', displacementCc: 451, type: 'racing', years: [2024] },
    { model: 'Ninja 400', displacementCc: 399, type: 'racing', years: [2018, 2019, 2020, 2021, 2022, 2023] },
    { model: 'Ninja 300', displacementCc: 296, type: 'racing', years: [2015, 2016, 2017] },
    { model: 'Ninja 125', displacementCc: 125, type: 'racing', years: [2019, 2020, 2021, 2022, 2023, 2024] },

    // === Supernaked / Z Series ===
    { model: 'Z H2 SE', displacementCc: 998, type: 'naked', years: [2021, 2022, 2023, 2024] }, // Supercharged
    { model: 'Z H2', displacementCc: 998, type: 'naked', years: [2020, 2021, 2022, 2023, 2024] }, // Supercharged
    { model: 'Z900', displacementCc: 948, type: 'naked', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Z800', displacementCc: 806, type: 'naked', years: [2015, 2016] },
    { model: 'Z650', displacementCc: 649, type: 'naked', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Z500', displacementCc: 451, type: 'naked', years: [2024] },
    { model: 'Z400', displacementCc: 399, type: 'naked', years: [2019, 2020, 2021, 2022, 2023] },
    { model: 'Z300', displacementCc: 296, type: 'naked', years: [2015, 2016, 2017] },
    { model: 'Z125', displacementCc: 125, type: 'naked', years: [2019, 2020, 2021, 2022, 2023, 2024] },

    // === Retro Sport ===
    { model: 'Z900RS SE', displacementCc: 948, type: 'naked', years: [2022, 2023, 2024] },
    { model: 'Z900RS', displacementCc: 948, type: 'naked', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Z650RS', displacementCc: 649, type: 'naked', years: [2022, 2023, 2024] },
    { model: 'W800', displacementCc: 773, type: 'naked', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'W800 Cafe', displacementCc: 773, type: 'naked', years: [2019, 2020, 2021, 2022] },

    // === Sport Tourer / Adventure ===
    { model: 'Ninja H2 SX SE', displacementCc: 998, type: 'touring', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] }, // Supercharged
    { model: 'Ninja 1000SX', displacementCc: 1043, type: 'touring', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'Versys 1000 SE', displacementCc: 1043, type: 'adventure', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Versys 650', displacementCc: 649, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Versys-X 300', displacementCc: 296, type: 'adventure', years: [2017, 2018, 2019, 2020, 2021, 2022] },
    { model: 'KLR 650', displacementCc: 652, type: 'adventure', years: [2015, 2016, 2017, 2018, 2022, 2023, 2024] },
    
    // === Cruiser / Vulcan Series ===
    { model: 'Vulcan 1700 Vaquero', displacementCc: 1700, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Vulcan 900 Classic', displacementCc: 903, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Vulcan 900 Custom', displacementCc: 903, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Vulcan S', displacementCc: 649, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Eliminator', displacementCc: 451, type: 'cruiser', years: [2024] },

    // === Dual-Sport ===
    { model: 'KLX300', displacementCc: 292, type: 'adventure', years: [2021, 2022, 2023, 2024] },
    { model: 'KLX250', displacementCc: 249, type: 'adventure', years: [2018, 2019, 2020] },
    { model: 'KLX230 S', displacementCc: 233, type: 'adventure', years: [2022, 2023, 2024] },

    // === Scooters ===
    { model: 'J300', displacementCc: 299, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021] },
    { model: 'J125', displacementCc: 125, type: 'scooter', years: [2016, 2017, 2018, 2019, 2020, 2021] },
  ]
};

// Función para generar las motocicletas desde los datos
function generateMotorcycles() {
  const motorcycles = [];
  const seen = new Set(); // Para rastrear combinaciones únicas

  const brand = 'Kawasaki';
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
  if (cc <= 300) return 'bajo_cc';
  if (cc <= 700) return 'mediano_cc';
  return 'alto_cc';
}

// Función para sembrar la base de datos
async function seedMotorcycles() {
  try {
    const motorcycles = generateMotorcycles();
    console.log(`📊 Generados ${motorcycles.length} registros de motocicletas Kawasaki`);

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