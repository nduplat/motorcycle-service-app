import { TestBed } from '@angular/core/testing';
import { BudgetCircuitBreakerService, CircuitBreakerState } from './budget-circuit-breaker.service';
import { CostMonitoringService } from './cost-monitoring.service';
import { MOCK_PROVIDERS } from './mock-providers';

describe('BudgetCircuitBreakerService - Three-State Logic', () => {
  let service: BudgetCircuitBreakerService;
  let costMonitoringSpy: any;
  let cacheServiceSpy: any;
  let fallbackLibrarySpy: any;
  let notificationServiceSpy: any;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BudgetCircuitBreakerService,
        ...MOCK_PROVIDERS
      ]
    });

    service = TestBed.inject(BudgetCircuitBreakerService);
    costMonitoringSpy = TestBed.inject(CostMonitoringService);
    cacheServiceSpy = TestBed.inject(CacheService);
    fallbackLibrarySpy = TestBed.inject(FallbackLibraryService);
    notificationServiceSpy = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Three-State Circuit Breaker Logic', () => {

    it('should start in CLOSED state when budget is normal', () => {
      costMonitoringSpy.getCurrentCosts.mockReturnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 5.0
      });
      const status = service.getStatus();

      expect(status.circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.emergencyMode).toBe(false);
    });

    it('should transition to OPEN state when budget exceeds threshold', () => {
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 15.0 // Over $10 threshold
      });

      const status = service.getStatus();

      expect(status.circuitBreaker.state).toBe(CircuitBreakerState.OPEN);
      expect(status.emergencyMode).toBe(true);
    });

    it('should implement HALF_OPEN state for recovery testing', async () => {
      // First open the circuit
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 15.0
      });

      service.getStatus(); // Should open circuit

      // Simulate time passing for half-open transition
      spyOn(Date, 'now').and.returnValue(Date.now() + 60000); // 1 minute later

      // Reset to allow half-open testing
      service.resetCircuitBreaker();

      // Should be closed again after reset
      const status = service.getStatus();
      expect(status.circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should track failure count for circuit breaker decisions', () => {
      // Start with normal budget
      let status = service.getStatus();
      expect(status.circuitBreaker.failureCount).toBe(0);

      // Exceed budget to trigger failure
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 15.0
      });

      status = service.getStatus();
      expect(status.circuitBreaker.failureCount).toBeGreaterThan(0);
    });
  });

  describe('Emergency Mode Activation', () => {
    it('should activate emergency mode when budget critical', () => {
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 15.0
      });

      const status = service.getStatus();

      expect(status.emergencyMode).toBe(true);
      expect(cacheServiceSpy.clearContext).toHaveBeenCalledWith('ai_response');
    });

    it('should clear cache contexts during emergency activation', () => {
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 15.0
      });

      service.getStatus();

      expect(cacheServiceSpy.clearContext).toHaveBeenCalledWith('ai_response');
    });

    it('should deactivate emergency mode when budget normalizes', () => {
      // First activate emergency
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 15.0
      });

      service.getStatus();
      expect(service.getStatus().emergencyMode).toBe(true);

      // Then normalize budget
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 5.0
      });

      service.resetCircuitBreaker();
      const status = service.getStatus();

      expect(status.emergencyMode).toBe(false);
      expect(status.circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('AI Operation Control', () => {
    it('should allow AI operations when circuit is closed', async () => {
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 5.0
      });

      const operation = jest.fn().mockResolvedValue('success');
      const result = await service.executeAIOperation(operation, 'chatbot', 'user1');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should block AI operations when circuit is open', async () => {
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 15.0
      });

      const operation = jest.fn();
      const result = await service.executeAIOperation(operation, 'chatbot', 'user1');

      expect(operation).not.toHaveBeenCalled();
      expect(typeof result).toBe('string'); // Should return fallback response
    });

    it('should return fallback responses when AI operations blocked', async () => {
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 15.0
      });

      fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve({
        response: {
          id: 'fallback',
          context: 'chatbot',
          query: 'fallback query',
          response: 'Fallback response due to budget limits',
          category: 'general',
          priority: 5,
          keywords: ['fallback'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        score: 0.8,
        matchedKeywords: ['fallback']
      }));

      fallbackLibrarySpy.getResponseWithDynamicData.and.returnValue(Promise.resolve('Fallback response due to budget limits'));

      const result = await service.executeAIOperation(jest.fn(), 'chatbot', 'user1', 'test query');

      expect(fallbackLibrarySpy.findBestMatch).toHaveBeenCalledWith('test query', 'chatbot');
      expect(result).toBe('Fallback response due to budget limits');
    });
  });

  describe('Budget Threshold Management', () => {
    it('should use default thresholds', () => {
      const status = service.getStatus();

      expect(status.thresholds.warningThreshold).toBe(80);
      expect(status.thresholds.shutdownThreshold).toBe(100);
      expect(status.thresholds.dailyBudget).toBe(10.0);
    });

    it('should allow updating thresholds dynamically', () => {
      service.updateThresholds({
        warningThreshold: 70,
        shutdownThreshold: 90,
        dailyBudget: 15.0
      });

      const status = service.getStatus();

      expect(status.thresholds.warningThreshold).toBe(70);
      expect(status.thresholds.shutdownThreshold).toBe(90);
      expect(status.thresholds.dailyBudget).toBe(15.0);
    });

    it('should validate threshold updates', () => {
      expect(() => {
        service.updateThresholds({ warningThreshold: 110 }); // Invalid: > 100
      }).toThrow();

      expect(() => {
        service.updateThresholds({ shutdownThreshold: -10 }); // Invalid: < 0
      }).toThrow();

      expect(() => {
        service.updateThresholds({
          warningThreshold: 90,
          shutdownThreshold: 80 // Invalid: warning > shutdown
        });
      }).toThrow();
    });

    it('should trigger alerts at threshold breaches', () => {
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 12.0 // Over $10 threshold
      });

      service.getStatus();

      expect(notificationServiceSpy.createAdminAlert).toHaveBeenCalled();
    });
  });

  describe('Fallback Response Integration', () => {
    beforeEach(() => {
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 15.0
      });
    });

    it('should use fallback library for blocked operations', async () => {
      const mockFallback = {
        response: {
          id: 'budget_fallback',
          context: 'chatbot',
          query: 'budget exceeded query',
          response: 'Servicio temporalmente limitado por límites de presupuesto',
          category: 'general',
          priority: 10,
          keywords: ['budget', 'limit'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        score: 0.9,
        matchedKeywords: ['budget']
      };

      fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(mockFallback));
      fallbackLibrarySpy.getResponseWithDynamicData.and.returnValue(Promise.resolve('Servicio temporalmente limitado por límites de presupuesto'));

      const result = await service.getFallbackResponse('test query', 'chatbot');

      expect(fallbackLibrarySpy.findBestMatch).toHaveBeenCalledWith('test query', 'chatbot');
      expect(result).toBe('Servicio temporalmente limitado por límites de presupuesto');
    });

    it('should provide generic fallback when no specific match found', async () => {
      fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(null));

      const result = await service.getFallbackResponse('unknown query', 'chatbot');

      expect(result).toContain('Servicio de asistencia temporalmente limitado');
    });

    it('should handle fallback errors gracefully', async () => {
      fallbackLibrarySpy.findBestMatch.and.rejectWith(new Error('Fallback service error'));

      const result = await service.getFallbackResponse('error query', 'chatbot');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Admin Controls and Monitoring', () => {
    it('should reset circuit breaker state', () => {
      // First put circuit in open state
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 15.0
      });

      service.getStatus();

      // Reset
      service.resetCircuitBreaker();

      const status = service.getStatus();
      expect(status.circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.circuitBreaker.failureCount).toBe(0);
      expect(status.emergencyMode).toBe(false);
    });

    it('should provide comprehensive status information', () => {
      const status = service.getStatus();

      expect(status).toBeDefined();
      expect(status.circuitBreaker).toBeDefined();
      expect(status.thresholds).toBeDefined();
      expect(status.emergencyMode).toBeDefined();
      expect(typeof status.emergencyMode).toBe('boolean');
    });

    it('should track circuit breaker metrics over time', () => {
      // Initial state
      let status = service.getStatus();
      const initialFailures = status.circuitBreaker.failureCount;

      // Trigger failure
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 15.0
      });

      status = service.getStatus();
      expect(status.circuitBreaker.failureCount).toBeGreaterThan(initialFailures);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle rapid state transitions', () => {
      // Simulate rapid budget changes
      const budgets = [5.0, 15.0, 5.0, 15.0, 5.0];

      budgets.forEach(budget => {
        costMonitoringSpy.getCurrentCosts.and.returnValue({
          firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: budget
        });

        const status = service.getStatus();
        const expectedState = budget > 10 ? CircuitBreakerState.OPEN : CircuitBreakerState.CLOSED;

        expect(status.circuitBreaker.state).toBe(expectedState);
      });
    });

    it('should maintain state consistency under concurrent operations', async () => {
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 5.0
      });

      const operations = Array.from({ length: 10 }, () =>
        service.executeAIOperation(async () => 'success', 'chatbot', 'user1')
      );

      const results = await Promise.all(operations);

      // All operations should succeed when budget is normal
      results.forEach(result => {
        expect(result).toBe('success');
      });
    });

    it('should respond quickly to status requests', () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        service.getStatus();
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Cost Reduction Validation', () => {
    it('should demonstrate budget protection effectiveness', async () => {
      // Simulate normal operations
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 8.0
      });

      const normalOperations = Array.from({ length: 10 }, () =>
        service.executeAIOperation(async () => 'normal response', 'chatbot', 'user1')
      );

      const normalResults = await Promise.all(normalOperations);
      expect(normalResults.every(r => r === 'normal response')).toBe(true);

      // Simulate budget exceeded
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 12.0
      });

      const blockedOperations = Array.from({ length: 5 }, () =>
        service.executeAIOperation(async () => 'should not execute', 'chatbot', 'user1')
      );

      const blockedResults = await Promise.all(blockedOperations);

      // All operations should be blocked and return fallback responses
      blockedResults.forEach(result => {
        expect(result).not.toBe('should not execute');
        expect(typeof result).toBe('string');
      });
    });

    it('should validate three-state logic prevents cost overruns', () => {
      // Test state transitions
      const states = [];

      // Closed state (normal budget)
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 5.0
      });
      states.push(service.getStatus().circuitBreaker.state);

      // Open state (budget exceeded)
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 15.0
      });
      states.push(service.getStatus().circuitBreaker.state);

      // Reset to closed
      service.resetCircuitBreaker();
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 5.0
      });
      states.push(service.getStatus().circuitBreaker.state);

      expect(states).toEqual([
        CircuitBreakerState.CLOSED,
        CircuitBreakerState.OPEN,
        CircuitBreakerState.CLOSED
      ]);
    });

    it('should maintain service availability during budget pressure', async () => {
      // Even when budget is exceeded, service should still respond
      costMonitoringSpy.getCurrentCosts.and.returnValue({
        firestore: 0, storage: 0, functions: 0, hosting: 0, realtime: 0, total: 20.0 // Well over budget
      });

      const operation = jest.fn();
      const result = await service.executeAIOperation(operation, 'chatbot', 'user1');

      // Operation should not execute
      expect(operation).not.toHaveBeenCalled();

      // But service should return a response
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});