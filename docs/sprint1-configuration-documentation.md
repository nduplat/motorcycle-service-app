# Sprint 1 Configuration Documentation

## Overview

This document provides comprehensive configuration documentation for the Sprint 1 implementation of Blue Dragon Motors AI Assistant. It covers Firebase setup, environment variables, security rules, service configurations, deployment procedures, and operational guidelines.

## Table of Contents

1. [Firebase Configuration](#firebase-configuration)
2. [Environment Variables](#environment-variables)
3. [API Keys and Security](#api-keys-and-security)
4. [Security Rules](#security-rules)
5. [Service Configurations](#service-configurations)
6. [Cloud Functions Setup](#cloud-functions-setup)
7. [Deployment Guides](#deployment-guides)
8. [Integration Points](#integration-points)
9. [Monitoring and Maintenance](#monitoring-and-maintenance)
10. [Troubleshooting](#troubleshooting)
11. [Best Practices](#best-practices)

## Firebase Configuration

### Project Setup

The application uses Firebase as the primary backend platform with the following services:

- **Firestore**: Primary database for application data
- **Firebase Authentication**: User authentication and authorization
- **Cloud Storage**: File storage for images and documents
- **Cloud Functions**: Serverless backend functions
- **Firebase Hosting**: Frontend hosting

### Firebase Project ID

- **Production**: `bbddmm-387a7`
- **Staging**: `bbddmm-staging` (recommended for testing)
- **Development**: `bbddmm-dev` (local development)

### Firebase Configuration Object

```javascript
const firebaseConfig = {
  apiKey: "your_firebase_api_key_here",
  authDomain: "bbddmm-387a7.firebaseapp.com",
  projectId: "bbddmm-387a7",
  storageBucket: "bbddmm-387a7.firebasestorage.app",
  messagingSenderId: "647494031256",
  appId: "1:647494031256:web:a7fa67efda4b85b1003ded"
};
```

## Environment Variables

### Frontend Environment Variables (.env)

Create environment files in the project root:

```bash
# Development (.env)
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=bbddmm-387a7.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=bbddmm-387a7
VITE_FIREBASE_STORAGE_BUCKET=bbddmm-387a7.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=647494031256
VITE_FIREBASE_APP_ID=1:647494031256:web:a7fa67efda4b85b1003ded

VITE_AI_PROXY_URL=https://your-ai-proxy-url.onrender.com

VITE_APP_NAME="Blue Dragon Motors"
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=development

# Optional: Analytics and Monitoring
VITE_GA_TRACKING_ID=
VITE_SENTRY_DSN=

# Optional: Third-party integrations
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_MAPBOX_ACCESS_TOKEN=
```

### Functions Environment Variables (functions/.env)

```bash
# AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase Admin (automatically configured)
# FIREBASE_CONFIG is set by Firebase CLI

# Application Settings
NODE_ENV=production
LOG_LEVEL=info

# Optional: External APIs
STRIPE_SECRET_KEY=
SENDGRID_API_KEY=

# Optional: Monitoring
SENTRY_DSN=
```

### Environment Setup Script

Use the provided setup script to create environment templates:

```bash
# Create all environment files
./scripts/setup-env.sh create all

# Create specific environment
./scripts/setup-env.sh create production

# Validate environment configuration
./scripts/setup-env.sh validate production
```

## API Keys and Security

### AI Proxy Authentication

The AI proxy uses Bearer token authentication:

```bash
# Valid API keys are configured in Firebase Functions config
# or environment variables as VALID_API_KEYS (comma-separated)

curl -X POST https://your-region-your-project.cloudfunctions.net/groqChat \
  -H "Authorization: Bearer your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

### Rate Limiting

API endpoints include built-in rate limiting:

- **Rate Limit**: 1000 requests per minute per IP
- **AI Endpoints**: Additional user-based rate limiting
- **Emergency Mode**: Reduced limits when budget critical

### CORS Configuration

CORS is configured for the following origins:
- `http://localhost:4200` (development)
- `https://your-production-domain.web.app` (production)
- Configurable via Firebase Functions config

## Security Rules

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Admin users can read/write all data
    match /{document=**} {
      allow read, write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Public read access for certain collections
    match /motorcycles/{motorcycleId} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'technician'];
    }

    match /services/{serviceId} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'technician'];
    }

    // Work orders - technicians and admins can manage
    match /workOrders/{workOrderId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'technician'];
    }
  }
}
```

### Cloud Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() &&
             firestore.exists(/databases/(default)/documents/users/$(request.auth.uid)) &&
             firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isStaff() {
      return isAuthenticated() &&
             firestore.exists(/databases/(default)/documents/users/$(request.auth.uid)) &&
             firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role in ['admin', 'manager', 'employee', 'technician', 'front_desk'];
    }

    // Public image access
    match /products/{allPaths=**} {
      allow read: if true; // Public read for product images
      allow write: if isStaff(); // Only staff can upload
      allow delete: if isAdmin(); // Only admins can delete
    }

    match /motorcycles/{allPaths=**} {
      allow read: if true; // Public read for motorcycle images
      allow write: if isStaff(); // Only staff can upload
      allow delete: if isAdmin(); // Only admins can delete
    }

    // User uploads
    match /user-uploads/{allPaths=**} {
      allow read: if isAuthenticated() && request.auth.uid == resource.metadata['userId'];
      allow write: if isAuthenticated() && request.auth.uid == request.resource.metadata['userId'];
      allow delete: if isAuthenticated() && request.auth.uid == resource.metadata['userId'];
    }

    // Documents (SOAT, Tecnomecanica, etc.)
    match /documents/{allPaths=**} {
      allow read: if isAuthenticated(); // Authenticated users can read documents
      allow write: if isStaff(); // Only staff can upload documents
      allow delete: if isAdmin(); // Only admins can delete
    }

    // Temporary uploads
    match /temp/{allPaths=**} {
      allow read, write: if isAuthenticated();
      allow delete: if isAuthenticated() || request.time < resource.timeCreated + duration.value(1, 'h');
    }

    // Backup files
    match /backups/{allPaths=**} {
      allow read: if isAdmin();
      allow write: if isAdmin();
      allow delete: if isAdmin();
    }

    // Default deny
    match /{allPaths=**} {
      allow read, write, delete: if false;
    }
  }
}
```

## Service Configurations

### CacheService

The CacheService provides multi-level caching with Firestore persistence:

```typescript
interface CacheEntry<T = any> {
  data: T;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  key: string;
  context?: string;
  version?: string;
}

interface CacheStats {
  totalEntries: number;
  memoryCacheSize: number;
  contexts: Record<string, number>;
  hitRate: number;
  avgTTL: number;
}
```

**Configuration:**
- **Memory Cache Size**: 100 entries (LRU eviction)
- **Default TTL**: 5 minutes
- **Cache Collection**: `cache`

**Usage Examples:**

```typescript
// Basic caching
await cacheService.set('user_profile', userData, 10 * 60 * 1000); // 10 minutes
const userData = await cacheService.get('user_profile');

// Context-based caching
await cacheService.set('ai_response', response, ttlMs, 'chatbot');

// Clear by context
await cacheService.clearContext('chatbot');

// Get cache statistics
const stats = await cacheService.getStats();
```

### RateLimiterService

User-based rate limiting with configurable limits:

```typescript
interface RateLimitConfig {
  technical: {
    chatbot: number;
    scanner: number;
    workOrder: number;
    productSearch: number;
  };
  customer: {
    chatbot: number;
    scanner: number;
    workOrder: number;
    productSearch: number;
  };
}
```

**Default Limits (per day):**
- **Technical Users**: 50 chatbot, 100 scanner, 30 work orders, 50 product searches
- **Customer Users**: 5 chatbot, 10 scanner, 5 work orders, 10 product searches

**Emergency Mode Limits:**
- Activated when budget critical
- Technical: 30 chatbot, 50 scanner, 20 work orders, 30 product searches
- Customer: 3 chatbot, 5 scanner, 3 work orders, 5 product searches

**Usage:**

```typescript
// Check if user can proceed
const allowed = await rateLimiter.checkLimit(userId, 'chatbot');

// Get detailed status
const status = await rateLimiter.getLimitStatus(userId, 'chatbot');

// Admin functions
rateLimiter.activateEmergencyMode();
await rateLimiter.resetUserLimits(userId);
```

### CostMonitoringService

Comprehensive Firebase cost tracking and monitoring:

```typescript
interface FirebaseUsage {
  firestore: { reads: number; writes: number; deletes: number };
  storage: { uploads: number; downloads: number; deletes: number; storageGB: number; downloadGB: number };
  functions: { invocations: number; gbSeconds: number; cpuSeconds: number; networkGB: number };
  hosting: { storageGB: number; transferGB: number };
  realtime: { storageGB: number; transferGB: number };
}
```

**Cost Thresholds:**
- **Daily Alert**: $10 (configurable)
- **Monthly Budget**: $300 (configurable)

**Usage:**

```typescript
// Track operations
costMonitoring.trackFirestoreRead(5);
costMonitoring.trackStorageUpload(1024 * 1024); // 1MB file

// Get current costs
const costs = costMonitoring.getCurrentCosts();

// Save usage record
await costMonitoring.saveUsageRecord('daily');
```

## Cloud Functions Setup

### Function Architecture

The application uses Firebase Cloud Functions v2 with the following functions:

- **AI Proxy Functions**: `groqChat`, `groqGenerate`, `groqAnalyze`, `health`
- **Scheduled Functions**: `calculateCapacityHourly`, `optimizeDailySchedule`, `checkDelayedJobs`, `calculateMonthlyMetrics`, `monitorFirebaseCosts`, `generateDailyCostReport`
- **Callable Functions**: CRUD operations for products, users, work orders
- **Triggers**: Firestore triggers for work order updates and time entries

### Function Configuration

```json
// firebase.json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "function": "api"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### Function Deployment

```bash
# Deploy functions to production
./scripts/deploy-functions.sh production bbddmm-387a7

# Deploy functions to staging
./scripts/deploy-functions.sh staging bbddmm-staging
```

## Deployment Guides

### Infrastructure Setup

1. **Initialize Firebase Project:**
   ```bash
   ./scripts/setup-infrastructure.sh bbddmm-production "Blue Dragon Motors Production"
   ```

2. **Setup Environment Variables:**
   ```bash
   ./scripts/setup-env.sh create all
   # Edit .env files with actual values
   ```

3. **Deploy Frontend:**
   ```bash
   ./scripts/deploy-frontend.sh production bbddmm-387a7
   ```

4. **Deploy Functions:**
   ```bash
   ./scripts/deploy-functions.sh production bbddmm-387a7
   ```

### Environment-Specific Deployments

**Production Deployment:**
```bash
# Full production deployment
npm run deploy:prod

# Individual components
./scripts/deploy-frontend.sh production
./scripts/deploy-functions.sh production
```

**Staging Deployment:**
```bash
# Staging deployment for testing
./scripts/deploy-frontend.sh staging bbddmm-staging
./scripts/deploy-functions.sh staging bbddmm-staging
```

### Rollback Procedures

```bash
# Rollback functions
firebase functions:rollback --project bbddmm-production

# Rollback hosting
firebase hosting:rollback --project bbddmm-production
```

## Integration Points

### AI Proxy Endpoints

**Base URL**: `https://us-central1-bbddmm-387a7.cloudfunctions.net`

**Endpoints:**
- `POST /groqChat` - Chat completions
- `POST /groqGenerate` - Text generation
- `POST /groqAnalyze` - Text analysis
- `GET /health` - Health check

**Request Format:**
```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "Hello"}
  ],
  "model": "gemini-1.5-flash",
  "temperature": 1.0,
  "max_tokens": 4096
}
```

### Firebase Services Integration

**Authentication Flow:**
1. User signs in via Firebase Auth
2. ID token passed to functions
3. Functions validate token and authorize requests

**Database Operations:**
- All database operations go through Firestore
- Real-time listeners for live updates
- Offline support via Firestore persistence

**File Storage:**
- Images uploaded to Cloud Storage
- Automatic optimization and CDN delivery
- Secure access via signed URLs

## Monitoring and Maintenance

### Cost Monitoring

**Daily Cost Reports:**
- Automatic daily cost calculation
- Alert thresholds for budget control
- Historical cost tracking

**Usage Metrics:**
- Function invocation counts
- Database operation volumes
- Storage usage statistics

### Performance Monitoring

**Cache Performance:**
- Hit/miss ratios
- Memory usage statistics
- TTL distribution

**Rate Limiting:**
- User usage patterns
- Limit exceedance tracking
- Emergency mode activation

### Maintenance Tasks

**Scheduled Tasks:**
- Daily capacity calculation
- Schedule optimization
- Delayed job notifications
- Monthly metrics calculation

**Cleanup Operations:**
- Expired cache cleanup
- Old log file removal
- Temporary file cleanup

## Troubleshooting

### Common Issues

**Firebase Authentication Errors:**
```
Error: auth/invalid-api-key
Solution: Check VITE_FIREBASE_API_KEY in environment variables
```

**Firestore Permission Denied:**
```
Error: Missing or insufficient permissions
Solution: Check Firestore security rules and user roles
```

**Function Timeout:**
```
Error: Function execution took 540 seconds, finished with status: 'timeout'
Solution: Optimize function logic or increase timeout limit
```

**Rate Limiting:**
```
Error: Rate limit exceeded
Solution: Check user quotas or activate emergency mode
```

**Cache Issues:**
```
Error: Cache miss on critical data
Solution: Check cache TTL settings and warmup procedures
```

### Debug Commands

```bash
# Check Firebase project status
firebase projects:list

# List deployed functions
firebase functions:list

# Check hosting status
firebase hosting:sites:list

# View function logs
firebase functions:log --project bbddmm-production

# Test function locally
firebase functions:shell
```

### Health Checks

**Application Health:**
```bash
curl https://your-app.web.app/health
```

**Function Health:**
```bash
curl https://us-central1-bbddmm-387a7.cloudfunctions.net/health
```

## Best Practices

### Security

1. **API Key Management:**
   - Never expose API keys in client-side code
   - Use Firebase Functions config for server-side keys
   - Rotate keys regularly

2. **Authentication:**
   - Always validate user tokens
   - Implement proper role-based access control
   - Use Firebase security rules

3. **Data Validation:**
   - Validate all input data
   - Sanitize user inputs
   - Implement rate limiting

### Performance

1. **Caching Strategy:**
   - Cache frequently accessed data
   - Use appropriate TTL values
   - Monitor cache hit rates

2. **Database Optimization:**
   - Use Firestore indexes for complex queries
   - Implement pagination for large datasets
   - Monitor read/write operations

3. **Function Optimization:**
   - Minimize cold starts
   - Use appropriate memory allocation
   - Implement efficient algorithms

### Cost Management

1. **Monitor Usage:**
   - Set up cost alerts
   - Track usage patterns
   - Optimize expensive operations

2. **Resource Allocation:**
   - Right-size function memory
   - Use appropriate storage classes
   - Implement data archiving

### Development

1. **Environment Management:**
   - Use separate environments for dev/staging/prod
   - Test thoroughly in staging before production
   - Maintain environment parity

2. **Code Quality:**
   - Implement comprehensive testing
   - Use TypeScript for type safety
   - Follow coding standards

3. **Documentation:**
   - Keep configuration docs updated
   - Document API changes
   - Maintain deployment procedures

### Operations

1. **Monitoring:**
   - Set up comprehensive logging
   - Monitor key metrics
   - Implement alerting

2. **Backup and Recovery:**
   - Regular data backups
   - Test recovery procedures
   - Document incident response

3. **Scalability:**
   - Design for horizontal scaling
   - Implement load balancing
   - Monitor performance metrics

---

This documentation should be updated as the system evolves. For questions or issues, refer to the troubleshooting section or contact the development team.