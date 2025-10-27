import { Injectable } from '@angular/core';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;        // Base delay in milliseconds
  maxDelay: number;         // Maximum delay between retries
  backoffFactor: number;    // Exponential backoff factor
  retryableErrors?: (error: any) => boolean; // Function to determine if error is retryable
}

@Injectable({
  providedIn: 'root'
})
export class RetryService {
  constructor() {}

  /**
   * Execute operation with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      retryableErrors: this.isRetryableError,
      ...config
    };

    let lastError: any;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on last attempt
        if (attempt === finalConfig.maxAttempts) {
          break;
        }

        // Check if error is retryable
        if (!finalConfig.retryableErrors!(error)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          finalConfig.baseDelay * Math.pow(finalConfig.backoffFactor, attempt - 1),
          finalConfig.maxDelay
        );

        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, (error as any)?.message || error);

        // Wait before retry
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * Default function to determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors
    if (error.name === 'NetworkError' || error.message?.includes('network')) {
      return true;
    }

    // HTTP errors that might be temporary
    if (error.status) {
      const retryableStatuses = [408, 429, 500, 502, 503, 504]; // Request Timeout, Too Many Requests, Server errors
      return retryableStatuses.includes(error.status);
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      return true;
    }

    // Rate limit errors
    if (error.message?.includes('rate limit') || error.message?.includes('too many requests')) {
      return true;
    }

    // Default: don't retry for other errors
    return false;
  }

  /**
   * Utility method to create a delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}