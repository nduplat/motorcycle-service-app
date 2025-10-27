# Workflow Diagrams - Time and Resource Management System

## Overview

This document contains flow diagrams for critical processes in the Time and Resource Management System. Each diagram shows the step-by-step flow of key operations, decision points, and system interactions.

## 1. Auto Assignment Process

```
┌─────────────────┐
│   Start Auto    │
│  Assignment     │
│   Process       │
└─────────┬───────┘
          │
          v
┌─────────────────┐     ┌─────────────────┐
│  Check if       │     │  Get Waiting    │
│ Processing      │     │  Queue Entries  │
│ Already Running │     └─────────┬───────┘
└─────────┬───────┘               │
          │                       v
          │             ┌─────────────────┐
          │             │  Any Waiting    │
          │             │   Entries?      │
          │             └─────────┬───────┘
          │                       │
          │              NO       │
          │             ┌─────────┴─────────┐
          │             │   Log: No waiting│
          │             │   entries to     │
          │             │   assign         │
          │             └──────────────────┘
          │                       │
          │                       v
          │             ┌─────────────────┐
          │             │     End         │
          └─────────────┼─────────────────┘
                        │
                       YES
                        │
                        v
              ┌─────────────────┐
              │  Get Available  │
              │  Technicians    │
              └─────────┬───────┘
                        │
                        v
              ┌─────────────────┐
              │  Any Available  │
              │ Technicians?    │
              └─────────┬───────┘
                        │
               NO       │
              ┌─────────┴─────────┐
              │   Log: No         │
              │ available techs   │
              └──────────────────┘
                        │
                        v
              ┌─────────────────┐
              │      End        │
              └─────────────────┘
                        │
                       YES
                        │
                        v
              ┌─────────────────┐
              │  Sort Entries   │
              │  by Position    │
              │   (FIFO)        │
              └─────────┬───────┘
                        │
                        v
              ┌─────────────────┐     ┌─────────────────┐
              │   For Each      │     │  Find Best      │
              │   Entry         │     │  Technician     │
              └─────────┬───────┘     │  (Workload      │
                        │            │   Balance)      │
                        v            └─────────┬───────┘
              ┌─────────────────┐               │
              │   Best Tech     │               │
              │   Found?        │               │
              └─────────┬───────┘               │
                        │                       │
               NO       │                       │
              ┌─────────┴─────────┐             │
              │   Log: No         │             │
              │ suitable tech     │             │
              └──────────────────┘             │
                        │                       │
                        v                       │
              ┌─────────────────┐               │
              │   Continue to   │               │
              │   Next Entry    │               │
              └─────────────────┘               │
                        │                       │
                        │                       │
                        │              YES      │
                        │             ┌─────────┴─────────┐
                        │             │  Assign Entry    │
                        │             │  to Technician   │
                        │             └─────────┬───────┘
                        │                       │
                        │                       v
                        │             ┌─────────────────┐
                        │             │  Create/Update  │
                        │             │  Appointment/   │
                        │             │  Work Order     │
                        │             └─────────┬───────┘
                        │                       │
                        │                       v
                        │             ┌─────────────────┐
                        │             │  Send           │
                        │             │  Notifications  │
                        │             │  (Tech & Cust)  │
                        │             └─────────┬───────┘
                        │                       │
                        │                       v
                        │             ┌─────────────────┐
                        │             │  Remove Tech    │
                        │             │  from Available │
                        │             │  List           │
                        │             └─────────────────┘
                        │
                        v
              ┌─────────────────┐
              │   All Entries   │
              │   Processed?    │
              └─────────┬───────┘
                        │
               NO       │
              ┌─────────┴─────────┐
              │   Continue       │
              │   Processing     │
              └─────────────────┘
                        │
                       YES
                        │
                        v
              ┌─────────────────┐
              │   Set Processing│
              │   Status to     │
              │   Complete      │
              └─────────────────┘
                        │
                        v
              ┌─────────────────┐
              │      End        │
              └─────────────────┘
```

## 2. Smart Assignment Process

```
┌─────────────────┐
│  Smart Assignment│
│   Requested     │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Get Work Order │
│   Details       │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Work Order     │
│   Exists?       │
└─────────┬───────┘
          │
 NO       │
┌─────────┴─────────┐
│  Return Error:   │
│  Work Order Not  │
│  Found           │
└──────────────────┘
          │
         YES
          │
          v
┌─────────────────┐
│  Get All        │
│  Technicians    │
└─────────┬───────┘
          │
          v
┌─────────────────┐     ┌─────────────────┐
│  For Each       │     │  Calculate      │
│  Technician     │     │  Score:         │
│                 │     │  • Skills Match │
│                 │     │  • Availability │
│                 │     │  • Workload     │
│                 │     │  • Efficiency   │
│                 │     │  • Proximity    │
└─────────┬───────┘     └─────────┬───────┘
          │                       │
          v                       │
┌─────────────────┐               │
│  All Techs      │               │
│  Scored?        │               │
└─────────┬───────┘               │
          │                       │
 NO       │                       │
┌─────────┴─────────┐             │
│   Continue       │             │
│   Scoring        │             │
└─────────────────┘             │
          │                       │
         YES                      │
          │             ┌─────────┴─────────┐
          │             │  Sort Scores     │
          │             │  Descending      │
          └─────────────┼──────────────────┘
                        │
                        v
              ┌─────────────────┐
              │  Get Top        │
              │  Technician     │
              └─────────┬───────┘
                        │
                        v
              ┌─────────────────┐
              │  Return Best    │
              │  Technician     │
              └─────────────────┘
```

