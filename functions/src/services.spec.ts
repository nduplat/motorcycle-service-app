import * as admin from 'firebase-admin';
import { CacheService, RateLimiter, MetricsCollector, WorkshopCapacityService, TimeCoordinationService, SmartAssignmentService, TechnicianMetricsService } from './services';

// Initialize Firebase Admin SDK for tests
admin.initializeApp({
  projectId: 'test-project'
});

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  apps: [],
  firestore: jest.fn(() => ({
    collection: jest.fn(),
    runTransaction: jest.fn(),
    batch: jest.fn()
  })),
  initializeApp: jest.fn(),
  app: jest.fn(() => ({
    firestore: jest.fn(() => ({
      collection: jest.fn(),
      runTransaction: jest.fn(),
      batch: jest.fn()
    }))
  }))
}));

// Mock firebase-functions logger
jest.mock('firebase-functions/v2', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Services Integration Tests', () => {
  let mockDb: any;
  let mockCollection: any;
  let mockDoc: any;
  let mockGet: any;
  let mockSet: any;
  let mockUpdate: any;
  let mockDelete: any;
  let mockWhere: any;
  let mockBatch: any;
  let mockRunTransaction: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup Firestore mocks
    mockGet = jest.fn();
    mockSet = jest.fn();
    mockUpdate = jest.fn();
    mockDelete = jest.fn();
    mockWhere = jest.fn(() => ({
      get: mockGet,
      where: mockWhere
    }));

    mockDoc = jest.fn(() => ({
      get: mockGet,
      set: mockSet,
      update: mockUpdate,
      delete: mockDelete
    }));

    mockBatch = jest.fn(() => ({
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined)
    }));

    mockRunTransaction = jest.fn((callback) => {
      const mockTransaction = {
        get: mockGet,
        set: mockSet,
        update: mockUpdate
      };
      return callback(mockTransaction);
    });

    mockCollection = jest.fn(() => ({
      doc: mockDoc,
      get: mockGet,
      where: mockWhere,
      add: jest.fn().mockResolvedValue({ id: 'test-id' })
    }));

    mockDb = {
      collection: mockCollection,
      runTransaction: mockRunTransaction,
      batch: mockBatch
    };

    // Mock admin.firestore()
    (admin.firestore as any).mockReturnValue(mockDb);
  });

  describe('CacheService', () => {
    describe('get', () => {
      it('should return cached value when exists and not expired', async () => {
        const testKey = 'test-key';
        const testValue = { data: 'test' };
        const cachedData = {
          value: testValue,
          cachedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1000)) // 1 second ago
        };

        mockGet.mockResolvedValue({
          exists: true,
          data: () => cachedData
        });

        const result = await CacheService.get(testKey);

        expect(result).toEqual(testValue);
        expect(mockCollection).toHaveBeenCalledWith('functionCache');
        expect(mockDoc).toHaveBeenCalledWith(testKey);
      });

      it('should return null when cache entry does not exist', async () => {
        mockGet.mockResolvedValue({
          exists: false
        });

        const result = await CacheService.get('nonexistent-key');

        expect(result).toBeNull();
      });

      it('should return null when cache entry is expired', async () => {
        const expiredData = {
          value: { data: 'expired' },
          cachedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 10 * 60 * 1000)) // 10 minutes ago
        };

        mockGet.mockResolvedValue({
          exists: true,
          data: () => expiredData
        });

        const result = await CacheService.get('expired-key');

        expect(result).toBeNull();
        expect(mockDelete).toHaveBeenCalled();
      });

      it('should handle database errors gracefully', async () => {
        mockGet.mockRejectedValue(new Error('Database error'));

        const result = await CacheService.get('error-key');

        expect(result).toBeNull();
      });
    });

    describe('set', () => {
      it('should store value in cache successfully', async () => {
        const testKey = 'test-key';
        const testValue = { data: 'test' };

        await CacheService.set(testKey, testValue);

        expect(mockCollection).toHaveBeenCalledWith('functionCache');
        expect(mockDoc).toHaveBeenCalledWith(testKey);
        expect(mockSet).toHaveBeenCalledWith({
          value: testValue,
          cachedAt: expect.any(Object)
        });
      });

      it('should throw error when cache set fails', async () => {
        mockSet.mockRejectedValue(new Error('Set failed'));

        await expect(CacheService.set('fail-key', 'value')).rejects.toThrow('Cache set failed');
      });
    });

    describe('invalidate', () => {
      it('should invalidate cache entries matching pattern', async () => {
        const mockDocs = [
          { id: 'cache1_test', ref: { id: 'cache1_test' } },
          { id: 'cache2_test', ref: { id: 'cache2_test' } },
          { id: 'other_key', ref: { id: 'other_key' } }
        ];

        mockGet.mockResolvedValue({
          docs: mockDocs
        });

        await CacheService.invalidate('test');

        expect(mockBatch).toHaveBeenCalled();
        expect(mockBatch().delete).toHaveBeenCalledTimes(2);
      });

      it('should handle empty cache collection', async () => {
        mockGet.mockResolvedValue({
          docs: []
        });

        await expect(CacheService.invalidate('empty')).resolves.not.toThrow();
      });
    });
  });

  describe('RateLimiter', () => {
    describe('checkLimit', () => {
      it('should allow request within limits', async () => {
        mockRunTransaction.mockImplementation(async (callback: any) => {
          const transaction = {
            get: jest.fn().mockResolvedValue({
              exists: false,
              data: () => null
            }),
            set: jest.fn()
          };
          await callback(transaction);
          return true;
        });

        const result = await RateLimiter.checkLimit('test-operation');

        expect(result).toBe(true);
      });

      it('should deny request when rate limit exceeded', async () => {
        mockRunTransaction.mockImplementation(async (callback: any) => {
          const transaction = {
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({ count: 15 }) // Above limit of 10
            }),
            set: jest.fn()
          };
          await callback(transaction);
          return false;
        });

        const result = await RateLimiter.checkLimit('test-operation');

        expect(result).toBe(false);
      });

      it('should allow request when rate limiting fails (fail-open)', async () => {
        mockRunTransaction.mockRejectedValue(new Error('Transaction failed'));

        const result = await RateLimiter.checkLimit('test-operation');

        expect(result).toBe(true);
      });
    });
  });

  describe('WorkshopCapacityService', () => {
    describe('calculateCurrentCapacity', () => {
      it('should calculate capacity with caching', async () => {
        // Mock cache hit
        mockGet.mockResolvedValueOnce({
          exists: true,
          data: () => ({
            value: {
              totalCapacity: 16,
              usedCapacity: 5,
              availableCapacity: 11,
              utilizationRate: 31.25
            },
            cachedAt: admin.firestore.Timestamp.fromDate(new Date())
          })
        });

        const result = await WorkshopCapacityService.calculateCurrentCapacity();

        const capacityResult = result as any;
        expect(capacityResult.totalCapacity).toBe(16);
        expect(capacityResult.availableCapacity).toBe(11);
      });

      it('should calculate capacity from database when cache miss', async () => {
        // Mock cache miss
        mockGet.mockResolvedValueOnce({
          exists: false
        });

        // Mock work orders
        mockGet.mockResolvedValueOnce({
          docs: [
            { id: 'wo1', data: () => ({ status: 'in_progress', assignedTo: 'tech1' }) },
            { id: 'wo2', data: () => ({ status: 'waiting_parts', assignedTo: 'tech2' }) }
          ]
        });

        // Mock appointments
        mockGet.mockResolvedValueOnce({
          docs: [
            { id: 'apt1', data: () => ({ status: 'scheduled', assignedTo: 'tech1' }) }
          ]
        });

        // Mock technicians
        mockGet.mockResolvedValueOnce({
          docs: [
            { id: 'tech1', data: () => ({ role: 'technician', availability: { isAvailable: true } }) },
            { id: 'tech2', data: () => ({ role: 'technician', availability: { isAvailable: true } }) }
          ]
        });

        const result = await WorkshopCapacityService.calculateCurrentCapacity();

        expect(result).toHaveProperty('totalCapacity');
        expect(result).toHaveProperty('usedCapacity');
        expect(result).toHaveProperty('availableCapacity');
      });

      it('should handle rate limiting with cached result', async () => {
        // Mock rate limit exceeded but cache available
        mockRunTransaction.mockImplementation(async (callback: any) => {
          const transaction = {
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({ count: 15 })
            }),
            set: jest.fn()
          };
          await callback(transaction);
          return false;
        });

        mockGet.mockResolvedValueOnce({
          exists: true,
          data: () => ({
            value: { totalCapacity: 16, usedCapacity: 5 },
            cachedAt: admin.firestore.Timestamp.fromDate(new Date())
          })
        });

        const result = await WorkshopCapacityService.calculateCurrentCapacity() as any;

        expect(result.totalCapacity).toBe(16);
      });

      it('should throw error when rate limited and no cache available', async () => {
        mockRunTransaction.mockImplementation(async (callback: any) => {
          const transaction = {
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({ count: 15 })
            }),
            set: jest.fn()
          };
          await callback(transaction);
          return false;
        });

        mockGet.mockResolvedValueOnce({
          exists: false
        });

        await expect(WorkshopCapacityService.calculateCurrentCapacity()).rejects.toThrow('Rate limit exceeded');
      });
    });
  });

  describe('TimeCoordinationService', () => {
    describe('notifyDelayedJobs', () => {
      it('should notify managers about delayed work orders', async () => {
        const delayedWorkOrder = {
          id: 'delayed-wo',
          clientId: 'client1',
          createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 3 * 60 * 60 * 1000)), // 3 hours ago
          assignedTo: 'tech1',
          status: 'in_progress'
        };

        // Mock work orders
        mockGet.mockResolvedValueOnce({
          docs: [delayedWorkOrder]
        });

        // Mock managers
        mockGet.mockResolvedValueOnce({
          docs: [
            { id: 'manager1', data: () => ({ role: 'manager', name: 'Manager One' }) }
          ]
        });

        const result = await TimeCoordinationService.notifyDelayedJobs();

        expect(result).toBe(1);
        expect(mockCollection).toHaveBeenCalledWith('notifications');
      });

      it('should handle circuit breaker failures', async () => {
        // Mock circuit breaker failure
        mockGet.mockRejectedValueOnce(new Error('Circuit breaker open'));

        const result = await TimeCoordinationService.notifyDelayedJobs();

        expect(result).toBe(0);
      });
    });
  });

  describe('SmartAssignmentService', () => {
    describe('optimizeDailySchedule', () => {
      it('should reassign work orders for load balancing', async () => {
        // Mock appointments
        mockGet.mockResolvedValueOnce({
          docs: [
            { id: 'apt1', data: () => ({ assignedTo: null, status: 'pending_approval' }) }
          ]
        });

        // Mock work orders
        mockGet.mockResolvedValueOnce({
          docs: [
            { id: 'wo1', data: () => ({ assignedTo: 'tech1', status: 'open' }) },
            { id: 'wo2', data: () => ({ assignedTo: 'tech1', status: 'open' }) }
          ]
        });

        // Mock technicians
        mockGet.mockResolvedValueOnce({
          docs: [
            { id: 'tech1', data: () => ({ role: 'technician' }) },
            { id: 'tech2', data: () => ({ role: 'technician' }) }
          ]
        });

        const result = await SmartAssignmentService.optimizeDailySchedule();

        expect(result).toHaveProperty('reassignedAppointments');
        expect(result).toHaveProperty('optimizedWorkOrders');
      });
    });
  });

  describe('TechnicianMetricsService', () => {
    describe('calculateMonthlyMetrics', () => {
      it('should calculate comprehensive monthly metrics', async () => {
        // Mock cache miss
        mockGet.mockResolvedValueOnce({ exists: false });

        // Mock work orders
        mockGet.mockResolvedValueOnce({
          docs: [
            { id: 'wo1', data: () => ({
              status: 'ready_for_pickup',
              createdAt: admin.firestore.Timestamp.fromDate(new Date()),
              updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
              assignedTo: 'tech1',
              totalPrice: 100
            })}
          ]
        });

        // Mock appointments
        mockGet.mockResolvedValueOnce({
          docs: [
            { id: 'apt1', data: () => ({
              status: 'completed',
              assignedTo: 'tech1',
              scheduledAt: admin.firestore.Timestamp.fromDate(new Date())
            })}
          ]
        });

        // Mock technicians
        mockGet.mockResolvedValueOnce({
          docs: [
            { id: 'tech1', data: () => ({ role: 'technician', name: 'Tech One' }) }
          ]
        });

        const result = await TechnicianMetricsService.calculateMonthlyMetrics();

        expect(result).toHaveProperty('totalWorkOrders');
        expect(result).toHaveProperty('completionRate');
        expect(result).toHaveProperty('totalRevenue');
        expect(result).toHaveProperty('technicianMetrics');
      });

      it('should return cached metrics when available', async () => {
        const cachedMetrics = {
          month: '2024-01',
          totalWorkOrders: 10,
          completionRate: 80
        };

        mockGet.mockResolvedValueOnce({
          exists: true,
          data: () => ({
            value: cachedMetrics,
            cachedAt: admin.firestore.Timestamp.fromDate(new Date())
          })
        });

        const result = await TechnicianMetricsService.calculateMonthlyMetrics();

        expect(result).toEqual(cachedMetrics);
      });
    });
  });

  describe('MetricsCollector', () => {
    describe('flushMetrics', () => {
      it('should flush accumulated metrics to Firestore', async () => {
        // Add some test metrics
        MetricsCollector.incrementCounter('test.metric', 5);
        MetricsCollector.recordError('test.error');
        MetricsCollector.recordTiming('test.timing', 100);

        await MetricsCollector.flushMetrics();

        expect(mockCollection).toHaveBeenCalledWith('functionMetrics');
        expect(mockCollection().add).toHaveBeenCalled();
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle database connection failures', async () => {
      mockGet.mockRejectedValue(new Error('Connection failed'));

      await expect(WorkshopCapacityService.calculateCurrentCapacity()).rejects.toThrow();
    });

    it('should handle malformed data gracefully', async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => null // Malformed data
      });

      const result = await CacheService.get('malformed-key');

      expect(result).toBeNull();
    });

    it('should handle transaction conflicts', async () => {
      mockRunTransaction.mockRejectedValue(new Error('Transaction conflict'));

      const result = await RateLimiter.checkLimit('conflict-operation');

      // Should fail open
      expect(result).toBe(true);
    });
  });
});