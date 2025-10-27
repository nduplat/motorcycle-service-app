import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  writeBatch,
  doc,
  deleteDoc,
  getDocs,
  Timestamp,
} from 'firebase/firestore';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBYKHbMIs8EDeXYpffggpbhYW2lSRac8ro",
  authDomain: "bbddmm-387a7.firebaseapp.com",
  projectId: "bbddmm-387a7",
  storageBucket: "bbddmm-387a7.firebasestorage.app",
  messagingSenderId: "647494031256",
  appId: "1:647494031256:web:a7fa67efda4b85b1003ded"
};

// --- INICIALIZACIÓN ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const now = Timestamp.now();

console.log('🚀 INICIANDO SEED PROFESIONAL DE INVENTARIO DE LUBRICANTES...');

// --- FUNCIÓN DE LIMPIEZA ---
async function deleteAllDocuments(collectionName) {
  console.log(`🗑️  Eliminando todos los documentos de la colección: ${collectionName}...`);
  try {
    const collectionRef = collection(db, collectionName);
    const querySnapshot = await getDocs(collectionRef);
    const batch = writeBatch(db);
    querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`✅  ${querySnapshot.docs.length} documentos eliminados de ${collectionName}.`);
  } catch (error) {
    console.error(`❌ Error al limpiar la colección ${collectionName}:`, error);
    throw error;
  }
}

// --- DEFINICIÓN DE DATOS MAESTROS ---

// Categorías granulares para un filtrado eficiente
const categories = [
  { name: 'Aceites de Motor 4T', description: 'Lubricantes para motores de 4 tiempos.' },
  { name: 'Aceites de Motor 2T', description: 'Lubricantes para motores de 2 tiempos.' },
  { name: 'Aceites de Transmisión', description: 'Lubricantes para cajas de cambios y transmisiones.' },
  { name: 'Fluidos de Suspensión', description: 'Aceites hidráulicos para horquillas y amortiguadores.' },
  { name: 'Líquidos de Freno y Refrigerantes', description: 'Fluidos esenciales para el sistema de frenado y refrigeración.' },
  { name: 'Cuidado y Limpieza', description: 'Productos para mantenimiento de cadena, filtros y limpieza general.' },
];

// Un único proveedor centralizado
const mainSupplier = {
  name: 'Distribuidora MotoPartes Colombia S.A.S',
  contactName: 'Departamento de Ventas',
  phone: '+57 601 555 1234',
  email: 'pedidos@motopartescolombia.com',
  address: 'Parque Industrial Celta, Bodega 5, Funza, Cundinamarca',
  paymentTerms: '45d',
  taxId: 'NIT 900.123.456-7',
  createdAt: now,
  updatedAt: now,
};

