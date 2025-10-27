# Troubleshooting Runbook - Time and Resource Management System

## Overview

This runbook provides systematic troubleshooting procedures for common issues in the Time and Resource Management System. Focus areas include incorrect assignment suggestions, system performance issues, and operational problems.

## 1. Incorrect Assignment Suggestions

### Problem: Smart Assignment Suggests Wrong Technician

**Symptoms:**
- Assignment recommendations don't match technician skills
- Poor performance predictions
- Inefficient workload distribution

**Diagnostic Steps:**

1. **Check Technician Skills Data**
   ```
   Diagnostic Query:
   - Navigate to Technician Profile
   - Verify skills list is current
   - Check certification status
   - Validate experience level
   ```

2. **Verify Work Order Requirements**
   ```
   Diagnostic Query:
   - Review work order service details
   - Check required skills specification
   - Validate complexity assessment
   - Confirm special tools/equipment needs
   ```

3. **Examine Scoring Algorithm**
   ```
   Debug Steps:
   - Access SmartAssignmentService logs
   - Review scoring calculation for specific assignment
   - Check factor weights (skills: 40%, availability: 20%, etc.)
   - Validate historical performance data
   ```

**Resolution Steps:**

1. **Update Technician Skills**
   ```
   Procedure:
   1. Go to Admin → Users → Technician Profiles
   2. Select affected technician
   3. Update skills list with current certifications
   4. Add new qualifications or specializations
   5. Save and verify changes
   ```

2. **Correct Work Order Data**
   ```
   Procedure:
   1. Open work order details
   2. Update service requirements
   3. Add missing skill requirements
   4. Specify equipment needs
   5. Re-run assignment suggestion
   ```

3. **Adjust Scoring Weights** (Advanced)
   ```
   Code Modification:
   - Locate SmartAssignmentService.calculateTechnicianScore()
   - Adjust factor weights based on business needs
   - Test with sample assignments
   - Deploy updated algorithm
   ```

**Prevention:**
- Regular skills assessment and updates
- Standardized work order templates
- Monthly algorithm performance reviews

---

### Problem: Auto Assignment Ignores Availability

**Symptoms:**
- Technicians assigned during off-hours
- Double-booking of appointments
- Assignments during scheduled breaks

**Diagnostic Steps:**

1. **Check Schedule Data**
   ```
   Verification:
   - Query employee schedule for assignment date
   - Verify shift times and break periods
   - Check for schedule conflicts
   - Validate time zone settings
   ```

2. **Review Availability Logic**
   ```
   Code Inspection:
   - Examine AutoAssignmentService.isTechnicianAvailable()
   - Check appointment conflict detection
   - Verify work order status checking
   - Validate recent assignment buffer (5 minutes)
   ```

3. **Examine Real-time Updates**
   ```
   System Check:
   - Verify schedule change notifications
   - Check for delayed updates
   - Validate cache invalidation
   - Test real-time sync
   ```

**Resolution Steps:**

1. **Update Employee Schedule**
   ```
   Immediate Fix:
   1. Access Employee Schedule Manager
   2. Correct shift times and breaks
   3. Remove conflicting time blocks
   4. Save and propagate changes
   ```

2. **Manual Assignment Override**
   ```
   Temporary Solution:
   1. Stop auto-assignment service
   2. Manually reassign affected jobs
   3. Update technician availability
   4. Restart auto-assignment when resolved
   ```

3. **Fix Availability Detection** (Technical)
   ```
   Code Update:
   - Update isTechnicianAvailable() method
   - Improve conflict detection logic
   - Add buffer time validation
   - Test with edge cases
   ```

**Prevention:**
- Daily schedule verification
- Automated schedule conflict detection
- Regular availability status audits

---

### Problem: Workload Imbalance Despite Rebalancing

**Symptoms:**
- Some technicians overloaded while others idle
- Inconsistent assignment distribution
- Poor utilization of skilled technicians

**Diagnostic Steps:**

1. **Analyze Current Workload**
   ```
   Data Query:
   - Get active assignments per technician
   - Calculate utilization rates
   - Identify overloaded/underloaded staff
   - Check assignment timestamps
   ```

