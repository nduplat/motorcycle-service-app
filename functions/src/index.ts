/**
 * Main entry point for all Firebase Cloud Functions.
 *
 * This file should not contain any logic. It should only import and export
 * functions from their respective modules. This structure makes the codebase
 * more modular, easier to maintain, and less prone to merge conflicts.
 *
 * Refer to `docs/AUDITORIA_SERVICIOS.md` for the full architecture and
 * refactoring plan.
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export functions from their specialized modules
export * from './health-check';
export * from './triggers';
export * from './callable';
export * from './backup';
export * from './job-workers';