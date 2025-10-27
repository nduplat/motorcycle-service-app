import { Injectable, inject } from '@angular/core';
import { GroqService } from './groq.service';
import { NotificationService, NotificationCategory } from './notification.service';
import { QueueService } from './queue.service';
import { InventoryReportsService, StockReport } from './inventory-reports.service';
import { ProductService } from './product.service';
import { UserService } from './user.service';
import { UserVehicleService } from './user-vehicle.service';
import { CostMonitoringService } from './cost-monitoring.service';
import { CacheService } from './cache.service';
import { FallbackLibraryService } from './fallback-library.service';
import { BudgetCircuitBreakerService } from './budget-circuit-breaker.service';
import { MaintenanceReminder, Motorcycle, UserVehicle } from '../models';
import { toDate } from '../models/types';
import { Observable, from, map } from 'rxjs';

export interface AIInsight {
  type: 'recommendation' | 'alert' | 'analysis' | 'prediction';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'inventory' | 'queue' | 'notifications' | 'operations' | 'financial';
  actionable: boolean;
  suggestedActions?: string[];
  data?: any;
}

export interface FallbackResponse {
  id: string;
  context: string;
  query: string;
  response: string;
  category: 'inventory' | 'queue' | 'maintenance' | 'general';
  priority: number; // 1-10, higher = more specific
  lastUsed?: Date;
  successRate?: number;
}

export interface FallbackLibrary {
  responses: FallbackResponse[];
  categories: Record<string, FallbackResponse[]>;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

export interface BudgetCircuitBreaker {
  isEnabled: boolean;
  dailyBudget: number;
  currentSpend: number;
  circuitBreaker: CircuitBreakerState;
  emergencyMode: boolean;
}

export interface AIReport {
  title: string;
  summary: string;
  insights: AIInsight[];
  recommendations: string[];
  generatedAt: Date;
  data: any;
}

@Injectable({
  providedIn: 'root'
})
export class AIAssistantService {
  private groqService = inject(GroqService);
  private notificationService = inject(NotificationService);
  private queueService = inject(QueueService);
  private inventoryReportsService = inject(InventoryReportsService);
  private productService = inject(ProductService);
  private userService = inject(UserService);
  private userVehicleService = inject(UserVehicleService);
  private costMonitoring = inject(CostMonitoringService);
  private cacheService = inject(CacheService);
  private fallbackLibrary = inject(FallbackLibraryService);
  private budgetCircuitBreaker = inject(BudgetCircuitBreakerService);

  // Budget circuit breaker for cost control - now using the service

  // Legacy fallback library - will be replaced by FallbackLibraryService
  // Keeping for backward compatibility during transition

  constructor() {
    // Check if AI service is available
    const isConfigured = this.groqService.isConfigured();
    console.log('🤖 AI Assistant: Checking Groq service configuration - Configured:', isConfigured);
    if (!isConfigured) {
      console.warn('AI Assistant: Groq service is not configured. AI features will be limited.');
    }

    // Initialize fallback library categories
    this.initializeFallbackCategories();
  }

  /**
   * Initialize fallback response categories for quick lookup
   * Legacy method - now handled by FallbackLibraryService
   */
  private initializeFallbackCategories(): void {
    // Categories are now managed by FallbackLibraryService
    console.log('🤖 AI Assistant: Using new FallbackLibraryService for response management');
  }

  // Fallback methods for when AI service is unavailable
  private getFallbackAnalysis(context: string, type: string): string {
    console.warn(`Using fallback analysis for ${type} due to AI service unavailability`);

    switch (type) {
      case 'inventory health analysis':
        return 'Análisis de inventario no disponible. Se recomienda revisar manualmente los niveles de stock y productos críticos.';

      case 'queue efficiency analysis':
        return 'Análisis de cola no disponible. Se recomienda monitorear manualmente los tiempos de espera y eficiencia del servicio.';

      default:
        return 'Análisis no disponible temporalmente. Por favor, contacte al administrador del sistema.';
    }
  }