2. **Review Rebalancing Logic**
   ```
   Algorithm Check:
   - Examine rebalanceWorkload() method
   - Verify threshold settings (3 concurrent jobs)
   - Check improvement calculation
   - Validate reassignment triggers
   ```

3. **Check Assignment History**
   ```
   Historical Analysis:
   - Review recent assignments
   - Identify patterns of imbalance
   - Check manual override frequency
   - Analyze assignment success rates
   ```

**Resolution Steps:**

1. **Manual Workload Adjustment**
   ```
   Immediate Action:
   1. Identify overloaded technicians
   2. Review their current assignments
   3. Reassign less urgent tasks
   4. Balance across available staff
   ```

2. **Adjust Rebalancing Parameters**
   ```
   Configuration Update:
   1. Modify max concurrent jobs limit
   2. Update improvement thresholds
   3. Adjust rebalancing frequency
   4. Test with current workload
   ```

3. **Implement Priority-based Assignment**
   ```
   Process Change:
   1. Add priority levels to work orders
   2. Update assignment algorithm
   3. Prioritize critical tasks
   4. Monitor distribution improvement
   ```

**Prevention:**
- Regular workload monitoring
- Automated rebalancing alerts
- Staff capacity planning
- Cross-training programs

---

## 2. System Performance Issues

### Problem: Slow Assignment Processing

**Symptoms:**
- Delayed assignment suggestions
- System timeouts during peak hours
- Poor user experience with lags

**Diagnostic Steps:**

1. **Check System Resources**
   ```
   Performance Monitoring:
   - Monitor CPU and memory usage
   - Check database query performance
   - Review network latency
   - Analyze concurrent user load
   ```

2. **Examine Caching Effectiveness**
   ```
   Cache Analysis:
   - Check cache hit rates
   - Verify cache invalidation timing
   - Monitor cache size limits
   - Review cache expiration settings
   ```

3. **Profile Service Calls**
   ```
   Performance Profiling:
   - Time individual service method calls
   - Identify bottlenecks in scoring algorithm
   - Check database query efficiency
   - Monitor external API calls
   ```

**Resolution Steps:**

1. **Optimize Database Queries**
   ```
   Database Tuning:
   1. Add indexes for frequently queried fields
   2. Optimize complex joins
   3. Implement query result caching
   4. Use database connection pooling
   ```

2. **Improve Caching Strategy**
   ```
   Cache Enhancement:
   1. Increase cache duration for stable data
   2. Implement multi-level caching
   3. Add cache warming for peak hours
   4. Optimize cache invalidation logic
   ```

3. **Scale System Resources**
   ```
   Infrastructure Scaling:
   1. Increase server capacity
   2. Implement load balancing
   3. Add database read replicas
   4. Optimize application server configuration
   ```

**Prevention:**
- Regular performance monitoring
- Automated scaling policies
- Query optimization reviews
- Capacity planning

---

### Problem: Assignment Service Unavailable

**Symptoms:**
- Assignment features not working
- Error messages in logs
- System appears to hang

**Diagnostic Steps:**

1. **Check Service Health**
   ```
   Health Check:
   - Verify service startup logs
   - Check database connectivity
   - Validate dependent services
   - Review error logs
   ```

2. **Examine Dependencies**
   ```
   Dependency Check:
   - Test Firestore connection
   - Verify authentication service
   - Check notification service
   - Validate queue service integration
   ```

3. **Review Recent Changes**
   ```
   Change Analysis:
   - Check recent deployments
   - Review configuration changes
   - Verify environment variables
   - Examine code modifications
   ```

**Resolution Steps:**

1. **Restart Services**
   ```
   Service Recovery:
   1. Stop affected services gracefully
   2. Clear any stuck processes
   3. Restart in correct order
   4. Verify service health endpoints
   ```

2. **Fix Configuration Issues**
   ```
   Configuration Repair:
   1. Validate environment variables
   2. Check service configuration files
   3. Verify database connection strings
   4. Update API keys and credentials
   ```

3. **Database Connection Issues**
   ```
   Database Fix:
   1. Test database connectivity
   2. Check connection pool settings
   3. Verify firewall rules
   4. Restore from backup if needed
   ```

**Prevention:**
- Implement health checks
- Add circuit breakers
- Create rollback procedures
- Monitor service dependencies

---

