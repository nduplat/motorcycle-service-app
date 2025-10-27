/**
 * Automated Backup Cloud Functions for Blue Dragon Motors
 * =======================================================
 *
 * This module provides automated backup functionality for Firestore database
 * and Firebase Storage, with scheduling and monitoring capabilities.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { StructuredLogger, MetricsCollector } from './services';

const db = admin.firestore();
const storage = admin.storage();
const bucket = storage.bucket();

interface BackupMetadata {
  id: string;
  type: 'firestore' | 'storage' | 'full';
  timestamp: admin.firestore.Timestamp;
  status: 'running' | 'completed' | 'failed';
  size?: number;
  collections?: string[];
  fileCount?: number;
  duration?: number;
  errorMessage?: string;
  storagePath?: string;
}

interface BackupConfig {
  firestore: {
    enabled: boolean;
    collections: string[];
    excludeCollections: string[];
  };
  storage: {
    enabled: boolean;
    excludePrefixes: string[];
  };
  retention: {
    days: number;
  };
}

/**
 * Default backup configuration
 */
const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  firestore: {
    enabled: true,
    collections: [], // Empty means all collections
    excludeCollections: ['healthCheck', 'functionCache', 'rateLimits']
  },
  storage: {
    enabled: true,
    excludePrefixes: ['temp/', 'cache/']
  },
  retention: {
    days: 30
  }
};

/**
 * Get backup configuration from environment or use defaults
 */
function getBackupConfig(): BackupConfig {
  try {
    const configStr = process.env.BACKUP_CONFIG;
    if (configStr) {
      return { ...DEFAULT_BACKUP_CONFIG, ...JSON.parse(configStr) };
    }
  } catch (error: any) {
    StructuredLogger.warn('Failed to parse backup config, using defaults', { error: error.message });
  }
  return DEFAULT_BACKUP_CONFIG;
}

/**
 * Create Firestore backup
 */
