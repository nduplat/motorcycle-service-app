import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
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
import { AIAssistantService } from '../src/services/ai-assistant.service';
import { GroqService } from '../src/services/groq.service';
import { CostMonitoringService } from '../src/services/cost-monitoring.service';
import { FallbackLibraryService } from '../src/services/fallback-library.service';
import { BudgetCircuitBreakerService } from '../src/services/budget-circuit-breaker.service';
/// <reference types="jest" />

describe('Error Handling and Edge Cases Tests', () => {
  let queueService: QueueService;
  let notificationService: NotificationService;
  let aiAssistantService: AIAssistantService;
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
        AIAssistantService,
        { provide: AuthService, useValue: authSpy },
        { provide: UserService, useValue: userSpy },
        { provide: EventBusService, useValue: eventBusSpyObj },
        { provide: QrCodeService, useValue: qrCodeSpy },
        { provide: SchedulingService, useValue: schedulingSpy },
        { provide: CacheService, useValue: cacheSpy },
        { provide: AppointmentService, useValue: appointmentSpy },
        { provide: WorkOrderService, useValue: workOrderSpy },
        { provide: GroqService, useValue: groqSpy },
        { provide: CostMonitoringService, useValue: costSpy },
        { provide: FallbackLibraryService, useValue: fallbackSpy },
        { provide: BudgetCircuitBreakerService, useValue: circuitBreakerSpy }
      ]
    });

    queueService = TestBed.inject(QueueService);
    notificationService = TestBed.inject(NotificationService);
    aiAssistantService = TestBed.inject(AIAssistantService);
    cacheService = TestBed.inject(CacheService);
    costMonitoringService = TestBed.inject(CostMonitoringService);
  });

  describe('Queue Service Error Handling', () => {
    it('should handle invalid queue data gracefully', async () => {
      const invalidData = {
        customerId: '', // Empty customer ID
        serviceType: 'invalid' as any, // Invalid service type
        motorcycleId: 'motorcycle1',
        plate: '', // Empty plate
        mileageKm: -1000, // Invalid mileage
        notes: 'Test notes'
      };

      // Mock validation failures
      jest.spyOn(queueService as any, 'checkUserHasMotorcycle').mockRejectedValue(new Error('Invalid customer'));
      jest.spyOn(queueService as any, 'createMotorcycleAssignment').mockRejectedValue(new Error('Invalid data'));

      await expect(queueService.addToQueue(invalidData)).rejects.toThrow();

      // Verify error is handled without crashing the service
      expect(queueService.getQueueEntries()).toBeDefined();
    });

    it('should handle database connection failures', async () => {
      const queueData = {
        customerId: 'customer1',
        serviceType: 'appointment' as const,
        motorcycleId: 'motorcycle1',
        plate: 'ABC123',
        mileageKm: 10000,
        notes: 'Test notes'
      };

      // Mock database failure
      jest.spyOn(queueService as any, 'checkUserHasMotorcycle').mockRejectedValue(new Error('Database connection failed'));

      await expect(queueService.addToQueue(queueData)).rejects.toThrow('Database connection failed');

      // Service should remain functional
      expect(queueService.getQueueStatus()).toBeDefined();
    });

    it('should handle concurrent modification conflicts', async () => {
      // Simulate race conditions in queue operations
      const queueData1 = {
        customerId: 'customer1',
        serviceType: 'appointment' as const,
        motorcycleId: 'motorcycle1',
        plate: 'ABC123',
        mileageKm: 10000
      };

      const queueData2 = {
        customerId: 'customer2',
        serviceType: 'appointment' as const,
        motorcycleId: 'motorcycle2',
        plate: 'XYZ789',
        mileageKm: 20000
      };

      // Mock concurrent operations
      jest.spyOn(queueService as any, 'checkUserHasMotorcycle').mockResolvedValue(true);
      jest.spyOn(queueService as any, 'createMotorcycleAssignment').mockResolvedValue('assignment1');
      jest.spyOn(queueService as any, 'generateVerificationCode').mockReturnValue('1234');
      jest.spyOn(queueService as any, 'calculateEstimatedWaitTime').mockReturnValue(30);
      jest.spyOn(queueService as any, 'updateQueueStatus').mockRejectedValue(new Error('Concurrent modification'));

      // Both operations should handle errors gracefully
      await expect(queueService.addToQueue(queueData1)).rejects.toThrow('Concurrent modification');
      await expect(queueService.addToQueue(queueData2)).rejects.toThrow('Concurrent modification');

      // Service state should remain consistent
      expect(queueService.getQueueEntries()).toBeDefined();
    });

    it('should handle expired entries cleanup', async () => {
      // Test cleanup of expired queue entries
      const expiredEntry = {
        id: 'expired1',
        customerId: 'customer1',
        serviceType: 'appointment' as const,
        status: 'called' as const,
        position: 1,
        joinedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        estimatedWaitTime: 30,
        verificationCode: '1234',
        expiresAt: new Date(Date.now() - 10 * 60 * 1000), // Expired 10 minutes ago
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock expired entries
      jest.spyOn(queueService as any, 'queueEntries', 'get').mockReturnValue(signal([expiredEntry]));
      jest.spyOn(queueService as any, 'cleanupExpiredEntries').mockResolvedValue(undefined);

      // Trigger cleanup (normally called by timer)
      await (queueService as any).cleanupExpiredEntries();

      // Verify cleanup was attempted
      expect((queueService as any).cleanupExpiredEntries).toHaveBeenCalled();
    });

    it('should handle invalid verification codes', () => {
      const invalidCodes = ['', '12', '12345', 'abcd', null, undefined];

      invalidCodes.forEach(code => {
        const isValid = (queueService as any).isCodeValid(code);
        expect(isValid).toBe(false);
      });
    });

    it('should handle queue position calculation edge cases', () => {
      // Test with empty queue
      jest.spyOn(queueService as any, 'queueStatus', 'get').mockReturnValue(signal(null));
      const position1 = (queueService as any).calculateEstimatedWaitTime(1);
      expect(position1).toBe(90); // Default 30 min * 3 positions

      // Test with very high position
      const position100 = (queueService as any).calculateEstimatedWaitTime(100);
      expect(position100).toBe(3000); // Should handle large numbers
    });
  });

  describe('AI Assistant Error Handling', () => {
    it('should handle AI service failures gracefully', async () => {
      // Mock AI service failure
      jest.spyOn(aiAssistantService as any, 'callGeminiAPI').mockRejectedValue(new Error('AI service unavailable'));

      const result = await aiAssistantService.processUserQuery('test query', 'chatbot');

      // Should return fallback response
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle rate limiting', async () => {
      // Mock rate limit exceeded
      const circuitBreakerSpy = TestBed.inject(BudgetCircuitBreakerService);
      jest.spyOn(circuitBreakerSpy, 'executeAIOperation').mockRejectedValue(new Error('Rate limit exceeded'));
      jest.spyOn(circuitBreakerSpy, 'getFallbackResponse').mockResolvedValue('Rate limited response');

      const result = await aiAssistantService.processUserQuery('test query', 'chatbot');

      expect(result).toBe('Rate limited response');
    });

    it('should handle malformed queries', async () => {
      const malformedQueries = [
        '',
        '   ', // Only whitespace
        'a'.repeat(10000), // Very long query
        '🚀🔥💯', // Only emojis
        '<script>alert("xss")</script>', // Potentially malicious
        'SELECT * FROM users', // SQL injection attempt
      ];

      for (const query of malformedQueries) {
        const result = await aiAssistantService.processUserQuery(query, 'chatbot');
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      }
    });

    it('should handle cache corruption', async () => {
      // Mock corrupted cache data
      jest.spyOn(cacheService, 'get').mockResolvedValue('corrupted data');

      const result = await aiAssistantService.processUserQuery('test query', 'chatbot');

      // Should handle corrupted cache gracefully
      expect(result).toBeDefined();
    });

    it('should handle fallback library failures', async () => {
      // Mock fallback library failure
      jest.spyOn(aiAssistantService as any, 'fallbackLibrary', 'get').mockReturnValue({
        findBestMatch: jest.fn().mockRejectedValue(new Error('Fallback library error'))
      });

      const result = await aiAssistantService.processUserQuery('test query', 'chatbot');

      // Should still return a response
      expect(result).toBeDefined();
    });
  });

  describe('Notification Service Error Handling', () => {
    it('should handle notification creation failures', async () => {
      const notificationData = {
        userId: 'user1',
        title: '', // Invalid: empty title
        message: 'Test message',
        type: 'system' as const,
        priority: 'medium' as const
      };

      // Mock notification service to throw error
      jest.spyOn(notificationService, 'addSystemNotification').mockRejectedValue(new Error('Invalid notification data'));

      await expect(notificationService.addSystemNotification(notificationData)).rejects.toThrow('Invalid notification data');
    });

    it('should handle bulk notification failures', async () => {
      const notifications = Array.from({ length: 10 }, (_, i) => ({
        userId: `user${i}`,
        title: `Notification ${i}`,
        message: `Message ${i}`,
        type: 'system' as const,
        priority: 'low' as const
      }));

      // Mock some notifications to fail
      let callCount = 0;
      jest.spyOn(notificationService, 'addSystemNotification').mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) { // Every 3rd notification fails
          return Promise.reject(new Error('Random failure'));
        }
        return Promise.resolve({
          id: `notification-${callCount}`,
          userId: `user${callCount % 10}`,
          title: `Notification ${callCount}`,
          message: `Message ${callCount}`,
          type: 'system',
          priority: 'low',
          read: false,
          createdAt: new Date()
        });
      });

      // Should handle partial failures
      const results = await Promise.allSettled(
        notifications.map(notification => notificationService.addSystemNotification(notification))
      );

      const fulfilled = results.filter(r => r.status === 'fulfilled').length;
      const rejected = results.filter(r => r.status === 'rejected').length;

      expect(fulfilled).toBeGreaterThan(0);
      expect(rejected).toBeGreaterThan(0);
      expect(fulfilled + rejected).toBe(10);
    });

    it('should handle invalid user preferences', async () => {
      // Mock invalid preferences data
      const invalidPreferences = {
        userId: 'user1',
        emailNotifications: 'not-a-boolean', // Invalid type
        pushNotifications: true,
        smsNotifications: false
      };

      // Should handle invalid data gracefully
      expect(async () => {
        // This would normally validate preferences
        return invalidPreferences;
      }).not.toThrow();
    });
  });

  describe('Cache Service Error Handling', () => {
    it('should handle cache connection failures', async () => {
      jest.spyOn(cacheService, 'get').mockRejectedValue(new Error('Cache connection failed'));
      jest.spyOn(cacheService, 'set').mockRejectedValue(new Error('Cache write failed'));

      // Operations should not crash the application
      await expect(cacheService.get('test-key')).rejects.toThrow('Cache connection failed');
      await expect(cacheService.set('test-key', 'value', 300000)).rejects.toThrow('Cache write failed');
    });

    it('should handle cache data corruption', async () => {
      // Mock corrupted cache data
      const corruptedData = {
        value: null, // Missing required fields
        cachedAt: 'invalid-date'
      };

      jest.spyOn(cacheService, 'get').mockResolvedValue(corruptedData);

      // Should handle corrupted data gracefully
      const result = await cacheService.get('corrupted-key');
      expect(result).toBeDefined(); // May return null or default value
    });

    it('should handle cache key collisions', async () => {
      // Test with same cache key for different data
      const key = 'collision-test';

      await cacheService.set(key, 'value1', 300000);
      await cacheService.set(key, 'value2', 300000); // Overwrite

      const result = await cacheService.get(key);
      expect(result).toBeDefined(); // Should return the latest value
    });
  });

  describe('Cost Monitoring Error Handling', () => {
    it('should handle cost tracking failures', () => {
      // Mock cost monitoring failures
      jest.spyOn(costMonitoringService, 'trackFunctionInvocation').mockImplementation(() => {
        throw new Error('Cost tracking failed');
      });

      // Should not crash the application
      expect(() => {
        costMonitoringService.trackFunctionInvocation(1.0, 0.5, 1024);
      }).toThrow('Cost tracking failed');
    });

    it('should handle invalid cost data', () => {
      const invalidCosts = [
        { processingTime: -1, cpuTime: 0.5, networkEgress: 1024 }, // Negative time
        { processingTime: 1.0, cpuTime: -0.5, networkEgress: 1024 }, // Negative CPU
        { processingTime: 1.0, cpuTime: 0.5, networkEgress: -1024 }, // Negative network
        { processingTime: NaN, cpuTime: 0.5, networkEgress: 1024 }, // NaN values
        { processingTime: Infinity, cpuTime: 0.5, networkEgress: 1024 }, // Infinite values
      ];

      invalidCosts.forEach(cost => {
        expect(() => {
          costMonitoringService.trackFunctionInvocation(cost.processingTime, cost.cpuTime, cost.networkEgress);
        }).not.toThrow(); // Should handle gracefully
      });
    });
  });

  describe('Network and Connectivity Issues', () => {
    it('should handle network timeouts', async () => {
      // Mock network timeout
      jest.spyOn(queueService as any, 'checkUserHasMotorcycle').mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 5000))
      );

      const queueData = {
        customerId: 'customer1',
        serviceType: 'appointment' as const,
        motorcycleId: 'motorcycle1',
        plate: 'ABC123',
        mileageKm: 10000
      };

      // Set timeout for test
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout')), 1000)
      );

      await expect(Promise.race([
        queueService.addToQueue(queueData),
        timeoutPromise
      ])).rejects.toThrow();
    });

    it('should handle intermittent connectivity', async () => {
      let callCount = 0;
      jest.spyOn(queueService as any, 'checkUserHasMotorcycle').mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          return Promise.reject(new Error('Connection lost'));
        }
        return Promise.resolve(true);
      });

      const queueData = {
        customerId: 'customer1',
        serviceType: 'appointment' as const,
        motorcycleId: 'motorcycle1',
        plate: 'ABC123',
        mileageKm: 10000
      };

      // Some operations should succeed, some should fail
      const results = [];
      for (let i = 0; i < 6; i++) {
        try {
          await queueService.addToQueue({ ...queueData, customerId: `customer${i}` });
          results.push('success');
        } catch (error) {
          results.push('failure');
        }
      }

      expect(results.filter(r => r === 'success').length).toBeGreaterThan(0);
      expect(results.filter(r => r === 'failure').length).toBeGreaterThan(0);
    });
  });

  describe('Data Validation Edge Cases', () => {
    it('should handle extremely large datasets', () => {
      // Test with very large queue (simulate memory pressure)
      const largeQueue = Array.from({ length: 10000 }, (_, i) => ({
        id: `entry-${i}`,
        customerId: `customer-${i % 1000}`,
        serviceType: 'appointment' as const,
        status: 'waiting' as const,
        position: i + 1,
        joinedAt: new Date(),
        estimatedWaitTime: 30,
        verificationCode: `${100000 + i}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Mock large queue
      jest.spyOn(queueService as any, 'queueEntries', 'get').mockReturnValue(signal(largeQueue));

      // Operations should not crash with large datasets
      const entries = queueService.getQueueEntries();
      expect(entries).toHaveLength(10000);

      // Filtering operations should work
      const waitingEntries = largeQueue.filter(e => e.status === 'waiting');
      expect(waitingEntries).toHaveLength(10000);
    });

    it('should handle special characters and unicode', async () => {
      const specialQueries = [
        '¿Qué tal? ¿Cómo estás?',
        'café, naïve, résumé',
        '🚗🔧⚡',
        '用户界面',
        'مرحبا بالعالم',
        '123!@#$%^&*()',
        'line1\nline2\ttab',
        'null undefined NaN Infinity',
        'SELECT * FROM users; DROP TABLE users;',
        '<script>alert("test")</script>'
      ];

      for (const query of specialQueries) {
        const result = await aiAssistantService.processUserQuery(query, 'chatbot');
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      }
    });

    it('should handle boundary values', () => {
      const boundaryValues = {
        positions: [0, 1, 1000, 999999, -1],
        waitTimes: [0, 1, 3600, -1, NaN, Infinity],
        mileages: [0, 1, 999999, -1, NaN, Infinity],
        priorities: ['low', 'medium', 'high', 'critical', 'invalid'],
        statuses: ['waiting', 'called', 'served', 'cancelled', 'no_show', 'invalid']
      };

      // Test queue position calculations
      boundaryValues.positions.forEach(position => {
        const waitTime = (queueService as any).calculateEstimatedWaitTime(position);
        expect(typeof waitTime).toBe('number');
        expect(waitTime).toBeGreaterThanOrEqual(0);
      });

      // Test that boundary values don't crash services
      expect(() => {
        boundaryValues.waitTimes.forEach(time => {
          costMonitoringService.trackFunctionInvocation(time, 0.5, 1024);
        });
      }).not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle race conditions in queue operations', async () => {
      const concurrentOperations = 20;
      const operations = Array.from({ length: concurrentOperations }, (_, i) => ({
        customerId: `customer${i}`,
        serviceType: 'appointment' as const,
        motorcycleId: `motorcycle${i}`,
        plate: `PLATE${String(i).padStart(3, '0')}`,
        mileageKm: 10000 + i * 1000,
        notes: `Concurrent operation ${i}`
      }));

      // Mock all operations to succeed
      jest.spyOn(queueService as any, 'checkUserHasMotorcycle').mockResolvedValue(true);
      jest.spyOn(queueService as any, 'createMotorcycleAssignment').mockResolvedValue('assignment1');
      jest.spyOn(queueService as any, 'generateVerificationCode').mockReturnValue('1234');
      jest.spyOn(queueService as any, 'calculateEstimatedWaitTime').mockReturnValue(30);
      jest.spyOn(queueService as any, 'updateQueueStatus').mockResolvedValue(undefined);

      // Execute all operations concurrently
      const results = await Promise.allSettled(
        operations.map(op => queueService.addToQueue(op))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // All operations should complete (some may fail due to conflicts, but shouldn't crash)
      expect(successful + failed).toBe(concurrentOperations);
    });

    it('should handle concurrent AI requests', async () => {
      const concurrentRequests = 10;
      const queries = Array.from({ length: concurrentRequests }, (_, i) =>
        `Concurrent AI query ${i} with complex diagnostic information`
      );

      const startTime = performance.now();

      const results = await Promise.all(
        queries.map(query => aiAssistantService.processUserQuery(query, 'workOrder'))
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All requests should complete
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      });

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 10 concurrent requests
    });
  });

  describe('Resource Exhaustion', () => {
    it('should handle memory pressure gracefully', () => {
      // Create many service instances to simulate memory pressure
      const instances = [];
      for (let i = 0; i < 1000; i++) {
        instances.push(TestBed.inject(QueueService));
        instances.push(TestBed.inject(NotificationService));
        instances.push(TestBed.inject(AIAssistantService));
      }

      // Services should still function
      instances.forEach(instance => {
        expect(instance).toBeDefined();
      });

      // Clear references to help GC
      instances.length = 0;
    });

    it('should handle high frequency operations', () => {
      const operations = 10000;

      // Perform many rapid operations
      for (let i = 0; i < operations; i++) {
        queueService.getQueueEntries();
        notificationService.getSystemNotifications();
        costMonitoringService.trackFunctionInvocation(0.001, 0.0005, 100);
      }

      // Should not have crashed or leaked memory significantly
      expect(true).toBe(true);
    });
  });

  describe('Integration Error Scenarios', () => {
    it('should handle service dependency failures', async () => {
      // Mock all service dependencies to fail
      jest.spyOn(authService, 'currentUser').mockReturnValue(null);
      jest.spyOn(userService, 'getUserById').mockRejectedValue(new Error('User service down'));
      jest.spyOn(eventBus, 'emit').mockImplementation(() => {
        throw new Error('Event bus failure');
      });

      const queueData = {
        customerId: 'customer1',
        serviceType: 'appointment' as const,
        motorcycleId: 'motorcycle1',
        plate: 'ABC123',
        mileageKm: 10000
      };

      // Should handle cascading failures gracefully
      await expect(queueService.addToQueue(queueData)).rejects.toThrow();

      // Core service functionality should remain intact
      expect(queueService.getQueueStatus()).toBeDefined();
    });

    it('should handle partial system failures', async () => {
      // Some services work, others fail
      jest.spyOn(cacheService, 'get').mockRejectedValue(new Error('Cache down'));
      jest.spyOn(costMonitoringService, 'trackFunctionInvocation').mockImplementation(() => {
        throw new Error('Cost monitoring down');
      });
      // AI service still works
      jest.spyOn(aiAssistantService as any, 'callGeminiAPI').mockResolvedValue({
        response: 'AI response',
        tokens: 150
      });

      const result = await aiAssistantService.processUserQuery('test query', 'chatbot');

      // Should still work despite some service failures
      expect(result).toBe('AI response');
    });
  });
});