  private getFallbackRecommendations(data: any, context: string): string[] {
    console.warn('Using fallback recommendations due to AI service unavailability');

    // Provide basic, generic recommendations based on context
    if (context.includes('inventory')) {
      return [
        'Revisar niveles de stock semanalmente',
        'Implementar alertas automáticas para productos críticos',
        'Analizar patrones de venta para optimizar pedidos'
      ];
    }

    if (context.includes('queue')) {
      return [
        'Monitorear tiempos de espera promedio',
        'Optimizar distribución de técnicos',
        'Implementar sistema de citas para reducir colas'
      ];
    }

    return [
      'Implementar monitoreo automático del sistema',
      'Establecer procedimientos de respaldo',
      'Revisar configuraciones de servicios externos'
    ];
  }

  // Inventory Management AI Features
  async analyzeInventoryHealth(): Promise<AIReport> {
    try {
      const stockReports = this.inventoryReportsService.getStockReportByLocation();
      const lowStockItems = this.inventoryReportsService.getLowStockReport();
      const rotationReport = await this.inventoryReportsService.getProductRotationReport(30);
      const topSelling = await this.inventoryReportsService.getTopSellingProducts(10);

      const inventoryData = {
        totalProducts: stockReports.length,
        lowStockItems: lowStockItems.length,
        outOfStockItems: stockReports.filter(r => r.status === 'out_of_stock').length,
        criticalItems: stockReports.filter(r => r.status === 'critical').length,
        topSellingProducts: topSelling.slice(0, 5),
        slowMovingProducts: rotationReport.filter(r => r.daysSinceLastMovement > 60).slice(0, 5)
      };

      const analysisPrompt = `
Analyze this inventory data for Blue Dragon Motors motorcycle workshop:

${JSON.stringify(inventoryData, null, 2)}

Provide insights about:
1. Inventory health status
2. Stock optimization opportunities
3. Potential stockouts or overstock situations
4. Product performance trends
5. Recommendations for inventory management

Focus on actionable insights that can improve workshop operations and customer satisfaction.
`;

      let aiAnalysis: string;
      try {
        aiAnalysis = await this.groqService.analyzeText(
          analysisPrompt,
          'inventory health analysis',
          'Motorcycle workshop inventory management'
        );
      } catch (error) {
        console.error('AI analysis failed, using fallback:', error);
        aiAnalysis = this.getFallbackAnalysis(analysisPrompt, 'inventory health analysis');
      }

      const insights: AIInsight[] = [];

      // Generate specific insights based on data
      if (inventoryData.outOfStockItems > 0) {
        insights.push({
          type: 'alert',
          title: 'Productos sin stock',
          description: `${inventoryData.outOfStockItems} productos están agotados. Esto puede afectar el servicio al cliente.`,
          priority: 'high',
          category: 'inventory',
          actionable: true,
          suggestedActions: [
            'Revisar proveedores para reabastecimiento urgente',
            'Considerar productos alternativos para clientes',
            'Actualizar catálogo de productos disponibles'
          ]
        });
      }

      if (inventoryData.criticalItems > 0) {
        insights.push({
          type: 'alert',
          title: 'Productos en nivel crítico',
          description: `${inventoryData.criticalItems} productos están por debajo del 50% del stock mínimo.`,
          priority: 'medium',
          category: 'inventory',
          actionable: true,
          suggestedActions: [
            'Programar pedidos de reabastecimiento',
            'Monitorear ventas de estos productos'
          ]
        });
      }

      if (inventoryData.slowMovingProducts.length > 0) {
        insights.push({
          type: 'recommendation',
          title: 'Productos de lento movimiento',
          description: `${inventoryData.slowMovingProducts.length} productos no se venden desde hace más de 60 días.`,
          priority: 'low',
          category: 'inventory',
          actionable: true,
          suggestedActions: [
            'Evaluar descuentos promocionales',
            'Considerar discontinuar productos obsoletos',
            'Revisar estrategias de marketing'
          ]
        });
      }

      return {
        title: 'Análisis de Salud del Inventario',
        summary: aiAnalysis,
        insights,
        recommendations: await this.generateInventoryRecommendations(inventoryData),
        generatedAt: new Date(),
        data: inventoryData
      };

    } catch (error) {
      console.error('Error analyzing inventory health:', error);
      throw error;
    }
  }

