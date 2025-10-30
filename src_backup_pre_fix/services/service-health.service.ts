import { Injectable, inject } from '@angular/core';
import { CircuitBreakerService } from './circuit-breaker.service';
import { RateLimiterService } from './rate-limiter.service';
// import { AIAssistantService } from './ai-assistant.service'; // REMOVED: AI services eliminated for cost savings

export interface ServiceHealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastChecked: Date;
  responseTime?: number;
  errorMessage?: string;
  metrics?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ServiceHealthService {
  // private aiAssistantService = inject(AIAssistantService); // REMOVED: AI services eliminated for cost savings
  private circuitBreaker = inject(CircuitBreakerService);
  private rateLimiter = inject(RateLimiterService);

  private healthStatuses = new Map<string, ServiceHealthStatus>();

  constructor() {
    // Start periodic health checks
    this.startHealthMonitoring();
  }

  /**
   * Get health status for all services
   */
  getAllHealthStatuses(): ServiceHealthStatus[] {
    return Array.from(this.healthStatuses.values());
  }

  /**
   * Get health status for a specific service
   */
  getHealthStatus(service: string): ServiceHealthStatus | null {
    return this.healthStatuses.get(service) || null;
  }

  /**
   * Check health of all services
   */
  async checkAllServices(): Promise<ServiceHealthStatus[]> {
    const services = ['ai-assistant', 'firebase', 'backend-system', 'circuit-breaker', 'rate-limiter'];

    const healthChecks = services.map(service => this.checkServiceHealth(service));
    const results = await Promise.all(healthChecks);

    results.forEach(status => {
      this.healthStatuses.set(status.service, status);
    });

    return results;
  }

  /**
   * Check health of a specific service
   */
  private async checkServiceHealth(service: string): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      switch (service) {
        case 'ai-assistant':
          return await this.checkAIHealth(startTime);

        case 'firebase':
          return await this.checkFirebaseHealth(startTime);

        case 'backend-system':
          return await this.checkBackendSystemHealth(startTime);

        case 'circuit-breaker':
          return this.checkCircuitBreakerHealth(startTime);

        case 'rate-limiter':
          return this.checkRateLimiterHealth(startTime);

        default:
          return {
            service,
            status: 'unknown',
            lastChecked: new Date(),
            errorMessage: 'Unknown service'
          };
      }
    } catch (error: any) {
      return {
        service,
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: error.message
      };
    }
  }

  private async checkAIHealth(startTime: number): Promise<ServiceHealthStatus> {
    try {
      // REMOVED: AI services eliminated for cost savings
      // const isConfigured = this.aiAssistantService ? true : false;
      const isConfigured = false; // AI services removed

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy'; // Always unhealthy since AI is removed

      // Check circuit breaker status (may still exist for other services)
      const circuitBreakerStats = this.circuitBreaker.getStats('ai-budget');
      if (circuitBreakerStats?.state === 'OPEN') {
        status = 'unhealthy'; // Even more unhealthy if circuit breaker is open
      }

      return {
        service: 'ai-assistant',
        status,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: 'AI services eliminated for cost savings',
        metrics: {
          configured: isConfigured,
          circuitBreaker: circuitBreakerStats,
          note: 'AI services removed for cost optimization'
        }
      };
    } catch (error: any) {
      return {
        service: 'ai-assistant',
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: `AI services removed: ${error.message}`
      };
    }
  }

  private async checkFirebaseHealth(startTime: number): Promise<ServiceHealthStatus> {
    try {
      // Call the backend health check endpoint
      const response = await fetch('/api/systemHealth', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Health check failed with status: ${response.status}`);
      }

      const healthData = await response.json();

      // Determine overall Firebase health from backend response
      const firestoreHealth = healthData.services.find((s: any) => s.service === 'firestore');
      const authHealth = healthData.services.find((s: any) => s.service === 'firebase-auth');
      const storageHealth = healthData.services.find((s: any) => s.service === 'firebase-storage');

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      const unhealthyServices = [firestoreHealth, authHealth, storageHealth]
        .filter(s => s && s.status === 'unhealthy');

      if (unhealthyServices.length > 0) {
        status = 'unhealthy';
      } else {
        const degradedServices = [firestoreHealth, authHealth, storageHealth]
          .filter(s => s && s.status === 'degraded');
        if (degradedServices.length > 0) {
          status = 'degraded';
        }
      }

      return {
        service: 'firebase',
        status,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        metrics: {
          firestore: firestoreHealth,
          auth: authHealth,
          storage: storageHealth,
          overall: healthData.overall
        }
      };
    } catch (error: any) {
      // Fallback to basic connectivity check
      const isConnected = navigator.onLine;
      return {
        service: 'firebase',
        status: isConnected ? 'degraded' : 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: `Backend health check failed: ${error.message}. Using basic connectivity check.`,
        metrics: { fallbackCheck: true, online: isConnected }
      };
    }
  }

  private async checkBackendSystemHealth(startTime: number): Promise<ServiceHealthStatus> {
    try {
      // Call the backend system health check endpoint
      const response = await fetch('/api/systemHealth', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Backend health check failed with status: ${response.status}`);
      }

      const healthData = await response.json();

      // Map backend status to frontend status
      const backendStatus = healthData.status as 'healthy' | 'degraded' | 'unhealthy';
      const statusMap: Record<string, 'healthy' | 'degraded' | 'unhealthy'> = {
        'healthy': 'healthy',
        'degraded': 'degraded',
        'unhealthy': 'unhealthy'
      };

      return {
        service: 'backend-system',
        status: statusMap[backendStatus] || 'unknown',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        metrics: healthData
      };
    } catch (error: any) {
      return {
        service: 'backend-system',
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: error.message
      };
    }
  }

  private checkCircuitBreakerHealth(startTime: number): ServiceHealthStatus {
    const circuits = this.circuitBreaker.getCircuitNames();
    const stats = circuits.map(name => ({
      name,
      stats: this.circuitBreaker.getStats(name)
    }));

    const hasOpenCircuits = stats.some(c => c.stats?.state === 'OPEN');

    return {
      service: 'circuit-breaker',
      status: hasOpenCircuits ? 'degraded' : 'healthy',
      lastChecked: new Date(),
      responseTime: Date.now() - startTime,
      metrics: { circuits: stats }
    };
  }

  private checkRateLimiterHealth(startTime: number): ServiceHealthStatus {
    // Note: Rate limiter health check is now handled by the new RateLimiterService
    // This is a simplified version for backward compatibility
    return {
      service: 'rate-limiter',
      status: 'healthy',
      lastChecked: new Date(),
      responseTime: Date.now() - startTime,
      metrics: { note: 'Health check deprecated - use AIAssistantService' }
    };
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    // Initial check
    this.checkAllServices();

    // Check every 5 minutes
    setInterval(() => {
      this.checkAllServices().catch(error => {
        console.error('Health check failed:', error);
      });
    }, 5 * 60 * 1000);
  }

  /**
   * Get overall system health
   */
  getOverallHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: ServiceHealthStatus[];
    lastChecked: Date;
  } {
    const services = this.getAllHealthStatuses();
    const lastChecked = new Date(Math.max(...services.map(s => s.lastChecked.getTime())));

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (services.some(s => s.status === 'unhealthy')) {
      status = 'unhealthy';
    } else if (services.some(s => s.status === 'degraded')) {
      status = 'degraded';
    }

    return {
      status,
      services,
      lastChecked
    };
  }
}