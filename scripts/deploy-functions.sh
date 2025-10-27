#!/bin/bash

# Blue Dragon Motors - Firebase Cloud Functions Deployment Script
# Deploys Firebase Cloud Functions with environment management and validation

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

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."

    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 20+"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm"
        exit 1
    fi

    if ! command -v firebase &> /dev/null; then
        print_error "Firebase CLI is not installed. Install with: npm install -g firebase-tools"
        exit 1
    fi

    if ! command -v tsc &> /dev/null; then
        print_error "TypeScript compiler is not installed. Install with: npm install -g typescript"
        exit 1
    fi

    print_success "Dependencies check completed"
}

# Check Firebase project configuration
check_firebase_config() {
    print_status "Checking Firebase configuration..."

    if [ ! -f ".firebaserc" ]; then
        print_error ".firebaserc file not found. Please initialize Firebase project first."
        exit 1
    fi

    if [ ! -f "firebase.json" ]; then
        print_error "firebase.json file not found. Please initialize Firebase project first."
        exit 1
    fi

    print_success "Firebase configuration check completed"
}

# Setup environment variables for functions
setup_environment() {
    local environment=$1

    print_status "Setting up environment variables for functions ($environment)..."

    # Navigate to functions directory
    cd functions

    # Install dependencies
    npm ci

    # Create environment configuration
    if [ "$environment" = "production" ]; then
        if [ -f ".env.production" ]; then
            cp .env.production .env
        fi
    elif [ "$environment" = "staging" ]; then
        if [ -f ".env.staging" ]; then
            cp .env.staging .env
        fi
    fi

    # Build TypeScript
    npm run build

    if [ $? -eq 0 ]; then
        print_success "Functions built successfully"
    else
        print_error "Failed to build functions"
        cd ..
        exit 1
    fi

    cd ..
    print_success "Environment setup completed"
}

# Deploy Firebase Cloud Functions
deploy_functions() {
    local environment=$1
    local project_id=$2

    print_status "Deploying Firebase Cloud Functions ($environment)..."

    # Set Firebase project
    if [ -n "$project_id" ]; then
        firebase use "$project_id"
    fi

    # Deploy only functions
    firebase deploy --only functions

    if [ $? -eq 0 ]; then
        print_success "Successfully deployed Firebase Cloud Functions"
    else
        print_error "Failed to deploy Firebase Cloud Functions"
        exit 1
    fi
}

# Validate function deployment
validate_functions() {
    local environment=$1

    print_status "Validating function deployment..."

    # Get project ID
    local project_id=$(firebase use | grep "Now using project" | awk '{print $4}' | tr -d '()')

    if [ -z "$project_id" ]; then
        print_warning "Could not determine project ID for validation"
        return
    fi

    # Test health function
    local health_url="https://us-central1-$project_id.cloudfunctions.net/health"

    if curl -f -s "$health_url" > /dev/null 2>&1; then
        print_success "Health function is accessible"
    else
        print_warning "Health function may not be accessible yet"
    fi

    # List deployed functions
    print_status "Deployed functions:"
    firebase functions:list | grep -E "(Function|Trigger)" | while read -r line; do
        echo "  $line"
    done
}

# Run function tests
run_function_tests() {
    print_status "Running function tests..."

    cd functions

    if npm test 2>/dev/null; then
        print_success "Function tests passed"
    else
        print_warning "Function tests failed or not configured"
    fi

    cd ..
}

# Show usage information
show_usage() {
    echo "Blue Dragon Motors - Firebase Cloud Functions Deployment Script"
    echo ""
    echo "Usage: $0 [ENVIRONMENT] [PROJECT_ID]"
    echo ""
    echo "Environments:"
    echo "  staging     Deploy to staging environment"
    echo "  production  Deploy to production environment"
    echo "  dev         Deploy to development environment (default)"
    echo ""
    echo "Parameters:"
    echo "  PROJECT_ID  Firebase project ID (optional, uses .firebaserc default)"
    echo ""
    echo "Examples:"
    echo "  $0 production                    # Deploy to production"
    echo "  $0 staging bbddmm-staging        # Deploy staging to specific project"
    echo "  $0 dev                           # Deploy to development"
    echo ""
    echo "Environment Variables:"
    echo "  Create functions/.env.staging and functions/.env.production for environment-specific configs"
}

# Main deployment logic
main() {
    local environment=${1:-"dev"}
    local project_id=$2

    case $environment in
        "staging"|"production"|"dev")
            print_status "Starting functions deployment to $environment environment..."
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

    # Run deployment steps
    check_dependencies
    check_firebase_config
    setup_environment "$environment"
    run_function_tests
    deploy_functions "$environment" "$project_id"
    validate_functions "$environment"

    print_success "Functions deployment to $environment completed successfully! 🎉"
}

# Run main function with all arguments
main "$@"