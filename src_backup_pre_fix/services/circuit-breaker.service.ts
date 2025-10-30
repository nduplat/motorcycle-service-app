import { Injectable } from '@angular/core';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  recoveryTimeout: number;     // Time in ms before trying half-open
  monitoringPeriod: number;    // Time window for failure counting
  successThreshold: number;    // Successes needed to close circuit
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalRequests: number;
  totalFailures: number;
}

@Injectable({
  providedIn: 'root'
})
export class CircuitBreakerService {
  private circuits = new Map<string, {
    config: CircuitBreakerConfig;
    stats: CircuitBreakerStats;
    timeoutId: any;
  }>();

  constructor() {}

  /**
   * Register a new circuit breaker
   */
  registerCircuit(
    name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ): void {
    const defaultConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 60000, // 1 minute
      successThreshold: 3
    };

    const finalConfig = { ...defaultConfig, ...config };

    this.circuits.set(name, {
      config: finalConfig,
      stats: {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        totalRequests: 0,
        totalFailures: 0
      },
      timeoutId: null
    });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    circuitName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const circuit = this.circuits.get(circuitName);
    if (!circuit) {
      throw new Error(`Circuit breaker '${circuitName}' not registered`);
    }

    // Check if circuit should allow request
    if (!this.shouldAllowRequest(circuit)) {
      if (fallback) {
        console.warn(`Circuit '${circuitName}' is ${circuit.stats.state}, using fallback`);
        return fallback();
      }
      throw new Error(`Circuit breaker '${circuitName}' is ${circuit.stats.state}`);
    }

    circuit.stats.totalRequests++;

    try {
      const result = await operation();
      this.recordSuccess(circuitName);
      return result;
    } catch (error) {
      this.recordFailure(circuitName);
      throw error;
    }
  }

  /**
   * Check if request should be allowed
   */
  private shouldAllowRequest(circuit: any): boolean {
    const now = Date.now();

    switch (circuit.stats.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if recovery timeout has passed
        if (circuit.stats.lastFailureTime &&
            (now - circuit.stats.lastFailureTime) >= circuit.config.recoveryTimeout) {
          circuit.stats.state = CircuitState.HALF_OPEN;
          circuit.stats.successes = 0;
          console.log(`Circuit '${circuit}' entering HALF_OPEN state`);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * Record a successful operation
   */
  private recordSuccess(circuitName: string): void {
    const circuit = this.circuits.get(circuitName);
    if (!circuit) return;

    circuit.stats.successes++;
    circuit.stats.lastSuccessTime = Date.now();

    // Reset failure count on success
    circuit.stats.failures = 0;

    // If in half-open and enough successes, close circuit
    if (circuit.stats.state === CircuitState.HALF_OPEN &&
        circuit.stats.successes >= circuit.config.successThreshold) {
      circuit.stats.state = CircuitState.CLOSED;
      circuit.stats.failures = 0;
      circuit.stats.successes = 0;
      console.log(`Circuit '${circuitName}' closed after ${circuit.config.successThreshold} successes`);
    }
  }

  /**
   * Record a failed operation
   */
  private recordFailure(circuitName: string): void {
    const circuit = this.circuits.get(circuitName);
    if (!circuit) return;

    circuit.stats.failures++;
    circuit.stats.totalFailures++;
    circuit.stats.lastFailureTime = Date.now();

    // Check if should open circuit
    if (circuit.stats.state === CircuitState.CLOSED &&
        circuit.stats.failures >= circuit.config.failureThreshold) {
      circuit.stats.state = CircuitState.OPEN;
      console.warn(`Circuit '${circuitName}' opened after ${circuit.stats.failures} failures`);

      // Clear any existing timeout
      if (circuit.timeoutId) {
        clearTimeout(circuit.timeoutId);
      }
    }

    // If half-open, go back to open
    if (circuit.stats.state === CircuitState.HALF_OPEN) {
      circuit.stats.state = CircuitState.OPEN;
      circuit.stats.successes = 0;
      console.warn(`Circuit '${circuitName}' returned to OPEN state after failure in HALF_OPEN`);
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(circuitName: string): CircuitBreakerStats | null {
    const circuit = this.circuits.get(circuitName);
    return circuit ? { ...circuit.stats } : null;
  }

  /**
   * Manually reset a circuit breaker
   */
  reset(circuitName: string): void {
    const circuit = this.circuits.get(circuitName);
    if (circuit) {
      circuit.stats.state = CircuitState.CLOSED;
      circuit.stats.failures = 0;
      circuit.stats.successes = 0;
      circuit.stats.lastFailureTime = null;
      circuit.stats.lastSuccessTime = null;
      console.log(`Circuit '${circuitName}' manually reset`);
    }
  }

  /**
   * Get all circuit names
   */
  getCircuitNames(): string[] {
    return Array.from(this.circuits.keys());
  }
}