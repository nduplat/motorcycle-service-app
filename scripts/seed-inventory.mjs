import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp, writeBatch, doc } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBYKHbMIs8EDeXYpffggpbhYW2lSRac8ro",
  authDomain: "bbddmm-387a7.firebaseapp.com",
  projectId: "bbddmm-387a7",
  storageBucket: "bbddmm-387a7.firebasestorage.app",
  messagingSenderId: "647494031256",
  appId: "1:647494031256:web:a7fa67efda4b85b1003ded"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('🚀 Starting inventory data seeding...');

// Helper function to create timestamps
const now = Timestamp.now();
const daysAgo = (days) => Timestamp.fromDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

// Categories data from SQL
const inventoryCategories = [
  {
    id: 'neumaticos',
    name: 'Neumáticos',
    slug: 'neumaticos',
    description: 'Componentes de neumáticos y llantas',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'frenos',
    name: 'Frenos',
    slug: 'frenos',
    description: 'Sistemas de frenado y accesorios',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'suspension',
    name: 'Suspensión',
    slug: 'suspension',
    description: 'Componentes de suspensión y amortiguación',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'transmision',
    name: 'Transmisión',
    slug: 'transmision',
    description: 'Partes del sistema de transmisión',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'iluminacion',
    name: 'Iluminación',
    slug: 'iluminacion',
    description: 'Luces y bombillas para vehículos',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'motor',
    name: 'Motor',
    slug: 'motor',
    description: 'Componentes del motor',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'escape',
    name: 'Escape',
    slug: 'escape',
    description: 'Sistema de escape y accesorios',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'accesorios-de-vestimenta',
    name: 'Accesorios de Vestimenta',
    slug: 'accesorios-de-vestimenta',
    description: 'Artículos de vestimenta y protección',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'herramientas',
    name: 'Herramientas',
    slug: 'herramientas',
    description: 'Herramientas y equipos de mantenimiento',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'electronica',
    name: 'Electrónica',
    slug: 'electronica',
    description: 'Dispositivos electrónicos y accesorios',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'llave',
    name: 'Llave',
    slug: 'llave',
    description: 'Llaves y sistemas de seguridad',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'accesorios-de-moto',
    name: 'Accesorios de Moto',
    slug: 'accesorios-de-moto',
    description: 'Accesorios para motos',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'tpms',
    name: 'TPMS',
    slug: 'tpms',
    description: 'Sistemas de monitoreo de presión de neumáticos',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'aceites',
    name: 'Aceites',
    slug: 'aceites',
    description: 'Aceites y lubricantes',
    createdAt: now,
    updatedAt: now
  }
];

// Suppliers data from brands (complete list)
const inventorySuppliers = [
  {
    id: 'supplier-aceite',
    name: 'Aceite',
    contactName: 'Proveedor de Aceites',
    phone: '+57 300 123 4567',
    email: 'contacto@aceite.com',
    address: 'No especificado',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-honda',
    name: 'Honda',
    contactName: 'Representante Honda',
    phone: '+57 301 234 5678',
    email: 'ventas@honda.com',
    address: 'Japón',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-yamaha',
    name: 'Yamaha',
    contactName: 'Representante Yamaha',
    phone: '+57 302 345 6789',
    email: 'ventas@yamaha.com',
    address: 'Japón',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-suzuki',
    name: 'Suzuki',
    contactName: 'Representante Suzuki',
    phone: '+57 303 456 7890',
    email: 'ventas@suzuki.com',
    address: 'Japón',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-kawasaki',
    name: 'Kawasaki',
    contactName: 'Representante Kawasaki',
    phone: '+57 304 567 8901',
    email: 'ventas@kawasaki.com',
    address: 'Japón',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-harley-davidson',
    name: 'Harley-Davidson',
    contactName: 'Representante Harley-Davidson',
    phone: '+57 305 678 9012',
    email: 'ventas@harley-davidson.com',
    address: 'Estados Unidos',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-bmw',
    name: 'BMW',
    contactName: 'Representante BMW',
    phone: '+57 306 789 0123',
    email: 'ventas@bmw.com',
    address: 'Alemania',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-ducati',
    name: 'Ducati',
    contactName: 'Representante Ducati',
    phone: '+57 307 890 1234',
    email: 'ventas@ducati.com',
    address: 'Italia',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-ktm',
    name: 'KTM',
    contactName: 'Representante KTM',
    phone: '+57 308 901 2345',
    email: 'ventas@ktm.com',
    address: 'Austria',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-triumph',
    name: 'Triumph',
    contactName: 'Representante Triumph',
    phone: '+57 309 012 3456',
    email: 'ventas@triumph.com',
    address: 'Reino Unido',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-aprilia',
    name: 'Aprilia',
    contactName: 'Representante Aprilia',
    phone: '+57 310 123 4567',
    email: 'ventas@aprilia.com',
    address: 'Italia',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-motul',
    name: 'Motul',
    contactName: 'Representante Motul',
    phone: '+57 311 234 5678',
    email: 'ventas@motul.com',
    address: 'Francia',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-michelin',
    name: 'Michelin',
    contactName: 'Representante Michelin',
    phone: '+57 312 345 6789',
    email: 'ventas@michelin.com',
    address: 'Francia',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-brembo',
    name: 'Brembo',
    contactName: 'Representante Brembo',
    phone: '+57 313 456 7890',
    email: 'ventas@brembo.com',
    address: 'Italia',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-ohlins',
    name: 'Ohlins',
    contactName: 'Representante Ohlins',
    phone: '+57 314 567 8901',
    email: 'ventas@ohlins.com',
    address: 'Suecia',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'supplier-shoei',
    name: 'Shoei',
    contactName: 'Representante Shoei',
    phone: '+57 315 678 9012',
    email: 'ventas@shoei.com',
    address: 'Japón',
    paymentTerms: '30d',
    taxId: 'N/A',
    createdAt: now,
    updatedAt: now
  }
];

