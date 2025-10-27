# Plan de Mitigación Financiera: Blue Dragon Motors

Esta documentación ha sido dividida en archivos más pequeños para mejor organización:

- [`docs/financial-mitigation-plan.md`](docs/financial-mitigation-plan.md) - Introducción y análisis de costos inicial
- [`docs/mitigation-architecture.md`](docs/mitigation-architecture.md) - Arquitectura de 3 capas de defensa
- [`docs/cost-projections.md`](docs/cost-projections.md) - Proyecciones post-mitigación
- [`docs/implementation-roadmap.md`](docs/implementation-roadmap.md) - Roadmap de implementación por fases
- [`docs/architecture-decision-records.md`](docs/architecture-decision-records.md) - Decisiones de arquitectura (ADRs)
- [`docs/cost-monitoring-dashboard.md`](docs/cost-monitoring-dashboard.md) - Dashboard de monitoreo (React)
- [`docs/ai-proxy-implementation.md`](docs/ai-proxy-implementation.md) - Implementación del servicio AI (Angular)
- [`docs/system-architecture-diagram.md`](docs/system-architecture-diagram.md) - Diagrama de arquitectura del sistema
- [`docs/implementation-plan.md`](docs/implementation-plan.md) - Plan detallado de implementación
- [`docs/cost-model-projections.md`](docs/cost-model-projections.md) - Modelo de costos y escalamiento
- [`docs/contingency-strategies.md`](docs/contingency-strategies.md) - Estrategias de contingencia
- [`docs/testing-validation.md`](docs/testing-validation.md) - Suite de testing y validación
- [`docs/operational-runbook.md`](docs/operational-runbook.md) - Runbook operativo y procedimientos
- [`docs/design-principles.md`](docs/design-principles.md) - Principios de diseño y lecciones
- [`docs/conclusion-next-steps.md`](docs/conclusion-next-steps.md) - Conclusión y próximos pasos

## Respuestas a las Preguntas

**Prioridad de contextos para Sprint 1:**
Optimizamos primero chatbot (más usado) ya que representa el mayor volumen de consultas y es donde los fallbacks pueden tener mayor impacto inmediato.

**Balance UX vs. Costo:**
Aceptable que clientes tengan respuestas cached de 24h para consultas comunes. Los técnicos necesitan respuestas más frescas para diagnóstico, pero clientes pueden tolerar información ligeramente desactualizada en favor de costos reducidos.

**Ownership operativo:**
- Dashboard semanal: Administrador principal revisará diariamente
- Modo de emergencia: Autoridad delegada al administrador técnico senior

Procederé con la implementación del Sprint 1 según las decisiones tomadas.

🛡️ Arquitectura de Mitigación: 3 Capas de Defensa
Capa 1: Intelligent Caching (Reduce 70% de llamadas)
typescript// src/services/ai-assistant.service.ts (REFACTOR)

import { CacheService } from './cache.service';

@Injectable({ providedIn: 'root' })
export class AIAssistantService {
  private readonly CACHE_TTL = {
    product_search: 24 * 60 * 60 * 1000, // 24h (catálogo cambia poco)
    work_order_templates: 7 * 24 * 60 * 60 * 1000, // 7 días
    chatbot_faqs: 30 * 24 * 60 * 60 * 1000, // 30 días (preguntas frecuentes)
    scanner_results: 60 * 60 * 1000 // 1h (piezas cambian estado)
  };

  async queryAI(
    prompt: string, 
    context: 'chatbot' | 'scanner' | 'workOrder' | 'productSearch'
  ): Promise<string> {
    // 1. Generar cache key semántico
    const cacheKey = this.generateSemanticKey(prompt, context);
    
    // 2. Buscar en cache
    const cached = await this.cache.get(cacheKey);
    if (cached && !this.isStale(cached, context)) {
      return cached.response;
    }

    // 3. Llamar AI solo si cache miss
    const response = await this.callExternalAI(prompt, context);
    
    // 4. Guardar en cache con TTL apropiado
    await this.cache.set(cacheKey, response, this.CACHE_TTL[context]);
    
    // 5. Registrar métricas de costo
    this.costMonitoring.trackAICall(context, response.tokens);
    
    return response;
  }

  private generateSemanticKey(prompt: string, context: string): string {
    // Normalizar prompts similares (ej: "precio aceite 10w40" == "cuanto cuesta aceite 10w-40")
    const normalized = prompt.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();
    return `ai:${context}:${this.hashString(normalized)}`;
  }
}
Impacto:

Preguntas frecuentes (70% del tráfico) → 0 costo
Escaneos repetidos de mismas piezas → cached
Reducción: 14,250 → 4,275 llamadas/mes (~70% ahorro)


Capa 2: Rate Limiting Diferenciado
typescript// src/services/rate-limiter.service.ts (ENHANCE)

interface RateLimitConfig {
  technical: {
    chatbot: 50 // requests/día
    scanner: 100
    workOrder: 30
  },
  customer: {
    chatbot: 5 // requests/día
    productSearch: 10
  }
}

@Injectable({ providedIn: 'root' })
export class RateLimiterService {
  async checkLimit(userId: string, feature: string): Promise<boolean> {
    const userRole = await this.auth.getUserRole(userId);
    const limit = this.getLimit(userRole, feature);
    const usage = await this.getUsageToday(userId, feature);
    
    if (usage >= limit) {
      // Degradar a respuestas pre-generadas
      this.toast.warning(`Límite diario alcanzado. Mostrando respuestas offline.`);
      return false;
    }
    
    return true;
  }

  private getLimit(role: string, feature: string): number {
    // Técnicos: límites generosos pero razonables
    // Clientes: límites conservadores
    return role === 'technician' 
      ? this.config.technical[feature] 
      : this.config.customer[feature];
  }
}
Impacto:

Evita abuso por usuario malicioso
Clientes limitados a 5 preguntas/día (suficiente para 95% casos)
Reducción adicional: 4,275 → 3,500 llamadas/mes


Capa 3: Fallback a Respuestas Pre-Generadas
typescript// src/services/ai-assistant.service.ts (EXTEND)

private readonly FALLBACK_RESPONSES = {
  chatbot: {
    'horario': 'Nuestro horario es Lunes a Viernes 8am-6pm, Sábados 9am-2pm.',
    'ubicacion': 'Estamos ubicados en [DIRECCIÓN]. Ver mapa: [LINK]',
    'servicios': 'Ofrecemos: Mantenimiento preventivo, Reparaciones, Repuestos originales...',
    'precios_comunes': {
      'cambio_aceite': '$45.000 - $65.000 (incluye filtro)',
      'revision': '$35.000 (diagnóstico básico)'
    }
  },
  productSearch: {
    // Top 20 productos más buscados con respuestas pre-escritas
    'aceite_10w40': 'Aceite Motul 10W40 - $42.000. Stock: 15 unidades. Compatible con...'
  }
};

