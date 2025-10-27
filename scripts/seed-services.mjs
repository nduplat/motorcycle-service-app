import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  writeBatch,
  getDocs,
  Timestamp,
  doc,
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

console.log('================================================================');
console.log('🔧 INICIANDO SCRIPT DE GENERACIÓN MASIVA DE SERVICIOS PROFESIONALES');
console.log('================================================================');

// --- FUNCIONES AUXILIARES ---
async function deleteAllDocuments(collectionName) {
  console.log(`🗑️  Limpiando la colección: ${collectionName}...`);
  const collectionRef = collection(db, collectionName);
  const querySnapshot = await getDocs(collectionRef);
  if (querySnapshot.empty) {
    console.log(`✅ Colección ${collectionName} ya está vacía.`);
    return 0;
  }
  const batchSize = 400;
  let deletedCount = 0;
  for (let i = 0; i < querySnapshot.docs.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = querySnapshot.docs.slice(i, i + batchSize);
    chunk.forEach(docSnapshot => batch.delete(docSnapshot.ref));
    await batch.commit();
    deletedCount += chunk.length;
  }
  console.log(`✅  ${deletedCount} documentos eliminados de ${collectionName}.`);
  return deletedCount;
}

// --- DATOS MAESTROS ---

// Tarifas de mano de obra por tipo de servicio (COP por hora)
const LABOR_RATES = {
  mantenimiento: 35000,    // Servicios preventivos
  reparacion: 45000,       // Reparaciones complejas
  inspeccion: 40000,       // Diagnósticos e inspecciones
  customizacion: 38000     // Trabajos de customización
};

// Marcas y modelos de motocicletas (basado en el script anterior)
const MOTORCYCLE_BRANDS = [
  'Yamaha', 'KTM', 'BMW', 'Honda', 'Kawasaki', 'Suzuki', 'Triumph', 'Royal Enfield', 'TVS', 'Bajaj'
];

// --- PLANTILLAS DE SERVICIOS PROFESIONALES ---

