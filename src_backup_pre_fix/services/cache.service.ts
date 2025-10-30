import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, Timestamp, DocumentData, FieldValue } from '@angular/fire/firestore';

import { AuthService } from './auth.service';
import { EventBusService } from './event-bus.service';

export interface CacheEntry<T = any> {
  data: T;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  key: string;
  semanticKey?: string; // For intelligent semantic matching
  context?: string;
  version?: string;
  tags?: string[]; // For semantic grouping and invalidation
  priority?: 'low' | 'medium' | 'high'; // Cache priority for eviction
  accessCount?: number; // Track usage for LRU
  lastAccessed?: Timestamp;
  userId?: string | null;
}

export interface CacheStats {
  totalEntries: number;
  memoryCacheSize: number;
  contexts: Record<string, number>;
  hitRate: number;
  avgTTL: number;
  invalidationEvents: number;
  crossServiceInvalidations: number;
  cacheWarmingHits: number;
}

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private eventBus = inject(EventBusService);
  private memoryCache = new Map<string, CacheEntry>();
  private readonly MEMORY_CACHE_SIZE = 100; // LRU cache size
  private readonly CACHE_COLLECTION = 'cache';

  // Metrics for monitoring
  private hits = 0;
  private misses = 0;
  private invalidationEvents = 0;
  private crossServiceInvalidations = 0;
  private cacheWarmingHits = 0;

  // Cross-service invalidation mappings
  private readonly INVALIDATION_MAP = {
    'queue.entry_added': ['queue-data', 'queue-status'],
    'queue.called': ['queue-data', 'queue-status', 'work-order:*'],
    'queue.served': ['queue-data', 'queue-status'],
    'queue.cancelled': ['queue-data', 'queue-status'],
    'work_order.created': ['work-order:*', 'queue-data'],
    'work_order.status_changed': ['work-order:*', 'queue-data'],
    'work_order.completed': ['work-order:*', 'queue-data', 'inventory:*'],
    'motorcycle.updated': ['motorcycle:*', 'queue-data'],
    'service.updated': ['service:*', 'queue-data', 'work-order:*']
  };

  /**
   * Get cached value
   * Checks memory cache first (fast), then Firestore (slower but persistent)
   */
  async get<T>(key: string): Promise<T | null> {
    // Step 1: Check memory cache first (microseconds)
    const memCached = this.memoryCache.get(key);
    if (memCached && this.isValid(memCached)) {
      this.hits++;
      // Update access tracking
      memCached.accessCount = (memCached.accessCount || 0) + 1;
      memCached.lastAccessed = Timestamp.now();
      return memCached.data as T;
    }

    // Step 2: Check Firestore cache (milliseconds)
    try {
      const docRef = doc(this.firestore, this.CACHE_COLLECTION, key);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        this.misses++;
        return null;
      }

      const rawData = docSnap.data();

      // Deserialize the data from Firestore format back to proper types
      const entry = this.deserializeFromFirestore(rawData) as CacheEntry<T>;

      // Validate expiration
      if (!this.isValid(entry)) {
        this.misses++;
        // Cleanup expired entry asynchronously
        this.delete(key).catch(err => console.error('Cleanup error:', err));
        return null;
      }

      // Update memory cache for faster subsequent access
      this.setMemoryCache(key, entry);
      this.hits++;

      return entry.data;
    } catch (error) {
      console.error('Cache get error:', error);
      this.misses++;
      return null;
    }
  }

  /**
   * Set cache value with TTL and semantic features
   * @param key - Unique cache key
   * @param data - Data to cache
   * @param ttlMs - Time to live in milliseconds
   * @param context - Optional context for grouping (e.g., 'chatbot', 'scanner')
   * @param version - Optional version for cache invalidation
   * @param semanticKey - Optional semantic key for intelligent matching
   * @param tags - Optional tags for semantic grouping
   * @param priority - Optional cache priority for eviction
   */
  async set<T>(
    key: string,
    data: T,
    ttlMs: number,
    context?: string,
    version?: string,
    semanticKey?: string,
    tags?: string[],
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<void> {
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + ttlMs);

    const currentUser = this.authService.currentUser();
    const entry: CacheEntry<T> = {
      data,
      createdAt: now,
      expiresAt,
      key,
      semanticKey,
      context,
      version,
      tags,
      priority,
      accessCount: 0,
      lastAccessed: now,
      userId: currentUser ? currentUser.id : null
    };

    try {
      // Recursively serialize the entire entry for Firestore compatibility
      const firestoreEntry = this.serializeForFirestore(entry);

      // Set in Firestore (persistent)
      const docRef = doc(this.firestore, this.CACHE_COLLECTION, key);
      await setDoc(docRef, firestoreEntry);

      // Set in memory cache (fast access)
      this.setMemoryCache(key, entry);
    } catch (error) {
      console.error('Cache set error:', error);
      // Non-blocking: cache failure shouldn't break app
      // But still update memory cache
      this.setMemoryCache(key, entry);
    }
  }

  /**
   * Delete single cache entry
   */
  async delete(key: string): Promise<void> {
    try {
      // Remove from memory
      this.memoryCache.delete(key);

      // Remove from Firestore
      const docRef = doc(this.firestore, this.CACHE_COLLECTION, key);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Clear all cache entries matching pattern
   * Example: clearPattern('ai_cache:chatbot:') clears all chatbot cache
   */
  async clearPattern(pattern: string): Promise<number> {
    try {
      const cacheRef = collection(this.firestore, this.CACHE_COLLECTION);
      const q = query(
        cacheRef,
        where('key', '>=', pattern),
        where('key', '<=', pattern + '\uf8ff')
      );
      const snapshot = await getDocs(q);

      // Delete from Firestore
      const deletePromises = snapshot.docs.map((doc: DocumentData) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Clear from memory cache
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(pattern)) {
          this.memoryCache.delete(key);
        }
      }

      console.log(`Cleared ${snapshot.size} cache entries matching pattern: ${pattern}`);
      return snapshot.size;
    } catch (error) {
      console.error('Cache clear pattern error:', error);
      return 0;
    }
  }

  /**
   * Clear cache by context
   * Example: clearContext('chatbot') clears all chatbot-related cache
   */
  async clearContext(context: string): Promise<number> {
    try {
      const cacheRef = collection(this.firestore, this.CACHE_COLLECTION);
      const q = query(cacheRef, where('context', '==', context));
      const snapshot = await getDocs(q);

      // Delete from Firestore
      const deletePromises = snapshot.docs.map((doc: DocumentData) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Clear from memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.context === context) {
          this.memoryCache.delete(key);
        }
      }

      console.log(`Cleared ${snapshot.size} cache entries for context: ${context}`);
      return snapshot.size;
    } catch (error) {
      console.error('Cache clear context error:', error);
      return 0;
    }
  }

  /**
   * Clear cache by semantic tags
   * Example: clearByTags(['urgent', 'maintenance']) clears entries with these tags
   */
  async clearByTags(tags: string[]): Promise<number> {
    try {
      let clearedCount = 0;

      // Clear from memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.tags && tags.some(tag => entry.tags!.includes(tag))) {
          this.memoryCache.delete(key);
          clearedCount++;
        }
      }

      // For Firestore, we need to get all entries and filter client-side
      // since Firestore doesn't support array-contains-any for multiple values efficiently
      const cacheRef = collection(this.firestore, this.CACHE_COLLECTION);
      const snapshot = await getDocs(cacheRef);

      const entriesToDelete = snapshot.docs.filter((doc: DocumentData) => {
        const entry = doc.data() as CacheEntry;
        return entry.tags && tags.some(tag => entry.tags!.includes(tag));
      });

      const deletePromises = entriesToDelete.map((doc: DocumentData) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      clearedCount += entriesToDelete.length;

      console.log(`Cleared ${clearedCount} cache entries for tags: ${tags.join(', ')}`);
      return clearedCount;
    } catch (error) {
      console.error('Cache clear by tags error:', error);
      return 0;
    }
  }

  /**
   * Get cache entries by semantic similarity
   * Uses semantic keys to find related cached content
   */
  async getBySemanticKey(semanticKey: string): Promise<CacheEntry[]> {
    try {
      const cacheRef = collection(this.firestore, this.CACHE_COLLECTION);
      const q = query(cacheRef, where('semanticKey', '==', semanticKey));
      const snapshot = await getDocs(q);

      const entries: CacheEntry[] = [];
      snapshot.forEach((doc: DocumentData) => {
        const entry = doc.data() as CacheEntry;
        if (this.isValid(entry)) {
          entries.push(entry);
        }
      });

      return entries;
    } catch (error) {
      console.error('Get by semantic key error:', error);
      return [];
    }
  }

  /**
   * Generate semantic key from content
   * Basic implementation - can be enhanced with NLP processing
   */
  generateSemanticKey(content: string, context: string): string {
    // Simple semantic key generation based on content patterns
    const normalized = content.toLowerCase().trim();

    // Extract key entities/concepts
    const patterns = [
      /\b(chatbot|ai|assistant)\b/g,
      /\b(inventory|stock|product)\b/g,
      /\b(queue|waiting|service)\b/g,
      /\b(maintenance|repair|service)\b/g,
      /\b(customer|client|user)\b/g
    ];

    const entities = patterns
      .map(pattern => {
        const matches = normalized.match(pattern);
        return matches ? matches[0] : null;
      })
      .filter(Boolean)
      .join('_');

    return `${context}_${entities || 'general'}`;
  }

  /**
   * Clear cache by version
   * Useful for invalidating cache when data model changes
   */
  async clearVersion(version: string): Promise<number> {
    try {
      const cacheRef = collection(this.firestore, this.CACHE_COLLECTION);
      const q = query(cacheRef, where('version', '==', version));
      const snapshot = await getDocs(q);

      const deletePromises = snapshot.docs.map((doc: DocumentData) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Clear from memory
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.version === version) {
          this.memoryCache.delete(key);
        }
      }

      console.log(`Cleared ${snapshot.size} cache entries for version: ${version}`);
      return snapshot.size;
    } catch (error) {
      console.error('Cache clear version error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getStats(): Promise<CacheStats> {
    try {
      const cacheRef = collection(this.firestore, this.CACHE_COLLECTION);
      const snapshot = await getDocs(cacheRef);

      const contexts: Record<string, number> = {};
      let totalTTL = 0;
      let validEntries = 0;

      snapshot.docs.forEach((doc: DocumentData) => {
        const entry = doc.data() as CacheEntry;

        // Count by context
        if (entry.context) {
          contexts[entry.context] = (contexts[entry.context] || 0) + 1;
        }

        // Calculate average TTL for valid entries
        if (this.isValid(entry)) {
          const ttl = entry.expiresAt.toMillis() - entry.createdAt.toMillis();
          totalTTL += ttl;
          validEntries++;
        }
      });

      const hitRate = this.hits + this.misses > 0
        ? (this.hits / (this.hits + this.misses)) * 100
        : 0;

      const avgTTL = validEntries > 0
        ? totalTTL / validEntries
        : 0;

      return {
        totalEntries: snapshot.size,
        memoryCacheSize: this.memoryCache.size,
        contexts,
        hitRate: Math.round(hitRate * 100) / 100,
        avgTTL: Math.round(avgTTL / 1000), // Convert to seconds
        invalidationEvents: this.invalidationEvents,
        crossServiceInvalidations: this.crossServiceInvalidations,
        cacheWarmingHits: this.cacheWarmingHits
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        totalEntries: 0,
        memoryCacheSize: this.memoryCache.size,
        contexts: {},
        hitRate: 0,
        avgTTL: 0,
        invalidationEvents: this.invalidationEvents,
        crossServiceInvalidations: this.crossServiceInvalidations,
        cacheWarmingHits: this.cacheWarmingHits
      };
    }
  }

  /**
   * Cleanup expired entries
   * Should be called periodically (e.g., daily via cron job)
   */
  async cleanup(): Promise<number> {
    try {
      const now = Timestamp.now();
      const cacheRef = collection(this.firestore, this.CACHE_COLLECTION);
      const q = query(cacheRef, where('expiresAt', '<', now));
      const snapshot = await getDocs(q);

      // Delete expired from Firestore
      const deletePromises = snapshot.docs.map((doc: DocumentData) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Clear expired from memory
      for (const [key, entry] of this.memoryCache.entries()) {
        if (!this.isValid(entry)) {
          this.memoryCache.delete(key);
        }
      }

      console.log(`Cleaned up ${snapshot.size} expired cache entries`);
      return snapshot.size;
    } catch (error) {
      console.error('Cache cleanup error:', error);
      return 0;
    }
  }

  /**
   * Warm up cache with frequently accessed data
   * Call this on app initialization or after cache clear
   */
  async warmup(keys: string[]): Promise<number> {
    let warmedUp = 0;

    for (const key of keys) {
      try {
        const data = await this.get(key);
        if (data !== null) {
          warmedUp++;
        }
      } catch (error) {
        console.error(`Warmup failed for key: ${key}`, error);
      }
    }

    console.log(`Warmed up ${warmedUp}/${keys.length} cache entries`);
    return warmedUp;
  }

  /**
   * Reset metrics (for testing or monitoring reset)
   */
  resetMetrics(): void {
    this.hits = 0;
    this.misses = 0;
    this.invalidationEvents = 0;
    this.crossServiceInvalidations = 0;
    this.cacheWarmingHits = 0;
  }

  /**
   * Setup event listeners for cross-service invalidation
   */
  private setupEventListeners(): void {
    // Subscribe to event bus for cross-service invalidation
    this.eventBus.events$.subscribe(event => {
      this.handleCrossServiceInvalidation(event.type, event);
    });
  }

  /**
   * Handle cross-service cache invalidation based on events
   */
  private async handleCrossServiceInvalidation(eventType: string, event: any): Promise<void> {
    const patternsToInvalidate = this.INVALIDATION_MAP[eventType as keyof typeof this.INVALIDATION_MAP];
    if (!patternsToInvalidate) return;

    this.invalidationEvents++;
    console.log(`🔄 Cache invalidation triggered by event: ${eventType}`);

    for (const pattern of patternsToInvalidate) {
      try {
        let clearedCount = 0;

        if (pattern.includes('*')) {
          // Pattern-based invalidation
          clearedCount = await this.clearPattern(pattern.replace('*', ''));
        } else {
          // Exact key invalidation
          await this.delete(pattern);
          clearedCount = 1;
        }

        if (clearedCount > 0) {
          this.crossServiceInvalidations++;
          console.log(`🗑️ Invalidated ${clearedCount} cache entries for pattern: ${pattern}`);
        }
      } catch (error) {
        console.error(`Error invalidating cache pattern ${pattern}:`, error);
      }
    }
  }

  /**
   * Smart invalidation based on entity relationships
   */
  async invalidateByEntity(entityType: string, entityId: string): Promise<void> {
    const patterns = [
      `${entityType}:${entityId}`,
      `${entityType}:${entityId}:*`,
      `*:${entityId}`,
      `*:${entityId}:*`
    ];

    let totalCleared = 0;
    for (const pattern of patterns) {
      const cleared = await this.clearPattern(pattern);
      totalCleared += cleared;
    }

    if (totalCleared > 0) {
      console.log(`🧠 Smart invalidation cleared ${totalCleared} entries for ${entityType}:${entityId}`);
    }
  }

  /**
   * Cache warming for critical data
   */
  async warmupCriticalData(): Promise<void> {
    const criticalKeys = [
      'queue-data',
      'queue-status',
      'services-list',
      'motorcycles-list',
      'work-orders-active'
    ];

    const warmedUp = await this.warmup(criticalKeys);
    this.cacheWarmingHits += warmedUp;

    console.log(`🔥 Cache warming completed: ${warmedUp}/${criticalKeys.length} critical entries loaded`);
  }

  /**
   * Get current hit rate
   */
  getHitRate(): number {
    if (this.hits + this.misses === 0) return 0;
    return (this.hits / (this.hits + this.misses)) * 100;
  }

  // Private helper methods

  /**
   * Recursively serialize data for Firestore compatibility
   * Converts Timestamps to plain objects and handles nested structures
   */
  private serializeForFirestore(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (data instanceof Timestamp) {
      return data.toDate();
    }

    if (data instanceof Date) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.serializeForFirestore(item));
    }

    if (typeof data === 'object') {
      const serialized: any = {};
      for (const [key, value] of Object.entries(data)) {
        serialized[key] = this.serializeForFirestore(value);
      }
      return serialized;
    }

    return data;
  }

  /**
   * Recursively deserialize data from Firestore
   * Converts plain date objects back to Timestamps where appropriate
   */
  private deserializeFromFirestore(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.deserializeFromFirestore(item));
    }

    if (typeof data === 'object' && data.constructor === Object) {
      const deserialized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Convert date objects back to Timestamps for known timestamp fields
        if ((key === 'createdAt' || key === 'expiresAt' || key === 'lastAccessed' || key === 'updatedAt' ||
             key === 'joinedAt' || key === 'periodStart' || key === 'periodEnd' || key === 'calculatedAt') &&
            value instanceof Date) {
          deserialized[key] = Timestamp.fromDate(value);
        } else {
          deserialized[key] = this.deserializeFromFirestore(value);
        }
      }
      return deserialized;
    }

    return data;
  }

  private isValid(entry: CacheEntry): boolean {
    const now = Timestamp.now();
    return entry.expiresAt.toMillis() > now.toMillis();
  }

  private setMemoryCache(key: string, entry: CacheEntry): void {
    // Priority-based LRU eviction: Remove lowest priority oldest entry if at capacity
    if (this.memoryCache.size >= this.MEMORY_CACHE_SIZE) {
      // Find entry with lowest priority, then oldest access
      let lowestPriority = 'high';
      let oldestKey = '';
      let oldestTime = Timestamp.now();

      for (const [k, e] of this.memoryCache.entries()) {
        const priority = e.priority || 'medium';
        const lastAccessed = e.lastAccessed || e.createdAt;

        if (priority === 'low' && lowestPriority !== 'low') {
          lowestPriority = priority;
          oldestKey = k;
          oldestTime = lastAccessed;
        } else if (priority === lowestPriority && lastAccessed.toMillis() < oldestTime.toMillis()) {
          oldestKey = k;
          oldestTime = lastAccessed;
        } else if (lowestPriority === 'high' && priority === 'medium') {
          lowestPriority = priority;
          oldestKey = k;
          oldestTime = lastAccessed;
        }
      }

      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }

    this.memoryCache.set(key, entry);
  }

  /**
   * Clear all cache (use with caution!)
   */
  async clearAll(): Promise<number> {
    try {
      const cacheRef = collection(this.firestore, this.CACHE_COLLECTION);
      const snapshot = await getDocs(cacheRef);

      const deletePromises = snapshot.docs.map((doc: DocumentData) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      this.memoryCache.clear();
      this.resetMetrics();

      console.log(`Cleared all ${snapshot.size} cache entries`);
      return snapshot.size;
    } catch (error) {
      console.error('Clear all cache error:', error);
      return 0;
    }
  }
}