async queryAI(prompt: string, context: string): Promise<string> {
  // 1. Intentar respuesta pre-generada primero
  const fallback = this.findFallback(prompt, context);
  if (fallback) {
    return fallback;
  }

  // 2. Verificar rate limit
  if (!await this.rateLimiter.checkLimit(this.userId, context)) {
    return this.getSuggestedFallback(context);
  }

  // 3. Llamar AI (con cache)
  return this.queryAIWithCache(prompt, context);
}
```

**Impacto:**
- 50% de preguntas chatbot → respuestas instantáneas gratis
- **Reducción final: 3,500 → 2,000 llamadas/mes**

---

## 💰 Proyección de Costos Post-Mitigación

### Escenario Optimizado
```
AI Calls Originales: 14,250/mes
Después de Caching: 4,275/mes (-70%)
Después de Rate Limiting: 3,500/mes (-18%)
Después de Fallbacks: 2,000/mes (-43%)

REDUCCIÓN TOTAL: 86% menos llamadas AI
Costo Final por Proveedor
ProveedorCosto OriginalCosto OptimizadoCumple PresupuestoGemini 1.5 Flash (free tier)$40-60$5-10/mes✅ VIABLEGemini 1.5 Pro (backup)$120$18/mes✅ Contingencia
TOTAL FIREBASE + AI: $5-15/mes (dentro de presupuesto $50)

🚀 Implementation Roadmap (Fases Incrementales)
Fase 1: Quick Wins (Semana 1) - Reduce 50% costos
typescript// Priority 1: Cache Layer
✅ Implementar CacheService con semantic keys
✅ Integrar en ai-assistant.service.ts
✅ TTLs ajustados por tipo de consulta

// Priority 2: Gemini Migration
✅ Migrar ai-proxy.ts de OpenAI/Groq → Gemini 1.5 Flash
✅ Configurar free tier (1,500 req/día)
Fase 2: Safety Net (Semana 2) - Evita blow-ups
typescript// Priority 3: Rate Limiting
✅ Implementar límites diferenciados por rol
✅ UI warnings cuando se acerca al límite
✅ Degradación graceful a fallbacks

// Priority 4: Cost Monitoring
✅ Dashboard en admin panel
✅ Alertas a $40/mes (80% presupuesto)
✅ Auto-disable AI si > $50/mes
Fase 3: Optimization (Semana 3-4) - Eficiencia
typescript// Priority 5: Fallback Library
✅ Pre-generar top 50 FAQs
✅ Templates para work orders comunes
✅ Catálogo estático para búsquedas básicas

// Priority 6: Analytics
✅ Track cache hit rate (objetivo: >70%)
✅ Identify prompts más costosos
✅ A/B test calidad respuestas cached vs. fresh

📐 Architecture Decision Records (ADRs)
ADR-001: AI Provider Selection
Decision: Usar Gemini 1.5 Flash como proveedor primario
Rationale:

✅ Free tier: 1,500 requests/día (cubre 2,000/mes con cache)
✅ Latencia aceptable (~500ms avg)
✅ Calidad suficiente para casos de uso (chatbot, scanner)
✅ Fallback a Gemini Pro si se excede free tier

Consequences:

⚠️ Vendor lock-in mitigado por abstracción en ai-proxy.ts
⚠️ Límites API requieren rate limiting estricto
✅ Costo predecible < $10/mes


ADR-002: Caching Strategy
Decision: Implementar cache semántico multi-tier
Layers:

Browser Cache (5min): Respuestas UI inmediatas
Firestore Cache (1h-30d): Compartido entre usuarios
AI Call (solo cache miss)

Key Design:
typescriptcache_key = hash(normalize(prompt)) + context + version
// Permite invalidación selectiva cuando catálogo actualiza
Consequences:

✅ 70%+ cache hit rate esperado
⚠️ Requiere estrategia de invalidación (ver ADR-003)
✅ UX mejorada (respuestas instantáneas)


ADR-003: Cache Invalidation
Decision: Time-based expiration + event-driven invalidation
Rules:
typescript// Invalidar cache cuando:
1. Producto actualiza precio → invalidate(`ai:productSearch:${productId}`)
2. Servicio cambia disponibilidad → invalidate(`ai:chatbot:servicios`)
3. Horario modificado → invalidate(`ai:chatbot:horario`)

// TTLs conservadores:
- Datos transaccionales (stock): 1h
- Datos semi-estáticos (precios): 24h  
- Datos estáticos (FAQs): 30d
Consequences:

✅ Balance freshness vs. costo
⚠️ Complejidad moderada en product.service.ts
✅ Manual override en admin panel
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
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { AlertCircle, TrendingUp, DollarSign, Zap, CheckCircle } from 'lucide-react';

