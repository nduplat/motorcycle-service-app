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

console.log('🚀 Starting database seeding...');

// Helper function to create timestamps
const now = Timestamp.now();
const daysAgo = (days) => Timestamp.fromDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
const daysFromNow = (days) => Timestamp.fromDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

// Sample data arrays
const sampleUsers = [
  {
    id: 'admin-user-1',
    name: 'Admin User',
    email: 'admin@blued-motors.com',
    phone: '+57 300 123 4567',
    role: 'admin',
    active: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'tech-user-1',
    name: 'Carlos Rodriguez',
    email: 'carlos@blued-motors.com',
    phone: '+57 301 234 5678',
    role: 'technician',
    active: true,
    technicianProfile: {
      skills: ['electrical', 'brakes', 'engine'],
      hourlyRate: 25000,
      certifications: ['ASE Certified'],
      employmentStartAt: daysAgo(365)
    },
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'manager-user-1',
    name: 'Maria Gonzalez',
    email: 'maria@blued-motors.com',
    phone: '+57 302 345 6789',
    role: 'manager',
    active: true,
    createdAt: now,
    updatedAt: now
  }
];

const sampleCategories = [
  {
    id: 'cat-parts',
    name: 'Parts',
    description: 'Motorcycle parts and components',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'cat-accessories',
    name: 'Accessories',
    description: 'Motorcycle accessories and add-ons',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'cat-oil',
    name: 'Oil & Fluids',
    description: 'Engine oils and lubricants',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'cat-brakes',
    name: 'Brakes',
    description: 'Brake systems and components',
    createdAt: now,
    updatedAt: now
  }
];

const sampleSuppliers = [
  {
    id: 'sup-autopartes',
    name: 'Autopartes del Valle',
    contactName: 'Juan Perez',
    phone: '+57 604 567 8901',
    email: 'ventas@autopartesvalle.com',
    address: 'Calle 5 # 12-34, Cali, Colombia',
    paymentTerms: '30d',
    taxId: '901234567-8',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'sup-moto-parts',
    name: 'Moto Parts International',
    contactName: 'Ana Martinez',
    phone: '+57 601 678 9012',
    email: 'ana@moto-parts-int.com',
    address: 'Carrera 15 # 89-12, Bogotá, Colombia',
    paymentTerms: '15d',
    taxId: '812345678-9',
    createdAt: now,
    updatedAt: now
  }
];

const sampleProducts = [
  {
    id: 'prod-oil-10w40',
    sku: 'OIL-10W40-4L',
    name: 'Motor Oil 10W-40 4L',
    description: 'High quality synthetic motor oil for motorcycles',
    categoryId: 'cat-oil',
    brand: 'Castrol',
    manufacturer: 'Castrol Ltd',
    purchasePrice: 45000,
    sellingPrice: 65000,
    taxPercent: 19,
    stock: 25,
    minStock: 5,
    locationId: 'loc-warehouse-1',
    suppliers: ['sup-autopartes'],
    isActive: true,
    weightKg: 4.2,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'prod-brake-pad-front',
    sku: 'BP-FRT-HONDA',
    name: 'Front Brake Pads Honda CBR',
    description: 'High performance brake pads for Honda CBR models',
    categoryId: 'cat-brakes',
    brand: 'Brembo',
    manufacturer: 'Brembo S.p.A.',
    purchasePrice: 120000,
    sellingPrice: 180000,
    taxPercent: 19,
    stock: 15,
    minStock: 3,
    locationId: 'loc-warehouse-1',
    suppliers: ['sup-moto-parts'],
    compatibility: ['Honda CBR 250', 'Honda CBR 300', 'Honda CBR 500'],
    isActive: true,
    weightKg: 0.8,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'prod-chain-kit',
    sku: 'CHAIN-KIT-STD',
    name: 'Chain and Sprocket Kit',
    description: 'Complete chain and sprocket replacement kit',
    categoryId: 'cat-parts',
    brand: 'DID',
    manufacturer: 'Daido Kogyo Co.',
    purchasePrice: 85000,
    sellingPrice: 125000,
    taxPercent: 19,
    stock: 8,
    minStock: 2,
    locationId: 'loc-warehouse-1',
    suppliers: ['sup-autopartes'],
    isActive: true,
    weightKg: 2.5,
    createdAt: now,
    updatedAt: now
  }
];

