import { Injectable, inject } from '@angular/core';
import { CostMonitoringService } from './cost-monitoring.service';
import { CacheService } from './cache.service';
import { FallbackLibraryService } from './fallback-library.service';
import { NotificationService } from './notification.service';
import { AlertingService, BudgetStatus } from './alerting.service';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface BudgetThresholds {
  warningThreshold: number;    // Percentage (e.g., 80 for 80%)
  shutdownThreshold: number;   // Percentage (e.g., 100 for 100%)
  dailyBudget: number;         // Daily budget in dollars
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  recoveryTimeout: number;     // Base time in ms before trying half-open
  maxRecoveryTimeout: number;  // Maximum recovery timeout
  successThreshold: number;    // Successes needed to close circuit
  backoffMultiplier: number;   // Exponential backoff multiplier
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttemptTime?: Date;
  totalRequests: number;
  totalFailures: number;
  currentBudgetUsage: number;
  budgetPercentage: number;
}

export interface BudgetCircuitBreakerStatus {
  isEnabled: boolean;
  thresholds: BudgetThresholds;
  circuitBreaker: CircuitBreakerStats;
  emergencyMode: boolean;
  lastUpdated: Date;
}

@Injectable({
  providedIn: 'root'
})
export class BudgetCircuitBreakerService {
  private costMonitoring = inject(CostMonitoringService);
  private cacheService = inject(CacheService);
  private fallbackLibrary = inject(FallbackLibraryService);
  private notificationService = inject(NotificationService);
  private alertingService = inject(AlertingService);

  // Default configuration
  private readonly DEFAULT_THRESHOLDS: BudgetThresholds = {
    warningThreshold: 80,    // 80% warning
    shutdownThreshold: 100,  // 100% shutdown
    dailyBudget: 10.0        // $10 daily budget
  };