// Products data from SQL (expanded version)
const inventoryProducts = [
  {
    id: 'led-economico',
    sku: 'LED-ECON-001',
    name: 'Led Economico',
    description: 'Bombilla led económico',
    categoryId: 'iluminacion',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 20000,
    sellingPrice: 30000,
    taxPercent: 19,
    stock: 50,
    minStock: 5,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'led-economico-h4-m4tc-cobac',
        name: 'H4-M4TC COBAC',
        sku: 'LED-ECON-H4-M4TC',
        stock: 25,
        additionalPrice: 0,
        attributes: { type: 'H4-M4TC COBAC' }
      },
      {
        id: 'led-economico-h4-m4tc-wy-cobac',
        name: 'H4-M4TC-WY COBAC',
        sku: 'LED-ECON-H4-M4TC-WY',
        stock: 25,
        additionalPrice: 0,
        attributes: { type: 'H4-M4TC-WY COBAC' }
      }
    ]
  },
  {
    id: 'super-led-3-max',
    sku: 'LED-3MAX-001',
    name: 'Super Led 3 Max',
    description: 'Bombilla Led 3Max',
    categoryId: 'iluminacion',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 60000,
    sellingPrice: 80000,
    taxPercent: 19,
    stock: 30,
    minStock: 3,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'alarm-disc-lock',
    sku: 'ALARM-DISC-001',
    name: 'Alarm Disc Lock',
    description: 'Alarma de seguridad anti robo',
    categoryId: 'llave',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 40000,
    sellingPrice: 58000,
    taxPercent: 19,
    stock: 20,
    minStock: 2,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'alarm-disc-lock-seguridad',
        name: 'Seguridad',
        sku: 'ALARM-DISC-SEG',
        stock: 20,
        additionalPrice: 0,
        attributes: { type: 'Seguridad' }
      }
    ]
  },
  {
    id: 'love-you-star',
    sku: 'DIREC-LYS-001',
    name: 'Love You Star',
    description: 'Direccionales con tapa',
    categoryId: 'iluminacion',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 20000,
    sellingPrice: 30000,
    taxPercent: 19,
    stock: 40,
    minStock: 4,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'love-you-star-direccionales',
        name: 'Direccionales',
        sku: 'DIREC-LYS-DIR',
        stock: 40,
        additionalPrice: 0,
        attributes: { type: 'Direccionales' }
      }
    ]
  },
  {
    id: 'bombilla-pequena',
    sku: 'BOMB-PAQ-001',
    name: 'Bombilla pequeña',
    description: 'Direccionales económicas',
    categoryId: 'iluminacion',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 12000,
    sellingPrice: 18000,
    taxPercent: 19,
    stock: 60,
    minStock: 6,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'bombilla-pequena-direccionales',
        name: 'Direccionales',
        sku: 'BOMB-PAQ-DIR',
        stock: 60,
        additionalPrice: 0,
        attributes: { type: 'Direccionales' }
      }
    ]
  },
  {
    id: 'grandes',
    sku: 'DIREC-GRD-001',
    name: 'Grandes',
    description: 'Direccionales por unidad',
    categoryId: 'iluminacion',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 15000,
    sellingPrice: 25000,
    taxPercent: 19,
    stock: 35,
    minStock: 3,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'stallion-led',
    sku: 'DIREC-STL-001',
    name: 'Stallion Led',
    description: 'Direccionales medianas led',
    categoryId: 'iluminacion',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 12000,
    sellingPrice: 18000,
    taxPercent: 19,
    stock: 45,
    minStock: 4,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'led-narva',
    sku: 'LED-NARVA-001',
    name: 'Led Narva',
    description: 'Bombilla led por unidad',
    categoryId: 'iluminacion',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 80000,
    sellingPrice: 110000,
    taxPercent: 19,
    stock: 25,
    minStock: 2,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'led-narva-cu',
        name: 'LED NARVA C/U',
        sku: 'LED-NARVA-CU',
        stock: 25,
        additionalPrice: 0,
        attributes: { type: 'LED NARVA C/U' }
      }
    ]
  },
  {
    id: 'motodafish',
    sku: 'DIREC-MDF-001',
    name: 'Motodafish',
    description: 'Direccionales con tapa',
    categoryId: 'iluminacion',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 24000,
    sellingPrice: 32000,
    taxPercent: 19,
    stock: 30,
    minStock: 3,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'motodafish-transparentes',
        name: 'Dirrecionales Transparentes',
        sku: 'DIREC-MDF-TRANS',
        stock: 15,
        additionalPrice: 0,
        attributes: { type: 'Transparentes' }
      },
      {
        id: 'motodafish-con-tapa',
        name: 'Direccionales con Tapa',
        sku: 'DIREC-MDF-TAPA',
        stock: 15,
        additionalPrice: 0,
        attributes: { type: 'Con Tapa' }
      }
    ]
  },
  {
    id: 'casco',
    sku: 'CASCO-FIBRA-001',
    name: 'Casco',
    description: 'Casco fibra',
    categoryId: 'accesorios-de-vestimenta',
    brand: 'Shoei',
    manufacturer: 'Shoei',
    purchasePrice: 250000,
    sellingPrice: 330000,
    taxPercent: 19,
    stock: 12,
    minStock: 1,
    suppliers: ['supplier-shoei'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'casco-fibra',
        name: 'Fibra',
        sku: 'CASCO-FIBRA',
        stock: 12,
        additionalPrice: 0,
        attributes: { type: 'Fibra' }
      }
    ]
  },
  {
    id: 'ejeas',
    sku: 'INTERCOM-EJEAS-001',
    name: 'Ejeas',
    description: 'Par de intercomunicador',
    categoryId: 'electronica',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 250000,
    sellingPrice: 350000,
    taxPercent: 19,
    stock: 8,
    minStock: 1,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'ejeas-intercomunicadores',
        name: 'Intercomunicadores',
        sku: 'INTERCOM-EJEAS',
        stock: 4,
        additionalPrice: 0,
        attributes: { type: 'Intercomunicadores' }
      },
      {
        id: 'ejeas-economicos',
        name: 'Intercomunicadores economicos',
        sku: 'INTERCOM-EJEAS-ECON',
        stock: 4,
        additionalPrice: -20000,
        attributes: { type: 'Económicos' }
      }
    ]
  },
  {
    id: 'v50',
    sku: 'INTERCOM-V50-001',
    name: 'V50',
    description: 'Intercomunicador',
    categoryId: 'electronica',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 55000,
    sellingPrice: 75000,
    taxPercent: 19,
    stock: 15,
    minStock: 2,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'v50-intercomunicador',
        name: 'Intercomunicador',
        sku: 'INTERCOM-V50',
        stock: 15,
        additionalPrice: 0,
        attributes: { type: 'Intercomunicador' }
      }
    ]
  },
  {
    id: 'helmet',
    sku: 'INTERCOM-HELMET-001',
    name: 'HELMET',
    description: 'Intercomunicador económico',
    categoryId: 'electronica',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 48000,
    sellingPrice: 68000,
    taxPercent: 19,
    stock: 18,
    minStock: 2,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'helmet-economico',
        name: 'Intercomunicador economico',
        sku: 'INTERCOM-HELMET-ECON',
        stock: 18,
        additionalPrice: 0,
        attributes: { type: 'Económico' }
      }
    ]
  },
  {
    id: 'ble-tpms',
    sku: 'TPMS-BLE-001',
    name: 'BLE TPMS',
    description: 'TPMS por Bluetooth',
    categoryId: 'tpms',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 90000,
    sellingPrice: 120000,
    taxPercent: 19,
    stock: 10,
    minStock: 1,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'ble-tpms-pantalla-completa',
        name: 'TPMS Pantalla Completa',
        sku: 'TPMS-BLE-PANTALLA',
        stock: 10,
        additionalPrice: 0,
        attributes: { type: 'Pantalla Completa' }
      }
    ]
  },
  {
    id: 'tpms',
    sku: 'TPMS-STD-001',
    name: 'TPMS',
    description: 'TMPS Pantalla completa',
    categoryId: 'tpms',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 135000,
    sellingPrice: 180000,
    taxPercent: 19,
    stock: 8,
    minStock: 1,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'tpms-bluetooth',
        name: 'TPMS Bluetooth',
        sku: 'TPMS-STD-BT',
        stock: 8,
        additionalPrice: 0,
        attributes: { type: 'Bluetooth' }
      }
    ]
  },
  {
    id: 'led-h7',
    sku: 'LED-H7-001',
    name: 'LED H7',
    description: 'Bombillo led H7',
    categoryId: 'iluminacion',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 120000,
    sellingPrice: 160000,
    taxPercent: 19,
    stock: 20,
    minStock: 2,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'led-h7-bombillo',
        name: 'Bombillo led H7',
        sku: 'LED-H7-BOMB',
        stock: 20,
        additionalPrice: 0,
        attributes: { type: 'Bombillo led H7' }
      }
    ]
  },
  {
    id: 'motul',
    sku: 'ACEITE-MOTUL-001',
    name: 'Motul',
    description: 'Aceite 7100 100% sintético',
    categoryId: 'aceites',
    brand: 'Motul',
    manufacturer: 'Motul',
    purchasePrice: 50000,
    sellingPrice: 63000,
    taxPercent: 19,
    stock: 25,
    minStock: 3,
    suppliers: ['supplier-motul'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'motul-10w40',
        name: 'Motul 10W-40',
        sku: 'ACEITE-MOTUL-10W40',
        stock: 25,
        additionalPrice: 0,
        attributes: { type: '10W-40' }
      }
    ]
  },
  {
    id: 'led',
    sku: 'LED-STD-001',
    name: 'LED',
    description: 'Bombillo Led por unidad',
    categoryId: 'iluminacion',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 20000,
    sellingPrice: 30000,
    taxPercent: 19,
    stock: 50,
    minStock: 5,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'led-ac-dc',
        name: 'AC/DC12C-60V',
        sku: 'LED-STD-ACDC',
        stock: 50,
        additionalPrice: 0,
        attributes: { type: 'AC/DC12C-60V' }
      }
    ]
  },
  {
    id: 'only-led',
    sku: 'ONLY-LED-001',
    name: 'ONLY LED',
    description: 'Bombillo led Max 3 SPECIAL',
    categoryId: 'iluminacion',
    brand: 'Honda',
    manufacturer: 'Honda',
    purchasePrice: 60000,
    sellingPrice: 80000,
    taxPercent: 19,
    stock: 30,
    minStock: 3,
    suppliers: ['supplier-honda'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'only-led-max3',
        name: 'MAX 3 SPECIAL LED',
        sku: 'ONLY-LED-MAX3',
        stock: 30,
        additionalPrice: 0,
        attributes: { type: 'MAX 3 SPECIAL LED' }
      }
    ]
  },
  {
    id: 'tubeless',
    sku: 'NEUMATICO-TUBELESS-001',
    name: 'Tubeless',
    description: 'Neumáticos',
    categoryId: 'neumaticos',
    brand: 'Michelin',
    manufacturer: 'Michelin',
    purchasePrice: 100000,
    sellingPrice: 150000,
    taxPercent: 19,
    stock: 20,
    minStock: 2,
    suppliers: ['supplier-michelin'],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    variants: [
      {
        id: 'tubeless-90-90-18',
        name: 'Llanta 90/90-18',
        sku: 'NEUMATICO-90-90-18',
        stock: 20,
        additionalPrice: 0,
        attributes: { size: '90/90-18' }
      }
    ]
  }
];