// --- CATÁLOGO COMPLETO DE PRODUCTOS CON MODELO DE VARIANTES ---
const productsDataTemplate = [
  // ============================ MOTUL ============================
  {
    brand: 'Motul',
    name: 'Motul 300V Factory Line Road Racing',
    description: 'Aceite 100% sintético con tecnología ESTER Core®, desarrollado para equipos de competición. Máximo rendimiento y protección en las condiciones más extremas.',
    categoryKey: 'Aceites de Motor 4T',
    basePrice: 95000, // Precio base para la variante más común (1L)
    variants: [
      { name: '1L - 10W-40', sku: 'MOT-300V-10W40-1L', stock: 15, additionalPrice: 0, attributes: { capacity: '1L', viscosity: '10W-40', type: 'Sintético Ester' } },
      { name: '1L - 15W-50', sku: 'MOT-300V-15W50-1L', stock: 10, additionalPrice: 2000, attributes: { capacity: '1L', viscosity: '15W-50', type: 'Sintético Ester' } },
      { name: '4L - 10W-40', sku: 'MOT-300V-10W40-4L', stock: 5, additionalPrice: 275000, attributes: { capacity: '4L', viscosity: '10W-40', type: 'Sintético Ester' } },
    ],
  },
  {
    brand: 'Motul',
    name: 'Motul 7100 4T',
    description: 'Aceite 100% sintético con tecnología Ester para motocicletas de alto rendimiento. Excelente resistencia al cizallamiento para proteger motor y caja de cambios.',
    categoryKey: 'Aceites de Motor 4T',
    basePrice: 62000,
    variants: [
      { name: '1L - 10W-30', sku: 'MOT-7100-10W30-1L', stock: 30, additionalPrice: 0, attributes: { capacity: '1L', viscosity: '10W-30', type: 'Sintético Ester' } },
      { name: '1L - 10W-40', sku: 'MOT-7100-10W40-1L', stock: 50, additionalPrice: 0, attributes: { capacity: '1L', viscosity: '10W-40', type: 'Sintético Ester' } },
      { name: '1L - 20W-50', sku: 'MOT-7100-20W50-1L', stock: 40, additionalPrice: 1500, attributes: { capacity: '1L', viscosity: '20W-50', type: 'Sintético Ester' } },
      { name: '4L - 10W-40', sku: 'MOT-7100-10W40-4L', stock: 15, additionalPrice: 180000, attributes: { capacity: '4L', viscosity: '10W-40', type: 'Sintético Ester' } },
    ],
  },
  {
    brand: 'Motul',
    name: 'Motul 5100 4T',
    description: 'Aceite Technosynthese® (Semi-sintético) reforzado con base Ester. Formulado para una excelente protección antidesgaste y mayor vida útil del motor.',
    categoryKey: 'Aceites de Motor 4T',
    basePrice: 45000,
    variants: [
      { name: '1L - 10W-40', sku: 'MOT-5100-10W40-1L', stock: 80, additionalPrice: 0, attributes: { capacity: '1L', viscosity: '10W-40', type: 'Semi-sintético Ester' } },
      { name: '1L - 15W-50', sku: 'MOT-5100-15W50-1L', stock: 70, additionalPrice: 0, attributes: { capacity: '1L', viscosity: '15W-50', type: 'Semi-sintético Ester' } },
    ],
  },
   {
    brand: 'Motul',
    name: 'Motul 800 2T Factory Line',
    description: 'Lubricante 100% sintético para motores 2T de competición, desarrollado para los equipos de Grandes Premios. Usar con mezcla manual.',
    categoryKey: 'Aceites de Motor 2T',
    basePrice: 85000,
    variants: [
        { name: '1L - Off Road', sku: 'MOT-800-2T-OFF-1L', stock: 25, additionalPrice: 0, attributes: { capacity: '1L', use: 'Off-Road', type: 'Sintético Ester' } },
        { name: '1L - Road Racing', sku: 'MOT-800-2T-ROAD-1L', stock: 20, additionalPrice: 0, attributes: { capacity: '1L', use: 'Road Racing', type: 'Sintético Ester' } },
    ],
  },
  {
    brand: 'Motul',
    name: 'Motul C4 Chain Lube Factory Line',
    description: 'Lubricante de color blanco diseñado para cadenas de motocicletas de competición. Alta adherencia, reduce la fricción y aumenta la vida útil de la cadena.',
    categoryKey: 'Cuidado y Limpieza',
    basePrice: 52000,
    variants: [
        { name: 'Aerosol 400ml', sku: 'MOT-C4-CHAIN-400ML', stock: 60, additionalPrice: 0, attributes: { capacity: '400ml', type: 'Lubricante de Cadena' } }
    ],
  },
  {
    brand: 'Motul',
    name: 'Motul RBF 660 Factory Line',
    description: 'Líquido de frenos 100% sintético para sistemas de freno y embrague hidráulicos que exigen un rendimiento extremo. Punto de ebullición seco muy elevado (325°C).',
    categoryKey: 'Líquidos de Freno y Refrigerantes',
    basePrice: 75000,
    variants: [
        { name: '500ml', sku: 'MOT-RBF660-500ML', stock: 30, additionalPrice: 0, attributes: { capacity: '500ml', spec: 'DOT 4 Racing' } }
    ],
  },

  // ============================ CASTROL ============================
  {
    brand: 'Castrol',
    name: 'Castrol POWER1 Racing 4T',
    description: 'Aceite 100% sintético con Race Derived Technology, probado en condiciones extremas para ofrecer la máxima aceleración y rendimiento.',
    categoryKey: 'Aceites de Motor 4T',
    basePrice: 59000,
    variants: [
        { name: '946ml - 10W-40', sku: 'CAS-PWR1R-10W40-1Q', stock: 40, additionalPrice: 0, attributes: { capacity: '946ml', viscosity: '10W-40', type: 'Sintético' } },
        { name: '946ml - 10W-50', sku: 'CAS-PWR1R-10W50-1Q', stock: 35, additionalPrice: 1000, attributes: { capacity: '946ml', viscosity: '10W-50', type: 'Sintético' } },
    ]
  },
  {
    brand: 'Castrol',
    name: 'Castrol Actevo 4T',
    description: 'Aceite semi-sintético con moléculas Actibond™ que se adhieren a las partes críticas del motor, proporcionando protección continua desde el arranque.',
    categoryKey: 'Aceites de Motor 4T',
    basePrice: 33000,
    variants: [
        { name: '946ml - 20W-50', sku: 'CAS-ACT-20W50-1Q', stock: 120, additionalPrice: 0, attributes: { capacity: '946ml', viscosity: '20W-50', type: 'Semi-sintético' } },
        { name: '946ml - 10W-30', sku: 'CAS-ACT-10W30-1Q', stock: 50, additionalPrice: 0, attributes: { capacity: '946ml', viscosity: '10W-30', type: 'Semi-sintético' } },
    ]
  },

  // ============================ SHELL ============================
  {
    brand: 'Shell',
    name: 'Shell Advance Ultra 4T',
    description: 'Aceite 100% sintético con tecnología Shell PurePlus, que convierte el gas natural en un aceite base cristalino. Ofrece lo último en protección y rendimiento.',
    categoryKey: 'Aceites de Motor 4T',
    basePrice: 63000,
    variants: [
        { name: '1L - 10W-40', sku: 'SHL-ULTRA-10W40-1L', stock: 50, additionalPrice: 0, attributes: { capacity: '1L', viscosity: '10W-40', type: 'Sintético PurePlus' } },
        { name: '1L - 15W-50', sku: 'SHL-ULTRA-15W50-1L', stock: 45, additionalPrice: 1000, attributes: { capacity: '1L', viscosity: '15W-50', type: 'Sintético PurePlus' } },
    ]
  },
  {
    brand: 'Shell',
    name: 'Shell Advance AX7 4T',
    description: 'Aceite con base sintética que mejora el rendimiento en motocicletas de alto cilindraje, manteniendo el motor limpio y protegido.',
    categoryKey: 'Aceites de Motor 4T',
    basePrice: 46000,
    variants: [
        { name: '1L - 10W-40', sku: 'SHL-AX7-10W40-1L', stock: 90, additionalPrice: 0, attributes: { capacity: '1L', viscosity: '10W-40', type: 'Semi-sintético' } },
        { name: '1L - 15W-50', sku: 'SHL-AX7-15W50-1L', stock: 80, additionalPrice: 0, attributes: { capacity: '1L', viscosity: '15W-50', type: 'Semi-sintético' } },
    ]
  },
  
  // ============================ REPSOL ============================
  {
    brand: 'Repsol',
    name: 'Repsol Moto Racing HMEOC 4T',
    description: 'Lubricante 100% sintético de alto rendimiento, ideal para motores que cumplen la norma Euro. Optimiza el consumo de combustible y la protección.',
    categoryKey: 'Aceites de Motor 4T',
    basePrice: 61500,
    variants: [
        { name: '1L - 10W-30', sku: 'REP-RACE-10W30-1L', stock: 30, additionalPrice: 0, attributes: { capacity: '1L', viscosity: '10W-30', type: 'Sintético' } },
        { name: '1L - 10W-40', sku: 'REP-RACE-10W40-1L', stock: 40, additionalPrice: 0, attributes: { capacity: '1L', viscosity: '10W-40', type: 'Sintético' } },
    ]
  },

];

