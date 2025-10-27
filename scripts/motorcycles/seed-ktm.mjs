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

console.log('🏍️ Iniciando el sembrado de la base de datos de motocicletas KTM...');

const motorcycleData = {
  'KTM': [
    // === Naked / Duke Series ===
    { model: '1390 Super Duke R Evo', displacementCc: 1350, type: 'naked', years: [2024] },
    { model: '1290 Super Duke R Evo', displacementCc: 1301, type: 'naked', years: [2022, 2023] },
    { model: '1290 Super Duke R', displacementCc: 1301, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023] },
    { model: '990 Duke', displacementCc: 947, type: 'naked', years: [2024] },
    { model: '890 Duke R', displacementCc: 889, type: 'naked', years: [2020, 2021, 2022, 2023, 2024] },
    { model: '890 Duke GP', displacementCc: 889, type: 'naked', years: [2022, 2023] },
    { model: '790 Duke', displacementCc: 799, type: 'naked', years: [2018, 2019, 2020, 2023, 2024] },
    { model: '390 Duke', displacementCc: 399, type: 'naked', years: [2024] }, // New engine
    { model: '390 Duke (previous gen)', displacementCc: 373, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023] },
    { model: '250 Duke', displacementCc: 249, type: 'naked', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: '200 Duke', displacementCc: 199, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: '125 Duke', displacementCc: 124, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },

    // === Supersport / RC Series ===
    { model: 'RC 8C', displacementCc: 889, type: 'racing', years: [2022, 2023, 2024] }, // Track only
    { model: 'RC 390', displacementCc: 373, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'RC 200', displacementCc: 199, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'RC 125', displacementCc: 124, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },

    // === Adventure Series ===
    { model: '1290 Super Adventure S', displacementCc: 1301, type: 'adventure', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: '1290 Super Adventure R', displacementCc: 1301, type: 'adventure', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: '1190 Adventure', displacementCc: 1195, type: 'adventure', years: [2015, 2016] },
    { model: '1090 Adventure R', displacementCc: 1050, type: 'adventure', years: [2017, 2018, 2019] },
    { model: '890 Adventure R Rally', displacementCc: 889, type: 'adventure', years: [2021, 2023] },
    { model: '890 Adventure R', displacementCc: 889, type: 'adventure', years: [2021, 2022, 2023, 2024] },
    { model: '890 Adventure', displacementCc: 889, type: 'adventure', years: [2021, 2022, 2023, 2024] },
    { model: '790 Adventure', displacementCc: 799, type: 'adventure', years: [2019, 2020, 2023, 2024] },
    { model: '390 Adventure', displacementCc: 373, type: 'adventure', years: [2020, 2021, 2022, 2023, 2024] },
    { model: '250 Adventure', displacementCc: 248, type: 'adventure', years: [2020, 2021, 2022, 2023, 2024] },

    // === Supermoto / Enduro / Travel ===
    { model: '890 SMT', displacementCc: 889, type: 'touring', years: [2023, 2024] },
    { model: '690 SMC R', displacementCc: 693, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: '690 Enduro R', displacementCc: 693, type: 'adventure', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Freeride E-XC', displacementCc: 0, type: 'adventure', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] }, // Electric
  ]
};

// Función para generar las motocicletas desde los datos
function generateMotorcycles() {
  const motorcycles = [];
  const seen = new Set(); // Para rastrear combinaciones únicas

  const brand = 'KTM';
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
  if (cc === 0) return 'electrica';
  if (cc <= 250) return 'bajo_cc';
  if (cc <= 790) return 'mediano_cc';
  return 'alto_cc';
}

// Función para sembrar la base de datos
async function seedMotorcycles() {
  try {
    const motorcycles = generateMotorcycles();
    console.log(`📊 Generados ${motorcycles.length} registros de motocicletas KTM`);

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