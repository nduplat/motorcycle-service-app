# API Documentation - Blue Dragon Motors

## Overview

The Blue Dragon Motors system provides comprehensive APIs for workshop management, time tracking, and resource optimization. This documentation covers all services related to the core functionality.

## Service Architecture

### Core Services

- **AutoAssignmentService**: Automatic queue management and technician assignment
- **SmartAssignmentService**: Intelligent assignment with scoring algorithms
- **EmployeeScheduleService**: Employee scheduling and availability management
- **WorkshopCapacityService**: Capacity planning and utilization tracking
- **AIAssistantService**: AI-powered assistance with cost optimization
- **CacheService**: Intelligent caching system
- **RateLimiterService**: Request rate limiting
- **CostMonitoringService**: Cost tracking and analytics

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

#### `stopPeriodicAssignment(): void`

**Description:** Stop the periodic auto-assignment process.

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

#### `rebalanceWorkload(): Observable<ReassignmentSuggestion[]>`

**Description:** Analyze current workload distribution and suggest reassignments.

**Returns:** Observable emitting array of reassignment suggestions

#### `suggestReassignments(): Observable<ReassignmentSuggestion[]>`

**Description:** Suggest optimal reassignments for better efficiency.

**Returns:** Observable emitting array of reassignment suggestions sorted by improvement

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

## AIAssistantService

### Overview
Provides AI-powered assistance with intelligent caching and cost optimization.

### Key Methods

#### `query(prompt: string, context: 'chatbot' | 'scanner' | 'workOrder' | 'productSearch', userId: string): Promise<AIResponse>`

**Description:** Main entry point for AI queries with full cost optimization.

**Parameters:**
- `prompt`: User query string
- `context`: Query context type
- `userId`: ID of the user making the query

**Returns:** Promise resolving to AI response with metadata

**Response Structure:**
```typescript
interface AIResponse {
  response: string;
  tokens: number;
  cached: boolean;
  provider: 'gemini' | 'fallback';
  timestamp: Timestamp;
}
```

### Cost Optimization Features

#### Fallback Responses
Pre-generated responses for common queries (free, instant):
- Business hours and location
- Service information
- Contact details
- Common product searches

#### Intelligent Caching
- Semantic cache keys for similar queries
- TTL-based expiration (1h-30d)
- Firestore-backed cache storage

#### Rate Limiting
- Role-based limits (technicians: 50/day, customers: 5/day)
- Graceful degradation to fallback responses
- Budget protection

## CacheService

### Overview
Provides intelligent caching with semantic key generation and TTL management.

### Key Methods

#### `get<T>(key: string): Promise<T | null>`

**Description:** Retrieve cached data by key.

**Parameters:**
- `key`: Cache key

**Returns:** Promise resolving to cached data or null

#### `set<T>(key: string, data: T, ttlMs: number): Promise<void>`

**Description:** Store data in cache with TTL.

**Parameters:**
- `key`: Cache key
- `data`: Data to cache
- `ttlMs`: Time to live in milliseconds

**Returns:** Promise that resolves when data is cached

#### `invalidate(pattern: string): Promise<void>`

**Description:** Invalidate cache entries matching a pattern.

**Parameters:**
- `pattern`: Pattern to match for invalidation

## RateLimiterService

### Overview
Manages request rate limiting with role-based quotas and graceful degradation.

### Key Methods

#### `checkLimit(userId: string, feature: string): Promise<boolean>`

**Description:** Check if user is within rate limits for a feature.

**Parameters:**
- `userId`: ID of the user
- `feature`: Feature being accessed

**Returns:** Promise resolving to true if within limits, false otherwise

### Rate Limits by Role

```typescript
const limits = {
  technician: {
    chatbot: 50,      // requests/day
    scanner: 100,
    workOrder: 30
  },
  customer: {
    chatbot: 5,       // requests/day
    productSearch: 10
  }
};
```

## CostMonitoringService

### Overview
Tracks AI usage costs and provides budget monitoring and alerts.

### Key Methods

#### `trackAICall(context: string, tokens: number, provider: string): Promise<void>`

**Description:** Record an AI API call for cost tracking.

**Parameters:**
- `context`: Usage context (chatbot, scanner, etc.)
- `tokens`: Number of tokens consumed
- `provider`: AI provider used

#### `getCurrentMonthCost(): Promise<number>`

**Description:** Get total costs for current month.

**Returns:** Promise resolving to current month cost in USD

#### `getBudgetStatus(): Promise<BudgetStatus>`

**Description:** Get current budget status and alerts.

**Returns:** Promise resolving to budget status information

**Budget Status:**
```typescript
interface BudgetStatus {
  currentCost: number;
  budget: number;
  percentage: number;
  status: 'optimal' | 'monitoring' | 'critical';
  alerts: string[];
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

**Rate Limit Exceeded:**
```typescript
try {
  await aiService.query(prompt, context, userId);
} catch (error) {
  if (error.code === 'rate-limit-exceeded') {
    // Show user-friendly message
    toast.warning('Daily limit reached. Try again tomorrow.');
  }
}
```

**Budget Exceeded:**
```typescript
try {
  await aiService.query(prompt, context, userId);
} catch (error) {
  if (error.code === 'budget-exceeded') {
    // Auto-disable AI features
    toast.error('AI features temporarily disabled due to budget constraints.');
  }
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