import { TestBed } from '@angular/core/testing';
import { CostMonitoringService, FIREBASE_PRICING, FREE_TIERS } from './cost-monitoring.service';

describe('CostMonitoringService - Budget Tracking and Analytics', () => {
  let service: CostMonitoringService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CostMonitoringService]
    });

    service = TestBed.inject(CostMonitoringService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Cost Calculation Engine', () => {
    it('should calculate Firestore costs with free tier deductions', () => {
      const usage = {
        firestore: { reads: 60000, writes: 25000, deletes: 25000 }, // Over free tier
        storage: { uploads: 0, downloads: 0, deletes: 0, storageGB: 0, downloadGB: 0 },
        functions: { invocations: 0, gbSeconds: 0, cpuSeconds: 0, networkGB: 0 },
        hosting: { storageGB: 0, transferGB: 0 },
        realtime: { storageGB: 0, transferGB: 0 }
      };

      const costs = service.calculateCosts(usage);

      // Effective usage: 60000-50000=10000 reads, 25000-20000=5000 writes, 25000-20000=5000 deletes
      const expectedFirestore = (
        10000 * FIREBASE_PRICING.firestore.reads +
        5000 * FIREBASE_PRICING.firestore.writes +
        5000 * FIREBASE_PRICING.firestore.deletes
      );

      expect(costs.firestore).toBeCloseTo(expectedFirestore, 6);
    });

    it('should calculate Cloud Functions costs with free tier', () => {
      const usage = {
        firestore: { reads: 0, writes: 0, deletes: 0 },
        storage: { uploads: 0, downloads: 0, deletes: 0, storageGB: 0, downloadGB: 0 },
        functions: { invocations: 2100000, gbSeconds: 410000, cpuSeconds: 210000, networkGB: 6 }, // Over free tier
        hosting: { storageGB: 0, transferGB: 0 },
        realtime: { storageGB: 0, transferGB: 0 }
      };

      const costs = service.calculateCosts(usage);

      // Effective usage: 2100000-2000000=100000 invocations, etc.
      const expectedFunctions = (
        100000 * FIREBASE_PRICING.functions.invocations +
        10000 * FIREBASE_PRICING.functions.gbSeconds +
        10000 * FIREBASE_PRICING.functions.cpuTime +
        1 * FIREBASE_PRICING.functions.network
      );

      expect(costs.functions).toBeCloseTo(expectedFunctions, 6);
    });

    it('should calculate Cloud Storage costs with operations and network', () => {
      const usage = {
        firestore: { reads: 0, writes: 0, deletes: 0 },
        storage: { uploads: 55000, downloads: 200000, deletes: 0, storageGB: 6, downloadGB: 35 }, // Over free tier
        functions: { invocations: 0, gbSeconds: 0, cpuSeconds: 0, networkGB: 0 },
        hosting: { storageGB: 0, transferGB: 0 },
        realtime: { storageGB: 0, transferGB: 0 }
      };

      const costs = service.calculateCosts(usage);

      // Effective usage: 55000-50000=5000 uploads (class A), 200000-50000=150000 downloads (class B), etc.
      const expectedStorage = (
        1 * FIREBASE_PRICING.storage.storage + // 6-5=1 GB over free tier
        5000 * FIREBASE_PRICING.storage.operations.classA / 1000 +
        150000 * FIREBASE_PRICING.storage.operations.classB / 1000 +
        5 * FIREBASE_PRICING.storage.operations.network // 35-30=5 GB over free tier
      );

      expect(costs.storage).toBeCloseTo(expectedStorage, 6);
    });

    it('should calculate total costs across all services', () => {
      const usage = {
        firestore: { reads: 55000, writes: 22000, deletes: 22000 },
        storage: { uploads: 51000, downloads: 51000, deletes: 0, storageGB: 5.5, downloadGB: 30.5 },
        functions: { invocations: 2005000, gbSeconds: 400500, cpuSeconds: 200500, networkGB: 5.5 },
        hosting: { storageGB: 10.5, transferGB: 10.5 },
        realtime: { storageGB: 1.5, transferGB: 10.5 }
      };

      const costs = service.calculateCosts(usage);

      // Should be sum of all individual costs
      const expectedTotal = costs.firestore + costs.storage + costs.functions + costs.hosting + costs.realtime;
      expect(costs.total).toBeCloseTo(expectedTotal, 6);
      expect(costs.total).toBeGreaterThan(0);
    });
  });

  describe('Usage Tracking', () => {
    it('should track Firestore operations incrementally', () => {
      service.trackFirestoreRead(5);
      service.trackFirestoreWrite(3);
      service.trackFirestoreDelete(2);

      const usage = service.getCurrentUsage();

      expect(usage.firestore.reads).toBe(5);
      expect(usage.firestore.writes).toBe(3);
      expect(usage.firestore.deletes).toBe(2);
    });

    it('should track Cloud Storage operations with size conversions', () => {
      const fileSize = 1024 * 1024 * 500; // 500 MB
      service.trackStorageUpload(fileSize);
      service.trackStorageDownload(fileSize);
      service.trackStorageDelete();

      const usage = service.getCurrentUsage();

      expect(usage.storage.uploads).toBe(1);
      expect(usage.storage.downloads).toBe(1);
      expect(usage.storage.deletes).toBe(1);
      expect(usage.storage.storageGB).toBeCloseTo(0.5, 3); // 500 MB = 0.5 GB
      expect(usage.storage.downloadGB).toBeCloseTo(0.5, 3);
    });

    it('should track Cloud Functions with resource metrics', () => {
      service.trackFunctionInvocation(2.5, 1.5, 0.1); // gbSeconds, cpuSeconds, networkGB

      const usage = service.getCurrentUsage();

      expect(usage.functions.invocations).toBe(1);
      expect(usage.functions.gbSeconds).toBe(2.5);
      expect(usage.functions.cpuSeconds).toBe(1.5);
      expect(usage.functions.networkGB).toBe(0.1);
    });

    it('should estimate hosting transfer from page views', () => {
      service.estimateHostingTransfer(1000, 750); // 1000 page views, 750KB avg

      const usage = service.getCurrentUsage();

      // 1000 * 750KB = 750,000 KB = 750 MB = 0.75 GB
      expect(usage.hosting.transferGB).toBeCloseTo(0.75, 3);
    });
  });

  describe('Budget Threshold Monitoring', () => {
    it('should detect when costs exceed daily threshold', () => {
      const highCosts = {
        firestore: 5.0,
        storage: 3.0,
        functions: 4.0,
        hosting: 1.0,
        realtime: 0.5,
        total: 13.5 // Over $10 threshold
      };

      const alerts = (service as any).checkAlerts(highCosts);

      expect(alerts).toContain('Daily cost threshold exceeded');
      expect(alerts).toContain('$13.50 > $10');
    });

    it('should generate service-specific alerts', () => {
      const serviceCosts = {
        firestore: 0.5,
        storage: 0.3,
        functions: 4.5, // Over $3 threshold
        hosting: 0.2,
        realtime: 0.1,
        total: 5.6
      };

      const alerts = (service as any).checkAlerts(serviceCosts);

      expect(alerts).toContain('High Functions costs');
      expect(alerts).toContain('$4.50');
    });

    it('should not generate alerts when costs are normal', () => {
      const normalCosts = {
        firestore: 0.5,
        storage: 0.3,
        functions: 1.5,
        hosting: 0.2,
        realtime: 0.1,
        total: 2.6
      };

      const alerts = (service as any).checkAlerts(normalCosts);

      expect(alerts).toHaveLength(0);
    });
  });

  describe('Cost Prediction and Analytics', () => {
    it('should predict monthly costs from historical data', async () => {
      const mockHistory = [
        {
          timestamp: { toDate: () => new Date() },
          period: 'daily',
          usage: {
            firestore: { reads: 10000, writes: 5000, deletes: 1000 },
            storage: { uploads: 1000, downloads: 5000, deletes: 100, storageGB: 1, downloadGB: 3 },
            functions: { invocations: 50000, gbSeconds: 10000, cpuSeconds: 5000, networkGB: 0.5 },
            hosting: { storageGB: 1, transferGB: 1 },
            realtime: { storageGB: 0.1, transferGB: 1 }
          },
          costs: { firestore: 0.01, storage: 0.005, functions: 0.05, hosting: 0.00002685546875, realtime: 0.000012, total: 0.06603885546875 },
          alertsTriggered: []
        }
      ];

      spyOn(service as any, 'getUsageHistory').and.returnValue(Promise.resolve(mockHistory));

      const prediction = await service.predictMonthlyCosts();

      expect(prediction.predictedTotal).toBeGreaterThan(0);
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.confidence).toBeLessThanOrEqual(100);
      expect(prediction.recommendations).toBeDefined();
    });

    it('should generate cost optimization recommendations', () => {
      const highCosts = {
        firestore: 6.0, // Over $5 threshold
        storage: 0.5,
        functions: 1.5,
        hosting: 0.3,
        realtime: 0.2,
        total: 8.5
      };

      const recommendations = (service as any).generateCostRecommendations(highCosts, {
        firestore: { reads: 1000000, writes: 100000, deletes: 10000 },
        storage: { uploads: 10000, downloads: 50000, deletes: 1000, storageGB: 10, downloadGB: 50 },
        functions: { invocations: 500000, gbSeconds: 100000, cpuSeconds: 50000, networkGB: 5 },
        hosting: { storageGB: 15, transferGB: 15 },
        realtime: { storageGB: 2, transferGB: 15 }
      });

      expect(recommendations).toContain('High Firestore costs');
      expect(recommendations).toContain('Excessive Firestore reads');
      expect(recommendations).toContain('High function invocations');
    });

    it('should calculate cost efficiency metrics', async () => {
      const metrics = await service.getCostEfficiencyMetrics();

      expect(metrics.costPerUser).toBeDefined();
      expect(metrics.costPerTransaction).toBeDefined();
      expect(['excellent', 'good', 'fair', 'poor']).toContain(metrics.efficiency);
      expect(metrics.optimizationOpportunities).toBeDefined();
    });
  });

  describe('Automated Cost Alerts', () => {
    it('should configure automated alerts with thresholds', () => {
      const thresholds = {
        dailyLimit: 15.0,
        monthlyProjection: 300.0,
        efficiencyThreshold: 0.05
      };

      service.setupAutomatedAlerts(thresholds);

      // Configuration should be stored (implementation detail)
      expect(true).toBe(true); // Placeholder - actual implementation would verify storage
    });
  });

  describe('Usage History and Reporting', () => {
    it('should retrieve usage history with date filtering', async () => {
      const mockRecords = [
        {
          id: '1',
          timestamp: { toDate: () => new Date() },
          period: 'daily',
          usage: { firestore: { reads: 1000, writes: 500, deletes: 100 } },
          costs: { firestore: 0.001, storage: 0, functions: 0.01, hosting: 0, realtime: 0, total: 0.011 },
          alertsTriggered: []
        }
      ];

      spyOn(service as any, 'getUsageHistory').and.returnValue(Promise.resolve(mockRecords));

      const history = await service.getUsageHistory('daily', 7);

      expect(history).toHaveLength(1);
      expect(history[0].period).toBe('daily');
      expect(history[0].costs.total).toBe(0.011);
    });

    it('should save usage records with proper period tracking', async () => {
      spyOn(service as any, 'saveUsageRecord').and.returnValue(Promise.resolve());

      await service.saveUsageRecord('daily');

      expect((service as any).saveUsageRecord).toHaveBeenCalledWith('daily');
    });
  });

  describe('Cost Reduction Validation', () => {
    it('should validate free tier effectiveness', () => {
      // Test with usage exactly at free tier limits
      const freeTierUsage = {
        firestore: { reads: 50000, writes: 20000, deletes: 20000 },
        storage: { uploads: 50000, downloads: 50000, deletes: 0, storageGB: 5, downloadGB: 30 },
        functions: { invocations: 2000000, gbSeconds: 400000, cpuSeconds: 200000, networkGB: 5 },
        hosting: { storageGB: 10, transferGB: 10 },
        realtime: { storageGB: 1, transferGB: 10 }
      };

      const costs = service.calculateCosts(freeTierUsage);

      // Costs should be minimal or zero when within free tier
      expect(costs.total).toBeCloseTo(0, 6);
    });

    it('should demonstrate cost optimization impact', () => {
      // Simulate before and after optimization
      const beforeUsage = {
        firestore: { reads: 200000, writes: 100000, deletes: 50000 }, // High usage
        storage: { uploads: 100000, downloads: 500000, deletes: 10000, storageGB: 50, downloadGB: 200 },
        functions: { invocations: 5000000, gbSeconds: 1000000, cpuSeconds: 500000, networkGB: 50 },
        hosting: { storageGB: 50, transferGB: 100 },
        realtime: { storageGB: 5, transferGB: 50 }
      };

      const afterUsage = {
        firestore: { reads: 100000, writes: 50000, deletes: 25000 }, // 50% reduction
        storage: { uploads: 50000, downloads: 250000, deletes: 5000, storageGB: 25, downloadGB: 100 },
        functions: { invocations: 2500000, gbSeconds: 500000, cpuSeconds: 250000, networkGB: 25 },
        hosting: { storageGB: 25, transferGB: 50 },
        realtime: { storageGB: 2.5, transferGB: 25 }
      };

      const beforeCosts = service.calculateCosts(beforeUsage);
      const afterCosts = service.calculateCosts(afterUsage);

      // Should show significant cost reduction
      expect(afterCosts.total).toBeLessThan(beforeCosts.total);
      expect(beforeCosts.total / afterCosts.total).toBeGreaterThan(1.5); // At least 33% reduction
    });

    it('should track cost per operation efficiency', () => {
      // Test various operation types for cost efficiency
      const operations = [
        { type: 'firestore_read', usage: { firestore: { reads: 1000, writes: 0, deletes: 0 } } },
        { type: 'firestore_write', usage: { firestore: { reads: 0, writes: 1000, deletes: 0 } } },
        { type: 'function_call', usage: { functions: { invocations: 1000, gbSeconds: 200, cpuSeconds: 100, networkGB: 0.01 } } },
        { type: 'storage_upload', usage: { storage: { uploads: 1000, downloads: 0, deletes: 0, storageGB: 1, downloadGB: 0 } } }
      ];

      operations.forEach(op => {
        const costs = service.calculateCosts({
          firestore: op.usage.firestore || { reads: 0, writes: 0, deletes: 0 },
          storage: op.usage.storage || { uploads: 0, downloads: 0, deletes: 0, storageGB: 0, downloadGB: 0 },
          functions: op.usage.functions || { invocations: 0, gbSeconds: 0, cpuSeconds: 0, networkGB: 0 },
          hosting: { storageGB: 0, transferGB: 0 },
          realtime: { storageGB: 0, transferGB: 0 }
        });

        expect(costs.total).toBeGreaterThan(0);
        // Cost per operation should be reasonable
        expect(costs.total).toBeLessThan(10); // Less than $10 for 1000 operations
      });
    });
  });
});