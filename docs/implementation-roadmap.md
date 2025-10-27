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