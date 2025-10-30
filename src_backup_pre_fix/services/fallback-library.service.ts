import { Injectable, inject } from '@angular/core';
import { QueueService } from './queue.service';
import { InventoryReportsService } from './inventory-reports.service';
import { ProductService } from './product.service';

export interface FallbackResponse {
  id: string;
  context: 'chatbot' | 'productSearch' | 'scanner' | 'workOrder';
  query: string;
  response: string;
  category: 'general' | 'inventory' | 'queue' | 'maintenance' | 'pricing' | 'contact' | 'services';
  priority: number; // 1-10, higher = more specific
  keywords: string[];
  dynamicFields?: string[]; // Fields that can be dynamically populated
  lastUsed?: Date;
  successRate?: number;
  usageCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FallbackMatch {
  response: FallbackResponse;
  score: number;
  matchedKeywords: string[];
}

export interface FallbackStats {
  totalResponses: number;
  categories: Record<string, number>;
  avgSuccessRate: number;
  totalUsage: number;
  topResponses: FallbackResponse[];
  contextBreakdown: Record<string, number>;
}

@Injectable({
  providedIn: 'root'
})
export class FallbackLibraryService {
  private queueService = inject(QueueService);
  private inventoryReportsService = inject(InventoryReportsService);
  private productService = inject(ProductService);

  private responses: FallbackResponse[] = [];
  private categories: Record<string, FallbackResponse[]> = {};
  private contextIndex: Record<string, FallbackResponse[]> = {};

  constructor() {
    this.initializeFallbackLibrary();
  }

