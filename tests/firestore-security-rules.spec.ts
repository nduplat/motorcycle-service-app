import * as admin from 'firebase-admin';
import { FirestoreSecurityTester } from '../src/utils/firestore-security-tester';

// Initialize Firebase Admin SDK for tests
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'test-project'
  });
}

describe('Firestore Security Rules Tests', () => {
  let db: admin.firestore.Firestore;
  let securityTester: FirestoreSecurityTester;
  let testUsers: { [key: string]: any };

  beforeEach(() => {
    db = admin.firestore();
    securityTester = new FirestoreSecurityTester(db);

    // Setup test users with different roles
    testUsers = {
      customer: {
        uid: 'customer123',
        email: 'customer@test.com',
        role: 'customer',
        active: true
      },
      technician: {
        uid: 'tech123',
        email: 'tech@test.com',
        role: 'technician',
        active: true
      },
      // manager role removed
      admin: {
        uid: 'admin123',
        email: 'admin@test.com',
        role: 'admin',
        active: true
      },
      inactiveUser: {
        uid: 'inactive123',
        email: 'inactive@test.com',
        role: 'technician',
        active: false
      }
    };
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Authentication Requirements', () => {
    it('should deny access to unauthenticated users for protected collections', async () => {
      const collections = ['users', 'workOrders', 'appointments', 'queueEntries'];

      for (const collection of collections) {
        const canRead = await securityTester.testReadAccess(collection, null);
        expect(canRead).toBe(false);
      }
    });

    it('should allow public read access for catalog data', async () => {
      const publicCollections = ['products', 'services', 'categories', 'brands', 'motorcycles', 'workshopLocations'];

      for (const collection of publicCollections) {
        const canRead = await securityTester.testReadAccess(collection, null);
        expect(canRead).toBe(true);
      }
    });
  });

  describe('User Profile Access Control', () => {
    it('should allow users to read their own profile', async () => {
      const user = testUsers.customer;
      const canRead = await securityTester.testDocumentReadAccess('users', user.uid, user);
      expect(canRead).toBe(true);
    });

    it('should deny users from reading other users profiles', async () => {
      const user = testUsers.customer;
      const otherUserId = testUsers.technician.uid;
      const canRead = await securityTester.testDocumentReadAccess('users', otherUserId, user);
      expect(canRead).toBe(false);
    });

    it('should allow staff to read all user profiles', async () => {
      const staffRoles = ['technician', 'admin'];

      for (const role of staffRoles) {
        const user = testUsers[role];
        const targetUserId = testUsers.customer.uid;
        const canRead = await securityTester.testDocumentReadAccess('users', targetUserId, user);
        expect(canRead).toBe(true);
      }
    });

    it('should allow users to update limited fields of their own profile', async () => {
      const user = testUsers.customer;
      const updateData = {
        name: 'Updated Name',
        phone: '+1234567890',
        avatarUrl: 'new-avatar.jpg'
      };

      const canUpdate = await securityTester.testDocumentUpdateAccess('users', user.uid, updateData, user);
      expect(canUpdate).toBe(true);
    });

    it('should deny users from updating restricted fields', async () => {
      const user = testUsers.customer;
      const updateData = {
        role: 'admin', // Restricted field
        active: false
      };

      const canUpdate = await securityTester.testDocumentUpdateAccess('users', user.uid, updateData, user);
      expect(canUpdate).toBe(false);
    });

    it('should allow admins to update user roles (except other admins)', async () => {
      const admin = testUsers.admin;
      const targetUser = testUsers.technician;

      const updateData = { role: 'manager' };
      const canUpdate = await securityTester.testDocumentUpdateAccess('users', targetUser.uid, updateData, admin);
      expect(canUpdate).toBe(true);

      // Try to update another admin (should fail)
      const otherAdmin = { ...testUsers.admin, uid: 'other-admin-123' };
      const canUpdateAdmin = await securityTester.testDocumentUpdateAccess('users', otherAdmin.uid, { role: 'customer' }, admin);
      expect(canUpdateAdmin).toBe(false);
    });
  });

  describe('Work Orders Access Control', () => {
    it('should allow customers to read their own work orders', async () => {
      const customer = testUsers.customer;
      const workOrderData = {
        customerId: customer.uid,
        status: 'open',
        description: 'Test work order'
      };

      const canRead = await securityTester.testDocumentReadAccess('workOrders', 'wo123', customer, workOrderData);
      expect(canRead).toBe(true);
    });

    it('should deny customers from reading other customers work orders', async () => {
      const customer = testUsers.customer;
      const workOrderData = {
        customerId: 'other-customer-123', // Different customer
        status: 'open',
        description: 'Test work order'
      };

      const canRead = await securityTester.testDocumentReadAccess('workOrders', 'wo123', customer, workOrderData);
      expect(canRead).toBe(false);
    });

    it('should allow assigned technicians to read and update their work orders', async () => {
      const technician = testUsers.technician;
      const workOrderData = {
        customerId: 'customer123',
        assignedTo: technician.uid,
        status: 'in_progress',
        description: 'Test work order'
      };

      const canRead = await securityTester.testDocumentReadAccess('workOrders', 'wo123', technician, workOrderData);
      const canUpdate = await securityTester.testDocumentUpdateAccess('workOrders', 'wo123', { status: 'completed' }, technician, workOrderData);

      expect(canRead).toBe(true);
      expect(canUpdate).toBe(true);
    });

    it('should allow staff to read all work orders', async () => {
      const staffRoles = ['technician', 'admin'];

      for (const role of staffRoles) {
        const user = testUsers[role];
        const workOrderData = {
          customerId: 'customer123',
          status: 'open',
          description: 'Test work order'
        };

        const canRead = await securityTester.testDocumentReadAccess('workOrders', 'wo123', user, workOrderData);
        expect(canRead).toBe(true);
      }
    });

    it('should allow staff to create work orders', async () => {
      const staffRoles = ['technician', 'admin'];

      for (const role of staffRoles) {
        const user = testUsers[role];
        const workOrderData = {
          customerId: 'customer123',
          status: 'open',
          description: 'New work order'
        };

        const canCreate = await securityTester.testDocumentCreateAccess('workOrders', workOrderData, user);
        expect(canCreate).toBe(true);
      }
    });
  });

  describe('Queue Management Access Control', () => {
    it('should allow customers to read their own queue entries', async () => {
      const customer = testUsers.customer;
      const queueEntryData = {
        customerId: customer.uid,
        status: 'waiting',
        position: 1
      };

      const canRead = await securityTester.testDocumentReadAccess('queueEntries', 'qe123', customer, queueEntryData);
      expect(canRead).toBe(true);
    });

    it('should allow public read access for queue entries with valid verification codes', async () => {
      const queueEntryData = {
        customerId: 'customer123',
        status: 'waiting',
        position: 1,
        verificationCode: '1234',
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000)) // 10 minutes from now
      };

      // Test without authentication
      const canRead = await securityTester.testDocumentReadAccess('queueEntries', 'qe123', null, queueEntryData);
      expect(canRead).toBe(true);
    });

    it('should deny public read access for expired verification codes', async () => {
      const queueEntryData = {
        customerId: 'customer123',
        status: 'waiting',
        position: 1,
        verificationCode: '1234',
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 10 * 60 * 1000)) // 10 minutes ago
      };

      // Test without authentication
      const canRead = await securityTester.testDocumentReadAccess('queueEntries', 'qe123', null, queueEntryData);
      expect(canRead).toBe(false);
    });

    it('should allow staff to manage all queue entries', async () => {
      const staffRoles = ['technician', 'admin'];

      for (const role of staffRoles) {
        const user = testUsers[role];
        const queueEntryData = {
          customerId: 'customer123',
          status: 'waiting',
          position: 1
        };

        const canRead = await securityTester.testDocumentReadAccess('queueEntries', 'qe123', user, queueEntryData);
        const canWrite = await securityTester.testDocumentWriteAccess('queueEntries', 'qe123', { status: 'called' }, user, queueEntryData);

        expect(canRead).toBe(true);
        expect(canWrite).toBe(true);
      }
    });
  });

  describe('Notifications Access Control', () => {
    it('should allow users to read their own notifications', async () => {
      const user = testUsers.customer;
      const notificationData = {
        userId: user.uid,
        title: 'Test Notification',
        message: 'Test message',
        read: false
      };

      const canRead = await securityTester.testDocumentReadAccess('notifications', 'n123', user, notificationData);
      expect(canRead).toBe(true);
    });

    it('should deny users from reading other users notifications', async () => {
      const user = testUsers.customer;
      const notificationData = {
        userId: 'other-user-123',
        title: 'Test Notification',
        message: 'Test message',
        read: false
      };

      const canRead = await securityTester.testDocumentReadAccess('notifications', 'n123', user, notificationData);
      expect(canRead).toBe(false);
    });

    it('should allow users to mark their own notifications as read', async () => {
      const user = testUsers.customer;
      const notificationData = {
        userId: user.uid,
        title: 'Test Notification',
        message: 'Test message',
        read: false
      };
      const updateData = { read: true };

      const canUpdate = await securityTester.testDocumentUpdateAccess('notifications', 'n123', updateData, user, notificationData);
      expect(canUpdate).toBe(true);
    });

    it('should allow staff to create notifications', async () => {
      const staffRoles = ['technician', 'admin'];

      for (const role of staffRoles) {
        const user = testUsers[role];
        const notificationData = {
          userId: 'customer123',
          title: 'Service Update',
          message: 'Your service is ready',
          read: false
        };

        const canCreate = await securityTester.testDocumentCreateAccess('notifications', notificationData, user);
        expect(canCreate).toBe(true);
      }
    });
  });

  describe('Products and Inventory Access Control', () => {
    it('should allow public read access to products', async () => {
      const productData = {
        name: 'Test Product',
        sku: 'TEST001',
        price: 10000,
        stock: 50
      };

      // Test without authentication
      const canRead = await securityTester.testDocumentReadAccess('products', 'p123', null, productData);
      expect(canRead).toBe(true);
    });

    it('should allow only admins to modify products', async () => {
      const productData = {
        name: 'Test Product',
        sku: 'TEST001',
        price: 10000,
        stock: 50
      };
      const updateData = { price: 12000 };

      // Test with customer (should fail)
      const customer = testUsers.customer;
      const customerCanUpdate = await securityTester.testDocumentUpdateAccess('products', 'p123', updateData, customer, productData);
      expect(customerCanUpdate).toBe(false);

      // Test with admin (should succeed)
      const admin = testUsers.admin;
      const adminCanUpdate = await securityTester.testDocumentUpdateAccess('products', 'p123', updateData, admin, productData);
      expect(adminCanUpdate).toBe(true);
    });
  });

  describe('Motorcycle Assignments Access Control', () => {
    it('should allow users to read their own motorcycle assignments', async () => {
      const user = testUsers.customer;
      const assignmentData = {
        userId: user.uid,
        motorcycleId: 'motorcycle123',
        plate: 'ABC123',
        status: 'active'
      };

      const canRead = await securityTester.testDocumentReadAccess('motorcycleAssignments', 'a123', user, assignmentData);
      expect(canRead).toBe(true);
    });

    it('should allow staff to create motorcycle assignments', async () => {
      const staffRoles = ['technician', 'admin'];

      for (const role of staffRoles) {
        const user = testUsers[role];
        const assignmentData = {
          userId: 'customer123',
          motorcycleId: 'motorcycle123',
          plate: 'ABC123',
          status: 'active'
        };

        const canCreate = await securityTester.testDocumentCreateAccess('motorcycleAssignments', assignmentData, user);
        expect(canCreate).toBe(true);
      }
    });

    it('should allow admins to update assignments', async () => {
      const privilegedRoles = ['admin'];

      for (const role of privilegedRoles) {
        const user = testUsers[role];
        const assignmentData = {
          userId: 'customer123',
          motorcycleId: 'motorcycle123',
          plate: 'ABC123',
          status: 'active'
        };
        const updateData = { status: 'inactive' };

        const canUpdate = await securityTester.testDocumentUpdateAccess('motorcycleAssignments', 'a123', updateData, user, assignmentData);
        expect(canUpdate).toBe(true);
      }
    });
  });

  describe('Audit Log Access Control', () => {
    it('should allow only admins to read audit logs', async () => {
      const privilegedRoles = ['admin'];
      const restrictedRoles = ['technician', 'customer'];

      const auditLogData = {
        action: 'user_login',
        entity: 'users',
        performedBy: 'user123',
        performedAt: admin.firestore.Timestamp.now()
      };

      for (const role of privilegedRoles) {
        const user = testUsers[role];
        const canRead = await securityTester.testDocumentReadAccess('auditLog', 'al123', user, auditLogData);
        expect(canRead).toBe(true);
      }

      for (const role of restrictedRoles) {
        const user = testUsers[role];
        const canRead = await securityTester.testDocumentReadAccess('auditLog', 'al123', user, auditLogData);
        expect(canRead).toBe(false);
      }
    });

    it('should allow only admins to write audit logs', async () => {
      const auditLogData = {
        action: 'user_created',
        entity: 'users',
        performedBy: 'admin123',
        performedAt: admin.firestore.Timestamp.now()
      };

      // Test with admin (should succeed)
      const admin = testUsers.admin;
      const adminCanWrite = await securityTester.testDocumentCreateAccess('auditLog', auditLogData, admin);
      expect(adminCanWrite).toBe(true);

      // Test with technician (should fail)
      const technician = testUsers.technician;
      const technicianCanWrite = await securityTester.testDocumentCreateAccess('auditLog', auditLogData, technician);
      expect(technicianCanWrite).toBe(false);
    });
  });

  describe('Query Limitations', () => {
    it('should enforce query limits on collections', async () => {
      const queryTests = [
        { collection: 'users', maxLimit: 100, allowedFields: ['role', 'active', 'email', 'isAvailable'] },
        { collection: 'workOrders', maxLimit: 100, allowedFields: ['status', 'createdAt', 'assignedTo', 'customerId'] },
        { collection: 'products', maxLimit: 100, allowedFields: ['isActive', 'categoryId', 'brand', 'stock', 'minStock', 'compatibility', 'sku'] },
        { collection: 'motorcycleAssignments', maxLimit: 100, allowedFields: ['userId', 'motorcycleId', 'plate', 'status'] }
      ];

      for (const test of queryTests) {
        // Test limit enforcement
        const overLimitQuery = { limit: test.maxLimit + 1 };
        const canQueryOverLimit = await securityTester.testQueryAccess(test.collection, overLimitQuery, testUsers.admin);
        expect(canQueryOverLimit).toBe(false);

        // Test allowed limit
        const validLimitQuery = { limit: test.maxLimit };
        const canQueryValidLimit = await securityTester.testQueryAccess(test.collection, validLimitQuery, testUsers.admin);
        expect(canQueryValidLimit).toBe(true);

        // Test allowed fields
        for (const field of test.allowedFields) {
          const validQuery = { limit: 50, where: { [field]: 'test-value' } };
          const canQueryValidField = await securityTester.testQueryAccess(test.collection, validQuery, testUsers.admin);
          expect(canQueryValidField).toBe(true);
        }

        // Test disallowed fields
        const invalidQuery = { limit: 50, where: { invalidField: 'test-value' } };
        const canQueryInvalidField = await securityTester.testQueryAccess(test.collection, invalidQuery, testUsers.admin);
        expect(canQueryInvalidField).toBe(false);
      }
    });

    it('should allow public queries on catalog collections', async () => {
      const catalogCollections = ['products', 'services', 'categories', 'brands', 'motorcycles'];

      for (const collection of catalogCollections) {
        const query = { limit: 50 };
        const canQuery = await securityTester.testQueryAccess(collection, query, null);
        expect(canQuery).toBe(true);
      }
    });
  });

  describe('System Collections Access Control', () => {
    it('should deny user access to system notification collections', async () => {
      const systemCollections = ['smsNotifications', 'pushNotifications'];

      for (const collection of systemCollections) {
        const user = testUsers.customer;
        const canRead = await securityTester.testReadAccess(collection, user);
        const canWrite = await securityTester.testWriteAccess(collection, user);

        expect(canRead).toBe(false);
        expect(canWrite).toBe(false);
      }
    });

    it('should allow read access to workshop locations and settings', async () => {
      const publicCollections = ['workshopLocations', 'appSettings'];

      for (const collection of publicCollections) {
        // Test without authentication
        const canRead = await securityTester.testReadAccess(collection, null);
        expect(canRead).toBe(true);
      }
    });
  });

  describe('Role-based Access Patterns', () => {
    it('should validate role hierarchy and permissions', async () => {
      const roleHierarchy = {
        customer: ['read_own_profile', 'read_own_work_orders', 'read_own_notifications'],
        technician: ['customer_permissions', 'read_all_work_orders', 'manage_assigned_work_orders', 'create_notifications'],
        admin: ['technician_permissions', 'manage_users', 'read_audit_logs', 'delete_users', 'modify_products', 'write_audit_logs']
      };

      // Test that higher roles include lower role permissions
      const testPermissions = [
        { role: 'technician', resource: 'workOrders', action: 'read', expected: true },
        { role: 'admin', resource: 'users', action: 'update', expected: true },
        { role: 'admin', resource: 'products', action: 'write', expected: true }
      ];

      for (const test of testPermissions) {
        const user = testUsers[test.role];
        const canAccess = await securityTester.testRoleBasedAccess(test.resource, test.action, user);
        expect(canAccess).toBe(test.expected);
      }
    });

    it('should prevent privilege escalation', async () => {
      // Test that users cannot modify their own role
      const user = testUsers.customer;
      const updateData = { role: 'admin' };

      const canUpdateRole = await securityTester.testDocumentUpdateAccess('users', user.uid, updateData, user);
      expect(canUpdateRole).toBe(false);

      // Test that non-admin users cannot create admin accounts
      const createData = {
        uid: 'new-admin',
        email: 'newadmin@test.com',
        role: 'admin',
        active: true
      };

      const canCreateAdmin = await securityTester.testDocumentCreateAccess('users', createData, user);
      expect(canCreateAdmin).toBe(false);
    });
  });

  async function cleanupTestData() {
    // Clean up test data after each test
    const collections = [
      'users', 'workOrders', 'appointments', 'queueEntries',
      'notifications', 'products', 'motorcycleAssignments', 'auditLog'
    ];

    for (const collection of collections) {
      try {
        const snapshot = await db.collection(collection).get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
});