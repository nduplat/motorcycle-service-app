import { Injectable, signal, inject } from '@angular/core';
import { db } from '../firebase.config';
import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { environment } from '../environments/environment';

// Firebase pricing constants (as of 2024 - update as needed)
export const FIREBASE_PRICING = {
  firestore: {
    reads: 0.00000006, // per document read ($0.06 per 1M reads)
    writes: 0.00000018, // per document write ($0.18 per 1M writes)
    deletes: 0.000000002, // per document delete ($0.02 per 1M deletes)
  },
  storage: {
    storage: 0.00000002685546875, // per GB per month ($0.026 per GB)
    operations: {
      classA: 0.000005, // $0.005 per 1000 operations (uploads)
      classB: 0.0000004, // $0.0004 per 1000 operations (downloads, deletes)
      network: 0.12, // per GB downloaded ($0.12 per GB)
    }
  },
  functions: {
    invocations: 0.0000004, // per invocation ($0.40 per 1M invocations)
    gbSeconds: 0.0000025, // per GB-second ($0.0000025)
    cpuTime: 0.00001, // per GHz-second ($0.01 per 1000 GHz-seconds)
    network: 0.12, // per GB egress ($0.12 per GB)
  },
  hosting: {
    storage: 0.00000002685546875, // per GB per month ($0.026 per GB)
    transfer: 0.15, // per GB transferred ($0.15 per GB)
  },
  realtime: {
    storage: 0.00000002685546875, // per GB per month ($0.026 per GB)
    transfer: 0.12, // per GB transferred ($0.12 per GB)
  }
};

// Free tier allowances (monthly)
export const FREE_TIERS = {
  firestore: { reads: 50000, writes: 20000, deletes: 20000 },
  storage: { storageGB: 5, operationsClassA: 50000, operationsClassB: 50000, networkGB: 30 },
  functions: { invocations: 2000000, gbSeconds: 400000, cpuSeconds: 200000, networkGB: 5 },
  hosting: { storageGB: 10, transferGB: 10 },
  realtime: { storageGB: 1, transferGB: 10 }
};

export interface FirebaseUsage {
  firestore: {
    reads: number;
    writes: number;
    deletes: number;
  };
  storage: {
    uploads: number;
    downloads: number;
    deletes: number;
    storageGB: number;
    downloadGB: number;
  };
  functions: {
    invocations: number;
    gbSeconds: number;
    cpuSeconds: number;
    networkGB: number;
  };
  hosting: {
    storageGB: number;
    transferGB: number;
  };
  realtime: {
    storageGB: number;
    transferGB: number;
  };
}

export interface CostBreakdown {
  firestore: number;
  storage: number;
  functions: number;
  hosting: number;
  realtime: number;
  total: number;
}

export interface UsageRecord {
  id?: string;
  timestamp: Timestamp;
  period: 'hourly' | 'daily' | 'monthly';
  usage: FirebaseUsage;
  costs: CostBreakdown;
  alertsTriggered: string[];
}

@Injectable({
  providedIn: 'root'
})
export class CostMonitoringService {
  private currentUsage = signal<FirebaseUsage>({
    firestore: { reads: 0, writes: 0, deletes: 0 },
    storage: { uploads: 0, downloads: 0, deletes: 0, storageGB: 0, downloadGB: 0 },
    functions: { invocations: 0, gbSeconds: 0, cpuSeconds: 0, networkGB: 0 },
    hosting: { storageGB: 0, transferGB: 0 },
    realtime: { storageGB: 0, transferGB: 0 }
  });

  private costThresholds = environment.costMonitoring.thresholds;

  constructor() {
    // Load existing usage data on initialization
    this.loadCurrentUsage();
  }

  // Firestore operation tracking
  trackFirestoreRead(count: number = 1): void {
    this.currentUsage.update(usage => ({
      ...usage,
      firestore: {
        ...usage.firestore,
        reads: usage.firestore.reads + count
      }
    }));
  }

  trackFirestoreWrite(count: number = 1): void {
    this.currentUsage.update(usage => ({
      ...usage,
      firestore: {
        ...usage.firestore,
        writes: usage.firestore.writes + count
      }
    }));
  }

  trackFirestoreDelete(count: number = 1): void {
    this.currentUsage.update(usage => ({
      ...usage,
      firestore: {
        ...usage.firestore,
        deletes: usage.firestore.deletes + count
      }
    }));
  }

