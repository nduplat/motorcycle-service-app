#!/usr/bin/env node

/**
 * Conflict Resolution Validation Script
 *
 * Validates that the client-flow ↔ queue conflict has been properly resolved
 * by checking the separation of concerns and proper delegation patterns.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ConflictResolutionValidator {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.issues = [];
    this.warnings = [];
  }

  /**
   * Main validation function
   */
  async validate() {
    console.log('🔍 Validating Client-Flow ↔ Queue Conflict Resolution...\n');

    try {
      await this.checkServiceSeparation();
      await this.checkProperDelegation();
      await this.checkStateManagement();
      await this.checkNoDirectQueueManipulation();
      await this.checkIntegrationPatterns();

      this.printResults();

      return this.issues.length === 0;

    } catch (error) {
      console.error('❌ Validation failed with error:', error.message);
      return false;
    }
  }

  /**
   * Check that services are properly separated
   */
  async checkServiceSeparation() {
    console.log('📋 Checking service separation...');

    const clientFlowService = await this.readServiceFile('client-flow.service.ts');
    const unifiedQueueService = await this.readServiceFile('unified-queue.service.ts');
    const queueService = await this.readServiceFile('queue.service.ts');

    // ClientFlowService should not have queue management methods
    const queueMethods = ['addToQueue', 'callNext', 'updateQueueEntry', 'getQueueEntries'];
    queueMethods.forEach(method => {
      if (clientFlowService.includes(` ${method}(`) || clientFlowService.includes(`\n${method}(`)) {
        this.issues.push(`ClientFlowService still contains queue method: ${method}`);
      }
    });

    // UnifiedQueueService should have proper queue management
    if (!unifiedQueueService.includes('addEntry(')) {
      this.issues.push('UnifiedQueueService missing addEntry method');
    }
    if (!unifiedQueueService.includes('callNext(')) {
      this.issues.push('UnifiedQueueService missing callNext method');
    }

    // QueueService should still exist but be legacy
    if (!queueService) {
      this.warnings.push('QueueService not found - may have been completely replaced');
    }

    console.log('✅ Service separation check completed');
  }

  /**
   * Check that ClientFlowService properly delegates to UnifiedQueueService
   */
  async checkProperDelegation() {
    console.log('🔗 Checking proper delegation patterns...');

    const clientFlowService = await this.readServiceFile('client-flow.service.ts');

    // Should import UnifiedQueueService
    if (!clientFlowService.includes("import { UnifiedQueueService }")) {
      this.issues.push('ClientFlowService does not import UnifiedQueueService');
    }

    // Should inject UnifiedQueueService
    if (!clientFlowService.includes('private unifiedQueue: UnifiedQueueService') &&
        !clientFlowService.includes('unifiedQueue: UnifiedQueueService')) {
      this.issues.push('ClientFlowService does not inject UnifiedQueueService');
    }

    // Should delegate queue operations
    if (!clientFlowService.includes('this.unifiedQueue.addEntry') &&
        !clientFlowService.includes('unifiedQueue.addEntry')) {
      this.issues.push('ClientFlowService does not delegate addEntry to UnifiedQueueService');
    }

    console.log('✅ Delegation pattern check completed');
  }

  /**
   * Check state management separation
   */
  async checkStateManagement() {
    console.log('📊 Checking state management separation...');

    const clientFlowService = await this.readServiceFile('client-flow.service.ts');
    const unifiedQueueService = await this.readServiceFile('unified-queue.service.ts');

    // ClientFlowService should only manage flow state
    const flowStateSignals = ['currentStep', 'phone', 'selectedMotorcycle', 'selectedService'];
    flowStateSignals.forEach(signal => {
      if (!clientFlowService.includes(`private ${signal} = signal`) &&
          !clientFlowService.includes(`${signal} = signal`)) {
        this.warnings.push(`ClientFlowService may be missing flow state signal: ${signal}`);
      }
    });

    // UnifiedQueueService should manage queue state
    if (!unifiedQueueService.includes('private queueEntries = signal')) {
      this.issues.push('UnifiedQueueService missing queue entries state management');
    }

    // ClientFlowService should not store full queue entry data
    if (clientFlowService.includes('queueEntry: QueueEntry')) {
      this.issues.push('ClientFlowService should not store full QueueEntry objects');
    }

    // Should only store queue entry ID reference
    if (!clientFlowService.includes('currentQueueEntryId')) {
      this.issues.push('ClientFlowService missing queue entry ID reference');
    }

    console.log('✅ State management check completed');
  }

  /**
   * Check that ClientFlowService doesn't directly manipulate queue data
   */
  async checkNoDirectQueueManipulation() {
    console.log('🚫 Checking for direct queue manipulation...');

    const clientFlowService = await this.readServiceFile('client-flow.service.ts');

    // Should not directly access Firestore queue collections
    if (clientFlowService.includes("collection(db, 'queue") ||
        clientFlowService.includes('queueEntries') && clientFlowService.includes('addDoc')) {
      this.issues.push('ClientFlowService directly manipulating queue Firestore collections');
    }

    // Should not create queue entries directly
    if (clientFlowService.includes('addDoc') && clientFlowService.includes('queueEntries')) {
      this.issues.push('ClientFlowService creating queue entries directly');
    }

    // Should not update queue status directly
    if (clientFlowService.includes('updateDoc') && clientFlowService.includes('queue')) {
      this.issues.push('ClientFlowService updating queue data directly');
    }

    console.log('✅ Direct manipulation check completed');
  }

  /**
   * Check integration patterns and event handling
   */
  async checkIntegrationPatterns() {
    console.log('🔄 Checking integration patterns...');

    const clientFlowService = await this.readServiceFile('client-flow.service.ts');
    const unifiedQueueService = await this.readServiceFile('unified-queue.service.ts');

    // Should use event-driven communication
    if (!unifiedQueueService.includes('this.eventBus.emit')) {
      this.warnings.push('UnifiedQueueService not emitting events for integration');
    }

    // Should handle completion properly
    if (!clientFlowService.includes('completeFlow')) {
      this.issues.push('ClientFlowService missing completeFlow method');
    }

    // Should navigate after completion
    if (!clientFlowService.includes('navigate') || !clientFlowService.includes('wait-ticket')) {
      this.issues.push('ClientFlowService not navigating to wait-ticket after completion');
    }

    // Should integrate with cache invalidation
    if (!clientFlowService.includes('invalidateByEntity') ||
        !clientFlowService.includes('queue')) {
      this.warnings.push('ClientFlowService not invalidating queue cache after completion');
    }

    console.log('✅ Integration pattern check completed');
  }

  /**
   * Helper to read service files
   */
  async readServiceFile(filename) {
    const filePath = path.join(this.projectRoot, 'src', 'services', filename);
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.warn(`Warning: Could not read ${filename}:`, error.message);
      return '';
    }
  }

  /**
   * Print validation results
   */
  printResults() {
    console.log('\n📊 Validation Results:');
    console.log('='.repeat(50));

    if (this.issues.length === 0 && this.warnings.length === 0) {
      console.log('✅ SUCCESS: No conflicts detected!');
      console.log('🎉 Client-Flow ↔ Queue conflict has been properly resolved.');
      return;
    }

    if (this.issues.length > 0) {
      console.log(`❌ ISSUES FOUND (${this.issues.length}):`);
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

    if (this.issues.length > 0) {
      console.log('\n🔧 ACTION REQUIRED: Issues must be resolved before deployment.');
      process.exit(1);
    } else {
      console.log('\n✅ READY: Only warnings found, safe to proceed.');
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ConflictResolutionValidator();
  validator.validate().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export default ConflictResolutionValidator;