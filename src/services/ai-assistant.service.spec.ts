import { TestBed } from '@angular/core/testing';
// import { AIAssistantService } from './ai-assistant.service'; // REMOVED: AI services eliminated for cost savings
// import { GroqService } from './groq.service'; // REMOVED: AI services eliminated for cost savings
import { NotificationService } from './notification.service';
import { QueueService } from './queue.service';
import { InventoryReportsService } from './inventory-reports.service';
import { ProductService } from './product.service';
import { UserService } from './user.service';
import { UserVehicleService } from './user-vehicle.service';
import { CostMonitoringService } from './cost-monitoring.service';
import { CacheService } from './cache.service';
import { FallbackLibraryService } from './fallback-library.service';
import { BudgetCircuitBreakerService } from './budget-circuit-breaker.service';
import { of } from 'rxjs';

// REMOVED: AI services eliminated for cost savings
// describe('AIAssistantService - Cost Optimization', () => {
describe('AI Services Removed - Cost Optimization', () => {
  // let service: AIAssistantService; // REMOVED: AI services eliminated for cost savings
  // let groqServiceSpy: any; // REMOVED: AI services eliminated for cost savings
  let notificationServiceSpy: any;
  let queueServiceSpy: any;
  let inventoryReportsServiceSpy: any;
  let productServiceSpy: any;
  let userServiceSpy: any;
  let userVehicleServiceSpy: any;
  let costMonitoringSpy: any;
  let cacheServiceSpy: any;
  let fallbackLibrarySpy: any;
  let budgetCircuitBreakerSpy: any;

  beforeEach(() => {
    const groqSpy = jasmine.createSpyObj('GroqService', ['analyzeText', 'generateResponse', 'isConfigured']);
    const notificationSpy = jasmine.createSpyObj('NotificationService', [
      'createInventoryAlert', 'createCategorizedNotification', 'createQueueNotification',
      'createMaintenanceReminder', 'getSystemNotifications', 'getUnreadCount'
    ]);
    const queueSpy = jasmine.createSpyObj('QueueService', ['getQueueStatus', 'getQueueEntries']);
    const inventorySpy = jasmine.createSpyObj('InventoryReportsService', [
      'getStockReportByLocation', 'getLowStockReport', 'getProductRotationReport', 'getTopSellingProducts'
    ]);
    const productSpy = jasmine.createSpyObj('ProductService', ['getProducts']);
    const userSpy = jasmine.createSpyObj('UserService', ['getUsers']);
    const userVehicleSpy = jasmine.createSpyObj('UserVehicleService', ['getVehiclesForUser']);
    const costSpy = jasmine.createSpyObj('CostMonitoringService', [
      'trackFunctionInvocation', 'getCurrentCosts', 'getUsageHistory'
    ]);
    const cacheSpy = jasmine.createSpyObj('CacheService', [
      'get', 'set', 'generateSemanticKey', 'clearContext'
    ]);
    const fallbackSpy = jasmine.createSpyObj('FallbackLibraryService', [
      'findBestMatch', 'getResponseWithDynamicData', 'addResponse', 'getStats'
    ]);
    const circuitBreakerSpy = jasmine.createSpyObj('BudgetCircuitBreakerService', [
      'executeAIOperation', 'getStatus', 'resetCircuitBreaker', 'updateThresholds', 'getFallbackResponse'
    ]);

    // REMOVED: AI services eliminated for cost savings
    // TestBed.configureTestingModule({
    //   providers: [
    //     AIAssistantService,
    //     { provide: GroqService, useValue: groqSpy },
    //     { provide: NotificationService, useValue: notificationSpy },
    //     { provide: QueueService, useValue: queueSpy },
    //     { provide: InventoryReportsService, useValue: inventorySpy },
    //     { provide: ProductService, useValue: productSpy },
    //     { provide: UserService, useValue: userSpy },
    //     { provide: UserVehicleService, useValue: userVehicleSpy },
    //     { provide: CostMonitoringService, useValue: costSpy },
    //     { provide: CacheService, useValue: cacheSpy },
    //     { provide: FallbackLibraryService, useValue: fallbackSpy },
    //     { provide: BudgetCircuitBreakerService, useValue: circuitBreakerSpy }
    //   ]
    // });

    // service = TestBed.inject(AIAssistantService);
    // groqServiceSpy = TestBed.inject(GroqService);
    notificationServiceSpy = TestBed.inject(NotificationService);
    queueServiceSpy = TestBed.inject(QueueService);
    inventoryReportsServiceSpy = TestBed.inject(InventoryReportsService);
    productServiceSpy = TestBed.inject(ProductService);
    userServiceSpy = TestBed.inject(UserService);
    userVehicleServiceSpy = TestBed.inject(UserVehicleService);
    costMonitoringSpy = TestBed.inject(CostMonitoringService);
    cacheServiceSpy = TestBed.inject(CacheService);
    fallbackLibrarySpy = TestBed.inject(FallbackLibraryService);
    budgetCircuitBreakerSpy = TestBed.inject(BudgetCircuitBreakerService);
  });

  // REMOVED: AI services eliminated for cost savings
  // it('should be created', () => {
  //   expect(service).toBeTruthy();
  // });

  // REMOVED: AI services eliminated for cost savings
  // describe('Cost Optimization Features', () => {
  //   beforeEach(() => {
  //     // Setup common mocks
  //     groqServiceSpy.isConfigured.and.returnValue(true);
  //     cacheServiceSpy.get.and.returnValue(Promise.resolve(null));
  //     fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(null));
  //     budgetCircuitBreakerSpy.executeAIOperation.and.callFake(async (operation: any) => {
  //       return await operation();
  //     });
  //   });

    // REMOVED: AI services eliminated for cost savings
    // describe('Fallback Response Priority', () => {
    //   it('should use fallback response for common queries to avoid AI costs', async () => {
    //     const mockFallback = {
    //       response: {
    //         id: 'horario',
    //         context: 'chatbot',
    //         query: 'horario',
    //         response: 'Horario: Lunes a Viernes 8:00-18:00',
    //         category: 'general',
    //         priority: 9,
    //         keywords: ['horario'],
    //         createdAt: new Date(),
    //         updatedAt: new Date()
    //       },
    //       score: 0.95,
    //       matchedKeywords: ['horario']
    //     };

    //     fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(mockFallback));
    //     fallbackLibrarySpy.getResponseWithDynamicData.and.returnValue(Promise.resolve('Horario: Lunes a Viernes 8:00-18:00'));

    //     const result = await service.processUserQuery('¿Cuál es el horario?', 'chatbot');

    //     expect(fallbackLibrarySpy.findBestMatch).toHaveBeenCalledWith('¿Cuál es el horario?', 'chatbot');
    //     expect(fallbackLibrarySpy.getResponseWithDynamicData).toHaveBeenCalled();
    //     expect(costMonitoringSpy.trackFunctionInvocation).not.toHaveBeenCalled();
    //     expect(result).toBe('Horario: Lunes a Viernes 8:00-18:00');
    //   });

    //   it('should skip fallback for complex queries requiring AI analysis', async () => {
    //     fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(null));
    //     groqServiceSpy.generateResponse.and.returnValue(Promise.resolve('Complex AI analysis response'));
    //     cacheServiceSpy.generateSemanticKey.and.returnValue('complex_diagnosis');
    //     cacheServiceSpy.set.and.returnValue(Promise.resolve());

    //     const result = await service.processUserQuery('diagnóstico complejo motor pierde potencia', 'workOrder');

    //     expect(fallbackLibrarySpy.findBestMatch).toHaveBeenCalled();
    //     expect(groqServiceSpy.generateResponse).toHaveBeenCalled();
    //     expect(costMonitoringSpy.trackFunctionInvocation).toHaveBeenCalled();
    //     expect(cacheServiceSpy.set).toHaveBeenCalled();
    //   });
    // });

    // describe('Intelligent Caching', () => {
    //   it('should return cached response to reduce AI calls', async () => {
    //     const cachedResponse = 'Cached response for common query';
    //     cacheServiceSpy.get.and.returnValue(Promise.resolve(cachedResponse));
    //     fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(null));

    //     const result = await service.processUserQuery('cached query', 'chatbot');

    //     expect(cacheServiceSpy.get).toHaveBeenCalled();
    //     expect(result).toBe(cachedResponse);
    //     expect(groqServiceSpy.generateResponse).not.toHaveBeenCalled();
    //     expect(costMonitoringSpy.trackFunctionInvocation).toHaveBeenCalledWith(0.05, 0.05, 0); // Minimal cost for cache hit
    //   });

    //   it('should generate semantic cache keys for similar queries', async () => {
    //     fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(null));
    //     groqServiceSpy.generateResponse.and.returnValue(Promise.resolve('AI response'));
    //     cacheServiceSpy.generateSemanticKey.and.returnValue('chatbot_general');
    //     cacheServiceSpy.set.and.returnValue(Promise.resolve());

    //     await service.processUserQuery('consulta general', 'chatbot');

    //     expect(cacheServiceSpy.generateSemanticKey).toHaveBeenCalledWith('consulta general', 'chatbot');
    //     expect(cacheServiceSpy.set).toHaveBeenCalledWith(
    //       jasmine.stringMatching(/^ai_query_chatbot_general_\d+$/),
    //       'AI response',
    //       30 * 60 * 1000, // 30 minutes
    //       'ai_assistant',
    //       undefined,
    //       'chatbot_general',
    //       ['ai_response', 'chatbot'],
    //       'medium'
    //     );
    //   });

    //   it('should cache responses with appropriate TTL and priority', async () => {
    //     fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(null));
    //     groqServiceSpy.generateResponse.and.returnValue(Promise.resolve('AI response'));
    //     cacheServiceSpy.generateSemanticKey.and.returnValue('scanner_diagnosis');
    //     cacheServiceSpy.set.and.returnValue(Promise.resolve());

    //     await service.processUserQuery('scanner query', 'scanner');

    //     expect(cacheServiceSpy.set).toHaveBeenCalledWith(
    //       jasmine.any(String),
    //       'AI response',
    //       30 * 60 * 1000,
    //       'ai_assistant',
    //       undefined,
    //       'scanner_diagnosis',
    //       ['ai_response', 'scanner'],
    //       'medium'
    //     );
    //   });
    // });

    // describe('Budget Circuit Breaker Integration', () => {
    //   it('should execute AI operations through budget circuit breaker', async () => {
    //     fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(null));
    //     groqServiceSpy.generateResponse.and.returnValue(Promise.resolve('AI response'));
    //     budgetCircuitBreakerSpy.executeAIOperation.and.callFake(async (operation: any, context: any, userId: any, query: any) => {
    //       const result = await operation();
    //       return result;
    //     });

    //     await service.processUserQuery('test query', 'chatbot');

    //     expect(budgetCircuitBreakerSpy.executeAIOperation).toHaveBeenCalledWith(
    //       jasmine.any(Function),
    //       'chatbot',
    //       'anonymous',
    //       'test query'
    //     );
    //   });

    //   it('should return fallback response when circuit breaker blocks AI operation', async () => {
    //     const circuitBreakerError = new Error('Circuit breaker open');
    //     circuitBreakerError.name = 'CircuitBreakerError';

    //     budgetCircuitBreakerSpy.executeAIOperation.and.rejectWith(circuitBreakerError);
    //     budgetCircuitBreakerSpy.getFallbackResponse.and.returnValue(Promise.resolve('Fallback response'));

    //     const result = await service.processUserQuery('blocked query', 'chatbot');

    //     expect(budgetCircuitBreakerSpy.getFallbackResponse).toHaveBeenCalledWith('blocked query', 'chatbot');
    //     expect(result).toBe('Fallback response');
    //   });
    // });

    // describe('Cost Tracking Integration', () => {
    //   it('should track AI processing costs accurately', async () => {
    //     fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(null));
    //     groqServiceSpy.generateResponse.and.returnValue(Promise.resolve('AI response'));
    //     cacheServiceSpy.set.and.returnValue(Promise.resolve());

    //     // Mock Date.now to control timing
    //     const originalNow = Date.now;
    //     let callCount = 0;
    //     spyOn(Date, 'now').and.callFake(() => {
    //       callCount++;
    //       return originalNow() + (callCount * 1000); // 1 second processing time
    //     });

    //     await service.processUserQuery('cost tracking test', 'chatbot');

    //     expect(costMonitoringSpy.trackFunctionInvocation).toHaveBeenCalledWith(
    //       1.0, // 1 second processing time
    //       0.5, // Rough CPU estimate (processingTime / 2000)
    //       0    // No network egress
    //     );
    //   });

    //   it('should not track costs for cached responses', async () => {
    //     cacheServiceSpy.get.and.returnValue(Promise.resolve('Cached response'));
    //     fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(null));

    //     await service.processUserQuery('cached query', 'chatbot');

    //     expect(costMonitoringSpy.trackFunctionInvocation).toHaveBeenCalledWith(0.05, 0.05, 0);
    //     expect(groqServiceSpy.generateResponse).not.toHaveBeenCalled();
    //   });

    //   it('should not track costs for fallback responses', async () => {
    //     const mockFallback = {
    //       response: {
    //         id: 'fallback',
    //         context: 'chatbot',
    //         query: 'fallback query',
    //         response: 'Fallback response',
    //         category: 'general',
    //         priority: 5,
    //         keywords: ['fallback'],
    //         createdAt: new Date(),
    //         updatedAt: new Date()
    //       },
    //       score: 0.8,
    //       matchedKeywords: ['fallback']
    //     };

    //     fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(mockFallback));
    //     fallbackLibrarySpy.getResponseWithDynamicData.and.returnValue(Promise.resolve('Fallback response'));

    //     await service.processUserQuery('fallback query', 'chatbot');

    //     expect(costMonitoringSpy.trackFunctionInvocation).not.toHaveBeenCalled();
    //     expect(groqServiceSpy.generateResponse).not.toHaveBeenCalled();
    //   });
    // });

    // describe('Performance Optimization', () => {
    //   it('should process fallback responses in under 50ms', async () => {
    //     const mockFallback = {
    //       response: {
    //         id: 'fast_fallback',
    //         context: 'chatbot',
    //         query: 'fast query',
    //         response: 'Fast fallback response',
    //         category: 'general',
    //         priority: 10,
    //         keywords: ['fast'],
    //         createdAt: new Date(),
    //         updatedAt: new Date()
    //       },
    //       score: 1.0,
    //       matchedKeywords: ['fast']
    //     };

    //     fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(mockFallback));
    //     fallbackLibrarySpy.getResponseWithDynamicData.and.returnValue(Promise.resolve('Fast fallback response'));

    //     const startTime = Date.now();
    //     await service.processUserQuery('fast query', 'chatbot');
    //     const duration = Date.now() - startTime;

    //     expect(duration).toBeLessThan(50);
    //   });

    //   it('should process cached responses in under 200ms', async () => {
    //     cacheServiceSpy.get.and.returnValue(Promise.resolve('Cached response'));
    //     fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(null));

    //     const startTime = Date.now();
    //     await service.processUserQuery('cached query', 'chatbot');
    //     const duration = Date.now() - startTime;

    //     expect(duration).toBeLessThan(200);
    //   });
    // });

    // describe('Cost Reduction Validation', () => {
    //   it('should achieve target cost reduction through optimization pipeline', async () => {
    //     // Simulate 100 queries with realistic distribution
    //     const queries = [
    //       // 70% cached/fallback (cost-free)
    //       ...Array(50).fill('fallback'),
    //       ...Array(20).fill('cached'),
    //       // 30% AI calls (costly)
    //       ...Array(30).fill('ai')
    //     ];

    //     let aiCallCount = 0;
    //     let cacheHitCount = 0;
    //     let fallbackCount = 0;

    //     for (const queryType of queries) {
    //       if (queryType === 'fallback') {
    //         fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve({
    //           response: {
    //             id: 'fallback',
    //             context: 'chatbot',
    //             query: 'fallback',
    //             response: 'Fallback',
    //               category: 'general',
    //               priority: 5,
    //               keywords: ['fallback'],
    //               createdAt: new Date(),
    //               updatedAt: new Date()
    //             },
    //             score: 0.8,
    //             matchedKeywords: ['fallback']
    //           }));
    //           fallbackLibrarySpy.getResponseWithDynamicData.and.returnValue(Promise.resolve('Fallback response'));
    //           fallbackCount++;
    //         } else if (queryType === 'cached') {
    //           cacheServiceSpy.get.and.returnValue(Promise.resolve('Cached response'));
    //           cacheHitCount++;
    //         } else {
    //           fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(null));
    //           cacheServiceSpy.get.and.returnValue(Promise.resolve(null));
    //           groqServiceSpy.generateResponse.and.returnValue(Promise.resolve('AI response'));
    //           cacheServiceSpy.set.and.returnValue(Promise.resolve());
    //           aiCallCount++;
    //         }

    //         await service.processUserQuery(`${queryType} query ${Math.random()}`, 'chatbot');
    //       }

    //       const totalQueries = queries.length;
    //       const costFreeQueries = cacheHitCount + fallbackCount;
    //       const reductionRate = ((costFreeQueries) / totalQueries) * 100;

    //       // Should achieve >85% cost reduction through caching and fallbacks
    //       expect(reductionRate).toBeGreaterThan(85);
    //       expect(aiCallCount).toBe(30); // Only 30% should require AI calls
    //       expect(costFreeQueries).toBe(70); // 70% should be cost-free
    //     });

    //     it('should validate 70% cache hit rate target', async () => {
    //       // Simulate cache hit scenario
    //       let cacheHits = 0;
    //       let totalRequests = 0;

    //       for (let i = 0; i < 100; i++) {
    //         totalRequests++;
    //         if (Math.random() < 0.7) { // 70% cache hit rate
    //           cacheServiceSpy.get.and.returnValue(Promise.resolve(`Cached response ${i}`));
    //           cacheHits++;
    //         } else {
    //           cacheServiceSpy.get.and.returnValue(Promise.resolve(null));
    //           fallbackLibrarySpy.findBestMatch.and.returnValue(Promise.resolve(null));
    //           groqServiceSpy.generateResponse.and.returnValue(Promise.resolve(`AI response ${i}`));
    //           cacheServiceSpy.set.and.returnValue(Promise.resolve());
    //         }

    //         await service.processUserQuery(`query ${i}`, 'chatbot');
    //       }

    //       const cacheHitRate = (cacheHits / totalRequests) * 100;
    //       expect(cacheHitRate).toBeGreaterThanOrEqual(70);
    //     });
    //   });
  });

  // REMOVED: AI services eliminated for cost savings
  // describe('Circuit Breaker Management', () => {
  //   it('should delegate circuit breaker status to service', () => {
  //     const mockStatus = { circuitBreaker: { state: 'closed' }, emergencyMode: false };
  //     budgetCircuitBreakerSpy.getStatus.and.returnValue(mockStatus);

  //     const status = service.getCircuitBreakerStatus();

  //     expect(budgetCircuitBreakerSpy.getStatus).toHaveBeenCalled();
  //     expect(status).toBe(mockStatus);
  //   });

  //   it('should delegate circuit breaker reset to service', () => {
  //     service.resetCircuitBreaker();

  //     expect(budgetCircuitBreakerSpy.resetCircuitBreaker).toHaveBeenCalled();
  //   });

  //   it('should delegate budget updates to service', () => {
  //     service.updateDailyBudget(20.0);

  //     expect(budgetCircuitBreakerSpy.updateThresholds).toHaveBeenCalledWith({ dailyBudget: 20.0 });
  //   });
  // });

  // describe('Fallback Library Integration', () => {
  //   it('should delegate fallback response addition to service', () => {
  //     const newResponse = {
  //       context: 'chatbot' as const,
  //       query: 'test query',
  //       response: 'Test response',
  //       category: 'general' as const,
  //       priority: 5,
  //       keywords: ['test']
  //     };

  //     service.addFallbackResponse(newResponse);

  //     expect(fallbackLibrarySpy.addResponse).toHaveBeenCalledWith({
  //       ...newResponse,
  //       context: 'chatbot',
  //       keywords: ['test']
  //     });
  //   });

  //   it('should delegate fallback stats to service', () => {
  //     const mockStats = {
  //       totalResponses: 10,
  //       categories: { chatbot: 5, productSearch: 3 },
  //       avgSuccessRate: 0.85
  //     };
  //     fallbackLibrarySpy.getStats.and.returnValue(mockStats);

  //     const stats = service.getFallbackStats();

  //     expect(fallbackLibrarySpy.getStats).toHaveBeenCalled();
  //     expect(stats).toEqual(mockStats);
  //   });
  // });
});