  // Cloud Storage operation tracking
  trackStorageUpload(sizeBytes: number): void {
    this.currentUsage.update(usage => ({
      ...usage,
      storage: {
        ...usage.storage,
        uploads: usage.storage.uploads + 1,
        storageGB: usage.storage.storageGB + (sizeBytes / (1024 * 1024 * 1024)) // Convert to GB
      }
    }));
  }

  trackStorageDownload(sizeBytes: number): void {
    this.currentUsage.update(usage => ({
      ...usage,
      storage: {
        ...usage.storage,
        downloads: usage.storage.downloads + 1,
        downloadGB: usage.storage.downloadGB + (sizeBytes / (1024 * 1024 * 1024))
      }
    }));
  }

  trackStorageDelete(): void {
    this.currentUsage.update(usage => ({
      ...usage,
      storage: {
        ...usage.storage,
        deletes: usage.storage.deletes + 1
      }
    }));
  }

  // Cloud Functions tracking
  trackFunctionInvocation(gbSeconds: number = 0.1, cpuSeconds: number = 0.1, networkGB: number = 0): void {
    this.currentUsage.update(usage => ({
      ...usage,
      functions: {
        invocations: usage.functions.invocations + 1,
        gbSeconds: usage.functions.gbSeconds + gbSeconds,
        cpuSeconds: usage.functions.cpuSeconds + cpuSeconds,
        networkGB: usage.functions.networkGB + networkGB
      }
    }));
  }

  // Hosting tracking
  trackHostingTransfer(bytes: number): void {
    this.currentUsage.update(usage => ({
      ...usage,
      hosting: {
        ...usage.hosting,
        transferGB: usage.hosting.transferGB + (bytes / (1024 * 1024 * 1024)) // Convert to GB
      }
    }));
  }

  // Estimate hosting transfer based on page views (rough estimation)
  estimateHostingTransfer(pageViews: number, avgPageSizeKB: number = 500): void {
    const totalKB = pageViews * avgPageSizeKB;
    const totalBytes = totalKB * 1024;
    this.trackHostingTransfer(totalBytes);
  }

  // Cost calculation
  calculateCosts(usage: FirebaseUsage): CostBreakdown {
    // Apply free tiers (assuming monthly usage)
    const effectiveFirestoreReads = Math.max(0, usage.firestore.reads - FREE_TIERS.firestore.reads);
    const effectiveFirestoreWrites = Math.max(0, usage.firestore.writes - FREE_TIERS.firestore.writes);
    const effectiveFirestoreDeletes = Math.max(0, usage.firestore.deletes - FREE_TIERS.firestore.deletes);

    const firestore = (
      effectiveFirestoreReads * FIREBASE_PRICING.firestore.reads +
      effectiveFirestoreWrites * FIREBASE_PRICING.firestore.writes +
      effectiveFirestoreDeletes * FIREBASE_PRICING.firestore.deletes
    );

    const effectiveStorageGB = Math.max(0, usage.storage.storageGB - FREE_TIERS.storage.storageGB);
    const effectiveClassAOps = Math.max(0, usage.storage.uploads - FREE_TIERS.storage.operationsClassA);
    const effectiveClassBOps = Math.max(0, (usage.storage.downloads + usage.storage.deletes) - FREE_TIERS.storage.operationsClassB);
    const effectiveNetworkGB = Math.max(0, usage.storage.downloadGB - FREE_TIERS.storage.networkGB);

    const storage = (
      effectiveStorageGB * FIREBASE_PRICING.storage.storage +
      (effectiveClassAOps / 1000) * FIREBASE_PRICING.storage.operations.classA +
      (effectiveClassBOps / 1000) * FIREBASE_PRICING.storage.operations.classB +
      effectiveNetworkGB * FIREBASE_PRICING.storage.operations.network
    );

    const effectiveInvocations = Math.max(0, usage.functions.invocations - FREE_TIERS.functions.invocations);
    const effectiveGbSeconds = Math.max(0, usage.functions.gbSeconds - FREE_TIERS.functions.gbSeconds);
    const effectiveCpuSeconds = Math.max(0, usage.functions.cpuSeconds - FREE_TIERS.functions.cpuSeconds);
    const effectiveFunctionsNetworkGB = Math.max(0, usage.functions.networkGB - FREE_TIERS.functions.networkGB);

    const functions = (
      effectiveInvocations * FIREBASE_PRICING.functions.invocations +
      effectiveGbSeconds * FIREBASE_PRICING.functions.gbSeconds +
      effectiveCpuSeconds * FIREBASE_PRICING.functions.cpuTime +
      effectiveFunctionsNetworkGB * FIREBASE_PRICING.functions.network
    );

    const effectiveHostingStorage = Math.max(0, usage.hosting.storageGB - FREE_TIERS.hosting.storageGB);
    const effectiveHostingTransfer = Math.max(0, usage.hosting.transferGB - FREE_TIERS.hosting.transferGB);

    const hosting = (
      effectiveHostingStorage * FIREBASE_PRICING.hosting.storage +
      effectiveHostingTransfer * FIREBASE_PRICING.hosting.transfer
    );

    const effectiveRealtimeStorage = Math.max(0, usage.realtime.storageGB - FREE_TIERS.realtime.storageGB);
    const effectiveRealtimeTransfer = Math.max(0, usage.realtime.transferGB - FREE_TIERS.realtime.transferGB);

    const realtime = (
      effectiveRealtimeStorage * FIREBASE_PRICING.realtime.storage +
      effectiveRealtimeTransfer * FIREBASE_PRICING.realtime.transfer
    );

    const total = firestore + storage + functions + hosting + realtime;

    // Add logging for debugging
    console.log('💰 Cost calculation:', {
      usage,
      effective: {
        firestore: { reads: effectiveFirestoreReads, writes: effectiveFirestoreWrites, deletes: effectiveFirestoreDeletes },
        storage: { storageGB: effectiveStorageGB, classAOps: effectiveClassAOps, classBOps: effectiveClassBOps, networkGB: effectiveNetworkGB },
        functions: { invocations: effectiveInvocations, gbSeconds: effectiveGbSeconds, cpuSeconds: effectiveCpuSeconds, networkGB: effectiveFunctionsNetworkGB },
        hosting: { storageGB: effectiveHostingStorage, transferGB: effectiveHostingTransfer },
        realtime: { storageGB: effectiveRealtimeStorage, transferGB: effectiveRealtimeTransfer }
      },
      costs: { firestore, storage, functions, hosting, realtime, total }
    });

    return { firestore, storage, functions, hosting, realtime, total };
  }