const SERVICE_TEMPLATES = {
  // Servicios de Mantenimiento Preventivo
  mantenimiento: [
    {
      code: 'MANT-001',
      title: 'Cambio de Aceite y Filtros',
      description: 'Cambio completo de aceite de motor, filtro de aceite y filtro de aire. Incluye verificación de niveles y estado general.',
      type: 'maintenance',
      estimatedHours: 1.5,
      baseLaborCost: 67500, // 45,000 COP/hora x 1.5 horas
      partsSuggested: [
        { category: 'Aceites y Fluidos', description: 'Aceite de motor sintético', qty: 3.5, estimatedCost: 180000 },
        { category: 'Filtros', description: 'Filtro de aceite', qty: 1, estimatedCost: 35000 },
        { category: 'Filtros', description: 'Filtro de aire', qty: 1, estimatedCost: 95000 }
      ],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      notificationDays: 30,
      frequencyKm: 5000,
      frequencyMonths: 6
    },
    {
      code: 'MANT-002',
      title: 'Revisión General 10,000 Km',
      description: 'Revisión completa del vehículo cada 10,000 km. Incluye frenos, suspensión, luces, fluidos y sistema eléctrico.',
      type: 'maintenance',
      estimatedHours: 3.0,
      baseLaborCost: 135000,
      partsSuggested: [
        { category: 'Aceites y Fluidos', description: 'Aceite de motor sintético', qty: 3.5, estimatedCost: 180000 },
        { category: 'Filtros', description: 'Filtro de aceite', qty: 1, estimatedCost: 35000 },
        { category: 'Filtros', description: 'Filtro de aire', qty: 1, estimatedCost: 95000 },
        { category: 'Frenos', description: 'Pastillas de freno delantero', qty: 1, estimatedCost: 195000 }
      ],

      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      notificationDays: 30,
      frequencyKm: 10000,
      frequencyMonths: 12
    },
    {
      code: 'MANT-003',
      title: 'Cambio de Bujías',
      description: 'Reemplazo de bujías de encendido con verificación del sistema de encendido.',
      type: 'maintenance',
      estimatedHours: 1.0,
      baseLaborCost: 45000,
      partsSuggested: [
        { category: 'Baterías', description: 'Bujías de encendido', qty: 4, estimatedCost: 120000 }
      ],

      compatibleBrands: ['Yamaha', 'Honda', 'Kawasaki', 'Suzuki'],
      compatibleModels: ['Modelos con motor 4T'],
      notificationDays: 30,
      frequencyKm: 20000,
      frequencyMonths: 24
    },
    {
      code: 'MANT-004',
      title: 'Alineación y Balanceo de Ruedas',
      description: 'Alineación completa de la dirección y balanceo de ruedas para óptimo rendimiento y seguridad.',
      type: 'maintenance',
      estimatedHours: 2.0,
      baseLaborCost: 90000,
      partsSuggested: [
        { category: 'Llantas', description: 'Pesos de balanceo', qty: 4, estimatedCost: 20000 }
      ],

      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      notificationDays: 30,
      frequencyKm: 10000,
      frequencyMonths: 12
    },
    {
      code: 'MANT-005',
      title: 'Revisión de Frenos',
      description: 'Inspección completa del sistema de frenado, pastillas, discos y líquido de frenos.',
      type: 'maintenance',
      estimatedHours: 1.5,
      baseLaborCost: 67500,
      partsSuggested: [
        { category: 'Aceites y Fluidos', description: 'Líquido de frenos DOT 4', qty: 0.5, estimatedCost: 45000 }
      ],

      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      notificationDays: 30,
      frequencyKm: 5000,
      frequencyMonths: 6
    },
    {
      code: 'MANT-006',
      title: 'Cambio de Cadena de Distribución',
      description: 'Reemplazo completo de la cadena de distribución, tensor y guías. Incluye verificación de sincronización.',
      type: 'maintenance',
      estimatedHours: 4.0,
      baseLaborCost: 180000,
      partsSuggested: [
        { category: 'Kits de Arrastre', description: 'Kit de cadena de distribución', qty: 1, estimatedCost: 450000 },
        { category: 'Aceites y Fluidos', description: 'Aceite de motor sintético', qty: 4, estimatedCost: 200000 }
      ],
      compatibleBrands: ['Yamaha', 'Honda', 'Kawasaki'],
      compatibleModels: ['Modelos con cadena de distribución'],
      notificationDays: 30,
      frequencyKm: 80000,
      frequencyMonths: 60
    },
    {
      code: 'MANT-007',
      title: 'Revisión y Cambio de Batería',
      description: 'Inspección del estado de la batería y reemplazo si es necesario. Incluye carga y prueba.',
      type: 'maintenance',
      estimatedHours: 1.0,
      baseLaborCost: 45000,
      partsSuggested: [
        { category: 'Baterías', description: 'Batería de reemplazo', qty: 1, estimatedCost: 280000 }
      ],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      notificationDays: 30,
      frequencyKm: 30000,
      frequencyMonths: 24
    },
    {
      code: 'MANT-008',
      title: 'Limpieza de Inyectores',
      description: 'Limpieza química profunda de los inyectores de combustible para mejorar rendimiento y eficiencia.',
      type: 'maintenance',
      estimatedHours: 2.0,
      baseLaborCost: 90000,
      partsSuggested: [
        { category: 'Aceites y Fluidos', description: 'Limpiador de inyectores', qty: 1, estimatedCost: 85000 }
      ],
      compatibleBrands: ['Yamaha', 'Honda', 'Kawasaki', 'BMW', 'KTM'],
      compatibleModels: ['Modelos con inyección electrónica'],
      notificationDays: 30,
      frequencyKm: 15000,
      frequencyMonths: 12
    },
    {
      code: 'MANT-009',
      title: 'Cambio de Filtros de Combustible',
      description: 'Reemplazo del filtro de combustible y verificación del sistema de alimentación.',
      type: 'maintenance',
      estimatedHours: 1.0,
      baseLaborCost: 45000,
      partsSuggested: [
        { category: 'Filtros', description: 'Filtro de combustible', qty: 1, estimatedCost: 65000 }
      ],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      notificationDays: 30,
      frequencyKm: 20000,
      frequencyMonths: 24
    },
    {
      code: 'MANT-010',
      title: 'Revisión de Sistema de Escape',
      description: 'Inspección completa del sistema de escape, catalizador y silenciador.',
      type: 'maintenance',
      estimatedHours: 1.5,
      baseLaborCost: 67500,
      partsSuggested: [],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      notificationDays: 30,
      frequencyKm: 10000,
      frequencyMonths: 12
    }
  ],

  // Servicios de Reparación
  reparacion: [
    {
      code: 'REP-001',
      title: 'Reparación de Motor - Cilindro 1',
      description: 'Diagnóstico y reparación completa del cilindro 1, incluyendo válvulas, pistón y segmentos.',
      type: 'repair',
      estimatedHours: 8.0,
      baseLaborCost: 360000,
      partsSuggested: [
        { category: 'Kits de Arrastre', description: 'Kit de pistón completo', qty: 1, estimatedCost: 850000 },
        { category: 'Aceites y Fluidos', description: 'Aceite de motor sintético', qty: 4, estimatedCost: 200000 }
      ],

      compatibleBrands: ['Yamaha', 'Honda', 'Kawasaki'],
      compatibleModels: ['Modelos deportivos y touring'],
      severity: 'critical'
    },
    {
      code: 'REP-002',
      title: 'Reemplazo de Pastillas de Freno',
      description: 'Cambio completo de pastillas de freno delantero y trasero con verificación de discos.',
      type: 'repair',
      estimatedHours: 2.5,
      baseLaborCost: 112500,
      partsSuggested: [
        { category: 'Frenos', description: 'Kit de pastillas delantero', qty: 1, estimatedCost: 195000 },
        { category: 'Frenos', description: 'Kit de pastillas trasero', qty: 1, estimatedCost: 135000 },
        { category: 'Aceites y Fluidos', description: 'Líquido de frenos DOT 4', qty: 0.5, estimatedCost: 45000 }
      ],

      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      severity: 'high'
    },
    {
      code: 'REP-003',
      title: 'Reparación Sistema Eléctrico',
      description: 'Diagnóstico y reparación de fallas en el sistema eléctrico, incluyendo batería, alternador y sensores.',
      type: 'repair',
      estimatedHours: 4.0,
      baseLaborCost: 180000,
      partsSuggested: [
        { category: 'Baterías', description: 'Batería de reemplazo', qty: 1, estimatedCost: 280000 },
        { category: 'Baterías', description: 'Juego de cables', qty: 1, estimatedCost: 75000 }
      ],

      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      severity: 'high'
    },
    {
      code: 'REP-004',
      title: 'Cambio de Cadena y Piñones',
      description: 'Reemplazo completo de cadena, piñón de ataque y corona con ajuste de tensión.',
      type: 'repair',
      estimatedHours: 3.0,
      baseLaborCost: 135000,
      partsSuggested: [
        { category: 'Kits de Arrastre', description: 'Kit de cadena completo', qty: 1, estimatedCost: 480000 },
        { category: 'Aceites y Fluidos', description: 'Grasa para cadena', qty: 1, estimatedCost: 35000 }
      ],

      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Modelos con cadena'],
      severity: 'medium'
    },
    {
      code: 'REP-005',
      title: 'Reparación de Suspensión',
      description: 'Diagnóstico y reparación de amortiguadores, horquillas y componentes de suspensión.',
      type: 'repair',
      estimatedHours: 6.0,
      baseLaborCost: 270000,
      partsSuggested: [
        { category: 'Llantas', description: 'Amortiguador trasero', qty: 1, estimatedCost: 450000 },
        { category: 'Llantas', description: 'Juego de resortes', qty: 1, estimatedCost: 120000 }
      ],

      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      severity: 'high'
    },
    {
      code: 'REP-006',
      title: 'Reparación de Embrague',
      description: 'Diagnóstico y reparación completa del sistema de embrague, incluyendo disco, plato y cable.',
      type: 'repair',
      estimatedHours: 4.0,
      baseLaborCost: 180000,
      partsSuggested: [
        { category: 'Kits de Arrastre', description: 'Kit de embrague completo', qty: 1, estimatedCost: 350000 },
        { category: 'Aceites y Fluidos', description: 'Aceite de embrague', qty: 0.5, estimatedCost: 60000 }
      ],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Modelos con embrague manual'],
      severity: 'high'
    },
    {
      code: 'REP-007',
      title: 'Cambio de Discos de Freno',
      description: 'Reemplazo de discos de freno delantero y trasero con verificación del sistema ABS.',
      type: 'repair',
      estimatedHours: 3.0,
      baseLaborCost: 135000,
      partsSuggested: [
        { category: 'Frenos', description: 'Disco de freno delantero', qty: 1, estimatedCost: 250000 },
        { category: 'Frenos', description: 'Disco de freno trasero', qty: 1, estimatedCost: 180000 }
      ],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      severity: 'medium'
    },
    {
      code: 'REP-008',
      title: 'Reparación de Alternador',
      description: 'Diagnóstico y reparación del alternador y sistema de carga eléctrica.',
      type: 'repair',
      estimatedHours: 3.5,
      baseLaborCost: 157500,
      partsSuggested: [
        { category: 'Baterías', description: 'Alternador de reemplazo', qty: 1, estimatedCost: 400000 },
        { category: 'Baterías', description: 'Rectificador/regulador', qty: 1, estimatedCost: 150000 }
      ],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      severity: 'high'
    },
    {
      code: 'REP-009',
      title: 'Cambio de Radiador',
      description: 'Reemplazo del radiador de enfriamiento con verificación del sistema de refrigeración.',
      type: 'repair',
      estimatedHours: 2.5,
      baseLaborCost: 112500,
      partsSuggested: [
        { category: 'Aceites y Fluidos', description: 'Radiador de enfriamiento', qty: 1, estimatedCost: 300000 },
        { category: 'Aceites y Fluidos', description: 'Líquido refrigerante', qty: 2, estimatedCost: 80000 }
      ],
      compatibleBrands: ['Yamaha', 'Honda', 'Kawasaki', 'BMW'],
      compatibleModels: ['Modelos con enfriamiento líquido'],
      severity: 'medium'
    },
    {
      code: 'REP-010',
      title: 'Reparación de Transmisión',
      description: 'Diagnóstico y reparación de la caja de cambios y sistema de transmisión.',
      type: 'repair',
      estimatedHours: 8.0,
      baseLaborCost: 360000,
      partsSuggested: [
        { category: 'Kits de Arrastre', description: 'Kit de transmisión', qty: 1, estimatedCost: 750000 },
        { category: 'Aceites y Fluidos', description: 'Aceite de transmisión', qty: 1, estimatedCost: 120000 }
      ],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Modelos con transmisión manual'],
      severity: 'critical'
    }
  ],

  // Servicios de Inspección
  inspeccion: [
    {
      code: 'INS-001',
      title: 'Inspección Pre-Compra',
      description: 'Inspección completa del vehículo para compra. Incluye verificación mecánica, eléctrica y estructural.',
      type: 'inspection',
      estimatedHours: 4.0,
      baseLaborCost: 180000,
      partsSuggested: [],

      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      inspectionType: 'pre-purchase'
    },
    {
      code: 'INS-002',
      title: 'Inspección de Seguridad Vial',
      description: 'Verificación completa de todos los sistemas de seguridad: frenos, luces, suspensión y dirección.',
      type: 'inspection',
      estimatedHours: 2.0,
      baseLaborCost: 90000,
      partsSuggested: [],

      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      inspectionType: 'safety'
    },
    {
      code: 'INS-003',
      title: 'Diagnóstico por Escáner',
      description: 'Diagnóstico electrónico completo usando equipo especializado para identificar códigos de falla.',
      type: 'inspection',
      estimatedHours: 1.0,
      baseLaborCost: 45000,
      partsSuggested: [],

      compatibleBrands: ['Yamaha', 'Honda', 'Kawasaki', 'BMW', 'KTM'],
      compatibleModels: ['Modelos con inyección electrónica'],
      inspectionType: 'diagnostic'
    },
    {
      code: 'INS-004',
      title: 'Inspección de Emisiones',
      description: 'Medición y verificación de emisiones contaminantes según normas ambientales.',
      type: 'inspection',
      estimatedHours: 1.5,
      baseLaborCost: 67500,
      partsSuggested: [],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      inspectionType: 'emissions'
    },
    {
      code: 'INS-005',
      title: 'Inspección Anual Obligatoria',
      description: 'Inspección técnica vehicular obligatoria anual según requerimientos legales.',
      type: 'inspection',
      estimatedHours: 3.0,
      baseLaborCost: 135000,
      partsSuggested: [],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      inspectionType: 'mandatory'
    },
    {
      code: 'INS-006',
      title: 'Diagnóstico de Motor Completo',
      description: 'Análisis exhaustivo del rendimiento del motor, compresión y sistemas auxiliares.',
      type: 'inspection',
      estimatedHours: 2.5,
      baseLaborCost: 112500,
      partsSuggested: [],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      inspectionType: 'engine-diagnostic'
    }
  ],

  // Servicios de Customización
  customizacion: [
    {
      code: 'CUST-001',
      title: 'Instalación de Escape Deportivo',
      description: 'Instalación de sistema de escape deportivo completo con reprogramación de ECU si es necesario.',
      type: 'customization',
      estimatedHours: 3.0,
      baseLaborCost: 135000,
      partsSuggested: [
        { category: 'Llantas', description: 'Sistema de escape completo', qty: 1, estimatedCost: 850000 }
      ],

      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Modelos deportivos'],
      customizationType: 'performance'
    },
    {
      code: 'CUST-002',
      title: 'Instalación de Luces LED',
      description: 'Reemplazo completo del sistema de iluminación por LEDs de alto rendimiento.',
      type: 'customization',
      estimatedHours: 2.0,
      baseLaborCost: 90000,
      partsSuggested: [
        { category: 'Baterías', description: 'Kit de luces LED completo', qty: 1, estimatedCost: 350000 }
      ],

      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      customizationType: 'aesthetics'
    },
    {
      code: 'CUST-003',
      title: 'Instalación de Parabrisas',
      description: 'Instalación de parabrisas aerodinámico con ajuste personalizado.',
      type: 'customization',
      estimatedHours: 1.5,
      baseLaborCost: 67500,
      partsSuggested: [
        { category: 'Llantas', description: 'Parabrisas deportivo', qty: 1, estimatedCost: 180000 }
      ],

      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Modelos touring y naked'],
      customizationType: 'comfort'
    },
    {
      code: 'CUST-004',
      title: 'Instalación de Sistema de Audio',
      description: 'Instalación de sistema de audio completo con altavoces y amplificador.',
      type: 'customization',
      estimatedHours: 4.0,
      baseLaborCost: 180000,
      partsSuggested: [
        { category: 'Baterías', description: 'Kit de audio completo', qty: 1, estimatedCost: 500000 }
      ],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Modelos touring y custom'],
      customizationType: 'entertainment'
    },
    {
      code: 'CUST-005',
      title: 'Pintura Personalizada',
      description: 'Pintura completa de la motocicleta con diseño personalizado.',
      type: 'customization',
      estimatedHours: 20.0,
      baseLaborCost: 900000,
      partsSuggested: [
        { category: 'Llantas', description: 'Pintura especializada', qty: 1, estimatedCost: 1500000 }
      ],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Todos los modelos'],
      customizationType: 'aesthetics'
    },
    {
      code: 'CUST-006',
      title: 'Instalación de GPS',
      description: 'Instalación y configuración de sistema de navegación GPS.',
      type: 'customization',
      estimatedHours: 2.0,
      baseLaborCost: 90000,
      partsSuggested: [
        { category: 'Baterías', description: 'Sistema GPS completo', qty: 1, estimatedCost: 400000 }
      ],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Modelos touring'],
      customizationType: 'navigation'
    },
    {
      code: 'CUST-007',
      title: 'Modificación de Suspensión',
      description: 'Ajuste y modificación de la suspensión para mejor rendimiento.',
      type: 'customization',
      estimatedHours: 6.0,
      baseLaborCost: 270000,
      partsSuggested: [
        { category: 'Llantas', description: 'Kit de suspensión deportiva', qty: 1, estimatedCost: 800000 }
      ],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Modelos deportivos'],
      customizationType: 'performance'
    },
    {
      code: 'CUST-008',
      title: 'Instalación de Maletas Laterales',
      description: 'Instalación de sistema de maletas laterales con soportes reforzados.',
      type: 'customization',
      estimatedHours: 3.0,
      baseLaborCost: 135000,
      partsSuggested: [
        { category: 'Llantas', description: 'Kit de maletas completo', qty: 1, estimatedCost: 600000 }
      ],
      compatibleBrands: MOTORCYCLE_BRANDS,
      compatibleModels: ['Modelos touring y adventure'],
      customizationType: 'utility'
    }
  ]
};