// Stock movements data
const inventoryStockMovements = [
  {
    id: 'sm-led-economico-1',
    productId: 'led-economico',
    variantId: 'led-economico-h4-m4tc-cobac',
    quantity: 25,
    type: 'purchase',
    referenceId: 'po-initial-stock',
    reason: 'Initial stock import',
    createdBy: 'admin-user-1',
    createdAt: daysAgo(30)
  },
  {
    id: 'sm-led-economico-2',
    productId: 'led-economico',
    variantId: 'led-economico-h4-m4tc-wy-cobac',
    quantity: 25,
    type: 'purchase',
    referenceId: 'po-initial-stock',
    reason: 'Initial stock import',
    createdBy: 'admin-user-1',
    createdAt: daysAgo(30)
  },
  {
    id: 'sm-alarm-disc-lock',
    productId: 'alarm-disc-lock',
    variantId: 'alarm-disc-lock-seguridad',
    quantity: 20,
    type: 'purchase',
    referenceId: 'po-initial-stock',
    reason: 'Initial stock import',
    createdBy: 'admin-user-1',
    createdAt: daysAgo(25)
  },
  {
    id: 'sm-motul',
    productId: 'motul',
    variantId: 'motul-10w40',
    quantity: 25,
    type: 'purchase',
    referenceId: 'po-initial-stock',
    reason: 'Initial stock import',
    createdBy: 'admin-user-1',
    createdAt: daysAgo(20)
  },
  {
    id: 'sm-casco',
    productId: 'casco',
    variantId: 'casco-fibra',
    quantity: 12,
    type: 'purchase',
    referenceId: 'po-initial-stock',
    reason: 'Initial stock import',
    createdBy: 'admin-user-1',
    createdAt: daysAgo(15)
  },
  {
    id: 'sm-tubeless',
    productId: 'tubeless',
    variantId: 'tubeless-90-90-18',
    quantity: 20,
    type: 'purchase',
    referenceId: 'po-initial-stock',
    reason: 'Initial stock import',
    createdBy: 'admin-user-1',
    createdAt: daysAgo(10)
  }
];

