import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (should be done in index.ts, but ensuring here)
if (!admin.apps.length) {
  admin.initializeApp();
}


/**
 * Daily backup of critical data
 */
export const scheduledBackup = functions.pubsub
  .schedule('0 3 * * *') // 3am daily
  .timeZone('America/Bogota')
  .onRun(async (context: any) => {
    const storage = admin.storage().bucket();

    // Backup only critical collections
    const collections = ['workOrders', 'users', 'products'];
    const backupData: any = {};

    for (const collectionName of collections) {
      const snapshot = await admin.firestore().collection(collectionName).get();
      backupData[collectionName] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }

    // Save to Storage
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `backups/backup-${timestamp}.json`;

    await storage.file(fileName).save(JSON.stringify(backupData), {
      contentType: 'application/json',
      metadata: {
        metadata: {
          timestamp: timestamp
        }
      }
    });

    console.log(`Backup created: ${fileName}`);

    // Clean old backups (>30 days)
    const [files] = await storage.getFiles({ prefix: 'backups/' });
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const timeCreated = metadata.timeCreated as string;
      if (timeCreated && new Date(timeCreated) < thirtyDaysAgo) {
        await file.delete();
        console.log(`Deleted old backup: ${file.name}`);
      }
    }
  });