# API Documentation - Time and Resource Management System

## Overview

The Time and Resource Management System provides a comprehensive set of APIs for managing workshop assignments, schedules, and capacity. This documentation covers all services related to the new time and resource management functionality.

## Service Architecture

### Core Services

- **AutoAssignmentService**: Automatic queue management and technician assignment
- **SmartAssignmentService**: Intelligent assignment with scoring algorithms
- **EmployeeScheduleService**: Employee scheduling and availability management
- **WorkshopCapacityService**: Capacity planning and utilization tracking

## AutoAssignmentService

### Overview
Automatically assigns available technicians to waiting queue entries based on availability, skills, and workload balancing.

### Key Methods

#### `processAutoAssignments(queueService: any): Promise<void>`

**Description:** Main method to process automatic assignments for waiting queue entries.

**Parameters:**
- `queueService`: Queue service instance for accessing queue entries

**Returns:** Promise that resolves when assignment processing is complete

**Example:**
```typescript
const autoAssignment = inject(AutoAssignmentService);

// Process auto-assignments
await autoAssignment.processAutoAssignments(queueService);
```

#### `isAutoAssignmentInProgress(): boolean`

**Description:** Check if auto-assignment processing is currently running.

**Returns:** `true` if processing is in progress, `false` otherwise

**Example:**
```typescript
if (!autoAssignment.isAutoAssignmentInProgress()) {
  await autoAssignment.processAutoAssignments(queueService);
}
```

#### `stopPeriodicAssignment(): void`

**Description:** Stop the periodic auto-assignment process.

**Example:**
```typescript
autoAssignment.stopPeriodicAssignment();
```

### Internal Methods

#### `getWaitingQueueEntries(queueEntries: QueueEntry[]): QueueEntry[]`

**Description:** Filter queue entries to get only waiting entries.

**Parameters:**
- `queueEntries`: Array of all queue entries

**Returns:** Array of queue entries with status 'waiting'

#### `getAvailableTechnicians(queueEntries: QueueEntry[]): UserProfile[]`

**Description:** Get technicians who are currently available for assignment.

**Parameters:**
- `queueEntries`: Array of queue entries to check for conflicts

**Returns:** Array of available technician profiles

#### `isTechnicianAvailable(technician: UserProfile, queueEntries: QueueEntry[]): boolean`

**Description:** Check if a specific technician is available for new assignments.

**Parameters:**
- `technician`: Technician profile to check
- `queueEntries`: Current queue entries

**Returns:** `true` if technician is available

**Availability Criteria:**
- Technician is active
- No current in-progress appointments
- No current in-progress work orders
- Not recently assigned (within 5 minutes)

#### `findBestTechnicianForEntry(entry: QueueEntry, availableTechnicians: UserProfile[], queueEntries: QueueEntry[]): UserProfile | null`

**Description:** Find the best technician for a queue entry using workload balancing.

**Parameters:**
- `entry`: Queue entry to assign
- `availableTechnicians`: Array of available technicians
- `queueEntries`: All current queue entries

**Returns:** Best technician or null if none available

**Algorithm:** Selects technician with least current assignments

## SmartAssignmentService

### Overview
Provides intelligent assignment recommendations using multi-factor scoring algorithms.

### Key Methods

#### `findBestTechnicianForJob(workOrderId: string): Observable<User | null>`

**Description:** Find the optimal technician for a specific work order.

**Parameters:**
- `workOrderId`: ID of the work order

**Returns:** Observable emitting the best technician or null

**Example:**
```typescript
smartAssignment.findBestTechnicianForJob('workorder_123')
  .subscribe(technician => {
    if (technician) {
      console.log(`Best technician: ${technician.name}`);
    }
  });
```

#### `assignWorkOrderToTechnician(workOrderId: string, technicianId: string): Observable<WorkOrder>`

**Description:** Assign a work order to a specific technician.

**Parameters:**
- `workOrderId`: ID of the work order
- `technicianId`: ID of the technician

**Returns:** Observable emitting the updated work order

**Example:**
```typescript
smartAssignment.assignWorkOrderToTechnician('workorder_123', 'tech_456')
  .subscribe(updatedWorkOrder => {
    console.log('Assignment successful');
  });
```

