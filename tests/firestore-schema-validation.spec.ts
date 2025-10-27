import * as admin from 'firebase-admin';
import { FirestoreSchemaValidator } from '../src/utils/firestore-schema-validator';

// Initialize Firebase Admin SDK for tests
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'test-project'
  });
}

describe('Firestore Schema Validation', () => {
  let db: admin.firestore.Firestore;
  let validator: FirestoreSchemaValidator;

  beforeEach(() => {
    db = admin.firestore();
    validator = new FirestoreSchemaValidator(db);
  });

  afterEach(async () => {
    // Clean up test data
    await cleanupTestCollections();
  });

  describe('Collection Schemas', () => {
    describe('Users Collection', () => {
      it('should validate user document structure', async () => {
        const userData = {
          uid: 'user123',
          email: 'test@example.com',
          displayName: 'Test User',
          role: 'customer',
          active: true,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        };

        const isValid = await validator.validateDocument('users', userData);
        expect(isValid).toBe(true);
      });

      it('should reject invalid user document', async () => {
        const invalidUserData = {
          email: 'test@example.com',
          // Missing required fields: uid, role, etc.
        };

        const isValid = await validator.validateDocument('users', invalidUserData);
        expect(isValid).toBe(false);
      });

      it('should validate user role enum values', async () => {
        const validRoles = ['customer', 'technician', 'manager', 'admin'];
        const invalidRoles = ['superuser', 'guest', ''];

        for (const role of validRoles) {
          const userData = {
            uid: 'user123',
            email: 'test@example.com',
            role,
            active: true,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
          };
          const isValid = await validator.validateDocument('users', userData);
          expect(isValid).toBe(true);
        }

        for (const role of invalidRoles) {
          const userData = {
            uid: 'user123',
            email: 'test@example.com',
            role,
            active: true,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
          };
          const isValid = await validator.validateDocument('users', userData);
          expect(isValid).toBe(false);
        }
      });
    });

    describe('Queue Entries Collection', () => {
      it('should validate queue entry document structure', async () => {
        const queueEntryData = {
          customerId: 'customer123',
          serviceType: 'appointment',
          status: 'waiting',
          position: 1,
          joinedAt: admin.firestore.Timestamp.now(),
          estimatedWaitTime: 30,
          verificationCode: '1234',
          expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)),
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        };

        const isValid = await validator.validateDocument('queueEntries', queueEntryData);
        expect(isValid).toBe(true);
      });

      it('should validate queue status transitions', async () => {
        const validStatuses = ['waiting', 'called', 'served', 'cancelled', 'no_show'];
        const invalidStatuses = ['pending', 'completed', 'in_progress'];

        for (const status of validStatuses) {
          const queueEntryData = {
            customerId: 'customer123',
            serviceType: 'appointment',
            status,
            position: 1,
            joinedAt: admin.firestore.Timestamp.now(),
            estimatedWaitTime: 30,
            verificationCode: '1234',
            expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)),
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
          };
          const isValid = await validator.validateDocument('queueEntries', queueEntryData);
          expect(isValid).toBe(true);
        }

        for (const status of invalidStatuses) {
          const queueEntryData = {
            customerId: 'customer123',
            serviceType: 'appointment',
            status,
            position: 1,
            joinedAt: admin.firestore.Timestamp.now(),
            estimatedWaitTime: 30,
            verificationCode: '1234',
            expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)),
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
          };
          const isValid = await validator.validateDocument('queueEntries', queueEntryData);
          expect(isValid).toBe(false);
        }
      });
    });

    describe('Work Orders Collection', () => {
      it('should validate work order document structure', async () => {
        const workOrderData = {
          number: 'WO001',
          clientId: 'customer123',
          vehicleId: 'vehicle123',
          status: 'open',
          priority: 'medium',
          description: 'Oil change and general inspection',
          assignedTo: 'technician123',
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
          estimatedDuration: 60,
          totalPrice: 150000
        };

        const isValid = await validator.validateDocument('workOrders', workOrderData);
        expect(isValid).toBe(true);
      });

      it('should validate work order status transitions', async () => {
        const validStatuses = ['open', 'in_progress', 'ready_for_pickup', 'delivered', 'cancelled'];
        const invalidStatuses = ['pending', 'completed', 'waiting'];

        for (const status of validStatuses) {
          const workOrderData = {
            number: 'WO001',
            clientId: 'customer123',
            vehicleId: 'vehicle123',
            status,
            priority: 'medium',
            description: 'Service description',
            assignedTo: 'technician123',
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            estimatedDuration: 60,
            totalPrice: 150000
          };
          const isValid = await validator.validateDocument('workOrders', workOrderData);
          expect(isValid).toBe(true);
        }

        for (const status of invalidStatuses) {
          const workOrderData = {
            number: 'WO001',
            clientId: 'customer123',
            vehicleId: 'vehicle123',
            status,
            priority: 'medium',
            description: 'Service description',
            assignedTo: 'technician123',
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            estimatedDuration: 60,
            totalPrice: 150000
          };
          const isValid = await validator.validateDocument('workOrders', workOrderData);
          expect(isValid).toBe(false);
        }
      });
    });

    describe('Products Collection', () => {
      it('should validate product document structure', async () => {
        const productData = {
          name: 'Motor Oil 10W40',
          sku: 'OIL-10W40',
          description: 'High quality synthetic motor oil',
          categoryId: 'category123',
          brand: 'Motul',
          price: 45000,
          cost: 30000,
          stock: 50,
          minStock: 10,
          isActive: true,
          compatibility: ['Honda CBR', 'Yamaha R1'],
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        };

        const isValid = await validator.validateDocument('products', productData);
        expect(isValid).toBe(true);
      });

      it('should validate product stock levels', async () => {
        const productData = {
          name: 'Test Product',
          sku: 'TEST-001',
          categoryId: 'category123',
          price: 10000,
          stock: 5,
          minStock: 10,
          isActive: true,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        };

        const isValid = await validator.validateDocument('products', productData);
        expect(isValid).toBe(true);

        // Test low stock alert trigger
        const lowStockAlert = await validator.checkLowStockAlert(productData);
        expect(lowStockAlert).toBe(true);
      });
    });

    describe('Appointments Collection', () => {
      it('should validate appointment document structure', async () => {
        const appointmentData = {
          number: 'APT001',
          clientId: 'customer123',
          vehicleId: 'vehicle123',
          scheduledAt: admin.firestore.Timestamp.now(),
          status: 'scheduled',
          estimatedDuration: 60,
          assignedTo: 'technician123',
          notes: 'Regular maintenance',
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        };

        const isValid = await validator.validateDocument('appointments', appointmentData);
        expect(isValid).toBe(true);
      });

      it('should validate appointment status values', async () => {
        const validStatuses = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
        const invalidStatuses = ['pending', 'approved', 'finished'];

        for (const status of validStatuses) {
          const appointmentData = {
            number: 'APT001',
            clientId: 'customer123',
            vehicleId: 'vehicle123',
            scheduledAt: admin.firestore.Timestamp.now(),
            status,
            estimatedDuration: 60,
            assignedTo: 'technician123',
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
          };
          const isValid = await validator.validateDocument('appointments', appointmentData);
          expect(isValid).toBe(true);
        }

        for (const status of invalidStatuses) {
          const appointmentData = {
            number: 'APT001',
            clientId: 'customer123',
            vehicleId: 'vehicle123',
            scheduledAt: admin.firestore.Timestamp.now(),
            status,
            estimatedDuration: 60,
            assignedTo: 'technician123',
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
          };
          const isValid = await validator.validateDocument('appointments', appointmentData);
          expect(isValid).toBe(false);
        }
      });
    });
  });

  describe('Index Validation', () => {
    it('should validate required indexes exist', async () => {
      const requiredIndexes = [
        { collection: 'products', fields: ['isActive', 'categoryId'] },
        { collection: 'products', fields: ['isActive', 'brand'] },
        { collection: 'products', fields: ['stock', 'minStock'] },
        { collection: 'workOrders', fields: ['status', 'createdAt'] },
        { collection: 'users', fields: ['role', 'active'] },
        { collection: 'appointments', fields: ['scheduledAt', 'status'] },
        { collection: 'motorcycleAssignments', fields: ['userId', 'motorcycleId', 'status'] }
      ];

      for (const index of requiredIndexes) {
        const indexExists = await validator.validateIndexExists(index.collection, index.fields);
        expect(indexExists).toBe(true);
      }
    });

    it('should detect missing indexes', async () => {
      const missingIndex = { collection: 'testCollection', fields: ['field1', 'field2'] };
      const indexExists = await validator.validateIndexExists(missingIndex.collection, missingIndex.fields);
      expect(indexExists).toBe(false);
    });
  });

  describe('Data Integrity Checks', () => {
    it('should validate foreign key relationships', async () => {
      // Test work order references valid user
      const workOrderData = {
        number: 'WO001',
        clientId: 'nonexistent-user',
        vehicleId: 'vehicle123',
        status: 'open',
        priority: 'medium',
        description: 'Test work order',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      const hasValidReferences = await validator.validateForeignKeys(workOrderData, 'workOrders');
      expect(hasValidReferences).toBe(false);

      // Test with valid user reference
      workOrderData.clientId = 'valid-user-id';
      // Mock user exists
      jest.spyOn(validator as any, 'documentExists').mockResolvedValue(true);
      const hasValidReferencesValid = await validator.validateForeignKeys(workOrderData, 'workOrders');
      expect(hasValidReferencesValid).toBe(true);
    });

    it('should validate data types and constraints', async () => {
      const invalidData = {
        name: 123, // Should be string
        price: 'not-a-number', // Should be number
        stock: -5, // Should be non-negative
        createdAt: 'not-a-timestamp' // Should be Timestamp
      };

      const isValid = await validator.validateDataTypes(invalidData, 'products');
      expect(isValid).toBe(false);

      const validData = {
        name: 'Test Product',
        price: 10000,
        stock: 10,
        createdAt: admin.firestore.Timestamp.now()
      };

      const isValidCorrect = await validator.validateDataTypes(validData, 'products');
      expect(isValidCorrect).toBe(true);
    });

    it('should validate business rules', async () => {
      // Test work order cannot be assigned to inactive technician
      const workOrderData = {
        number: 'WO001',
        clientId: 'customer123',
        vehicleId: 'vehicle123',
        status: 'open',
        assignedTo: 'inactive-technician',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      const followsBusinessRules = await validator.validateBusinessRules(workOrderData, 'workOrders');
      expect(followsBusinessRules).toBe(false);

      // Test with active technician
      workOrderData.assignedTo = 'active-technician';
      jest.spyOn(validator as any, 'isTechnicianActive').mockResolvedValue(true);
      const followsBusinessRulesValid = await validator.validateBusinessRules(workOrderData, 'workOrders');
      expect(followsBusinessRulesValid).toBe(true);
    });
  });

  describe('Schema Migration Validation', () => {
    it('should validate schema changes are backward compatible', async () => {
      const oldSchema = {
        name: 'string',
        price: 'number',
        stock: 'number'
      };

      const newSchema = {
        name: 'string',
        price: 'number',
        stock: 'number',
        description: 'string' // New optional field
      };

      const isCompatible = validator.validateSchemaMigration(oldSchema, newSchema);
      expect(isCompatible).toBe(true);
    });

    it('should detect breaking schema changes', async () => {
      const oldSchema = {
        name: 'string',
        price: 'number'
      };

      const newSchema = {
        name: 'string',
        cost: 'number' // Renamed required field
      };

      const isCompatible = validator.validateSchemaMigration(oldSchema, newSchema);
      expect(isCompatible).toBe(false);
    });
  });

  describe('Performance Validation', () => {
    it('should validate query performance with indexes', async () => {
      const queryPatterns = [
        { collection: 'products', filters: { isActive: true, categoryId: 'cat1' } },
        { collection: 'workOrders', filters: { status: 'open', createdAt: { $gte: new Date() } } },
        { collection: 'users', filters: { role: 'technician', active: true } }
      ];

      for (const pattern of queryPatterns) {
        const isOptimized = await validator.validateQueryPerformance(pattern.collection, pattern.filters);
        expect(isOptimized).toBe(true);
      }
    });

    it('should detect unoptimized queries', async () => {
      const unoptimizedQuery = {
        collection: 'largeCollection',
        filters: { field1: 'value1', field2: 'value2' } // No index for this combination
      };

      const isOptimized = await validator.validateQueryPerformance(unoptimizedQuery.collection, unoptimizedQuery.filters);
      expect(isOptimized).toBe(false);
    });
  });

  async function cleanupTestCollections() {
    const collections = ['users', 'queueEntries', 'workOrders', 'products', 'appointments'];
    for (const collection of collections) {
      const snapshot = await db.collection(collection).get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  }
});