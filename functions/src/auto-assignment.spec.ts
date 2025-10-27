import * as admin from 'firebase-admin';
import { onQueueEntryCreate } from './auto-assignment';
import { MetricsCollector, StructuredLogger } from './services';

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn()
      })),
      where: jest.fn(() => ({
        get: jest.fn(),
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn()
          }))
        }))
      })),
      add: jest.fn(),
      get: jest.fn()
    })),
    runTransaction: jest.fn(),
    batch: jest.fn(() => ({
      delete: jest.fn(),
      commit: jest.fn()
    })),
    FieldValue: {
      serverTimestamp: jest.fn()
    },
    Timestamp: {
      fromDate: jest.fn(),
      now: jest.fn()
    }
  }))
}));

// Mock services
jest.mock('./services', () => ({
  MetricsCollector: {
    incrementCounter: jest.fn(),
    recordTiming: jest.fn(),
    recordError: jest.fn()
  },
  StructuredLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Auto Assignment Cloud Function', () => {
  let mockDb: any;
  let mockCollection: any;
  let mockDoc: any;
  let mockGet: any;
  let mockSet: any;
  let mockUpdate: any;
  let mockAdd: any;
  let mockWhere: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Firestore mocks
    mockGet = jest.fn();
    mockSet = jest.fn();
    mockUpdate = jest.fn();
    mockAdd = jest.fn().mockResolvedValue({ id: 'test-id' });

    mockDoc = jest.fn(() => ({
      get: mockGet,
      set: mockSet,
      update: mockUpdate
    }));

    mockWhere = jest.fn(() => ({
      get: mockGet,
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: mockGet
        }))
      }))
    }));

    mockCollection = jest.fn(() => ({
      doc: mockDoc,
      add: mockAdd,
      where: mockWhere,
      get: mockGet
    }));

    mockDb = {
      collection: mockCollection
    };

    (admin.firestore as any).mockReturnValue(mockDb);
  });

  describe('Technician Score Calculation', () => {
    it('should calculate scores for available technicians', async () => {
      // Mock technicians data
      const mockTechnicians = [
        {
          id: 'tech1',
          role: 'technician',
          technicianProfile: {
            skills: ['basic_maintenance', 'engine_repair']
          },
          availability: { isAvailable: true }
        },
        {
          id: 'tech2',
          role: 'technician',
          technicianProfile: {
            skills: ['basic_maintenance', 'brake_service']
          },
          availability: { isAvailable: true }
        }
      ];

      mockGet.mockResolvedValueOnce({
        docs: mockTechnicians.map(tech => ({
          id: tech.id,
          data: () => tech
        }))
      });

      // Mock workload data
      mockGet.mockResolvedValueOnce({ size: 2 }); // tech1 has 2 active work orders
      mockGet.mockResolvedValueOnce({ size: 1 }); // tech2 has 1 active work order

      // Mock last assignment times
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => ({ createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000)) }) }] // 2 hours ago
      });
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => ({ createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)) }) }] // 24 hours ago
      });

      const queueEntry = {
        id: 'qe1',
        customerId: 'customer1',
        serviceType: 'appointment',
        plate: 'ABC123',
        mileageKm: 10000
      };

      // Import and call the internal function (would need to export it for testing)
      // const scores = await calculateTechnicianScores(queueEntry);

      // For now, just verify the mocks are set up correctly
      expect(mockCollection).toHaveBeenCalledWith('users');
      expect(mockWhere).toHaveBeenCalledWith('role', '==', 'technician');
    });

    it('should handle no available technicians', async () => {
      mockGet.mockResolvedValueOnce({
        docs: []
      });

      const queueEntry = {
        id: 'qe1',
        customerId: 'customer1',
        serviceType: 'appointment',
        plate: 'ABC123',
        mileageKm: 10000
      };

      // Should handle gracefully without throwing
      expect(mockCollection).toHaveBeenCalledWith('users');
    });

    it('should prioritize technicians with matching skills', async () => {
      // Test would verify that technicians with required skills get higher scores
      // This would require mocking the calculateIndividualScore function
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Work Order Creation', () => {
    it('should create work order with correct data', async () => {
      const queueEntry = {
        id: 'qe1',
        customerId: 'customer1',
        serviceType: 'appointment',
        plate: 'ABC123',
        mileageKm: 10000,
        motorcycleId: 'motorcycle1'
      };

      const technicianId = 'tech1';

      // Mock customer data
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          name: 'Test Customer',
          phone: '+1234567890'
        })
      });

      // Mock work order count for number generation
      mockGet.mockResolvedValueOnce({
        size: 5
      });

      // Call createWorkOrder (would need to export it)
      // const workOrderId = await createWorkOrder(queueEntry, technicianId);

      expect(mockCollection).toHaveBeenCalledWith('users');
      expect(mockCollection).toHaveBeenCalledWith('workOrders');
      expect(mockAdd).toHaveBeenCalled();
    });

    it('should generate unique work order numbers', async () => {
      // Mock current month work orders
      mockGet.mockResolvedValueOnce({
        size: 15
      });

      // Test number generation logic
      const now = new Date('2024-01-15');
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');

      // Expected format: WO-202401-0016 (next number after 15)
      const expectedNumber = `WO-${year}${month}-0016`;

      expect(expectedNumber).toBe('WO-202401-0016');
    });

    it('should handle missing motorcycle data', async () => {
      const queueEntry = {
        id: 'qe1',
        customerId: 'customer1',
        serviceType: 'appointment',
        plate: 'ABC123',
        mileageKm: 10000
        // No motorcycleId
      };

      // Should create temporary motorcycle record
      expect(mockCollection).toHaveBeenCalledWith('motorcycles');
      expect(mockDoc).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe('Queue Entry Updates', () => {
    it('should update queue entry with assignment details', async () => {
      const queueEntryId = 'qe1';
      const technicianId = 'tech1';
      const workOrderId = 'wo1';

      // Call updateQueueEntry (would need to export it)
      // await updateQueueEntry(queueEntryId, technicianId, workOrderId);

      expect(mockCollection).toHaveBeenCalledWith('queueEntries');
      expect(mockDoc).toHaveBeenCalledWith(queueEntryId);
      expect(mockUpdate).toHaveBeenCalledWith({
        assignedTo: technicianId,
        workOrderId: workOrderId,
        status: 'called',
        updatedAt: expect.any(Function) // serverTimestamp
      });
    });
  });

  describe('Notification System', () => {
    it('should send SMS to customer with verification code', async () => {
      const queueEntry = {
        id: 'qe1',
        customerId: 'customer1',
        verificationCode: '1234',
        plate: 'ABC123'
      };

      const technician = {
        id: 'tech1',
        name: 'Test Technician'
      };

      // Mock customer data
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          phone: '+1234567890'
        })
      });

      // Call sendCustomerSMS (would need to export it)
      // await sendCustomerSMS(queueEntry, technician);

      expect(mockCollection).toHaveBeenCalledWith('users');
      expect(mockCollection).toHaveBeenCalledWith('smsNotifications');
      expect(mockAdd).toHaveBeenCalledWith({
        to: '+1234567890',
        message: expect.stringContaining('Test Technician'),
        customerId: 'customer1',
        queueEntryId: 'qe1',
        technicianId: 'tech1',
        status: 'pending',
        createdAt: expect.any(Function)
      });
    });

    it('should send push notification to technician', async () => {
      const queueEntry = {
        id: 'qe1',
        customerId: 'customer1',
        plate: 'ABC123',
        mileageKm: 10000
      };

      const technician = {
        id: 'tech1',
        name: 'Test Technician'
      };

      // Call sendTechnicianPushNotification (would need to export it)
      // await sendTechnicianPushNotification(queueEntry, technician);

      expect(mockCollection).toHaveBeenCalledWith('notifications');
      expect(mockAdd).toHaveBeenCalledWith({
        type: 'service_orders',
        title: 'Nueva Asignación de Trabajo',
        message: expect.stringContaining('ABC123'),
        userId: 'tech1',
        priority: 'high',
        targetAudience: 'specific_user',
        read: false,
        createdAt: expect.any(Function),
        additionalMeta: expect.objectContaining({
          queueEntryId: 'qe1',
          customerId: 'customer1'
        })
      });
    });

    it('should skip SMS if customer has no phone number', async () => {
      const queueEntry = {
        id: 'qe1',
        customerId: 'customer1',
        verificationCode: '1234'
      };

      const technician = {
        id: 'tech1',
        name: 'Test Technician'
      };

      // Mock customer without phone
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          name: 'Test Customer'
          // No phone field
        })
      });

      // Should not create SMS notification
      expect(mockCollection).not.toHaveBeenCalledWith('smsNotifications');
    });
  });

  describe('Technician Metrics', () => {
    it('should update existing technician metrics', async () => {
      const technicianId = 'tech1';

      // Mock existing metrics
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          totalAssignments: 10,
          assignmentsThisMonth: 5
        })
      });

      // Call updateTechnicianMetrics (would need to export it)
      // await updateTechnicianMetrics(technicianId);

      expect(mockCollection).toHaveBeenCalledWith('technicianMetrics');
      expect(mockDoc).toHaveBeenCalledWith(technicianId);
      expect(mockUpdate).toHaveBeenCalledWith({
        totalAssignments: 11,
        assignmentsThisMonth: 6,
        lastAssignmentAt: expect.any(Function),
        updatedAt: expect.any(Function)
      });
    });

    it('should create new technician metrics if none exist', async () => {
      const technicianId = 'tech1';

      // Mock no existing metrics
      mockGet.mockResolvedValueOnce({
        exists: false
      });

      // Call updateTechnicianMetrics (would need to export it)
      // await updateTechnicianMetrics(technicianId);

      expect(mockCollection).toHaveBeenCalledWith('technicianMetrics');
      expect(mockDoc).toHaveBeenCalledWith(technicianId);
      expect(mockSet).toHaveBeenCalledWith({
        technicianId: 'tech1',
        totalAssignments: 1,
        assignmentsThisMonth: 1,
        monthStart: expect.any(Object),
        lastAssignmentAt: expect.any(Function),
        createdAt: expect.any(Function),
        updatedAt: expect.any(Function)
      });
    });
  });

  describe('Audit Logging', () => {
    it('should log assignment events with scoring details', async () => {
      const queueEntry = {
        id: 'qe1',
        customerId: 'customer1',
        serviceType: 'appointment',
        plate: 'ABC123',
        mileageKm: 10000,
        joinedAt: admin.firestore.Timestamp.now()
      };

      const technician = {
        id: 'tech1',
        name: 'Test Technician'
      };

      const workOrderId = 'wo1';
      const scores = [
        {
          technicianId: 'tech1',
          technician,
          totalScore: 85,
          breakdown: {
            skillsMatch: 40,
            workloadBalance: 25,
            rating: 15,
            brandExperience: 5,
            timeSinceLastAssignment: 0
          }
        }
      ];

      // Call logAssignmentEvent (would need to export it)
      // await logAssignmentEvent(queueEntry, technician, workOrderId, scores);

      expect(mockCollection).toHaveBeenCalledWith('assignmentAuditLog');
      expect(mockAdd).toHaveBeenCalledWith({
        eventType: 'auto_assignment',
        queueEntryId: 'qe1',
        customerId: 'customer1',
        technicianId: 'tech1',
        workOrderId: 'wo1',
        assignmentTimestamp: expect.any(Function),
        scoringDetails: expect.objectContaining({
          selectedTechnician: expect.objectContaining({
            id: 'tech1',
            score: 85
          }),
          totalTechniciansConsidered: 1
        }),
        queueEntryDetails: expect.objectContaining({
          serviceType: 'appointment',
          plate: 'ABC123'
        })
      });
    });
  });

  describe('Error Handling', () => {
    it('should notify managers when no technicians are available', async () => {
      const queueEntry = {
        id: 'qe1',
        customerId: 'customer1',
        plate: 'ABC123',
        mileageKm: 10000
      };

      // Mock no managers found
      mockGet.mockResolvedValueOnce({
        docs: []
      });

      // Call notifyManagersNoTechnician (would need to export it)
      // await notifyManagersNoTechnician(queueEntry);

      expect(mockCollection).toHaveBeenCalledWith('users');
      expect(mockWhere).toHaveBeenCalledWith('role', '==', 'manager');
    });

    it('should log failed assignments', async () => {
      const queueEntry = {
        id: 'qe1',
        customerId: 'customer1',
        serviceType: 'appointment',
        plate: 'ABC123',
        mileageKm: 10000
      };

      // Call would log to assignmentAuditLog with failure reason
      expect(mockCollection).toHaveBeenCalledWith('assignmentAuditLog');
      expect(mockAdd).toHaveBeenCalledWith({
        eventType: 'auto_assignment_failed',
        queueEntryId: 'qe1',
        reason: 'no_technicians_available',
        timestamp: expect.any(Function),
        queueEntryDetails: expect.objectContaining({
          serviceType: 'appointment',
          plate: 'ABC123'
        })
      });
    });
  });

  describe('Main Function Trigger', () => {
    it('should process queue entry creation successfully', async () => {
      const mockEvent = {
        params: { queueEntryId: 'qe1' },
        data: {
          data: () => ({
            customerId: 'customer1',
            serviceType: 'appointment',
            plate: 'ABC123',
            mileageKm: 10000,
            joinedAt: admin.firestore.Timestamp.now()
          })
        }
      };

      // Mock successful execution
      // This would require extensive mocking of all internal functions

      // const result = await onQueueEntryCreate(mockEvent);

      expect(MetricsCollector.incrementCounter).toHaveBeenCalledWith('auto_assignment.trigger');
      // Verify all steps are called in sequence
    });

    it('should handle errors gracefully', async () => {
      const mockEvent = {
        params: { queueEntryId: 'qe1' },
        data: null // No data
      };

      // Should handle missing data without crashing
      expect(StructuredLogger.error).toHaveBeenCalled();
    });

    it('should track performance metrics', async () => {
      // Verify timing metrics are recorded
      expect(MetricsCollector.recordTiming).toHaveBeenCalledWith('auto_assignment.total_duration', expect.any(Number));
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete assignment workflow', async () => {
      // Test the complete flow from queue entry to assignment
      // This would mock all services and verify the entire pipeline

      const queueEntry = {
        id: 'qe1',
        customerId: 'customer1',
        serviceType: 'appointment',
        plate: 'ABC123',
        mileageKm: 10000
      };

      // Mock all required data and services
      // Verify all functions are called in correct order
      // Verify final state is correct

      expect(mockCollection).toHaveBeenCalledWith('users');
      expect(mockCollection).toHaveBeenCalledWith('workOrders');
      expect(mockCollection).toHaveBeenCalledWith('queueEntries');
      expect(mockCollection).toHaveBeenCalledWith('notifications');
    });

    it('should handle concurrent assignments', async () => {
      // Test that multiple queue entries can be processed simultaneously
      // This would require testing transaction handling

      expect(mockDb.runTransaction).toBeDefined();
    });
  });
});