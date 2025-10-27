import * as admin from 'firebase-admin';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
  console.log('🤖 AI Proxy: Firebase Admin initialized in index.ts');
} else {
  console.log('🤖 AI Proxy: Firebase Admin already initialized');
}

// Export scheduled functions
export { calculateCapacityHourly, optimizeDailySchedule, checkDelayedJobs, calculateMonthlyMetrics, monitorFirebaseCosts, generateDailyCostReport } from './scheduledTasks';

// Export Firestore triggers
export { onWorkOrderUpdate, onTimeEntryCreate, onTimeEntryEnd } from './triggers';

// Export AI proxy functions
export { health, aiProxy, getBudgetStatus, getCostAnalytics } from './ai-proxy';

// Export health check functions
export { systemHealth, systemMetrics } from './health-check';

// Export backup functions
export { dailyFullBackup, hourlyFirestoreBackup, triggerManualBackup } from './backup';

// Export auto-assignment functions
export { onQueueEntryCreate } from './auto-assignment';

// Export progressive notification functions
export { onQueueUpdate, sendPeriodicReminders } from './progressive-notifications';

// Export callable functions
export {
  calculateWorkshopCapacity,
  calculateTechnicianMetrics,
  optimizeDailySchedule as optimizeDailyScheduleCallable,
  notifyDelayedJobs,
  // Product CRUD
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  bulkUpdateProducts,
  bulkDeleteProducts,
  // User CRUD
  createUser,
  getUser,
  updateUser,
  deleteUser,
  getUsers,
  bulkUpdateUsers,
  bulkDeleteUsers,
  // Work Order CRUD
  createWorkOrder,
  getWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  getWorkOrders
} from './callable';