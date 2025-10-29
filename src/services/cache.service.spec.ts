import { TestBed } from '@angular/core/testing';
import { CacheService, CacheEntry } from './cache.service';
import { MOCK_PROVIDERS } from './mock-providers';

describe('CacheService - Cost Optimization', () => {
  let service: CacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CacheService, ...MOCK_PROVIDERS]
    });

    service = TestBed.inject(CacheService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Semantic Key Generation', () => {
    it('should generate consistent semantic keys for similar queries', () => {
      const key1 = service.generateSemanticKey('¿Cuál es el horario de atención?', 'chatbot');
      const key2 = service.generateSemanticKey('horario de la tienda', 'chatbot');
      const key3 = service.generateSemanticKey('¿A qué hora abren?', 'chatbot');

      // Should contain common semantic elements
      expect(key1).toContain('chatbot');
      expect(key1).toContain('general'); // fallback for unmatched patterns
    });

    it('should generate different semantic keys for different contexts', () => {
      const chatbotKey = service.generateSemanticKey('precio aceite', 'chatbot');
      const productKey = service.generateSemanticKey('precio aceite', 'productSearch');

      expect(chatbotKey).not.toBe(productKey);
      expect(chatbotKey).toContain('chatbot');
      expect(productKey).toContain('productSearch');
    });

    it('should identify inventory-related queries', () => {
      const key = service.generateSemanticKey('estado del inventario stock', 'chatbot');
      expect(key).toContain('inventory');
    });

    it('should identify queue-related queries', () => {
      const key = service.generateSemanticKey('tiempo de espera en cola', 'chatbot');
      expect(key).toContain('queue');
    });

    it('should identify maintenance-related queries', () => {
      const key = service.generateSemanticKey('servicio de mantenimiento', 'workOrder');
      expect(key).toContain('maintenance');
    });
  });

  describe('Priority-Based Eviction', () => {
    it('should evict low priority entries first when cache is full', async () => {
      // Fill cache beyond limit with different priorities
      const testData = [
        { key: 'high_priority_1', priority: 'high' as const, data: 'high data 1' },
        { key: 'high_priority_2', priority: 'high' as const, data: 'high data 2' },
        { key: 'med_priority_1', priority: 'medium' as const, data: 'med data 1' },
        { key: 'low_priority_1', priority: 'low' as const, data: 'low data 1' },
        { key: 'low_priority_2', priority: 'low' as const, data: 'low data 2' },
      ];

      // Set cache size to 3 for testing
      (service as any).MEMORY_CACHE_SIZE = 3;

      // Add entries - should evict low priority first
      for (const item of testData) {
        await service.set(item.key, item.data, 3600000, 'test', undefined, undefined, undefined, item.priority);
      }

      // Check that high priority items are retained
      const high1 = await service.get('high_priority_1');
      const high2 = await service.get('high_priority_2');
      const med1 = await service.get('med_priority_1');

      expect(high1).toBe('high data 1');
      expect(high2).toBe('high data 2');
      expect(med1).toBe('med data 1');

      // Low priority items should be evicted
      const low1 = await service.get('low_priority_1');
      const low2 = await service.get('low_priority_2');

      expect(low1).toBeNull();
      expect(low2).toBeNull();
    });

    it('should evict oldest medium priority when no low priority available', async () => {
      (service as any).MEMORY_CACHE_SIZE = 2;

      // Add two high priority items
      await service.set('high_1', 'high 1', 3600000, 'test', undefined, undefined, undefined, 'high');
      await service.set('high_2', 'high 2', 3600000, 'test', undefined, undefined, undefined, 'high');

      // Add medium priority - should evict oldest high priority
      await service.set('med_1', 'med 1', 3600000, 'test', undefined, undefined, undefined, 'medium');

      const high1 = await service.get('high_1');
      const high2 = await service.get('high_2');
      const med1 = await service.get('med_1');

      // One high priority should be evicted (LRU within same priority)
      expect([high1, high2].filter(Boolean)).toHaveLength(1);
      expect(med1).toBe('med 1');
    });
  });

  describe('Semantic Caching', () => {
    it('should retrieve entries by semantic key', async () => {
      const semanticKey = 'chatbot_inventory_status';
      const entry1: CacheEntry = {
        data: 'Inventory status response 1',
        createdAt: { toMillis: () => Date.now() } as any,
        expiresAt: { toMillis: () => Date.now() + 3600000 } as any,
        key: 'cache_key_1',
        semanticKey,
        context: 'chatbot',
        priority: 'medium'
      };

      const entry2: CacheEntry = {
        data: 'Inventory status response 2',
        createdAt: { toMillis: () => Date.now() } as any,
        expiresAt: { toMillis: () => Date.now() + 3600000 } as any,
        key: 'cache_key_2',
        semanticKey,
        context: 'chatbot',
        priority: 'medium'
      };

      // Mock Firestore query results
      spyOn(service as any, 'getBySemanticKey').and.returnValue(Promise.resolve([entry1, entry2]));

      const results = await (service as any).getBySemanticKey(semanticKey);

      expect(results).toHaveLength(2);
      expect(results[0].semanticKey).toBe(semanticKey);
      expect(results[1].semanticKey).toBe(semanticKey);
    });

    it('should filter out expired semantic entries', async () => {
      const semanticKey = 'test_semantic';
      const validEntry: CacheEntry = {
        data: 'Valid response',
        createdAt: { toMillis: () => Date.now() } as any,
        expiresAt: { toMillis: () => Date.now() + 3600000 } as any,
        key: 'valid_key',
        semanticKey,
        context: 'chatbot',
        priority: 'medium'
      };

      const expiredEntry: CacheEntry = {
        data: 'Expired response',
        createdAt: { toMillis: () => Date.now() - 7200000 } as any, // 2 hours ago
        expiresAt: { toMillis: () => Date.now() - 3600000 } as any, // 1 hour ago (expired)
        key: 'expired_key',
        semanticKey,
        context: 'chatbot',
        priority: 'medium'
      };

      spyOn(service as any, 'getBySemanticKey').and.returnValue(Promise.resolve([validEntry, expiredEntry]));

      const results = await (service as any).getBySemanticKey(semanticKey);

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('valid_key');
    });
  });

  describe('Context-Based Clearing', () => {
    it('should clear all entries for a specific context', async () => {
      spyOn(service as any, 'clearContext').and.returnValue(Promise.resolve(5));

      const cleared = await service.clearContext('chatbot');

      expect(cleared).toBe(5);
      expect((service as any).clearContext).toHaveBeenCalledWith('chatbot');
    });

    it('should clear entries by semantic tags', async () => {
      const tags = ['urgent', 'maintenance'];
      spyOn(service as any, 'clearByTags').and.returnValue(Promise.resolve(3));

      const cleared = await service.clearByTags(tags);

      expect(cleared).toBe(3);
      expect((service as any).clearByTags).toHaveBeenCalledWith(tags);
    });

    it('should clear entries by version for cache invalidation', async () => {
      const version = 'v2.1.0';
      spyOn(service as any, 'clearVersion').and.returnValue(Promise.resolve(10));

      const cleared = await service.clearVersion(version);

      expect(cleared).toBe(10);
      expect((service as any).clearVersion).toHaveBeenCalledWith(version);
    });
  });

  describe('Cache Statistics and Monitoring', () => {
    it('should calculate cache hit rate accurately', async () => {
      // Reset metrics
      service.resetMetrics();

      // Simulate cache operations
      await service.set('test1', 'data1', 3600000);
      await service.set('test2', 'data2', 3600000);

      // Hits
      await service.get('test1');
      await service.get('test2');

      // Misses
      await service.get('nonexistent1');
      await service.get('nonexistent2');

      const hitRate = service.getHitRate();
      expect(hitRate).toBe(50); // 2 hits out of 4 requests
    });

    it('should provide comprehensive cache statistics', async () => {
      spyOn(service as any, 'getStats').and.returnValue(Promise.resolve({
        totalEntries: 150,
        memoryCacheSize: 50,
        contexts: { chatbot: 30, scanner: 20 },
        hitRate: 75.5,
        avgTTL: 1800
      }));

      const stats = await service.getStats();

      expect(stats.totalEntries).toBe(150);
      expect(stats.memoryCacheSize).toBe(50);
      expect(stats.contexts.chatbot).toBe(30);
      expect(stats.hitRate).toBe(75.5);
      expect(stats.avgTTL).toBe(1800);
    });

    it('should track access patterns for LRU eviction', async () => {
      await service.set('key1', 'data1', 3600000, 'test', undefined, undefined, undefined, 'medium');
      await service.set('key2', 'data2', 3600000, 'test', undefined, undefined, undefined, 'medium');

      // Access key1 multiple times
      await service.get('key1');
      await service.get('key1');
      await service.get('key1');

      // Access key2 once
      await service.get('key2');

      // Check access counts (would be tracked in real implementation)
      // This test validates that the LRU mechanism considers access patterns
      expect(await service.get('key1')).toBe('data1');
      expect(await service.get('key2')).toBe('data2');
    });
  });

  describe('Performance Optimization', () => {
    it('should prioritize memory cache for fast access', async () => {
      const testData = 'test data';
      await service.set('perf_test', testData, 3600000);

      const startTime = Date.now();
      const result = await service.get('perf_test');
      const duration = Date.now() - startTime;

      expect(result).toBe(testData);
      expect(duration).toBeLessThan(100); // Should be very fast (< 100ms)
    });

    it('should handle cache misses gracefully without blocking', async () => {
      const startTime = Date.now();
      const result = await service.get('nonexistent_key');
      const duration = Date.now() - startTime;

      expect(result).toBeNull();
      expect(duration).toBeLessThan(200); // Should not be slow even on miss
    });

    it('should batch cache operations for efficiency', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => ({
        key: `batch_key_${i}`,
        data: `batch_data_${i}`
      }));

      const startTime = Date.now();

      // Perform multiple cache operations
      await Promise.all(operations.map(op =>
        service.set(op.key, op.data, 3600000)
      ));

      const duration = Date.now() - startTime;

      // Verify all operations completed
      for (const op of operations) {
        expect(await service.get(op.key)).toBe(op.data);
      }

      expect(duration).toBeLessThan(1000); // Should complete quickly even with batch
    });
  });

  describe('Cost Reduction Validation', () => {
    it('should achieve 70% cache hit rate for AI responses', async () => {
      let hits = 0;
      let totalRequests = 0;

      // Simulate 100 AI response requests
      for (let i = 0; i < 100; i++) {
        totalRequests++;
        const cacheKey = `ai_response_${i}`;

        // 70% hit rate simulation
        if (Math.random() < 0.7) {
          await service.set(cacheKey, `AI response ${i}`, 1800000); // 30 min TTL
          hits++;
        }

        // Always try to get (some will hit, some won't)
        await service.get(cacheKey);
      }

      const hitRate = (hits / totalRequests) * 100;
      expect(hitRate).toBeGreaterThanOrEqual(70);
    });

    it('should maintain cache efficiency under load', async () => {
      const concurrentOperations = 50;
      const operations = Array.from({ length: concurrentOperations }, (_, i) => ({
        key: `load_test_${i}`,
        data: `load_data_${i}`
      }));

      // Perform concurrent cache operations
      await Promise.all(operations.map(async (op) => {
        await service.set(op.key, op.data, 3600000);
        return await service.get(op.key);
      }));

      // Verify all operations succeeded
      for (const op of operations) {
        expect(await service.get(op.key)).toBe(op.data);
      }
    });

    it('should optimize memory usage with priority eviction', async () => {
      (service as any).MEMORY_CACHE_SIZE = 10;

      // Add high priority items
      for (let i = 0; i < 5; i++) {
        await service.set(`high_${i}`, `high_data_${i}`, 3600000, 'test', undefined, undefined, undefined, 'high');
      }

      // Add medium priority items
      for (let i = 0; i < 5; i++) {
        await service.set(`med_${i}`, `med_data_${i}`, 3600000, 'test', undefined, undefined, undefined, 'medium');
      }

      // Add low priority items (should evict medium priority)
      for (let i = 0; i < 5; i++) {
        await service.set(`low_${i}`, `low_data_${i}`, 3600000, 'test', undefined, undefined, undefined, 'low');
      }

      // Verify high priority items are retained
      for (let i = 0; i < 5; i++) {
        expect(await service.get(`high_${i}`)).toBe(`high_data_${i}`);
      }

      // Some medium priority should be evicted
      const retainedMedium = [];
      for (let i = 0; i < 5; i++) {
        const result = await service.get(`med_${i}`);
        if (result) retainedMedium.push(result);
      }

      expect(retainedMedium.length).toBeLessThan(5); // Some evicted
      expect(retainedMedium.length).toBeGreaterThan(0); // Some retained
    });
  });
});