  private async generateInventoryRecommendations(data: any): Promise<string[]> {
    const recommendationsPrompt = `
Basado en estos datos de inventario, genera 5 recomendaciones específicas y accionables:

${JSON.stringify(data, null, 2)}

Enfócate en:
- Optimización de stock
- Mejora de rotación de productos
- Estrategias de reabastecimiento
- Gestión de productos de temporada
- Integración con proveedores
`;

    try {
      const aiRecommendations = await this.groqService.generateResponse(
        recommendationsPrompt,
        'Genera recomendaciones específicas de inventario para taller de motocicletas'
      );

      return aiRecommendations.split('\n').filter(line => line.trim().length > 0).slice(0, 5);
    } catch (error) {
      console.error('AI recommendations failed, using fallback:', error);
      return this.getFallbackRecommendations(data, 'inventory');
    }
  }

  // Queue Management AI Features
  async analyzeQueueEfficiency(): Promise<AIReport> {
    try {
      const queueStatus = this.queueService.getQueueStatus()();
      const queueEntries = this.queueService.getQueueEntries()();
      const waitingEntries = queueEntries.filter(e => e.status === 'waiting');
      const servedToday = queueEntries.filter(e =>
        e.status === 'served' &&
        toDate(e.updatedAt)?.toDateString() === new Date().toDateString()
      );

      const queueData = {
        isOpen: queueStatus?.isOpen || false,
        currentCount: queueStatus?.currentCount || 0,
        averageWaitTime: queueStatus?.averageWaitTime || 0,
        waitingCustomers: waitingEntries.length,
        servedToday: servedToday.length,
        operatingHours: queueStatus?.operatingHours,
        peakHours: this.calculatePeakHours(queueEntries)
      };

      const analysisPrompt = `
Analyze this queue management data for Blue Dragon Motors:

${JSON.stringify(queueData, null, 2)}

Provide insights about:
1. Queue efficiency and customer satisfaction
2. Optimal staffing levels
3. Peak hour management
4. Service time optimization
5. Customer wait time reduction strategies

Consider motorcycle workshop operations and customer expectations.
`;

      let aiAnalysis: string;
      try {
        aiAnalysis = await this.groqService.analyzeText(
          analysisPrompt,
          'queue efficiency analysis',
          'Motorcycle workshop queue management'
        );
      } catch (error) {
        console.error('AI queue analysis failed, using fallback:', error);
        aiAnalysis = this.getFallbackAnalysis(analysisPrompt, 'queue efficiency analysis');
      }

      const insights: AIInsight[] = [];

      if (queueData.averageWaitTime > 30) {
        insights.push({
          type: 'alert',
          title: 'Tiempos de espera elevados',
          description: `El tiempo promedio de espera es de ${queueData.averageWaitTime} minutos.`,
          priority: 'medium',
          category: 'queue',
          actionable: true,
          suggestedActions: [
            'Considerar agregar más técnicos',
            'Optimizar procesos de servicio',
            'Implementar sistema de citas prioritarias'
          ]
        });
      }

      if (queueData.waitingCustomers > 5) {
        insights.push({
          type: 'recommendation',
          title: 'Cola congestionada',
          description: `${queueData.waitingCustomers} clientes esperando. Considere medidas para reducir tiempos.`,
          priority: 'high',
          category: 'queue',
          actionable: true,
          suggestedActions: [
            'Activar modo de atención prioritaria',
            'Notificar clientes sobre tiempos de espera',
            'Evaluar redistribución de técnicos'
          ]
        });
      }

      return {
        title: 'Análisis de Eficiencia de Cola',
        summary: aiAnalysis,
        insights,
        recommendations: await this.generateQueueRecommendations(queueData),
        generatedAt: new Date(),
        data: queueData
      };

    } catch (error) {
      console.error('Error analyzing queue efficiency:', error);
      throw error;
    }
  }