const sampleMotorcycles = [
  {
    id: 'moto-honda-cbr250',
    brand: 'Honda',
    model: 'CBR 250R',
    year: 2023,
    displacementCc: 250
  },
  {
    id: 'moto-yamaha-r3',
    brand: 'Yamaha',
    model: 'YZF-R3',
    year: 2023,
    displacementCc: 321
  },
  {
    id: 'moto-kawasaki-ninja',
    brand: 'Kawasaki',
    model: 'Ninja 400',
    year: 2023,
    displacementCc: 399
  }
];

const sampleCustomers = [
  {
    id: 'cust-juan-perez',
    name: 'Juan Perez',
    documentType: 'CC',
    documentNumber: '12345678',
    email: 'juan.perez@email.com',
    phone: '+57 310 123 4567',
    addresses: [
      {
        label: 'Casa',
        address: 'Calle 10 # 5-20, Bogotá, Colombia'
      }
    ],
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'cust-maria-garcia',
    name: 'Maria Garcia',
    documentType: 'CC',
    documentNumber: '87654321',
    email: 'maria.garcia@email.com',
    phone: '+57 311 987 6543',
    addresses: [
      {
        label: 'Trabajo',
        address: 'Carrera 7 # 15-30, Medellín, Colombia'
      }
    ],
    createdAt: now,
    updatedAt: now
  }
];

const sampleVehicles = [
  {
    id: 'veh-juan-honda',
    ownerId: 'cust-juan-perez',
    brand: 'Honda',
    model: 'CBR 250R',
    year: 2022,
    displacementCc: 250,
    vin: 'JH2SC4512KK000001',
    plate: 'ABC123',
    mileageKm: 15000,
    fuelType: 'Gasoline',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'veh-maria-yamaha',
    ownerId: 'cust-maria-garcia',
    brand: 'Yamaha',
    model: 'YZF-R3',
    year: 2023,
    displacementCc: 321,
    vin: 'JYARN33E4PA000002',
    plate: 'XYZ789',
    mileageKm: 8500,
    fuelType: 'Gasoline',
    createdAt: now,
    updatedAt: now
  }
];

const sampleServiceItems = [
  {
    id: 'serv-oil-change',
    code: 'SVC-OIL-001',
    title: 'Cambio de Aceite Completo',
    description: 'Cambio de aceite del motor, filtro de aceite y revisión general',
    type: 'maintenance',
    estimatedHours: 1.5,
    price: 80000,
    partsSuggested: [
      { productId: 'prod-oil-10w40', qty: 1 }
    ],
    requiredSkills: ['engine'],
    taxPercent: 19,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'serv-brake-service',
    code: 'SVC-BRK-001',
    title: 'Servicio de Frenos Delanteros',
    description: 'Reemplazo de pastillas de freno delanteras y revisión del sistema',
    type: 'maintenance',
    estimatedHours: 2.0,
    price: 120000,
    partsSuggested: [
      { productId: 'prod-brake-pad-front', qty: 1 }
    ],
    requiredSkills: ['brakes'],
    taxPercent: 19,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'serv-chain-service',
    code: 'SVC-CHN-001',
    title: 'Servicio de Cadena',
    description: 'Limpieza, lubricación y ajuste de cadena y piñones',
    type: 'maintenance',
    estimatedHours: 1.0,
    price: 60000,
    partsSuggested: [
      { productId: 'prod-chain-kit', qty: 1 }
    ],
    requiredSkills: ['general'],
    taxPercent: 19,
    createdAt: now,
    updatedAt: now
  }
];

