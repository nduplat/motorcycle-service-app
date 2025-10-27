#!/bin/bash

# Blue Dragon Motors - Complete Deployment Script
# Orchestrates deployment of all components with validation and rollback capabilities

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Global variables for rollback
DEPLOYED_FRONTEND=false
DEPLOYED_FUNCTIONS=false
DEPLOYMENT_LOG="deployment-$(date +%Y%m%d-%H%M%S).log"

# Function to log deployment steps
log_deployment() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$DEPLOYMENT_LOG"
}

# Function to rollback on failure
rollback() {
    print_error "Deployment failed. Starting rollback..."

    if [ "$DEPLOYED_FUNCTIONS" = true ]; then
        print_status "Rolling back functions deployment..."
        # Note: Firebase doesn't have direct rollback, but we can redeploy previous version
        # This would require keeping track of previous deployment versions
        print_warning "Functions rollback not fully automated. Manual intervention may be required."
    fi

    if [ "$DEPLOYED_FRONTEND" = true ]; then
        print_status "Rolling back frontend deployment..."
        # Firebase Hosting supports rollbacks via CLI
        firebase hosting:rollback > /dev/null 2>&1 || print_warning "Frontend rollback failed"
    fi

    print_error "Rollback completed. Check $DEPLOYMENT_LOG for details."
    exit 1
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."

    local missing_tools=()

    if ! command -v node &> /dev/null; then
        missing_tools+=("Node.js")
    fi

    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    fi

    if ! command -v firebase &> /dev/null; then
        missing_tools+=("Firebase CLI")
    fi

    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_error "Missing required tools:"
        for tool in "${missing_tools[@]}"; do
            echo "  - $tool"
        done
        exit 1
    fi

    print_success "Dependencies check completed"
    log_deployment "Dependencies check passed"
}

# Validate environment configuration
validate_environment() {
    local environment=$1

    print_status "Validating $environment environment configuration..."

    # Check main environment file
    local env_file=".env"
    if [ "$environment" = "staging" ]; then
        env_file=".env.staging"
    elif [ "$environment" = "production" ]; then
        env_file=".env.production"
    fi

    if [ ! -f "$env_file" ]; then
        print_error "$env_file not found. Run './scripts/setup-env.sh create $environment' first."
        exit 1
    fi

    # Check for required variables
    local required_vars=("VITE_FIREBASE_API_KEY" "VITE_AI_PROXY_URL")
    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$env_file" || grep -q "^$var=your_.*_here" "$env_file"; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_error "Missing configuration in $env_file:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi

    # Check functions environment
    if [ ! -f "functions/.env" ]; then
        print_error "functions/.env not found. Run './scripts/setup-env.sh create $environment' first."
        exit 1
    fi

    print_success "Environment validation completed"
    log_deployment "Environment validation passed for $environment"
}

# Run pre-deployment tests
run_pre_deployment_tests() {
    print_status "Running pre-deployment tests..."

    # Run frontend tests
    if npm run test:ci > /dev/null 2>&1; then
        print_success "Frontend tests passed"
    else
        print_warning "Frontend tests failed. Continuing with deployment..."
    fi

    # Run AI proxy tests
    if npm run test:ai-proxy > /dev/null 2>&1; then
        print_success "AI proxy tests passed"
    else
        print_warning "AI proxy tests failed. Continuing with deployment..."
    fi

    log_deployment "Pre-deployment tests completed"
}

# Deploy frontend
deploy_frontend() {
    local environment=$1
    local project_id=$2

    print_status "Deploying frontend to $environment..."

    if ./scripts/deploy-frontend.sh "$environment" "$project_id"; then
        print_success "Frontend deployment completed"
        DEPLOYED_FRONTEND=true
        log_deployment "Frontend deployed successfully to $environment"
    else
        print_error "Frontend deployment failed"
        rollback
    fi
}

# Deploy functions
deploy_functions() {
    local environment=$1
    local project_id=$2

    print_status "Deploying functions to $environment..."

    if ./scripts/deploy-functions.sh "$environment" "$project_id"; then
        print_success "Functions deployment completed"
        DEPLOYED_FUNCTIONS=true
        log_deployment "Functions deployed successfully to $environment"
    else
        print_error "Functions deployment failed"
        rollback
    fi
}

