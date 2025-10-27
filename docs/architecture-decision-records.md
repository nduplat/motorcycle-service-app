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