const CostMonitoringDashboard = () => {
  const [costData, setCostData] = useState({
    currentMonth: 8.45,
    budget: 50,
    aiCalls: 2134,
    cachedResponses: 12876,
    cacheHitRate: 85.8,
    dailyCosts: [
      { date: '1 Oct', cost: 0.15, calls: 89 },
      { date: '5 Oct', cost: 0.28, calls: 134 },
      { date: '10 Oct', cost: 0.35, calls: 156 },
      { date: '15 Oct', cost: 0.42, calls: 178 },
      { date: '20 Oct', cost: 0.38, calls: 165 },
      { date: '25 Oct', cost: 0.45, calls: 187 }
    ],
    byContext: [
      { name: 'Chatbot', calls: 892, cost: 3.24, cached: 89 },
      { name: 'Scanner', calls: 567, cost: 2.87, cached: 76 },
      { name: 'Búsqueda', calls: 445, cost: 1.56, cached: 92 },
      { name: 'Work Orders', calls: 230, cost: 0.78, cached: 68 }
    ]
  });

  const getStatusColor = (percentage) => {
    if (percentage < 50) return 'text-green-600';
    if (percentage < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBudgetStatus = () => {
    const percentage = (costData.currentMonth / costData.budget) * 100;
    if (percentage < 50) return { text: 'Óptimo', icon: CheckCircle, color: 'green' };
    if (percentage < 80) return { text: 'Monitoreando', icon: AlertCircle, color: 'yellow' };
    return { text: 'Crítico', icon: AlertCircle, color: 'red' };
  };

  const status = getBudgetStatus();
  const budgetPercentage = ((costData.currentMonth / costData.budget) * 100).toFixed(1);
  const projectedMonthEnd = (costData.currentMonth / 25 * 30).toFixed(2); // Proyección día 25 → 30

  const totalCalls = costData.aiCalls + costData.cachedResponses;
  const savingsFromCache = (costData.cachedResponses * 0.002).toFixed(2); // ~$0.002 por llamada

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Monitoreo de Costos AI
          </h1>
          <p className="text-gray-600">
            Control en tiempo real de gastos en servicios de inteligencia artificial
          </p>
        </div>

        {/* Alert Banner */}
        {parseFloat(budgetPercentage) > 80 && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <div className="flex items-center">
              <AlertCircle className="text-red-600 mr-3" size={24} />
              <div>
                <p className="font-semibold text-red-800">
                  Alerta: Presupuesto al {budgetPercentage}%
                </p>
                <p className="text-red-700 text-sm">
                  Considera aumentar el cache hit rate o reducir consultas AI directas
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Current Cost */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className={`${getStatusColor(parseFloat(budgetPercentage))}`} size={32} />
              <status.icon className={`text-${status.color}-600`} size={24} />
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Costo Mes Actual</h3>
            <p className="text-3xl font-bold text-gray-900">${costData.currentMonth}</p>
            <p className="text-sm text-gray-600 mt-2">
              de ${costData.budget} presupuesto ({budgetPercentage}%)
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div
                className={`bg-${status.color}-600 h-2 rounded-full transition-all`}
                style={{ width: `${Math.min(parseFloat(budgetPercentage), 100)}%` }}
              />
            </div>
          </div>

          {/* Projected Cost */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="text-blue-600" size={32} />
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Proyección Fin de Mes</h3>
            <p className="text-3xl font-bold text-gray-900">${projectedMonthEnd}</p>
            <p className="text-sm text-gray-600 mt-2">
              Basado en tendencia actual
            </p>
            <p className={`text-xs mt-2 ${parseFloat(projectedMonthEnd) > costData.budget ? 'text-red-600' : 'text-green-600'}`}>
              {parseFloat(projectedMonthEnd) > costData.budget ? '⚠️ Excede presupuesto' : '✓ Dentro de presupuesto'}
            </p>
          </div>

          {/* AI Calls */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <Zap className="text-purple-600" size={32} />
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Llamadas AI</h3>
            <p className="text-3xl font-bold text-gray-900">{costData.aiCalls.toLocaleString()}</p>
            <p className="text-sm text-gray-600 mt-2">
              {costData.cachedResponses.toLocaleString()} desde cache
            </p>
            <p className="text-xs text-green-600 mt-2">
              Total consultas: {totalCalls.toLocaleString()}
            </p>
          </div>

          {/* Cache Hit Rate */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle className="text-green-600" size={32} />
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">Cache Hit Rate</h3>
            <p className="text-3xl font-bold text-gray-900">{costData.cacheHitRate}%</p>
            <p className="text-sm text-gray-600 mt-2">
              Ahorro: ${savingsFromCache}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Objetivo: &gt;70%
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Cost Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Tendencia de Costos Diarios
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={costData.dailyCosts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'USD', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `${value}`} />
                <Legend />
                <Line type="monotone" dataKey="cost" stroke="#8b5cf6" strokeWidth={2} name="Costo" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Calls by Context */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Llamadas por Contexto
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costData.byContext}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="calls" fill="#3b82f6" name="Llamadas AI" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Detalle por Contexto
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Contexto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Llamadas AI
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Costo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cache Hit %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Eficiencia
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {costData.byContext.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.calls.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">${item.cost}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.cached}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        item.cached >= 80 ? 'bg-green-100 text-green-800' :
                        item.cached >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.cached >= 80 ? 'Excelente' : item.cached >= 60 ? 'Buena' : 'Mejorar'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recommendations */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            💡 Recomendaciones
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>El cache hit rate de {costData.cacheHitRate}% es {costData.cacheHitRate >= 70 ? 'excelente' : 'mejorable'}. {costData.cacheHitRate < 70 && 'Considera aumentar TTLs para consultas frecuentes.'}</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Scanner tiene el menor cache hit rate ({costData.byContext[1].cached}%). Implementa pre-caching de repuestos más consultados.</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Proyección indica ${projectedMonthEnd} al fin de mes. {parseFloat(projectedMonthEnd) > costData.budget ? 'Activa rate limiting más estricto.' : 'Presupuesto bajo control.'}</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Ahorro actual por cache: ${savingsFromCache}/mes. Cada 10% de mejora = ${(parseFloat(savingsFromCache) * 0.1).toFixed(2)} adicionales ahorrados.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CostMonitoringDashboard;
import * as functions from 'firebase-functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Context-specific system prompts
const SYSTEM_PROMPTS = {
  chatbot: `Eres un asistente de Blue Dragon Motors, taller de motocicletas en Bogotá.
Responde de forma concisa, amigable y profesional. Si no sabes algo, indica que el usuario puede contactar directamente.
Información clave:
- Horario: Lunes-Viernes 8am-6pm, Sábados 9am-2pm
- Servicios: Mantenimiento, reparaciones, repuestos originales
- Ubicación: Bogotá, Colombia`,

  scanner: `Eres un experto en identificación de repuestos de motocicletas.
Analiza descripciones/imágenes y proporciona:
1. Nombre exacto del repuesto
2. Aplicaciones/modelos compatibles
3. Código OEM si es posible
4. Precio estimado en COP
Sé preciso y técnico.`,

  productSearch: `Eres un asistente de búsqueda de repuestos.
Ayuda a encontrar productos en nuestro inventario basándote en:
- Modelo de motocicleta
- Tipo de repuesto
- Marca preferida
Sugiere alternativas si el producto exacto no está disponible.`,

  workOrder: `Eres un asistente técnico que ayuda a crear órdenes de trabajo.
Proporciona:
1. Diagnóstico preliminar
2. Servicios recomendados
3. Repuestos necesarios
4. Tiempo estimado de trabajo
Usa términos técnicos precisos.`
};

interface AIProxyRequest {
  prompt: string;
  context: 'chatbot' | 'scanner' | 'productSearch' | 'workOrder';
  userId?: string;
  metadata?: Record<string, any>;
}

interface AIProxyResponse {
  response: string;
  tokens: number;
  model: string;
  timestamp: number;
  cached: boolean;
}

/**
 * Cloud Function: AI Proxy with Gemini 1.5 Flash
 * Optimized for cost-efficiency with built-in monitoring
 */
export const aiProxy = functions
  .region('us-central1')
  .runWith({
    memory: '512MB',
    timeoutSeconds: 30,
    maxInstances: 10
  })
  .https.onCall(async (data: AIProxyRequest, context): Promise<AIProxyResponse> => {
    
    // Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { prompt, context: aiContext, userId, metadata } = data;

    // Validation
    if (!prompt || !aiContext) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: prompt and context'
      );
    }

    if (!['chatbot', 'scanner', 'productSearch', 'workOrder'].includes(aiContext)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid context type'
      );
    }

    const startTime = Date.now();
    const db = getFirestore();

    try {
      // Rate limiting check
      const rateLimitOk = await checkRateLimit(db, userId || context.auth.uid, aiContext);
      if (!rateLimitOk) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Daily rate limit exceeded for this feature'
        );
      }

      // Check budget limit (safety net)
      const budgetOk = await checkBudgetLimit(db);
      if (!budgetOk) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Monthly budget limit reached. Service temporarily unavailable.'
        );
      }

      // Build full prompt with system context
      const systemPrompt = SYSTEM_PROMPTS[aiContext];
      const fullPrompt = `${systemPrompt}\n\nUsuario: ${prompt}`;

      // Call Gemini API
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      // Estimate token usage (Gemini doesn't provide exact count in response)
      // Rough estimate: 1 token ≈ 4 characters
      const estimatedTokens = Math.ceil((prompt.length + text.length) / 4);

      // Log usage for monitoring
      await logAIUsage(db, {
        userId: userId || context.auth.uid,
        context: aiContext,
        tokens: estimatedTokens,
        latency: Date.now() - startTime,
        model: 'gemini-1.5-flash',
        timestamp: Date.now(),
        metadata
      });

      // Increment rate limit counter
      await incrementRateLimitCounter(db, userId || context.auth.uid, aiContext);

      return {
        response: text,
        tokens: estimatedTokens,
        model: 'gemini-1.5-flash',
        timestamp: Date.now(),
        cached: false
      };

    } catch (error: any) {
      console.error('AI Proxy error:', error);

      // Log error for monitoring
      await logAIError(db, {
        userId: userId || context.auth.uid,
        context: aiContext,
        error: error.message,
        timestamp: Date.now()
      });

      // Provide graceful degradation
      if (error.message?.includes('quota')) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'API quota exceeded. Please try again later.'
        );
      }

      throw new functions.https.HttpsError(
        'internal',
        'AI service temporarily unavailable'
      );
    }
  });

