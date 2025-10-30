import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp, runTransaction, DocumentData } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { CostMonitoringService } from './cost-monitoring.service';
import { AlertingService } from './alerting.service';

export interface RateLimitConfig {
  technical: {
    chatbot: number;
    scanner: number;
    workOrder: number;
    productSearch: number;
  };
  customer: {
    chatbot: number;
    scanner: number;
    workOrder: number;
    productSearch: number;
  };
}

export interface CostAwareLimits {
  baseLimits: RateLimitConfig;
  costMultiplier: number; // Reduce limits when costs are high
  emergencyLimits: RateLimitConfig;
  premiumLimits?: RateLimitConfig; // For premium users
}

export interface RateLimitUsage {
  userId: string;
  context: string;
  date: string; // YYYY-MM-DD
  count: number;
  limit: number;
  resetAt: Timestamp;
  warnings: number;
  firstCall: Timestamp;
  lastCall: Timestamp;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  total: number;
  percentage: number;
  resetAt: Date;
  isWarning: boolean;
  userId?: string;
  requestCount?: number;
  limit?: number;
  windowMinutes?: number;
  blocked?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RateLimiterService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private costMonitoring = inject(CostMonitoringService);
  private alertingService = inject(AlertingService);

  // Cost-aware rate limits configuration
  private readonly COST_AWARE_LIMITS: CostAwareLimits = {
    baseLimits: {
      technical: {
        chatbot: 50,
        scanner: 100,
        workOrder: 30,
        productSearch: 50
      },
      customer: {
        chatbot: 5,
        scanner: 10,
        workOrder: 5,
        productSearch: 10
      }
    },
    costMultiplier: 0.7, // Reduce to 70% when costs are high
    emergencyLimits: {
      technical: {
        chatbot: 30,
        scanner: 50,
        workOrder: 20,
        productSearch: 30
      },
      customer: {
        chatbot: 3,
        scanner: 5,
        workOrder: 3,
        productSearch: 5
      }
    },
    premiumLimits: {
      technical: {
        chatbot: 100,
        scanner: 200,
        workOrder: 60,
        productSearch: 100
      },
      customer: {
        chatbot: 15,
        scanner: 30,
        workOrder: 15,
        productSearch: 30
      }
    }
  };

  // Warning thresholds
  private readonly WARNING_THRESHOLD = 0.80; // 80%
  private readonly CRITICAL_THRESHOLD = 0.95; // 95%

  // Legacy properties for backward compatibility
  private get DEFAULT_LIMITS(): RateLimitConfig {
    return this.COST_AWARE_LIMITS.baseLimits;
  }

  private get EMERGENCY_LIMITS(): RateLimitConfig {
    return this.COST_AWARE_LIMITS.emergencyLimits;
  }

  private emergencyMode = false;

  /**
   * Check if user can proceed with action
   * Returns true if under limit, false if exceeded
   */
  async checkLimit(
    userId: string,
    context: 'chatbot' | 'scanner' | 'workOrder' | 'productSearch'
  ): Promise<boolean> {
    try {
      const status = await this.getLimitStatus(userId, context);

      // If limit exceeded, show message and trigger alert
      if (!status.allowed) {
        this.showLimitExceededMessage(context, status.total, status.resetAt);
        // Trigger rate limit alert
        this.triggerRateLimitAlert(userId, true);
        return false;
      }

      // Show warnings at thresholds
      if (status.isWarning) {
        await this.showWarning(userId, context, status);
      }

      return true;
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Fail open: allow on error to prevent blocking users
      // But log for investigation
      console.warn('Rate limiter failed open - allowing request');
      return true;
    }
  }

  /**
   * Trigger rate limit alert
   */
  private triggerRateLimitAlert(userId: string, blocked: boolean): void {
    const rateLimitStatus: RateLimitStatus = {
      allowed: !blocked,
      remaining: 0,
      total: 50,
      percentage: 100,
      resetAt: new Date(),
      isWarning: true,
      userId,
      requestCount: 100, // This would be actual count
      limit: 50, // This would be actual limit
      windowMinutes: 15,
      blocked
    };

    this.alertingService.triggerRateLimitAlert(userId, blocked);
  }

  /**
   * Get detailed rate limit status
   */
  async getLimitStatus(
    userId: string,
    context: 'chatbot' | 'scanner' | 'workOrder' | 'productSearch'
  ): Promise<RateLimitStatus> {
    const userRole = await this.getUserRole(userId);
    const limit = this.getLimit(userRole, context);
    const usage = await this.getUsage(userId, context);

    const remaining = Math.max(0, limit - usage.count);
    const percentage = (usage.count / limit) * 100;
    const allowed = usage.count < limit;
    const isWarning = percentage >= this.WARNING_THRESHOLD * 100;

    return {
      allowed,
      remaining,
      total: limit,
      percentage: Math.round(percentage * 10) / 10,
      resetAt: usage.resetAt.toDate(),
      isWarning
    };
  }