## 3. Schedule Creation and Validation

```
┌─────────────────┐
│  Create Schedule│
│   Request       │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Validate       │
│  Employee       │
│  (Role Check)   │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Valid Employee?│
└─────────┬───────┘
          │
 NO       │
┌─────────┴─────────┐
│  Throw Error:    │
│  Invalid Employee│
└──────────────────┘
          │
         YES
          │
          v
┌─────────────────┐
│  Check Schedule  │
│  Exists for Date │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Schedule       │
│  Exists?        │
└─────────┬───────┘
          │
        YES       │
┌─────────┴─────────┐
│  Throw Error:    │
│  Schedule Exists │
└──────────────────┘
          │
         NO
          │
          v
┌─────────────────┐
│  Calculate      │
│  Total Hours    │
│  (Shifts -      │
│   Breaks)       │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Create Schedule│
│  Document       │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Save to        │
│  Firestore      │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Return Created │
│  Schedule       │
└─────────────────┘
```

## 4. Availability Checking Process

```
┌─────────────────┐
│  Check Employee │
│  Availability   │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Get Employee   │
│  Schedule for   │
│  Target Date    │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Schedule       │
│  Exists?        │
└─────────┬───────┘
          │
 NO       │
┌─────────┴─────────┐
│  Return: Not     │
│  Available       │
│  (No Schedule)   │
└──────────────────┘
          │
         YES
          │
          v
┌─────────────────┐
│  Check Time     │
│  Within Any     │
│  Shift?         │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Within Shift?  │
└─────────┬───────┘
          │
 NO       │
┌─────────┴─────────┐
│  Return: Not     │
│  Available       │
│  (Outside Shift) │
└──────────────────┘
          │
         YES
          │
          v
┌─────────────────┐
│  Check Break    │
│  Conflicts      │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Break Conflict │
│  Exists?        │
└─────────┬───────┘
          │
        YES       │
┌─────────┴─────────┐
│  Return: Not     │
│  Available       │
│  (On Break)      │
└──────────────────┘
          │
         NO
          │
          v
┌─────────────────┐
│  Check Existing │
│  Time Blocks    │
│  (Appointments) │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Time Block     │
│  Conflict?      │
└─────────┬───────┘
          │
        YES       │
┌─────────┴─────────┐
│  Return: Not     │
│  Available       │
│  (Double Booked) │
└──────────────────┘
          │
         NO
          │
          v
┌─────────────────┐
│  Return:        │
│  Available      │
└─────────────────┘
```

## 5. Capacity Calculation Process

```
┌─────────────────┐
│  Calculate      │
│  Capacity       │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Check Cache    │
│  (5 min TTL)    │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Cache Hit?     │
└─────────┬───────┘
          │
        YES       │
┌─────────┴─────────┐
│  Return Cached   │
│  Data            │
└──────────────────┘
          │
         NO
          │
          v
┌─────────────────┐
│  Get Work Orders│
│  (Active)       │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Get Appointments│
│  (Today, Active)│
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Get All        │
│  Technicians    │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Count Active   │
│  Work Orders    │
│  (in_progress,  │
│   waiting_parts)│
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Count Today's  │
│  Appointments   │
│  (scheduled,    │
│   confirmed,    │
│   in_progress)  │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Identify Busy  │
│  Technicians    │
│  (Current Work) │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Count Available│
│  Technicians    │
│  (Active & Not  │
│   Busy)         │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Calculate      │
│  Metrics:       │
│  • Total Cap.   │
│    (Techs × 8h) │
│  • Used Cap.    │
│    (Active WO + │
│     Appts)      │
│  • Available Cap│
│  • Utilization %│
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Cache Results  │
│  (5 minutes)    │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Return Capacity│
│  Data           │
└─────────────────┘
```

## 6. Work Order Assignment Flow

```
┌─────────────────┐
│  Assign Work    │
│  Order Request  │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Validate       │
│  Work Order     │
│  Exists         │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Work Order     │
│  Valid?         │
└─────────┬───────┘
          │
 NO       │
┌─────────┴─────────┐
│  Throw Error:    │
│  Work Order Not  │
│  Found           │
└──────────────────┘
          │
         YES
          │
          v
┌─────────────────┐
│  Validate       │
│  Technician     │
│  Exists         │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Technician     │
│  Valid?         │
└─────────┬───────┘
          │
 NO       │
┌─────────┴─────────┐
│  Throw Error:    │
│  Technician Not  │
│  Found           │
└──────────────────┘
          │
         YES
          │
          v
┌─────────────────┐
│  Update Work    │
│  Order with     │
│  Assignment     │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Update         │
│  Successful?    │
└─────────┬───────┘
          │
 NO       │
┌─────────┴─────────┐
│  Throw Error:    │
│  Update Failed   │
└──────────────────┘
          │
         YES
          │
          v
┌─────────────────┐
│  Update Tech    │
│  Availability   │
│  (if needed)    │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Return Updated │
│  Work Order     │
└─────────────────┘
```

