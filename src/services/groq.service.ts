import { Injectable, signal, inject } from '@angular/core';
import OpenAI from 'openai';
import { CircuitBreakerService } from './circuit-breaker.service';
import { RateLimiterService } from './rate-limiter.service';
import { RetryService } from './retry.service';
import { AuthService } from './auth.service';
import { auth } from '../firebase.config';

/**
 * PRODUCTION SECURITY REQUIREMENTS:
 * ===============================
 * 1. NEVER expose API keys in client-side code
 * 2. Move all AI API calls to a backend service
 * 3. Use environment variables on the server side only
 * 4. Implement proper authentication and rate limiting
 * 5. Add API key rotation and monitoring
 *
 * CURRENT STATUS: DEVELOPMENT ONLY
 * - API calls are made from browser (INSECURE)
 * - Should only be used for testing/prototyping
 * - Requires backend implementation for production
 */

export interface GroqMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GroqResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class GroqService {
  private proxyUrl: string;
  private isProxyAvailable: boolean = false;
  private responseCache = new Map<string, { response: any; timestamp: number }>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes for AI responses
  private pendingRequests = new Map<string, Promise<any>>();

  // Injected services
  private circuitBreaker = inject(CircuitBreakerService);
  private rateLimiter = inject(RateLimiterService);
  private retryService = inject(RetryService);
  private authService = inject(AuthService);

  constructor() {
    this.proxyUrl = this.getProxyUrl();
    console.log('🤖 GroqService: Initializing with proxy URL:', this.proxyUrl);
    this.checkProxyAvailability();
    this.initializeProtectionServices();
  }

  private initializeProtectionServices(): void {
    // Note: Circuit breaker and rate limiting are now handled by the new AIAssistantService
    // This service is deprecated and should be replaced with AIAssistantService
    console.warn('GroqService is deprecated. Use AIAssistantService instead.');
  }

  private getProxyUrl(): string {
    // Use environment variable or default to localhost
    const proxyUrl = (window as any).ENV?.AI_PROXY_URL ||
                     'http://localhost:3001';

    console.log('🤖 GroqService: Initial proxy URL:', proxyUrl);
    console.log('🤖 GroqService: Window protocol:', window.location.protocol);

    // Ensure HTTPS in production (but not for localhost)
    if (window.location.protocol === 'https:' && !proxyUrl.includes('localhost') && proxyUrl.startsWith('http:')) {
      const httpsUrl = proxyUrl.replace('http:', 'https:');
      console.log('🤖 GroqService: Converted to HTTPS:', httpsUrl);
      return httpsUrl;
    }

    console.log('🤖 GroqService: Final proxy URL:', proxyUrl);
    return proxyUrl;
  }

