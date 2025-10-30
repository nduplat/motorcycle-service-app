/**
 * Firestore data model for a professional motorcycle workshop (taller de motos).
 *
 * This index file exports all model interfaces and types from their respective modules.
 * Each model includes detailed documentation about its purpose and CRUD operations.
 *
 * References: All models are organized in separate files within src/models/
 */

// Export all types and enums
export * from './types';

// Export user-related models
export * from './user';

// Export product-related models
export * from './product';

// Export vehicle-related models
export * from './vehicle';

// Export work order and service-related models
export * from './work-order';

// Export inventory-related models
export * from './inventory';

// Export purchasing-related models
export * from './purchasing';

// Export invoicing and sales-related models
export * from './invoicing';

// Export returns and warranty models
export * from './returns';

// Export notification-related models
export * from './notifications';

// Export settings and configuration models
export * from './settings';

// Export queue system models
export * from './queue';

// Export scheduling and time management models
export * from './scheduling';

// Export job queue and background processing models
export * from './job';