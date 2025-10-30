import { Injectable } from '@angular/core';

export interface UserFriendlyError {
  title: string;
  message: string;
  action?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'network' | 'service' | 'validation' | 'permission' | 'unknown';
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {

  constructor() {}

  /**
   * Convert technical errors to user-friendly messages
   */
  getUserFriendlyError(error: any): UserFriendlyError {
    // Network errors
    if (this.isNetworkError(error)) {
      return {
        title: 'Problema de conexión',
        message: 'No se pudo conectar al servidor. Verifica tu conexión a internet e intenta de nuevo.',
        action: 'Reintentar',
        severity: 'warning',
        category: 'network'
      };
    }

    // Rate limiting
    if (this.isRateLimitError(error)) {
      return {
        title: 'Demasiadas solicitudes',
        message: 'Has realizado muchas solicitudes. Por favor, espera un momento antes de continuar.',
        action: 'Esperar',
        severity: 'warning',
        category: 'service'
      };
    }

    // Service unavailable
    if (this.isServiceUnavailableError(error)) {
      return {
        title: 'Servicio no disponible',
        message: 'El servicio solicitado no está disponible temporalmente. Intenta de nuevo más tarde.',
        action: 'Reintentar más tarde',
        severity: 'error',
        category: 'service'
      };
    }

    // Authentication errors
    if (this.isAuthError(error)) {
      return {
        title: 'Problema de autenticación',
        message: 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.',
        action: 'Iniciar sesión',
        severity: 'error',
        category: 'permission'
      };
    }

    // Validation errors
    if (this.isValidationError(error)) {
      return {
        title: 'Datos inválidos',
        message: error.message || 'Los datos proporcionados no son válidos. Por favor, verifica e intenta de nuevo.',
        severity: 'warning',
        category: 'validation'
      };
    }

    // AI service errors
    if (this.isAIServiceError(error)) {
      return {
        title: 'Servicio de IA no disponible',
        message: 'Las funciones de inteligencia artificial no están disponibles. Puedes continuar usando las funciones básicas.',
        severity: 'info',
        category: 'service'
      };
    }

    // Default error
    return {
      title: 'Error inesperado',
      message: 'Ha ocurrido un error inesperado. Si el problema persiste, contacta al soporte técnico.',
      action: 'Contactar soporte',
      severity: 'error',
      category: 'unknown'
    };
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: any): boolean {
    return error.name === 'NetworkError' ||
           error.message?.includes('network') ||
           error.message?.includes('fetch') ||
           error.message?.includes('connection') ||
           error.status === 0 ||
           !navigator.onLine;
  }

  /**
   * Check if error is rate limiting
   */
  private isRateLimitError(error: any): boolean {
    return error.status === 429 ||
           error.message?.includes('rate limit') ||
           error.message?.includes('too many requests') ||
           error.message?.includes('Rate limit exceeded');
  }

  /**
   * Check if error is service unavailable
   */
  private isServiceUnavailableError(error: any): boolean {
    return error.status === 503 ||
           error.status === 502 ||
           error.status === 504 ||
           error.message?.includes('service unavailable') ||
           error.message?.includes('temporarily unavailable') ||
           error.message?.includes('Circuit breaker');
  }

  /**
   * Check if error is authentication related
   */
  private isAuthError(error: any): boolean {
    return error.status === 401 ||
           error.status === 403 ||
           error.message?.includes('unauthorized') ||
           error.message?.includes('forbidden') ||
           error.message?.includes('authentication');
  }

  /**
   * Check if error is validation related
   */
  private isValidationError(error: any): boolean {
    return error.status === 400 ||
           error.status === 422 ||
           error.message?.includes('validation') ||
           error.message?.includes('invalid') ||
           error.message?.includes('required');
  }

  /**
   * Check if error is AI service related
   */
  private isAIServiceError(error: any): boolean {
    return error.message?.includes('AI service') ||
           error.message?.includes('Groq') ||
           error.message?.includes('Gemini') ||
           error.message?.includes('circuit breaker') ||
           error.message?.includes('fallback');
  }

  /**
   * Log error for debugging
   */
  logError(error: any, context?: string): void {
    const userFriendly = this.getUserFriendlyError(error);

    console.error(`[${context || 'Unknown'}] ${userFriendly.category} error:`, {
      originalError: error,
      userFriendly,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });
  }

  /**
   * Handle error and return user-friendly message
   */
  handleError(error: any, context?: string): UserFriendlyError {
    this.logError(error, context);
    return this.getUserFriendlyError(error);
  }
}