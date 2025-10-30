import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy, signal, computed, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { FormsModule } from '@angular/forms';
import { WorkshopCapacityService } from '../../../services/workshop-capacity.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-capacity-heatmap',
  templateUrl: './capacity-heatmap.component.html',
  styleUrls: ['./capacity-heatmap.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule,
    MatTabsModule,
    FormsModule
  ],
  standalone: true
})
export class CapacityHeatmapComponent implements OnInit, OnDestroy {
  private capacityService = inject(WorkshopCapacityService);
  private subscription = new Subscription();

  // Selected date for analysis
  selectedDate = signal<Date>(new Date());

  // View mode: 'hourly' or 'daily'
  viewMode = signal<'hourly' | 'daily'>('hourly');

  // Heatmap data
  heatmapData = signal<Array<{
    hour: number;
    day: string;
    utilization: number;
    appointments: number;
    workOrders: number;
  }>>([]);

  // Computed statistics
  averageUtilization = computed(() => {
    const data = this.heatmapData();
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, item) => acc + item.utilization, 0);
    return sum / data.length;
  });

  maxUtilization = computed(() => {
    const data = this.heatmapData();
    if (data.length === 0) return 0;
    return Math.max(...data.map(item => item.utilization));
  });

  // Peak identification
  peakHours = signal<Array<{
    hour: number;
    utilization: number;
    intensity: 'low' | 'medium' | 'high' | 'critical';
  }>>([]);

  // Weekly pattern
  weeklyPattern = signal<{ [key: string]: number }>({});

  // Loading state
  isLoading = signal(false);

  ngOnInit() {
    this.loadHeatmapData();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  onDateChange(date: Date) {
    this.selectedDate.set(date);
    this.loadHeatmapData();
  }

  onViewModeChange(mode: 'hourly' | 'daily') {
    this.viewMode.set(mode);
    this.loadHeatmapData();
  }

  private loadHeatmapData() {
    this.isLoading.set(true);

    if (this.viewMode() === 'hourly') {
      this.loadHourlyData();
    } else {
      this.loadDailyData();
    }
  }

  private loadHourlyData() {
    const date = this.selectedDate();
    const data: Array<{
      hour: number;
      day: string;
      utilization: number;
      appointments: number;
      workOrders: number;
    }> = [];

    // Generate data for 24 hours
    for (let hour = 0; hour < 24; hour++) {
      const hourDate = new Date(date);
      hourDate.setHours(hour, 0, 0, 0);

      // In a real implementation, this would fetch actual data
      // For now, simulate realistic workshop patterns
      const baseUtilization = this.getSimulatedUtilization(hour);
      const appointments = Math.floor(baseUtilization * 0.6);
      const workOrders = Math.floor(baseUtilization * 0.4);

      data.push({
        hour,
        day: date.toLocaleDateString('es-ES', { weekday: 'long' }),
        utilization: baseUtilization,
        appointments,
        workOrders
      });
    }

    this.heatmapData.set(data);
    this.identifyPeaks(data);
    this.isLoading.set(false);
  }

  private loadDailyData() {
    // For daily view, show last 7 days
    const data: Array<{
      hour: number;
      day: string;
      utilization: number;
      appointments: number;
      workOrders: number;
    }> = [];

    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const dayDate = new Date(this.selectedDate());
      dayDate.setDate(dayDate.getDate() - dayOffset);
      const dayName = dayDate.toLocaleDateString('es-ES', { weekday: 'short' });

      // Aggregate daily data (simulated)
      const dailyUtilization = Math.floor(Math.random() * 100);
      const appointments = Math.floor(dailyUtilization * 0.6);
      const workOrders = Math.floor(dailyUtilization * 0.4);

      data.push({
        hour: dayOffset, // Using hour field for day index
        day: dayName,
        utilization: dailyUtilization,
        appointments,
        workOrders
      });
    }

    this.heatmapData.set(data);
    this.identifyPeaks(data);
    this.isLoading.set(false);
  }

  private getSimulatedUtilization(hour: number): number {
    // Simulate realistic workshop utilization patterns
    // Peak hours: 9-12, 14-17
    // Low hours: early morning, lunch, evening
    let baseUtilization = 20; // Base load

    if (hour >= 9 && hour <= 12) {
      baseUtilization += 60 + Math.random() * 20; // Morning peak
    } else if (hour >= 14 && hour <= 17) {
      baseUtilization += 50 + Math.random() * 25; // Afternoon peak
    } else if (hour >= 7 && hour <= 8) {
      baseUtilization += 20 + Math.random() * 15; // Early morning
    } else if (hour >= 18 && hour <= 19) {
      baseUtilization += 15 + Math.random() * 10; // Late afternoon
    } else {
      baseUtilization += Math.random() * 15; // Off-peak
    }

    return Math.min(100, Math.max(0, baseUtilization));
  }

  private identifyPeaks(data: Array<{
    hour: number;
    day: string;
    utilization: number;
    appointments: number;
    workOrders: number;
  }>) {
    const peaks = data
      .filter(item => item.utilization >= 70)
      .sort((a, b) => b.utilization - a.utilization)
      .slice(0, 5) // Top 5 peaks
      .map(item => ({
        hour: item.hour,
        utilization: item.utilization,
        intensity: this.getIntensity(item.utilization)
      }));

    this.peakHours.set(peaks);
  }

  private getIntensity(utilization: number): 'low' | 'medium' | 'high' | 'critical' {
    if (utilization >= 90) return 'critical';
    if (utilization >= 80) return 'high';
    if (utilization >= 70) return 'medium';
    return 'low';
  }

  getHeatmapColor(utilization: number): string {
    if (utilization >= 90) return '#dc2626'; // red-600
    if (utilization >= 80) return '#ea580c'; // orange-600
    if (utilization >= 70) return '#ca8a04'; // yellow-600
    if (utilization >= 60) return '#16a34a'; // green-600
    if (utilization >= 40) return '#0891b2'; // cyan-600
    if (utilization >= 20) return '#7c3aed'; // violet-600
    return '#e5e7eb'; // gray-200
  }

  getIntensityColor(intensity: string): string {
    switch (intensity) {
      case 'critical': return 'warn';
      case 'high': return 'accent';
      case 'medium': return 'primary';
      default: return '';
    }
  }

  formatHour(hour: number): string {
    if (this.viewMode() === 'daily') {
      return hour.toString(); // For daily view, hour represents day offset
    }
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  getPeakDescription(peak: any): string {
    if (this.viewMode() === 'daily') {
      return `Día ${peak.hour + 1}: ${peak.utilization.toFixed(1)}%`;
    }
    return `${peak.hour}:00 - ${peak.utilization.toFixed(1)}%`;
  }

  refreshData() {
    this.loadHeatmapData();
  }
}