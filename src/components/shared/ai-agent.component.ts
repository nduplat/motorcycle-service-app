import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface AIInsight {
  type: 'recommendation' | 'alert' | 'analysis' | 'prediction';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'inventory' | 'queue' | 'notifications' | 'operations' | 'financial' | 'maintenance';
  actionable: boolean;
  suggestedActions?: string[];
  data?: any;
}

export interface AIReport {
  title: string;
  summary: string;
  insights: AIInsight[];
  recommendations: string[];
  generatedAt: Date;
  data: any;
}

export interface MaintenanceAlert {
  customerId: string;
  vehicleId: string;
  vehicleInfo: {
    brand: string;
    model: string;
    year: number;
    plate?: string;
    displacementCc?: number;
  };
  serviceName: string;
  serviceType: 'maintenance' | 'inspection' | 'repair';
  priority: 'critical' | 'recommended' | 'optional';
  dueInfo: {
    dueType: 'overdue' | 'due_soon' | 'upcoming';
    dueDate?: Date;
    dueMileage?: number;
    currentMileage?: number;
    daysSinceLastService?: number;
  };
  estimatedCost?: number;
  urgencyScore: number; // 0-100
}

@Injectable({
  providedIn: 'root'
})
export class AIAssistantService {
  constructor() {
    console.log('🤖 AI Assistant: Service initialized (basic mode)');
  }

  // ========== BASIC IMPLEMENTATIONS ==========

  async analyzeInventoryHealth(): Promise<AIReport> {
    return {
      title: 'Análisis de Salud del Inventario',
      summary: 'Servicio de IA no disponible. Análisis básico de inventario.',
      insights: [],
      recommendations: ['Revisar niveles de stock manualmente'],
      generatedAt: new Date(),
      data: {}
    };
  }

  async analyzeQueueEfficiency(): Promise<AIReport> {
    return {
      title: 'Análisis de Eficiencia de Cola',
      summary: 'Servicio de IA no disponible. Análisis básico de cola.',
      insights: [],
      recommendations: ['Monitorear tiempos de espera manualmente'],
      generatedAt: new Date(),
      data: {}
    };
  }

  // REMOVED: AI services eliminated for cost savings
  // async generateMaintenanceReminders(): Promise<void> {
  //   console.log('🔧 Maintenance reminders: Service not available');
  // }

  async generateSmartNotifications(): Promise<void> {
    console.log('🔔 Smart notifications: Service not available');
  }

  async processUserQuery(query: string): Promise<string> {
    return 'Servicio de asistencia IA no disponible temporalmente.';
  }

  async generateDailyReport(): Promise<AIReport> {
    return {
      title: 'Reporte Ejecutivo Diario',
      summary: 'Servicio de IA no disponible. Reporte básico.',
      insights: [],
      recommendations: ['Implementar análisis automático'],
      generatedAt: new Date(),
      data: {}
    };
  }

  async predictDemand(productId: string): Promise<any> {
    return {
      productId,
      prediction: 'Análisis predictivo no disponible',
      confidence: 'low',
      generatedAt: new Date()
    };
  }

  // ========== OBSERVABLE METHODS ==========

  getInventoryInsights(): Observable<AIInsight[]> {
    return of([]);
  }

  getQueueInsights(): Observable<AIInsight[]> {
    return of([]);
  }

  getDailyReport(): Observable<AIReport> {
    return of({
      title: 'Reporte Ejecutivo Diario',
      summary: 'Servicio no disponible',
      insights: [],
      recommendations: [],
      generatedAt: new Date(),
      data: {}
    });
  }

  getMaintenanceInsights(): Observable<AIInsight[]> {
    return of([]);
  }

  // ========== UTILITY METHODS ==========

  clearCache(): void {
    console.log('AI Assistant cache cleared');
  }

  isAIAvailable(): boolean {
    return false;
  }
}