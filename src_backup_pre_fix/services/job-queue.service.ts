import { Injectable, signal, inject } from '@angular/core';
import { Job, JobType, JobStatus, JobPriority, JobData, JobStats, JobRetryConfig } from '../models';
import { Timestamp } from 'firebase/firestore';
import { Observable, from, BehaviorSubject, combineLatest } from 'rxjs';
import { map, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { db } from '../firebase.config';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp, DocumentData, DocumentSnapshot, query, where, orderBy, limit, startAfter, onSnapshot, writeBatch, increment } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { EventBusService } from './event-bus.service';

const fromFirestore = <T>(snapshot: DocumentSnapshot<DocumentData, DocumentData>): T => {
  const data = snapshot.data() as any;
  return { ...data, id: snapshot.id } as T;
};

/**
 * JobQueueService - Background job processing service.
 *
 * Purpose: Manages background job queue for processing heavy operations like
 * work order creation, notifications, and other async tasks.
 *
 * Features:
 * - Job queuing and processing
 * - Priority-based job execution
 * - Retry system with exponential backoff
 * - Real-time job monitoring
 * - Job statistics and metrics
 *
 * CRUD Operations:
 * - Create: Queue new jobs via enqueueJob()
 * - Read: Monitor jobs via getJobs(), getJobStats()
 * - Update: Update job status via updateJobStatus()
 * - Delete: Clean up completed jobs via cleanupOldJobs()
 *
 * References: Used by WorkOrderService, NotificationService, and other services
 * that need background processing.
 */
@Injectable({
  providedIn: 'root'
})
export class JobQueueService {
  private jobs = signal<Job[]>([]);
  private jobStats = signal<JobStats | null>(null);
  private authService = inject(AuthService);
  private eventBus = inject(EventBusService);

  // Real-time subscription
  private realtimeSubscription: any = null;

  // Search and filter state
  private searchSubject = new BehaviorSubject<string>('');
  private filterSubject = new BehaviorSubject<{ status?: JobStatus[]; type?: JobType[]; priority?: JobPriority[] }>({});

