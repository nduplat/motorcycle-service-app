import * as admin from 'firebase-admin';
import { RulesTestEnvironment, initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { setDoc, getDoc, doc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

describe('Firestore Security Rules Validation', () => {
  let testEnv: RulesTestEnvironment;

  // Test users with different roles
  const testUsers = {
    customer: {
      uid: 'customer-123',
      email: 'customer@test.com',
      role: 'customer',
      active: true
    },
    technician: {
      uid: 'technician-123',
      email: 'tech@test.com',
      role: 'technician',
      active: true
    },
    admin: {
      uid: 'admin-123',
      email: 'admin@test.com',
      role: 'admin',
      active: true
    },
    inactiveUser: {
      uid: 'inactive-123',
      email: 'inactive@test.com',
      role: 'technician',
      active: false
    }
  };

  beforeAll(async () => {
    // Initialize test environment with Firestore rules
    const rulesPath = path.join(__dirname, '../firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: 'blue-dragon-test',
      firestore: {
        rules: rules,
        host: 'localhost',
        port: 8080
      }
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  afterEach(async () => {
    // Clear all test data
    await testEnv.clearFirestore();
  });

  describe('Authentication Requirements', () => {
    it('should deny access to unauthenticated users', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      await assertFails(
        getDoc(doc(unauthDb, 'users', 'any-user'))
      );

      await assertFails(
        getDocs(collection(unauthDb, 'queueEntries'))
      );
    });

    it('should allow authenticated users to access public collections', async () => {
      const customerDb = testEnv.authenticatedContext(testUsers.customer.uid, testUsers.customer).firestore();

      // Should allow reading products (public collection)
      await assertSucceeds(
        getDocs(collection(customerDb, 'products'))
      );
    });
  });

  describe('User Profile Security', () => {
    it('should allow users to read their own profile', async () => {
      const customerDb = testEnv.authenticatedContext(testUsers.customer.uid, testUsers.customer).firestore();

      // Create user profile first
      await setDoc(doc(customerDb, 'users', testUsers.customer.uid), testUsers.customer);

      // Should allow reading own profile
      await assertSucceeds(
        getDoc(doc(customerDb, 'users', testUsers.customer.uid))
      );
    });

    it('should deny users from reading other users profiles', async () => {
      const customerDb = testEnv.authenticatedContext(testUsers.customer.uid, testUsers.customer).firestore();
      const otherUserId = testUsers.technician.uid;

      // Create other user's profile
      await setDoc(doc(customerDb, 'users', otherUserId), testUsers.technician);

      // Customer should not be able to read technician's profile
      await assertFails(
        getDoc(doc(customerDb, 'users', otherUserId))
      );
    });

    it('should allow staff to read all user profiles', async () => {
      const techDb = testEnv.authenticatedContext(testUsers.technician.uid, testUsers.technician).firestore();

      // Create customer profile
      await setDoc(doc(techDb, 'users', testUsers.customer.uid), testUsers.customer);

      // Technician should be able to read customer profile
      await assertSucceeds(
        getDoc(doc(techDb, 'users', testUsers.customer.uid))
      );
    });

    it('should allow users to update limited fields of their own profile', async () => {
      const customerDb = testEnv.authenticatedContext(testUsers.customer.uid, testUsers.customer).firestore();

      // Create user profile
      await setDoc(doc(customerDb, 'users', testUsers.customer.uid), testUsers.customer);

      // Should allow updating allowed fields
      await assertSucceeds(
        updateDoc(doc(customerDb, 'users', testUsers.customer.uid), {
          name: 'Updated Name',
          phone: '+573001234568'
        })
      );
    });

    it('should deny users from updating restricted fields', async () => {
      const customerDb = testEnv.authenticatedContext(testUsers.customer.uid, testUsers.customer).firestore();

      // Create user profile
      await setDoc(doc(customerDb, 'users', testUsers.customer.uid), testUsers.customer);

      // Should deny updating role
      await assertFails(
        updateDoc(doc(customerDb, 'users', testUsers.customer.uid), {
          role: 'admin'
        })
      );
    });
  });

  describe('Queue Management Security', () => {
    it('should allow customers to create their own queue entries', async () => {
      const customerDb = testEnv.authenticatedContext(testUsers.customer.uid, testUsers.customer).firestore();

      const queueEntry = {
        customerId: testUsers.customer.uid,
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

      await assertSucceeds(
        setDoc(doc(customerDb, 'queueEntries', 'entry-123'), queueEntry)
      );
    });

    it('should deny customers from creating queue entries for others', async () => {
      const customerDb = testEnv.authenticatedContext(testUsers.customer.uid, testUsers.customer).firestore();

      const queueEntry = {
        customerId: testUsers.technician.uid, // Different customer ID
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

      await assertFails(
        setDoc(doc(customerDb, 'queueEntries', 'entry-123'), queueEntry)
      );
    });

    it('should deny customers from creating queue entries with invalid status', async () => {
      const customerDb = testEnv.authenticatedContext(testUsers.customer.uid, testUsers.customer).firestore();

      const queueEntry = {
        customerId: testUsers.customer.uid,
        serviceType: 'appointment',
        status: 'called', // Invalid status for creation
        position: 1,
        joinedAt: admin.firestore.Timestamp.now(),
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)),
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      await assertFails(
        setDoc(doc(customerDb, 'queueEntries', 'entry-123'), queueEntry)
      );
    });

    it('should allow technicians to read active queue entries', async () => {
      const techDb = testEnv.authenticatedContext(testUsers.technician.uid, testUsers.technician).firestore();

      // Create queue entry as admin first
      const adminDb = testEnv.authenticatedContext(testUsers.admin.uid, testUsers.admin).firestore();
      const queueEntry = {
        customerId: testUsers.customer.uid,
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
      await setDoc(doc(adminDb, 'queueEntries', 'entry-123'), queueEntry);

      // Technician should be able to read it
      await assertSucceeds(
        getDoc(doc(techDb, 'queueEntries', 'entry-123'))
      );
    });

    it('should allow technicians to update queue entries for calling customers', async () => {
      const techDb = testEnv.authenticatedContext(testUsers.technician.uid, testUsers.technician).firestore();

      // Create queue entry as admin first
      const adminDb = testEnv.authenticatedContext(testUsers.admin.uid, testUsers.admin).firestore();
      const queueEntry = {
        customerId: testUsers.customer.uid,
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
      await setDoc(doc(adminDb, 'queueEntries', 'entry-123'), queueEntry);

      // Technician should be able to update status to called
      await assertSucceeds(
        updateDoc(doc(techDb, 'queueEntries', 'entry-123'), {
          status: 'called',
          assignedTo: testUsers.technician.uid,
          calledAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        })
      );
    });

    it('should deny technicians from updating entries assigned to others', async () => {
      const tech1Db = testEnv.authenticatedContext(testUsers.technician.uid, testUsers.technician).firestore();

      // Create queue entry assigned to different technician
      const adminDb = testEnv.authenticatedContext(testUsers.admin.uid, testUsers.admin).firestore();
      const queueEntry = {
        customerId: testUsers.customer.uid,
        serviceType: 'appointment',
        status: 'called',
        position: 1,
        assignedTo: 'other-technician-123', // Different technician
        joinedAt: admin.firestore.Timestamp.now(),
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)),
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };
      await setDoc(doc(adminDb, 'queueEntries', 'entry-123'), queueEntry);

      // Tech1 should not be able to update entry assigned to someone else
      await assertFails(
        updateDoc(doc(tech1Db, 'queueEntries', 'entry-123'), {
          status: 'served',
          updatedAt: admin.firestore.Timestamp.now()
        })
      );
    });
  });

  describe('Work Order Security', () => {
    it('should allow customers to read their own work orders', async () => {
      const customerDb = testEnv.authenticatedContext(testUsers.customer.uid, testUsers.customer).firestore();

      const workOrder = {
        customerId: testUsers.customer.uid,
        technicianId: testUsers.technician.uid,
        status: 'open',
        description: 'Test work order',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      // Create work order as admin
      const adminDb = testEnv.authenticatedContext(testUsers.admin.uid, testUsers.admin).firestore();
      await setDoc(doc(adminDb, 'workOrders', 'wo-123'), workOrder);

      // Customer should be able to read their own work order
      await assertSucceeds(
        getDoc(doc(customerDb, 'workOrders', 'wo-123'))
      );
    });

    it('should deny customers from reading other customers work orders', async () => {
      const customerDb = testEnv.authenticatedContext(testUsers.customer.uid, testUsers.customer).firestore();

      const workOrder = {
        customerId: 'other-customer-123', // Different customer
        technicianId: testUsers.technician.uid,
        status: 'open',
        description: 'Test work order',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      // Create work order as admin
      const adminDb = testEnv.authenticatedContext(testUsers.admin.uid, testUsers.admin).firestore();
      await setDoc(doc(adminDb, 'workOrders', 'wo-123'), workOrder);

      // Customer should not be able to read other customer's work order
      await assertFails(
        getDoc(doc(customerDb, 'workOrders', 'wo-123'))
      );
    });

    it('should allow assigned technicians to update their work orders', async () => {
      const techDb = testEnv.authenticatedContext(testUsers.technician.uid, testUsers.technician).firestore();

      const workOrder = {
        customerId: testUsers.customer.uid,
        assignedTo: testUsers.technician.uid,
        status: 'in_progress',
        description: 'Test work order',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      // Create work order as admin
      const adminDb = testEnv.authenticatedContext(testUsers.admin.uid, testUsers.admin).firestore();
      await setDoc(doc(adminDb, 'workOrders', 'wo-123'), workOrder);

      // Technician should be able to update their assigned work order
      await assertSucceeds(
        updateDoc(doc(techDb, 'workOrders', 'wo-123'), {
          status: 'completed',
          updatedAt: admin.firestore.Timestamp.now()
        })
      );
    });
  });

  describe('Query Limitations', () => {
    it('should enforce query limits', async () => {
      const adminDb = testEnv.authenticatedContext(testUsers.admin.uid, testUsers.admin).firestore();

      // Create many users
      const userPromises = [];
      for (let i = 0; i < 150; i++) {
        userPromises.push(
          setDoc(doc(adminDb, 'users', `user-${i}`), {
            uid: `user-${i}`,
            email: `user${i}@test.com`,
            role: 'customer',
            active: true
          })
        );
      }
      await Promise.all(userPromises);

      // Query with limit over maximum should fail
      await assertFails(
        getDocs(query(collection(adminDb, 'users'), where('active', '==', true)))
      );

      // Query with reasonable limit should succeed
      await assertSucceeds(
        getDocs(query(collection(adminDb, 'users'), where('active', '==', true), limit(50)))
      );
    });

    it('should restrict query fields', async () => {
      const customerDb = testEnv.authenticatedContext(testUsers.customer.uid, testUsers.customer).firestore();

      // Create some queue entries
      const adminDb = testEnv.authenticatedContext(testUsers.admin.uid, testUsers.admin).firestore();
      for (let i = 0; i < 5; i++) {
        await setDoc(doc(adminDb, 'queueEntries', `entry-${i}`), {
          customerId: testUsers.customer.uid,
          serviceType: 'appointment',
          status: 'waiting',
          position: i + 1,
          joinedAt: admin.firestore.Timestamp.now(),
          estimatedWaitTime: 30,
          verificationCode: `${1000 + i}`,
          expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)),
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        });
      }

      // Customer should be able to query their own entries
      await assertSucceeds(
        getDocs(query(
          collection(customerDb, 'queueEntries'),
          where('customerId', '==', testUsers.customer.uid)
        ))
      );

      // Customer should not be able to query by status (not allowed field)
      await assertFails(
        getDocs(query(
          collection(customerDb, 'queueEntries'),
          where('status', '==', 'waiting')
        ))
      );
    });
  });

  describe('Data Validation', () => {
    it('should validate queue entry data integrity', async () => {
      const customerDb = testEnv.authenticatedContext(testUsers.customer.uid, testUsers.customer).firestore();

      // Valid queue entry
      const validEntry = {
        customerId: testUsers.customer.uid,
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

      await assertSucceeds(
        setDoc(doc(customerDb, 'queueEntries', 'valid-entry'), validEntry)
      );

      // Invalid queue entry (wrong status)
      const invalidEntry = {
        ...validEntry,
        status: 'invalid_status'
      };

      await assertFails(
        setDoc(doc(customerDb, 'queueEntries', 'invalid-entry'), invalidEntry)
      );
    });

    it('should prevent data type mismatches', async () => {
      const customerDb = testEnv.authenticatedContext(testUsers.customer.uid, testUsers.customer).firestore();

      // Try to create queue entry with wrong data types
      const invalidEntry = {
        customerId: testUsers.customer.uid,
        serviceType: 'appointment',
        status: 'waiting',
        position: 'not_a_number', // Should be number
        joinedAt: admin.firestore.Timestamp.now(),
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)),
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      // This should fail due to type validation in rules
      await assertFails(
        setDoc(doc(customerDb, 'queueEntries', 'type-mismatch'), invalidEntry)
      );
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should prevent excessive queue entries from single user', async () => {
      const customerDb = testEnv.authenticatedContext(testUsers.customer.uid, testUsers.customer).firestore();

      // Try to create multiple queue entries rapidly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const entry = {
          customerId: testUsers.customer.uid,
          serviceType: 'appointment',
          status: 'waiting',
          position: i + 1,
          joinedAt: admin.firestore.Timestamp.now(),
          estimatedWaitTime: 30,
          verificationCode: `${1000 + i}`,
          expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)),
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        };

        promises.push(
          setDoc(doc(customerDb, 'queueEntries', `entry-${i}`), entry)
        );
      }

      // Some should succeed, but rapid creation should be limited
      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Should have some failures due to rate limiting
      expect(failed).toBeGreaterThan(0);
    });
  });
});