const sampleWorkOrders = [
  {
    id: 'wo-2025-0001',
    number: 'WO-2025-0001',
    customerId: 'cust-juan-perez',
    vehicleId: 'veh-juan-honda',
    status: 'completed',
    assignedTo: 'tech-user-1',
    services: [
      {
        serviceId: 'serv-oil-change',
        description: 'Cambio de aceite completo',
        hours: 1.5,
        price: 80000
      }
    ],
    parts: [
      {
        productId: 'prod-oil-10w40',
        qty: 1,
        unitPrice: 65000,
        taxPercent: 19
      }
    ],
    laborTotal: 120000,
    partsTotal: 65000,
    subtotal: 185000,
    taxTotal: 35150,
    total: 220150,
    estimatedDeliveryAt: daysAgo(5),
    actualDeliveryAt: daysAgo(5),
    createdAt: daysAgo(7),
    updatedAt: daysAgo(5)
  },
  {
    id: 'wo-2025-0002',
    number: 'WO-2025-0002',
    customerId: 'cust-maria-garcia',
    vehicleId: 'veh-maria-yamaha',
    status: 'in_progress',
    assignedTo: 'tech-user-1',
    services: [
      {
        serviceId: 'serv-brake-service',
        description: 'Servicio de frenos delanteros',
        hours: 2.0,
        price: 120000
      }
    ],
    parts: [
      {
        productId: 'prod-brake-pad-front',
        qty: 1,
        unitPrice: 180000,
        taxPercent: 19
      }
    ],
    laborTotal: 160000,
    partsTotal: 180000,
    subtotal: 340000,
    taxTotal: 64600,
    total: 404600,
    estimatedDeliveryAt: daysFromNow(2),
    createdAt: daysAgo(2),
    updatedAt: now
  }
];

const sampleStockMovements = [
  {
    id: 'sm-001',
    productId: 'prod-oil-10w40',
    quantity: 20,
    type: 'purchase',
    referenceId: 'po-001',
    reason: 'Initial stock purchase',
    createdBy: 'admin-user-1',
    createdAt: daysAgo(30)
  },
  {
    id: 'sm-002',
    productId: 'prod-oil-10w40',
    quantity: -1,
    type: 'sale',
    referenceId: 'wo-2025-0001',
    reason: 'Used in work order WO-2025-0001',
    createdBy: 'tech-user-1',
    createdAt: daysAgo(5)
  },
  {
    id: 'sm-003',
    productId: 'prod-brake-pad-front',
    quantity: 10,
    type: 'purchase',
    referenceId: 'po-002',
    reason: 'Restock brake pads',
    createdBy: 'admin-user-1',
    createdAt: daysAgo(15)
  }
];

const samplePurchaseOrders = [
  {
    id: 'po-001',
    supplierId: 'sup-autopartes',
    items: [
      {
        productId: 'prod-oil-10w40',
        qty: 20,
        unitCost: 45000,
        expectedDate: daysAgo(25)
      }
    ],
    status: 'received',
    totalEstimated: 900000,
    createdBy: 'admin-user-1',
    createdAt: daysAgo(35),
    updatedAt: daysAgo(30)
  },
  {
    id: 'po-002',
    supplierId: 'sup-moto-parts',
    items: [
      {
        productId: 'prod-brake-pad-front',
        qty: 10,
        unitCost: 120000,
        expectedDate: daysAgo(10)
      }
    ],
    status: 'received',
    totalEstimated: 1200000,
    createdBy: 'admin-user-1',
    createdAt: daysAgo(20),
    updatedAt: daysAgo(15)
  }
];

const sampleAppointments = [
  {
    id: 'apt-2025-0001',
    number: 'APT-2025-0001',
    customerId: 'cust-juan-perez',
    vehicleId: 'veh-juan-honda',
    scheduledAt: daysAgo(10),
    estimatedDuration: 90,
    status: 'completed',
    serviceTypes: ['Oil Change'],
    assignedTo: 'tech-user-1',
    workOrderId: 'wo-2025-0001',
    createdAt: daysAgo(12),
    updatedAt: daysAgo(10)
  },
  {
    id: 'apt-2025-0002',
    number: 'APT-2025-0002',
    customerId: 'cust-maria-garcia',
    vehicleId: 'veh-maria-yamaha',
    scheduledAt: daysFromNow(5),
    estimatedDuration: 120,
    status: 'scheduled',
    serviceTypes: ['Brake Service'],
    assignedTo: 'tech-user-1',
    createdAt: daysAgo(1),
    updatedAt: now
  }
];