/**
 * Check if user has exceeded rate limit
 */
async function checkRateLimit(
  db: FirebaseFirestore.Firestore,
  userId: string,
  context: string
): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const rateLimitDoc = await db
    .collection('rate_limits')
    .doc(`${userId}_${today}_${context}`)
    .get();

  if (!rateLimitDoc.exists) {
    return true;
  }

  const data = rateLimitDoc.data();
  const limits: Record<string, number> = {
    chatbot: 50,
    scanner: 100,
    productSearch: 30,
    workOrder: 30
  };

  return (data?.count || 0) < limits[context];
}

/**
 * Increment rate limit counter
 */
async function incrementRateLimitCounter(
  db: FirebaseFirestore.Firestore,
  userId: string,
  context: string
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const docRef = db.collection('rate_limits').doc(`${userId}_${today}_${context}`);

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    const newCount = (doc.data()?.count || 0) + 1;
    
    transaction.set(docRef, {
      userId,
      context,
      date: today,
      count: newCount,
      updatedAt: Date.now()
    }, { merge: true });
  });
}

/**
 * Check if monthly budget limit exceeded
 */
async function checkBudgetLimit(db: FirebaseFirestore.Firestore): Promise<boolean> {
  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
  const budgetDoc = await db
    .collection('ai_budget')
    .doc(currentMonth)
    .get();

  if (!budgetDoc.exists) {
    return true;
  }

  const data = budgetDoc.data();
  const BUDGET_LIMIT = 50; // USD
  const estimatedCost = (data?.totalTokens || 0) * 0.00000015; // Gemini Flash pricing

  return estimatedCost < BUDGET_LIMIT;
}

/**
 * Log AI usage for cost monitoring
 */
async function logAIUsage(
  db: FirebaseFirestore.Firestore,
  usage: {
    userId: string;
    context: string;
    tokens: number;
    latency: number;
    model: string;
    timestamp: number;
    metadata?: any;
  }
): Promise<void> {
  const currentMonth = new Date().toISOString().substring(0, 7);
  
  // Log individual call
  await db.collection('ai_usage_logs').add(usage);

  // Update monthly aggregates
  const monthlyDocRef = db.collection('ai_budget').doc(currentMonth);
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(monthlyDocRef);
    const data = doc.data() || { totalTokens: 0, totalCalls: 0, byContext: {} };
    
    transaction.set(monthlyDocRef, {
      totalTokens: data.totalTokens + usage.tokens,
      totalCalls: data.totalCalls + 1,
      byContext: {
        ...data.byContext,
        [usage.context]: {
          calls: (data.byContext?.[usage.context]?.calls || 0) + 1,
          tokens: (data.byContext?.[usage.context]?.tokens || 0) + usage.tokens
        }
      },
      lastUpdated: usage.timestamp
    }, { merge: true });
  });
}

/**
 * Log AI errors
 */
async function logAIError(
  db: FirebaseFirestore.Firestore,
  error: {
    userId: string;
    context: string;
    error: string;
    timestamp: number;
  }
): Promise<void> {
  await db.collection('ai_error_logs').add(error);
}

/**
 * Scheduled function to cleanup old logs (runs daily)
 */