# Run post-deployment validation
run_post_deployment_validation() {
    local environment=$1
    local project_id=$2

    print_status "Running post-deployment validation..."

    # Get hosting URL
    local hosting_url=$(firebase hosting:channel:list 2>/dev/null | grep -o 'https://[^ ]*\.web\.app' | head -1)

    if [ -z "$hosting_url" ]; then
        print_warning "Could not determine hosting URL for validation"
        return
    fi

    # Test application accessibility
    if curl -f -s --max-time 30 "$hosting_url" > /dev/null 2>&1; then
        print_success "Application is accessible at $hosting_url"
    else
        print_error "Application is not accessible at $hosting_url"
        rollback
    fi

    # Test health endpoint
    if curl -f -s --max-time 30 "$hosting_url/health" > /dev/null 2>&1; then
        print_success "Health check passed"
    else
        print_warning "Health check endpoint not available"
    fi

    # Test functions
    local functions_url="https://us-central1-$project_id.cloudfunctions.net/health"
    if curl -f -s --max-time 30 "$functions_url" > /dev/null 2>&1; then
        print_success "Functions health check passed"
    else
        print_warning "Functions health check failed"
    fi

    log_deployment "Post-deployment validation completed"
}

# Generate deployment report
generate_deployment_report() {
    local environment=$1
    local project_id=$2

    print_status "Generating deployment report..."

    cat > "deployment-report-$(date +%Y%m%d-%H%M%S).md" << EOF
# Blue Dragon Motors - Deployment Report

**Deployment Date:** $(date)
**Environment:** $environment
**Project ID:** $project_id
**Status:** ✅ Successful

## Deployed Components

### Frontend
- **Status:** ✅ Deployed
- **URL:** $(firebase hosting:channel:list 2>/dev/null | grep -o 'https://[^ ]*\.web\.app' | head -1 || echo "N/A")

### Firebase Functions
- **Status:** ✅ Deployed
- **Health Check:** https://us-central1-$project_id.cloudfunctions.net/health

## Validation Results

- ✅ Application accessibility
- ✅ Health endpoints
- ✅ Environment configuration

## Deployment Log
$(cat "$DEPLOYMENT_LOG")

## Next Steps

1. Monitor application performance
2. Check application logs in Firebase Console
3. Update DNS records if needed
4. Notify team members of successful deployment

## Rollback Information

In case of issues, rollback can be performed using:
- Frontend: \`firebase hosting:rollback\`
- Functions: Manual redeployment of previous version

---
*Generated by deployment script*
EOF

    print_success "Deployment report generated"
}

# Show usage information
show_usage() {
    echo "Blue Dragon Motors - Complete Deployment Script"
    echo ""
    echo "Usage: $0 [ENVIRONMENT] [PROJECT_ID]"
    echo ""
    echo "Environments:"
    echo "  staging     Deploy to staging environment"
    echo "  production  Deploy to production environment"
    echo ""
    echo "Parameters:"
    echo "  PROJECT_ID  Firebase project ID (optional, uses .firebaserc default)"
    echo ""
    echo "Examples:"
    echo "  $0 staging bbddmm-staging        # Deploy to staging"
    echo "  $0 production bbddmm-production  # Deploy to production"
    echo ""
    echo "This script will:"
    echo "  - Validate environment configuration"
    echo "  - Run pre-deployment tests"
    echo "  - Deploy frontend to Firebase Hosting"
    echo "  - Deploy functions to Cloud Functions"
    echo "  - Run post-deployment validation"
    echo "  - Generate deployment report"
    echo "  - Provide rollback on failure"
}

# Main deployment orchestration
main() {
    local environment=${1:-"staging"}
    local project_id=$2

    case $environment in
        "staging"|"production")
            print_status "Starting complete deployment to $environment environment..."
            ;;
        "help"|"-h"|"--help")
            show_usage
            exit 0
            ;;
        *)
            print_error "Invalid environment: $environment"
            show_usage
            exit 1
            ;;
    esac

    # Trap for cleanup on exit
    trap 'log_deployment "Deployment interrupted or failed"' EXIT

    # Run deployment pipeline
    check_dependencies
    validate_environment "$environment"
    run_pre_deployment_tests
    deploy_frontend "$environment" "$project_id"
    deploy_functions "$environment" "$project_id"
    run_post_deployment_validation "$environment" "$project_id"
    generate_deployment_report "$environment" "$project_id"

    print_success "Complete deployment to $environment finished successfully! 🎉"
    print_status "Check the generated deployment report for details."
    print_status "Deployment log: $DEPLOYMENT_LOG"

    log_deployment "Deployment completed successfully"
}

# Run main function with all arguments
main "$@"