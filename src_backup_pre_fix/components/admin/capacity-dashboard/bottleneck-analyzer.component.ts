import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { WorkshopCapacityService } from '../../../services/workshop-capacity.service';
import { Subscription, interval } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-bottleneck-analyzer',
  templateUrl: './bottleneck-analyzer.component.html',
  styleUrls: ['./bottleneck-analyzer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatDividerModule,
    MatExpansionModule,
    MatListModule
  ],
  standalone: true
})
export class BottleneckAnalyzerComponent implements OnInit, OnDestroy {
  private capacityService = inject(WorkshopCapacityService);
  private subscription = new Subscription();

  // Bottleneck analysis data
  bottleneckAnalysis = signal<{
    bottlenecks: Array<{
      type: 'technician' | 'time_slot' | 'equipment' | 'process';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      impact: number;
      recommendations: string[];
    }>;
    overallEfficiency: number;
    criticalBottlenecks: number;
  } | null>(null);

  // Optimization suggestions
  optimizationSuggestions = signal<Array<{
    category: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    potentialImpact: string;
    implementationEffort: 'low' | 'medium' | 'high';
    actionable: boolean;
  }>>([]);

  // Loading state
  isLoading = signal(false);

  // Last analysis timestamp
  lastAnalysisTime = signal<Date | null>(null);

  ngOnInit() {
    // Real-time bottleneck analysis every 2 minutes
    this.subscription.add(
      interval(120000).pipe(
        startWith(0),
        switchMap(() => this.capacityService.getBottleneckAnalysis())
      ).subscribe(analysis => {
        this.bottleneckAnalysis.set(analysis);
        this.generateOptimizationSuggestions(analysis);
        this.lastAnalysisTime.set(new Date());
      })
    );

    // Initial load
    this.capacityService.getBottleneckAnalysis().subscribe(analysis => {
      this.bottleneckAnalysis.set(analysis);
      this.generateOptimizationSuggestions(analysis);
      this.lastAnalysisTime.set(new Date());
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private generateOptimizationSuggestions(analysis: any) {
    const suggestions: Array<{
      category: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      title: string;
      description: string;
      potentialImpact: string;
      implementationEffort: 'low' | 'medium' | 'high';
      actionable: boolean;
    }> = [];

    // Generate suggestions based on bottlenecks
    analysis.bottlenecks.forEach((bottleneck: any) => {
      switch (bottleneck.type) {
        case 'technician':
          suggestions.push({
            category: 'Recursos Humanos',
            priority: bottleneck.severity,
            title: 'Optimización de Asignación de Técnicos',
            description: 'Reasignar tareas entre técnicos para equilibrar la carga de trabajo y reducir cuellos de botella.',
            potentialImpact: `Reducir tiempo de espera en ${bottleneck.impact * 2} minutos por tarea`,
            implementationEffort: 'medium',
            actionable: true
          });

          if (bottleneck.severity === 'critical') {
            suggestions.push({
              category: 'Recursos Humanos',
              priority: 'high',
              title: 'Contratación de Personal Adicional',
              description: 'Considerar contratar técnicos adicionales para manejar la carga de trabajo actual.',
              potentialImpact: 'Aumentar capacidad en 25-30%',
              implementationEffort: 'high',
              actionable: false
            });
          }
          break;

        case 'time_slot':
          suggestions.push({
            category: 'Programación',
            priority: bottleneck.severity,
            title: 'Reprogramación de Citas',
            description: 'Reorganizar citas para distribuir mejor la carga de trabajo a lo largo del día.',
            potentialImpact: 'Reducir picos de demanda en 15-20%',
            implementationEffort: 'low',
            actionable: true
          });
          break;

        case 'process':
          suggestions.push({
            category: 'Procesos',
            priority: bottleneck.severity,
            title: 'Optimización de Procesos de Inventario',
            description: 'Implementar órdenes de compra automáticas y mejorar la gestión de proveedores.',
            potentialImpact: 'Reducir tiempo de espera de partes en 40%',
            implementationEffort: 'medium',
            actionable: true
          });
          break;
      }
    });

    // General efficiency suggestions
    if (analysis.overallEfficiency < 70) {
      suggestions.push({
        category: 'Eficiencia General',
        priority: 'medium',
        title: 'Análisis de Eficiencia Operacional',
        description: 'Realizar un análisis detallado de los procesos para identificar ineficiencias.',
        potentialImpact: 'Mejorar eficiencia general en 10-15%',
        implementationEffort: 'medium',
        actionable: true
      });
    }

    // Sort by priority
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    suggestions.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    this.optimizationSuggestions.set(suggestions);
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#ca8a04';
      case 'low': return '#16a34a';
      default: return '#6b7280';
    }
  }

  getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'check_circle';
      default: return 'help';
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'critical': return 'warn';
      case 'high': return 'accent';
      case 'medium': return 'primary';
      case 'low': return '';
      default: return '';
    }
  }

  getEffortColor(effort: string): string {
    switch (effort) {
      case 'high': return 'warn';
      case 'medium': return 'accent';
      case 'low': return 'primary';
      default: return '';
    }
  }

  getBottleneckTypeLabel(type: string): string {
    switch (type) {
      case 'technician': return 'Técnicos';
      case 'time_slot': return 'Horarios';
      case 'equipment': return 'Equipos';
      case 'process': return 'Procesos';
      default: return type;
    }
  }

  getEfficiencyColor(efficiency: number): string {
    if (efficiency >= 80) return '#16a34a';
    if (efficiency >= 60) return '#ca8a04';
    if (efficiency >= 40) return '#ea580c';
    return '#dc2626';
  }

  getEfficiencyStatus(efficiency: number): string {
    if (efficiency >= 80) return 'Excelente';
    if (efficiency >= 60) return 'Buena';
    if (efficiency >= 40) return 'Regular';
    return 'Crítica';
  }

  refreshAnalysis() {
    this.isLoading.set(true);
    this.capacityService.getBottleneckAnalysis().subscribe(analysis => {
      this.bottleneckAnalysis.set(analysis);
      this.generateOptimizationSuggestions(analysis);
      this.lastAnalysisTime.set(new Date());
      this.isLoading.set(false);
    });
  }

  implementSuggestion(suggestion: any) {
    // In a real implementation, this would trigger specific actions
    console.log('Implementing suggestion:', suggestion.title);
    // For now, just show an alert
    alert(`Implementando: ${suggestion.title}\n\n${suggestion.description}`);
  }
}