async function createFirestoreBackup(config: BackupConfig): Promise<BackupMetadata> {
  const startTime = Date.now();
  const backupId = `firestore-${Date.now()}`;
  const backupPath = `backups/firestore/${backupId}`;

  StructuredLogger.info('Starting Firestore backup', { backupId });

  try {
    MetricsCollector.incrementCounter('backup.firestore.started');

    // Get all collections to backup
    let collections = config.firestore.collections;
    if (collections.length === 0) {
      // Get all collections dynamically
      const collectionsSnapshot = await db.listCollections();
      collections = collectionsSnapshot.map(col => col.id);
    }

    // Filter out excluded collections
    collections = collections.filter(col => !config.firestore.excludeCollections.includes(col));

    StructuredLogger.info('Backing up collections', { collections, count: collections.length });

    const backupData: any = {
      metadata: {
        backupId,
        type: 'firestore',
        timestamp: admin.firestore.Timestamp.now(),
        collections,
        version: '1.0'
      },
      collections: {}
    };

    let totalDocuments = 0;

    // Backup each collection
    for (const collectionName of collections) {
      try {
        const collectionRef = db.collection(collectionName);
        const snapshot = await collectionRef.get();

        if (!snapshot.empty) {
          const documents: any[] = [];
          snapshot.forEach(doc => {
            documents.push({
              id: doc.id,
              data: doc.data()
            });
          });

          backupData.collections[collectionName] = documents;
          totalDocuments += documents.length;

          StructuredLogger.debug(`Backed up collection ${collectionName}`, {
            documentCount: documents.length
          });
        }
      } catch (error: any) {
        StructuredLogger.error(`Failed to backup collection ${collectionName}`, error);
        // Continue with other collections
      }
    }

    // Save backup to storage
    const fileName = `${backupPath}/data.json`;
    const file = bucket.file(fileName);
    await file.save(JSON.stringify(backupData, null, 2), {
      metadata: {
        contentType: 'application/json',
        metadata: {
          backupId,
          type: 'firestore',
          collections: collections.join(','),
          documentCount: totalDocuments.toString()
        }
      }
    });

    const duration = Date.now() - startTime;
    const size = Buffer.byteLength(JSON.stringify(backupData));

    MetricsCollector.recordTiming('backup.firestore.duration', duration);
    MetricsCollector.incrementCounter('backup.firestore.completed');

    StructuredLogger.info('Firestore backup completed', {
      backupId,
      collectionsCount: collections.length,
      totalDocuments,
      size,
      duration
    });

    return {
      id: backupId,
      type: 'firestore',
      timestamp: admin.firestore.Timestamp.now(),
      status: 'completed',
      size,
      collections,
      duration,
      storagePath: fileName
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    MetricsCollector.recordError('backup.firestore');
    StructuredLogger.error('Firestore backup failed', error, { backupId, duration });

    return {
      id: backupId,
      type: 'firestore',
      timestamp: admin.firestore.Timestamp.now(),
      status: 'failed',
      duration,
      errorMessage: error.message
    };
  }
}

/**
 * Create Storage backup
 */
async function createStorageBackup(config: BackupConfig): Promise<BackupMetadata> {
  const startTime = Date.now();
  const backupId = `storage-${Date.now()}`;
  const backupPath = `backups/storage/${backupId}`;

  StructuredLogger.info('Starting Storage backup', { backupId });

  try {
    MetricsCollector.incrementCounter('backup.storage.started');

    // Get all files in storage
    const [files] = await bucket.getFiles();

    // Filter out excluded prefixes
    const filesToBackup = files.filter(file => {
      const fileName = file.name;
      return !config.storage.excludePrefixes.some(prefix => fileName.startsWith(prefix));
    });

    StructuredLogger.info('Backing up storage files', {
      totalFiles: files.length,
      filesToBackup: filesToBackup.length,
      excludedCount: files.length - filesToBackup.length
    });

    let totalSize = 0;
    const backupManifest: any[] = [];

    // Copy files to backup location
    for (const file of filesToBackup) {
      try {
        const backupFileName = `${backupPath}/${file.name}`;
        await file.copy(bucket.file(backupFileName));

        const [metadata] = await file.getMetadata();
        totalSize += parseInt(String(metadata.size || '0'));

        backupManifest.push({
          originalName: file.name,
          backupName: backupFileName,
          size: metadata.size,
          contentType: metadata.contentType,
          updated: metadata.updated
        });

        StructuredLogger.debug(`Backed up file ${file.name}`);
      } catch (error: any) {
        StructuredLogger.error(`Failed to backup file ${file.name}`, error);
      }
    }

    // Save backup manifest
    const manifestFileName = `${backupPath}/manifest.json`;
    const manifestFile = bucket.file(manifestFileName);
    await manifestFile.save(JSON.stringify({
      backupId,
      timestamp: admin.firestore.Timestamp.now(),
      totalFiles: filesToBackup.length,
      totalSize,
      files: backupManifest
    }, null, 2), {
      metadata: {
        contentType: 'application/json',
        metadata: {
          backupId,
          type: 'storage',
          fileCount: filesToBackup.length.toString(),
          totalSize: totalSize.toString()
        }
      }
    });

    const duration = Date.now() - startTime;

    MetricsCollector.recordTiming('backup.storage.duration', duration);
    MetricsCollector.incrementCounter('backup.storage.completed');

    StructuredLogger.info('Storage backup completed', {
      backupId,
      fileCount: filesToBackup.length,
      totalSize,
      duration
    });

    return {
      id: backupId,
      type: 'storage',
      timestamp: admin.firestore.Timestamp.now(),
      status: 'completed',
      size: totalSize,
      fileCount: filesToBackup.length,
      duration,
      storagePath: backupPath
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    MetricsCollector.recordError('backup.storage');
    StructuredLogger.error('Storage backup failed', error, { backupId, duration });

    return {
      id: backupId,
      type: 'storage',
      timestamp: admin.firestore.Timestamp.now(),
      status: 'failed',
      duration,
      errorMessage: error.message
    };
  }
}

/**
 * Clean up old backups based on retention policy
 */
async function cleanupOldBackups(config: BackupConfig): Promise<void> {
  try {
    StructuredLogger.info('Starting backup cleanup', { retentionDays: config.retention.days });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.retention.days);

    // Clean up Firestore backups
    const [firestoreFiles] = await bucket.getFiles({ prefix: 'backups/firestore/' });
    let deletedCount = 0;

    for (const file of firestoreFiles) {
      try {
        const [metadata] = await file.getMetadata();
        const timeCreated = metadata.timeCreated || metadata.updated;
        const fileDate = new Date(timeCreated || Date.now());

        if (fileDate < cutoffDate) {
          await file.delete();
          deletedCount++;
          StructuredLogger.debug(`Deleted old backup file: ${file.name}`);
        }
      } catch (error: any) {
        StructuredLogger.error(`Failed to delete old backup file ${file.name}`, error);
      }
    }

    // Clean up Storage backups
    const [storageFiles] = await bucket.getFiles({ prefix: 'backups/storage/' });

    for (const file of storageFiles) {
      try {
        const [metadata] = await file.getMetadata();
        const timeCreated = metadata.timeCreated || metadata.updated;
        const fileDate = new Date(timeCreated || Date.now());

        if (fileDate < cutoffDate) {
          await file.delete();
          deletedCount++;
          StructuredLogger.debug(`Deleted old storage backup file: ${file.name}`);
        }
      } catch (error: any) {
        StructuredLogger.error(`Failed to delete old storage backup file ${file.name}`, error);
      }
    }

    StructuredLogger.info('Backup cleanup completed', { deletedCount });

  } catch (error: any) {
    StructuredLogger.error('Backup cleanup failed', error);
  }
}

/**
 * Record backup metadata in Firestore
 */
async function recordBackupMetadata(metadata: BackupMetadata): Promise<void> {
  try {
    await db.collection('backupHistory').add(metadata);
    StructuredLogger.debug('Backup metadata recorded', { backupId: metadata.id });
  } catch (error: any) {
    StructuredLogger.error('Failed to record backup metadata', error, { backupId: metadata.id });
  }
}

/**
 * Scheduled function for daily full backup
 */
export const dailyFullBackup = onSchedule('0 2 * * *', async (event) => {
  // Run at 2 AM daily
  const startTime = Date.now();
  StructuredLogger.info('Starting scheduled daily full backup');

  try {
    const config = getBackupConfig();
    const results: BackupMetadata[] = [];

    // Create Firestore backup
    if (config.firestore.enabled) {
      const firestoreResult = await createFirestoreBackup(config);
      results.push(firestoreResult);
      await recordBackupMetadata(firestoreResult);
    }

    // Create Storage backup
    if (config.storage.enabled) {
      const storageResult = await createStorageBackup(config);
      results.push(storageResult);
      await recordBackupMetadata(storageResult);
    }

    // Cleanup old backups
    await cleanupOldBackups(config);

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'completed').length;
    const failureCount = results.filter(r => r.status === 'failed').length;

    StructuredLogger.info('Daily full backup completed', {
      duration,
      totalBackups: results.length,
      successful: successCount,
      failed: failureCount
    });

  } catch (error: any) {
    StructuredLogger.error('Daily full backup failed', error, {
      duration: Date.now() - startTime
    });
    throw error;
  }
});

