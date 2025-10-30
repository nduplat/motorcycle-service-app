/**
 * Queue Analytics Service
 * Tracks user behavior and flow completion in queue join process
 */

import { Injectable, signal } from '@angular/core';

export interface AnalyticsEvent {
  eventType: 'step_started' | 'step_completed' | 'step_failed' | 'flow_abandoned' | 'flow_completed';
  step: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  metadata?: any;
}

export interface FlowMetrics {
  totalAttempts: number;
  completedFlows: number;
  abandonedFlows: number;
  averageCompletionTime: number;
  stepMetrics: Map<string, StepMetrics>;
}

export interface StepMetrics {
  stepName: string;
  attempts: number;
  completions: number;
  failures: number;
  averageTime: number;
  abandonmentRate: number;
}

@Injectable({
  providedIn: 'root'
})
export class QueueAnalyticsService {
  private events = signal<AnalyticsEvent[]>([]);
  private currentSession: {
    sessionId: string;
    userId?: string;
    startTime: Date;
    currentStep: string;
    stepStartTime: Date;
    completedSteps: string[];
  } | null = null;

  // ========== SESSION MANAGEMENT ==========

  startSession(userId?: string): string {
    const sessionId = this.generateSessionId();
    
    this.currentSession = {
      sessionId,
      userId,
      startTime: new Date(),
      currentStep: 'welcome',
      stepStartTime: new Date(),
      completedSteps: []
    };

    this.trackEvent({
      eventType: 'step_started',
      step: 'welcome',
      timestamp: new Date(),
      userId,
      sessionId
    });

    console.log('📊 Analytics: Session started', sessionId);
    return sessionId;
  }

  endSession(reason: 'completed' | 'abandoned') {
    if (!this.currentSession) return;

    const duration = Date.now() - this.currentSession.startTime.getTime();

    this.trackEvent({
      eventType: reason === 'completed' ? 'flow_completed' : 'flow_abandoned',
      step: this.currentSession.currentStep,
      timestamp: new Date(),
      userId: this.currentSession.userId,
      sessionId: this.currentSession.sessionId,
      metadata: {
        duration,
        completedSteps: this.currentSession.completedSteps,
        abandonedAt: reason === 'abandoned' ? this.currentSession.currentStep : null
      }
    });

    console.log(`📊 Analytics: Session ended - ${reason}`, {
      duration: this.formatDuration(duration),
      steps: this.currentSession.completedSteps.length
    });

    this.currentSession = null;
  }

  // ========== STEP TRACKING ==========

  startStep(step: string) {
    if (!this.currentSession) return;

    this.currentSession.currentStep = step;
    this.currentSession.stepStartTime = new Date();

    this.trackEvent({
      eventType: 'step_started',
      step,
      timestamp: new Date(),
      userId: this.currentSession.userId,
      sessionId: this.currentSession.sessionId
    });

    console.log('📊 Analytics: Step started', step);
  }

  completeStep(step: string, metadata?: any) {
    if (!this.currentSession) return;

    const stepDuration = Date.now() - this.currentSession.stepStartTime.getTime();
    
    this.currentSession.completedSteps.push(step);

    this.trackEvent({
      eventType: 'step_completed',
      step,
      timestamp: new Date(),
      userId: this.currentSession.userId,
      sessionId: this.currentSession.sessionId,
      metadata: {
        duration: stepDuration,
        ...metadata
      }
    });

    console.log('📊 Analytics: Step completed', step, this.formatDuration(stepDuration));
  }

  failStep(step: string, reason: string, metadata?: any) {
    if (!this.currentSession) return;

    this.trackEvent({
      eventType: 'step_failed',
      step,
      timestamp: new Date(),
      userId: this.currentSession.userId,
      sessionId: this.currentSession.sessionId,
      metadata: {
        reason,
        ...metadata
      }
    });

    console.log('📊 Analytics: Step failed', step, reason);
  }

  // ========== METRICS CALCULATION ==========

  getFlowMetrics(): FlowMetrics {
    const allEvents = this.events();
    
    const totalAttempts = new Set(
      allEvents
        .filter(e => e.eventType === 'step_started' && e.step === 'welcome')
        .map(e => e.sessionId)
    ).size;

    const completedFlows = allEvents.filter(
      e => e.eventType === 'flow_completed'
    ).length;

    const abandonedFlows = allEvents.filter(
      e => e.eventType === 'flow_abandoned'
    ).length;

    const completionTimes = allEvents
      .filter(e => e.eventType === 'flow_completed' && e.metadata?.duration)
      .map(e => e.metadata.duration);

    const averageCompletionTime = completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

    const stepMetrics = this.calculateStepMetrics(allEvents);

    return {
      totalAttempts,
      completedFlows,
      abandonedFlows,
      averageCompletionTime,
      stepMetrics
    };
  }