## 7. Queue Entry Processing

```
┌─────────────────┐
│  Customer Joins │
│  Queue          │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Create Queue   │
│  Entry          │
│  (waiting)      │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Auto Assignment│
│  Service        │
│  Triggered      │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Available      │
│  Technician     │
│  Found?         │
└─────────┬───────┘
          │
 NO       │
┌─────────┴─────────┐
│  Queue Entry     │
│  Remains Waiting │
│  (Position Held) │
└──────────────────┘
          │
         YES
          │
          v
┌─────────────────┐
│  Update Queue   │
│  Entry Status   │
│  to 'called'    │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Assign to      │
│  Technician     │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Create/Update  │
│  Appointment or │
│  Work Order     │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Send QR Code   │
│  to Customer    │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Notify         │
│  Technician     │
│  (Assignment)   │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Customer       │
│  Presents QR    │
│  Code           │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Validate QR    │
│  Code           │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Start Service  │
│  (Timer Begins) │
└─────────────────┘
```

## 8. Time Tracking Workflow

```
┌─────────────────┐
│  Technician     │
│  Starts Job     │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Start Time     │
│  Entry          │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Set Status to  │
│  'Busy'         │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Timer Running  │
│  in Background  │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Technician     │
│  Takes Break?   │
└─────────┬───────┘
          │
        YES       │
┌─────────┴─────────┐
│  Pause Timer     │
│  Automatically   │
└──────────────────┘
          │
         NO
          │
          v
┌─────────────────┐
│  Job Completed? │
└─────────┬───────┘
          │
 NO       │
┌─────────┴─────────┐
│  Continue Work   │
│  (Timer Running) │
└─────────────────┘
          │
         YES
          │
          v
┌─────────────────┐
│  Stop Timer     │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Calculate      │
│  Total Time     │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Record Time    │
│  Entry          │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Set Status to  │
│  'Available'    │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Generate Time  │
│  Report         │
└─────────────────┘
```

## 9. Notification System Flow

```
┌─────────────────┐
│  Event Occurs   │
│  (Assignment,   │
│   Status Change,│
│   etc.)         │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Determine      │
│  Notification   │
│  Type & Target  │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Check User     │
│  Preferences    │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Notifications  │
│  Enabled?       │
└─────────┬───────┘
          │
 NO       │
┌─────────┴─────────┐
│  Skip            │
│  Notification    │
└──────────────────┘
          │
         YES
          │
          v
┌─────────────────┐
│  Generate       │
│  Message        │
│  Content        │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Include        │
│  Metadata?      │
│  (QR Codes,     │
│   Links, etc.)  │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Send to        │
│  System         │
│  Notification   │
│  Service        │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Queue for      │
│  Delivery       │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Deliver via    │
│  Multiple       │
│  Channels:      │
│  • In-App       │
│  • Push         │
│  • Email        │
│  • SMS          │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Mark as Sent   │
│  & Log          │
└─────────────────┘
```

## 10. Capacity Planning Process

```
┌─────────────────┐
│  Capacity       │
│  Planning       │
│  Request        │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Determine      │
│  Time Frame     │
│  (Date Range)   │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Gather         │
│  Historical     │
│  Data           │
│  (Appointments, │
│   Work Orders)  │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Analyze        │
│  Patterns:      │
│  • Daily Usage   │
│  • Peak Hours    │
│  • Seasonal      │
│    Trends        │
│  • Technician    │
│    Utilization   │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Calculate      │
│  Baseline       │
│  Capacity       │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Apply          │
│  Adjustments:   │
│  • Day of Week   │
│  • Special Events│
│  • Staff Changes │
│  • Seasonal      │
│    Factors       │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Generate       │
│  Forecast       │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Calculate      │
│  Confidence     │
│  Score          │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Identify       │
│  Risk Factors   │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Generate       │
│  Recommendations│
│  • Staffing      │
│  • Scheduling    │
│  • Process       │
│    Changes       │
└─────────┬───────┘
          │
          v
┌─────────────────┐
│  Return Capacity│
│  Plan           │
└─────────────────┘
```

## Legend

### Symbols Used

- **┌─┐**: Process/Action
- **└─┘**: Terminator/End
- **└─┬─**: Decision Point
- **─│─**: Flow Line
- **─v─**: Downward Flow
- **>**: Direction Arrow

### Status Indicators

- **🟢**: Success Path
- **🔴**: Error Path
- **🟡**: Warning/Alternative Path
- **⚫**: Normal Flow

### Process Types

- **Automatic**: System-triggered processes
- **Manual**: User-initiated processes
- **Conditional**: Decision-based processes
- **Parallel**: Concurrent processes

---

*These diagrams represent the logical flow of system processes. Actual implementation may include additional error handling and edge cases not shown for clarity.*