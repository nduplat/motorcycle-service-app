import { onCall, onRequest } from 'firebase-functions/v2/https';
import { WorkshopCapacityService, TechnicianMetricsService, SmartAssignmentService, TimeCoordinationService } from './services';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Product CRUD Operations
 */

// Create Product
export const createProduct = onCall(async (request) => {
  try {
    const { product } = request.data;

    if (!product || !product.name || !product.sku) {
      throw new Error('Product data, name, and SKU are required');
    }

    // Check for duplicate SKU
    const existingProduct = await db.collection('products')
      .where('sku', '==', product.sku)
      .get();

    if (existingProduct.docs.length > 0) {
      throw new Error('A product with this SKU already exists');
    }

    const docRef = await db.collection('products').add({
      ...product,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { id: docRef.id, ...product };
  } catch (error) {
    throw new Error(`Failed to create product: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Get Product
export const getProduct = onCall(async (request) => {
  try {
    const { productId } = request.data;

    if (!productId) {
      throw new Error('Product ID is required');
    }

    const doc = await db.collection('products').doc(productId).get();
    if (!doc.exists) {
      throw new Error('Product not found');
    }

    return { id: doc.id, ...doc.data() };
  } catch (error) {
    throw new Error(`Failed to get product: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Update Product
export const updateProduct = onCall(async (request) => {
  try {
    const { productId, updates } = request.data;

    if (!productId || !updates) {
      throw new Error('Product ID and updates are required');
    }

    // Check if SKU is being changed and if it's unique
    if (updates.sku) {
      const existingProduct = await db.collection('products')
        .where('sku', '==', updates.sku)
        .get();

      const conflictingProducts = existingProduct.docs.filter(doc => doc.id !== productId);
      if (conflictingProducts.length > 0) {
        throw new Error('A product with this SKU already exists');
      }
    }

    await db.collection('products').doc(productId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to update product: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Delete Product (Soft delete)
export const deleteProduct = onCall(async (request) => {
  try {
    const { productId } = request.data;

    if (!productId) {
      throw new Error('Product ID is required');
    }

    await db.collection('products').doc(productId).update({
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete product: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Get Products (with pagination and filtering) - HTTP version with CORS
export const getProducts = onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', 'https://bluedragonmotors.com');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { page = 1, pageSize = 20, filters = {} } = req.body || req.query;
    let query: admin.firestore.Query = db.collection('products');

    // Apply filters
    if (filters.categoryId) {
      query = query.where('categoryId', '==', filters.categoryId);
    }
    if (filters.brand) {
      query = query.where('brand', '==', filters.brand);
    }
    if (filters.isActive !== undefined) {
      query = query.where('isActive', '==', filters.isActive);
    }

    // Apply pagination
    const offset = (page - 1) * pageSize;
    query = query.limit(pageSize);

    if (offset > 0) {
      // This is a simplified pagination - in production you'd use cursor-based pagination
      query = query.offset(offset);
    }

    const snapshot = await query.get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({
      products,
      page,
      pageSize,
      hasMore: products.length === pageSize
    });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({
      error: `Failed to get products: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// Bulk Product Operations
export const bulkUpdateProducts = onCall(async (request) => {
  try {
    const { productIds, updates } = request.data;

    if (!productIds || !Array.isArray(productIds) || !updates) {
      throw new Error('Product IDs array and updates are required');
    }

    const batch = db.batch();

    productIds.forEach(productId => {
      const docRef = db.collection('products').doc(productId);
      batch.update(docRef, {
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    return { success: true, updatedCount: productIds.length };
  } catch (error) {
    throw new Error(`Failed to bulk update products: ${error instanceof Error ? error.message : String(error)}`);
  }
});

export const bulkDeleteProducts = onCall(async (request) => {
  try {
    const { productIds } = request.data;

    if (!productIds || !Array.isArray(productIds)) {
      throw new Error('Product IDs array is required');
    }

    const batch = db.batch();

    productIds.forEach(productId => {
      const docRef = db.collection('products').doc(productId);
      batch.update(docRef, {
        isActive: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    return { success: true, deletedCount: productIds.length };
  } catch (error) {
    throw new Error(`Failed to bulk delete products: ${error instanceof Error ? error.message : String(error)}`);
  }
});

/**
 * User CRUD Operations
 */

// Create User
export const createUser = onCall(async (request) => {
  try {
    const { user } = request.data;

    if (!user || !user.email || !user.name) {
      throw new Error('User data, email, and name are required');
    }

    // Check for duplicate email
    const existingUser = await db.collection('users')
      .where('email', '==', user.email)
      .get();

    if (existingUser.docs.length > 0) {
      throw new Error('A user with this email already exists');
    }

    const docRef = await db.collection('users').add({
      ...user,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { id: docRef.id, ...user };
  } catch (error) {
    throw new Error(`Failed to create user: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Get User
export const getUser = onCall(async (request) => {
  try {
    const { userId } = request.data;

    if (!userId) {
      throw new Error('User ID is required');
    }

    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) {
      throw new Error('User not found');
    }

    return { id: doc.id, ...doc.data() };
  } catch (error) {
    throw new Error(`Failed to get user: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Update User
export const updateUser = onCall(async (request) => {
  try {
    const { userId, updates } = request.data;

    if (!userId || !updates) {
      throw new Error('User ID and updates are required');
    }

    // Check if email is being changed and if it's unique
    if (updates.email) {
      const existingUser = await db.collection('users')
        .where('email', '==', updates.email)
        .get();

      const conflictingUsers = existingUser.docs.filter(doc => doc.id !== userId);
      if (conflictingUsers.length > 0) {
        throw new Error('A user with this email already exists');
      }
    }

    await db.collection('users').doc(userId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to update user: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Delete User (Soft delete)
export const deleteUser = onCall(async (request) => {
  try {
    const { userId } = request.data;

    if (!userId) {
      throw new Error('User ID is required');
    }

    await db.collection('users').doc(userId).update({
      active: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Get Users (with pagination and filtering)
export const getUsers = onCall(async (request) => {
  try {
    const { page = 1, pageSize = 20, filters = {} } = request.data;
    let query: admin.firestore.Query = db.collection('users');

    // Apply filters
    if (filters.role) {
      query = query.where('role', '==', filters.role);
    }
    if (filters.active !== undefined) {
      query = query.where('active', '==', filters.active);
    }

    // Apply pagination
    const offset = (page - 1) * pageSize;
    query = query.limit(pageSize);

    if (offset > 0) {
      query = query.offset(offset);
    }

    const snapshot = await query.get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return {
      users,
      page,
      pageSize,
      hasMore: users.length === pageSize
    };
  } catch (error) {
    throw new Error(`Failed to get users: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Bulk User Operations
export const bulkUpdateUsers = onCall(async (request) => {
  try {
    const { userIds, updates } = request.data;

    if (!userIds || !Array.isArray(userIds) || !updates) {
      throw new Error('User IDs array and updates are required');
    }

    const batch = db.batch();

    userIds.forEach(userId => {
      const docRef = db.collection('users').doc(userId);
      batch.update(docRef, {
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    return { success: true, updatedCount: userIds.length };
  } catch (error) {
    throw new Error(`Failed to bulk update users: ${error instanceof Error ? error.message : String(error)}`);
  }
});

export const bulkDeleteUsers = onCall(async (request) => {
  try {
    const { userIds } = request.data;

    if (!userIds || !Array.isArray(userIds)) {
      throw new Error('User IDs array is required');
    }

    const batch = db.batch();

    userIds.forEach(userId => {
      const docRef = db.collection('users').doc(userId);
      batch.update(docRef, {
        active: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    return { success: true, deletedCount: userIds.length };
  } catch (error) {
    throw new Error(`Failed to bulk delete users: ${error instanceof Error ? error.message : String(error)}`);
  }
});

/**
 * Work Order CRUD Operations
 */

// Create Work Order
export const createWorkOrder = onCall(async (request) => {
  try {
    const { workOrder } = request.data;

    if (!workOrder || !workOrder.clientId || !workOrder.vehicleId) {
      throw new Error('Work order data, client ID, and vehicle ID are required');
    }

    const docRef = await db.collection('workOrders').add({
      ...workOrder,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { id: docRef.id, ...workOrder };
  } catch (error) {
    throw new Error(`Failed to create work order: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Get Work Order
export const getWorkOrder = onCall(async (request) => {
  try {
    const { workOrderId } = request.data;

    if (!workOrderId) {
      throw new Error('Work order ID is required');
    }

    const doc = await db.collection('workOrders').doc(workOrderId).get();
    if (!doc.exists) {
      throw new Error('Work order not found');
    }

    return { id: doc.id, ...doc.data() };
  } catch (error) {
    throw new Error(`Failed to get work order: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Update Work Order
export const updateWorkOrder = onCall(async (request) => {
  try {
    const { workOrderId, updates } = request.data;

    if (!workOrderId || !updates) {
      throw new Error('Work order ID and updates are required');
    }

    await db.collection('workOrders').doc(workOrderId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to update work order: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Delete Work Order
export const deleteWorkOrder = onCall(async (request) => {
  try {
    const { workOrderId } = request.data;

    if (!workOrderId) {
      throw new Error('Work order ID is required');
    }

    await db.collection('workOrders').doc(workOrderId).delete();

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete work order: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Get Work Orders (with pagination and filtering)
export const getWorkOrders = onCall(async (request) => {
  try {
    const { page = 1, pageSize = 20, filters = {} } = request.data;
    let query: admin.firestore.Query = db.collection('workOrders');

    // Apply filters
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    if (filters.assignedTo) {
      query = query.where('assignedTo', '==', filters.assignedTo);
    }
    if (filters.clientId) {
      query = query.where('clientId', '==', filters.clientId);
    }

    // Apply pagination
    const offset = (page - 1) * pageSize;
    query = query.limit(pageSize);

    if (offset > 0) {
      query = query.offset(offset);
    }

    const snapshot = await query.get();
    const workOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return {
      workOrders,
      page,
      pageSize,
      hasMore: workOrders.length === pageSize
    };
  } catch (error) {
    throw new Error(`Failed to get work orders: ${error instanceof Error ? error.message : String(error)}`);
  }
});

/**
 * HTTP function to calculate current workshop capacity with CORS support
 */
export const calculateWorkshopCapacity = onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', 'https://bluedragonmotors.com');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const result = await WorkshopCapacityService.calculateCurrentCapacity();
    res.json(result);
  } catch (error) {
    console.error('Error calculating workshop capacity:', error);
    res.status(500).json({
      error: `Failed to calculate workshop capacity: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

/**
 * Callable function to calculate monthly technician metrics
 */
export const calculateTechnicianMetrics = onCall(async (request) => {
  try {
    const result = await TechnicianMetricsService.calculateMonthlyMetrics();
    return result;
  } catch (error) {
    throw new Error(`Failed to calculate technician metrics: ${error instanceof Error ? error.message : String(error)}`);
  }
});

/**
 * Callable function to optimize daily schedule
 */
export const optimizeDailySchedule = onCall(async (request) => {
  try {
    const result = await SmartAssignmentService.optimizeDailySchedule();
    return result;
  } catch (error) {
    throw new Error(`Failed to optimize daily schedule: ${error instanceof Error ? error.message : String(error)}`);
  }
});

/**
 * Callable function to notify delayed jobs
 */
export const notifyDelayedJobs = onCall(async (request) => {
  try {
    const result = await TimeCoordinationService.notifyDelayedJobs();
    return result;
  } catch (error) {
    throw new Error(`Failed to notify delayed jobs: ${error instanceof Error ? error.message : String(error)}`);
  }
});