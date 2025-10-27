Modelo de Costos Proyectado (Post-Implementación)
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