## 3. Data Quality Issues

### Problem: Inaccurate Technician Metrics

**Symptoms:**
- Wrong efficiency calculations
- Incorrect performance history
- Poor assignment recommendations

**Diagnostic Steps:**

1. **Verify Data Sources**
   ```
   Data Validation:
   - Check time entry accuracy
   - Validate work order completion data
   - Review customer feedback integration
   - Examine historical assignment records
   ```

2. **Examine Calculation Logic**
   ```
   Algorithm Review:
   - Verify efficiency calculation formulas
   - Check data aggregation methods
   - Validate time tracking accuracy
   - Review metric weighting
   ```

3. **Check Data Integrity**
   ```
   Integrity Check:
   - Look for missing or corrupted records
   - Verify data consistency across services
   - Check for duplicate entries
   - Validate foreign key relationships
   ```

**Resolution Steps:**

1. **Clean Historical Data**
   ```
   Data Cleanup:
   1. Identify corrupted records
   2. Remove duplicate entries
   3. Fill missing data gaps
   4. Recalculate affected metrics
   ```

2. **Fix Calculation Errors**
   ```
   Algorithm Correction:
   1. Update calculation formulas
   2. Fix data aggregation logic
   3. Correct metric weighting
   4. Test with sample data
   ```

3. **Implement Data Validation**
   ```
   Quality Assurance:
   1. Add data validation rules
   2. Implement automated checks
   3. Create data quality monitoring
   4. Set up alerts for anomalies
   ```

**Prevention:**
- Regular data quality audits
- Automated validation rules
- Data backup and recovery procedures
- Change management for data structures

---

### Problem: Schedule Conflicts Not Detected

**Symptoms:**
- Double-booked appointments
- Technicians scheduled during breaks
- Overlapping time blocks

**Diagnostic Steps:**

1. **Check Schedule Validation**
   ```
   Validation Test:
   - Test schedule creation with conflicts
   - Verify conflict detection logic
   - Check time block overlap detection
   - Validate break time enforcement
   ```

2. **Review Schedule Data**
   ```
   Data Inspection:
   - Examine schedule storage format
   - Check time zone handling
   - Verify date range calculations
   - Validate schedule update propagation
   ```

3. **Test Real-time Updates**
   ```
   Synchronization Check:
   - Verify schedule change notifications
   - Test concurrent schedule modifications
   - Check cache invalidation
   - Validate real-time conflict detection
   ```

**Resolution Steps:**

1. **Fix Immediate Conflicts**
   ```
   Manual Resolution:
   1. Identify all conflicting schedules
   2. Contact affected parties
   3. Reschedule conflicting appointments
   4. Update schedule records
   ```

2. **Improve Validation Logic**
   ```
   Code Enhancement:
   1. Strengthen conflict detection algorithms
   2. Add comprehensive validation rules
   3. Implement real-time conflict checking
   4. Add automated conflict resolution
   ```

3. **Update Schedule Management**
   ```
   Process Improvement:
   1. Implement schedule approval workflow
   2. Add conflict notification system
   3. Create schedule audit trails
   4. Develop conflict resolution procedures
   ```

**Prevention:**
- Automated conflict detection
- Schedule approval processes
- Regular schedule audits
- Training on scheduling best practices

---

## 4. Notification and Communication Issues

### Problem: Assignment Notifications Not Received

**Symptoms:**
- Technicians not notified of assignments
- Customers not receiving status updates
- Delayed or missing notifications

**Diagnostic Steps:**

1. **Check Notification Service**
   ```
   Service Verification:
   - Verify notification service status
   - Check message queue health
   - Review delivery logs
   - Test notification channels
   ```

2. **Validate User Preferences**
   ```
   User Settings Check:
   - Review notification preferences
   - Check contact information
   - Verify device registration
   - Validate subscription status
   ```

3. **Examine Message Content**
   ```
   Content Validation:
   - Check notification templates
   - Verify dynamic content insertion
   - Test QR code generation
   - Validate message formatting
   ```

**Resolution Steps:**

1. **Clear Notification Queue**
   ```
   Queue Management:
   1. Check queue status and backlog
   2. Clear stuck messages
   3. Restart notification processing
   4. Monitor queue health
   ```

