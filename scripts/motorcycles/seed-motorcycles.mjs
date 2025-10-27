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

console.log('🏍️ Iniciando el sembrado de la base de datos para múltiples marcas...');

const motorcycleData = {
  'BMW': [
    // Supersport
    { model: 'S 1000 RR', displacementCc: 999, type: 'racing', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'M 1000 RR', displacementCc: 999, type: 'racing', years: [2021, 2022, 2023, 2024] },
    // Naked
    { model: 'G 310 R', displacementCc: 313, type: 'naked', years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'F 900 R', displacementCc: 895, type: 'naked', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'S 1000 R', displacementCc: 999, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'M 1000 R', displacementCc: 999, type: 'naked', years: [2023, 2024] },
    { model: 'R 1250 R', displacementCc: 1254, type: 'naked', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    // Adventure (GS)
    { model: 'G 310 GS', displacementCc: 313, type: 'adventure', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'F 850 GS', displacementCc: 853, type: 'adventure', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'F 900 GS', displacementCc: 895, type: 'adventure', years: [2024] },
    { model: 'R 1250 GS Adventure', displacementCc: 1254, type: 'adventure', years: [2019, 2020, 2021, 2022, 2023] },
    { model: 'R 1250 GS', displacementCc: 1254, type: 'adventure', years: [2019, 2020, 2021, 2022, 2023] },
    { model: 'R 1300 GS', displacementCc: 1300, type: 'adventure', years: [2024] },
    // Touring
    { model: 'R 1250 RT', displacementCc: 1254, type: 'touring', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'K 1600 GT', displacementCc: 1649, type: 'touring', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'K 1600 GTL', displacementCc: 1649, type: 'touring', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'K 1600 B', displacementCc: 1649, type: 'touring', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    // Heritage
    { model: 'R nineT', displacementCc: 1170, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'R 18', displacementCc: 1802, type: 'cruiser', years: [2020, 2021, 2022, 2023, 2024] },
  ],

  'Ducati': [
    // Supersport
    { model: 'Panigale V4 R', displacementCc: 998, type: 'racing', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Panigale V4 S', displacementCc: 1103, type: 'racing', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Panigale V2', displacementCc: 955, type: 'racing', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'SuperSport 950', displacementCc: 937, type: 'racing', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    // Naked
    { model: 'Streetfighter V4 S', displacementCc: 1103, type: 'naked', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'Streetfighter V2', displacementCc: 955, type: 'naked', years: [2022, 2023, 2024] },
    { model: 'Monster', displacementCc: 937, type: 'naked', years: [2021, 2022, 2023, 2024] },
    { model: 'Monster 821', displacementCc: 821, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020] },
    { model: 'Diavel V4', displacementCc: 1158, type: 'cruiser', years: [2023, 2024] },
    { model: 'XDiavel', displacementCc: 1262, type: 'cruiser', years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    // Adventure
    { model: 'Multistrada V4 Rally', displacementCc: 1158, type: 'adventure', years: [2023, 2024] },
    { model: 'Multistrada V4 S', displacementCc: 1158, type: 'adventure', years: [2021, 2022, 2023, 2024] },
    { model: 'Multistrada V2 S', displacementCc: 937, type: 'adventure', years: [2022, 2023, 2024] },
    { model: 'DesertX', displacementCc: 937, type: 'adventure', years: [2022, 2023, 2024] },
    // Scrambler
    { model: 'Scrambler Icon', displacementCc: 803, type: 'naked', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Scrambler Nightshift', displacementCc: 803, type: 'naked', years: [2021, 2022, 2023, 2024] },
    { model: 'Scrambler 1100', displacementCc: 1079, type: 'naked', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
  ],

  'Triumph': [
    // Naked / Roadster
    { model: 'Speed Triple 1200 RR', displacementCc: 1160, type: 'racing', years: [2022, 2023, 2024] },
    { model: 'Speed Triple 1200 RS', displacementCc: 1160, type: 'naked', years: [2021, 2022, 2023, 2024] },
    { model: 'Street Triple 765 Moto2 Edition', displacementCc: 765, type: 'naked', years: [2023, 2024] },
    { model: 'Street Triple 765 RS', displacementCc: 765, type: 'naked', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Trident 660', displacementCc: 660, type: 'naked', years: [2021, 2022, 2023, 2024] },
    // Modern Classics
    { model: 'Bonneville T120', displacementCc: 1200, type: 'naked', years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Bonneville T100', displacementCc: 900, type: 'naked', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Speed Twin 1200', displacementCc: 1200, type: 'naked', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Scrambler 1200 XE', displacementCc: 1200, type: 'adventure', years: [2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Scrambler 900', displacementCc: 900, type: 'adventure', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Thruxton RS', displacementCc: 1200, type: 'naked', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'Bonneville Bobber', displacementCc: 1200, type: 'cruiser', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Bonneville Speedmaster', displacementCc: 1200, type: 'cruiser', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    // Adventure
    { model: 'Tiger 1200 Rally Explorer', displacementCc: 1160, type: 'adventure', years: [2022, 2023, 2024] },
    { model: 'Tiger 900 Rally Pro', displacementCc: 888, type: 'adventure', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'Tiger 850 Sport', displacementCc: 888, type: 'adventure', years: [2021, 2022, 2023, 2024] },
    { model: 'Tiger Sport 660', displacementCc: 660, type: 'touring', years: [2022, 2023, 2024] },
    // Cruiser
    { model: 'Rocket 3 R', displacementCc: 2458, type: 'cruiser', years: [2020, 2021, 2022, 2023, 2024] },
  ],

  'Royal Enfield': [
    { model: 'Interceptor 650', displacementCc: 648, type: 'naked', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Continental GT 650', displacementCc: 648, type: 'naked', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Super Meteor 650', displacementCc: 648, type: 'cruiser', years: [2023, 2024] },
    { model: 'Himalayan', displacementCc: 452, type: 'adventure', years: [2024] },
    { model: 'Himalayan (previous gen)', displacementCc: 411, type: 'adventure', years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023] },
    { model: 'Scram 411', displacementCc: 411, type: 'adventure', years: [2022, 2023, 2024] },
    { model: 'Classic 350', displacementCc: 349, type: 'cruiser', years: [2021, 2022, 2023, 2024] },
    { model: 'Classic 500', displacementCc: 499, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020] },
    { model: 'Meteor 350', displacementCc: 349, type: 'cruiser', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'Hunter 350', displacementCc: 349, type: 'naked', years: [2022, 2023, 2024] },
    { model: 'Bullet 350', displacementCc: 349, type: 'cruiser', years: [2023, 2024] },
  ],

  'Harley-Davidson': [
    // Sport
    { model: 'Sportster S', displacementCc: 1252, type: 'cruiser', years: [2021, 2022, 2023, 2024] },
    { model: 'Nightster', displacementCc: 975, type: 'cruiser', years: [2022, 2023, 2024] },
    { model: 'Iron 883', displacementCc: 883, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022] },
    { model: 'Forty-Eight', displacementCc: 1202, type: 'cruiser', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021] },
    // Cruiser
    { model: 'Street Bob 114', displacementCc: 1868, type: 'cruiser', years: [2021, 2022, 2023, 2024] },
    { model: 'Fat Bob 114', displacementCc: 1868, type: 'cruiser', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Fat Boy 114', displacementCc: 1868, type: 'cruiser', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Low Rider S', displacementCc: 1923, type: 'cruiser', years: [2020, 2021, 2022, 2023, 2024] },
    { model: 'Breakout 117', displacementCc: 1923, type: 'cruiser', years: [2023, 2024] },
    { model: 'Softail Standard', displacementCc: 1746, type: 'cruiser', years: [2020, 2021, 2022, 2023, 2024] },
    // Grand American Touring
    { model: 'Road King Special', displacementCc: 1868, type: 'touring', years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Street Glide', displacementCc: 1868, type: 'touring', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Road Glide', displacementCc: 1868, type: 'touring', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'Ultra Limited', displacementCc: 1868, type: 'touring', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    { model: 'CVO Road Glide', displacementCc: 1977, type: 'touring', years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
    // Adventure
    { model: 'Pan America 1250 Special', displacementCc: 1252, type: 'adventure', years: [2021, 2022, 2023, 2024] },
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

  for (const [brand, models] of Object.entries(motorcycleData)) {
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
  }

  return motorcycles;
}

// Función auxiliar para determinar la categoría por cilindrada
function getCategoryFromDisplacement(cc) {
  if (cc <= 400) return 'bajo_cc';
  if (cc <= 900) return 'mediano_cc';
  if (cc <= 1300) return 'alto_cc';
  return 'muy_alto_cc';
}

// Función para sembrar la base de datos
async function seedMotorcycles() {
  try {
    const motorcycles = generateMotorcycles();
    console.log(`📊 Generados ${motorcycles.length} registros de motocicletas`);

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

    // Resumen por marca
    const brandSummary = motorcycles.reduce((acc, moto) => {
      acc[moto.brand] = (acc[moto.brand] || 0) + 1;
      return acc;
    }, {});
    console.log('🏷️ Resumen por marca:');
    for (const [brand, count] of Object.entries(brandSummary)) {
      console.log(`   ${brand}: ${count} modelos`);
    }

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