/**
 * Scheduled function for hourly Firestore backup
 */
export const hourlyFirestoreBackup = onSchedule('0 * * * *', async (event) => {
  // Run every hour
  const startTime = Date.now();
  StructuredLogger.info('Starting scheduled hourly Firestore backup');

  try {
    const config = getBackupConfig();

    if (!config.firestore.enabled) {
      StructuredLogger.info('Firestore backup disabled, skipping');
      return;
    }

    const result = await createFirestoreBackup(config);
    await recordBackupMetadata(result);

    // Clean up backups older than 7 days for hourly backups
    const hourlyConfig = { ...config, retention: { days: 7 } };
    await cleanupOldBackups(hourlyConfig);

    const duration = Date.now() - startTime;
    StructuredLogger.info('Hourly Firestore backup completed', {
      backupId: result.id,
      status: result.status,
      duration
    });

  } catch (error: any) {
    StructuredLogger.error('Hourly Firestore backup failed', error, {
      duration: Date.now() - startTime
    });
    throw error;
  }
});

/**
 * Manual backup trigger function
 */
export const triggerManualBackup = onSchedule('every 24 hours', async (event) => {
  // This is a placeholder - manual backups would be triggered via HTTP endpoints
  StructuredLogger.info('Manual backup trigger function called (placeholder)');
});