  private calculateStepMetrics(events: AnalyticsEvent[]): Map<string, StepMetrics> {
    const metricsMap = new Map<string, StepMetrics>();
    const steps = ['phone', 'motorcycle_check', 'service', 'motorcycle', 'license_plate', 'mileage', 'confirm'];

    steps.forEach(step => {
      const stepEvents = events.filter(e => e.step === step);
      
      const attempts = stepEvents.filter(e => e.eventType === 'step_started').length;
      const completions = stepEvents.filter(e => e.eventType === 'step_completed').length;
      const failures = stepEvents.filter(e => e.eventType === 'step_failed').length;

      const durations = stepEvents
        .filter(e => e.eventType === 'step_completed' && e.metadata?.duration)
        .map(e => e.metadata.duration);

      const averageTime = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

      const abandonments = events.filter(
        e => e.eventType === 'flow_abandoned' && e.step === step
      ).length;

      const abandonmentRate = attempts > 0 ? (abandonments / attempts) * 100 : 0;

      metricsMap.set(step, {
        stepName: step,
        attempts,
        completions,
        failures,
        averageTime,
        abandonmentRate
      });
    });

    return metricsMap;
  }

  // ========== ANALYTICS REPORTING ==========

  getAbandonmentHotspots(): { step: string; rate: number; count: number }[] {
    const metrics = this.getFlowMetrics();
    const hotspots: { step: string; rate: number; count: number }[] = [];

    metrics.stepMetrics.forEach((stepMetric, stepName) => {
      if (stepMetric.abandonmentRate > 20) { // More than 20% abandonment
        hotspots.push({
          step: stepName,
          rate: stepMetric.abandonmentRate,
          count: Math.round((stepMetric.attempts * stepMetric.abandonmentRate) / 100)
        });
      }
    });

    return hotspots.sort((a, b) => b.rate - a.rate);
  }

  getConversionFunnel(): { step: string; completions: number; dropoff: number }[] {
    const metrics = this.getFlowMetrics();
    const funnel: { step: string; completions: number; dropoff: number }[] = [];

    let previousCompletions = metrics.totalAttempts;

    metrics.stepMetrics.forEach((stepMetric, stepName) => {
      const dropoff = previousCompletions > 0
        ? ((previousCompletions - stepMetric.completions) / previousCompletions) * 100
        : 0;

      funnel.push({
        step: stepName,
        completions: stepMetric.completions,
        dropoff
      });

      previousCompletions = stepMetric.completions;
    });

    return funnel;
  }

  generateReport(): string {
    const metrics = this.getFlowMetrics();
    const hotspots = this.getAbandonmentHotspots();
    const funnel = this.getConversionFunnel();

    let report = '📊 QUEUE JOIN ANALYTICS REPORT\n\n';
    
    report += '=== OVERVIEW ===\n';
    report += `Total Attempts: ${metrics.totalAttempts}\n`;
    report += `Completed: ${metrics.completedFlows} (${this.getCompletionRate(metrics)}%)\n`;
    report += `Abandoned: ${metrics.abandonedFlows} (${this.getAbandonmentRate(metrics)}%)\n`;
    report += `Avg Completion Time: ${this.formatDuration(metrics.averageCompletionTime)}\n\n`;

    if (hotspots.length > 0) {
      report += '=== ABANDONMENT HOTSPOTS ===\n';
      hotspots.forEach(h => {
        report += `${h.step}: ${h.rate.toFixed(1)}% (${h.count} users)\n`;
      });
      report += '\n';
    }

    report += '=== CONVERSION FUNNEL ===\n';
    funnel.forEach(f => {
      report += `${f.step}: ${f.completions} completions (${f.dropoff.toFixed(1)}% dropoff)\n`;
    });

    return report;
  }

  // ========== UTILITY METHODS ==========

  private trackEvent(event: AnalyticsEvent) {
    this.events.update(events => [...events, event]);
    
    // Persist to localStorage for analysis
    try {
      const stored = localStorage.getItem('queue_analytics') || '[]';
      const allEvents = JSON.parse(stored);
      allEvents.push({
        ...event,
        timestamp: event.timestamp.toISOString()
      });
      localStorage.setItem('queue_analytics', JSON.stringify(allEvents));
    } catch (error) {
      console.error('Error persisting analytics:', error);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  private getCompletionRate(metrics: FlowMetrics): number {
    if (metrics.totalAttempts === 0) return 0;
    return ((metrics.completedFlows / metrics.totalAttempts) * 100).toFixed(1) as any;
  }

  private getAbandonmentRate(metrics: FlowMetrics): number {
    if (metrics.totalAttempts === 0) return 0;
    return ((metrics.abandonedFlows / metrics.totalAttempts) * 100).toFixed(1) as any;
  }

  // ========== EXPORT DATA ==========

  exportAnalytics(): string {
    const events = this.events();
    return JSON.stringify(events, null, 2);
  }

  clearAnalytics() {
    this.events.set([]);
    localStorage.removeItem('queue_analytics');
    console.log('📊 Analytics: Data cleared');
  }
}