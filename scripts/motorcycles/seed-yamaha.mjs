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

console.log('🏍️ Iniciando el sembrado de la base de datos de motocicletas Yamaha...');

const motorcycleData = {
  'Yamaha': [
    // === Scooters ===
    { model: 'TMAX', displacementCc: 560, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'XMAX 300', displacementCc: 292, type: 'scooter', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'XMAX 125', displacementCc: 125, type: 'scooter', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'NMAX 155', displacementCc: 155, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'NMAX 125', displacementCc: 125, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'D\'elight 125', displacementCc: 125, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Tricity 300', displacementCc: 292, type: 'scooter', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'Tricity 125', displacementCc: 125, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Aerox 155', displacementCc: 155, type: 'scooter', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Zuma 125', displacementCc: 125, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Vino 50', displacementCc: 49, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Cygnus Ray ZR', displacementCc: 125, type: 'scooter', years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Fascino 125', displacementCc: 125, type: 'scooter', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },

    // === Hyper Naked (MT Series) ===
    { model: 'MT-10', displacementCc: 998, type: 'naked', years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'MT-10 SP', displacementCc: 998, type: 'naked', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'MT-09', displacementCc: 890, type: 'naked', years: [2021, 2022, 2023, 2024] },
    { model: 'MT-09 (previous gen)', displacementCc: 847, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020] },
    { model: 'MT-09 SP', displacementCc: 890, type: 'naked', years: [2021, 2022, 2023, 2024] },
    { model: 'MT-07', displacementCc: 689, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'MT-03', displacementCc: 321, type: 'naked', years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'MT-125', displacementCc: 125, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'MT-15', displacementCc: 155, type: 'naked', years: [2019, 2020, 2021, 2022, 2023, 2024] },

    // === Supersport (R-Series) ===
    { model: 'YZF-R1M', displacementCc: 998, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'YZF-R1', displacementCc: 998, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'YZF-R7', displacementCc: 689, type: 'racing', years: [2022, 2023, 2024] },
    { model: 'YZF-R6', displacementCc: 599, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] }, // Note: Became track-only after 2020 in some markets
    { model: 'YZF-R3', displacementCc: 321, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'YZF-R125', displacementCc: 125, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'YZF-R15', displacementCc: 155, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },

    // === Sport Heritage ===
    { model: 'XSR900', displacementCc: 890, type: 'naked', years: [2022, 2023, 2024] },
    { model: 'XSR900 (previous gen)', displacementCc: 847, type: 'naked', years: [2016, 2017, 2018, 2019, 2020, 2021] },
    { model: 'XSR700', displacementCc: 689, type: 'naked', years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'XSR155', displacementCc: 155, type: 'naked', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'SCR950', displacementCc: 942, type: 'cruiser', years: [2017, 2018, 2019, 2020] },
    { model: 'SR400', displacementCc: 399, type: 'naked', years: [2015, 2016, 2017, 2018] },
    { model: 'VMAX', displacementCc: 1679, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020] },

    // === Adventure / Touring ===
    { model: 'Super Ténéré ES', displacementCc: 1199, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Ténéré 700', displacementCc: 689, type: 'adventure', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Ténéré 700 World Raid', displacementCc: 689, type: 'adventure', years: [2022, 2023, 2024] },
    { model: 'Tracer 9 GT+', displacementCc: 890, type: 'touring', years: [2023, 2024] },
    { model: 'Tracer 9 GT', displacementCc: 890, type: 'touring', years: [2021, 2022, 2023, 2024] },
    { model: 'Tracer 9', displacementCc: 890, type: 'touring', years: [2021, 2022] },
    { model: 'Tracer 7 GT', displacementCc: 689, type: 'touring', years: [2021, 2022, 2023, 2024] },
    { model: 'Tracer 7', displacementCc: 689, type: 'touring', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'FJR1300ES', displacementCc: 1298, type: 'touring', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022] },
    { model: 'Niken GT', displacementCc: 847, type: 'touring', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    
    // === Cruiser (Star Line) ===
    { model: 'Bolt R-Spec', displacementCc: 942, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'V Star 250', displacementCc: 249, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'V Star 650 Custom', displacementCc: 649, type: 'cruiser', years: [2015, 2016, 2017] },
    { model: 'V Star 950 Tourer', displacementCc: 942, type: 'cruiser', years: [2015, 2016, 2017] },
    { model: 'V Star 1300 Deluxe', displacementCc: 1304, type: 'cruiser', years: [2015, 2016, 2017] },
    { model: 'Stryker', displacementCc: 1304, type: 'cruiser', years: [2015, 2016, 2017] },
    { model: 'Raider', displacementCc: 1854, type: 'cruiser', years: [2015, 2016, 2017] },

    // === Dual Sport / Off-Road ===
    { model: 'WR450F', displacementCc: 450, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'WR250F', displacementCc: 250, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'XT250', displacementCc: 249, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'TW200', displacementCc: 196, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    
    // === Standard / FZ Series ===
    { model: 'FZ-09', displacementCc: 847, type: 'naked', years: [2015, 2016, 2017] }, // Rebranded to MT-09
    { model: 'FZ-07', displacementCc: 689, type: 'naked', years: [2015, 2016, 2017] }, // Rebranded to MT-07
    { model: 'FZ6R', displacementCc: 600, type: 'racing', years: [2015, 2016, 2017] },
    { model: 'FZ1', displacementCc: 998, type: 'naked', years: [2015] },
    { model: 'FZ 25', displacementCc: 249, type: 'naked', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'FZS-FI', displacementCc: 149, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
  ]
};

// Función para generar las motocicletas desde los datos
function generateMotorcycles() {
  const motorcycles = [];
  const seen = new Set(); // Para rastrear combinaciones únicas

  const brand = 'Yamaha';
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
    console.log(`📊 Generados ${motorcycles.length} registros de motocicletas Yamaha`);

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