  // Retry configuration
  private readonly DEFAULT_RETRY_CONFIG: JobRetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000, // 1 second
    maxDelayMs: 300000, // 5 minutes
    backoffMultiplier: 2,
    retryableErrors: ['timeout', 'network', 'temporary_failure']
  };

  constructor() {
    this.startRealtimeUpdates();
    this.setupSearchAndFilter();
  }

  /**
   * Enqueue a new job for background processing
   */
  async enqueueJob(
    type: JobType,
    data: JobData,
    options: {
      priority?: JobPriority;
      maxRetries?: number;
      delayMs?: number;
      createdBy?: string;
    } = {}
  ): Promise<Job> {
    const currentUser = this.authService.currentUser();
    const createdBy = options.createdBy || currentUser?.id;

    const jobData: Omit<Job, 'id' | 'createdAt' | 'updatedAt'> = {
      type,
      status: JobStatus.PENDING,
      priority: options.priority || JobPriority.MEDIUM,
      data,
      retryCount: 0,
      maxRetries: options.maxRetries || this.DEFAULT_RETRY_CONFIG.maxRetries,
      createdBy,
      processingTimeMs: 0
    };

    // Add delay if specified
    if (options.delayMs && options.delayMs > 0) {
      jobData.nextRetryAt = Timestamp.fromMillis(Date.now() + options.delayMs);
    }

    const docRef = await addDoc(collection(db, "jobs"), {
      ...jobData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const newJob: Job = {
      ...jobData,
      id: docRef.id,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    // Update local state
    this.jobs.update(jobs => [newJob, ...jobs]);

    // Emit event
    this.eventBus.emit({
      type: 'job.queued',
      entity: newJob
    } as any);

    console.log(`Job queued: ${type} (${docRef.id})`);
    return newJob;
  }

  /**
   * Get all jobs with optional filtering
   */
  getJobs() {
    return this.jobs.asReadonly();
  }

  /**
   * Get job statistics
   */
  getJobStats() {
    return this.jobStats.asReadonly();
  }

  /**
   * Get filtered jobs observable
   */
  getFilteredJobs() {
    return combineLatest([
      this.jobs.asReadonly(),
      this.searchSubject.pipe(debounceTime(300), distinctUntilChanged()),
      this.filterSubject.asObservable()
    ]).pipe(
      map((combined: any[]) => {
        const jobsSignal = combined[0];
        const searchTerm = combined[1];
        const filter = combined[2];
        const jobs = jobsSignal();
        return this.applyFilters(jobs, searchTerm, filter);
      })
    );
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    options: {
      result?: any;
      error?: string;
      processingTimeMs?: number;
      nextRetryAt?: Timestamp;
    } = {}
  ): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: serverTimestamp()
    };

    if (options.result !== undefined) updateData.result = options.result;
    if (options.error !== undefined) updateData.error = options.error;
    if (options.processingTimeMs !== undefined) updateData.processingTimeMs = options.processingTimeMs;
    if (options.nextRetryAt !== undefined) updateData.nextRetryAt = options.nextRetryAt;

    // Add timestamps for status changes
    if (status === JobStatus.PROCESSING && !options.nextRetryAt) {
      updateData.startedAt = serverTimestamp();
    } else if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
      updateData.completedAt = serverTimestamp();
    }

    await updateDoc(doc(db, "jobs", jobId), updateData);

    // Update local state
    this.jobs.update(jobs =>
      jobs.map(job =>
        job.id === jobId
          ? {
              ...job,
              ...updateData,
              startedAt: status === JobStatus.PROCESSING ? Timestamp.now() : job.startedAt,
              completedAt: (status === JobStatus.COMPLETED || status === JobStatus.FAILED) ? Timestamp.now() : job.completedAt
            }
          : job
      )
    );

    // Emit event
    const eventType = `job.${status.toLowerCase()}` as any;
    this.eventBus.emit({
      type: eventType,
      entity: { id: jobId, status, ...options }
    } as any);

    console.log(`Job ${jobId} status updated to: ${status}`);
  }

  /**
   * Retry a failed job with exponential backoff
   */
  async retryJob(jobId: string): Promise<void> {
    const job = this.jobs().find(j => j.id === jobId);
    if (!job) throw new Error('Job not found');

    if (job.retryCount >= job.maxRetries) {
      await this.updateJobStatus(jobId, JobStatus.FAILED, {
        error: 'Max retries exceeded'
      });
      return;
    }

    // Calculate next retry delay with exponential backoff
    const delayMs = Math.min(
      this.DEFAULT_RETRY_CONFIG.baseDelayMs * Math.pow(this.DEFAULT_RETRY_CONFIG.backoffMultiplier, job.retryCount),
      this.DEFAULT_RETRY_CONFIG.maxDelayMs
    );

    const nextRetryAt = Timestamp.fromMillis(Date.now() + delayMs);

    await updateDoc(doc(db, "jobs", jobId), {
      status: JobStatus.RETRYING,
      retryCount: increment(1),
      nextRetryAt,
      updatedAt: serverTimestamp()
    });

    // Update local state
    this.jobs.update(jobs =>
      jobs.map(j =>
        j.id === jobId
          ? {
              ...j,
              status: JobStatus.RETRYING,
              retryCount: j.retryCount + 1,
              nextRetryAt,
              updatedAt: Timestamp.now()
            }
          : j
      )
    );

    console.log(`Job ${jobId} scheduled for retry in ${delayMs}ms (attempt ${job.retryCount + 1}/${job.maxRetries})`);
  }

  /**
   * Get jobs ready for processing (pending, high priority first)
   */
  getPendingJobs(limit: number = 10): Job[] {
    const now = new Date();
    return this.jobs()
      .filter(job =>
        job.status === JobStatus.PENDING ||
        (job.status === JobStatus.RETRYING && job.nextRetryAt && job.nextRetryAt.toDate() <= now)
      )
      .sort((a, b) => {
        // Sort by priority first (higher priority first)
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];

        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }

        // Then by creation time (older first)
        return a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime();
      })
      .slice(0, limit);
  }

  /**
   * Process a job (called by Firebase Functions workers)
   */
  async processJob(jobId: string, workerId: string): Promise<void> {
    const startTime = Date.now();

    try {
      await this.updateJobStatus(jobId, JobStatus.PROCESSING);

      const job = this.jobs().find(j => j.id === jobId);
      if (!job) throw new Error('Job not found during processing');

      // Process based on job type
      const result = await this.processJobByType(job);

      const processingTime = Date.now() - startTime;
      await this.updateJobStatus(jobId, JobStatus.COMPLETED, {
        result,
        processingTimeMs: processingTime
      });

      console.log(`Job ${jobId} completed successfully in ${processingTime}ms`);

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      const isRetryable = this.isRetryableError(error);

      if (isRetryable) {
        console.warn(`Job ${jobId} failed (retryable), scheduling retry:`, error.message);
        await this.retryJob(jobId);
      } else {
        console.error(`Job ${jobId} failed permanently:`, error);
        await this.updateJobStatus(jobId, JobStatus.FAILED, {
          error: error.message,
          processingTimeMs: processingTime
        });
      }
    }
  }

  /**
   * Process job based on its type
   */
  private async processJobByType(job: Job): Promise<any> {
    switch (job.type) {
      case JobType.CREATE_WORK_ORDER:
        return await this.processCreateWorkOrder(job.data);
      case JobType.SEND_NOTIFICATION:
        return await this.processSendNotification(job.data);
      case JobType.PROCESS_PAYMENT:
        return await this.processPayment(job.data);
      case JobType.GENERATE_REPORT:
        return await this.processGenerateReport(job.data);
      case JobType.SYNC_INVENTORY:
        return await this.processSyncInventory(job.data);
      case JobType.MAINTENANCE_REMINDER:
        return await this.processMaintenanceReminder(job.data);
      case JobType.BULK_OPERATION:
        return await this.processBulkOperation(job.data);
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  /**
   * Process work order creation
   */
  private async processCreateWorkOrder(data: JobData): Promise<any> {
    if (!data.workOrderData) throw new Error('Missing workOrderData');

    // Import WorkOrderService dynamically to avoid circular dependencies
    const { WorkOrderService } = await import('./work-order.service');
    const workOrderService = inject(WorkOrderService);

    // Add required fields for WorkOrder creation
    const workOrderData = {
      ...data.workOrderData,
      status: 'open' as const,
      totalPrice: 0, // Will be calculated by the service
      priority: data.workOrderData.priority as any, // Cast to avoid type issues
      products: data.workOrderData.products || [] // Ensure products is not undefined
    };

    const workOrder = await workOrderService.createWorkOrder(workOrderData).toPromise();
    if (!workOrder) throw new Error('Failed to create work order');
    return { workOrderId: workOrder.id };
  }

  /**
   * Process notification sending
   */
  private async processSendNotification(data: JobData): Promise<any> {
    if (!data.notificationData) throw new Error('Missing notificationData');

    // Import NotificationService dynamically to avoid circular dependencies
    const { NotificationService } = await import('./notification.service');
    const notificationService = inject(NotificationService);

    const notifications = await notificationService.createCategorizedNotification(
      'service_orders', // Default category
      data.notificationData.title,
      data.notificationData.message || '',
      {
        userId: data.notificationData.userId,
        priority: 'medium',
        targetAudience: data.notificationData.userId ? 'specific_user' : 'all'
      }
    );

    return { notificationCount: notifications.length };
  }

  /**
   * Process payment (placeholder)
   */
  private async processPayment(data: JobData): Promise<any> {
    if (!data.paymentData) throw new Error('Missing paymentData');

    // Implement payment processing logic here
    // For now, just simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { paymentId: `payment_${Date.now()}`, status: 'processed' };
  }

  /**
   * Process report generation (placeholder)
   */
  private async processGenerateReport(data: JobData): Promise<any> {
    if (!data.reportData) throw new Error('Missing reportData');

    // Implement report generation logic here
    // For now, just simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    return { reportId: `report_${Date.now()}`, format: data.reportData.format };
  }

  /**
   * Process inventory sync (placeholder)
   */
  private async processSyncInventory(data: JobData): Promise<any> {
    if (!data.inventoryData) throw new Error('Missing inventoryData');

    // Implement inventory sync logic here
    // For now, just simulate processing
    await new Promise(resolve => setTimeout(resolve, 500));

    return { syncedItems: data.inventoryData.items?.length || 0 };
  }

  /**
   * Process maintenance reminder
   */
  private async processMaintenanceReminder(data: JobData): Promise<any> {
    if (!data.reminderData) throw new Error('Missing reminderData');

    // Import NotificationService dynamically to avoid circular dependencies
    const { NotificationService } = await import('./notification.service');
    const notificationService = inject(NotificationService);

    const notifications = await notificationService.createMaintenanceReminder(
      data.reminderData.customerId,
      {
        brand: 'Unknown', // Would need to fetch from vehicle data
        model: 'Unknown',
        year: new Date().getFullYear(),
        plate: undefined
      },
      data.reminderData.serviceId,
      {
        dueDate: data.reminderData.dueDate?.toDate(),
        dueMileage: data.reminderData.dueMileage
      }
    );

    return { reminderSent: notifications.length > 0 };
  }

  /**
   * Process bulk operation (placeholder)
   */
  private async processBulkOperation(data: JobData): Promise<any> {
    if (!data.bulkData) throw new Error('Missing bulkData');

    // Implement bulk operation logic here
    // For now, just simulate processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    return { processedItems: data.bulkData.items.length };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toLowerCase() || '';

    return this.DEFAULT_RETRY_CONFIG.retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError) || errorCode.includes(retryableError)
    );
  }

  /**
   * Clean up old completed/failed jobs
   */
  async cleanupOldJobs(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const oldJobs = this.jobs().filter(job =>
      (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) &&
      job.completedAt &&
      job.completedAt.toDate() < cutoffDate
    );

    if (oldJobs.length === 0) return 0;

    const batch = writeBatch(db);
    oldJobs.forEach(job => {
      batch.delete(doc(db, "jobs", job.id));
    });

    await batch.commit();

    // Update local state
    this.jobs.update(jobs =>
      jobs.filter(job => !oldJobs.find(oldJob => oldJob.id === job.id))
    );

    console.log(`Cleaned up ${oldJobs.length} old jobs`);
    return oldJobs.length;
  }

  /**
   * Get job by ID
   */
  getJob(id: string): Observable<Job | undefined> {
    return from(new Promise<Job | undefined>(async (resolve) => {
      const job = this.jobs().find(j => j.id === id);
      resolve(job);
    }));
  }

  // Search and filter methods
  setSearchTerm(searchTerm: string) {
    this.searchSubject.next(searchTerm);
  }

  setFilter(filter: { status?: JobStatus[]; type?: JobType[]; priority?: JobPriority[] }) {
    this.filterSubject.next(filter);
  }

  private applyFilters(jobs: Job[], searchTerm: string, filter: { status?: JobStatus[]; type?: JobType[]; priority?: JobPriority[] }): Job[] {
    let filtered = [...jobs];

    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(job =>
        job.id.toLowerCase().includes(term) ||
        job.type.toLowerCase().includes(term) ||
        job.status.toLowerCase().includes(term)
      );
    }

    // Apply filters
    if (filter.status && filter.status.length > 0) {
      filtered = filtered.filter(job => filter.status!.includes(job.status));
    }

    if (filter.type && filter.type.length > 0) {
      filtered = filtered.filter(job => filter.type!.includes(job.type));
    }

    if (filter.priority && filter.priority.length > 0) {
      filtered = filtered.filter(job => filter.priority!.includes(job.priority));
    }

    return filtered;
  }

  private setupSearchAndFilter(): void {
    this.searchSubject.next('');
    this.filterSubject.next({});
  }

  private startRealtimeUpdates(): void {
    this.realtimeSubscription = onSnapshot(
      query(collection(db, "jobs"), orderBy("createdAt", "desc"), limit(1000)),
      (snapshot) => {
        const jobs = snapshot.docs.map(doc => fromFirestore<Job>(doc));
        this.jobs.set(jobs);
        this.updateJobStats();
      },
      (error) => {
        console.error('Error in jobs real-time subscription:', error);
      }
    );
  }

  private updateJobStats(): void {
    const jobs = this.jobs();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats: JobStats = {
      totalJobs: jobs.length,
      pendingJobs: jobs.filter(j => j.status === JobStatus.PENDING).length,
      processingJobs: jobs.filter(j => j.status === JobStatus.PROCESSING).length,
      completedJobs: jobs.filter(j => j.status === JobStatus.COMPLETED).length,
      failedJobs: jobs.filter(j => j.status === JobStatus.FAILED).length,
      averageProcessingTime: this.calculateAverageProcessingTime(jobs),
      successRate: this.calculateSuccessRate(jobs),
      periodStart: Timestamp.fromDate(weekAgo),
      periodEnd: Timestamp.fromDate(now),
      jobsByType: this.countJobsByType(jobs),
      jobsByStatus: this.countJobsByStatus(jobs),
      updatedAt: Timestamp.fromDate(now)
    };

    this.jobStats.set(stats);
  }

  private calculateAverageProcessingTime(jobs: Job[]): number {
    const completedJobs = jobs.filter(j => j.status === JobStatus.COMPLETED && j.processingTimeMs);
    if (completedJobs.length === 0) return 0;

    const totalTime = completedJobs.reduce((sum, job) => sum + (job.processingTimeMs || 0), 0);
    return totalTime / completedJobs.length;
  }

  private calculateSuccessRate(jobs: Job[]): number {
    const completedJobs = jobs.filter(j => j.status === JobStatus.COMPLETED).length;
    const totalProcessedJobs = jobs.filter(j =>
      j.status === JobStatus.COMPLETED || j.status === JobStatus.FAILED
    ).length;

    return totalProcessedJobs > 0 ? (completedJobs / totalProcessedJobs) * 100 : 0;
  }

  private countJobsByType(jobs: Job[]): Record<JobType, number> {
    const counts: Record<JobType, number> = {
      [JobType.CREATE_WORK_ORDER]: 0,
      [JobType.SEND_NOTIFICATION]: 0,
      [JobType.PROCESS_PAYMENT]: 0,
      [JobType.GENERATE_REPORT]: 0,
      [JobType.SYNC_INVENTORY]: 0,
      [JobType.MAINTENANCE_REMINDER]: 0,
      [JobType.BULK_OPERATION]: 0
    };

    jobs.forEach(job => {
      counts[job.type]++;
    });

    return counts;
  }

  private countJobsByStatus(jobs: Job[]): Record<JobStatus, number> {
    const counts: Record<JobStatus, number> = {
      [JobStatus.PENDING]: 0,
      [JobStatus.PROCESSING]: 0,
      [JobStatus.COMPLETED]: 0,
      [JobStatus.FAILED]: 0,
      [JobStatus.RETRYING]: 0,
      [JobStatus.CANCELLED]: 0
    };

    jobs.forEach(job => {
      counts[job.status]++;
    });

    return counts;
  }
}