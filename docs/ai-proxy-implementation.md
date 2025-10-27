import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, Timestamp } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { CacheService } from './cache.service';
import { RateLimiterService } from './rate-limiter.service';
import { CostMonitoringService } from './cost-monitoring.service';
import { ToastService } from './toast.service';

interface AIResponse {
  response: string;
  tokens: number;
  cached: boolean;
  provider: 'gemini' | 'fallback';
  timestamp: Timestamp;
}

interface CachedResponse {
  response: string;
  tokens: number;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

@Injectable({ providedIn: 'root' })
export class AIAssistantService {
  private firestore = inject(Firestore);
  private functions = inject(Functions);
  private cache = inject(CacheService);
  private rateLimiter = inject(RateLimiterService);
  private costMonitoring = inject(CostMonitoringService);
  private toast = inject(ToastService);

  // TTL Configuration (milliseconds)
  private readonly CACHE_TTL = {
    chatbot_faqs: 30 * 24 * 60 * 60 * 1000,      // 30 días
    product_search: 24 * 60 * 60 * 1000,         // 24 horas
    scanner_results: 60 * 60 * 1000,             // 1 hora
    work_order_templates: 7 * 24 * 60 * 60 * 1000, // 7 días
    general: 6 * 60 * 60 * 1000                  // 6 horas (default)
  };

  // Pre-generated responses for common queries
  private readonly FALLBACK_RESPONSES: Record<string, Record<string, string>> = {
    chatbot: {
      'horario': 'Nuestro horario de atención:\n• Lunes a Viernes: 8:00 AM - 6:00 PM\n• Sábados: 9:00 AM - 2:00 PM\n• Domingos: Cerrado',
      'ubicacion': 'Estamos ubicados en Calle 123 #45-67, Bogotá. Ver mapa: https://maps.app.goo.gl/example',
      'contacto': 'Contáctanos:\n• Teléfono: +57 301 234 5678\n• WhatsApp: +57 301 234 5678\n• Email: info@bluedragonmotors.com',
      'servicios': 'Servicios disponibles:\n• Mantenimiento preventivo\n• Reparaciones mecánicas\n• Reparaciones eléctricas\n• Cambio de aceite y filtros\n• Diagnóstico computarizado\n• Venta de repuestos originales',
      'precio_revision': 'Revisión básica: $35.000 (incluye diagnóstico inicial)',
      'precio_cambio_aceite': 'Cambio de aceite: $45.000 - $65.000 (incluye aceite y filtro)',
      'garantia': 'Todos nuestros servicios tienen 30 días de garantía. Repuestos originales con garantía del fabricante.',
      'metodos_pago': 'Aceptamos: Efectivo, Tarjetas débito/crédito, Transferencias, Nequi, Daviplata',
      'cita': 'Para agendar una cita, usa nuestro sistema en línea o llámanos al +57 301 234 5678'
    },
    productSearch: {
      'aceite_10w40': 'Aceite Motul 5100 10W40 - $42.000\nStock: 15 unidades\nCompatible con mayoría de motos de 4 tiempos',
      'aceite_20w50': 'Aceite Motul 7100 20W50 - $48.000\nStock: 12 unidades\nRecomendado para motos deportivas',
      'filtro_aceite': 'Filtro de aceite genérico - $8.000\nStock: 25 unidades\nVerifica compatibilidad con tu moto',
      'llantas': 'Llantas desde $150.000\nVariedad de marcas: Michelin, Pirelli, IRC\nConsulta disponibilidad para tu modelo',
      'bateria': 'Baterías desde $120.000\nMarcas: Yuasa, Bosch\n12 meses de garantía'
    }
  };

  /**
   * Main entry point for AI queries with full cost optimization
   */
  async query(
    prompt: string,
    context: 'chatbot' | 'scanner' | 'workOrder' | 'productSearch',
    userId: string
  ): Promise<AIResponse> {
    
    // Step 1: Try fallback responses first (free, instant)
    const fallback = this.findFallback(prompt, context);
    if (fallback) {
      return {
        response: fallback,
        tokens: 0,
        cached: true,
        provider: 'fallback',
        timestamp: Timestamp.now()
      };
    }

    // Step 2: Check cache
    const cacheKey = this.generateCacheKey(prompt, context);
    const cached = await this.getCachedResponse(cacheKey);
    if (cached) {
      return {
        response: cached.response,
        tokens: cached.tokens,
        cached: true,
        provider: 'gemini',
        timestamp: Timestamp.now()
      };
    }

    // Step 3: Check rate limit before expensive AI call
    const canProceed = await this.rateLimiter.checkLimit(userId, context);
    if (!canProceed) {
      const suggestion = this.getSuggestedFallback(context);
      this.toast.warning('Límite diario alcanzado. Mostrando información general.');
      return {
        response: suggestion,
        tokens: 0,
        cached: false,
        provider: 'fallback',
        timestamp: Timestamp.now()
      };
    }

    // Step 4: Make AI call (expensive)
    try {
      const aiResponse = await this.callGeminiAPI(prompt, context);
      
      // Step 5: Cache the response
      await this.cacheResponse(cacheKey, aiResponse, context);
      
      // Step 6: Track cost
      await this.costMonitoring.trackAICall(context, aiResponse.tokens, 'gemini');
      
      return {
        response: aiResponse.response,
        tokens: aiResponse.tokens,
        cached: false,
        provider: 'gemini',
        timestamp: Timestamp.now()
      };
    } catch (error) {
      console.error('AI call failed:', error);
      this.toast.error('Error procesando consulta. Mostrando información general.');
      
      // Fallback on error
      return {
        response: this.getSuggestedFallback(context),
        tokens: 0,
        cached: false,
        provider: 'fallback',
        timestamp: Timestamp.now()
      };
    }
  }

