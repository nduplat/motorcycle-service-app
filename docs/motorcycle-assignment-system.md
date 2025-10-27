# Motorcycle Assignment System Documentation

## Overview

This document provides comprehensive documentation for the motorcycle assignment system at Blue Dragon Motors. The system implements a plate-based assignment logic that ensures consistent motorcycle management across user management and queue systems.

## Table of Contents

1. [Core Concept](#core-concept)
2. [Assignment Logic](#assignment-logic)
3. [Auto-Assignment Flow](#auto-assignment-flow)
4. [Technical Implementation](#technical-implementation)
5. [Notifications and Updates](#notifications-and-updates)

## Core Concept

### Plate-Based Assignment

The motorcycle assignment system is fundamentally built around the license plate number as the **unique identifier** for motorcycles. This approach provides several key advantages:

- **Uniqueness**: Each motorcycle is uniquely identified by its license plate
- **Consistency**: Same assignment logic applies across all system components
- **Flexibility**: Multiple users can access the same motorcycle (family vehicles, company fleets)
- **Simplicity**: Users only need to enter their plate number to access services

### Assignment Hierarchy

```
User Account ↔ License Plate ↔ Motorcycle Record
```

- **User Account**: Customer authentication and profile
- **License Plate**: Unique identifier and primary key
- **Motorcycle Record**: Contains brand, model, year, and other metadata

### Data Flow

1. **New Plate**: Creates new motorcycle record, assigns to user as owner
2. **Existing Plate**: Adds user to assigned users list (shared access)
3. **Queue Integration**: Only assigned motorcycles can be added to service queue

## Assignment Logic

### New vs Existing Plates

The system handles two primary scenarios:

#### New Plate Registration
```typescript
// When plate doesn't exist in system
if (!plateExists) {
  // Create new motorcycle record
  const motorcycle = {
    id: generateId(),
    plateNumber: normalizedPlate,
    ownerId: currentUserId,
    assignedTo: [currentUserId],
    // ... other fields
  };
}
```

#### Existing Plate Assignment
```typescript
// When plate exists in system
if (plateExists) {
  if (userHasAccess) {
    // User already has access - return existing record
    return existingMotorcycle;
  } else {
    // Add user to assigned users
    motorcycle.assignedTo.push(currentUserId);
  }
}
```

### User Ownership vs Access

- **Owner**: User who initially registered the motorcycle
- **Assigned Users**: Users with access to the motorcycle
- **Access Control**: Owner can modify motorcycle data, assigned users can only use it

### Validation Rules

- **Plate Format**: Colombian format (AAA123)
- **Uniqueness**: Plates must be unique in system
- **User Authentication**: Required for all operations
- **Access Verification**: Users can only access assigned motorcycles

## Auto-Assignment Flow

The auto-assignment system uses a sophisticated 9-step workflow triggered when a customer joins the service queue. This intelligent system automatically assigns the optimal technician based on multiple scoring factors.

### 9-Step Auto-Assignment Process

#### Step 1: System Configuration Check
```typescript
// Verify auto-assignment is enabled
const autoAssignEnabled = systemConfig.autoAssignEnabled ?? true;
if (!autoAssignEnabled) {
  // Notify managers for manual assignment
  return notifyManagersManualAssignment(queueEntry);
}
```

**Purpose**: Ensures the system is configured for automatic assignment before proceeding.

#### Step 2: Motorcycle Data Retrieval
```typescript
// Get motorcycle details for assignment scoring
const motorcycle = await getMotorcycleById(queueEntry.motorcycleId);
```

**Purpose**: Retrieves motorcycle specifications needed for technician matching.

#### Step 3: Optimal Technician Selection
```typescript
// AI-powered technician selection with 100-point scoring
const optimalTechnician = await findOptimalTechnician({
  ...queueEntry,
  motorcycle: motorcycle
});
```

**Scoring Algorithm (100 points total)**:
- **Skills Match (40 points)**: Technician skills vs required services
- **Workload Balance (30 points)**: Current assignments and capacity
- **Rating Performance (15 points)**: Customer satisfaction scores
- **Brand Experience (10 points)**: Experience with motorcycle brands
- **Time Since Last Assignment (5 points)**: Availability freshness

#### Step 4: Work Order Creation
```typescript
// Automatically create work order
const workOrder = await createWorkOrder({
  customerId: queueEntry.customerId,
  motorcycleId: queueEntry.motorcycleId,
  assignedTo: optimalTechnician.id,
  services: queueEntry.services,
  priority: queueEntry.priority
});
```

**Purpose**: Creates the service order that will track the work progress.

#### Step 5: Queue Status Update
```typescript
// Update queue entry with assignment
await updateQueueEntry(queueId, {
  assignedTechnicianId: optimalTechnician.id,
  assignedAt: serverTimestamp(),
  workOrderId: workOrder.id,
  status: 'assigned'
});
```

**Purpose**: Marks the queue entry as assigned and links it to the work order.

#### Step 6: Customer Confirmation SMS
```typescript
// Send SMS with queue position and estimated wait
if (queueEntry.smsNotificationsEnabled) {
  await sendConfirmationSMS(queueEntry, motorcycle);
}
```

**Purpose**: Confirms queue entry and provides real-time status link.

#### Step 7: Technician Notification
```typescript
// Notify assigned technician via push notification
await notifyTechnician({
  technicianId: optimalTechnician.id,
  workOrderId: workOrder.id,
  customerName: customerName,
  motorcycle: `${motorcycle.brand} ${motorcycle.model}`,
  services: queueEntry.services.map(s => s.name)
});
```

**Purpose**: Alerts the technician of their new assignment.

#### Step 8: Technician Workload Update
```typescript
// Update technician's current job count
await updateTechnicianWorkload(optimalTechnician.id, 'increment');
```

**Purpose**: Maintains accurate workload tracking for future assignments.

#### Step 9: Audit Logging
```typescript
// Log assignment event for analytics and troubleshooting
await logAssignmentEvent({
  type: 'queue_auto_assigned',
  technicianId: optimalTechnician.id,
  workOrderId: workOrder.id,
  assignmentScore: optimalTechnician.score
});
```

**Purpose**: Records the assignment for system monitoring and improvement.

### Error Handling

- **No Technicians Available**: Notifies managers for manual assignment
- **Assignment Failure**: Logs error and alerts system administrators
- **Configuration Issues**: Falls back to manual assignment mode

## Technical Implementation

### Core Services

#### MotorcycleService
```typescript
@Injectable({ providedIn: 'root' })
export class MotorcycleService {
  // Core assignment methods
  async assignMotorcycle(request: MotorcycleAssignmentRequest): Promise<Motorcycle>
  async validatePlate(plate: string, userId?: string): Promise<PlateValidationResult>
  getUserMotorcycles(userId?: string): Observable<Motorcycle[]>
}
```

#### QueueService
```typescript
@Injectable({ providedIn: 'root' })
export class QueueService {
  // Queue management methods
  async joinQueue(request: JoinQueueRequest): Promise<QueueEntry>
  getCurrentQueue(): Observable<QueueEntry[]>
  async updateQueueStatus(queueId: string, status: QueueEntry['status']): Promise<void>
}
```

### Firebase Cloud Functions

#### Auto-Assignment Trigger
```typescript
// Triggered on new queue entries
export const onQueueJoinAutoAssign = functions.firestore
  .document('queue/{queueId}')
  .onCreate(async (snap, context) => {
    // 9-step auto-assignment process
  });
```

#### Notification Triggers
```typescript
// Progressive notifications based on queue changes
export const onQueueUpdate = functions.firestore
  .document('queue/{queueId}')
  .onUpdate(async (change, context) => {
    // Position and status change notifications
  });
```

### Data Models

#### Motorcycle Model
```typescript
interface Motorcycle {
  id: string;
  plateNumber: string; // UNIQUE IDENTIFIER
  ownerId: string; // Original registrant
  assignedTo: string[]; // Users with access
  brand: string;
  model: string;
  year?: number;
  status: 'active' | 'inactive';
  // ... additional fields
}
```

#### QueueEntry Model
```typescript
interface QueueEntry {
  id: string;
  customerId: string;
  motorcycleId: string; // Reference to assigned motorcycle
  assignedTechnicianId?: string;
  workOrderId?: string;
  position: number;
  status: 'waiting' | 'assigned' | 'in_service' | 'completed';
  // ... notification tracking
}
```

### Security Considerations

- **Authentication Required**: All operations require authenticated users
- **Access Control**: Users can only access assigned motorcycles
- **Data Validation**: Plate format and uniqueness validation
- **Audit Logging**: All assignments and changes are logged

## Notifications and Updates

### Progressive Notification System

The system implements a sophisticated progressive notification system that keeps customers informed at key moments during their service experience.

#### Notification Timeline

1. **Queue Join Confirmation** (Immediate)
   - SMS with position and estimated wait time
   - Push notification with queue status link

2. **Almost Ready** (Position #2)
   - SMS: "Faltan 2 clientes - dirígete al taller"
   - Push notification with preparation instructions

3. **Your Turn** (Position #1)
   - SMS: "¡Es tu turno! Acércate al área de servicio"
   - Push notification with urgent call to action

4. **Called** (Status: 'called')
   - SMS: "Te estamos llamando - preséntate AHORA"
   - Push notification with 5-minute warning

5. **Service Started** (Status: 'in_service')
   - SMS: "Servicio iniciado - tiempo estimado"
   - Push notification with progress tracking

6. **Service Completed** (Status: 'completed')
   - SMS: "¡Servicio completado! Pasa a caja"
   - Push notification with payment instructions

### Notification Channels

#### SMS Notifications (Twilio)
- **Transactional**: Critical updates and confirmations
- **Rich Content**: Includes links, formatting, and clear instructions
- **Delivery Tracking**: Message SIDs stored for verification

#### Push Notifications (Firebase Cloud Messaging)
- **Real-time**: Instant delivery to mobile devices
- **Actionable**: Include deep links and call-to-action buttons
- **Multi-device**: Delivered to all user's registered devices

#### In-App Notifications
- **Persistent**: Stored in user notification history
- **Categorized**: Tagged by type and priority
- **Action Tracking**: Mark as read, archive, or take action

### Notification Preferences

Users can configure their notification preferences:
- **SMS Enabled/Disabled**: Opt-out of SMS notifications
- **Push Notifications**: Device-specific settings
- **Quiet Hours**: Time-based notification filtering

### Error Handling and Fallbacks

- **SMS Failures**: Automatic retry with exponential backoff
- **Push Token Cleanup**: Remove invalid FCM tokens
- **Fallback Notifications**: Email notifications for critical updates
- **Delivery Monitoring**: Track success rates and failure patterns

### Analytics and Optimization

The notification system includes comprehensive analytics:
- **Delivery Rates**: SMS and push notification success rates
- **User Engagement**: Open rates and interaction tracking
- **Timing Optimization**: A/B testing of notification timing
- **Content Effectiveness**: Performance analysis of message variants

---

## Conclusion

The motorcycle assignment system provides a robust, scalable solution for managing motorcycle ownership and service assignments. The plate-based approach ensures data consistency while the intelligent auto-assignment system optimizes technician utilization and customer satisfaction.

The progressive notification system keeps customers informed throughout their service experience, reducing no-shows and improving overall satisfaction.

For technical implementation details, refer to the service classes and Cloud Functions documented in the codebase.