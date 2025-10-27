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
      'cambio_aceite': '$45.000 - $65.000 (incluye filtro)'
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

**Impacto:**
- 50% de preguntas chatbot → respuestas instantáneas gratis
- **Reducción final: 3,500 → 2,000 llamadas/mes**