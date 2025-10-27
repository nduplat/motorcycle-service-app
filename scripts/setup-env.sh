#!/bin/bash

# Blue Dragon Motors - Environment Setup Script
# Manages environment variables for different deployment environments

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

# Create environment file template
create_env_template() {
    local env_file=$1
    local env_type=$2

    print_status "Creating $env_file template..."

    cat > "$env_file" << EOF
# Blue Dragon Motors - $env_type Environment Configuration
# Copy this file and update with your actual values

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=bbddmm-387a7.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=bbddmm-387a7
VITE_FIREBASE_STORAGE_BUCKET=bbddmm-387a7.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=647494031256
VITE_FIREBASE_APP_ID=1:647494031256:web:a7fa67efda4b85b1003ded

# AI Proxy Configuration
VITE_AI_PROXY_URL=https://your-ai-proxy-url.onrender.com

# Application Configuration
VITE_APP_NAME="Blue Dragon Motors"
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=$env_type

# Optional: Analytics and Monitoring
VITE_GA_TRACKING_ID=
VITE_SENTRY_DSN=

# Optional: Third-party integrations
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_MAPBOX_ACCESS_TOKEN=
EOF

    print_success "$env_file template created"
}

# Create functions environment template
create_functions_env_template() {
    local env_file=$1
    local env_type=$2

    print_status "Creating functions/$env_file template..."

    mkdir -p functions

    cat > "functions/$env_file" << EOF
# Blue Dragon Motors Functions - $env_type Environment Configuration

# AI Configuration
GROQ_API_KEY=your_groq_api_key_here

# Firebase Admin (automatically configured)
# FIREBASE_CONFIG is set by Firebase CLI

# Application Settings
NODE_ENV=$env_type
LOG_LEVEL=info

# Optional: External APIs
STRIPE_SECRET_KEY=
SENDGRID_API_KEY=

# Optional: Monitoring
SENTRY_DSN=
EOF

    print_success "functions/$env_file template created"
}

# Setup environment for specific target
setup_environment() {
    local environment=$1

    print_status "Setting up $environment environment..."

    case $environment in
        "staging")
            create_env_template ".env.staging" "Staging"
            create_functions_env_template ".env.staging" "staging"
            ;;
        "production")
            create_env_template ".env.production" "Production"
            create_functions_env_template ".env.production" "production"
            ;;
        "development")
            create_env_template ".env" "Development"
            create_functions_env_template ".env" "development"
            ;;
        "all")
            create_env_template ".env" "Development"
            create_env_template ".env.staging" "Staging"
            create_env_template ".env.production" "Production"
            create_functions_env_template ".env" "development"
            create_functions_env_template ".env.staging" "staging"
            create_functions_env_template ".env.production" "production"
            ;;
        *)
            print_error "Invalid environment: $environment"
            show_usage
            exit 1
            ;;
    esac

    print_success "$environment environment setup completed"
}

# Validate environment configuration
validate_environment() {
    local env_file=$1

    print_status "Validating $env_file..."

    if [ ! -f "$env_file" ]; then
        print_warning "$env_file does not exist"
        return 1
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
        print_warning "Missing or placeholder values in $env_file:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        return 1
    else
        print_success "$env_file validation passed"
        return 0
    fi
}

# Show current environment status
show_status() {
    print_status "Environment configuration status:"

    echo ""
    echo "Frontend environments:"
    for env in ".env" ".env.staging" ".env.production"; do
        if [ -f "$env" ]; then
            if validate_environment "$env" > /dev/null 2>&1; then
                echo -e "  ${GREEN}✓${NC} $env (configured)"
            else
                echo -e "  ${YELLOW}⚠${NC} $env (needs configuration)"
            fi
        else
            echo -e "  ${RED}✗${NC} $env (missing)"
        fi
    done

    echo ""
    echo "Functions environments:"
    for env in ".env" ".env.staging" ".env.production"; do
        if [ -f "functions/$env" ]; then
            echo -e "  ${GREEN}✓${NC} functions/$env (exists)"
        else
            echo -e "  ${RED}✗${NC} functions/$env (missing)"
        fi
    done
}

# Show usage information
show_usage() {
    echo "Blue Dragon Motors - Environment Setup Script"
    echo ""
    echo "Usage: $0 [COMMAND] [ENVIRONMENT]"
    echo ""
    echo "Commands:"
    echo "  create [env]    Create environment configuration files"
    echo "  validate [env]  Validate environment configuration"
    echo "  status          Show current environment status"
    echo "  help            Show this help message"
    echo ""
    echo "Environments:"
    echo "  development     Development environment (.env)"
    echo "  staging         Staging environment (.env.staging)"
    echo "  production      Production environment (.env.production)"
    echo "  all             All environments"
    echo ""
    echo "Examples:"
    echo "  $0 create staging           # Create staging environment files"
    echo "  $0 create all               # Create all environment files"
    echo "  $0 validate production      # Validate production config"
    echo "  $0 status                   # Show environment status"
}

# Main script logic
main() {
    local command=${1:-"help"}
    local environment=${2:-"development"}

    case $command in
        "create")
            setup_environment "$environment"
            ;;
        "validate")
            if validate_environment ".env${environment/#development/}${environment/#development/.}"; then
                print_success "Environment validation passed"
            else
                print_error "Environment validation failed"
                exit 1
            fi
            ;;
        "status")
            show_status
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_error "Invalid command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"