  private readonly DEFAULT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 3,      // 3 failures before opening
    recoveryTimeout: 30000,   // 30 seconds base timeout
    maxRecoveryTimeout: 3600000, // 1 hour max timeout
    successThreshold: 2,      // 2 successes to close
    backoffMultiplier: 2      // Double timeout each failure
  };

  // Current status
  private status: BudgetCircuitBreakerStatus = {
    isEnabled: true,
    thresholds: { ...this.DEFAULT_THRESHOLDS },
    circuitBreaker: {
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
      successCount: 0,
      totalRequests: 0,
      totalFailures: 0,
      currentBudgetUsage: 0,
      budgetPercentage: 0
    },
    emergencyMode: false,
    lastUpdated: new Date()
  };

  constructor() {
    // Initialize with stored configuration if available
    this.loadConfiguration();
    // Start monitoring loop
    this.startBudgetMonitoring();
  }

  /**
   * Execute AI operation with budget circuit breaker protection
   */
  async executeAIOperation<T>(
    operation: () => Promise<T>,
    context: 'chatbot' | 'scanner' | 'workOrder' | 'productSearch',
    userId: string,
    prompt?: string
  ): Promise<T> {
    this.updateBudgetStatus();

    // Check if circuit breaker should allow request
    if (!this.shouldAllowRequest()) {
      console.warn(`🚫 Budget Circuit Breaker: Request blocked - State: ${this.status.circuitBreaker.state}`);
      throw this.createCircuitBreakerError();
    }

    this.status.circuitBreaker.totalRequests++;

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Get fallback response when circuit breaker is open
   */
  async getFallbackResponse(
    prompt: string,
    context: 'chatbot' | 'productSearch' | 'scanner' | 'workOrder'
  ): Promise<string> {
    try {
      // Try fallback library first
      const fallbackMatch = await this.fallbackLibrary.findBestMatch(prompt, context);
      if (fallbackMatch) {
        const response = await this.fallbackLibrary.getResponseWithDynamicData(fallbackMatch);
        return response;
      }
    } catch (error) {
      console.error('Fallback library error:', error);
    }

    // Use simplified cached responses
    return this.getSimplifiedResponse(context);
  }

  /**
   * Check if request should be allowed based on budget and circuit state
   */
  private shouldAllowRequest(): boolean {
    // Emergency mode: only allow critical operations
    if (this.status.emergencyMode) {
      return false;
    }

    // Check circuit breaker state
    switch (this.status.circuitBreaker.state) {
      case CircuitBreakerState.CLOSED:
        // Check budget limits
        return this.status.circuitBreaker.budgetPercentage < this.status.thresholds.shutdownThreshold;

      case CircuitBreakerState.OPEN:
        // Check if recovery timeout has passed
        if (this.status.circuitBreaker.nextAttemptTime &&
            new Date() >= this.status.circuitBreaker.nextAttemptTime) {
          this.status.circuitBreaker.state = CircuitBreakerState.HALF_OPEN;
          this.status.circuitBreaker.successCount = 0;
          console.log('🔄 Budget Circuit Breaker: Moving to HALF_OPEN state');
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(): void {
    this.status.circuitBreaker.successCount++;
    this.status.circuitBreaker.lastSuccessTime = new Date();

    // Reset failure count on success
    this.status.circuitBreaker.failureCount = 0;

    // If in half-open and enough successes, close circuit
    if (this.status.circuitBreaker.state === CircuitBreakerState.HALF_OPEN &&
        this.status.circuitBreaker.successCount >= this.DEFAULT_CONFIG.successThreshold) {
      this.closeCircuitBreaker();
    }

    this.status.lastUpdated = new Date();
  }

  /**
   * Record failed operation
   */
  private recordFailure(): void {
    this.status.circuitBreaker.failureCount++;
    this.status.circuitBreaker.totalFailures++;
    this.status.circuitBreaker.lastFailureTime = new Date();

    // Check if should open circuit
    if (this.status.circuitBreaker.state === CircuitBreakerState.CLOSED &&
        this.status.circuitBreaker.failureCount >= this.DEFAULT_CONFIG.failureThreshold) {
      this.openCircuitBreaker();
    }

    // If half-open, go back to open
    if (this.status.circuitBreaker.state === CircuitBreakerState.HALF_OPEN) {
      this.openCircuitBreaker();
    }

    this.status.lastUpdated = new Date();
  }

  /**
   * Open circuit breaker with exponential backoff
   */
  private openCircuitBreaker(): void {
    this.status.circuitBreaker.state = CircuitBreakerState.OPEN;

    // Calculate exponential backoff
    const backoffMs = Math.min(
      this.DEFAULT_CONFIG.recoveryTimeout * Math.pow(this.DEFAULT_CONFIG.backoffMultiplier, this.status.circuitBreaker.failureCount),
      this.DEFAULT_CONFIG.maxRecoveryTimeout
    );

    this.status.circuitBreaker.nextAttemptTime = new Date(Date.now() + backoffMs);

    console.warn(`🚫 Budget Circuit Breaker: OPENED - Next attempt in ${Math.round(backoffMs / 1000)}s`);

    // Trigger emergency mode if budget is critical
    if (this.status.circuitBreaker.budgetPercentage >= this.status.thresholds.shutdownThreshold) {
      this.activateEmergencyMode();
    }

    // Circuit opened alerts are now handled by the alerting service
    console.log('Circuit opened - alerting service will handle notifications');
  }

  /**
   * Close circuit breaker
   */
  private closeCircuitBreaker(): void {
    if (this.status.circuitBreaker.state !== CircuitBreakerState.CLOSED) {
      this.status.circuitBreaker.state = CircuitBreakerState.CLOSED;
      this.status.circuitBreaker.failureCount = 0;
      this.status.circuitBreaker.successCount = 0;
      this.status.circuitBreaker.nextAttemptTime = undefined;

      console.log('✅ Budget Circuit Breaker: CLOSED - Normal operation resumed');

      // Deactivate emergency mode if budget is healthy
      if (this.status.circuitBreaker.budgetPercentage < this.status.thresholds.warningThreshold) {
        this.deactivateEmergencyMode();
      }

      // Circuit closed alerts are now handled by the alerting service
      console.log('Circuit closed - alerting service will handle notifications');
    }
  }

  /**
   * Activate emergency mode - aggressive cost saving
   */
  private activateEmergencyMode(): void {
    if (!this.status.emergencyMode) {
      this.status.emergencyMode = true;
      console.warn('🚨 Budget Circuit Breaker: EMERGENCY MODE ACTIVATED');

      // Clear non-essential cache to force fresh fallbacks
      this.cacheService.clearContext('ai_response').catch(err =>
        console.error('Cache clear error:', err)
      );

      // Emergency mode alerts are now handled by the alerting service
      console.log('Emergency mode activated - alerting service will handle notifications');
    }
  }

  /**
   * Deactivate emergency mode
   */
  private deactivateEmergencyMode(): void {
    if (this.status.emergencyMode) {
      this.status.emergencyMode = false;
      console.log('✅ Budget Circuit Breaker: Emergency mode deactivated');
    }
  }

  /**
   * Update budget status from cost monitoring
   */
  private updateBudgetStatus(): void {
    const currentCosts = this.costMonitoring.getCurrentCosts();
    this.status.circuitBreaker.currentBudgetUsage = currentCosts.total;
    this.status.circuitBreaker.budgetPercentage = (currentCosts.total / this.status.thresholds.dailyBudget) * 100;

    // Check for threshold crossings
    this.checkThresholdAlerts();
  }

  /**
   * Check and trigger threshold-based alerts
   */
  private checkThresholdAlerts(): void {
    const percentage = this.status.circuitBreaker.budgetPercentage;

    // Trigger alerts through the enhanced alerting service
    if (percentage >= this.status.thresholds.warningThreshold && percentage < this.status.thresholds.shutdownThreshold) {
      if (!this.status.emergencyMode) {
        const budgetStatus: BudgetStatus = {
          currentUsage: this.status.circuitBreaker.currentBudgetUsage,
          budgetLimit: this.status.thresholds.dailyBudget,
          percentage,
          context: 'chatbot' // Default context, could be enhanced to track actual context
        };
        this.alertingService.triggerBudgetAlert(percentage, 'chatbot');
      }
    }

    if (percentage >= this.status.thresholds.shutdownThreshold) {
      const budgetStatus: BudgetStatus = {
        currentUsage: this.status.circuitBreaker.currentBudgetUsage,
        budgetLimit: this.status.thresholds.dailyBudget,
        percentage,
        context: 'chatbot'
      };
      this.alertingService.triggerBudgetAlert(percentage, 'chatbot');
    }
  }

  /**
   * Start periodic budget monitoring
   */
  private startBudgetMonitoring(): void {
    setInterval(() => {
      this.updateBudgetStatus();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get simplified fallback response based on context
   */
  private getSimplifiedResponse(context: string): string {
    const responses: Record<string, string> = {
      chatbot: 'Servicio de asistencia temporalmente limitado. Por favor, consulte nuestras preguntas frecuentes o contacte al soporte.',
      productSearch: 'Búsqueda de productos limitada. Use la búsqueda básica o contacte a un asesor.',
      scanner: 'Escaneo IA no disponible. Use identificación manual de repuestos.',
      workOrder: 'Creación de órdenes limitada. Use plantillas predefinidas disponibles.'
    };

    return responses[context] || 'Servicio temporalmente no disponible debido a límites de presupuesto.';
  }

  /**
   * Create circuit breaker error
   */
  private createCircuitBreakerError(): Error {
    const nextAttempt = this.status.circuitBreaker.nextAttemptTime;
    const message = nextAttempt
      ? `Circuit breaker is OPEN. Next attempt at ${nextAttempt.toISOString()}`
      : 'Circuit breaker is OPEN due to budget limits exceeded';

    const error = new Error(message);
    error.name = 'CircuitBreakerError';
    return error;
  }

  /**
   * Notify administrators of important events (deprecated - now using AlertingService)
   */
  private notifyAdmins(event: string, data: any): void {
    // Legacy method - alerts are now handled by AlertingService
    console.log(`📢 Admin notification: ${event}`, data);
  }

  /**
   * Get current circuit breaker status
   */
  getStatus(): BudgetCircuitBreakerStatus {
    this.updateBudgetStatus();
    return { ...this.status };
  }

  /**
   * Manually reset circuit breaker (admin function)
   */
  resetCircuitBreaker(): void {
    this.status.circuitBreaker = {
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
      successCount: 0,
      totalRequests: 0,
      totalFailures: 0,
      currentBudgetUsage: this.status.circuitBreaker.currentBudgetUsage,
      budgetPercentage: this.status.circuitBreaker.budgetPercentage
    };
    this.deactivateEmergencyMode();
    console.log('🔄 Budget Circuit Breaker: Manually reset');
  }

  /**
   * Update budget thresholds
   */
  updateThresholds(thresholds: Partial<BudgetThresholds>): void {
    this.status.thresholds = { ...this.status.thresholds, ...thresholds };
    console.log('💰 Budget thresholds updated:', this.status.thresholds);
  }

  /**
   * Load configuration from storage (future enhancement)
   */
  private loadConfiguration(): void {
    // In a real implementation, load from Firestore or local storage
    // For now, use defaults
  }

  /**
   * Save configuration to storage (future enhancement)
   */
  private saveConfiguration(): void {
    // In a real implementation, save to Firestore
  }
}