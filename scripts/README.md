# Blue Dragon Motors - Deployment Scripts

This directory contains comprehensive deployment scripts for the Sprint 1 implementation of Blue Dragon Motors workshop management system.

## Overview

The deployment system supports:
- Angular frontend deployment to Firebase Hosting
- Firebase Cloud Functions deployment
- Environment variable management for staging/production
- Infrastructure setup and configuration
- Deployment validation and health checks
- Rollback capabilities

## Scripts

### Core Deployment Scripts

#### `deploy-complete.sh`
**Purpose:** Complete deployment orchestration script
**Usage:**
```bash
./scripts/deploy-complete.sh [environment] [project_id]
```

**Environments:**
- `staging` - Deploy to staging environment
- `production` - Deploy to production environment

**Examples:**
```bash
# Deploy to staging
./scripts/deploy-complete.sh staging bbddmm-staging

# Deploy to production
./scripts/deploy-complete.sh production bbddmm-production
```

**What it does:**
- Validates environment configuration
- Runs pre-deployment tests
- Deploys frontend to Firebase Hosting
- Deploys functions to Cloud Functions
- Runs post-deployment validation
- Generates deployment report
- Provides rollback on failure

#### `deploy-frontend.sh`
**Purpose:** Deploy Angular frontend to Firebase Hosting
**Usage:**
```bash
./scripts/deploy-frontend.sh [environment] [project_id]
```

#### `deploy-functions.sh`
**Purpose:** Deploy Firebase Cloud Functions
**Usage:**
```bash
./scripts/deploy-functions.sh [environment] [project_id]
```

### Infrastructure and Environment Management

#### `setup-infrastructure.sh`
**Purpose:** Setup Firebase project infrastructure
**Usage:**
```bash
./scripts/setup-infrastructure.sh [project_id] [display_name]
```

**What it does:**
- Creates Firebase project (if needed)
- Initializes Firebase services
- Sets up Firestore and Storage security rules
- Creates environment configuration files

#### `setup-env.sh`
**Purpose:** Manage environment variables
**Usage:**
```bash
./scripts/setup-env.sh [command] [environment]
```

**Commands:**
- `create [env]` - Create environment files
- `validate [env]` - Validate environment configuration
- `status` - Show environment status

**Examples:**
```bash
# Create all environment files
./scripts/setup-env.sh create all

# Validate production config
./scripts/setup-env.sh validate production

# Show environment status
./scripts/setup-env.sh status
```

### Rollback and Recovery

#### `rollback.sh`
**Purpose:** Rollback deployments
**Usage:**
```bash
./scripts/rollback.sh [command] [options]
```

**Commands:**
- `frontend [project_id]` - Rollback frontend
- `functions [project_id]` - Rollback functions
- `all [project_id]` - Rollback everything
- `backup [component]` - Create backup
- `list` - List backups
- `history [project_id]` - Show deployment history

**Examples:**
```bash
# Rollback frontend
./scripts/rollback.sh frontend bbddmm-production

# Create functions backup
./scripts/rollback.sh backup functions

# Show deployment history
./scripts/rollback.sh history bbddmm-production
```

### Legacy Scripts

#### `deploy.sh` (Legacy)
**Purpose:** Original deployment script (maintained for compatibility)
**Note:** Use `deploy-complete.sh` for new deployments

## Environment Configuration

### Required Environment Variables

Create the following files with your actual values:

#### `.env` (Development)
```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=bbddmm-387a7.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=bbddmm-387a7
VITE_FIREBASE_STORAGE_BUCKET=bbddmm-387a7.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=647494031256
VITE_FIREBASE_APP_ID=1:647494031256:web:a7fa67efda4b85b1003ded
VITE_AI_PROXY_URL=https://your-ai-proxy-url.onrender.com
```

#### `.env.staging` (Staging)
```bash
VITE_FIREBASE_API_KEY=your_staging_api_key
# ... other staging-specific values
```

#### `.env.production` (Production)
```bash
VITE_FIREBASE_API_KEY=your_production_api_key
# ... other production-specific values
```

#### `functions/.env` (Functions)
```bash
GROQ_API_KEY=your_groq_api_key
NODE_ENV=production
```

## Deployment Workflow

### Initial Setup
```bash
# 1. Setup infrastructure
./scripts/setup-infrastructure.sh bbddmm-production "Blue Dragon Motors Production"

# 2. Configure environments
./scripts/setup-env.sh create all

# 3. Edit environment files with actual values
# Edit .env.production, functions/.env, etc.
```

### Staging Deployment
```bash
# Create backup (recommended)
./scripts/rollback.sh backup functions

# Deploy to staging
./scripts/deploy-complete.sh staging bbddmm-staging
```

### Production Deployment
```bash
# Create backup (recommended)
./scripts/rollback.sh backup functions

# Deploy to production
./scripts/deploy-complete.sh production bbddmm-production
```

### Rollback (if needed)
```bash
# Rollback frontend
./scripts/rollback.sh frontend bbddmm-production

# Rollback functions
./scripts/rollback.sh functions bbddmm-production

# Rollback everything
./scripts/rollback.sh all bbddmm-production
```

## Prerequisites

- Node.js 20+
- npm
- Firebase CLI (`npm install -g firebase-tools`)
- Authenticated with Firebase (`firebase login`)

## Security Notes

- Never commit environment files with real values
- Use Firebase service account keys for CI/CD
- Enable required APIs in Google Cloud Console
- Regularly rotate API keys and secrets

## Monitoring and Validation

After deployment:
- Check Firebase Console for function logs
- Monitor application performance
- Validate health endpoints
- Test critical user flows

## Troubleshooting

### Common Issues

1. **Authentication failed**
   ```bash
   firebase login
   ```

2. **Environment not configured**
   ```bash
   ./scripts/setup-env.sh create all
   ```

3. **Project not found**
   ```bash
   ./scripts/setup-infrastructure.sh [project_id] [name]
   ```

4. **Deployment failed**
   - Check deployment logs
   - Validate environment variables
   - Use rollback if needed

## Support

For issues with deployment scripts, check:
1. Firebase Console logs
2. Deployment report files
3. Script output for error messages
4. Environment configuration validation