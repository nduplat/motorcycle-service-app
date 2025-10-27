/**
 * Form Cache Service
 * Handles form data caching and recovery for queue join flow
 */

import { Injectable, signal } from '@angular/core';

export interface CachedFormData {
  phone?: string;
  phoneValidated?: boolean;
  service?: string;
  serviceValidated?: boolean;
  motorcycleId?: string;
  motorcycleValidated?: boolean;
  licensePlate?: string;
  licensePlateValidated?: boolean;
  mileage?: number;
  mileageValidated?: boolean;
  currentStep?: string;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FormCacheService {
  private readonly CACHE_KEY = 'queue_join_form_cache';
  private readonly CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
  private readonly AUTO_SAVE_INTERVAL = 10000; // 10 seconds

  private autoSaveTimer: any;
  private cacheData = signal<CachedFormData | null>(null);

  constructor() {
    // Load cached data on service init
    this.loadFromStorage();
  }

  // ========== CACHE OPERATIONS ==========

  saveCache(data: Partial<CachedFormData>, userId?: string, sessionId?: string) {
    const current = this.cacheData() || {} as CachedFormData;
    
    const updated: CachedFormData = {
      ...current,
      ...data,
      timestamp: Date.now(),
      userId: userId || current.userId,
      sessionId: sessionId || current.sessionId
    };

    this.cacheData.set(updated);
    this.persistToStorage(updated);

    console.log('💾 Cache: Saved', Object.keys(data));
  }

  loadCache(): CachedFormData | null {
    const cached = this.cacheData();
    
    if (!cached) {
      console.log('💾 Cache: No data found');
      return null;
    }

    // Check expiry
    if (this.isExpired(cached)) {
      console.log('💾 Cache: Data expired');
      this.clearCache();
      return null;
    }

    console.log('💾 Cache: Loaded', {
      age: this.formatAge(Date.now() - cached.timestamp),
      step: cached.currentStep
    });

    return cached;
  }

  clearCache() {
    this.cacheData.set(null);
    this.removeFromStorage();
    console.log('💾 Cache: Cleared');
  }

  hasCache(): boolean {
    const cached = this.cacheData();
    return cached !== null && !this.isExpired(cached);
  }

  // ========== AUTO-SAVE ==========

  startAutoSave(getDataFn: () => Partial<CachedFormData>) {
    this.stopAutoSave();
    
    this.autoSaveTimer = setInterval(() => {
      const data = getDataFn();
      if (Object.keys(data).length > 0) {
        this.saveCache(data);
      }
    }, this.AUTO_SAVE_INTERVAL);

    console.log('💾 Cache: Auto-save started');
  }

  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      console.log('💾 Cache: Auto-save stopped');
    }
  }

  // ========== RECOVERY ==========

  recoverFormData(): {
    hasRecovery: boolean;
    data: CachedFormData | null;
    age: string;
    canRecover: boolean;
  } {
    const cached = this.loadCache();
    
    if (!cached) {
      return {
        hasRecovery: false,
        data: null,
        age: '',
        canRecover: false
      };
    }

    const age = Date.now() - cached.timestamp;
    const canRecover = age < this.CACHE_EXPIRY;

    return {
      hasRecovery: true,
      data: cached,
      age: this.formatAge(age),
      canRecover
    };
  }

  // ========== VALIDATION ==========

  validateCachedData(data: CachedFormData): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check required fields based on step
    if (data.phoneValidated && !data.phone) {
      issues.push('Phone marked as validated but missing');
    }

    if (data.serviceValidated && !data.service) {
      issues.push('Service marked as validated but missing');
    }

    if (data.motorcycleValidated && !data.motorcycleId) {
      issues.push('Motorcycle marked as validated but missing');
    }

    if (data.licensePlateValidated && !data.licensePlate) {
      issues.push('License plate marked as validated but missing');
    }

    if (data.mileageValidated && data.mileage === undefined) {
      issues.push('Mileage marked as validated but missing');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  // ========== STORAGE OPERATIONS ==========

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (!stored) return;

      const data: CachedFormData = JSON.parse(stored);
      
      // Check expiry
      if (this.isExpired(data)) {
        this.removeFromStorage();
        return;
      }

      this.cacheData.set(data);
      console.log('💾 Cache: Loaded from storage');
    } catch (error) {
      console.error('💾 Cache: Load error', error);
      this.removeFromStorage();
    }
  }

  private persistToStorage(data: CachedFormData) {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('💾 Cache: Save error', error);
      
      // Try to clear old data if quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.clearOldCaches();
        // Retry save
        try {
          localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
        } catch (retryError) {
          console.error('💾 Cache: Retry save failed', retryError);
        }
      }
    }
  }

  private removeFromStorage() {
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch (error) {
      console.error('💾 Cache: Remove error', error);
    }
  }

  private clearOldCaches() {
    try {
      // Clear other potential cache keys
      const keysToCheck = [
        'queue_analytics',
        'temp_form_data',
        'old_cache_data'
      ];

      keysToCheck.forEach(key => {
        localStorage.removeItem(key);
      });

      console.log('💾 Cache: Cleared old caches');
    } catch (error) {
      console.error('💾 Cache: Clear old caches error', error);
    }
  }

  // ========== UTILITY METHODS ==========

  private isExpired(data: CachedFormData): boolean {
    return (Date.now() - data.timestamp) > this.CACHE_EXPIRY;
  }

  private formatAge(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s ago`;
    }
    return `${seconds}s ago`;
  }

  // ========== EXPORT/IMPORT ==========

  exportCache(): string {
    const cached = this.cacheData();
    if (!cached) return '';

    return JSON.stringify(cached, null, 2);
  }

  importCache(jsonData: string): boolean {
    try {
      const data: CachedFormData = JSON.parse(jsonData);
      
      // Validate structure
      if (!data.timestamp || typeof data.timestamp !== 'number') {
        console.error('💾 Cache: Invalid import data');
        return false;
      }

      this.cacheData.set(data);
      this.persistToStorage(data);
      
      console.log('💾 Cache: Imported successfully');
      return true;
    } catch (error) {
      console.error('💾 Cache: Import error', error);
      return false;
    }
  }

  // ========== STATISTICS ==========

  getCacheStats(): {
    exists: boolean;
    age: string;
    size: number;
    completeness: number;
    fields: string[];
  } {
    const cached = this.cacheData();
    
    if (!cached) {
      return {
        exists: false,
        age: '',
        size: 0,
        completeness: 0,
        fields: []
      };
    }

    const fields = Object.keys(cached).filter(
      k => k !== 'timestamp' && k !== 'userId' && k !== 'sessionId' && cached[k as keyof CachedFormData] !== undefined
    );

    const totalFields = 10; // Total possible fields
    const completeness = (fields.length / totalFields) * 100;

    const jsonString = JSON.stringify(cached);
    const size = new Blob([jsonString]).size;

    return {
      exists: true,
      age: this.formatAge(Date.now() - cached.timestamp),
      size,
      completeness: Math.round(completeness),
      fields
    };
  }
}