// --- FUNCIÓN DE GENERACIÓN PRINCIPAL ---
function generateServices() {
  const services = [];

  // Generar servicios por categoría
  Object.keys(SERVICE_TEMPLATES).forEach(category => {
    SERVICE_TEMPLATES[category].forEach(template => {
      const service = {
        ...template,
        id: template.code.toLowerCase(),
        price: template.baseLaborCost, // Precio base es el costo de mano de obra
        taxPercent: 19, // IVA Colombia
        isActive: true,
        createdAt: now,
        updatedAt: now
      };

      // Calcular precio total estimado (mano de obra + partes)
      const partsCost = template.partsSuggested.reduce((total, part) => total + (part.estimatedCost || 0), 0);
      service.totalEstimatedPrice = template.baseLaborCost + partsCost;

      services.push(service);
    });
  });

  return services;
}

// --- FUNCIÓN PARA CALCULAR COSTO DE MANO DE OBRA ---
function calculateLaborCost(serviceType, estimatedHours) {
  const hourlyRate = LABOR_RATES[serviceType] || LABOR_RATES.mantenimiento;
  return Math.round(hourlyRate * estimatedHours);
}

// --- FUNCIÓN PARA GENERAR PERFILES DE TÉCNICOS ---
function generateTechnicianProfiles() {
  return [
    {
      name: 'Carlos Rodríguez',
      hourlyRate: 45000,
      experience: 'Senior',
      specialties: ['Reparaciones', 'Mantenimiento'],
      certifications: ['ASE Certified', 'Yamaha Master Technician'],
      isActive: true,
      createdAt: now,
      updatedAt: now
    },
    {
      name: 'María González',
      hourlyRate: 42000,
      experience: 'Mid-level',
      specialties: ['Inspecciones', 'Diagnóstico'],
      certifications: ['Honda Certified', 'Electrical Systems'],
      isActive: true,
      createdAt: now,
      updatedAt: now
    },
    {
      name: 'Juan Pérez',
      hourlyRate: 38000,
      experience: 'Junior',
      specialties: ['Customización', 'Mantenimiento Básico'],
      certifications: ['Basic Motorcycle Repair'],
      isActive: true,
      createdAt: now,
      updatedAt: now
    },
    {
      name: 'Ana López',
      hourlyRate: 48000,
      experience: 'Expert',
      specialties: ['Reparaciones Avanzadas', 'Suspensión', 'Motor'],
      certifications: ['BMW Master Technician', 'KTM Expert'],
      isActive: true,
      createdAt: now,
      updatedAt: now
    },
    {
      name: 'Roberto Martínez',
      hourlyRate: 40000,
      experience: 'Mid-level',
      specialties: ['Frenos', 'Eléctrico', 'Inspecciones'],
      certifications: ['Brake Systems Specialist'],
      isActive: true,
      createdAt: now,
      updatedAt: now
    }
  ];
}

