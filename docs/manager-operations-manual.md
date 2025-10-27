# Manager Operations Manual - Time and Resource Management System

## Overview

The Time and Resource Management System provides managers with powerful tools to optimize workshop operations through intelligent assignment of technicians to work orders and appointments. The system uses advanced algorithms to match technician skills with job requirements while balancing workload and maximizing efficiency.

## Key Features

### Automated Assignment System
- **Auto Assignment Service**: Automatically assigns available technicians to queue entries based on availability and workload balancing
- **Smart Assignment Service**: Uses sophisticated scoring algorithms to find optimal technician-job matches
- **Real-time Capacity Monitoring**: Tracks workshop capacity utilization and technician availability

### Schedule Management
- **Employee Schedule Manager**: Create and manage technician schedules with shifts and breaks
- **Capacity Planning**: Predict future capacity needs and identify optimal appointment slots
- **Workload Balancing**: Automatically rebalance assignments when technicians become overloaded

## Accessing the Assignment System

### Assignment Management Interface

1. **Navigate to Admin Panel**
   - Log in as an administrator or manager
   - Go to Admin → Assignments → Assignment Management

2. **Assignment Management Dashboard**
   ```
   ┌─────────────────────────────────────────────────────────────┐
   │ Assignment Management Dashboard                            │
   ├─────────────────────────────────────────────────────────────┤
   │ ┌─ User Search ──────────────────┐ ┌─ Vehicle Search ──────┐ │
   │ │ Name: [____________________]   │ │ Brand: [___________]  │ │
   │ │ Email: [___________________]   │ │ Model: [___________]  │ │
   │ │ Role: [Technician ▼]           │ │ Year: [_____]         │ │
   │ │ [Search] [Clear]               │ │ Plate: [___________]  │ │
   │ └─────────────────────────────────┘ └───────────────────────┘ │
   │                                                             │
   │ ┌─ Selected Items ──────────────────────────────────────────┐ │
   │ │ User: Juan Pérez (Technician)                            │ │
   │ │ Vehicle: Honda CBR600RR - ABC123                         │ │
   │ │ [✓ Assign Vehicle]                                        │ │
   │ └───────────────────────────────────────────────────────────┘ │
   │                                                             │
   │ ┌─ Current Assignments ─────────────────────────────────────┐ │
   │ │ Technician          │ Vehicle             │ Status        │ │
   │ ├─────────────────────┼─────────────────────┼───────────────┤ │
   │ │ Juan Pérez          │ Honda CBR600RR      │ Active        │ │
   │ │ María García        │ Yamaha R1           │ Active        │ │
   │ │ Carlos López        │ Suzuki GSX-R        │ Pending       │ │
   │ └─────────────────────┴─────────────────────┴───────────────┘ │
   └─────────────────────────────────────────────────────────────┘
   ```

### Manual Assignment Process

1. **Search for Technician**
   - Use name, email, or role filters
   - Select from available technicians
   - System shows only active technicians

2. **Search for Vehicle**
   - Filter by brand, model, year, or license plate
   - System excludes already assigned vehicles
   - Select available vehicle

3. **Create Assignment**
   - Click "Assign Vehicle" button
   - System validates assignment
   - Assignment appears in current assignments table

## Automated Assignment Features

### Auto Assignment Service

The system automatically assigns technicians to queue entries every 2 minutes:

**How it works:**
1. Scans waiting queue entries
2. Identifies available technicians (no current appointments/work orders)
3. Uses workload balancing algorithm (least busy technician first)
4. Assigns entry and sends notifications
5. Prevents double assignments

**Manager Controls:**
- Service runs automatically in background
- Can be disabled for manual override
- View assignment history and success rates

### Smart Assignment Service

For complex assignments, use the intelligent assignment system:

