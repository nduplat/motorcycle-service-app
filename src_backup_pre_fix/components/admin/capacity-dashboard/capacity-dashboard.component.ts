import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { Chart, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { interval, Subscription, combineLatest, from } from 'rxjs';
import { startWith, switchMap, debounceTime } from 'rxjs/operators';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../firebase.config';

Chart.register(...registerables);

@Component({
  selector: 'app-capacity-dashboard',
  templateUrl: './capacity-dashboard.component.html',
  styleUrls: ['./capacity-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressBarModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    BaseChartDirective
  ],
  standalone: true
})
export class CapacityDashboardComponent implements OnInit, OnDestroy {
  private subscription = new Subscription();
  Math = Math; // Expose Math object to the template

  // Real-time capacity data
  currentCapacity = signal<{
    totalCapacity: number;
    usedCapacity: number;
    availableCapacity: number;
    utilizationRate: number;
    activeWorkOrders: number;
    scheduledAppointments: number;
    availableTechnicians: number;
  } | null>(null);

  // Capacity trend data for chart
  capacityTrendData = signal<any>({
    labels: [],
    datasets: [{
      label: 'Utilization Rate (%)',
      data: [],
      borderColor: 'rgb(75, 192, 192)',
      tension: 0.1
    }]
  });

  // Overload alerts
  overloadAlerts = signal<Array<{
    type: 'critical' | 'warning' | 'info';
    message: string;
    action?: string;
  }>>([]);

  // Chart options
  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Utilization (%)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time'
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const
      }
    }
  };

  ngOnInit() {
    // Set up real-time listener for workshop capacity changes
    const capacityQuery = query(
      collection(db, 'workshopCapacity'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    this.subscription.add(
      onSnapshot(capacityQuery, (snapshot) => {
        if (!snapshot.empty) {
          const latestCapacityDoc = snapshot.docs[0];
          const capacityData = latestCapacityDoc.data();

          // Transform the data to match our expected format
          const capacity = {
            totalCapacity: capacityData.totalCapacity || 0,
            usedCapacity: capacityData.usedCapacity || 0,
            availableCapacity: capacityData.availableCapacity || 0,
            utilizationRate: capacityData.utilizationRate || 0,
            activeWorkOrders: capacityData.activeWorkOrders || 0,
            scheduledAppointments: capacityData.scheduledAppointments || 0,
            availableTechnicians: capacityData.availableTechnicians || 0
          };

          this.currentCapacity.set(capacity);
          this.updateOverloadAlerts(capacity);
          this.updateTrendChart(capacity);
        }
      }, (error) => {
        console.error('Error listening to capacity changes:', error);
        // Fallback to polling if real-time fails
        this.setupPollingFallback();
      })
    );

    // Initial load as fallback
    const calculateCapacity = httpsCallable(functions, 'calculateWorkshopCapacity');
    from(calculateCapacity()).subscribe(capacity => {
      this.currentCapacity.set(capacity.data as any);
      this.updateOverloadAlerts(capacity.data as any);
      this.initializeTrendChart();
    });
  }

  private setupPollingFallback() {
    // Fallback polling every 5 minutes (reduced frequency)
    const calculateCapacity = httpsCallable(functions, 'calculateWorkshopCapacity');
    this.subscription.add(
      interval(300000).pipe( // 5 minutes
        startWith(0),
        switchMap(() => from(calculateCapacity()))
      ).subscribe(result => {
        const capacity = result.data as any;
        this.currentCapacity.set(capacity);
        this.updateOverloadAlerts(capacity);
        this.updateTrendChart(capacity);
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private updateOverloadAlerts(capacity: any) {
    const alerts: Array<{
      type: 'critical' | 'warning' | 'info';
      message: string;
      action?: string;
    }> = [];

    if (capacity.utilizationRate >= 90) {
      alerts.push({
        type: 'critical',
        message: 'Workshop is critically overloaded!',
        action: 'Consider rescheduling appointments or adding technicians'
      });
    } else if (capacity.utilizationRate >= 80) {
      alerts.push({
        type: 'warning',
        message: 'Workshop capacity is high',
        action: 'Monitor closely and prepare contingency plans'
      });
    }

    if (capacity.availableTechnicians === 0) {
      alerts.push({
        type: 'critical',
        message: 'No technicians available',
        action: 'All technicians are currently busy'
      });
    } else if (capacity.availableTechnicians <= 2) {
      alerts.push({
        type: 'warning',
        message: 'Limited technician availability',
        action: 'Only ' + capacity.availableTechnicians + ' technicians available'
      });
    }

    this.overloadAlerts.set(alerts);
  }

  private initializeTrendChart() {
    // Initialize with last 24 hours of data (simulated)
    const now = new Date();
    const labels = [];
    const data = [];

    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      labels.push(time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      // Simulate historical data - in real implementation, fetch from service
      data.push(Math.random() * 100);
    }

    this.capacityTrendData.set({
      labels,
      datasets: [{
        label: 'Utilization Rate (%)',
        data,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      }]
    });
  }

  private updateTrendChart(currentCapacity: any) {
    const currentData = this.capacityTrendData();
    const now = new Date();

    // Add new data point
    currentData.labels.push(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    currentData.datasets[0].data.push(currentCapacity.utilizationRate);

    // Keep only last 24 hours (24 data points)
    if (currentData.labels.length > 24) {
      currentData.labels.shift();
      currentData.datasets[0].data.shift();
    }

    this.capacityTrendData.set({ ...currentData });
  }

  getCapacityColor(utilizationRate: number): string {
    if (utilizationRate >= 90) return 'warn';
    if (utilizationRate >= 80) return 'accent';
    return 'primary';
  }

  getCapacityStatus(utilizationRate: number): string {
    if (utilizationRate >= 90) return 'Critical';
    if (utilizationRate >= 80) return 'High';
    if (utilizationRate >= 60) return 'Moderate';
    return 'Normal';
  }

  refreshData() {
    const calculateCapacity = httpsCallable(functions, 'calculateWorkshopCapacity');
    from(calculateCapacity()).subscribe(result => {
      const capacity = result.data as any;
      this.currentCapacity.set(capacity);
      this.updateOverloadAlerts(capacity);
    });
  }
}