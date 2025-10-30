#!/usr/bin/env node

/**
 * Performance Validation Script
 *
 * Validates that performance improvements have been implemented correctly
 * and measures key performance metrics for the refactored system.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PerformanceValidator {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.metrics = {
      cacheImplementations: 0,
      pollingImplementations: 0,
      batchOperations: 0,
      optimisticLocking: 0,
      costOptimizations: 0
    };
    this.issues = [];
    this.warnings = [];
  }

  /**
   * Main validation function
   */
  async validate() {
    console.log('⚡ Validating Performance Optimizations...\n');

    try {
      await this.checkCacheImplementations();
      await this.checkPollingOptimizations();
      await this.checkBatchOperations();
      await this.checkOptimisticLocking();
      await this.checkCostOptimizations();
      await this.checkRealTimeUpdatesDisabled();
      await this.validatePerformanceMetrics();

      this.printResults();

      return this.issues.length === 0;

    } catch (error) {
      console.error('❌ Performance validation failed:', error.message);
      return false;
    }
  }

  /**
   * Check cache implementations
   */
  async checkCacheImplementations() {
    console.log('📦 Checking cache implementations...');

    const unifiedQueueService = await this.readServiceFile('unified-queue.service.ts');
    const clientFlowService = await this.readServiceFile('client-flow.service.ts');
    const cacheService = await this.readServiceFile('cache.service.ts');

    // Check UnifiedQueueService caching
    if (unifiedQueueService.includes('CACHE_TTL') &&
        unifiedQueueService.includes('cacheService.get') &&
        unifiedQueueService.includes('cacheService.set')) {
      this.metrics.cacheImplementations++;
    } else {
      this.issues.push('UnifiedQueueService missing proper cache implementation');
    }

    // Check cache invalidation
    if (unifiedQueueService.includes('invalidateByEntity') &&
        unifiedQueueService.includes('queue')) {
      this.metrics.cacheImplementations++;
    } else {
      this.warnings.push('UnifiedQueueService may not be invalidating cache properly');
    }

    // Check CacheService exists and has required methods
    if (cacheService && cacheService.includes('warmupCriticalData')) {
      this.metrics.cacheImplementations++;
    } else {
      this.issues.push('CacheService missing critical data warmup functionality');
    }

    console.log('✅ Cache implementation check completed');
  }

  /**
   * Check polling optimizations instead of real-time listeners
   */
  async checkPollingOptimizations() {
    console.log('🔄 Checking polling optimizations...');

    const queueService = await this.readServiceFile('queue.service.ts');
    const unifiedQueueService = await this.readServiceFile('unified-queue.service.ts');

    // Check that real-time listeners are disabled by default
    if (unifiedQueueService.includes('Real-time updates disabled by default') ||
        !unifiedQueueService.includes('startRealtimeUpdates()')) {
      this.metrics.pollingImplementations++;
    } else {
      this.warnings.push('UnifiedQueueService may have real-time updates enabled by default');
    }

    // Check for polling intervals in queue management
    if (queueService.includes('setInterval') &&
        queueService.includes('30000')) { // 30 second polling
      this.metrics.pollingImplementations++;
    } else {
      this.warnings.push('QueueService may not have proper polling intervals');
    }

    // Check intelligent polling in wait ticket
    const waitTicketComponent = await this.readComponentFile('wait-ticket.component.ts');
    if (waitTicketComponent.includes('pollingInterval') &&
        waitTicketComponent.includes('setTimeout')) {
      this.metrics.pollingImplementations++;
    } else {
      this.warnings.push('WaitTicketComponent missing intelligent polling');
    }

    console.log('✅ Polling optimization check completed');
  }

  /**
   * Check batch operations implementation
   */
  async checkBatchOperations() {
    console.log('📊 Checking batch operations...');

    const unifiedQueueService = await this.readServiceFile('unified-queue.service.ts');

    // Check for batch operations in queue management
    if (unifiedQueueService.includes('writeBatch') ||
        unifiedQueueService.includes('Promise.all')) {
      this.metrics.batchOperations++;
    } else {
      this.warnings.push('UnifiedQueueService may not be using batch operations');
    }

    // Check atomic operations
    if (unifiedQueueService.includes('runTransaction')) {
      this.metrics.batchOperations++;
    } else {
      this.issues.push('UnifiedQueueService missing atomic transaction support');
    }

    console.log('✅ Batch operations check completed');
  }

  /**
   * Check optimistic locking implementation
   */
  async checkOptimisticLocking() {
    console.log('🔒 Checking optimistic locking...');

    const unifiedQueueService = await this.readServiceFile('unified-queue.service.ts');

    // Check for retry mechanisms
    if (unifiedQueueService.includes('executeWithRetry') ||
        unifiedQueueService.includes('MAX_RETRY_ATTEMPTS')) {
      this.metrics.optimisticLocking++;
    } else {
      this.issues.push('UnifiedQueueService missing retry mechanisms for optimistic locking');
    }

    // Check for transaction handling
    if (unifiedQueueService.includes('runTransaction') &&
        unifiedQueueService.includes('failed-precondition')) {
      this.metrics.optimisticLocking++;
    } else {
      this.warnings.push('UnifiedQueueService may not handle transaction conflicts properly');
    }

    console.log('✅ Optimistic locking check completed');
  }

  /**
   * Check cost optimization implementations
   */
  async checkCostOptimizations() {
    console.log('💰 Checking cost optimizations...');

    const firestoreRules = await this.readFile('firestore.rules');
    const unifiedQueueService = await this.readServiceFile('unified-queue.service.ts');

    // Check Firestore rules for cost optimization
    if (firestoreRules.includes('allow read: if isCustomer()') &&
        firestoreRules.includes('allow read: if isTechnician()')) {
      this.metrics.costOptimizations++;
    } else {
      this.warnings.push('Firestore rules may not be optimized for cost');
    }

    // Check for listener management
    if (unifiedQueueService.includes('disableRealtimeUpdates') ||
        unifiedQueueService.includes('Real-time updates disabled')) {
      this.metrics.costOptimizations++;
    } else {
      this.issues.push('Real-time updates not properly disabled for cost optimization');
    }

    // Check cache TTL settings
    if (unifiedQueueService.includes('CACHE_TTL = 30000') ||
        unifiedQueueService.includes('CACHE_TTL = 5 * 1000')) {
      this.metrics.costOptimizations++;
    } else {
      this.warnings.push('Cache TTL may not be optimized for cost');
    }

    console.log('✅ Cost optimization check completed');
  }

  /**
   * Check that real-time updates are disabled by default
   */
  async checkRealTimeUpdatesDisabled() {
    console.log('🔇 Checking real-time updates are disabled...');

    const unifiedQueueService = await this.readServiceFile('unified-queue.service.ts');

    // Check that real-time updates are not enabled by default
    if (unifiedQueueService.includes('Real-time updates disabled by default') &&
        !unifiedQueueService.includes('startRealtimeUpdates()')) {
      this.metrics.costOptimizations++;
    } else {
      this.issues.push('Real-time updates may be enabled by default, increasing costs');
    }

    // Check for manual enable option
    if (unifiedQueueService.includes('enableRealtimeUpdates()')) {
      this.metrics.costOptimizations++;
    } else {
      this.warnings.push('No manual option to enable real-time updates when needed');
    }

    console.log('✅ Real-time updates check completed');
  }

  /**
   * Validate performance metrics against targets
   */
  async validatePerformanceMetrics() {
    console.log('📈 Validating performance metrics...');

    const expectedMetrics = {
      cacheImplementations: 3,
      pollingImplementations: 3,
      batchOperations: 2,
      optimisticLocking: 2,
      costOptimizations: 4
    };

    const totalExpected = Object.values(expectedMetrics).reduce((sum, val) => sum + val, 0);
    const totalActual = Object.values(this.metrics).reduce((sum, val) => sum + val, 0);

    console.log(`Performance Score: ${totalActual}/${totalExpected}`);

    // Check each metric
    Object.keys(expectedMetrics).forEach(key => {
      const expected = expectedMetrics[key];
      const actual = this.metrics[key];

      if (actual < expected) {
        this.warnings.push(`${key}: ${actual}/${expected} implementations found`);
      } else {
        console.log(`✅ ${key}: ${actual}/${expected} ✓`);
      }
    });

    // Overall performance score
    const score = (totalActual / totalExpected) * 100;
    if (score >= 80) {
      console.log(`🎯 Performance Score: ${score.toFixed(1)}% - Excellent!`);
    } else if (score >= 60) {
      console.log(`⚠️ Performance Score: ${score.toFixed(1)}% - Good, but can be improved`);
    } else {
      console.log(`❌ Performance Score: ${score.toFixed(1)}% - Needs improvement`);
      this.issues.push(`Performance score too low: ${score.toFixed(1)}%`);
    }

    console.log('✅ Performance metrics validation completed');
  }

  /**
   * Helper to read service files
   */
  async readServiceFile(filename) {
    return this.readFile(path.join('src', 'services', filename));
  }

  /**
   * Helper to read component files
   */
  async readComponentFile(filename) {
    return this.readFile(path.join('src', 'components', 'public', 'client-flow', filename));
  }

  /**
   * Helper to read any file
   */
  async readFile(filePath) {
    try {
      return fs.readFileSync(path.join(this.projectRoot, filePath), 'utf8');
    } catch (error) {
      console.warn(`Warning: Could not read ${filePath}:`, error.message);
      return '';
    }
  }

  /**
   * Print validation results
   */
  printResults() {
    console.log('\n📊 Performance Validation Results:');
    console.log('='.repeat(50));

    if (this.issues.length === 0 && this.warnings.length === 0) {
      console.log('✅ SUCCESS: All performance optimizations implemented!');
      console.log('🚀 System is optimized for cost and performance.');
      return;
    }

    if (this.issues.length > 0) {
      console.log(`❌ CRITICAL ISSUES (${this.issues.length}):`);
      this.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log(`⚠️  WARNINGS (${this.warnings.length}):`);
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }

    // Performance metrics summary
    console.log('\n📈 Performance Metrics:');
    Object.entries(this.metrics).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    if (this.issues.length > 0) {
      console.log('\n🔧 ACTION REQUIRED: Critical performance issues must be resolved.');
      process.exit(1);
    } else {
      console.log('\n✅ READY: Performance optimizations are in place.');
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new PerformanceValidator();
  validator.validate().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export default PerformanceValidator;