// --- LÓGICA PRINCIPAL DEL SCRIPT ---
async function seedServicesDatabase() {
  try {
    // 1. LIMPIAR COLECCIONES
    await deleteAllDocuments('services');
    await deleteAllDocuments('technician_profiles');

    // 2. GENERAR Y CREAR SERVICIOS
    console.log('🔧 Generando catálogo de servicios profesionales...');
    const services = generateServices();
    console.log(`💡 Catálogo generado con ${services.length} servicios.`);

    console.log('⏳ Creando servicios en la base de datos...');
    const serviceBatch = writeBatch(db);
    services.forEach(service => {
      const serviceRef = doc(collection(db, 'services'));
      serviceBatch.set(serviceRef, service);
    });
    await serviceBatch.commit();
    console.log(`✅ ${services.length} servicios creados.`);

    // 3. CREAR PERFILES DE TÉCNICOS
    console.log('👷 Creando perfiles de técnicos...');
    const technicianProfiles = generateTechnicianProfiles();
    const techBatch = writeBatch(db);
    technicianProfiles.forEach(profile => {
      const profileRef = doc(collection(db, 'technician_profiles'));
      techBatch.set(profileRef, profile);
    });
    await techBatch.commit();
    console.log(`✅ ${technicianProfiles.length} perfiles de técnicos creados.`);

    // 4. RESUMEN FINAL
    console.log('\n🎉 =================================================== 🎉');
    console.log('    CATÁLOGO DE SERVICIOS PROFESIONALES CREADO');
    console.log('🎉 =================================================== 🎉\n');

    console.log('📊 RESUMEN DE SERVICIOS:');
    console.log(`   - Servicios de Mantenimiento: ${SERVICE_TEMPLATES.mantenimiento.length}`);
    console.log(`   - Servicios de Reparación: ${SERVICE_TEMPLATES.reparacion.length}`);
    console.log(`   - Servicios de Inspección: ${SERVICE_TEMPLATES.inspeccion.length}`);
    console.log(`   - Servicios de Customización: ${SERVICE_TEMPLATES.customizacion.length}`);
    console.log(`   - Total de Servicios: ${services.length}`);

    console.log('\n👷 PERFILES DE TÉCNICOS:');
    technicianProfiles.forEach(profile => {
      console.log(`   - ${profile.name}: $${profile.hourlyRate.toLocaleString()} COP/hora (${profile.experience})`);
    });

    console.log('\n💰 EJEMPLOS DE COSTOS DE SERVICIOS:');
    services.slice(0, 5).forEach(service => {
      console.log(`   - ${service.title}: $${service.price.toLocaleString()} COP (mano de obra) + $${(service.totalEstimatedPrice - service.price).toLocaleString()} COP (partes) = $${service.totalEstimatedPrice.toLocaleString()} COP total`);
    });

    console.log('\nTu taller ahora tiene un catálogo completo de servicios profesionales con precios realistas.');

  } catch (error) {
    console.error('❌ FATAL: El proceso de seeding de servicios falló:', error);
    process.exit(1);
  }
}

// --- EJECUTAR EL SCRIPT ---
seedServicesDatabase().then(() => {
  console.log('\n✅ Script de servicios finalizado.');
  process.exit(0);
});