  private calculatePeakHours(entries: any[]): string[] {
    const hourCounts: { [key: string]: number } = {};

    entries.forEach(entry => {
      if (entry.joinedAt) {
        const hour = entry.joinedAt.toDate().getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    const sortedHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => `${hour}:00`);

    return sortedHours;
  }

  private async generateQueueRecommendations(data: any): Promise<string[]> {
    const recommendationsPrompt = `
Basado en estos datos de cola, genera 5 recomendaciones específicas para mejorar la eficiencia:

${JSON.stringify(data, null, 2)}

Enfócate en:
- Optimización de horarios de atención
- Gestión de picos de demanda
- Mejora de tiempos de servicio
- Estrategias de citas
- Comunicación con clientes
`;

    try {
      const aiRecommendations = await this.groqService.generateResponse(
        recommendationsPrompt,
        'Genera recomendaciones de gestión de cola para taller'
      );

      return aiRecommendations.split('\n').filter(line => line.trim().length > 0).slice(0, 5);
    } catch (error) {
      console.error('AI queue recommendations failed, using fallback:', error);
      return this.getFallbackRecommendations(data, 'queue');
    }
  }

  // Smart Notifications AI Features with Categorized Notifications
  async generateSmartNotifications(): Promise<void> {
    try {
      console.log('🤖 AI Assistant: Generating smart notifications...');

      // 1. Analyze inventory for alerts (INVENTORY category)
      await this.generateInventoryAlerts();

      // 2. Analyze queue for efficiency alerts (QUEUE category)
      await this.generateQueueAlerts();

      // 3. Generate maintenance reminders (MAINTENANCE_REMINDERS category - HIGHEST PRIORITY)
      await this.generateMaintenanceReminders();

      // 4. Check for service order updates (SERVICE_ORDERS category)
      await this.generateServiceOrderAlerts();

      console.log('🤖 AI Assistant: Smart notifications generated successfully');

    } catch (error) {
      console.error('Error generating smart notifications:', error);
    }
  }

  private async generateInventoryAlerts(): Promise<void> {
    try {
      const lowStockItems = this.inventoryReportsService.getLowStockReport();

      for (const item of lowStockItems.slice(0, 3)) { // Limit to top 3 alerts
        let alertType: 'low_stock' | 'out_of_stock' | 'critical' | 'reorder_needed' = 'low_stock';

        if (item.availableStock === 0) {
          alertType = 'out_of_stock';
        } else if (item.status === 'critical') {
          alertType = 'critical';
        } else if (item.availableStock <= item.minStock * 0.5) {
          alertType = 'reorder_needed';
        }

        await this.notificationService.createInventoryAlert(
          {
            name: item.productName,
            sku: item.productId, // Use productId as SKU placeholder
            currentStock: item.availableStock,
            minStock: item.minStock
          },
          alertType
        );
      }
    } catch (error) {
      console.error('Error generating inventory alerts:', error);
    }
  }

  private async generateQueueAlerts(): Promise<void> {
    try {
      const queueStatus = this.queueService.getQueueStatus()();

      if (queueStatus && queueStatus.averageWaitTime && queueStatus.averageWaitTime > 45) {
        // Create queue efficiency alert for staff
        await this.notificationService.createCategorizedNotification(
          'queue',
          'Alerta: Cola Congestionada',
          `Tiempo de espera promedio: ${queueStatus.averageWaitTime} minutos. ${queueStatus.currentCount} clientes esperando. Considera medidas para mejorar la eficiencia.`,
          {
            priority: 'high',
            targetAudience: 'admins',
            additionalMeta: {
              queueMetrics: queueStatus,
              alertType: 'efficiency_warning'
            }
          }
        );
      }

      // Check for customers waiting too long
      const queueEntries = this.queueService.getQueueEntries()();
      const longWaitingEntries = queueEntries.filter(entry =>
        entry.status === 'waiting' &&
        entry.joinedAt &&
        (new Date().getTime() - toDate(entry.joinedAt).getTime()) > (60 * 60 * 1000) // 1 hour
      );

      for (const entry of longWaitingEntries.slice(0, 2)) { // Limit notifications
        await this.notificationService.createQueueNotification(
          entry.customerId,
          {
            position: entry.position,
            estimatedWaitTime: entry.estimatedWaitTime,
            ticketNumber: entry.id.slice(-4).toUpperCase() // Last 4 chars as ticket
          },
          'delayed'
        );
      }

    } catch (error) {
      console.error('Error generating queue alerts:', error);
    }
  }

  private async generateMaintenanceReminders(): Promise<void> {
    try {
      console.log('🔧 AI Assistant: Generating maintenance reminders...');

      // Get all user vehicles with batching to reduce API calls
      const allUsers = this.userService.getUsers()();
      const maintenanceReminders: any[] = [];

      // Process users in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < allUsers.length; i += batchSize) {
        const userBatch = allUsers.slice(i, i + batchSize);

        // Process batch concurrently
        const batchPromises = userBatch.map(async (user) => {
          if (!user.id) return [];

          try {
            // Get user's vehicles
            const userVehicles = await this.userVehicleService.getVehiclesForUser(user.id).toPromise() || [];

            const userReminders: any[] = [];
            for (const vehicle of userVehicles) {
              // Get motorcycle details (cached)
              const motorcycle = this.getMotorcycleById(vehicle.baseVehicleId);
              if (!motorcycle) continue;

              // Generate basic maintenance reminders
              const reminders = this.generateBasicMaintenanceReminders(vehicle, motorcycle, user);
              userReminders.push(...reminders);
            }
            return userReminders;
          } catch (error) {
            console.error(`Error checking maintenance for user ${user.id}:`, error);
            return [];
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        maintenanceReminders.push(...batchResults.flat());
      }

      // Process and send reminders (limit to avoid spam)
      const urgentReminders = maintenanceReminders
        .filter(r => r.priority === 'critical')
        .slice(0, 5); // Max 5 urgent reminders per run

      const recommendedReminders = maintenanceReminders
        .filter(r => r.priority === 'recommended')
        .slice(0, 10); // Max 10 recommended reminders per run

      const allRemindersToSend = [...urgentReminders, ...recommendedReminders];

      // Send reminders in batches to reduce load
      const reminderBatchSize = 3;
      for (let i = 0; i < allRemindersToSend.length; i += reminderBatchSize) {
        const reminderBatch = allRemindersToSend.slice(i, i + reminderBatchSize);

        // Send batch concurrently
        await Promise.all(reminderBatch.map(async (reminder) => {
          try {
            await this.notificationService.createMaintenanceReminder(
              reminder.customerId,
              reminder.vehicleInfo,
              reminder.serviceName,
              reminder.dueInfo,
              reminder.priority
            );

            console.log(`✅ Maintenance reminder sent for ${reminder.vehicleInfo.brand} ${reminder.vehicleInfo.model} - ${reminder.serviceName}`);

          } catch (error) {
            console.error(`Error sending maintenance reminder:`, error);
          }
        }));

        // Small delay between batches to prevent overwhelming
        if (i + reminderBatchSize < allRemindersToSend.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`🔧 AI Assistant: Sent ${allRemindersToSend.length} maintenance reminders (${urgentReminders.length} urgent, ${recommendedReminders.length} recommended)`);

    } catch (error) {
      console.error('Error generating maintenance reminders:', error);
    }
  }

  private generateBasicMaintenanceReminders(vehicle: UserVehicle, motorcycle: any, user: any): any[] {
    const reminders: any[] = [];
    const currentMileage = vehicle.mileageKm || 0;
    const vehicleAge = new Date().getFullYear() - motorcycle.year;

    // Basic maintenance reminders based on motorcycle age and mileage
    const basicServices = [
      {
        name: 'Cambio de aceite y filtro',
        priority: 'critical' as const,
        condition: currentMileage > 3000 || vehicleAge > 1
      },
      {
        name: 'Revisión general de frenos',
        priority: 'recommended' as const,
        condition: currentMileage > 5000 || vehicleAge > 2
      },
      {
        name: 'Revisión de cadena y piñones',
        priority: 'recommended' as const,
        condition: currentMileage > 8000 || vehicleAge > 3
      }
    ];

    for (const service of basicServices) {
      if (service.condition) {
        reminders.push({
          customerId: user.id,
          vehicleId: vehicle.id,
          serviceName: service.name,
          priority: service.priority,
          vehicleInfo: {
            brand: motorcycle.brand,
            model: motorcycle.model,
            year: motorcycle.year,
            plate: vehicle.plate
          },
          dueInfo: {
            dueMileage: currentMileage > 0 ? currentMileage + 2000 : undefined,
            currentMileage: currentMileage > 0 ? currentMileage : undefined
          }
        });
      }
    }

    return reminders;
  }

  private getMotorcycleById(motorcycleId: string): any {
    // This would need to be implemented to get motorcycle details
    // For now, return a mock motorcycle
    return {
      id: motorcycleId,
      brand: 'Yamaha',
      model: 'R15',
      year: 2020
    };
  }

  private async generateServiceOrderAlerts(): Promise<void> {
    try {
      // This would check for work order status changes and notify customers
      // Implementation depends on work order service integration
      console.log('📋 AI Assistant: Service order alerts not yet implemented');
    } catch (error) {
      console.error('Error generating service order alerts:', error);
    }
  }

  // General AI Chat/Assistant Features with Budget Circuit Breaker
  async processUserQuery(query: string, context?: string): Promise<string> {
    const aiContext = (context as 'chatbot' | 'productSearch' | 'scanner' | 'workOrder') || 'chatbot';
    const userId = 'anonymous'; // In a real implementation, get from auth service

    try {
      // Execute AI operation through budget circuit breaker
      const response = await this.budgetCircuitBreaker.executeAIOperation(
        async () => {
          const startTime = Date.now();

          // First, try fallback responses (free and instant)
          const fallbackMatch = await this.fallbackLibrary.findBestMatch(query, aiContext);
          if (fallbackMatch) {
            console.log('🤖 AI Assistant: Using fallback response for query');
            return await this.fallbackLibrary.getResponseWithDynamicData(fallbackMatch);
          }

          // Generate semantic cache key for intelligent caching
          const semanticKey = this.cacheService.generateSemanticKey(query, context || 'general');
          const cacheKey = `ai_query_${semanticKey}_${query.length}`;

          // Check cache first
          const cachedResponse = await this.cacheService.get<string>(cacheKey);
          if (cachedResponse) {
            console.log('🤖 AI Assistant: Using cached response for query');
            this.costMonitoring.trackFunctionInvocation(0.05, 0.05, 0); // Minimal cost for cache hit
            return cachedResponse;
          }

          const systemPrompt = `Eres un asistente inteligente para Blue Dragon Motors, un taller de motocicletas.
Puedes ayudar con:
- Gestión de inventario y productos
- Sistema de colas y citas
- Notificaciones y comunicaciones
- Reportes y análisis
- Recomendaciones operativas

${context ? `Contexto adicional: ${context}` : ''}

Proporciona respuestas útiles, específicas y accionables. Si no tienes suficiente información, solicita más detalles.`;

          const response = await this.groqService.generateResponse(query, systemPrompt);

          // Track AI usage costs
          const processingTime = Date.now() - startTime;
          this.costMonitoring.trackFunctionInvocation(
            processingTime / 1000, // Convert to seconds
            processingTime / 2000, // Rough CPU estimate
            0 // No network egress for internal processing
          );

          // Cache the response with semantic tags
          await this.cacheService.set(
            cacheKey,
            response,
            30 * 60 * 1000, // 30 minutes TTL
            'ai_assistant',
            undefined, // No version
            semanticKey,
            ['ai_response', context || 'general'],
            'medium' // Medium priority for AI responses
          );

          return response;
        },
        aiContext,
        userId,
        query
      );

      return response;
    } catch (error) {
      console.error('Error processing user query:', error);

      // If circuit breaker blocked the request, get fallback response
      if (error instanceof Error && error.name === 'CircuitBreakerError') {
        return await this.budgetCircuitBreaker.getFallbackResponse(query, aiContext);
      }

      // For other errors, still try fallback
      return await this.budgetCircuitBreaker.getFallbackResponse(query, aiContext);
    }
  }

  /**
   * Get circuit breaker status (delegated to service)
   */
  getCircuitBreakerStatus() {
    return this.budgetCircuitBreaker.getStatus();
  }

  /**
   * Manually reset circuit breaker (admin function)
   */
  resetCircuitBreaker(): void {
    this.budgetCircuitBreaker.resetCircuitBreaker();
  }

  /**
   * Update daily budget
   */
  updateDailyBudget(newBudget: number): void {
    this.budgetCircuitBreaker.updateThresholds({ dailyBudget: newBudget });
  }

  /**
   * Get fallback response when AI service is unavailable
   */
  private async getFallbackResponse(query: string, context?: string): Promise<string> {
    const queryContext = (context as 'chatbot' | 'productSearch' | 'scanner' | 'workOrder') || 'chatbot';

    try {
      // Use the new FallbackLibraryService
      const match = await this.fallbackLibrary.findBestMatch(query, queryContext);

      if (match) {
        const response = await this.fallbackLibrary.getResponseWithDynamicData(match);
        return response;
      }
    } catch (error) {
      console.error('Error getting fallback response:', error);
    }

    // Generic fallback
    return 'Lo siento, el servicio de asistencia IA no está disponible en este momento. Por favor, contacta al soporte técnico o intenta de nuevo más tarde.';
  }

  /**
   * Detect query context from keywords
   */
  private detectQueryContext(query: string): 'inventory' | 'queue' | 'maintenance' | 'general' {
    // This method is now handled by FallbackLibraryService
    // Keeping for backward compatibility
    const inventoryKeywords = ['stock', 'inventario', 'producto', 'repuesto', 'pieza'];
    const queueKeywords = ['cola', 'espera', 'turno', 'fila', 'atención'];
    const maintenanceKeywords = ['mantenimiento', 'revisión', 'servicio', 'reparación', 'cita'];

    if (inventoryKeywords.some(keyword => query.includes(keyword))) return 'inventory';
    if (queueKeywords.some(keyword => query.includes(keyword))) return 'queue';
    if (maintenanceKeywords.some(keyword => query.includes(keyword))) return 'maintenance';

    return 'general';
  }

  /**
   * Calculate match score between query and fallback response
   * Legacy method - now handled by FallbackLibraryService
   */
  private calculateMatchScore(query: string, response: FallbackResponse): number {
    // This method is now handled by FallbackLibraryService
    return 0;
  }

  /**
   * Personalize fallback response with query-specific details
   * Legacy method - now handled by FallbackLibraryService
   */
  private personalizeFallbackResponse(template: string, originalQuery: string): string {
    // Dynamic personalization is now handled by FallbackLibraryService
    return template;
  }

  /**
   * Add new fallback response to library
   */
  addFallbackResponse(response: Omit<FallbackResponse, 'id' | 'lastUsed' | 'successRate' | 'usageCount' | 'createdAt' | 'updatedAt'>): void {
    // Use the new FallbackLibraryService
    this.fallbackLibrary.addResponse({
      ...response,
      context: response.context as 'chatbot' | 'productSearch' | 'scanner' | 'workOrder',
      keywords: (response as any).keywords || []
    });
  }

  /**
   * Get fallback library statistics
   */
  getFallbackStats(): { totalResponses: number; categories: Record<string, number>; avgSuccessRate: number } {
    const stats = this.fallbackLibrary.getStats();
    return {
      totalResponses: stats.totalResponses,
      categories: stats.categories,
      avgSuccessRate: stats.avgSuccessRate
    };
  }

  // Automated Report Generation
  async generateDailyReport(): Promise<AIReport> {
    try {
      const [inventoryReport, queueReport] = await Promise.all([
        this.analyzeInventoryHealth(),
        this.analyzeQueueEfficiency()
      ]);

      const dailyData = {
        date: new Date().toISOString().split('T')[0],
        inventory: inventoryReport.data,
        queue: queueReport.data,
        notifications: {
          totalSent: this.notificationService.getSystemNotifications()().length,
          unreadCount: this.notificationService.getUnreadCount()
        }
      };

      const reportPrompt = `
Genera un reporte diario ejecutivo para Blue Dragon Motors basado en estos datos:

${JSON.stringify(dailyData, null, 2)}

Incluye:
1. Resumen ejecutivo del día
2. Métricas clave de rendimiento
3. Alertas y problemas identificados
4. Recomendaciones para el día siguiente
5. Tendencias y oportunidades

Mantén un tono profesional pero actionable.`;

      const aiSummary = await this.groqService.generateResponse(
        reportPrompt,
        'Genera un reporte ejecutivo diario completo y profesional'
      );

      const allInsights = [...inventoryReport.insights, ...queueReport.insights];
      const criticalInsights = allInsights.filter(i => i.priority === 'critical' || i.priority === 'high');

      return {
        title: 'Reporte Ejecutivo Diario',
        summary: aiSummary,
        insights: criticalInsights,
        recommendations: [
          ...inventoryReport.recommendations.slice(0, 2),
          ...queueReport.recommendations.slice(0, 2)
        ],
        generatedAt: new Date(),
        data: dailyData
      };

    } catch (error) {
      console.error('Error generating daily report:', error);
      throw error;
    }
  }

  // Predictive Analytics (Basic)
  async predictDemand(productId: string, daysAhead: number = 7): Promise<any> {
    try {
      const movements = await this.inventoryReportsService['stockMovementService'].getMovementsByProduct(productId);
      const recentMovements = movements
        .filter(m => m.type === 'sale')
        .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())
        .slice(0, 30); // Last 30 sales

      const predictionPrompt = `
Analiza estos datos de ventas recientes para predecir la demanda futura:

${JSON.stringify(recentMovements.map(m => ({
  date: m.createdAt.toDate().toISOString().split('T')[0],
  quantity: m.quantity
})), null, 2)}

Producto ID: ${productId}
Días a predecir: ${daysAhead}

Proporciona:
1. Tendencia de ventas (creciente/decreciente/estable)
2. Predicción de demanda para los próximos ${daysAhead} días
3. Nivel de confianza en la predicción
4. Factores que podrían afectar la demanda
5. Recomendaciones de stock basado en la predicción
`;

      const prediction = await this.groqService.generateResponse(
        predictionPrompt,
        'Realiza análisis predictivo de demanda de productos'
      );

      return {
        productId,
        prediction,
        confidence: 'medium', // Could be calculated based on data consistency
        generatedAt: new Date()
      };

    } catch (error) {
      console.error('Error predicting demand:', error);
      throw error;
    }
  }

  // Integration Methods for Components
  getInventoryInsights(): Observable<AIInsight[]> {
    return from(this.analyzeInventoryHealth()).pipe(
      map(report => report.insights)
    );
  }

  getQueueInsights(): Observable<AIInsight[]> {
    return from(this.analyzeQueueEfficiency()).pipe(
      map(report => report.insights)
    );
  }

  getDailyReport(): Observable<AIReport> {
    return from(this.generateDailyReport());
  }
}