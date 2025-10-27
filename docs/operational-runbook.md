# 📖 Operational Runbook
## Cost Optimization System Procedures

### Crisis Response Procedures

#### Budget Alert: 80% Threshold Reached

**Immediate Diagnosis**
1. Access cost monitoring dashboard: `/admin/cost-monitoring`
2. Identify highest cost contexts:
```bash
# Firestore query
db.collection('ai_budget')
  .doc(currentMonth)
  .get()
  .then(doc => console.log(doc.data().byContext))
```

**Corrective Actions (Priority Order)**

**Level 1: Non-Disruptive Adjustments (10 minutes)**
- [ ] Increase cache TTL for high-cost contexts
- [ ] Expand fallback library for affected contexts
- [ ] Verify rate limits are active and properly configured
- [ ] Review and optimize recent AI usage patterns

**Level 2: Temporary Reduction (30 minutes)**
- [ ] Reduce rate limits by 25%:
```typescript
// rate-limiter.service.ts
customer: { chatbot: 5 → 4, search: 10 → 8 }
```
- [ ] Enable "cost-saving mode" for non-critical features
- [ ] Notify administrators of budget status
- [ ] Schedule review meeting for budget optimization

**Level 3: Emergency Measures (Immediate)**
- [ ] Activate budget circuit breaker
- [ ] Temporarily disable AI features for new users
- [ ] Force 50% fallback responses
- [ ] Notify stakeholders of budget threshold breach

#### Budget Alert: 100% Threshold Reached (Budget Exhausted)

**Immediate Diagnosis**
1. Confirm budget exhaustion via dashboard
2. Identify final usage spike cause
3. Check for any budget extension options

**Emergency Response (Immediate Action Required)**
- [ ] Activate full emergency mode
- [ ] Disable all AI services except critical operations
- [ ] Switch to 100% fallback responses
- [ ] Notify all users of service degradation
- [ ] Contact budget administrators for emergency funding
- [ ] Implement manual approval process for any AI usage

#### Rate Limiting Incident Response

**Symptom: Rate Limit Exceeded Alerts**

**Diagnosis**
1. Check rate limiting dashboard for violations
2. Identify affected user/service patterns:
```typescript
// Check rate limit violations
db.collection('rate_limit_violations')
  .where('timestamp', '>', lastHour)
  .orderBy('timestamp', 'desc')
  .limit(50)
```

**Response Procedures**

**Immediate Actions (5 minutes)**
- [ ] Temporarily increase rate limits for affected services
- [ ] Enable progressive backoff for violating clients
- [ ] Notify affected users of temporary restrictions

**Investigation (15 minutes)**
- [ ] Analyze usage patterns causing violations
- [ ] Check for potential abuse or system issues
- [ ] Review rate limit configurations

**Resolution Steps**
- [ ] Implement adaptive rate limiting if needed
- [ ] Update rate limit policies based on findings
- [ ] Document incident and preventive measures

## Cache Hit Rate Monitoring and Optimization

#### Symptom: Cache Hit Rate <50%

**Diagnosis**
1. Review logs of most frequent queries:
```typescript
db.collection('ai_usage_logs')
  .where('timestamp', '>', last24h)
  .orderBy('prompt')
  .limit(100)
```

2. Identify non-cacheable queries:
   - Highly varied prompts (solution: normalization)
   - Very short TTLs (solution: extend)
   - Excessive cache invalidation (solution: review triggers)

**Corrective Actions**
- [ ] Improve semantic key generation
- [ ] Add fallbacks for frequently uncached queries
- [ ] Review cache expiration logic
- [ ] Implement cache warming for common queries
- [ ] Monitor cache performance metrics

### System Health Monitoring Procedures

**Daily Health Checks**
- [ ] Verify all services are responding (API endpoints)
- [ ] Check database connectivity and performance
- [ ] Monitor cache hit rates and memory usage
- [ ] Review error logs for patterns
- [ ] Validate backup completion status

**Automated Monitoring Alerts**
- [ ] Response time > 2 seconds
- [ ] Error rate > 5%
- [ ] Database connection failures
- [ ] Cache miss rate > 70%
- [ ] Memory usage > 85%

**Incident Response for System Degradation**
1. **High Response Times**
   - Scale up server instances
   - Check database query performance
   - Clear application caches if needed
   - Enable query optimization