**Scoring Factors:**
- **Skills Match (40%)**: Technician skills vs. job requirements
- **Availability (20%)**: Current availability status
- **Workload (20%)**: Current assignment load (max 3 concurrent jobs)
- **Efficiency (15%)**: Historical performance metrics
- **Proximity (5%)**: Location-based optimization

**Usage:**
```typescript
// Find best technician for a work order
smartAssignmentService.findBestTechnicianForJob(workOrderId)
  .subscribe(bestTechnician => {
    // Assign the technician
    smartAssignmentService.assignWorkOrderToTechnician(workOrderId, bestTechnician.id);
  });
```

## Schedule Management

### Creating Employee Schedules

1. **Access Schedule Manager**
   - Admin → Schedules → Employee Schedule Manager

2. **Create New Schedule**
   ```
   ┌─ Schedule Creation Form ─────────────────────────────────────┐
   │ Employee: [Juan Pérez ▼]                                    │
   │ Date: [2024-01-15 📅]                                        │
   │                                                             │
   │ ┌─ Shifts ──────────────────────────────────────────────────┐ │
   │ │ Shift Name: Morning Shift                                │ │
   │ │ Start Time: 08:00    End Time: 12:00                     │ │
   │ │ Days: Mon, Tue, Wed, Thu, Fri                            │ │
   │ │ [Add Shift]                                              │ │
   │ └───────────────────────────────────────────────────────────┘ │
   │                                                             │
   │ ┌─ Breaks ──────────────────────────────────────────────────┐ │
   │ │ Break Name: Lunch Break                                  │ │
   │ │ Duration: 30 minutes                                     │ │
   │ │ Start Time: 12:00                                        │ │
   │ │ [Add Break]                                              │ │
   │ └───────────────────────────────────────────────────────────┘ │
   │                                                             │
   │ [Save Schedule]                                             │
   └─────────────────────────────────────────────────────────────┘
   ```

3. **Schedule Validation**
   - System checks for conflicts
   - Validates shift times and break durations
   - Ensures minimum break requirements

### Weekly Schedule View

View and manage schedules across the week:

```
┌─ Weekly Schedule Overview ──────────────────────────────────────┐
│ Week of January 15-21, 2024                                   │
├─────┬─────┬─────┬─────┬─────┬─────┬─────┬───────────────────────┤
│     │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Actions              │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼───────────────────────┤
│ Juan│ 8-12│ 8-12│ 8-12│ 8-12│ 8-12│ Off │ [Edit] [Delete]     │
│     │12:30│12:30│12:30│12:30│12:30│     │                      │
│     │ -17 │ -17 │ -17 │ -17 │ -17 │     │                      │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼───────────────────────┤
│ María│ 9-13│ 9-13│ 9-13│ 9-13│ 9-13│ 9-13│ [Edit] [Delete]     │
│     │13:30│13:30│13:30│13:30│13:30│13:30│                      │
│     │ -18 │ -18 │ -18 │ -18 │ -18 │ -18 │                      │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴───────────────────────┘
```

## Capacity Management

### Monitoring Workshop Capacity

Access capacity dashboard to monitor real-time utilization:

**Key Metrics:**
- **Total Capacity**: Available technician-hours per day
- **Used Capacity**: Currently assigned work
- **Available Capacity**: Remaining capacity
- **Utilization Rate**: Percentage of capacity in use

