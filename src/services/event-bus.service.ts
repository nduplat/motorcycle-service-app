import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Appointment, WorkOrder, QueueEntry, UserProfile } from '../models';

export interface MaintenanceReminderEvent {
  dueType: 'overdue' | 'due_soon' | 'upcoming';
  serviceName: string;
  vehicleId: string;
  serviceId?: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export type NotificationEvent =
  | { type: 'appointment.created', entity: Appointment }
  | { type: 'appointment.assigned', entity: Appointment }
  | { type: 'appointment.status_changed', entity: Appointment, oldStatus?: string, newStatus: string }
  | { type: 'appointment.completed', entity: Appointment }
  | { type: 'work_order.created', entity: WorkOrder }
  | { type: 'work_order.status_changed', entity: WorkOrder, previousStatus?: string }
  | { type: 'work_order.completed', entity: WorkOrder, lastServiceDate?: Date }
  | { type: 'queue.called', entity: QueueEntry, technicianName: string }
  | { type: 'queue.entry_added', entity: QueueEntry }
  | { type: 'queue.auto_assigned', entity: QueueEntry, technician: UserProfile }
  | { type: 'queue.qr_validated', entity: QueueEntry, timerStarted: boolean }
  | { type: 'maintenance.reminder_created', reminder: MaintenanceReminderEvent, customer: UserProfile };

@Injectable({
  providedIn: 'root'
})
export class EventBusService {
  private eventSubject = new Subject<NotificationEvent>();

  emit(event: NotificationEvent) {
    this.eventSubject.next(event);
  }

  get events$() {
    return this.eventSubject.asObservable();
  }
}