2. **High Error Rates**
   - Review recent deployments
   - Check external service dependencies
   - Roll back to previous version if necessary
   - Enable circuit breakers

3. **Database Issues**
   - Check connection pool status
   - Verify database server health
   - Implement read replicas if available
   - Contact database administrators

### Emergency Mode Procedures

#### Activation Criteria
- Budget exceeded 100%
- Critical system failure
- Security breach detected
- External service outage affecting core functionality

#### Emergency Mode Activation
1. **Immediate Actions**
   - [ ] Enable emergency mode flag in configuration
   - [ ] Switch all AI services to fallback mode
   - [ ] Disable non-essential features
   - [ ] Notify all active users of emergency status

2. **Service Degradation Steps**
   - [ ] Reduce API rate limits to minimum
   - [ ] Enable read-only mode for data operations
   - [ ] Activate backup systems if available
   - [ ] Implement manual approval for critical operations

#### Emergency Mode Deactivation
1. **Recovery Verification**
   - [ ] Confirm root cause resolution
   - [ ] Test system functionality with sample requests
   - [ ] Verify budget status and external services
   - [ ] Perform gradual load testing

2. **Gradual Restoration**
   - [ ] Slowly increase rate limits
   - [ ] Re-enable AI services incrementally
   - [ ] Monitor system performance during restoration
   - [ ] Notify users of service restoration

### Data Recovery and Backup Procedures

**Automated Backup Schedule**
- Daily full backups at 2:00 AM UTC
- Hourly incremental backups during business hours
- Real-time replication to secondary region

**Manual Backup Procedures**
1. **Database Backup**
   ```bash
   # Create manual backup
   firebase firestore:export gs://backup-bucket/manual-$(date +%Y%m%d-%H%M%S)
   ```

2. **Configuration Backup**
   - Export environment variables
   - Backup service configurations
   - Document current system state

**Data Recovery Procedures**
1. **Point-in-Time Recovery**
   - Identify recovery point timestamp
   - Stop all write operations
   - Execute recovery command
   - Validate data integrity

2. **Full System Recovery**
   - Restore from latest backup
   - Reconfigure services
   - Test functionality
   - Notify users of completion

**Disaster Recovery**
- Cross-region failover procedures
- Data center migration steps
- Business continuity plans
- Communication protocols during outages

### Performance Optimization Procedures

**Regular Performance Reviews**
- [ ] Analyze slow query logs weekly
- [ ] Review cache performance metrics
- [ ] Monitor resource utilization trends
- [ ] Identify performance bottlenecks

**Optimization Actions**
1. **Database Optimization**
   - Add missing indexes
   - Optimize query patterns
   - Implement query result caching
   - Archive old data

2. **Application Optimization**
   - Implement lazy loading
   - Optimize bundle sizes
   - Enable compression
   - Implement CDN for static assets

3. **Cache Optimization**
   - Adjust TTL values based on usage patterns
   - Implement cache warming
   - Add cache invalidation strategies
   - Monitor cache hit rates

### Administrative Procedures for Budget Management

**Monthly Budget Review**
- [ ] Analyze spending by service and context
- [ ] Compare actual vs budgeted costs
- [ ] Identify cost-saving opportunities
- [ ] Adjust budget allocations if needed

**Budget Adjustment Procedures**
1. **Increase Budget Request**
   - Document business justification
   - Provide cost-benefit analysis
   - Get stakeholder approval
   - Update budget configurations

2. **Emergency Budget Extension**
   - Contact finance department immediately
   - Provide incident details and impact assessment
   - Request temporary budget increase
   - Update monitoring thresholds

**Cost Control Measures**
- [ ] Implement spending alerts at 50%, 80%, 100%
- [ ] Set up automated cost optimization rules
- [ ] Regular review of AI usage patterns
- [ ] Training for developers on cost-efficient practices

## Symptom: Users Report Incorrect Responses

### Diagnosis
1. Check if it's stale cached response:
```typescript
// Check cache entry timestamp
db.collection('ai_cache')
  .where('createdAt', '<', cutoffDate)
  .get()
```

2. Verify outdated fallback responses

### Corrective Actions
- [ ] Manually invalidate cache:
```typescript
await aiAssistant.invalidateCache('product_search:*')
```
- [ ] Update fallback responses
- [ ] Adjust TTLs for volatile data