  /**
   * Generate semantic cache key
   */
  private generateCacheKey(prompt: string, context: string): string {
    // Normalize prompt for semantic matching
    const normalized = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Collapse whitespace
      .trim();
    
    // Hash for consistent key length
    const hash = this.simpleHash(normalized);
    return `ai_cache:${context}:${hash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Find pre-generated fallback response
   */
  private findFallback(prompt: string, context: string): string | null {
    const normalized = prompt.toLowerCase();
    const contextFallbacks = this.FALLBACK_RESPONSES[context];
    
    if (!contextFallbacks) return null;

    // Exact keyword matching
    for (const [keyword, response] of Object.entries(contextFallbacks)) {
      if (normalized.includes(keyword.replace(/_/g, ' '))) {
        return response;
      }
    }

    return null;
  }

  /**
   * Get suggested fallback when rate limited
   */
  private getSuggestedFallback(context: string): string {
    const suggestions: Record<string, string> = {
      chatbot: 'Para información general, consulta nuestras preguntas frecuentes en el menú principal o llámanos al +57 301 234 5678.',
      productSearch: 'Consulta nuestro catálogo completo en la sección "Repuestos" o contacta a un asesor.',
      scanner: 'El escáner IA tiene un límite diario. Intenta buscar el repuesto manualmente en el inventario.',
      workOrder: 'Crea la orden manualmente o consulta las plantillas disponibles en el sistema.'
    };
    
    return suggestions[context] || 'Servicio temporalmente no disponible. Intenta nuevamente más tarde.';
  }

  /**
   * Retrieve cached response
   */
  private async getCachedResponse(cacheKey: string): Promise<CachedResponse | null> {
    try {
      const docRef = doc(this.firestore, 'ai_cache', cacheKey);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) return null;
      
      const cached = docSnap.data() as CachedResponse;
      
      // Check if expired
      const now = Timestamp.now();
      if (cached.expiresAt.toMillis() < now.toMillis()) {
        return null;
      }
      
      return cached;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Cache AI response
   */
  private async cacheResponse(
    cacheKey: string,
    response: { response: string; tokens: number },
    context: string
  ): Promise<void> {
    try {
      const ttl = this.CACHE_TTL[context] || this.CACHE_TTL.general;
      const now = Timestamp.now();
      const expiresAt = Timestamp.fromMillis(now.toMillis() + ttl);
      
      const docRef = doc(this.firestore, 'ai_cache', cacheKey);
      await setDoc(docRef, {
        response: response.response,
        tokens: response.tokens,
        createdAt: now,
        expiresAt: expiresAt
      });
    } catch (error) {
      console.error('Cache storage error:', error);
      // Non-blocking error
    }
  }

  /**
   * Call Gemini API via Cloud Function
   */
  private async callGeminiAPI(
    prompt: string,
    context: string
  ): Promise<{ response: string; tokens: number }> {
    const callAIProxy = httpsCallable<
      { prompt: string; context: string },
      { response: string; tokens: number }
    >(this.functions, 'aiProxy');
    
    const result = await callAIProxy({ prompt, context });
    return result.data;
  }

  /**
   * Invalidate cache for specific context (called when data updates)
   */
  async invalidateCache(pattern: string): Promise<void> {
    // This would require a more sophisticated cache management system
    // For now, TTLs handle expiration
    console.log(`Cache invalidation requested for pattern: ${pattern}`);
  }

  /**
   * Get cache statistics (for admin dashboard)
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    hitRate: number;
    avgTokensSaved: number;
  }> {
    // Implementation would query analytics collection
    return {
      totalEntries: 0,
      hitRate: 0,
      avgTokensSaved: 0
    };
  }
}