2. **Update User Contact Info**
   ```
   User Data Fix:
   1. Verify email addresses
   2. Update phone numbers
   3. Check notification preferences
   4. Test notification delivery
   ```

3. **Fix Template Issues**
   ```
   Template Correction:
   1. Review notification templates
   2. Fix dynamic content issues
   3. Test template rendering
   4. Update with corrected templates
   ```

**Prevention:**
- Regular notification testing
- User preference validation
- Template maintenance procedures
- Queue monitoring and alerting

---

## 5. Emergency Procedures

### Critical System Failure

**Immediate Actions:**
1. **Stop Auto-Assignment**
   - Disable automatic assignment processing
   - Switch to manual assignment mode
   - Notify all technicians of manual process

2. **Activate Backup Systems**
   - Enable manual scheduling procedures
   - Use paper-based tracking if needed
   - Implement phone-based communication

3. **Communicate with Stakeholders**
   - Notify management of system status
   - Inform customers of potential delays
   - Provide status updates every 30 minutes

**Recovery Steps:**
1. **Diagnose Root Cause**
   - Review system logs for failure point
   - Check infrastructure health
   - Identify failed components

2. **Implement Fix**
   - Apply emergency patches if available
   - Restore from backup if necessary
   - Restart services in correct order

3. **Gradual System Restoration**
   - Start with read-only operations
   - Gradually enable write operations
   - Monitor system stability

### Data Loss Incident

**Immediate Response:**
1. **Stop All Operations**
   - Halt assignment processing
   - Prevent new data entry
   - Document current state

2. **Assess Data Loss**
   - Identify affected data sets
   - Determine recovery time
   - Evaluate business impact

3. **Activate Recovery Procedures**
   - Restore from latest backup
   - Reconcile manual records
   - Validate data integrity

**Post-Incident Actions:**
1. **Root Cause Analysis**
   - Investigate failure cause
   - Review backup procedures
   - Update incident response plan

2. **System Improvements**
   - Implement additional safeguards
   - Enhance monitoring capabilities
   - Update backup frequency

---

## 6. Monitoring and Alerting

### Key Metrics to Monitor

**System Health:**
- Service uptime and response times
- Error rates and types
- Queue lengths and processing rates
- Database performance metrics

**Business Metrics:**
- Assignment success rates
- Average assignment time
- Technician utilization rates
- Customer wait times

**Data Quality:**
- Schedule conflict rates
- Data validation error rates
- Cache hit rates
- API success rates

### Alert Thresholds

**Critical Alerts (Immediate Response):**
- System downtime > 5 minutes
- Assignment failure rate > 10%
- Queue backlog > 50 items
- Data inconsistency detected

**Warning Alerts (Review Within 1 Hour):**
- Response time > 3 seconds
- Error rate > 5%
- Cache miss rate > 30%
- Schedule conflicts detected

**Info Alerts (Monitor Trends):**
- Utilization rate changes > 20%
- Performance degradation trends
- Unusual assignment patterns
- User feedback spikes

### Regular Maintenance Tasks

**Daily:**
- Review system health dashboards
- Check for schedule conflicts
- Validate data quality metrics
- Monitor assignment success rates

**Weekly:**
- Performance trend analysis
- Capacity planning review
- User feedback review
- System update planning

**Monthly:**
- Comprehensive system audit
- Algorithm performance review
- User training verification
- Process improvement assessment

---

## 7. Contact Information

### Support Teams

**System Administration:**
- Primary: IT Support Team
- Backup: Development Team
- Emergency: On-call System Administrator

**Business Operations:**
- Primary: Operations Manager
- Backup: Assistant Manager
- Emergency: General Manager

**Technical Support:**
- Development Team Lead
- Database Administrator
- Infrastructure Team

### Escalation Procedures

**Level 1 (Initial Response):**
- IT Support or Operations staff
- Response time: 15 minutes
- Resolution time: 1 hour

**Level 2 (Technical Escalation):**
- Senior developers or system architects
- Response time: 30 minutes
- Resolution time: 4 hours

**Level 3 (Critical Incident):**
- Full incident response team
- Response time: 15 minutes
- Continuous monitoring until resolved

---

*This runbook should be updated after each incident to incorporate lessons learned and improve response procedures.*