  /**
   * Increment usage counter
   * Uses transaction to prevent race conditions
   */
  async incrementUsage(
    userId: string,
    context: 'chatbot' | 'scanner' | 'workOrder' | 'productSearch'
  ): Promise<void> {
    try {
      const today = this.getToday();
      const docId = `${userId}_${today}_${context}`;
      const docRef = doc(this.firestore, 'rate_limits', docId);

      await runTransaction(this.firestore, async (transaction: any) => {
        const docSnap = await transaction.get(docRef);
        const now = Timestamp.now();

        if (docSnap.exists()) {
          const current = docSnap.data() as RateLimitUsage;
          transaction.update(docRef, {
            count: current.count + 1,
            lastCall: now
          });
        } else {
          const userRole = await this.getUserRole(userId);
          const limit = this.getLimit(userRole, context);
          const resetAt = Timestamp.fromDate(this.getTomorrowMidnight());

          transaction.set(docRef, {
            userId,
            context,
            date: today,
            count: 1,
            limit,
            resetAt,
            warnings: 0,
            firstCall: now,
            lastCall: now
          });
        }
      });
    } catch (error) {
      console.error('Rate limit increment error:', error);
      // Non-blocking: don't prevent operation if counter fails
    }
  }

  /**
   * Get current usage for user/context
   */
  async getUsage(
    userId: string,
    context: string
  ): Promise<RateLimitUsage> {
    try {
      const today = this.getToday();
      const docId = `${userId}_${today}_${context}`;
      const docRef = doc(this.firestore, 'rate_limits', docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as RateLimitUsage;
      }

      // Return default (no usage yet)
      const userRole = await this.getUserRole(userId);
      const limit = this.getLimit(userRole, context);
      const resetAt = Timestamp.fromDate(this.getTomorrowMidnight());
      const now = Timestamp.now();

      return {
        userId,
        context,
        date: today,
        count: 0,
        limit,
        resetAt,
        warnings: 0,
        firstCall: now,
        lastCall: now
      };
    } catch (error) {
      console.error('Get usage error:', error);
      // Return permissive default on error
      return {
        userId,
        context,
        date: this.getToday(),
        count: 0,
        limit: 999,
        resetAt: Timestamp.fromDate(this.getTomorrowMidnight()),
        warnings: 0,
        firstCall: Timestamp.now(),
        lastCall: Timestamp.now()
      };
    }
  }

  /**
   * Get remaining quota for all contexts
   */
  async getAllQuotas(userId: string): Promise<Record<string, RateLimitStatus>> {
    const contexts: Array<'chatbot' | 'scanner' | 'workOrder' | 'productSearch'> = [
      'chatbot',
      'scanner',
      'workOrder',
      'productSearch'
    ];

    const quotas: Record<string, RateLimitStatus> = {};

    for (const context of contexts) {
      quotas[context] = await this.getLimitStatus(userId, context);
    }

    return quotas;
  }

  /**
   * Admin: Activate emergency mode (reduced limits)
   */
  activateEmergencyMode(): void {
    this.emergencyMode = true;
    console.warn('⚠️ EMERGENCY MODE ACTIVATED - Rate limits reduced');
    this.toast.warning('Modo de emergencia activado: límites reducidos temporalmente');
  }

  /**
   * Admin: Deactivate emergency mode
   */
  deactivateEmergencyMode(): void {
    this.emergencyMode = false;
    console.log('✅ Emergency mode deactivated - Normal limits restored');
    this.toast.info('Modo normal restaurado');
  }

  /**
   * Admin: Update rate limits dynamically
   */
  async updateLimits(
    role: 'technical' | 'customer',
    limits: Partial<RateLimitConfig['technical']>
  ): Promise<void> {
    // Store in Firestore config for persistence
    const configRef = doc(this.firestore, 'system_config', 'rate_limits');

    try {
      const configSnap = await getDoc(configRef);
      const currentConfig = configSnap.exists()
        ? configSnap.data() as RateLimitConfig
        : this.DEFAULT_LIMITS;

      const updatedConfig = {
        ...currentConfig,
        [role]: {
          ...currentConfig[role],
          ...limits
        }
      };

      await setDoc(configRef, updatedConfig);
      console.log(`Rate limits updated for ${role}:`, limits);
      this.toast.success('Límites actualizados correctamente');
    } catch (error) {
      console.error('Update limits error:', error);
      this.toast.error('Error actualizando límites');
    }
  }