#### `rebalanceWorkload(): Observable<ReassignmentSuggestion[]>`

**Description:** Analyze current workload distribution and suggest reassignments.

**Returns:** Observable emitting array of reassignment suggestions

**Example:**
```typescript
smartAssignment.rebalanceWorkload()
  .subscribe(suggestions => {
    suggestions.forEach(suggestion => {
      console.log(`Reassign ${suggestion.workOrderId} to ${suggestion.suggestedTechnicianId}`);
    });
  });
```

#### `suggestReassignments(): Observable<ReassignmentSuggestion[]>`

**Description:** Suggest optimal reassignments for better efficiency.

**Returns:** Observable emitting array of reassignment suggestions sorted by improvement

**Example:**
```typescript
smartAssignment.suggestReassignments()
  .subscribe(suggestions => {
    // Top 10 suggestions sorted by improvement
    console.log(`${suggestions.length} reassignment opportunities found`);
  });
```

### Scoring Algorithm

#### Technician Score Calculation

Each technician receives a score from 0-100 based on:

**Skills Match (0-40 points):**
- Matches required skills for the job
- Full points if all skills match, proportional otherwise

**Availability (0-20 points):**
- 20 points if available, 0 if not

**Workload (0-20 points):**
- Inverse relationship: fewer assignments = higher score
- Max 3 concurrent jobs allowed

**Efficiency (0-15 points):**
- Based on historical performance metrics
- Retrieved from TechnicianMetricsService

**Proximity (0-5 points):**
- Currently fixed at 5 points (all technicians assumed local)

### Data Types

#### `TechnicianScore`
```typescript
interface TechnicianScore {
  technicianId: string;
  score: number;
  factors: {
    skillsMatch: number;
    availability: number;
    workload: number;
    efficiency: number;
    proximity: number;
  };
}
```

#### `AssignmentSuggestion`
```typescript
interface AssignmentSuggestion {
  technicianId: string;
  workOrderId: string;
  score: number;
  reason: string;
}
```

#### `ReassignmentSuggestion`
```typescript
interface ReassignmentSuggestion {
  workOrderId: string;
  currentTechnicianId: string;
  suggestedTechnicianId: string;
  improvement: number;
  reason: string;
}
```

## EmployeeScheduleService

### Overview
Manages employee schedules, shifts, breaks, and availability checking.

### Key Methods

#### `createSchedule(employeeId: string, date: Date, shifts: ShiftConfig[], breaks: BreakConfig[]): Promise<EmployeeSchedule>`

**Description:** Create a new employee schedule for a specific date.

**Parameters:**
- `employeeId`: ID of the employee
- `date`: Date for the schedule
- `shifts`: Array of shift configurations
- `breaks`: Array of break configurations

**Returns:** Promise resolving to created schedule

**Example:**
```typescript
const shifts: ShiftConfig[] = [{
  id: 'shift_1',
  name: 'Morning Shift',
  startTime: '08:00',
  endTime: '12:00',
  daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
  workshopLocationId: 'main',
  isActive: true
}];

const breaks: BreakConfig[] = [{
  id: 'break_1',
  name: 'Lunch Break',
  durationMinutes: 30,
  startTime: '12:00'
}];

const schedule = await scheduleService.createSchedule(
  'employee_123',
  new Date(),
  shifts,
  breaks
);
```

#### `getEmployeeSchedule(employeeId: string, date: Date): Promise<EmployeeSchedule | null>`

**Description:** Get employee schedule for a specific date.

**Parameters:**
- `employeeId`: ID of the employee
- `date`: Date to get schedule for

**Returns:** Promise resolving to schedule or null if not found

#### `isEmployeeAvailable(employeeId: string, startTime: Date, endTime: Date): Promise<boolean>`

**Description:** Check if employee is available during a time period.

**Parameters:**
- `employeeId`: ID of the employee
- `startTime`: Start of time period
- `endTime`: End of time period

**Returns:** Promise resolving to availability status

**Checks Performed:**
- Schedule exists for the date
- Time falls within assigned shifts
- No conflicts with breaks
- No existing time blocks (appointments)