  private async checkProxyAvailability(): Promise<void> {
    console.log('🤖 GroqService: Checking proxy availability at:', `${this.proxyUrl}/health`);
    try {
      const response = await fetch(`${this.proxyUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const health = await response.json();
        this.isProxyAvailable = health.status === 'healthy';
        console.log('✅ AI Proxy service available:', health.services);
        console.log('🤖 GroqService: Proxy status - Available:', this.isProxyAvailable);
      } else {
        console.error('❌ AI Proxy health check failed with status:', response.status);
        throw new Error(`Health check failed: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ AI Proxy service not available:', error);
      console.log('🤖 GroqService: Proxy status - Available:', this.isProxyAvailable);
      this.isProxyAvailable = false;
    }
  }

  private async makeProxyRequest(endpoint: string, data: any): Promise<any> {
    if (!this.isProxyAvailable) {
      throw new Error('AI proxy service is not available. Please ensure the backend server is running.');
    }

    // Create cache key from endpoint and data
    const cacheKey = `${endpoint}:${JSON.stringify(data)}`;

    // Check cache first
    const cached = this.responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      console.log('Returning cached AI response for:', cacheKey);
      return cached.response;
    }

    // Check for pending request (deduplication)
    const pending = this.pendingRequests.get(cacheKey);
    if (pending) {
      console.log('Returning pending AI request for:', cacheKey);
      return pending;
    }

    // Create new request with protection
    const requestPromise = this.executeProtectedRequest(endpoint, data, cacheKey);

    // Store pending request
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;

      // Cache the result
      this.responseCache.set(cacheKey, { response: result, timestamp: Date.now() });

      return result;
    } finally {
      // Remove from pending requests
      this.pendingRequests.delete(cacheKey);
    }
  }

  private async executeProtectedRequest(endpoint: string, data: any, cacheKey: string): Promise<any> {
    // Note: Protection services are now handled by AIAssistantService
    // This is a simplified version for backward compatibility
    try {
      return await this.performProxyRequest(endpoint, data, cacheKey);
    } catch (error) {
      return this.getFallbackResponse(endpoint, data);
    }
  }

  private getRateLimitKey(endpoint: string): string {
    if (endpoint.includes('/chat')) return 'groq-chat';
    if (endpoint.includes('/generate')) return 'groq-generate';
    if (endpoint.includes('/analyze')) return 'groq-analyze';
    return 'groq-chat'; // Default
  }

  private async getFallbackResponse(endpoint: string, data: any): Promise<any> {
    console.warn('Using fallback response for Groq AI due to circuit breaker');

    // Provide basic fallback responses based on endpoint
    if (endpoint.includes('/chat')) {
      return {
        id: 'fallback-' + Date.now(),
        object: 'chat.completion',
        created: Date.now(),
        model: 'fallback-model',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Lo siento, el servicio de IA no está disponible en este momento. Por favor, intenta de nuevo más tarde.'
          },
          finish_reason: 'fallback'
        }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      };
    }

    if (endpoint.includes('/generate')) {
      return {
        response: 'El servicio de generación de IA no está disponible. Por favor, contacta al soporte técnico.'
      };
    }

    if (endpoint.includes('/analyze')) {
      return {
        analysis: 'Análisis no disponible - servicio temporalmente fuera de línea.'
      };
    }

    return { error: 'Service temporarily unavailable' };
  }

  private async performProxyRequest(endpoint: string, data: any, cacheKey: string): Promise<any> {
    try {
      // Get authentication token
      let authToken = null;
      try {
        if (auth.currentUser) {
          authToken = await auth.currentUser.getIdToken();
        }
      } catch (error) {
        console.warn('Failed to get authentication token:', error);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add authorization header if token is available
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.proxyUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Proxy request failed:', error);
      throw error;
    }
  }

  // Method to clear cache (useful for testing or forced refresh)
  clearCache(): void {
    this.responseCache.clear();
    this.pendingRequests.clear();
  }

  isConfigured(): boolean {
    return this.isProxyAvailable;
  }

  /**
   * Check if the service is properly secured for production use
   */
  isSecureForProduction(): boolean {
    // With proxy architecture, API calls are secure
    return this.isProxyAvailable;
  }

  /**
   * Get proxy service status
   */
  getProxyStatus(): { available: boolean; url: string } {
    return {
      available: this.isProxyAvailable,
      url: this.proxyUrl
    };
  }

  async chatCompletion(
    messages: GroqMessage[],
    options: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      tools?: any[];
      tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
    } = {}
  ): Promise<GroqResponse> {
    if (!this.isConfigured()) {
      throw new Error('AI proxy service is not available. Please ensure the backend server is running.');
    }

    try {
      const requestData = {
        messages,
        options: {
          model: options.model || 'openai/gpt-oss-120b',
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 4096,
          tools: options.tools,
          tool_choice: options.tool_choice
        }
      };

      const response = await this.makeProxyRequest('/api/ai/groq/chat', requestData);
      return response;
    } catch (error: any) {
      console.error('Error calling AI proxy:', error);

      // Provide user-friendly error messages
      if (error.message?.includes('not available')) {
        throw new Error('AI service is currently unavailable. Please try again later.');
      } else if (error.message?.includes('rate limit')) {
        throw new Error('Too many requests. Please wait a moment before trying again.');
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      } else {
        throw new Error(`AI service error: ${error.message || 'Unknown error'}`);
      }
    }
  }

  async generateResponse(
    input: string,
    instructions?: string,
    options: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      tools?: any[];
      tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
    } = {}
  ): Promise<string> {
    try {
      const requestData = {
        input,
        instructions,
        options: {
          model: options.model || 'openai/gpt-oss-120b',
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 2048,
          tools: options.tools,
          tool_choice: options.tool_choice
        }
      };

      const response = await this.makeProxyRequest('/api/ai/groq/generate', requestData);
      return response.response || '';
    } catch (error: any) {
      console.error('Error generating response:', error);
      throw new Error(`Failed to generate AI response: ${error.message}`);
    }
  }

  async analyzeText(
    text: string,
    analysisType: string,
    context?: string
  ): Promise<string> {
    try {
      const requestData = {
        text,
        analysisType,
        context
      };

      const response = await this.makeProxyRequest('/api/ai/groq/analyze', requestData);
      return response.analysis || '';
    } catch (error: any) {
      console.error('Error analyzing text:', error);
      throw new Error(`Failed to analyze text: ${error.message}`);
    }
  }

  async generateReport(
    data: any,
    reportType: string,
    format: 'text' | 'json' = 'text'
  ): Promise<string> {
    const instructions = `You are a report generator for Blue Dragon Motors workshop management system.
Generate a ${reportType} report based on the provided data.
${format === 'json' ? 'Return the report as valid JSON.' : 'Format the report in a clear, readable structure.'}

Include relevant metrics, trends, and recommendations.`;

    const input = `Data: ${JSON.stringify(data, null, 2)}`;

    return this.generateResponse(input, instructions, {
      temperature: 0.2,
      max_tokens: format === 'json' ? 4096 : 2048
    });
  }

  async getRecommendations(
    context: string,
    area: 'inventory' | 'queue' | 'notifications' | 'administration'
  ): Promise<string> {
    const instructions = `You are an AI assistant for Blue Dragon Motors workshop management.
Provide intelligent recommendations for ${area} management based on the given context.

Consider best practices for motorcycle workshop operations, efficiency, customer satisfaction, and business optimization.
Be specific and actionable in your recommendations.`;

    return this.generateResponse(context, instructions, {
      temperature: 0.4,
      max_tokens: 1536
    });
  }

  async executeCode(
    code: string,
    language: string = 'javascript'
  ): Promise<string> {
    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: `You are a code execution assistant. Execute the provided ${language} code and return the result.`
      },
      {
        role: 'user',
        content: `Execute this ${language} code:\n\n${code}`
      }
    ];

    const response = await this.chatCompletion(messages, {
      model: 'openai/gpt-oss-20b', // Model that supports code execution
      tools: [
        {
          type: 'code_interpreter',
          container: {
            type: 'auto'
          }
        }
      ],
      tool_choice: 'required',
      temperature: 0
    });

    return response.choices[0]?.message?.content || 'Code execution failed';
  }

  async searchWeb(query: string): Promise<string> {
    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: 'You are a web search assistant. Use real-time web search to answer queries accurately.'
      },
      {
        role: 'user',
        content: `Search the web for: ${query}`
      }
    ];

    const response = await this.chatCompletion(messages, {
      model: 'openai/gpt-oss-20b', // Model that supports browser search
      tools: [
        {
          type: 'browser_search'
        }
      ],
      tool_choice: 'required'
    });

    return response.choices[0]?.message?.content || 'Web search failed';
  }

  // Monitoring and health check methods
  getServiceHealth(): {
    proxyAvailable: boolean;
    proxyUrl: string;
    cacheSize: number;
    pendingRequests: number;
    circuitBreakerStats: any;
    rateLimitStats: any;
  } {
    return {
      proxyAvailable: this.isProxyAvailable,
      proxyUrl: this.proxyUrl,
      cacheSize: this.responseCache.size,
      pendingRequests: this.pendingRequests.size,
      circuitBreakerStats: null, // Deprecated - use AIAssistantService
      rateLimitStats: null // Deprecated - use AIAssistantService
    };
  }

  // Method to clear all caches and reset protection services
  resetService(): void {
    this.responseCache.clear();
    this.pendingRequests.clear();
    // Note: Circuit breaker and rate limiter reset is now handled by AIAssistantService
    console.log('GroqService reset completed (deprecated - use AIAssistantService)');
  }

  // Get usage statistics
  getUsageStats(): {
    cacheHits: number;
    cacheMisses: number;
    totalRequests: number;
    averageResponseTime: number;
  } {
    // This would need to be implemented with proper metrics collection
    // For now, return basic stats
    const circuitStats = this.circuitBreaker.getStats('groq-ai');
    return {
      cacheHits: 0, // Would need to track this
      cacheMisses: 0,
      totalRequests: circuitStats?.totalRequests || 0,
      averageResponseTime: 0 // Would need to track response times
    };
  }
}