  /**
   * Admin: Reset user limits (emergency override)
   */
  async resetUserLimits(userId: string): Promise<void> {
    try {
      const today = this.getToday();
      const contexts = ['chatbot', 'scanner', 'workOrder', 'productSearch'];

      for (const context of contexts) {
        const docId = `${userId}_${today}_${context}`;
        const docRef = doc(this.firestore, 'rate_limits', docId);
        await setDoc(docRef, {
          userId,
          context,
          date: today,
          count: 0,
          limit: 999,
          resetAt: Timestamp.fromDate(this.getTomorrowMidnight()),
          warnings: 0,
          firstCall: Timestamp.now(),
          lastCall: Timestamp.now()
        });
      }

      console.log(`Reset all limits for user: ${userId}`);
      this.toast.success('Límites reiniciados');
    } catch (error) {
      console.error('Reset user limits error:', error);
      this.toast.error('Error reiniciando límites');
    }
  }

  /**
   * Get rate limit metrics for monitoring with cost correlation
   */
  async getMetrics(days: number = 7): Promise<{
    totalUsers: number;
    totalCalls: number;
    byContext: Record<string, number>;
    topUsers: Array<{ userId: string; calls: number }>;
    costCorrelation: {
      totalCosts: number;
      costPerCall: number;
      throttledRequests: number;
    };
  }> {
    try {
      // Get cost monitoring data
      const costHistory = await this.costMonitoring.getUsageHistory('daily', days);
      const totalCosts = costHistory.reduce((sum: number, record: any) => sum + record.costs.total, 0);
      const totalCalls = costHistory.reduce((sum: number, record: any) => sum + record.usage.functions.invocations, 0);

      // Get rate limit data (simplified aggregation)
      const rateLimitRef = collection(this.firestore, 'rate_limits');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const q = query(
        rateLimitRef,
        where('date', '>=', cutoffDate.toISOString().split('T')[0])
      );

      const snapshot = await getDocs(q);
      const usageByContext: Record<string, number> = {};
      const userCalls: Record<string, number> = {};

      snapshot.forEach((doc: DocumentData) => {
        const data = doc.data() as RateLimitUsage;
        usageByContext[data.context] = (usageByContext[data.context] || 0) + data.count;
        userCalls[data.userId] = (userCalls[data.userId] || 0) + data.count;
      });

      const topUsers = Object.entries(userCalls)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([userId, calls]) => ({ userId, calls }));

      // Calculate throttled requests (simplified)
      const currentLimits = this.getCurrentLimits();
      let throttledRequests = 0;
      for (const [context, count] of Object.entries(usageByContext)) {
        const limit = currentLimits.technical[context as keyof typeof currentLimits.technical] ||
                     currentLimits.customer[context as keyof typeof currentLimits.customer] || 10;
        if (count > limit * days) { // Rough estimate
          throttledRequests += count - (limit * days);
        }
      }

      return {
        totalUsers: Object.keys(userCalls).length,
        totalCalls: Object.values(usageByContext).reduce((sum, count) => sum + count, 0),
        byContext: usageByContext,
        topUsers,
        costCorrelation: {
          totalCosts,
          costPerCall: totalCalls > 0 ? totalCosts / totalCalls : 0,
          throttledRequests
        }
      };
    } catch (error) {
      console.error('Error getting rate limit metrics:', error);
      return {
        totalUsers: 0,
        totalCalls: 0,
        byContext: {},
        topUsers: [],
        costCorrelation: {
          totalCosts: 0,
          costPerCall: 0,
          throttledRequests: 0
        }
      };
    }
  }

  // Private helper methods

  private async getUserRole(userId: string): Promise<'technical' | 'customer'> {
    try {
      const user = this.auth.currentUser();
      if (user && user.uid === userId) {
        const technicalRoles = ['technician', 'admin', 'manager', 'employee', 'front_desk'];
        return technicalRoles.includes(user.role || '') ? 'technical' : 'customer';
      }
      // If user not found or ID mismatch, default to customer
      return 'customer';
    } catch (error) {
      console.error('Get user role error:', error);
      // Default to customer (more restrictive) for safety
      return 'customer';
    }
  }

  private getLimit(
    role: 'technical' | 'customer',
    context: string
  ): number {
    const currentLimits = this.getCurrentLimits();
    return currentLimits[role][context as keyof typeof currentLimits.technical] || 10;
  }

  /**
   * Get current limits based on cost monitoring and emergency mode
   */
  private getCurrentLimits(): RateLimitConfig {
    if (this.emergencyMode) {
      return this.COST_AWARE_LIMITS.emergencyLimits;
    }

    // Check current costs to apply cost-based throttling
    const currentCosts = this.costMonitoring.getCurrentCosts();
    const dailyThreshold = 10.0; // $10 daily threshold for cost awareness

    if (currentCosts.total > dailyThreshold) {
      // Apply cost multiplier to reduce usage
      const multiplier = this.COST_AWARE_LIMITS.costMultiplier;
      return {
        technical: {
          chatbot: Math.floor(this.COST_AWARE_LIMITS.baseLimits.technical.chatbot * multiplier),
          scanner: Math.floor(this.COST_AWARE_LIMITS.baseLimits.technical.scanner * multiplier),
          workOrder: Math.floor(this.COST_AWARE_LIMITS.baseLimits.technical.workOrder * multiplier),
          productSearch: Math.floor(this.COST_AWARE_LIMITS.baseLimits.technical.productSearch * multiplier)
        },
        customer: {
          chatbot: Math.floor(this.COST_AWARE_LIMITS.baseLimits.customer.chatbot * multiplier),
          scanner: Math.floor(this.COST_AWARE_LIMITS.baseLimits.customer.scanner * multiplier),
          workOrder: Math.floor(this.COST_AWARE_LIMITS.baseLimits.customer.workOrder * multiplier),
          productSearch: Math.floor(this.COST_AWARE_LIMITS.baseLimits.customer.productSearch * multiplier)
        }
      };
    }

    return this.COST_AWARE_LIMITS.baseLimits;
  }

  private getToday(): string {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private getTomorrowMidnight(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  private async showWarning(
    userId: string,
    context: string,
    status: RateLimitStatus
  ): Promise<void> {
    try {
      const usage = await this.getUsage(userId, context);

      // Only show warning once at each threshold
      if (status.percentage >= this.CRITICAL_THRESHOLD * 100 && usage.warnings === 0) {
        this.toast.warning(
          `⚠️ CRÍTICO: Solo ${status.remaining} de ${status.total} consultas restantes para ${this.getContextName(context)}`
        );
        await this.incrementWarnings(userId, context);
      } else if (status.percentage >= this.WARNING_THRESHOLD * 100 && usage.warnings === 0) {
        this.toast.info(
          `ℹ️ Has usado ${status.total - status.remaining} de ${status.total} consultas para ${this.getContextName(context)}`
        );
        await this.incrementWarnings(userId, context);
      }
    } catch (error) {
      console.error('Show warning error:', error);
    }
  }

  private async incrementWarnings(userId: string, context: string): Promise<void> {
    try {
      const today = this.getToday();
      const docId = `${userId}_${today}_${context}`;
      const docRef = doc(this.firestore, 'rate_limits', docId);

      await runTransaction(this.firestore, async (transaction: any) => {
        const docSnap = await transaction.get(docRef);
        if (docSnap.exists()) {
          const current = docSnap.data() as RateLimitUsage;
          transaction.update(docRef, {
            warnings: current.warnings + 1
          });
        }
      });
    } catch (error) {
      console.error('Increment warnings error:', error);
    }
  }

  private showLimitExceededMessage(context: string, limit: number, resetAt: Date): void {
    const contextName = this.getContextName(context);
    const timeUntilReset = this.formatTimeUntilReset(resetAt);

    const messages: Record<string, string> = {
      chatbot: `Has alcanzado el límite diario de ${limit} consultas al chatbot. Se reinicia en ${timeUntilReset}. Consulta nuestras preguntas frecuentes o contacta directamente.`,
      scanner: `Límite de ${limit} escaneos diarios alcanzado. Se reinicia en ${timeUntilReset}. Busca el repuesto manualmente en el inventario.`,
      workOrder: `Límite de ${limit} asistencias para órdenes alcanzado. Se reinicia en ${timeUntilReset}. Crea la orden manualmente.`,
      productSearch: `Límite de ${limit} búsquedas inteligentes alcanzado. Se reinicia en ${timeUntilReset}. Usa el catálogo estándar.`
    };

    this.toast.error(messages[context] || `Límite diario alcanzado. Se reinicia en ${timeUntilReset}.`);
  }

  private getContextName(context: string): string {
    const names: Record<string, string> = {
      chatbot: 'Chatbot',
      scanner: 'Escáner',
      workOrder: 'Órdenes de Trabajo',
      productSearch: 'Búsqueda de Productos'
    };
    return names[context] || context;
  }

  private formatTimeUntilReset(resetAt: Date): string {
    const now = new Date();
    const diff = resetAt.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}