// Function to seed inventory data
async function seedInventoryData() {
  try {
    console.log('📂 Seeding inventory categories...');
    const categoryRefs = {};
    for (const category of inventoryCategories) {
      const docRef = await addDoc(collection(db, 'categories'), category);
      categoryRefs[category.id] = docRef.id;
      console.log(`✅ Created category: ${category.name}`);
    }

    console.log('🏢 Seeding inventory suppliers...');
    const supplierRefs = {};
    for (const supplier of inventorySuppliers) {
      const docRef = await addDoc(collection(db, 'suppliers'), supplier);
      supplierRefs[supplier.id] = docRef.id;
      console.log(`✅ Created supplier: ${supplier.name}`);
    }

    console.log('📦 Seeding inventory products...');
    const productRefs = {};
    for (const product of inventoryProducts) {
      const docRef = await addDoc(collection(db, 'products'), product);
      productRefs[product.id] = docRef.id;
      console.log(`✅ Created product: ${product.name}`);
    }

    console.log('📊 Seeding stock movements...');
    for (const movement of inventoryStockMovements) {
      await addDoc(collection(db, 'stockMovements'), movement);
      console.log(`✅ Created stock movement for product: ${movement.productId}`);
    }

    console.log('🎉 Inventory data seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - ${inventoryCategories.length} categories`);
    console.log(`   - ${inventorySuppliers.length} suppliers`);
    console.log(`   - ${inventoryProducts.length} products`);
    console.log(`   - ${inventoryStockMovements.length} stock movements`);

  } catch (error) {
    console.error('❌ Error seeding inventory data:', error);
    throw error;
  }
}

// Run the seeding
seedInventoryData().then(() => {
  console.log('✅ Inventory seeding process finished');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Inventory seeding failed:', error);
  process.exit(1);
});