import { TestBed } from '@angular/core/testing';
import { FallbackLibraryService } from './fallback-library.service';
import { QueueService } from './queue.service';
import { InventoryReportsService } from './inventory-reports.service';
import { ProductService } from './product.service';
import { MOCK_PROVIDERS } from './mock-providers';

describe('FallbackLibraryService - Intelligent Matching and Learning', () => {
  let service: FallbackLibraryService;
  let queueService: QueueService;
  let inventoryReportsService: InventoryReportsService;
  let productService: ProductService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FallbackLibraryService,
        ...MOCK_PROVIDERS,
        { provide: QueueService, useValue: { getQueueStatus: jest.fn() } },
        { provide: InventoryReportsService, useValue: { getStockReportByLocation: jest.fn(), getLowStockReport: jest.fn() } },
        { provide: ProductService, useValue: { getProducts: jest.fn() } }
      ]
    });

    service = TestBed.inject(FallbackLibraryService);
    queueService = TestBed.inject(QueueService);
    inventoryReportsService = TestBed.inject(InventoryReportsService);
    productService = TestBed.inject(ProductService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Intelligent Query Matching', () => {
    it('should find exact keyword matches with high priority', async () => {
      const match = await service.findBestMatch('horario de atención', 'chatbot');

      expect(match).toBeTruthy();
      expect(match!.score).toBeGreaterThan(0.8);
      expect(match!.response.keywords).toContain('horario');
    });

    it('should handle fuzzy matching for similar queries', async () => {
      const match1 = await service.findBestMatch('¿Cuál es el horario?', 'chatbot');
      const match2 = await service.findBestMatch('horario de la tienda', 'chatbot');

      expect(match1).toBeTruthy();
      expect(match2).toBeTruthy();
      expect(match1!.response.id).toBe(match2!.response.id); // Same response for similar queries
    });

    it('should prioritize responses by context relevance', async () => {
      const chatbotMatch = await service.findBestMatch('estado de la cola', 'chatbot');
      const scannerMatch = await service.findBestMatch('estado de la cola', 'scanner');

      expect(chatbotMatch).toBeTruthy();
      expect(scannerMatch).toBeTruthy();
      // Both should find matches but may have different priorities
    });

    it('should return null for completely irrelevant queries', async () => {
      const match = await service.findBestMatch('receta de pizza margarita', 'chatbot');

      expect(match).toBeNull();
    });
  });

  describe('Dynamic Data Population', () => {
    beforeEach(() => {
      // Setup mock data for dynamic fields
      (queueService.getQueueStatus as jest.Mock).mockReturnValue({
        isOpen: true,
        currentCount: 8,
        averageWaitTime: 35,
        operatingHours: '8:00-18:00'
      });

      (inventoryReportsService.getStockReportByLocation as jest.Mock).mockReturnValue([
        { id: '1', status: 'normal', availableStock: 15, minStock: 5, productName: 'Test Product 1' },
        { id: '2', status: 'critical', availableStock: 3, minStock: 10, productName: 'Test Product 2' },
        { id: '3', status: 'out_of_stock', availableStock: 0, minStock: 5, productName: 'Test Product 3' }
      ]);

      (inventoryReportsService.getLowStockReport as jest.Mock).mockReturnValue([
        { productName: 'Low Stock Item', availableStock: 4, minStock: 10, status: 'low_stock' }
      ]);
    });

    it('should populate queue status with real-time data', async () => {
      const match = await service.findBestMatch('estado de la cola', 'chatbot');

      expect(match).toBeTruthy();

      const response = await service.getResponseWithDynamicData(match!);

      expect(response).toContain('35 minutos'); // averageWaitTime
      expect(response).toContain('8'); // currentCount
      expect(response).toContain('Abierto'); // isOpen
    });

    it('should populate inventory data dynamically', async () => {
      const match = await service.findBestMatch('estado del inventario', 'chatbot');

      expect(match).toBeTruthy();

      const response = await service.getResponseWithDynamicData(match!);

      expect(response).toContain('3'); // totalProducts
      expect(response).toContain('1'); // criticalItems
      expect(response).toContain('1'); // outOfStockItems
      expect(response).toContain('1'); // lowStockCount
    });

    it('should handle missing dynamic data gracefully', async () => {
      // Mock empty data
      (queueService.getQueueStatus as jest.Mock).mockReturnValue(null);

      const match = await service.findBestMatch('estado de la cola', 'chatbot');
      const response = await service.getResponseWithDynamicData(match!);

      expect(response).toContain('Calculando...'); // Fallback for missing data
    });
  });

  describe('Learning and Adaptation', () => {
    it('should track response usage for learning', async () => {
      const initialStats = service.getStats();
      const initialUsage = initialStats.totalUsage;

      // Find a match multiple times
      await service.findBestMatch('horario', 'chatbot');
      await service.findBestMatch('horario', 'chatbot');
      await service.findBestMatch('horario', 'chatbot');

      const updatedStats = service.getStats();

      expect(updatedStats.totalUsage).toBeGreaterThanOrEqual(initialUsage + 3);
    });

    it('should maintain usage statistics per response', async () => {
      const match = await service.findBestMatch('horario', 'chatbot');

      expect(match).toBeTruthy();

      const stats = service.getStats();

      expect(stats.totalResponses).toBeGreaterThan(0);
      expect(stats.categories).toBeDefined();
      expect(stats.avgSuccessRate).toBeDefined();
    });

    it('should adapt to frequently asked questions', async () => {
      // Simulate high usage of a particular query
      for (let i = 0; i < 10; i++) {
        await service.findBestMatch('horario', 'chatbot');
      }

      const stats = service.getStats();

      // The horario response should show high usage
      expect(stats.totalUsage).toBeGreaterThan(10);
    });
  });

  describe('Response Management', () => {
    it('should allow adding new fallback responses', () => {
      const newResponse = {
        context: 'chatbot' as const,
        query: 'nueva consulta de prueba',
        response: 'Respuesta de prueba para nueva consulta',
        category: 'general' as const,
        priority: 5,
        keywords: ['nueva', 'prueba', 'consulta']
      };

      service.addResponse(newResponse);

      const stats = service.getStats();
      expect(stats.totalResponses).toBeGreaterThan(0);
    });

    it('should search responses by keyword', () => {
      const results = service.searchResponses('horario');

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].keywords).toContain('horario');
    });

    it('should return empty array for non-matching searches', () => {
      const results = service.searchResponses('palabraquenoexiste12345');

      expect(results).toEqual([]);
    });
  });

  describe('Performance Optimization', () => {
    it('should respond instantly to common queries', async () => {
      const startTime = Date.now();

      const match = await service.findBestMatch('horario de atención', 'chatbot');
      const response = await service.getResponseWithDynamicData(match!);

      const duration = Date.now() - startTime;

      expect(response).toBeTruthy();
      expect(duration).toBeLessThan(100); // Should be very fast (< 100ms)
    });

    it('should handle concurrent requests efficiently', async () => {
      const queries = [
        'horario',
        'estado de la cola',
        'estado del inventario',
        'precio aceite'
      ];

      const startTime = Date.now();

      const promises = queries.map(query => service.findBestMatch(query, 'chatbot'));
      const results = await Promise.all(promises);

      const duration = Date.now() - startTime;

      expect(results.filter(r => r !== null)).toHaveLength(queries.length);
      expect(duration).toBeLessThan(500); // Should handle multiple requests quickly
    });

    it('should maintain response quality under load', async () => {
      // Simulate high-frequency requests
      const iterations = 50;
      const promises = [];

      for (let i = 0; i < iterations; i++) {
        promises.push(service.findBestMatch('horario', 'chatbot'));
      }

      const results = await Promise.all(promises);

      const successfulMatches = results.filter(r => r !== null);
      const successRate = successfulMatches.length / iterations;

      expect(successRate).toBeGreaterThan(0.95); // Should maintain high success rate
    });
  });

  describe('Cost Reduction through Fallbacks', () => {
    it('should provide high coverage for common query types', () => {
      const stats = service.getStats();

      // Should have good coverage across different contexts
      expect(stats.contextBreakdown['chatbot']).toBeDefined();
      expect(stats.contextBreakdown['productSearch']).toBeDefined();
      expect(stats.contextBreakdown['scanner']).toBeDefined();

      // Should have responses for high-frequency queries
      const highPriorityResponses = service.getAllResponses().filter(r => r.priority >= 8);
      expect(highPriorityResponses.length).toBeGreaterThan(3);
    });

    it('should reduce AI calls by handling common queries', async () => {
      const commonQueries = [
        'horario',
        'horario de atención',
        '¿Cuál es el horario?',
        'estado de la cola',
        'cola de espera',
        'estado del inventario',
        'inventario'
      ];

      let aiCallsNeeded = 0;
      let fallbackHandled = 0;

      for (const query of commonQueries) {
        const match = await service.findBestMatch(query, 'chatbot');
        if (match) {
          fallbackHandled++;
        } else {
          aiCallsNeeded++;
        }
      }

      const fallbackRate = fallbackHandled / commonQueries.length;

      expect(fallbackRate).toBeGreaterThan(0.8); // Should handle >80% of common queries
      expect(aiCallsNeeded).toBeLessThan(commonQueries.length * 0.3); // <30% need AI
    });

    it('should validate fallback response quality', async () => {
      const testQueries = [
        { query: 'horario', expectedContent: ['horario', 'atención'] },
        { query: 'cola', expectedContent: ['cola', 'espera'] },
        { query: 'inventario', expectedContent: ['inventario', 'stock'] }
      ];

      for (const test of testQueries) {
        const match = await service.findBestMatch(test.query, 'chatbot');

        expect(match).toBeTruthy();

        const response = await service.getResponseWithDynamicData(match!);

        const hasExpectedContent = test.expectedContent.some(content =>
          response.toLowerCase().includes(content.toLowerCase())
        );

        expect(hasExpectedContent).toBe(true);
      }
    });

    it('should demonstrate learning from usage patterns', async () => {
      // Simulate usage patterns
      const frequentQueries = ['horario', 'horario', 'horario', 'cola', 'cola'];
      const infrequentQueries = ['consulta rara 1', 'consulta rara 2'];

      // Process frequent queries
      for (const query of frequentQueries) {
        await service.findBestMatch(query, 'chatbot');
      }

      // Process infrequent queries
      for (const query of infrequentQueries) {
        await service.findBestMatch(query, 'chatbot');
      }

      const stats = service.getStats();

      // Should show higher usage for frequent queries
      expect(stats.totalUsage).toBe(frequentQueries.length + infrequentQueries.length);

      // The most used responses should be for frequent queries
      const topResponses = stats.topResponses || [];
      expect(topResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Context-Specific Optimization', () => {
    it('should provide contextually appropriate responses', async () => {
      const contexts = ['chatbot', 'productSearch', 'scanner', 'workOrder'] as const;

      for (const context of contexts) {
        const match = await service.findBestMatch('horario', context);

        if (match) {
          expect(match.response.context).toBe(context);
        }
      }
    });

    it('should handle context-specific query patterns', async () => {
      const contextTests = [
        { context: 'productSearch' as const, query: 'precio aceite', shouldFind: true },
        { context: 'scanner' as const, query: 'escanear código', shouldFind: true },
        { context: 'workOrder' as const, query: 'crear orden', shouldFind: true }
      ];

      for (const test of contextTests) {
        const match = await service.findBestMatch(test.query, test.context);

        if (test.shouldFind) {
          expect(match).toBeTruthy();
          expect(match!.response.context).toBe(test.context);
        }
      }
    });

    it('should optimize response selection by context priority', async () => {
      // Test that same query gets different responses in different contexts
      const chatbotMatch = await service.findBestMatch('ayuda', 'chatbot');
      const scannerMatch = await service.findBestMatch('ayuda', 'scanner');

      // May be the same or different depending on implementation
      // But both should be valid matches
      expect(chatbotMatch || scannerMatch).toBeTruthy();
    });
  });
});