// --- LÓGICA PRINCIPAL DEL SCRIPT ---
async function seedDatabase() {
  try {
    // 1. LIMPIAR COLECCIONES EXISTENTES (en orden de dependencia inversa)
    await deleteAllDocuments('stockMovements');
    await deleteAllDocuments('products');
    await deleteAllDocuments('suppliers');
    await deleteAllDocuments('categories');

    // 2. CREAR CATEGORÍAS
    console.log('📂 Creando categorías...');
    const categoryRefs = {};
    for (const cat of categories) {
      const categoryDoc = { ...cat, createdAt: now, updatedAt: now };
      const docRef = await addDoc(collection(db, 'categories'), categoryDoc);
      categoryRefs[cat.name] = docRef.id;
    }
    console.log(`✅ ${categories.length} categorías creadas.`);

    // 3. CREAR EL PROVEEDOR ÚNICO
    console.log('🏢 Creando proveedor único...');
    const supplierRef = await addDoc(collection(db, 'suppliers'), mainSupplier);
    console.log(`✅ Proveedor '${mainSupplier.name}' creado.`);

    // 4. CREAR PRODUCTOS Y SUS VARIANTES
    console.log('🛢️  Procesando y creando productos con sus variantes...');
    const batchSize = 50; // Firestore recomienda lotes de hasta 500 operaciones. 50 es seguro.
    for (let i = 0; i < productsDataTemplate.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchProducts = productsDataTemplate.slice(i, i + batchSize);
      console.log(`📦  Preparando lote ${Math.floor(i / batchSize) + 1} con ${batchProducts.length} productos...`);

      for (const productTpl of batchProducts) {
        const productRef = doc(collection(db, 'products'));
        
        // Generar tags para búsqueda avanzada
        const tags = new Set();
        tags.add(productTpl.brand.toLowerCase());
        tags.add(productTpl.categoryKey.toLowerCase().replace(/ y /g, ' '));
        productTpl.name.toLowerCase().split(' ').forEach(t => tags.add(t));
        productTpl.variants.forEach(v => {
            if (v.attributes.viscosity) tags.add(v.attributes.viscosity.toLowerCase());
            if (v.attributes.type) tags.add(v.attributes.type.toLowerCase().split(' ')[0]);
        });
        
        const newProduct = {
          name: productTpl.name,
          brand: productTpl.brand,
          description: productTpl.description,
          categoryId: categoryRefs[productTpl.categoryKey],
          supplierIds: [supplierRef.id],
          basePrice: productTpl.basePrice,
          totalStock: productTpl.variants.reduce((sum, v) => sum + v.stock, 0),
          isActive: true,
          images: [], // Placeholder para futuras imágenes
          tags: Array.from(tags),
          variants: productTpl.variants,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(productRef, newProduct);
      }
      await batch.commit();
    }
    console.log(`✅ ${productsDataTemplate.length} productos con sus variantes han sido creados.`);
    
    // 5. RESUMEN FINAL
    console.log('\n🎉 =================================================== 🎉');
    console.log('    PROCESO DE SEEDING COMPLETADO EXITOSAMENTE');
    console.log('🎉 =================================================== 🎉\n');
    console.log('📊 RESUMEN:');
    console.log(`   - ${Object.keys(categoryRefs).length} Categorías creadas.`);
    console.log(`   - 1 Proveedor creado.`);
    console.log(`   - ${productsDataTemplate.length} Productos (con ${productsDataTemplate.reduce((p,c)=> p+c.variants.length, 0)} variantes) creados.`);
    console.log('\nℹ️  Nota: El inventario inicial se ha establecido directamente en cada variante del producto. Los movimientos de stock (`stockMovements`) deben ser generados por la lógica de tu aplicación (ej: al crear órdenes de compra, ventas, etc.).');

  } catch (error) {
    console.error('❌ FATAL: El proceso de seeding falló:', error);
    process.exit(1);
  }
}

// --- EJECUTAR EL SCRIPT ---
seedDatabase().then(() => {
  console.log('\n✅ Script finalizado.');
  process.exit(0);
});