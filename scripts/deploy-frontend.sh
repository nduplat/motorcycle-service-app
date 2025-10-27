#!/bin/bash

# Blue Dragon Motors - Angular Frontend Deployment Script
# Deploys Angular application to Firebase Hosting with environment management

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

    print_success "Dependencies check completed"
}

# Check environment configuration
check_environment() {
    print_status "Checking environment configuration..."

    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Copying from .env.example..."
        cp .env.example .env
        print_error "Please edit .env file with your actual configuration before deploying!"
        exit 1
    fi

    # Check for required environment variables
    if ! grep -q "VITE_FIREBASE_API_KEY=" .env; then
        print_warning "VITE_FIREBASE_API_KEY is not configured"
    fi

    if ! grep -q "VITE_AI_PROXY_URL=" .env; then
        print_warning "VITE_AI_PROXY_URL is not configured"
    fi

    print_success "Environment check completed"
}

# Setup environment variables for build
setup_environment() {
    local environment=$1

    print_status "Setting up environment variables for $environment..."

    # Copy environment file based on target
    if [ "$environment" = "production" ]; then
        if [ -f ".env.production" ]; then
            cp .env.production .env.build
        else
            cp .env .env.build
            print_warning "Using .env for production build. Consider creating .env.production"
        fi
    elif [ "$environment" = "staging" ]; then
        if [ -f ".env.staging" ]; then
            cp .env.staging .env.build
        else
            cp .env .env.build
            print_warning "Using .env for staging build. Consider creating .env.staging"
        fi
    else
        cp .env .env.build
    fi

    print_success "Environment setup completed"
}

# Build the Angular application
build_application() {
    local environment=$1

    print_status "Building Angular application for $environment..."

    # Install dependencies
    npm ci

    # Build for the specified environment
    if [ "$environment" = "production" ]; then
        npm run build:prod
    else
        npm run build
    fi

    if [ $? -eq 0 ]; then
        print_success "Angular application built successfully for $environment"
    else
        print_error "Failed to build Angular application"
        exit 1
    fi
}

# Deploy to Firebase Hosting
deploy_to_firebase() {
    local environment=$1
    local project_id=$2

    print_status "Deploying to Firebase Hosting ($environment)..."

    # Set Firebase project
    if [ -n "$project_id" ]; then
        firebase use "$project_id"
    fi

    # Deploy only hosting
    firebase deploy --only hosting

    if [ $? -eq 0 ]; then
        print_success "Successfully deployed to Firebase Hosting"

        # Get the hosting URL
        local hosting_url=$(firebase hosting:channel:list | grep -o 'https://[^ ]*\.web\.app' | head -1)
        if [ -n "$hosting_url" ]; then
            print_success "Application deployed at: $hosting_url"
        fi
    else
        print_error "Failed to deploy to Firebase Hosting"
        exit 1
    fi
}

# Validate deployment
validate_deployment() {
    local environment=$1

    print_status "Validating deployment..."

    # Get the hosting URL
    local hosting_url=$(firebase hosting:channel:list | grep -o 'https://[^ ]*\.web\.app' | head -1)

    if [ -z "$hosting_url" ]; then
        print_warning "Could not determine hosting URL for validation"
        return
    fi

    # Test basic connectivity
    if curl -f -s "$hosting_url" > /dev/null 2>&1; then
        print_success "Application is accessible at $hosting_url"
    else
        print_warning "Application may not be fully accessible yet"
    fi

    # Test health endpoint if available
    if curl -f -s "$hosting_url/health" > /dev/null 2>&1; then
        print_success "Health check passed"
    else
        print_warning "Health check endpoint not available or failing"
    fi
}

# Cleanup build artifacts
cleanup() {
    print_status "Cleaning up build artifacts..."

    # Remove temporary environment file
    if [ -f ".env.build" ]; then
        rm .env.build
    fi

    print_success "Cleanup completed"
}

# Show usage information
show_usage() {
    echo "Blue Dragon Motors - Angular Frontend Deployment Script"
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
    echo "  Create .env.staging and .env.production files for environment-specific configs"
}

# Main deployment logic
main() {
    local environment=${1:-"dev"}
    local project_id=$2

    case $environment in
        "staging"|"production"|"dev")
            print_status "Starting deployment to $environment environment..."
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
    check_environment
    setup_environment "$environment"
    build_application "$environment"
    deploy_to_firebase "$environment" "$project_id"
    validate_deployment "$environment"
    cleanup

    print_success "Frontend deployment to $environment completed successfully! 🎉"
}

# Run main function with all arguments
main "$@"