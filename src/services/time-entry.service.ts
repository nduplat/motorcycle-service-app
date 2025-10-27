import { Injectable, signal, inject } from '@angular/core';
import { TimeEntry, WorkOrder, Timestamp, TimePause, TimeEntryMetrics, TechnicianMetrics } from '../models';
import { Observable, from, combineLatest, BehaviorSubject } from 'rxjs';
import { map, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { db } from '../firebase.config';
import { collection, getDocs, doc, addDoc, updateDoc, serverTimestamp, query, where, orderBy, limit, Timestamp as FirestoreTimestamp, onSnapshot } from 'firebase/firestore';
import { AuthService } from './auth.service';

const fromFirestore = <T>(snapshot: any): T => {
  const data = snapshot.data() as any;
  return { ...data, id: snapshot.id } as T;
};

@Injectable({
  providedIn: 'root'
})
export class TimeEntryService {
  private authService = inject(AuthService);
  private currentTimeEntry = signal<TimeEntry | null>(null);
  private timeEntryMetrics = signal<TimeEntryMetrics | null>(null);

  // Real-time subscription
  private realtimeSubscription: any = null;

  // Batch operations state
  private pendingOperations: Array<{
    type: 'start' | 'stop' | 'pause' | 'resume';
    technicianId: string;
    workOrderId?: string;
    reason?: string;
  }> = [];

  constructor() {
    this.startRealtimeUpdates();
    this.loadTimeEntryMetrics();
  }

  /**
   * Start a time entry for a work order
   */
  async startTimeEntry(workOrderId: string, technicianId: string): Promise<TimeEntry> {
    try {
      const currentUser = this.authService.currentUser();
      if (!currentUser) throw new Error('User not authenticated');

      // Check if there's already an active time entry
      const activeEntry = await this.getActiveTimeEntry(technicianId);
      if (activeEntry) {
        throw new Error('There is already an active time entry. Please stop the current timer first.');
      }

      const timeEntryData = {
        workOrderId,
        technicianId,
        startAt: FirestoreTimestamp.fromDate(new Date()),
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'timeEntries'), timeEntryData);
      const newEntry: TimeEntry = {
        ...timeEntryData,
        id: docRef.id,
        createdAt: FirestoreTimestamp.fromDate(new Date()) as any
      };

      this.currentTimeEntry.set(newEntry);
      return newEntry;
    } catch (error) {
      console.error('Error starting time entry:', error);
      throw error;
    }
  }

  /**
   * Stop the current active time entry
   */
  async stopTimeEntry(technicianId: string): Promise<TimeEntry | null> {
    try {
      const activeEntry = await this.getActiveTimeEntry(technicianId);
      if (!activeEntry) {
        return null;
      }

      const endTime = new Date();
      const startTime = activeEntry.startAt.toDate();
      const minutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));

      const updatedEntry: TimeEntry = {
        ...activeEntry,
        endAt: FirestoreTimestamp.fromDate(endTime),
        minutes
      };

      await updateDoc(doc(db, 'timeEntries', activeEntry.id), {
        endAt: FirestoreTimestamp.fromDate(endTime),
        minutes
      });

      this.currentTimeEntry.set(null);
      return updatedEntry;
    } catch (error) {
      console.error('Error stopping time entry:', error);
      throw error;
    }
  }

  /**
   * Get the current active time entry for a technician
   */
  async getActiveTimeEntry(technicianId: string): Promise<TimeEntry | null> {
    try {
      console.log('🔧 TimeEntryService: Building query for active time entry, technicianId:', technicianId);
      const q = query(
        collection(db, 'timeEntries'),
        where('technicianId', '==', technicianId),
        where('endAt', '==', null),
        orderBy('startAt', 'desc'),
        limit(1)
      );

      console.log('🔧 TimeEntryService: Executing getDocs for active time entry');
      const querySnapshot = await getDocs(q);
      console.log('🔧 TimeEntryService: getDocs completed, snapshot empty:', querySnapshot.empty);
      if (!querySnapshot.empty) {
        const entry = fromFirestore<TimeEntry>(querySnapshot.docs[0]);
        this.currentTimeEntry.set(entry);
        return entry;
      }

      this.currentTimeEntry.set(null);
      return null;
    } catch (error) {
      console.error('Error getting active time entry:', error);
      return null;
    }
  }

  /**
   * Get time entries for a work order
   */
  async getTimeEntriesForWorkOrder(workOrderId: string): Promise<TimeEntry[]> {
    try {
      const q = query(
        collection(db, 'timeEntries'),
        where('workOrderId', '==', workOrderId),
        orderBy('startAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => fromFirestore<TimeEntry>(doc));
    } catch (error) {
      console.error('Error getting time entries for work order:', error);
      return [];
    }
  }

  /**
   * Get time entries for a technician within a date range
   */
  async getTimeEntriesForTechnician(technicianId: string, startDate?: Date, endDate?: Date): Promise<TimeEntry[]> {
    try {
      let q = query(
        collection(db, 'timeEntries'),
        where('technicianId', '==', technicianId),
        orderBy('startAt', 'desc')
      );

      // Note: Firestore doesn't support range queries on different fields easily
      // For now, we'll get all and filter client-side
      const querySnapshot = await getDocs(q);
      let entries = querySnapshot.docs.map(doc => fromFirestore<TimeEntry>(doc));

      if (startDate) {
        entries = entries.filter(entry => entry.startAt.toDate() >= startDate);
      }

      if (endDate) {
        entries = entries.filter(entry => entry.startAt.toDate() <= endDate);
      }

      return entries;
    } catch (error) {
      console.error('Error getting time entries for technician:', error);
      return [];
    }
  }

  /**
   * Get current time entry signal
   */
  getCurrentTimeEntry() {
    return this.currentTimeEntry.asReadonly();
  }

  /**
   * Pause the current active time entry
   */
  async pauseTimeEntry(technicianId: string, reason?: string): Promise<TimeEntry | null> {
    try {
      const activeEntry = await this.getActiveTimeEntry(technicianId);
      if (!activeEntry) {
        return null;
      }

      const pauseData: TimePause = {
        pauseAt: FirestoreTimestamp.fromDate(new Date()),
        reason
      };

      const updatedPauses = [...(activeEntry.pauses || []), pauseData];

      await updateDoc(doc(db, 'timeEntries', activeEntry.id), {
        pauses: updatedPauses
      });

      const updatedEntry: TimeEntry = {
        ...activeEntry,
        pauses: updatedPauses
      };

      this.currentTimeEntry.set(updatedEntry);
      return updatedEntry;
    } catch (error) {
      console.error('Error pausing time entry:', error);
      throw error;
    }
  }

  /**
   * Resume the current paused time entry
   */
  async resumeTimeEntry(technicianId: string): Promise<TimeEntry | null> {
    try {
      const activeEntry = await this.getActiveTimeEntry(technicianId);
      if (!activeEntry || !activeEntry.pauses) {
        return null;
      }

      const lastPause = activeEntry.pauses[activeEntry.pauses.length - 1];
      if (!lastPause || lastPause.resumeAt) {
        // No active pause to resume
        return activeEntry;
      }

      const updatedPauses = [...activeEntry.pauses];
      updatedPauses[updatedPauses.length - 1] = {
        ...lastPause,
        resumeAt: FirestoreTimestamp.fromDate(new Date())
      };

      await updateDoc(doc(db, 'timeEntries', activeEntry.id), {
        pauses: updatedPauses
      });

      const updatedEntry: TimeEntry = {
        ...activeEntry,
        pauses: updatedPauses
      };

      this.currentTimeEntry.set(updatedEntry);
      return updatedEntry;
    } catch (error) {
      console.error('Error resuming time entry:', error);
      throw error;
    }
  }

  /**
   * Check if the current time entry is currently paused
   */
  isTimeEntryPaused(technicianId: string): boolean {
    const entry = this.currentTimeEntry();
    if (!entry || !entry.pauses) return false;

    const lastPause = entry.pauses[entry.pauses.length - 1];
    return lastPause && !lastPause.resumeAt;
  }

  /**
   * Calculate elapsed time for active entry, excluding paused periods
   */
  getElapsedTime(): number {
    const entry = this.currentTimeEntry();
    if (!entry) return 0;

    const startTime = entry.startAt.toDate();
    const now = new Date();
    let totalElapsed = now.getTime() - startTime.getTime();

    // Subtract paused time
    if (entry.pauses) {
      for (const pause of entry.pauses) {
        const pauseStart = pause.pauseAt.toDate();
        const pauseEnd = pause.resumeAt ? pause.resumeAt.toDate() : now;
        totalElapsed -= (pauseEnd.getTime() - pauseStart.getTime());
      }
    }

    return Math.floor(totalElapsed / (1000 * 60)); // minutes
  }

  /**
   * Get total paused time for current entry
   */
  getTotalPausedTime(): number {
    const entry = this.currentTimeEntry();
    if (!entry || !entry.pauses) return 0;

    let totalPaused = 0;
    const now = new Date();

    for (const pause of entry.pauses) {
      const pauseStart = pause.pauseAt.toDate();
      const pauseEnd = pause.resumeAt ? pause.resumeAt.toDate() : now;
      totalPaused += (pauseEnd.getTime() - pauseStart.getTime());
    }

    return Math.floor(totalPaused / (1000 * 60)); // minutes
  }

  /**
   * Get time entry metrics
   */
  getTimeEntryMetrics() {
    return this.timeEntryMetrics.asReadonly();
  }

  /**
   * Batch start time entries for multiple technicians
   */
  async batchStartTimeEntries(entries: Array<{ workOrderId: string; technicianId: string }>): Promise<TimeEntry[]> {
    try {
      const batchPromises = entries.map(({ workOrderId, technicianId }) =>
        this.startTimeEntry(workOrderId, technicianId)
      );

      const results = await Promise.allSettled(batchPromises);
      const successfulEntries: TimeEntry[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulEntries.push(result.value);
        } else {
          console.error(`Failed to start time entry for technician ${entries[index].technicianId}:`, result.reason);
        }
      });

      this.loadTimeEntryMetrics();
      return successfulEntries;
    } catch (error) {
      console.error('Error in batch start time entries:', error);
      throw error;
    }
  }

  /**
   * Batch stop time entries for multiple technicians
   */
  async batchStopTimeEntries(technicianIds: string[]): Promise<TimeEntry[]> {
    try {
      const batchPromises = technicianIds.map(technicianId =>
        this.stopTimeEntry(technicianId)
      );

      const results = await Promise.allSettled(batchPromises);
      const successfulEntries: TimeEntry[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          successfulEntries.push(result.value);
        } else if (result.status === 'rejected') {
          console.error(`Failed to stop time entry for technician ${technicianIds[index]}:`, result.reason);
        }
      });

      this.loadTimeEntryMetrics();
      return successfulEntries;
    } catch (error) {
      console.error('Error in batch stop time entries:', error);
      throw error;
    }
  }

  /**
   * Get time entries with advanced filtering
   */
  async getTimeEntriesWithFilters(filters: {
    technicianIds?: string[];
    workOrderIds?: string[];
    dateRange?: { start: Date; end: Date };
    hasPauses?: boolean;
    minDuration?: number;
    maxDuration?: number;
    limit?: number;
    offset?: number;
  }): Promise<TimeEntry[]> {
    try {
      let baseQuery = query(collection(db, 'timeEntries'), orderBy('startAt', 'desc'));

      // Apply filters
      if (filters.technicianIds && filters.technicianIds.length > 0) {
        baseQuery = query(baseQuery, where('technicianId', 'in', filters.technicianIds.slice(0, 10))); // Firestore 'in' limit
      }

      if (filters.limit) {
        baseQuery = query(baseQuery, limit(filters.limit));
      }

      const querySnapshot = await getDocs(baseQuery);
      let entries = querySnapshot.docs.map(doc => fromFirestore<TimeEntry>(doc));

      // Client-side filtering for complex queries
      if (filters.workOrderIds && filters.workOrderIds.length > 0) {
        entries = entries.filter(entry => filters.workOrderIds!.includes(entry.workOrderId));
      }

      if (filters.dateRange) {
        entries = entries.filter(entry => {
          const startDate = entry.startAt.toDate();
          return startDate >= filters.dateRange!.start && startDate <= filters.dateRange!.end;
        });
      }

      if (filters.hasPauses !== undefined) {
        entries = entries.filter(entry =>
          filters.hasPauses ? (entry.pauses && entry.pauses.length > 0) : (!entry.pauses || entry.pauses.length === 0)
        );
      }

      if (filters.minDuration !== undefined) {
        entries = entries.filter(entry => (entry.minutes || 0) >= filters.minDuration!);
      }

      if (filters.maxDuration !== undefined) {
        entries = entries.filter(entry => (entry.minutes || 0) <= filters.maxDuration!);
      }

      if (filters.offset) {
        entries = entries.slice(filters.offset);
      }

      return entries;
    } catch (error) {
      console.error('Error getting time entries with filters:', error);
      return [];
    }
  }

  // Real-time updates
  private startRealtimeUpdates(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    let queryConstraints: any[] = [];
    if (currentUser.role === 'technician') {
      queryConstraints = [where('technicianId', '==', currentUser.id)];
    }

    this.realtimeSubscription = onSnapshot(
      query(collection(db, 'timeEntries'), ...queryConstraints),
      (snapshot) => {
        // Update current time entry if it's in the snapshot
        const currentUser = this.authService.currentUser();
        if (currentUser) {
          const activeEntry = snapshot.docs
            .map(doc => fromFirestore<TimeEntry>(doc))
            .find(entry => entry.technicianId === currentUser.id && !entry.endAt);

          this.currentTimeEntry.set(activeEntry || null);
        }

        this.loadTimeEntryMetrics();
      },
      (error) => {
        console.error('Error in real-time time entries subscription:', error);
      }
    );
  }

  // Metrics calculation
  private async loadTimeEntryMetrics(): Promise<void> {
    try {
      const currentUser = this.authService.currentUser();
      if (!currentUser) return;

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get time entries for the current user in the last week
      const timeEntries = await this.getTimeEntriesForTechnician(currentUser.id, weekAgo, now);

      const totalHoursWorked = timeEntries.reduce((sum, entry) => sum + (entry.minutes || 0), 0) / 60;
      const averageDailyHours = totalHoursWorked / 7; // Assuming 7-day week
      const overtimeHours = Math.max(0, totalHoursWorked - (7 * 8)); // 8 hours per day

      // Calculate productive vs break time
      let productiveHours = 0;
      let breakHours = 0;

      timeEntries.forEach(entry => {
        const totalMinutes = entry.minutes || 0;
        const pausedMinutes = entry.pauses ? entry.pauses.reduce((sum, pause) => {
          const pauseStart = pause.pauseAt.toDate();
          const pauseEnd = pause.resumeAt ? pause.resumeAt.toDate() : (entry.endAt ? entry.endAt.toDate() : new Date());
          return sum + (pauseEnd.getTime() - pauseStart.getTime()) / (1000 * 60);
        }, 0) : 0;

        productiveHours += (totalMinutes - pausedMinutes) / 60;
        breakHours += pausedMinutes / 60;
      });

      const efficiencyRate = totalHoursWorked > 0 ? (productiveHours / totalHoursWorked) * 100 : 0;

      // Get work orders completed in the period
      const workOrdersQuery = query(
        collection(db, 'workOrders'),
        where('assignedTo', '==', currentUser.id),
        where('status', '==', 'delivered'),
        where('updatedAt', '>=', FirestoreTimestamp.fromDate(weekAgo)),
        where('updatedAt', '<=', FirestoreTimestamp.fromDate(now))
      );

      const workOrdersSnapshot = await getDocs(workOrdersQuery);
      const workOrdersCompleted = workOrdersSnapshot.size;
      const averageTimePerWorkOrder = workOrdersCompleted > 0 ? (totalHoursWorked * 60) / workOrdersCompleted : 0;

      const metrics: TimeEntryMetrics = {
        totalHoursWorked,
        averageDailyHours,
        overtimeHours,
        productiveHours,
        breakHours,
        efficiencyRate,
        technicianId: currentUser.id,
        periodStart: FirestoreTimestamp.fromDate(weekAgo),
        periodEnd: FirestoreTimestamp.fromDate(now),
        workOrdersCompleted,
        averageTimePerWorkOrder,
        updatedAt: FirestoreTimestamp.fromDate(now)
      };

      this.timeEntryMetrics.set(metrics);
    } catch (error) {
      console.error('Error loading time entry metrics:', error);
    }
  }
}