#### `getAvailableSlots(date: Date, workshopLocationId?: string, durationMinutes: number): Promise<{startTime: Date, endTime: Date}[]>`

**Description:** Get available time slots for a date.

**Parameters:**
- `date`: Date to check
- `workshopLocationId`: Optional workshop location filter
- `durationMinutes`: Required slot duration (default: 60)

**Returns:** Promise resolving to array of available time slots

**Algorithm:**
- Gets all available employees for the date
- Checks 30-minute intervals during business hours (8:00-18:00)
- Returns slots where at least one employee is available

#### `createTimeBlock(employeeId: string, startTime: Date, endTime: Date, type: 'work' | 'break' | 'maintenance', workshopLocationId?: string): Promise<TimeBlock>`

**Description:** Create a time block for an employee.

**Parameters:**
- `employeeId`: ID of the employee
- `startTime`: Start time of block
- `endTime`: End time of block
- `type`: Type of time block
- `workshopLocationId`: Optional workshop location

**Returns:** Promise resolving to created time block

### Data Types

#### `EmployeeSchedule`
```typescript
interface EmployeeSchedule {
  id: string;
  employeeId: string;
  date: Timestamp;
  shifts: ShiftConfig[];
  breaks: BreakConfig[];
  timeBlocks: TimeBlock[];
  totalHours: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `ShiftConfig`
```typescript
interface ShiftConfig {
  id: string;
  name: string;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, etc.
  workshopLocationId?: string;
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
```

#### `BreakConfig`
```typescript
interface BreakConfig {
  id: string;
  name: string;
  durationMinutes: number;
  startTime: string; // HH:MM format
}
```

#### `TimeBlock`
```typescript
interface TimeBlock {
  id: string;
  startTime: Timestamp;
  endTime: Timestamp;
  type: 'work' | 'break' | 'maintenance';
  technicianId: string;
  workshopLocationId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## WorkshopCapacityService

### Overview
Provides capacity planning, utilization tracking, and appointment slot optimization.

### Key Methods

#### `calculateCurrentCapacity(): Observable<CapacityData>`

**Description:** Calculate real-time workshop capacity metrics.

**Returns:** Observable emitting current capacity data

**Capacity Data:**
```typescript
{
  totalCapacity: number;      // Total technician-hours available
  usedCapacity: number;       // Currently used capacity
  availableCapacity: number;  // Remaining capacity
  utilizationRate: number;    // Percentage utilization
  activeWorkOrders: number;   // Number of active work orders
  scheduledAppointments: number; // Number of scheduled appointments
  availableTechnicians: number;   // Number of available technicians
}
```

#### `getCapacityForDate(date: Date): Observable<DateCapacityData>`

**Description:** Get capacity information for a specific date.

**Parameters:**
- `date`: Date to analyze

**Returns:** Observable emitting date-specific capacity data

#### `predictCapacity(predictionDate: Date, daysOfHistory: number): Observable<PredictionData>`

**Description:** Predict capacity needs for future dates.

**Parameters:**
- `predictionDate`: Date to predict for
- `daysOfHistory`: Days of historical data to analyze (default: 30)

**Returns:** Observable emitting prediction data

**Prediction Data:**
```typescript
{
  predictedCapacity: number;
  confidence: number;        // 0-100 confidence score
  factors: Array<{
    factor: string;
    impact: number;
    description: string;
  }>;
}
```

#### `getOptimalAppointmentSlots(date: Date, serviceDurationMinutes: number): Observable<SlotData[]>`

**Description:** Find optimal appointment slots for a service.

**Parameters:**
- `date`: Date to check
- `serviceDurationMinutes`: Required service duration

**Returns:** Observable emitting array of optimal slots

**Slot Data:**
```typescript
{
  startTime: Date;
  endTime: Date;
  availableTechnicians: number;
  score: number;  // Higher = more optimal
}
```

#### `canAccommodateService(serviceDurationMinutes: number, preferredDate?: Date): Observable<AccommodationData>`

**Description:** Check if workshop can accommodate a new service request.

**Parameters:**
- `serviceDurationMinutes`: Required service time
- `preferredDate`: Preferred date (defaults to today)

**Returns:** Observable emitting accommodation assessment

**Accommodation Data:**
```typescript
{
  canAccommodate: boolean;
  availableSlots: number;
  earliestAvailableDate: Date;
  recommendedTechnicians: string[];
  constraints: string[];
}
```

### Capacity Analysis Methods

#### `getCapacityTrend(startDate: Date, endDate: Date): Observable<TrendData>`

**Description:** Analyze capacity trends over a date range.

**Parameters:**
- `startDate`: Start of analysis period
- `endDate`: End of analysis period

**Returns:** Observable emitting trend analysis

**Trend Data:**
```typescript
{
  trend: 'increasing' | 'decreasing' | 'stable';
  averageUtilization: number;
  peakDays: Date[];
  lowDays: Date[];
  weeklyPattern: { [day: string]: number };
  recommendations: string[];
}
```

## Error Handling

### Common Error Patterns

**Service Unavailable:**
```typescript
try {
  const result = await service.method();
} catch (error) {
  if (error.code === 'service-unavailable') {
    // Handle service unavailable
    console.error('Service temporarily unavailable');
  }
}
```

**Validation Errors:**
```typescript
try {
  await scheduleService.createSchedule(employeeId, date, shifts, breaks);
} catch (error) {
  if (error.code === 'validation-error') {
    // Handle validation errors
    console.error('Invalid schedule data:', error.details);
  }
}
```

**Permission Errors:**
```typescript
try {
  await assignmentService.assignWorkOrder(workOrderId, technicianId);
} catch (error) {
  if (error.code === 'permission-denied') {
    // Handle permission errors
    console.error('Insufficient permissions for assignment');
  }
}
```

## Integration Examples

### Complete Assignment Workflow

```typescript
// 1. Check if service can be accommodated
const accommodation = await lastValueFrom(
  capacityService.canAccommodateService(120, preferredDate)
);

if (!accommodation.canAccommodate) {
  throw new Error('Service cannot be accommodated');
}

// 2. Find best technician
const bestTechnician = await lastValueFrom(
  smartAssignment.findBestTechnicianForJob(workOrderId)
);

// 3. Create appointment
const appointment = await appointmentService.createAppointment({
  customerId,
  vehicleId,
  scheduledAt: accommodation.earliestAvailableDate,
  estimatedDuration: 120,
  assignedTo: bestTechnician.id,
  serviceTypes: ['Service Type']
});

// 4. Assign work order
await lastValueFrom(
  smartAssignment.assignWorkOrderToTechnician(workOrderId, bestTechnician.id)
);
```

### Schedule Management Workflow

```typescript
// 1. Create employee schedule
const schedule = await scheduleService.createSchedule(
  employeeId,
  new Date(),
  [{
    id: 'morning_shift',
    name: 'Morning Shift',
    startTime: '08:00',
    endTime: '12:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    isActive: true
  }],
  [{
    id: 'lunch_break',
    name: 'Lunch Break',
    durationMinutes: 30,
    startTime: '12:00'
  }]
);

// 2. Check availability for new appointment
const isAvailable = await scheduleService.isEmployeeAvailable(
  employeeId,
  appointmentStart,
  appointmentEnd
);

// 3. Create time block for appointment
if (isAvailable) {
  await scheduleService.createTimeBlock(
    employeeId,
    appointmentStart,
    appointmentEnd,
    'work',
    workshopId
  );
}
```

## Performance Considerations

### Caching Strategy

- Capacity data cached for 5 minutes
- Real-time updates trigger cache invalidation
- Historical data cached based on access patterns

### Optimization Tips

1. **Batch Operations:** Use batch operations for multiple assignments
2. **Lazy Loading:** Load schedule data only when needed
3. **Real-time Updates:** Subscribe to real-time updates for critical data
4. **Error Boundaries:** Implement proper error handling and retries

### Monitoring

**Key Metrics to Monitor:**
- Assignment success rates
- Average assignment processing time
- Cache hit rates
- Error rates by service
- Real-time update latency

---

*This API documentation is automatically generated from the service implementations. For the latest updates, refer to the source code comments and type definitions.*