  // Get current usage and costs
  getCurrentUsage(): FirebaseUsage {
    return this.currentUsage();
  }

  getCurrentCosts(): CostBreakdown {
    return this.calculateCosts(this.currentUsage());
  }

  // Alert checking
  checkAlerts(costs: CostBreakdown): string[] {
    const alerts: string[] = [];
    const config = environment.costMonitoring.alerts;

    if (!config.enabled) return alerts;

    if (costs.total > this.costThresholds.daily) {
      alerts.push(`Daily cost threshold exceeded: $${costs.total.toFixed(2)} > $${this.costThresholds.daily}`);
    }

    if (costs.firestore > config.firestoreThreshold) {
      alerts.push(`High Firestore costs: $${costs.firestore.toFixed(2)}`);
    }

    if (costs.functions > config.functionsThreshold) {
      alerts.push(`High Functions costs: $${costs.functions.toFixed(2)}`);
    }

    if (costs.storage > config.storageThreshold) {
      alerts.push(`High Storage costs: $${costs.storage.toFixed(2)}`);
    }

    return alerts;
  }

  // Save usage record
  async saveUsageRecord(period: 'hourly' | 'daily' | 'monthly'): Promise<void> {
    const usage = this.currentUsage();
    const costs = this.calculateCosts(usage);
    const alerts = this.checkAlerts(costs);

    const record: Omit<UsageRecord, 'id'> = {
      timestamp: Timestamp.now(),
      period,
      usage,
      costs,
      alertsTriggered: alerts
    };

    try {
      await addDoc(collection(db, 'costMonitoring'), record);
      console.log(`💰 Cost monitoring: ${period} usage record saved`, { costs, alerts });

      // Reset current usage after saving
      this.resetUsage();
    } catch (error) {
      console.error('Error saving usage record:', error);
    }
  }

  // Load current usage from recent records
  private async loadCurrentUsage(): Promise<void> {
    try {
      const q = query(
        collection(db, 'costMonitoring'),
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const latestRecord = snapshot.docs[0].data() as UsageRecord;
        // Could load cumulative data here if needed
        console.log('💰 Cost monitoring: Loaded latest usage record');
      }
    } catch (error: any) {
      // Only log non-permission errors
      if (error.code !== 'permission-denied') {
        console.error('Error loading current usage:', error);
      }
    }
  }

  // Reset usage counters
  private resetUsage(): void {
    this.currentUsage.set({
      firestore: { reads: 0, writes: 0, deletes: 0 },
      storage: { uploads: 0, downloads: 0, deletes: 0, storageGB: 0, downloadGB: 0 },
      functions: { invocations: 0, gbSeconds: 0, cpuSeconds: 0, networkGB: 0 },
      hosting: { storageGB: 0, transferGB: 0 },
      realtime: { storageGB: 0, transferGB: 0 }
    });
  }