  /**
   * Initialize the comprehensive fallback library
   */
  private initializeFallbackLibrary(): void {
    this.responses = [
      // CHATBOT CONTEXT - General Information
      {
        id: 'chatbot_horario',
        context: 'chatbot',
        query: 'horario de atención',
        response: '🏪 **Horario de Atención**\n\n• **Lunes a Viernes:** 8:00 AM - 6:00 PM\n• **Sábados:** 9:00 AM - 2:00 PM\n• **Domingos:** Cerrado\n\n📍 Estamos ubicados en Calle 123 #45-67, Bogotá\n\nPara citas fuera del horario, puedes agendar online.',
        category: 'contact',
        priority: 9,
        keywords: ['horario', 'hora', 'atención', 'abierto', 'cerrado', 'tiempo', 'horas'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'chatbot_ubicacion',
        context: 'chatbot',
        query: 'ubicación del taller',
        response: '📍 **Ubicación del Taller**\n\n🏪 **Blue Dragon Motors**\nCalle 123 #45-67\nBogotá, Colombia\n\n🗺️ **Ver en mapa:** [https://maps.app.goo.gl/example](https://maps.app.goo.gl/example)\n\n🚗 Fácil acceso desde la Calle 26 y Avenida Caracas.\n\n📞 **Teléfono:** +57 301 234 5678',
        category: 'contact',
        priority: 9,
        keywords: ['ubicacion', 'direccion', 'donde', 'lugar', 'mapa', 'localizar'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'chatbot_contacto',
        context: 'chatbot',
        query: 'información de contacto',
        response: '📞 **Información de Contacto**\n\n🏪 **Blue Dragon Motors**\n\n📱 **Teléfono/WhatsApp:** +57 301 234 5678\n📧 **Email:** info@bluedragonmotors.com\n🌐 **Sitio web:** www.bluedragonmotors.com\n\n💼 **Horario de atención telefónica:**\n• Lunes a Viernes: 8:00 AM - 6:00 PM\n• Sábados: 9:00 AM - 2:00 PM\n\n🚨 **Emergencias:** +57 301 234 5678 (24/7)',
        category: 'contact',
        priority: 9,
        keywords: ['contacto', 'telefono', 'email', 'whatsapp', 'llamar', 'comunicar'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'chatbot_servicios',
        context: 'chatbot',
        query: 'servicios disponibles',
        response: '🔧 **Servicios Disponibles**\n\n🏍️ **Mantenimiento de Motocicletas:**\n• Revisión preventiva completa\n• Cambio de aceite y filtros\n• Ajuste de frenos y suspensión\n• Revisión eléctrica y de batería\n\n🔧 **Reparaciones Mecánicas:**\n• Motor y transmisión\n• Sistema de frenos\n• Suspensión y dirección\n• Sistema eléctrico\n\n🛠️ **Servicios Especializados:**\n• Diagnóstico computarizado\n• Reparación de inyección electrónica\n• Servicio de cadena y piñones\n• Instalación de accesorios\n\n📋 **Documentos y Legal:**\n• Revisión técnico-mecánica\n• Certificación de gases\n• Trámites de SOAT\n\n💰 **Garantía:** 30 días en todos nuestros servicios.',
        category: 'services',
        priority: 8,
        keywords: ['servicios', 'ofrecen', 'hacen', 'trabajan', 'especialidad', 'reparan'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'chatbot_precios_revision',
        context: 'chatbot',
        query: 'precio de revisión',
        response: '💰 **Precios de Servicios**\n\n🔍 **Revisión Básica:** $35.000\n• Diagnóstico inicial\n• Verificación de fluidos\n• Revisión visual general\n\n🛢️ **Cambio de Aceite:** $45.000 - $65.000\n• Aceite sintético premium\n• Filtro de aceite incluido\n• Verificación de niveles\n\n🔧 **Revisión Completa:** $120.000\n• 25 puntos de verificación\n• Diagnóstico computarizado\n• Informe detallado\n\n⚙️ **Reparaciones:** Desde $25.000\n• Según diagnóstico específico\n• Repuestos originales disponibles\n\n💳 **Formas de pago:**\n• Efectivo\n• Tarjetas débito/crédito\n• Transferencias\n• Nequi/Daviplata',
        category: 'pricing',
        priority: 8,
        keywords: ['precio', 'costo', 'cuanto', 'vale', 'tarifa', 'pagar', 'cobran'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'chatbot_garantia',
        context: 'chatbot',
        query: 'garantía de servicios',
        response: '🛡️ **Garantía de Servicios**\n\n✅ **30 días de garantía** en todos nuestros servicios\n\n🔧 **Incluye:**\n• Reparaciones mecánicas\n• Cambios de repuestos\n• Ajustes y calibraciones\n• Servicio de mantenimiento\n\n⚠️ **Condiciones:**\n• Uso normal del vehículo\n• No modificaciones posteriores\n• Presentar factura original\n\n🛠️ **Repuestos:**\n• 6 meses de garantía (repuestos originales)\n• 1 año de garantía (baterías)\n• Según fabricante (neumáticos)\n\n📞 **Servicio post-venta:**\n• Soporte técnico gratuito\n• Consultas por teléfono\n• Atención prioritaria',
        category: 'services',
        priority: 7,
        keywords: ['garantia', 'garantía', 'cobertura', 'responsabilidad', 'devuelven'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'chatbot_cita',
        context: 'chatbot',
        query: 'agendar cita',
        response: '📅 **Agendar una Cita**\n\n🖥️ **Métodos para agendar:**\n\n1. **Online (Recomendado):**\n   • Ingresa a nuestro sistema\n   • Selecciona fecha y hora disponible\n   • Elige el tipo de servicio\n\n2. **Por teléfono:**\n   • Llama al +57 301 234 5678\n   • Lunes a Viernes: 8:00 AM - 6:00 PM\n\n3. **WhatsApp:**\n   • Envía mensaje al +57 301 234 5678\n   • Respuesta inmediata\n\n⏰ **Horarios disponibles:**\n• Lunes a Viernes: 7:00 AM - 5:00 PM\n• Sábados: 8:00 AM - 12:00 PM\n\n⚡ **Beneficios de agendar cita:**\n• Atención prioritaria\n• Menos tiempo de espera\n• Técnico especializado asignado\n• Recordatorio automático',
        category: 'services',
        priority: 8,
        keywords: ['cita', 'agendar', 'reservar', 'turno', 'programar', 'cuando'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'chatbot_metodos_pago',
        context: 'chatbot',
        query: 'métodos de pago',
        response: '💳 **Métodos de Pago Aceptados**\n\n✅ **Efectivo**\n• Pesos colombianos\n• Cambio exacto recomendado\n\n💳 **Tarjetas**\n• Débito (todas las redes)\n• Crédito (Visa, MasterCard, American Express)\n\n🏦 **Transferencias**\n• Cuenta corriente Bancolombia\n• Cuenta ahorros Davivienda\n• Envío de comprobante por WhatsApp\n\n📱 **Digital**\n• Nequi\n• Daviplata\n• Recarga de celular\n\n📄 **Facturación**\n• Factura electrónica\n• Recibo de caja\n• Soporte para contabilidad\n\n💰 **Descuentos**\n• 5% descuento pago contado\n• 10% descuento clientes frecuentes',
        category: 'pricing',
        priority: 7,
        keywords: ['pago', 'pagar', 'tarjeta', 'efectivo', 'transferencia', 'nequi', 'daviplata'],
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // PRODUCT SEARCH CONTEXT
      {
        id: 'product_aceite_10w40',
        context: 'productSearch',
        query: 'aceite 10w40',
        response: '🛢️ **Aceite Motul 5100 10W40**\n\n💰 **Precio:** $42.000\n📦 **Stock:** 15 unidades\n\n📋 **Especificaciones:**\n• Viscosidad: 10W40\n• Tipo: Sintético\n• Capacidad: 1 litro\n\n✅ **Compatible con:**\n• Yamaha R15, MT-03, MT-07\n• Kawasaki Ninja 400, Z400\n• Honda CB300R, CBR500R\n• Suzuki GSX250R\n\n🔧 **Recomendado para:**\n• Motores de 4 tiempos\n• Uso diario y deportivo\n\n📅 **Cambio recomendado:** Cada 5,000 km o 6 meses',
        category: 'inventory',
        priority: 9,
        keywords: ['aceite', '10w40', 'motul', '5100', 'sintetico', 'lubricante'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'product_aceite_20w50',
        context: 'productSearch',
        query: 'aceite 20w50',
        response: '🛢️ **Aceite Motul 7100 20W50**\n\n💰 **Precio:** $48.000\n📦 **Stock:** 12 unidades\n\n📋 **Especificaciones:**\n• Viscosidad: 20W50\n• Tipo: Semi-sintético\n• Capacidad: 1 litro\n\n✅ **Compatible con:**\n• Motos deportivas de alto rendimiento\n• Kawasaki Ninja ZX-6R, ZX-10R\n• Yamaha R6, R1\n• Honda CBR600RR, CBR1000RR\n\n🔧 **Recomendado para:**\n• Motores de competición\n• Uso intensivo\n• Temperaturas elevadas\n\n📅 **Cambio recomendado:** Cada 3,000 km o 3 meses',
        category: 'inventory',
        priority: 9,
        keywords: ['aceite', '20w50', 'motul', '7100', 'sintetico', 'deportivo'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'product_filtro_aceite',
        context: 'productSearch',
        query: 'filtro de aceite',
        response: '🔧 **Filtro de Aceite Genérico**\n\n💰 **Precio:** $8.000\n📦 **Stock:** 25 unidades\n\n📋 **Características:**\n• Alta filtración\n• Resistente a la presión\n• Fácil instalación\n\n⚠️ **Importante:** Verifica la compatibilidad con tu modelo de motocicleta antes de comprar.\n\n🔍 **Modelos compatibles:**\n• Yamaha R15, FZ, MT\n• Honda CB, CBR, CG\n• Kawasaki Ninja, Z\n• Suzuki GN, GSX\n\n📞 **¿No encuentras el filtro específico?**\nLlámanos para consultar disponibilidad.',
        category: 'inventory',
        priority: 8,
        keywords: ['filtro', 'aceite', 'filtrar', 'limpiar', 'motor'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'product_llantas',
        context: 'productSearch',
        query: 'llantas',
        response: '🛞 **Llantas para Motocicleta**\n\n💰 **Precios desde:** $150.000\n\n🏷️ **Marcas disponibles:**\n• Michelin Pilot Road 4\n• Pirelli Diablo Rosso III\n• IRC GS-II\n• Bridgestone Battlax\n\n📏 **Medidas comunes:**\n• 90/90-17 (trasera)\n• 110/70-17 (delantera)\n• 120/70-17 (delantera)\n• 140/70-17 (trasera)\n\n🔍 **Consulta disponibilidad** para tu modelo específico.\n\n📞 **¿Necesitas asesoría?**\nTe ayudamos a elegir la llanta correcta para tu moto y estilo de conducción.',
        category: 'inventory',
        priority: 7,
        keywords: ['llanta', 'neumatico', 'rueda', 'michelin', 'pirelli', 'irc'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'product_bateria',
        context: 'productSearch',
        query: 'batería',
        response: '🔋 **Baterías para Motocicleta**\n\n💰 **Precios desde:** $120.000\n\n🏷️ **Marcas disponibles:**\n• Yuasa\n• Bosch\n• Exide\n• Centauro\n\n📋 **Tipos:**\n• Baterías convencionales\n• Baterías de gel\n• Baterías de litio (alta performance)\n\n⚡ **Capacidades comunes:**\n• 12V 4Ah (scooters)\n• 12V 6Ah (motos pequeñas)\n• 12V 8Ah (motos medianas)\n• 12V 12Ah (motos grandes)\n\n🛡️ **Garantía:** 1 año\n\n🔧 **Servicio incluido:**\n• Instalación gratuita\n• Prueba de carga\n• Configuración inicial',
        category: 'inventory',
        priority: 8,
        keywords: ['bateria', 'batería', 'yuasa', 'bosch', 'carga', 'electrico'],
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // SCANNER CONTEXT
      {
        id: 'scanner_ayuda',
        context: 'scanner',
        query: 'ayuda con escáner',
        response: '🔍 **Ayuda con Escáner de Diagnóstico**\n\n📱 **¿Qué hace el escáner?**\n• Lee códigos de error (DTC)\n• Verifica sensores y actuadores\n• Realiza pruebas en vivo\n• Genera reportes detallados\n\n🔧 **Códigos de error comunes:**\n• P0171: Mezcla pobre (inyectores sucios)\n• P0300: Fallos de encendido (bujías)\n• P0562: Batería baja (carga alternador)\n\n💡 **Recomendaciones:**\n• Conecta el escáner al puerto OBD\n• Enciende la motocicleta\n• Espera a que complete el diagnóstico\n\n📞 **¿Problemas técnicos?**\nLlama a soporte técnico.',
        category: 'general',
        priority: 7,
        keywords: ['scanner', 'diagnostico', 'codigo', 'error', 'obd', 'prueba'],
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // WORK ORDER CONTEXT
      {
        id: 'workorder_plantilla',
        context: 'workOrder',
        query: 'crear orden de trabajo',
        response: '📋 **Crear Orden de Trabajo**\n\n📝 **Pasos para crear una OT:**\n\n1. **Seleccionar Cliente**\n   • Buscar por nombre o placa\n   • Crear cliente nuevo si no existe\n\n2. **Seleccionar Vehículo**\n   • Elegir motocicleta del cliente\n   • Verificar kilometraje actual\n\n3. **Elegir Servicios**\n   • Mantenimiento preventivo\n   • Reparación específica\n   • Diagnóstico completo\n\n4. **Agregar Repuestos**\n   • Buscar en inventario\n   • Verificar stock disponible\n   • Agregar al presupuesto\n\n5. **Generar Presupuesto**\n   • Calcular costos automáticamente\n   • Aplicar descuentos si aplica\n   • Enviar a cliente para aprobación\n\n✅ **La orden se crea automáticamente** con toda la información necesaria.',
        category: 'general',
        priority: 8,
        keywords: ['orden', 'trabajo', 'crear', 'ot', 'presupuesto', 'reparacion'],
        createdAt: new Date(),
        updatedAt: new Date()
      },

      // DYNAMIC RESPONSES (with placeholders for real-time data)
      {
        id: 'chatbot_queue_status',
        context: 'chatbot',
        query: 'estado de la cola',
        response: '👥 **Estado de la Cola de Espera**\n\n⏰ **Tiempo promedio de espera:** {avgWaitTime} minutos\n👤 **Clientes esperando:** {waitingCount}\n🏪 **Estado del taller:** {isOpen}\n\n📊 **Posición estimada:** {estimatedPosition}\n\n💡 **Consejos para esperar:**\n• Recibirás notificaciones cuando sea tu turno\n• Puedes esperar en nuestra zona de descanso\n• Ofrecemos servicio de café gratuito\n\n📞 **¿Preguntas?** Habla con nuestro personal.',
        category: 'queue',
        priority: 8,
        keywords: ['cola', 'espera', 'turno', 'esperando', 'tiempo', 'fila'],
        dynamicFields: ['avgWaitTime', 'waitingCount', 'isOpen', 'estimatedPosition'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'chatbot_inventory_status',
        context: 'chatbot',
        query: 'estado del inventario',
        response: '📦 **Estado del Inventario**\n\n📊 **Resumen general:**\n• Productos en stock: {totalProducts}\n• Productos críticos: {criticalItems}\n• Productos agotados: {outOfStockItems}\n\n🔴 **Alertas actuales:**\n• {lowStockCount} productos con stock bajo\n• {criticalCount} productos críticos\n\n📅 **Última actualización:** {lastUpdate}\n\n💡 **¿Necesitas un repuesto específico?**\nConsulta disponibilidad en tiempo real.',
        category: 'inventory',
        priority: 7,
        keywords: ['inventario', 'stock', 'disponible', 'agotado', 'repuesto', 'pieza'],
        dynamicFields: ['totalProducts', 'criticalItems', 'outOfStockItems', 'lowStockCount', 'criticalCount', 'lastUpdate'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    this.buildIndexes();
  }

  /**
   * Build search indexes for fast lookup
   */
  private buildIndexes(): void {
    // Category index
    this.categories = {};
    for (const response of this.responses) {
      if (!this.categories[response.category]) {
        this.categories[response.category] = [];
      }
      this.categories[response.category].push(response);
    }

    // Context index
    this.contextIndex = {};
    for (const response of this.responses) {
      if (!this.contextIndex[response.context]) {
        this.contextIndex[response.context] = [];
      }
      this.contextIndex[response.context].push(response);
    }
  }

  /**
   * Find the best matching fallback response for a query
   */
  async findBestMatch(
    query: string,
    context: 'chatbot' | 'productSearch' | 'scanner' | 'workOrder'
  ): Promise<FallbackMatch | null> {
    const normalizedQuery = this.normalizeQuery(query);
    const contextResponses = this.contextIndex[context] || [];

    let bestMatch: FallbackMatch | null = null;
    let bestScore = 0;

    for (const response of contextResponses) {
      const match = this.calculateMatchScore(normalizedQuery, response);
      if (match.score > bestScore && match.score >= 0.3) { // Minimum threshold
        bestMatch = match;
        bestScore = match.score;
      }
    }

    // Update usage statistics if match found
    if (bestMatch) {
      await this.updateUsageStats(bestMatch.response);
    }

    return bestMatch;
  }

  /**
   * Get a fallback response with dynamic data populated
   */
  async getResponseWithDynamicData(match: FallbackMatch): Promise<string> {
    let response = match.response.response;

    if (match.response.dynamicFields) {
      const dynamicData = await this.getDynamicData(match.response.dynamicFields);
      for (const [field, value] of Object.entries(dynamicData)) {
        response = response.replace(new RegExp(`{${field}}`, 'g'), String(value));
      }
    }

    return response;
  }

  /**
   * Get dynamic data for placeholders
   */
  private async getDynamicData(fields: string[]): Promise<Record<string, any>> {
    const data: Record<string, any> = {};

    for (const field of fields) {
      switch (field) {
        case 'avgWaitTime':
          const queueStatus = this.queueService.getQueueStatus()();
          data[field] = Math.round(queueStatus?.averageWaitTime || 0);
          break;

        case 'waitingCount':
          const queueStatus2 = this.queueService.getQueueStatus()();
          data[field] = queueStatus2?.currentCount || 0;
          break;

        case 'isOpen':
          const queueStatus3 = this.queueService.getQueueStatus()();
          data[field] = queueStatus3?.isOpen ? 'Abierto' : 'Cerrado';
          break;

        case 'estimatedPosition':
          data[field] = 'Calculando...'; // Would need more complex logic
          break;

        case 'totalProducts':
          const stockReport = this.inventoryReportsService.getStockReportByLocation();
          data[field] = stockReport.length;
          break;

        case 'criticalItems':
          const stockReport2 = this.inventoryReportsService.getStockReportByLocation();
          data[field] = stockReport2.filter(r => r.status === 'critical').length;
          break;

        case 'outOfStockItems':
          const stockReport3 = this.inventoryReportsService.getStockReportByLocation();
          data[field] = stockReport3.filter(r => r.status === 'out_of_stock').length;
          break;

        case 'lowStockCount':
          const lowStock = this.inventoryReportsService.getLowStockReport();
          data[field] = lowStock.length;
          break;

        case 'criticalCount':
          const stockReport4 = this.inventoryReportsService.getStockReportByLocation();
          data[field] = stockReport4.filter(r => r.status === 'critical').length;
          break;

        case 'lastUpdate':
          data[field] = new Date().toLocaleString('es-CO');
          break;

        default:
          data[field] = 'N/A';
      }
    }

    return data;
  }

  /**
   * Calculate match score between query and response
   */
  private calculateMatchScore(query: string, response: FallbackResponse): FallbackMatch {
    const queryWords = query.split(/\s+/);
    const matchedKeywords: string[] = [];

    let score = response.priority / 10; // Base score from priority

    // Keyword matching with weights
    for (const keyword of response.keywords) {
      const keywordWords = keyword.split(/\s+/);

      // Exact keyword match
      if (queryWords.some(qWord =>
        keywordWords.some(kWord =>
          qWord.toLowerCase().includes(kWord.toLowerCase()) ||
          kWord.toLowerCase().includes(qWord.toLowerCase())
        )
      )) {
        score += 0.3;
        matchedKeywords.push(keyword);
      }

      // Partial word matching
      const partialMatches = queryWords.filter(qWord =>
        keywordWords.some(kWord =>
          kWord.toLowerCase().includes(qWord.toLowerCase()) ||
          qWord.toLowerCase().includes(kWord.toLowerCase())
        )
      ).length;

      if (partialMatches > 0) {
        score += (partialMatches / Math.max(queryWords.length, keywordWords.length)) * 0.2;
      }
    }

    // Query similarity to response query
    const responseQueryWords = response.query.split(/\s+/);
    const querySimilarity = this.calculateWordSimilarity(queryWords, responseQueryWords);
    score += querySimilarity * 0.2;

    // Success rate bonus
    if (response.successRate) {
      score += response.successRate * 0.1;
    }

    // Recency bonus (recently used responses are slightly preferred)
    if (response.lastUsed) {
      const daysSinceLastUse = (Date.now() - response.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastUse < 7) {
        score += 0.05;
      }
    }

    return {
      response,
      score: Math.min(score, 1.0),
      matchedKeywords
    };
  }

  /**
   * Calculate word similarity between two arrays of words
   */
  private calculateWordSimilarity(words1: string[], words2: string[]): number {
    const set1 = new Set(words1.map(w => w.toLowerCase()));
    const set2 = new Set(words2.map(w => w.toLowerCase()));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Normalize query for matching
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  /**
   * Update usage statistics for a response
   */
  private async updateUsageStats(response: FallbackResponse): Promise<void> {
    response.lastUsed = new Date();
    response.usageCount = (response.usageCount || 0) + 1;

    // Simple success rate calculation (could be enhanced with user feedback)
    if (response.successRate === undefined) {
      response.successRate = 0.8; // Initial success rate
    } else {
      // Gradual improvement based on usage
      response.successRate = Math.min(0.95, response.successRate + 0.01);
    }

    response.updatedAt = new Date();
  }

  /**
   * Add a new fallback response
   */
  addResponse(response: Omit<FallbackResponse, 'id' | 'lastUsed' | 'successRate' | 'usageCount' | 'createdAt' | 'updatedAt'>): void {
    const newResponse: FallbackResponse = {
      ...response,
      id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lastUsed: undefined,
      successRate: 0,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.responses.push(newResponse);
    this.buildIndexes();

    console.log('🤖 Fallback Library: Added new response:', newResponse.id);
  }

  /**
   * Update an existing response
   */
  updateResponse(id: string, updates: Partial<FallbackResponse>): void {
    const index = this.responses.findIndex(r => r.id === id);
    if (index !== -1) {
      this.responses[index] = {
        ...this.responses[index],
        ...updates,
        updatedAt: new Date()
      };
      this.buildIndexes();
      console.log('🤖 Fallback Library: Updated response:', id);
    }
  }

  /**
   * Remove a response
   */
  removeResponse(id: string): void {
    const index = this.responses.findIndex(r => r.id === id);
    if (index !== -1) {
      this.responses.splice(index, 1);
      this.buildIndexes();
      console.log('🤖 Fallback Library: Removed response:', id);
    }
  }

  /**
   * Get fallback statistics
   */
  getStats(): FallbackStats {
    const categories = Object.keys(this.categories).reduce((acc, cat) => {
      acc[cat] = this.categories[cat].length;
      return acc;
    }, {} as Record<string, number>);

    const contextBreakdown = Object.keys(this.contextIndex).reduce((acc, ctx) => {
      acc[ctx] = this.contextIndex[ctx].length;
      return acc;
    }, {} as Record<string, number>);

    const totalUsage = this.responses.reduce((sum, r) => sum + (r.usageCount || 0), 0);
    const totalSuccessRate = this.responses.reduce((sum, r) => sum + (r.successRate || 0), 0);
    const avgSuccessRate = this.responses.length > 0
      ? totalSuccessRate / this.responses.length
      : 0;

    const topResponses = [...this.responses]
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 10);

    return {
      totalResponses: this.responses.length,
      categories,
      avgSuccessRate: Math.round(avgSuccessRate * 100) / 100,
      totalUsage,
      topResponses,
      contextBreakdown
    };
  }

  /**
   * Get responses by category
   */
  getResponsesByCategory(category: string): FallbackResponse[] {
    return this.categories[category] || [];
  }

  /**
   * Get responses by context
   */
  getResponsesByContext(context: string): FallbackResponse[] {
    return this.contextIndex[context] || [];
  }

  /**
   * Search responses by keyword
   */
  searchResponses(keyword: string): FallbackResponse[] {
    const normalizedKeyword = keyword.toLowerCase();
    return this.responses.filter(response =>
      response.keywords.some(k => k.toLowerCase().includes(normalizedKeyword)) ||
      response.query.toLowerCase().includes(normalizedKeyword) ||
      response.response.toLowerCase().includes(normalizedKeyword)
    );
  }

  /**
   * Get all responses
   */
  getAllResponses(): FallbackResponse[] {
    return [...this.responses];
  }

  /**
   * Reset usage statistics
   */
  resetStats(): void {
    for (const response of this.responses) {
      response.usageCount = 0;
      response.lastUsed = undefined;
      response.successRate = 0.8; // Reset to default
    }
    console.log('🤖 Fallback Library: Statistics reset');
  }
}