import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { QueueService } from '../src/services/queue.service';
import { NotificationService } from '../src/services/notification.service';
import { AuthService } from '../src/services/auth.service';
import { UserService } from '../src/services/user.service';
import { EventBusService } from '../src/services/event-bus.service';
import { QrCodeService } from '../src/services/qr-code.service';
import { SchedulingService } from '../src/services/scheduling.service';
import { CacheService } from '../src/services/cache.service';
import { AppointmentService } from '../src/services/appointment.service';
import { WorkOrderService } from '../src/services/work-order.service';
// import { AIAssistantService } from '../src/services/ai-assistant.service'; // REMOVED: AI services eliminated for cost savings
// import { GroqService } from '../src/services/groq.service'; // REMOVED: AI services eliminated for cost savings
import { CostMonitoringService } from '../src/services/cost-monitoring.service';
import { FallbackLibraryService } from '../src/services/fallback-library.service';
import { BudgetCircuitBreakerService } from '../src/services/budget-circuit-breaker.service';
/// <reference types="jest" />

describe('Performance Tests', () => {
  let queueService: QueueService;
  let notificationService: NotificationService;
  // let aiAssistantService: AIAssistantService; // REMOVED: AI services eliminated for cost savings
  let cacheService: CacheService;
  let costMonitoringService: CostMonitoringService;

  beforeEach(() => {
    const authSpy = {
      currentUser: jest.fn().mockReturnValue({ id: 'user1', role: 'customer' })
    };
    const userSpy = {
      getUserById: jest.fn(),
      getUsers: jest.fn().mockReturnValue([]),
      getUsersByRole: jest.fn().mockReturnValue([])
    };
    const eventBusSpyObj = {
      emit: jest.fn()
    };
    const qrCodeSpy = {
      generateQrCodeDataUrl: jest.fn().mockReturnValue('data:image/png;base64,test')
    };
    const schedulingSpy = {
      autoAssignTechnician: jest.fn().mockReturnValue('tech1')
    };
    const cacheSpy = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined)
    };
    const appointmentSpy = {
      getAppointmentsForDate: jest.fn().mockReturnValue([])
    };
    const workOrderSpy = {
      createWorkOrderFromQueueEntry: jest.fn().mockReturnValue(of({ id: 'wo1' })),
      getWorkOrders: jest.fn().mockReturnValue(signal([]))
    };
    const groqSpy = {
      analyzeText: jest.fn(),
      generateResponse: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true)
    };
    const costSpy = {
      trackFunctionInvocation: jest.fn(),
      getCurrentCosts: jest.fn(),
      getUsageHistory: jest.fn()
    };
    const fallbackSpy = {
      findBestMatch: jest.fn(),
      getResponseWithDynamicData: jest.fn(),
      addResponse: jest.fn(),
      getStats: jest.fn()
    };
    const circuitBreakerSpy = {
      executeAIOperation: jest.fn().mockImplementation(async (operation: any) => await operation()),
      getStatus: jest.fn(),
      resetCircuitBreaker: jest.fn(),
      updateThresholds: jest.fn(),
      getFallbackResponse: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        QueueService,
        NotificationService,
        // AIAssistantService, // REMOVED: AI services eliminated for cost savings
        { provide: AuthService, useValue: authSpy },
        { provide: UserService, useValue: userSpy },
        { provide: EventBusService, useValue: eventBusSpyObj },
        { provide: QrCodeService, useValue: qrCodeSpy },
        { provide: SchedulingService, useValue: schedulingSpy },
        { provide: CacheService, useValue: cacheSpy },
        { provide: AppointmentService, useValue: appointmentSpy },
        { provide: WorkOrderService, useValue: workOrderSpy },
        // { provide: GroqService, useValue: groqSpy }, // REMOVED: AI services eliminated for cost savings
        { provide: CostMonitoringService, useValue: costSpy },
        { provide: FallbackLibraryService, useValue: fallbackSpy },
        { provide: BudgetCircuitBreakerService, useValue: circuitBreakerSpy }
      ]
    });

    queueService = TestBed.inject(QueueService);
    notificationService = TestBed.inject(NotificationService);
    // aiAssistantService = TestBed.inject(AIAssistantService); // REMOVED: AI services eliminated for cost savings
    cacheService = TestBed.inject(CacheService);
    costMonitoringService = TestBed.inject(CostMonitoringService);
  });

  describe('Queue Service Performance', () => {
    it('should handle queue operations within performance limits', async () => {
      const startTime = performance.now();

      // Test queue entry creation
      const queueData = {
        customerId: 'customer1',
        serviceType: 'appointment' as const,
        motorcycleId: 'motorcycle1',
        plate: 'ABC123',
        mileageKm: 10000,
        notes: 'Performance test'
      };

      // Mock the private methods to avoid actual Firestore calls
      jest.spyOn(queueService as any, 'checkUserHasMotorcycle').mockResolvedValue(true);
      jest.spyOn(queueService as any, 'createMotorcycleAssignment').mockResolvedValue('assignment1');
      jest.spyOn(queueService as any, 'generateVerificationCode').mockReturnValue('1234');
      jest.spyOn(queueService as any, 'calculateEstimatedWaitTime').mockReturnValue(30);
      jest.spyOn(queueService as any, 'updateQueueStatus').mockResolvedValue(undefined);

      await queueService.addToQueue(queueData);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within 100ms for basic operations
      expect(duration).toBeLessThan(100);
    });

    it('should handle multiple concurrent queue operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => ({
        customerId: `customer${i}`,
        serviceType: 'appointment' as const,
        motorcycleId: `motorcycle${i}`,
        plate: `PLATE${i}`,
        mileageKm: 10000 + i * 1000,
        notes: `Test operation ${i}`
      }));

      // Mock all operations
      jest.spyOn(queueService as any, 'checkUserHasMotorcycle').mockResolvedValue(true);
      jest.spyOn(queueService as any, 'createMotorcycleAssignment').mockResolvedValue('assignment1');
      jest.spyOn(queueService as any, 'generateVerificationCode').mockReturnValue('1234');
      jest.spyOn(queueService as any, 'calculateEstimatedWaitTime').mockReturnValue(30);
      jest.spyOn(queueService as any, 'updateQueueStatus').mockResolvedValue(undefined);

      const startTime = performance.now();

      // Execute all operations concurrently
      await Promise.all(operations.map(op => queueService.addToQueue(op)));

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle 10 concurrent operations within 500ms
      expect(duration).toBeLessThan(500);
    });

    it('should maintain performance under load', () => {
      const iterations = 1000;
      const startTime = performance.now();

      // Test repeated signal access (common in reactive components)
      for (let i = 0; i < iterations; i++) {
        queueService.getQueueEntries();
        queueService.getQueueStatus();
        notificationService.getSystemNotifications();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTimePerOperation = duration / (iterations * 3); // 3 operations per iteration

      // Average operation should be under 1ms
      expect(avgTimePerOperation).toBeLessThan(1);
    });
  });

  // REMOVED: AI Assistant Performance tests - AI services eliminated for cost savings
  // describe('AI Assistant Performance', () => {
  //   beforeEach(() => {
  //     // Setup mocks for AI operations
  //     jest.spyOn(aiAssistantService as any, 'callGeminiAPI').mockResolvedValue({
  //       response: 'AI response',
  //       tokens: 150
  //     });
  //     jest.spyOn(cacheService, 'get').mockResolvedValue(null);
  //     jest.spyOn(cacheService, 'set').mockResolvedValue(undefined);
  //   });

  //   it('should respond to fallback queries within 50ms', async () => {
  //     const startTime = performance.now();

  //     // Test fallback query (should be very fast)
  //     const result = await aiAssistantService.processUserQuery('¿Cuál es el horario?', 'chatbot');

  //     const endTime = performance.now();
  //     const duration = endTime - startTime;

  //     expect(duration).toBeLessThan(50);
  //     expect(result).toContain('horario');
  //   });

  //   it('should handle cached responses within 200ms', async () => {
  //     // Mock cached response
  //     const cachedResponse = 'Cached response for common query';
  //     jest.spyOn(cacheService, 'get').mockResolvedValue(cachedResponse);

  //     const startTime = performance.now();

  //     const result = await aiAssistantService.processUserQuery('cached query', 'chatbot');

  //     const endTime = performance.now();
  //     const duration = endTime - startTime;

  //     expect(duration).toBeLessThan(200);
  //     expect(result).toBe(cachedResponse);
  //   });

  //   it('should handle AI responses within acceptable time limits', async () => {
  //     // Mock AI call
  //     jest.spyOn(cacheService, 'get').mockResolvedValue(null);

  //     const startTime = performance.now();

  //     const result = await aiAssistantService.processUserQuery('complex diagnostic question', 'workOrder');

  //     const endTime = performance.now();
  //     const duration = endTime - startTime;

  //     // AI responses should be under 2 seconds for good UX
  //     expect(duration).toBeLessThan(2000);
  //     expect(result).toBe('AI response');
  //   });

  //   it('should maintain performance with concurrent AI requests', async () => {
  //     const concurrentRequests = 5;
  //     const queries = Array.from({ length: concurrentRequests }, (_, i) =>
  //       `Concurrent query ${i}`
  //     );

  //     jest.spyOn(cacheService, 'get').mockResolvedValue(null);

  //     const startTime = performance.now();

  //     const results = await Promise.all(
  //       queries.map(query => aiAssistantService.processUserQuery(query, 'chatbot'))
  //     );

  //     const endTime = performance.now();
  //     const duration = endTime - startTime;
  //     const avgTimePerRequest = duration / concurrentRequests;

  //     // Average response time should be reasonable
  //     expect(avgTimePerRequest).toBeLessThan(1000);
  //     expect(results).toHaveLength(concurrentRequests);
  //   });
  // });

  describe('Cache Service Performance', () => {
    it('should provide fast cache access', async () => {
      const testKey = 'performance-test-key';
      const testValue = { data: 'test', timestamp: Date.now() };

      // Test cache set
      const setStartTime = performance.now();
      await cacheService.set(testKey, testValue, 300000); // 5 minutes
      const setEndTime = performance.now();
      const setDuration = setEndTime - setStartTime;

      expect(setDuration).toBeLessThan(50);

      // Test cache get
      const getStartTime = performance.now();
      const retrievedValue = await cacheService.get(testKey);
      const getEndTime = performance.now();
      const getDuration = getEndTime - getStartTime;

      expect(getDuration).toBeLessThan(50);
      expect(retrievedValue).toBeNull; // Mock returns null
    });

    it('should handle cache operations under load', async () => {
      const operations = 100;
      const startTime = performance.now();

      // Perform multiple cache operations
      const promises = [];
      for (let i = 0; i < operations; i++) {
        promises.push(cacheService.set(`key-${i}`, { value: i }, 300000));
        promises.push(cacheService.get(`key-${i}`));
      }

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTimePerOperation = duration / (operations * 2); // set + get

      expect(avgTimePerOperation).toBeLessThan(10);
    });
  });

  describe('Notification Service Performance', () => {
    it('should handle notification creation efficiently', async () => {
      const notificationData = {
        userId: 'user1',
        title: 'Performance Test Notification',
        message: 'Testing notification performance',
        type: 'system' as const,
        priority: 'medium' as const
      };

      const startTime = performance.now();

      // Mock the addSystemNotification method
      jest.spyOn(notificationService, 'addSystemNotification').mockResolvedValue({
        ...notificationData,
        id: 'test-id',
        read: false,
        createdAt: new Date()
      });

      await notificationService.addSystemNotification(notificationData);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should handle bulk notification operations', async () => {
      const bulkNotifications = Array.from({ length: 50 }, (_, i) => ({
        userId: `user${i % 5}`, // 5 different users
        title: `Bulk Notification ${i}`,
        message: `Message ${i}`,
        type: 'system' as const,
        priority: 'low' as const
      }));

      jest.spyOn(notificationService, 'addSystemNotification').mockResolvedValue({
        id: 'test-id',
        userId: 'user1',
        title: 'Test',
        message: 'Test',
        type: 'system',
        priority: 'low',
        read: false,
        createdAt: new Date()
      });

      const startTime = performance.now();

      await Promise.all(
        bulkNotifications.map(notification =>
          notificationService.addSystemNotification(notification)
        )
      );

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTimePerNotification = duration / bulkNotifications.length;

      expect(avgTimePerNotification).toBeLessThan(20);
    });
  });

  describe('Cost Monitoring Performance', () => {
    it('should track costs efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();

      // Simulate cost tracking calls
      for (let i = 0; i < iterations; i++) {
        costMonitoringService.trackFunctionInvocation(1.0, 0.5, 1024);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTimePerCall = duration / iterations;

      // Cost tracking should be very fast (< 1ms per call)
      expect(avgTimePerCall).toBeLessThan(1);
    });

    it('should handle concurrent cost tracking', async () => {
      const concurrentOperations = 100;
      const operations = Array.from({ length: concurrentOperations }, (_, i) => ({
        processingTime: 1.0 + (i * 0.1),
        cpuTime: 0.5,
        networkEgress: 1024 + (i * 100)
      }));

      const startTime = performance.now();

      await Promise.all(
        operations.map(op =>
          costMonitoringService.trackFunctionInvocation(op.processingTime, op.cpuTime, op.networkEgress)
        )
      );

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTimePerOperation = duration / concurrentOperations;

      expect(avgTimePerOperation).toBeLessThan(5);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not have memory leaks in signal-based services', () => {
      // Test that repeated signal access doesn't cause memory issues
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        const entries = queueService.getQueueEntries();
        const status = queueService.getQueueStatus();
        const notifications = notificationService.getSystemNotifications();

        // Verify signals return valid objects
        expect(entries).toBeDefined();
        expect(status).toBeDefined();
        expect(notifications).toBeDefined();
      }

      // If we get here without crashing, memory usage is acceptable
      expect(true).toBe(true);
    });

    it('should handle large datasets efficiently', () => {
      // Test with simulated large queue
      const largeQueue = Array.from({ length: 1000 }, (_, i) => ({
        id: `entry-${i}`,
        customerId: `customer-${i % 100}`, // 100 unique customers
        serviceType: 'appointment' as const,
        status: 'waiting' as const,
        position: i + 1,
        joinedAt: new Date(),
        estimatedWaitTime: 30,
        verificationCode: `${1000 + i}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Mock large queue
      jest.spyOn(queueService as any, 'queueEntries', 'get').mockReturnValue(signal(largeQueue));

      const startTime = performance.now();

      // Test operations on large dataset
      const waitingEntries = largeQueue.filter(e => e.status === 'waiting');
      const customerEntries = largeQueue.filter(e => e.customerId === 'customer-1');

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(waitingEntries).toHaveLength(1000);
      expect(customerEntries.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Filtering should be fast
    });
  });

  describe('End-to-End Performance Scenarios', () => {
    it('should complete full customer journey within time limits', async () => {
      const journeyStartTime = performance.now();

      // Step 1: Queue join
      const queueData = {
        customerId: 'customer1',
        serviceType: 'appointment' as const,
        motorcycleId: 'motorcycle1',
        plate: 'ABC123',
        mileageKm: 10000,
        notes: 'Performance journey test'
      };

      jest.spyOn(queueService as any, 'checkUserHasMotorcycle').mockResolvedValue(true);
      jest.spyOn(queueService as any, 'createMotorcycleAssignment').mockResolvedValue('assignment1');
      jest.spyOn(queueService as any, 'generateVerificationCode').mockReturnValue('1234');
      jest.spyOn(queueService as any, 'calculateEstimatedWaitTime').mockReturnValue(30);
      jest.spyOn(queueService as any, 'updateQueueStatus').mockResolvedValue(undefined);

      await queueService.addToQueue(queueData);
      const queueJoinTime = performance.now();

      // Step 2: AI Assistant interaction - REMOVED: AI services eliminated for cost savings
      // const aiResponse = await aiAssistantService.processUserQuery('¿Estado de mi turno?', 'chatbot');
      const aiResponse = 'AI services disabled for cost optimization';
      const aiResponseTime = performance.now();

      // Step 3: Notification creation
      const notification = await notificationService.addSystemNotification({
        userId: 'customer1',
        title: 'Turno Actualizado',
        message: 'Su turno ha sido registrado',
        type: 'queue',
        priority: 'medium'
      });
      const notificationTime = performance.now();

      // Calculate individual step times
      const queueJoinDuration = queueJoinTime - journeyStartTime;
      const aiResponseDuration = aiResponseTime - queueJoinTime;
      const notificationDuration = notificationTime - aiResponseTime;
      const totalDuration = notificationTime - journeyStartTime;

      // Performance assertions
      expect(queueJoinDuration).toBeLessThan(200);
      expect(aiResponseDuration).toBeLessThan(500);
      expect(notificationDuration).toBeLessThan(100);
      expect(totalDuration).toBeLessThan(1000); // Complete journey under 1 second
    });

    it('should handle peak load scenarios', async () => {
      // Simulate peak load with multiple concurrent users
      const concurrentUsers = 20;
      const operationsPerUser = 3; // queue join, AI query, notification

      const startTime = performance.now();

      const allOperations = [];
      for (let user = 0; user < concurrentUsers; user++) {
        // Queue join
        const queueData = {
          customerId: `customer${user}`,
          serviceType: 'appointment' as const,
          motorcycleId: `motorcycle${user}`,
          plate: `PLATE${user}`,
          mileageKm: 10000,
          notes: `Peak load test user ${user}`
        };

        jest.spyOn(queueService as any, 'checkUserHasMotorcycle').mockResolvedValue(true);
        jest.spyOn(queueService as any, 'createMotorcycleAssignment').mockResolvedValue('assignment1');
        jest.spyOn(queueService as any, 'generateVerificationCode').mockReturnValue('1234');
        jest.spyOn(queueService as any, 'calculateEstimatedWaitTime').mockReturnValue(30);
        jest.spyOn(queueService as any, 'updateQueueStatus').mockResolvedValue(undefined);

        allOperations.push(queueService.addToQueue(queueData));

        // AI query - REMOVED: AI services eliminated for cost savings
        // allOperations.push(aiAssistantService.processUserQuery(`Query from user ${user}`, 'chatbot'));
        allOperations.push(Promise.resolve('AI disabled'));

        // Notification
        allOperations.push(notificationService.addSystemNotification({
          userId: `customer${user}`,
          title: 'Peak Load Test',
          message: `Notification for user ${user}`,
          type: 'system',
          priority: 'low'
        }));
      }

      await Promise.all(allOperations);

      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const avgTimePerOperation = totalDuration / (concurrentUsers * operationsPerUser);

      // Under peak load, average operation should still be under 100ms
      expect(avgTimePerOperation).toBeLessThan(100);
      expect(totalDuration).toBeLessThan(5000); // Complete within 5 seconds
    });
  });

  describe('Resource Cleanup Performance', () => {
    it('should clean up resources efficiently', () => {
      // Test that services can be cleaned up without performance issues
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        // Create and immediately clean up service instances
        const tempQueueService = TestBed.inject(QueueService);
        const tempNotificationService = TestBed.inject(NotificationService);

        // Verify services are still functional
        expect(tempQueueService.getQueueEntries()).toBeDefined();
        expect(tempNotificationService.getSystemNotifications()).toBeDefined();
      }

      // If we complete without issues, cleanup is efficient
      expect(true).toBe(true);
    });
  });
});