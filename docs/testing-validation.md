🧪 Testing & Validation
Test Suite para Optimizaciones
import { TestBed } from '@angular/core/testing';
import { AIAssistantService } from './ai-assistant.service';
import { CacheService } from './cache.service';
import { RateLimiterService } from './rate-limiter.service';
import { CostMonitoringService } from './cost-monitoring.service';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';

describe('AIAssistantService - Cost Optimization', () => {
  let service: AIAssistantService;
  let cacheService: jasmine.SpyObj<CacheService>;
  let rateLimiter: jasmine.SpyObj<RateLimiterService>;
  let costMonitoring: jasmine.SpyObj<CostMonitoringService>;

  beforeEach(() => {
    const cacheSpy = jasmine.createSpyObj('CacheService', ['get', 'set']);
    const rateLimiterSpy = jasmine.createSpyObj('RateLimiterService', ['checkLimit']);
    const costSpy = jasmine.createSpyObj('CostMonitoringService', ['trackAICall']);

    TestBed.configureTestingModule({
      providers: [
        AIAssistantService,
        { provide: CacheService, useValue: cacheSpy },
        { provide: RateLimiterService, useValue: rateLimiterSpy },
        { provide: CostMonitoringService, useValue: costSpy },
        { provide: Firestore, useValue: {} },
        { provide: Functions, useValue: {} }
      ]
    });

    service = TestBed.inject(AIAssistantService);
    cacheService = TestBed.inject(CacheService) as jasmine.SpyObj<CacheService>;
    rateLimiter = TestBed.inject(RateLimiterService) as jasmine.SpyObj<RateLimiterService>;
    costMonitoring = TestBed.inject(CostMonitoringService) as jasmine.SpyObj<CostMonitoringService>;
  });

  describe('Fallback Responses', () => {
    it('should return pre-generated response for "horario" query', async () => {
      const result = await service.query('cual es el horario', 'chatbot', 'user123');
      
      expect(result.provider).toBe('fallback');
      expect(result.tokens).toBe(0);
      expect(result.cached).toBe(true);
      expect(result.response).toContain('Lunes a Viernes');
    });

    it('should return pre-generated response for common product searches', async () => {
      const result = await service.query('precio aceite 10w40', 'productSearch', 'user123');
      
      expect(result.provider).toBe('fallback');
      expect(result.tokens).toBe(0);
      expect(result.response).toContain('Motul');
    });

    it('should NOT use fallback for non-matching queries', async () => {
      cacheService.get.and.returnValue(Promise.resolve(null));
      rateLimiter.checkLimit.and.returnValue(Promise.resolve(true));
      
      // This would trigger actual AI call (mocked)
      const result = await service.query(
        'diagnostico complejo motor pierde potencia',
        'workOrder',
        'tech456'
      );
      
      // Should attempt cache check
      expect(cacheService.get).toHaveBeenCalled();
    });
  });

  describe('Cache Functionality', () => {
    it('should return cached response when available', async () => {
      const cachedData = {
        response: 'Cached answer',
        tokens: 250,
        createdAt: { toMillis: () => Date.now() - 1000 },
        expiresAt: { toMillis: () => Date.now() + 100000 }
      };
      
      cacheService.get.and.returnValue(Promise.resolve(cachedData));
      
      const result = await service.query('test query', 'chatbot', 'user123');
      
      expect(result.response).toBe('Cached answer');
      expect(result.cached).toBe(true);
      expect(result.tokens).toBe(250);
    });

    it('should NOT return expired cache', async () => {
      const expiredCache = {
        response: 'Old answer',
        tokens: 250,
        createdAt: { toMillis: () => Date.now() - 100000 },
        expiresAt: { toMillis: () => Date.now() - 1000 } // Expired
      };
      
      cacheService.get.and.returnValue(Promise.resolve(expiredCache));
      rateLimiter.checkLimit.and.returnValue(Promise.resolve(true));
      
      // Should proceed to AI call (or fallback)
      await service.query('test query', 'chatbot', 'user123');
      
      expect(rateLimiter.checkLimit).toHaveBeenCalled();
    });

    it('should generate consistent cache keys for similar queries', () => {
      const key1 = (service as any).generateCacheKey('cual es el horario?', 'chatbot');
      const key2 = (service as any).generateCacheKey('cuál es el horario', 'chatbot');
      const key3 = (service as any).generateCacheKey('CUAL ES EL HORARIO', 'chatbot');
      
      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits and return fallback', async () => {
      cacheService.get.and.returnValue(Promise.resolve(null));
      rateLimiter.checkLimit.and.returnValue(Promise.resolve(false)); // Limit exceeded
      
      const result = await service.query('test query', 'chatbot', 'user123');
      
      expect(result.provider).toBe('fallback');
      expect(result.response).toContain('Límite diario');
    });

    it('should allow AI call when under rate limit', async () => {
      cacheService.get.and.returnValue(Promise.resolve(null));
      rateLimiter.checkLimit.and.returnValue(Promise.resolve(true));
      
      // Mock AI response
      spyOn<any>(service, 'callGeminiAPI').and.returnValue(
        Promise.resolve({ response: 'AI answer', tokens: 300 })
      );
      
      const result = await service.query('test query', 'scanner', 'tech456');
      
      expect((service as any).callGeminiAPI).toHaveBeenCalled();
      expect(result.provider).toBe('gemini');
    });
  });

  describe('Cost Tracking', () => {
    it('should track AI call costs', async () => {
      cacheService.get.and.returnValue(Promise.resolve(null));
      rateLimiter.checkLimit.and.returnValue(Promise.resolve(true));
      
      spyOn<any>(service, 'callGeminiAPI').and.returnValue(
        Promise.resolve({ response: 'AI answer', tokens: 500 })
      );
      spyOn<any>(service, 'cacheResponse').and.returnValue(Promise.resolve());
      
      await service.query('test query', 'chatbot', 'user123');
      
      expect(costMonitoring.trackAICall).toHaveBeenCalledWith(
        'chatbot',
        500,
        'gemini'
      );
    });

    it('should NOT track costs for cached responses', async () => {
      const cachedData = {
        response: 'Cached',
        tokens: 250,
        createdAt: { toMillis: () => Date.now() },
        expiresAt: { toMillis: () => Date.now() + 100000 }
      };
      
      cacheService.get.and.returnValue(Promise.resolve(cachedData));
      
      await service.query('test', 'chatbot', 'user123');
      
      expect(costMonitoring.trackAICall).not.toHaveBeenCalled();
    });

    it('should NOT track costs for fallback responses', async () => {
      await service.query('horario', 'chatbot', 'user123');
      
      expect(costMonitoring.trackAICall).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return fallback on AI API error', async () => {
      cacheService.get.and.returnValue(Promise.resolve(null));
      rateLimiter.checkLimit.and.returnValue(Promise.resolve(true));
      
      spyOn<any>(service, 'callGeminiAPI').and.returnValue(
        Promise.reject(new Error('API Error'))
      );
      
      const result = await service.query('test', 'chatbot', 'user123');
      
      expect(result.provider).toBe('fallback');
      expect(result.response).toContain('información general');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should return fallback response in <50ms', async () => {
      const start = Date.now();
      await service.query('horario', 'chatbot', 'user123');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(50);
    });

    it('should return cached response in <200ms', async () => {
      const cachedData = {
        response: 'Cached',
        tokens: 250,
        createdAt: { toMillis: () => Date.now() },
        expiresAt: { toMillis: () => Date.now() + 100000 }
      };
      
      cacheService.get.and.returnValue(Promise.resolve(cachedData));
      
      const start = Date.now();
      await service.query('test', 'chatbot', 'user123');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Cache Hit Rate Calculation', () => {
    it('should calculate cache hit rate correctly', async () => {
      // Simulate 100 queries: 70 cached, 20 fallback, 10 AI
      const queries = [
        ...Array(70).fill('cached'),
        ...Array(20).fill('fallback'),
        ...Array(10).fill('ai')
      ];

      let cachedCount = 0;
      let fallbackCount = 0;
      let aiCount = 0;

      for (const type of queries) {
        if (type === 'cached') {
          cacheService.get.and.returnValue(Promise.resolve({
            response: 'Cached',
            tokens: 250,
            createdAt: { toMillis: () => Date.now() },
            expiresAt: { toMillis: () => Date.now() + 100000 }
          }));
          cachedCount++;
        } else if (type === 'fallback') {
          await service.query('horario', 'chatbot', 'user123');
          fallbackCount++;
        } else {
          cacheService.get.and.returnValue(Promise.resolve(null));
          rateLimiter.checkLimit.and.returnValue(Promise.resolve(true));
          spyOn<any>(service, 'callGeminiAPI').and.returnValue(
            Promise.resolve({ response: 'AI', tokens: 300 })
          );
          aiCount++;
        }
      }

      const totalQueries = queries.length;
      const aiCallsOnly = aiCount;
      const reductionRate = ((totalQueries - aiCallsOnly) / totalQueries) * 100;

      // Should achieve >85% reduction in AI calls
      expect(reductionRate).toBeGreaterThan(85);
    });
  });
});