**Capacity Dashboard:**
```
┌─ Workshop Capacity Overview ───────────────────────────────────┐
│ Current Status: 75% Utilized                                 │
├───────────────────────────────────────────────────────────────┤
│ Total Capacity: 64 hours/day                                │
│ Used Capacity: 48 hours                                     │
│ Available Capacity: 16 hours                                │
│                                                             │
│ ┌─ Active Work Orders ─────┐ ┌─ Scheduled Appointments ────┐ │
│ │ 🔧 Engine Repair (2h)    │ │ 📅 Oil Change (1h)          │ │
│ │ 🔧 Brake Service (3h)    │ │ 📅 Tire Rotation (0.5h)      │ │
│ │ 🔧 Electrical (4h)       │ │ 📅 Inspection (2h)           │ │
│ └──────────────────────────┘ └──────────────────────────────┘ │
│                                                             │
│ ┌─ Technician Availability ──────────────────────────────────┐ │
│ │ Juan Pérez: Available (2 slots)                           │ │
│ │ María García: Busy (until 14:00)                          │ │
│ │ Carlos López: Available (3 slots)                          │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### Capacity Planning

**Predict Future Capacity:**
```typescript
// Predict capacity for next week
workshopCapacityService.predictCapacity(nextWeekDate, 30)
  .subscribe(prediction => {
    console.log(`Predicted capacity: ${prediction.predictedCapacity}`);
    console.log(`Confidence: ${prediction.confidence}%`);
  });
```

**Find Optimal Appointment Slots:**
```typescript
// Get best slots for a 2-hour service
workshopCapacityService.getOptimalAppointmentSlots(date, 120)
  .subscribe(slots => {
    // Returns top 10 optimal time slots
  });
```

## Workload Balancing

### Automatic Rebalancing

The system automatically detects and corrects workload imbalances:

**Rebalancing Triggers:**
- Technician assigned more than 3 concurrent jobs
- Significant efficiency differences between assignments
- Overdue jobs requiring urgent reassignment

**Manual Rebalancing:**
```typescript
// Check for rebalancing opportunities
smartAssignmentService.suggestReassignments()
  .subscribe(suggestions => {
    suggestions.forEach(suggestion => {
      console.log(`Reassign ${suggestion.workOrderId} from ${suggestion.currentTechnicianId} to ${suggestion.suggestedTechnicianId}`);
      console.log(`Improvement: ${suggestion.improvement} points`);
    });
  });
```

### Escalation Procedures

**Overdue Job Handling:**
- Jobs overdue by 48+ hours automatically escalated
- System finds best available technician
- Reassignment notifications sent to all parties

## Reporting and Analytics

### Assignment Performance Reports

**Key Metrics:**
- Assignment success rate
- Average assignment time
- Technician utilization rates
- Customer wait times

### Schedule Compliance Reports

**Tracking:**
- Schedule adherence rates
- Break compliance
- Overtime hours
- Absenteeism patterns

## Best Practices

### Assignment Optimization

1. **Regular Capacity Reviews**
   - Check capacity dashboard daily
   - Plan for peak periods
   - Adjust staffing based on demand patterns

2. **Skill-Based Assignments**
   - Use smart assignment for complex jobs
   - Maintain updated technician skill profiles
   - Consider cross-training opportunities

3. **Schedule Planning**
   - Create schedules 2-4 weeks in advance
   - Allow buffer time between appointments
   - Plan for technician absences

### System Maintenance

1. **Data Accuracy**
   - Regularly update technician skills
   - Maintain accurate schedule information
   - Clean up completed assignments

2. **Performance Monitoring**
   - Review assignment success rates weekly
   - Monitor system performance metrics
   - Address bottlenecks promptly

## Troubleshooting

### Common Issues

**Assignments Not Processing:**
- Check technician availability status
- Verify queue entry status
- Review system logs for errors

**Schedule Conflicts:**
- Use conflict detection tools
- Manually resolve overlapping appointments
- Update technician availability

**Capacity Overload:**
- Implement appointment buffers
- Add temporary staff
- Reschedule non-urgent work

## Support and Training

### Getting Help

- **System Documentation**: Refer to API documentation for technical details
- **User Training**: Schedule training sessions for new managers
- **Technical Support**: Contact IT support for system issues

### Training Resources

- **Quick Start Guide**: Basic assignment operations
- **Advanced Features**: Smart assignment and capacity planning
- **Best Practices**: Optimization techniques and procedures

---

*This manual is updated regularly. Check for updates before implementing major changes.*