const sampleNotifications = [
  {
    id: 'notif-001',
    title: 'Bienvenido a Blue Dragon Motors',
    message: 'Gracias por elegir nuestros servicios. Estamos aquí para mantener tu motocicleta en perfectas condiciones.',
    read: false,
    createdAt: now
  },
  {
    id: 'notif-002',
    userId: 'tech-user-1',
    title: 'Nueva Orden de Trabajo Asignada',
    message: 'Se te ha asignado la orden de trabajo WO-2025-0002 para servicio de frenos.',
    read: false,
    meta: {
      workOrderId: 'wo-2025-0002'
    },
    createdAt: daysAgo(2)
  }
];

const sampleEmployeeSchedules = [
  {
    id: 'sched-tech-user-1-today',
    employeeId: 'tech-user-1',
    date: now, // Today
    shifts: [
      {
        id: 'shift-1',
        name: 'Morning Shift',
        startTime: '08:00',
        endTime: '17:00',
        daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ],
    breaks: [
      {
        id: 'break-1',
        name: 'Lunch Break',
        durationMinutes: 60,
        startTime: '12:00',
        shiftConfigId: 'shift-1',
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ],
    timeBlocks: [],
    totalHours: 8,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'sched-tech-user-1-tomorrow',
    employeeId: 'tech-user-1',
    date: daysFromNow(1), // Tomorrow
    shifts: [
      {
        id: 'shift-2',
        name: 'Morning Shift',
        startTime: '08:00',
        endTime: '17:00',
        daysOfWeek: [1, 2, 3, 4, 5],
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ],
    breaks: [
      {
        id: 'break-2',
        name: 'Lunch Break',
        durationMinutes: 60,
        startTime: '12:00',
        shiftConfigId: 'shift-2',
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ],
    timeBlocks: [],
    totalHours: 8,
    createdAt: now,
    updatedAt: now
  }
];

const sampleAppSettings = {
  id: 'OuSOGRGQtVFyIXFG2eAC',
  companyName: 'Blue Dragon Motors',
  address: 'Carrera 58d #129b-19, Barrio Ciudad Jardín Norte, Bogotá, D.C., Colombia',
  phone: '+57 312 824 7162',
  email: 'info@blued-motors.com',
  taxRates: [
    { name: 'IVA', percent: 19 }
  ],
  currency: 'COP',
  invoicePrefix: 'INV',
  createdAt: now,
  updatedAt: now
};

const sampleRoleAssignments = {
  id: 'singleton',
  ownerEmails: [
    'sicfreddyquintero@gmail.com',
    'blued.motors@gmail.com',
    'nduplat@gmail.com'
  ],
  employeeEmails: [
    'employee1@example.com',
    'employee2@example.com'
  ],
  createdAt: now,
  updatedAt: now
};

// Function to seed data
async function seedData() {
  try {
    console.log('📝 Seeding users...');
    const userRefs = {};
    for (const user of sampleUsers) {
      const docRef = await addDoc(collection(db, 'users'), user);
      userRefs[user.id] = docRef.id;
      console.log(`✅ Created user: ${user.name}`);
    }

    console.log('📂 Seeding categories...');
    const categoryRefs = {};
    for (const category of sampleCategories) {
      const docRef = await addDoc(collection(db, 'categories'), category);
      categoryRefs[category.id] = docRef.id;
      console.log(`✅ Created category: ${category.name}`);
    }

    console.log('🏢 Seeding suppliers...');
    const supplierRefs = {};
    for (const supplier of sampleSuppliers) {
      const docRef = await addDoc(collection(db, 'suppliers'), supplier);
      supplierRefs[supplier.id] = docRef.id;
      console.log(`✅ Created supplier: ${supplier.name}`);
    }

    console.log('🏍️ Seeding motorcycles...');
    const motorcycleRefs = {};
    for (const motorcycle of sampleMotorcycles) {
      const docRef = await addDoc(collection(db, 'motorcycles'), motorcycle);
      motorcycleRefs[motorcycle.id] = docRef.id;
      console.log(`✅ Created motorcycle: ${motorcycle.brand} ${motorcycle.model}`);
    }

    console.log('📦 Seeding products...');
    const productRefs = {};
    for (const product of sampleProducts) {
      const docRef = await addDoc(collection(db, 'products'), product);
      productRefs[product.id] = docRef.id;
      console.log(`✅ Created product: ${product.name}`);
    }

    console.log('👥 Seeding customers...');
    const customerRefs = {};
    for (const customer of sampleCustomers) {
      const docRef = await addDoc(collection(db, 'customers'), customer);
      customerRefs[customer.id] = docRef.id;
      console.log(`✅ Created customer: ${customer.name}`);
    }

    console.log('🚗 Seeding vehicles...');
    const vehicleRefs = {};
    for (const vehicle of sampleVehicles) {
      const docRef = await addDoc(collection(db, 'vehicles'), vehicle);
      vehicleRefs[vehicle.id] = docRef.id;
      console.log(`✅ Created vehicle: ${vehicle.brand} ${vehicle.model} - ${vehicle.plate}`);
    }

    console.log('🔧 Seeding service items...');
    const serviceRefs = {};
    for (const service of sampleServiceItems) {
      const docRef = await addDoc(collection(db, 'services'), service);
      serviceRefs[service.id] = docRef.id;
      console.log(`✅ Created service: ${service.title}`);
    }

    console.log('📋 Seeding purchase orders...');
    const poRefs = {};
    for (const po of samplePurchaseOrders) {
      const docRef = await addDoc(collection(db, 'purchaseOrders'), po);
      poRefs[po.id] = docRef.id;
      console.log(`✅ Created purchase order: ${po.id}`);
    }

    console.log('📊 Seeding stock movements...');
    for (const movement of sampleStockMovements) {
      await addDoc(collection(db, 'stockMovements'), movement);
      console.log(`✅ Created stock movement for product: ${movement.productId}`);
    }

    console.log('📅 Seeding appointments...');
    const appointmentRefs = {};
    for (const appointment of sampleAppointments) {
      const docRef = await addDoc(collection(db, 'appointments'), appointment);
      appointmentRefs[appointment.id] = docRef.id;
      console.log(`✅ Created appointment: ${appointment.number}`);
    }

    console.log('🔨 Seeding work orders...');
    const woRefs = {};
    for (const wo of sampleWorkOrders) {
      const docRef = await addDoc(collection(db, 'workOrders'), wo);
      woRefs[wo.id] = docRef.id;
      console.log(`✅ Created work order: ${wo.number}`);
    }

    console.log('🔔 Seeding notifications...');
    for (const notification of sampleNotifications) {
      await addDoc(collection(db, 'notifications'), notification);
      console.log(`✅ Created notification: ${notification.title}`);
    }

    console.log('📅 Seeding employee schedules...');
    for (const schedule of sampleEmployeeSchedules) {
      await addDoc(collection(db, 'employeeSchedules'), schedule);
      console.log(`✅ Created employee schedule for: ${schedule.employeeId}`);
    }

    console.log('⚙️ Seeding app settings...');
    await addDoc(collection(db, 'appSettings'), sampleAppSettings);
    console.log('✅ Created app settings');

    console.log('🔐 Seeding role assignments...');
    await addDoc(collection(db, 'roleAssignments'), sampleRoleAssignments);
    console.log('✅ Created role assignments');

    console.log('🎉 Database seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - ${sampleUsers.length} users`);
    console.log(`   - ${sampleCategories.length} categories`);
    console.log(`   - ${sampleSuppliers.length} suppliers`);
    console.log(`   - ${sampleMotorcycles.length} motorcycles`);
    console.log(`   - ${sampleProducts.length} products`);
    console.log(`   - ${sampleCustomers.length} customers`);
    console.log(`   - ${sampleVehicles.length} vehicles`);
    console.log(`   - ${sampleServiceItems.length} service items`);
    console.log(`   - ${samplePurchaseOrders.length} purchase orders`);
    console.log(`   - ${sampleStockMovements.length} stock movements`);
    console.log(`   - ${sampleAppointments.length} appointments`);
    console.log(`   - ${sampleWorkOrders.length} work orders`);
    console.log(`   - ${sampleNotifications.length} notifications`);
    console.log(`   - ${sampleEmployeeSchedules.length} employee schedules`);
    console.log(`   - 1 app settings record`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Run the seeding
seedData().then(() => {
  console.log('✅ Seeding process finished');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});