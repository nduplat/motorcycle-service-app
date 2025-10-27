/**
 * Centralized Error Handling Utility
 *
 * Provides standardized error handling patterns to reduce console.error duplication
 * and ensure consistent error logging and user feedback across the application.
 */

export interface ErrorContext {
  operation: string;
  userId?: string;
  component?: string;
  service?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorResult<T = void> {
  success: boolean;
  data?: T;
  error?: ErrorInfo;
}

export interface ErrorInfo {
  message: string;
  code?: string;
  originalError?: any;
  context?: ErrorContext;
  timestamp: Date;
}

/**
 * Standardized error logger
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ErrorInfo[] = [];

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Log an error with context
   */
  logError(error: any, context: ErrorContext): ErrorInfo {
    const errorInfo: ErrorInfo = {
      message: this.extractErrorMessage(error),
      code: this.extractErrorCode(error),
      originalError: error,
      context,
      timestamp: new Date()
    };

    // Log to console in development
    if (this.isDevelopment()) {
      console.error(`[${context.operation}] ${errorInfo.message}`, {
        error: errorInfo.originalError,
        context: errorInfo.context,
        timestamp: errorInfo.timestamp
      });
    }

    // Store in memory log (could be sent to monitoring service)
    this.errorLog.push(errorInfo);

    // Limit log size
    if (this.errorLog.length > 1000) {
      this.errorLog = this.errorLog.slice(-500);
    }

    return errorInfo;
  }

  /**
   * Handle async operation with standardized error handling
   */
  async handleAsync<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    fallbackValue?: T
  ): Promise<ErrorResult<T>> {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      const errorInfo = this.logError(error, context);
      return {
        success: false,
        data: fallbackValue,
        error: errorInfo
      };
    }
  }

  /**
   * Handle sync operation with standardized error handling
   */
  handleSync<T>(
    operation: () => T,
    context: ErrorContext,
    fallbackValue?: T
  ): ErrorResult<T> {
    try {
      const data = operation();
      return { success: true, data };
    } catch (error) {
      const errorInfo = this.logError(error, context);
      return {
        success: false,
        data: fallbackValue,
        error: errorInfo
      };
    }
  }

  /**
   * Create a standardized error message
   */
  createErrorMessage(operation: string, error: any): string {
    const message = this.extractErrorMessage(error);
    return `Failed to ${operation}: ${message}`;
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(limit: number = 10): ErrorInfo[] {
    return this.errorLog.slice(-limit);
  }

  /**
   * Clear error log
   */
  clearLog(): void {
    this.errorLog = [];
  }

  private extractErrorMessage(error: any): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && error.message) {
      return error.message;
    }
    return 'Unknown error occurred';
  }

  private extractErrorCode(error: any): string | undefined {
    if (error && typeof error === 'object' && error.code) {
      return error.code;
    }
    return undefined;
  }

  private isDevelopment(): boolean {
    return typeof window !== 'undefined' &&
           (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.includes('dev'));
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Utility functions for common patterns
export function handleServiceError(
  error: any,
  operation: string,
  service: string,
  userId?: string
): ErrorInfo {
  return errorHandler.logError(error, {
    operation,
    service,
    userId
  });
}

export function createOperationContext(
  operation: string,
  service?: string,
  userId?: string,
  component?: string
): ErrorContext {
  return {
    operation,
    service,
    userId,
    component
  };
}