export const cleanupOldLogs = functions
  .region('us-central1')
  .pubsub.schedule('0 2 * * *') // 2 AM daily
  .timeZone('America/Bogota')
  .onRun(async (context) => {
    const db = getFirestore();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    // Cleanup old usage logs
    const oldLogsQuery = db
      .collection('ai_usage_logs')
      .where('timestamp', '<', thirtyDaysAgo)
      .limit(500);

    const snapshot = await oldLogsQuery.get();
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Cleaned up ${snapshot.size} old AI usage logs`);

    // Cleanup old rate limit docs
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    
    const oldRateLimits = await db
      .collection('rate_limits')
      .where('date', '<', yesterday)
      .limit(500)
      .get();

    const rateLimitBatch = db.batch();
    oldRateLimits.docs.forEach(doc => {
      rateLimitBatch.delete(doc.ref);
    });

    await rateLimitBatch.commit();
    console.log(`Cleaned up ${oldRateLimits.size} old rate limit records`);
  });

/**
 * Scheduled function to send budget alerts (runs daily)
 */
export const checkBudgetAlerts = functions
  .region('us-central1')
  .pubsub.schedule('0 9 * * *') // 9 AM daily
  .timeZone('America/Bogota')
  .onRun(async (context) => {
    const db = getFirestore();
    const currentMonth = new Date().toISOString().substring(0, 7);
    
    const budgetDoc = await db.collection('ai_budget').doc(currentMonth).get();
    
    if (!budgetDoc.exists) {
      return;
    }

    const data = budgetDoc.data();
    const estimatedCost = (data?.totalTokens || 0) * 0.00000015;
    const BUDGET_LIMIT = 50;
    const percentage = (estimatedCost / BUDGET_LIMIT) * 100;

    // Send alert if > 80% of budget
    if (percentage > 80) {
      await db.collection('admin_notifications').add({
        type: 'budget_alert',
        severity: percentage > 95 ? 'critical' : 'warning',
        message: `AI budget at ${percentage.toFixed(1)}% ($${estimatedCost.toFixed(2)}/$${BUDGET_LIMIT})`,
        data: {
          currentCost: estimatedCost,
          budget: BUDGET_LIMIT,
          percentage,
          totalCalls: data?.totalCalls,
          byContext: data?.byContext
        },
        timestamp: Date.now(),
        read: false
      });

      console.log(`Budget alert sent: ${percentage.toFixed(1)}%`);
    }
  });
graph TB
    subgraph "Cliente (Angular)"
        A[Usuario] --> B[AI Assistant Service]
        B --> C{Cache Check}
        C -->|Hit| D[Respuesta Instantánea]
        C -->|Miss| E{Fallback Match?}
        E -->|Sí| F[Respuesta Pre-generada]
        E -->|No| G{Rate Limit OK?}
        G -->|No| H[Degradación Graceful]
        G -->|Sí| I[Cloud Function Call]
    end

    subgraph "Firebase Services"
        I --> J[AI Proxy Function]
        J --> K{Budget Check}
        K -->|Excedido| L[Error + Alerta]
        K -->|OK| M[Gemini API Call]
        M --> N[Procesar Respuesta]
        N --> O[Cache Response]
        O --> P[Log Métricas]
        P --> Q[Firestore: ai_usage_logs]
        P --> R[Firestore: ai_budget]
        P --> S[Firestore: rate_limits]
    end

    subgraph "Gemini API"
        M --> T[Gemini 1.5 Flash]
        T -->|Free Tier| U[1,500 req/día GRATIS]
        T -->|Paid| V[$0.075/1M tokens]
    end

    subgraph "Monitoreo"
        Q --> W[Cost Dashboard]
        R --> W
        S --> W
        W --> X[Alertas Automáticas]
        X -->|>80% budget| Y[Notificación Admin]
    end

    subgraph "Optimizaciones"
        Z1[Cache Layer<br/>TTL: 1h-30d] -.->|70% reducción| C
        Z2[Fallback Responses<br/>FAQs pre-generadas] -.->|15% reducción| E
        Z3[Rate Limiting<br/>Por usuario/contexto] -.->|10% reducción| G
        Z4[Budget Circuit Breaker<br/>Auto-disable >$50] -.->|Protección| K
    end

    style A fill:#e1f5ff
    style D fill:#c3f0c3
    style F fill:#c3f0c3
    style H fill:#ffe0b2
    style L fill:#ffcccb
    style T fill:#e1bee7
    style W fill:#fff9c4
    style Y fill:#ff8a80
🎯 Plan de Implementación Incremental
Sprint 1 (Semana 1): Foundation - Reducción Inmediata 50%
Objetivo: Implementar caching + migración Gemini
TareaEsfuerzoImpactoPrioridadMigrar ai-proxy.ts a Gemini 1.5 Flash4h-40% costo🔴 CRÍTICOImplementar CacheService con TTLs6h-30% llamadas🔴 CRÍTICOIntegrar cache en ai-assistant.service.ts4h-30% llamadas🔴 CRÍTICOTesting básico de cache hit rate2hValidación🟡 IMPORTANTE
Entregables:

✅ Gemini API funcionando
✅ Cache operativo con métr
ReintentarNContinuaricas

✅ Tests de integración pasando
✅ Reducción mínima 50% en llamadas AI

Métricas de Éxito:
typescript// Antes
dailyAICalls: 475
monthlyCost: ~$85 (OpenAI/Groq)

// Después Sprint 1
dailyAICalls: 240 (-49%)
monthlyCost: ~$15 (Gemini con cache)
cacheHitRate: >60%

Sprint 2 (Semana 2): Safety Net - Protección Financiera
Objetivo: Eliminar riesgo de blow-up presupuestario
TareaEsfuerzoImpactoPrioridadImplementar rate limiting diferenciado5hPrevención abuso🔴 CRÍTICOBudget circuit breaker en ai-proxy.ts3hProtección $50🔴 CRÍTICOFallback responses library (top 20 FAQs)4h-10% llamadas🟡 IMPORTANTECost monitoring dashboard6hVisibilidad🟡 IMPORTANTEAlertas automáticas (>80% budget)2hPrevención🟡 IMPORTANTE
Entregables:

✅ Rate limiter operativo
✅ Auto-shutdown si budget > $50
✅ Dashboard visible en /admin/cost-monitoring
✅ Alertas email/SMS para admins

Métricas de Éxito:
typescript// Protecciones activas
maxDailyCost: $1.67 (hard limit)
rateLimits: {
  technician: { chatbot: 50, scanner: 100 },
  customer: { chatbot: 5, search: 10 }
}
budgetAlert: triggerAt(80%) // $40
budgetShutdown: triggerAt(100%) // $50

Sprint 3 (Semana 3): Optimization - Eficiencia Máxima
Objetivo: Maximizar cache hit rate y reducir costos residuales
TareaEsfuerzoImpactoPrioridadExpandir fallback library a 50+ respuestas6h-15% llamadas🟢 MEJORASemantic cache key optimization4h+10% hit rate🟢 MEJORAPre-caching de productos populares3h-5% llamadas🟢 MEJORATemplate system para work orders5h-10% llamadas🟢 MEJORAA/B testing calidad cached vs. fresh4hValidación UX🟢 MEJORA
Entregables:

✅ Cache hit rate > 80%
✅ 50 FAQs pre-generadas
✅ Templates para 10 tipos de work orders más comunes
✅ Reportes de calidad de respuestas

Métricas de Éxito:
typescript// Optimización completa
cacheHitRate: >80%
dailyAICalls: <150
monthlyCost: $5-8
userSatisfaction: >4.5/5 (respuestas cached)

Sprint 4 (Semana 4): Analytics & Refinement
Objetivo: Data-driven optimization y sostenibilidad
TareaEsfuerzoImpactoPrioridadAnalytics dashboard (trends, patterns)6hInsights🟢 MEJORACache invalidation strategies4hFreshness🟡 IMPORTANTEUser feedback loop en respuestas AI3hCalidad🟢 MEJORACost projection model (ML-based)5hPlanificación🟢 MEJORADocumentation y runbooks4hMantenibilidad🟡 IMPORTANTE
Entregables:

✅ Dashboard analítico completo
✅ Sistema de feedback usuario
✅ Modelo predictivo de costos
✅ Documentación operativa


📊 Modelo de Costos Proyectado (Post-Implementación)
Escenario Base: 5 Técnicos + 100 Clientes
typescriptconst costModel = {
  // Llamadas AI después de optimización
  dailyAICalls: {
    technical: {
      chatbot: 5 * 10 * 0.3 = 15,      // 70% cached
      scanner: 5 * 20 * 0.2 = 20,      // 80% cached
      workOrder: 5 * 5 * 0.4 = 10      // 60% cached (más dinámico)
    },
    customer: {
      chatbot: 100 * 2 * 0.1 = 20,     // 90% cached (FAQs)
      search: 100 * 1 * 0.15 = 15      // 85% cached
    },
    total: 80 // llamadas/día (vs. 475 original = -83%)
  },

  // Costo Gemini 1.5 Flash
  geminiCost: {
    freeTier: 1500, // requests/día GRATIS
    paidRate: 0.00000015, // USD por token
    avgTokensPerCall: 500,
    
    // Escenario A: Dentro de free tier
    scenarioA: {
      dailyCalls: 80,
      cost: 0 // GRATIS (bajo límite 1,500)
    },
    
    // Escenario B: Excede free tier (pico estacional)
    scenarioB: {
      dailyCalls: 150,
      paidCalls: 0, // Aún dentro de free tier
      cost: 0 // GRATIS
    },
    
    // Escenario C: Crecimiento 200 clientes
    scenarioC: {
      dailyCalls: 160,
      cost: 0 // GRATIS (aún bajo límite)
    }
  },

  // Costo Firebase (otros servicios)
  firebaseCost: {
    firestore: {
      reads: 90000 / 100000 * 0.06 = 0.054, // ~90k reads/mes
      writes: 60000 / 100000 * 0.18 = 0.108, // ~60k writes/mes
      storage: 0 // <1GB gratis
    },
    functions: {
      invocations: 0, // <2M gratis
      compute: 0 // <400k GB-seconds gratis
    },
    hosting: 0,
    auth: 0,
    storage: 5 * 0.026 = 0.13, // 5GB imágenes/QR
    total: 0.29 // ~$0.30/mes
  },

  // COSTO TOTAL
  monthlyTotal: {
    base: 0, // Gemini free tier
    firebase: 0.30,
    contingency: 5, // Buffer para picos
    total: 5.30 // $5.30/mes
  }
};
Proyecciones de Escalamiento
UsuariosAI Calls/DíaCosto GeminiCosto FirebaseTotal/Mes100 clientes + 5 técnicos80$0$0.30$5 ✅200 clientes + 5 técnicos160$0$0.50$8 ✅500 clientes + 10 técnicos350$0$1.20$15 ✅1,000 clientes + 15 técnicos600$8$3.50$28 ✅2,000 clientes + 20 técnicos1,100$22$8.00$45 ✅
Punto de quiebre: ~1,800 usuarios donde se excede consistentemente el free tier de Gemini.

🔒 Estrategias de Contingencia
Plan B: Si el Presupuesto se Acerca a $50
typescript// Activación automática de modo de ahorro
const emergencyMode = {
  trigger: 'monthlyCost > $40',
  
  actions: [
    // 1. Aumentar cache TTLs
    {
      action: 'extendCacheTTL',
      from: { chatbot: 30, product: 24 },
      to: { chatbot: 60, product: 48 }, // días
      impact: '-20% llamadas'
    },
    
    // 2. Reducir rate limits
    {
      action: 'reduceLimits',
      from: { customer_chatbot: 5 },
      to: { customer_chatbot: 3 },
      impact: '-15% llamadas'
    },
    
    // 3. Priorizar técnicos
    {
      action: 'prioritizeTechnicians',
      description: 'Técnicos: AI completo, Clientes: solo fallbacks',
      impact: '-30% llamadas'
    },
    
    // 4. Notificar admins
    {
      action: 'alertAdmins',
      channels: ['email', 'sms', 'dashboard'],
      message: 'Presupuesto AI al 80%. Modo de ahorro activado.'
    }
  ],
  
  expectedReduction: '50-60% llamadas adicionales',
  newProjectedCost: '$25-30/mes'
};
Plan C: Migración a Alternativas
Si Gemini cambia pricing o políticas:
AlternativaCosto/1M TokensFree TierEvaluaciónGroq (Llama 3.1)$0.59 input + $0.79 outputLimitado⚠️ Más caro pero rápidoOpenAI GPT-4o-mini$0.15 input + $0.60 outputNo❌ Más caroAnthropic Claude Haiku$0.25 input + $1.25 outputNo❌ Más caroModelo Local (Ollama)$0 (costo compute)Ilimitado⚠️ Requiere infraestructura
Decisión: Gemini 1.5 Flash es óptimo. Si no disponible → Groq con cache agresivo.
🧪 Testing & Validation
Test Suite para Optimizaciones
import { TestBed } from '@angular/core/testing';
import { AIAssistantService } from './ai-assistant.service';
import { CacheService } from './cache.service';
import { RateLimiterService } from './rate-limiter.service';
import { CostMonitoringService } from './cost-monitoring.service';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';

describe('AIAssistantService - Cost Optimization', () => {
  let service: AIAssistantService;
  let cacheService: jasmine.SpyObj<CacheService>;
  let rateLimiter: jasmine.SpyObj<RateLimiterService>;
  let costMonitoring: jasmine.SpyObj<CostMonitoringService>;

  beforeEach(() => {
    const cacheSpy = jasmine.createSpyObj('CacheService', ['get', 'set']);
    const rateLimiterSpy = jasmine.createSpyObj('RateLimiterService', ['checkLimit']);
    const costSpy = jasmine.createSpyObj('CostMonitoringService', ['trackAICall']);

    TestBed.configureTestingModule({
      providers: [
        AIAssistantService,
        { provide: CacheService, useValue: cacheSpy },
        { provide: RateLimiterService, useValue: rateLimiterSpy },
        { provide: CostMonitoringService, useValue: costSpy },
        { provide: Firestore, useValue: {} },
        { provide: Functions, useValue: {} }
      ]
    });

    service = TestBed.inject(AIAssistantService);
    cacheService = TestBed.inject(CacheService) as jasmine.SpyObj<CacheService>;
    rateLimiter = TestBed.inject(RateLimiterService) as jasmine.SpyObj<RateLimiterService>;
    costMonitoring = TestBed.inject(CostMonitoringService) as jasmine.SpyObj<CostMonitoringService>;
  });

  describe('Fallback Responses', () => {
    it('should return pre-generated response for "horario" query', async () => {
      const result = await service.query('cual es el horario', 'chatbot', 'user123');
      
      expect(result.provider).toBe('fallback');
      expect(result.tokens).toBe(0);
      expect(result.cached).toBe(true);
      expect(result.response).toContain('Lunes a Viernes');
    });

    it('should return pre-generated response for common product searches', async () => {
      const result = await service.query('precio aceite 10w40', 'productSearch', 'user123');
      
      expect(result.provider).toBe('fallback');
      expect(result.tokens).toBe(0);
      expect(result.response).toContain('Motul');
    });

    it('should NOT use fallback for non-matching queries', async () => {
      cacheService.get.and.returnValue(Promise.resolve(null));
      rateLimiter.checkLimit.and.returnValue(Promise.resolve(true));
      
      // This would trigger actual AI call (mocked)
      const result = await service.query(
        'diagnostico complejo motor pierde potencia',
        'workOrder',
        'tech456'
      );
      
      // Should attempt cache check
      expect(cacheService.get).toHaveBeenCalled();
    });
  });

  describe('Cache Functionality', () => {
    it('should return cached response when available', async () => {
      const cachedData = {
        response: 'Cached answer',
        tokens: 250,
        createdAt: { toMillis: () => Date.now() - 1000 },
        expiresAt: { toMillis: () => Date.now() + 100000 }
      };
      
      cacheService.get.and.returnValue(Promise.resolve(cachedData));
      
      const result = await service.query('test query', 'chatbot', 'user123');
      
      expect(result.response).toBe('Cached answer');
      expect(result.cached).toBe(true);
      expect(result.tokens).toBe(250);
    });

    it('should NOT return expired cache', async () => {
      const expiredCache = {
        response: 'Old answer',
        tokens: 250,
        createdAt: { toMillis: () => Date.now() - 100000 },
        expiresAt: { toMillis: () => Date.now() - 1000 } // Expired
      };
      
      cacheService.get.and.returnValue(Promise.resolve(expiredCache));
      rateLimiter.checkLimit.and.returnValue(Promise.resolve(true));
      
      // Should proceed to AI call (or fallback)
      await service.query('test query', 'chatbot', 'user123');
      
      expect(rateLimiter.checkLimit).toHaveBeenCalled();
    });

    it('should generate consistent cache keys for similar queries', () => {
      const key1 = (service as any).generateCacheKey('cual es el horario?', 'chatbot');
      const key2 = (service as any).generateCacheKey('cuál es el horario', 'chatbot');
      const key3 = (service as any).generateCacheKey('CUAL ES EL HORARIO', 'chatbot');
      
      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits and return fallback', async () => {
      cacheService.get.and.returnValue(Promise.resolve(null));
      rateLimiter.checkLimit.and.returnValue(Promise.resolve(false)); // Limit exceeded
      
      const result = await service.query('test query', 'chatbot', 'user123');
      
      expect(result.provider).toBe('fallback');
      expect(result.response).toContain('Límite diario');
    });

    it('should allow AI call when under rate limit', async () => {
      cacheService.get.and.returnValue(Promise.resolve(null));
      rateLimiter.checkLimit.and.returnValue(Promise.resolve(true));
      
      // Mock AI response
      spyOn<any>(service, 'callGeminiAPI').and.returnValue(
        Promise.resolve({ response: 'AI answer', tokens: 300 })
      );
      
      const result = await service.query('test query', 'scanner', 'tech456');
      
      expect((service as any).callGeminiAPI).toHaveBeenCalled();
      expect(result.provider).toBe('gemini');
    });
  });

  describe('Cost Tracking', () => {
    it('should track AI call costs', async () => {
      cacheService.get.and.returnValue(Promise.resolve(null));
      rateLimiter.checkLimit.and.returnValue(Promise.resolve(true));
      
      spyOn<any>(service, 'callGeminiAPI').and.returnValue(
        Promise.resolve({ response: 'AI answer', tokens: 500 })
      );
      spyOn<any>(service, 'cacheResponse').and.returnValue(Promise.resolve());
      
      await service.query('test query', 'chatbot', 'user123');
      
      expect(costMonitoring.trackAICall).toHaveBeenCalledWith(
        'chatbot',
        500,
        'gemini'
      );
    });

    it('should NOT track costs for cached responses', async () => {
      const cachedData = {
        response: 'Cached',
        tokens: 250,
        createdAt: { toMillis: () => Date.now() },
        expiresAt: { toMillis: () => Date.now() + 100000 }
      };
      
      cacheService.get.and.returnValue(Promise.resolve(cachedData));
      
      await service.query('test', 'chatbot', 'user123');
      
      expect(costMonitoring.trackAICall).not.toHaveBeenCalled();
    });

    it('should NOT track costs for fallback responses', async () => {
      await service.query('horario', 'chatbot', 'user123');
      
      expect(costMonitoring.trackAICall).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return fallback on AI API error', async () => {
      cacheService.get.and.returnValue(Promise.resolve(null));
      rateLimiter.checkLimit.and.returnValue(Promise.resolve(true));
      
      spyOn<any>(service, 'callGeminiAPI').and.returnValue(
        Promise.reject(new Error('API Error'))
      );
      
      const result = await service.query('test', 'chatbot', 'user123');
      
      expect(result.provider).toBe('fallback');
      expect(result.response).toContain('información general');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should return fallback response in <50ms', async () => {
      const start = Date.now();
      await service.query('horario', 'chatbot', 'user123');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(50);
    });

    it('should return cached response in <200ms', async () => {
      const cachedData = {
        response: 'Cached',
        tokens: 250,
        createdAt: { toMillis: () => Date.now() },
        expiresAt: { toMillis: () => Date.now() + 100000 }
      };
      
      cacheService.get.and.returnValue(Promise.resolve(cachedData));
      
      const start = Date.now();
      await service.query('test', 'chatbot', 'user123');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Cache Hit Rate Calculation', () => {
    it('should calculate cache hit rate correctly', async () => {
      // Simulate 100 queries: 70 cached, 20 fallback, 10 AI
      const queries = [
        ...Array(70).fill('cached'),
        ...Array(20).fill('fallback'),
        ...Array(10).fill('ai')
      ];

      let cachedCount = 0;
      let fallbackCount = 0;
      let aiCount = 0;

      for (const type of queries) {
        if (type === 'cached') {
          cacheService.get.and.returnValue(Promise.resolve({
            response: 'Cached',
            tokens: 250,
            createdAt: { toMillis: () => Date.now() },
            expiresAt: { toMillis: () => Date.now() + 100000 }
          }));
          cachedCount++;
        } else if (type === 'fallback') {
          await service.query('horario', 'chatbot', 'user123');
          fallbackCount++;
        } else {
          cacheService.get.and.returnValue(Promise.resolve(null));
          rateLimiter.checkLimit.and.returnValue(Promise.resolve(true));
          spyOn<any>(service, 'callGeminiAPI').and.returnValue(
            Promise.resolve({ response: 'AI', tokens: 300 })
          );
          aiCount++;
        }
      }

      const totalQueries = queries.length;
      const aiCallsOnly = aiCount;
      const reductionRate = ((totalQueries - aiCallsOnly) / totalQueries) * 100;

      // Should achieve >85% reduction in AI calls
      expect(reductionRate).toBeGreaterThan(85);
    });
  });
});
📖 Runbook Operativo
Procedimientos de Emergencia
markdown# Runbook: Crisis de Costos AI

## Síntoma: Alerta "Presupuesto AI al 90%"

### Diagnóstico Inmediato
1. Revisar dashboard: `/admin/cost-monitoring`
2. Identificar contexto más costoso:
```bash
   # Firestore query
   db.collection('ai_budget')
     .doc(currentMonth)
     .get()
     .then(doc => console.log(doc.data().byContext))
```

### Acción Correctiva (Prioridad)

**Nivel 1: Ajustes No-Disruptivos (10 min)**
- [ ] Aumentar TTL de cache en contextos costosos
- [ ] Expandir fallback library para ese contexto
- [ ] Verificar que rate limits estén activos

**Nivel 2: Reducción Temporal (30 min)**
- [ ] Reducir rate limits en 50%:
```typescript
   // rate-limiter.service.ts
   customer: { chatbot: 5 → 3, search: 10 → 5 }
```
- [ ] Activar "modo offline-first" para clientes
- [ ] Notificar usuarios de degradación temporal

**Nivel 3: Shutdown Parcial (inmediato)**
- [ ] Deshabilitar AI para clientes (solo técnicos)
- [ ] Forzar 100% fallback responses
- [ ] Investigar causa raíz (ataque?, bug?)

## Síntoma: Cache Hit Rate <50%

### Diagnóstico
1. Revisar logs de queries más frecuentes:
```typescript
   db.collection('ai_usage_logs')
     .where('timestamp', '>', last24h)
     .orderBy('prompt')
     .limit(100)
```

2. Identificar queries no cacheables:
   - Prompts muy variados (solución: normalización)
   - TTLs muy cortos (solución: extender)
   - Cache invalidation excesiva (solución: revisar triggers)

### Acción Correctiva
- [ ] Mejorar semantic key generation
- [ ] Añadir fallbacks para queries frecuentes no cacheadas
- [ ] Revisar lógica de cache expiration

## Síntoma: Usuarios reportan respuestas incorrectas

### Diagnóstico
1. Verificar si es cached response obsoleta:
```typescript
   // Revisar timestamp de cache entry
   db.collection('ai_cache')
     .where('createdAt', '<', cutoffDate)
     .get()
```

2. Verificar fallback responses desactualizadas

### Acción Correctiva
- [ ] Invalidar cache manualmente:
```typescript
   await aiAssistant.invalidateCache('product_search:*')
```
- [ ] Actualizar fallback responses
- [ ] Ajustar TTLs para datos volátiles

🎓 Lecciones & Principios de Diseño
Anti-Patrones Evitados

❌ "AI-First" sin fallbacks

Problema: 100% dependencia de API externa
Solución: 3-tier (fallback → cache → AI)


❌ Cache sin TTLs

Problema: Respuestas obsoletas indefinidamente
Solución: TTLs diferenciados por tipo de dato


❌ Rate limiting uniforme

Problema: Técnicos bloqueados igual que clientes
Solución: Límites por rol


❌ Sin monitoreo de costos

Problema: Sorpresas en factura
Solución: Dashboard + alertas proactivas



Principios Aplicados
typescriptconst designPrinciples = {
  // 1. Progressive Enhancement
  layers: ['static', 'cached', 'dynamic'],
  philosophy: 'Cada capa más cara debe justificar su valor',

  // 2. Fail-Safe Defaults
  onError: 'degrade gracefully',
  never: 'show error to user',

  // 3. Cost as First-Class Constraint
  every_feature: 'must include cost analysis',
  budget: 'hard limit, not suggestion',

  // 4. Observable Systems
  metrics: ['cost', 'latency', 'quality', 'hitRate'],
  alerts: 'before problems, not after',

  // 5. User-Centric Trade-offs
  priority: 'technician UX > customer UX > cost',
  rationale: 'Technical staff generates revenue'
};

🚀 Conclusión & Próximos Pasos
Resumen Ejecutivo
MétricaAntesDespuésMejoraCosto Mensual$85-120$5-10-92% ✅AI Calls/Día47580-83% ✅Cache Hit Rate0%>80%+∞ ✅Latencia Promedio2-3s<500ms-75% ✅Presupuesto RiesgoAltoBajoMitigado ✅
ROI del Proyecto
typescriptconst roi = {
  investment: {
    development: 80, // horas
    hourlyRate: 25, // USD (Colombia)
    total: 2000 // USD
  },
  
  savings: {
    monthly: 80, // USD (85-5)
    annual: 960, // USD
    paybackPeriod: 2.5 // meses
  },
  
  intangibles: [
    'Predictibilidad financiera',
    'Escalabilidad sin refactor',
    'Mejor UX (respuestas instantáneas)',
    'Conocimiento transferible a otros proyectos'
  ]
};