  // Get usage history
  async getUsageHistory(period: 'hourly' | 'daily' | 'monthly', limitCount: number = 30): Promise<UsageRecord[]> {
    try {
      const q = query(
        collection(db, 'costMonitoring'),
        where('period', '==', period),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UsageRecord));
    } catch (error) {
      console.error('Error getting usage history:', error);
      return [];
    }
  }

  // Update cost thresholds
  updateThresholds(daily: number, monthly: number): void {
    this.costThresholds = { daily, monthly };
  }

  // Test method to calculate costs with provided usage data
  testCalculateCosts(): void {
    const testUsage: FirebaseUsage = {
      firestore: { reads: 1500000, writes: 600000, deletes: 600000 },
      storage: { uploads: 210000, downloads: 1890000, deletes: 0, storageGB: 5, downloadGB: 30 },
      functions: { invocations: 2000000, gbSeconds: 400000, cpuSeconds: 200000, networkGB: 5 },
      hosting: { storageGB: 10, transferGB: 10 },
      realtime: { storageGB: 1, transferGB: 10 }
    };

    const costs = this.calculateCosts(testUsage);
    console.log('💰 Test cost calculation with user data:', costs);
  }

  // Enhanced cost prediction and alerting

  /**
   * Predict monthly costs based on current usage patterns
   */
  async predictMonthlyCosts(): Promise<{
    predictedTotal: number;
    breakdown: CostBreakdown;
    confidence: number;
    recommendations: string[];
  }> {
    try {
      const recentHistory = await this.getUsageHistory('daily', 30);
      if (recentHistory.length === 0) {
        return {
          predictedTotal: 0,
          breakdown: this.getCurrentCosts(),
          confidence: 0,
          recommendations: ['Not enough data for prediction']
        };
      }

      // Calculate average daily usage
      const avgUsage: FirebaseUsage = {
        firestore: { reads: 0, writes: 0, deletes: 0 },
        storage: { uploads: 0, downloads: 0, deletes: 0, storageGB: 0, downloadGB: 0 },
        functions: { invocations: 0, gbSeconds: 0, cpuSeconds: 0, networkGB: 0 },
        hosting: { storageGB: 0, transferGB: 0 },
        realtime: { storageGB: 0, transferGB: 0 }
      };

      recentHistory.forEach(record => {
        avgUsage.firestore.reads += record.usage.firestore.reads;
        avgUsage.firestore.writes += record.usage.firestore.writes;
        avgUsage.firestore.deletes += record.usage.firestore.deletes;

        avgUsage.storage.uploads += record.usage.storage.uploads;
        avgUsage.storage.downloads += record.usage.storage.downloads;
        avgUsage.storage.deletes += record.usage.storage.deletes;
        avgUsage.storage.storageGB += record.usage.storage.storageGB;
        avgUsage.storage.downloadGB += record.usage.storage.downloadGB;

        avgUsage.functions.invocations += record.usage.functions.invocations;
        avgUsage.functions.gbSeconds += record.usage.functions.gbSeconds;
        avgUsage.functions.cpuSeconds += record.usage.functions.cpuSeconds;
        avgUsage.functions.networkGB += record.usage.functions.networkGB;

        avgUsage.hosting.storageGB += record.usage.hosting.storageGB;
        avgUsage.hosting.transferGB += record.usage.hosting.transferGB;

        avgUsage.realtime.storageGB += record.usage.realtime.storageGB;
        avgUsage.realtime.transferGB += record.usage.realtime.transferGB;
      });

      // Average per day
      const days = recentHistory.length;
      Object.keys(avgUsage.firestore).forEach(key => {
        (avgUsage.firestore as any)[key] /= days;
      });
      Object.keys(avgUsage.storage).forEach(key => {
        (avgUsage.storage as any)[key] /= days;
      });
      Object.keys(avgUsage.functions).forEach(key => {
        (avgUsage.functions as any)[key] /= days;
      });
      Object.keys(avgUsage.hosting).forEach(key => {
        (avgUsage.hosting as any)[key] /= days;
      });
      Object.keys(avgUsage.realtime).forEach(key => {
        (avgUsage.realtime as any)[key] /= days;
      });

      // Project to monthly (30 days)
      const monthlyUsage: FirebaseUsage = {
        firestore: {
          reads: avgUsage.firestore.reads * 30,
          writes: avgUsage.firestore.writes * 30,
          deletes: avgUsage.firestore.deletes * 30
        },
        storage: {
          uploads: avgUsage.storage.uploads * 30,
          downloads: avgUsage.storage.downloads * 30,
          deletes: avgUsage.storage.deletes * 30,
          storageGB: Math.max(avgUsage.storage.storageGB, 5), // Minimum storage
          downloadGB: avgUsage.storage.downloadGB * 30
        },
        functions: {
          invocations: avgUsage.functions.invocations * 30,
          gbSeconds: avgUsage.functions.gbSeconds * 30,
          cpuSeconds: avgUsage.functions.cpuSeconds * 30,
          networkGB: avgUsage.functions.networkGB * 30
        },
        hosting: {
          storageGB: Math.max(avgUsage.hosting.storageGB, 10), // Minimum hosting
          transferGB: avgUsage.hosting.transferGB * 30
        },
        realtime: {
          storageGB: Math.max(avgUsage.realtime.storageGB, 1), // Minimum realtime
          transferGB: avgUsage.realtime.transferGB * 30
        }
      };

      const predictedCosts = this.calculateCosts(monthlyUsage);
      const confidence = Math.min(days / 30, 1) * 100; // Confidence based on data points

      const recommendations = this.generateCostRecommendations(predictedCosts, monthlyUsage);

      return {
        predictedTotal: predictedCosts.total,
        breakdown: predictedCosts,
        confidence: Math.round(confidence),
        recommendations
      };
    } catch (error) {
      console.error('Error predicting monthly costs:', error);
      return {
        predictedTotal: 0,
        breakdown: this.getCurrentCosts(),
        confidence: 0,
        recommendations: ['Error calculating prediction']
      };
    }
  }

  /**
   * Generate cost optimization recommendations
   */
  private generateCostRecommendations(costs: CostBreakdown, usage: FirebaseUsage): string[] {
    const recommendations: string[] = [];

    if (costs.firestore > 5) {
      recommendations.push('High Firestore costs: Consider implementing more aggressive caching or reducing query frequency');
    }

    if (costs.functions > 3) {
      recommendations.push('High Functions costs: Review function optimization and consider reducing invocation frequency');
    }

    if (costs.storage > 2) {
      recommendations.push('High Storage costs: Optimize storage usage and consider data lifecycle policies');
    }

    if (usage.firestore.reads > 1000000) {
      recommendations.push('Excessive Firestore reads: Implement pagination and reduce unnecessary queries');
    }

    if (usage.functions.invocations > 1000000) {
      recommendations.push('High function invocations: Consider batching operations or client-side processing');
    }

    if (recommendations.length === 0) {
      recommendations.push('Costs are within acceptable ranges. Continue monitoring usage patterns.');
    }

    return recommendations;
  }

  /**
   * Get cost efficiency metrics
   */
  async getCostEfficiencyMetrics(): Promise<{
    costPerUser: number;
    costPerTransaction: number;
    efficiency: 'excellent' | 'good' | 'fair' | 'poor';
    optimizationOpportunities: string[];
  }> {
    try {
      const currentCosts = this.getCurrentCosts();
      const totalUsers = 50; // This should come from user service
      const totalTransactions = 1000; // This should be calculated from usage

      const costPerUser = currentCosts.total / totalUsers;
      const costPerTransaction = currentCosts.total / totalTransactions;

      let efficiency: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
      if (costPerUser > 0.5) efficiency = 'poor';
      else if (costPerUser > 0.2) efficiency = 'fair';
      else if (costPerUser > 0.1) efficiency = 'good';

      const optimizationOpportunities = [];
      if (costPerUser > 0.3) {
        optimizationOpportunities.push('Consider user-based rate limiting');
      }
      if (costPerTransaction > 0.01) {
        optimizationOpportunities.push('Optimize transaction processing');
      }

      return {
        costPerUser,
        costPerTransaction,
        efficiency,
        optimizationOpportunities
      };
    } catch (error) {
      console.error('Error calculating cost efficiency:', error);
      return {
        costPerUser: 0,
        costPerTransaction: 0,
        efficiency: 'fair',
        optimizationOpportunities: ['Unable to calculate metrics']
      };
    }
  }

  /**
   * Set up automated cost alerts
   */
  setupAutomatedAlerts(thresholds: {
    dailyLimit: number;
    monthlyProjection: number;
    efficiencyThreshold: number;
  }): void {
    console.log('💰 Cost monitoring: Automated alerts configured', thresholds);
    // This would integrate with notification service for automated alerts
  }
}