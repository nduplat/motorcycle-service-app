#!/bin/bash

# Blue Dragon Motors - Rollback Script
# Provides rollback capabilities for deployments

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

    if ! command -v firebase &> /dev/null; then
        print_error "Firebase CLI is not installed. Install with: npm install -g firebase-tools"
        exit 1
    fi

    print_success "Dependencies check completed"
}

# Rollback frontend deployment
rollback_frontend() {
    local project_id=$1

    print_status "Rolling back frontend deployment..."

    if [ -n "$project_id" ]; then
        firebase use "$project_id"
    fi

    # Firebase Hosting rollback
    if firebase hosting:rollback; then
        print_success "Frontend rollback completed"

        # Get the new hosting URL after rollback
        local hosting_url=$(firebase hosting:channel:list | grep -o 'https://[^ ]*\.web\.app' | head -1)
        if [ -n "$hosting_url" ]; then
            print_success "Application rolled back to: $hosting_url"
        fi
    else
        print_error "Frontend rollback failed"
        return 1
    fi
}

# Rollback functions deployment
rollback_functions() {
    local project_id=$1
    local version=${2:-"previous"}

    print_status "Rolling back functions deployment..."

    if [ -n "$project_id" ]; then
        firebase use "$project_id"
    fi

    # For functions, we need to redeploy a previous version
    # This requires having a backup of the previous deployment

    if [ -f "functions-backup.zip" ]; then
        print_status "Found functions backup. Redeploying..."

        # Unzip the backup
        unzip -q functions-backup.zip -d functions-temp

        # Navigate to functions directory
        cd functions-temp/functions

        # Install dependencies and deploy
        npm ci
        npm run build

        # Deploy the previous version
        if firebase deploy --only functions; then
            print_success "Functions rollback completed"
            cd ../..
            rm -rf functions-temp
        else
            print_error "Functions rollback failed"
            cd ../..
            rm -rf functions-temp
            return 1
        fi
    else
        print_warning "No functions backup found. Manual rollback required."
        print_status "To create a backup before deployment, run:"
        echo "  cd functions && zip -r ../../functions-backup.zip ."
        return 1
    fi
}

# Create backup before deployment
create_backup() {
    local component=$1

    print_status "Creating backup for $component..."

    case $component in
        "functions")
            if [ -d "functions" ]; then
                zip -q -r "functions-backup-$(date +%Y%m%d-%H%M%S).zip" functions
                print_success "Functions backup created"
            else
                print_error "Functions directory not found"
                return 1
            fi
            ;;
        "frontend")
            print_warning "Frontend backup not needed (Firebase Hosting handles versions)"
            ;;
        *)
            print_error "Invalid component: $component"
            return 1
            ;;
    esac
}

# List available backups
list_backups() {
    print_status "Available backups:"

    local backups=$(ls -la *-backup-*.zip 2>/dev/null | wc -l)

    if [ "$backups" -gt 0 ]; then
        ls -la *-backup-*.zip | while read -r line; do
            echo "  $line"
        done
    else
        print_warning "No backups found"
    fi
}

# Show deployment history
show_deployment_history() {
    local project_id=$1

    print_status "Deployment history:"

    if [ -n "$project_id" ]; then
        firebase use "$project_id"
    fi

    # Show hosting versions
    echo "Frontend (Hosting) versions:"
    firebase hosting:versions:list | head -10

    # Show functions versions (limited info available)
    echo ""
    echo "Functions status:"
    firebase functions:list
}

# Show usage information
show_usage() {
    echo "Blue Dragon Motors - Rollback Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  frontend [project_id]    Rollback frontend deployment"
    echo "  functions [project_id]   Rollback functions deployment"
    echo "  all [project_id]         Rollback both frontend and functions"
    echo "  backup [component]       Create backup before deployment"
    echo "  list                     List available backups"
    echo "  history [project_id]     Show deployment history"
    echo "  help                     Show this help message"
    echo ""
    echo "Components for backup:"
    echo "  functions                Backup functions directory"
    echo "  frontend                 Not needed (handled by Firebase)"
    echo ""
    echo "Examples:"
    echo "  $0 frontend bbddmm-production    # Rollback frontend"
    echo "  $0 functions bbddmm-production  # Rollback functions"
    echo "  $0 all bbddmm-production         # Rollback everything"
    echo "  $0 backup functions              # Create functions backup"
    echo "  $0 list                          # List backups"
    echo "  $0 history bbddmm-production     # Show deployment history"
    echo ""
    echo "Note: Always create backups before deployment!"
}

# Main rollback logic
main() {
    local command=$1
    local project_id=$2

    if [ -z "$command" ]; then
        print_error "Command is required"
        show_usage
        exit 1
    fi

    check_dependencies

    case $command in
        "frontend")
            rollback_frontend "$project_id"
            ;;
        "functions")
            rollback_functions "$project_id"
            ;;
        "all")
            print_status "Rolling back all components..."
            rollback_frontend "$project_id" && rollback_functions "$project_id"
            ;;
        "backup")
            local component=$2
            create_backup "$component"
            ;;
        "list")
            list_backups
            ;;
        "history")
            show_deployment_history "$project_id"
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