Crea SOLO toda la documentación basado en la sgt información y al final responde las preguntas

Plan de Mitigación Financiera: Blue Dragon Motors
Contexto Operacional Crítico: 5 Técnicos + 100 Clientes
Excelente. Este contexto real cambia radicalmente las prioridades. Ahora puedo diseñar una arquitectura pragmática vs. una sobre-ingeniería prematura.

📊 Modelo de Costos Ajustado (Realidad vs. Proyección)
Perfil de Usuario Real
Tipo UsuarioCantidadSesiones/díaRequests/sesiónTotal requests/díaTécnicos58h × 4 sesiones = 3250 writes/reads1,600 opsClientes1001-2 consultas10 reads1,000-2,000 opsTOTAL105--~3,000 ops/día
Cálculo de Costos Firebase (Mensual)
Firestore:
- Reads: 60,000/mes × $0.06/100k = $0.036 ≈ GRATIS (50k free tier)
- Writes: 48,000/mes × $0.18/100k = $0.086 ≈ GRATIS (20k free tier)
- Storage: < 1GB = GRATIS

Cloud Functions (ai-proxy.ts):
- Invocations: ~300 AI calls/día × 30 = 9,000/mes
  - GRATIS (2M free tier)
- Compute time: 9,000 × 2s avg = 18,000s = 5 GB-seconds
  - GRATIS (400k GB-seconds free tier)

Hosting: GRATIS (< 10GB/mes)
Authentication: GRATIS (< 10k MAU)
Storage (imágenes/QR): < 5GB = GRATIS

🚨 ÚNICO COSTO REAL: AI API Externa

🔥 Análisis de Riesgo: AI Proxy
Escenario Actual (Sin Controles)
typescript// functions/src/ai-proxy.ts
// Supuesto: Llamadas directas sin cache

const estimatedAICalls = {
  technical: {
    chatbot: 5 técnicos × 10 preguntas/día = 50 calls,
    scanner: 5 técnicos × 20 escaneos/día = 100 calls,
    workOrderAssist: 5 técnicos × 5 órdenes/día = 25 calls
  },
  customer: {
    chatbot: 100 clientes × 2 preguntas/día = 200 calls,
    productSearch: 100 clientes × 1 búsqueda/día = 100 calls
  }
}

// TOTAL: ~475 AI calls/día = 14,250/mes
Costo Proyectado por Proveedor
ProveedorModeloCosto/1k tokensCosto Estimado/MesOpenAIGPT-4o-mini$0.150 input + $0.600 output$85-120/mes ❌GroqLlama 3.1 70B$0.59 input + $0.79 output$95/mes ❌Gemini1.5 Flash$0.075 input + $0.30 output$40-60/mes ⚠️Gemini1.5 Flash (free tier)1,500 requests/día gratis$0-15/mes ✅
Conclusión: Solo Gemini 1.5 Flash con free tier cumple presupuesto.