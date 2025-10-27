#!/bin/bash

# Blue Dragon Motors - Infrastructure Setup Script
# Sets up Firebase project infrastructure and configuration

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

    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 20+"
        exit 1
    fi

    print_success "Dependencies check completed"
}

# Authenticate with Firebase
authenticate_firebase() {
    print_status "Checking Firebase authentication..."

    if ! firebase projects:list > /dev/null 2>&1; then
        print_warning "Not authenticated with Firebase. Starting authentication..."
        firebase login

        if [ $? -ne 0 ]; then
            print_error "Firebase authentication failed"
            exit 1
        fi
    fi

    print_success "Firebase authentication confirmed"
}

# Create Firebase project
create_firebase_project() {
    local project_id=$1
    local display_name=$2

    print_status "Creating Firebase project: $project_id..."

    if firebase projects:create "$project_id" --display-name "$display_name" 2>/dev/null; then
        print_success "Firebase project created successfully"
    else
        print_warning "Project may already exist or creation failed. Continuing..."
    fi
}

# Setup Firebase services
setup_firebase_services() {
    local project_id=$1

    print_status "Setting up Firebase services for project: $project_id..."

    # Use the project
    firebase use "$project_id"

    # Enable required APIs
    print_status "Enabling required Google Cloud APIs..."

    # Note: This would require gcloud CLI for full automation
    # For now, we'll document the required APIs
    print_warning "Please ensure the following APIs are enabled in Google Cloud Console:"
    echo "  - Firebase Hosting API"
    echo "  - Cloud Functions API"
    echo "  - Firestore API"
    echo "  - Firebase Authentication API"
    echo "  - Cloud Storage API"

    # Initialize Firebase services
    if [ ! -f "firebase.json" ]; then
        print_status "Initializing Firebase services..."

        # Initialize hosting and functions
        firebase init hosting functions --project "$project_id" << EOF
n
n
functions
n
n
EOF

        print_success "Firebase services initialized"
    else
        print_warning "Firebase already initialized. Skipping..."
    fi
}

# Configure Firestore security rules
setup_firestore_rules() {
    print_status "Setting up Firestore security rules..."

    if [ -f "firestore.rules" ]; then
        print_warning "firestore.rules already exists. Skipping..."
    else
        cat > firestore.rules << 'EOF'
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
EOF
        print_success "Firestore security rules created"
    fi
}

# Configure Storage security rules
setup_storage_rules() {
    print_status "Setting up Cloud Storage security rules..."

    if [ -f "storage.rules" ]; then
        print_warning "storage.rules already exists. Skipping..."
    else
        cat > storage.rules << 'EOF'
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can read/write their own files
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Admin users can read/write all files
    match /{allPaths=**} {
      allow read, write: if request.auth != null &&
        firestore.exists(/databases/(default)/documents/users/$(request.auth.uid)) &&
        firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Public read access for certain files (like motorcycle images)
    match /public/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null &&
        firestore.exists(/databases/(default)/documents/users/$(request.auth.uid)) &&
        firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role in ['admin', 'technician'];
    }
  }
}
EOF
        print_success "Cloud Storage security rules created"
    fi
}

# Deploy security rules
deploy_security_rules() {
    local project_id=$1

    print_status "Deploying security rules..."

    firebase use "$project_id"
    firebase deploy --only firestore:rules,storage

    if [ $? -eq 0 ]; then
        print_success "Security rules deployed successfully"
    else
        print_error "Failed to deploy security rules"
        exit 1
    fi
}

# Setup environment configuration
setup_environments() {
    print_status "Setting up environment configurations..."

    # Run the environment setup script
    if [ -f "scripts/setup-env.sh" ]; then
        ./scripts/setup-env.sh create all
    else
        print_warning "Environment setup script not found. Run manually."
    fi
}

# Show usage information
show_usage() {
    echo "Blue Dragon Motors - Infrastructure Setup Script"
    echo ""
    echo "Usage: $0 [PROJECT_ID] [DISPLAY_NAME]"
    echo ""
    echo "Parameters:"
    echo "  PROJECT_ID    Firebase project ID (required)"
    echo "  DISPLAY_NAME  Display name for the project (optional)"
    echo ""
    echo "Examples:"
    echo "  $0 bbddmm-production \"Blue Dragon Motors Production\""
    echo "  $0 bbddmm-staging \"Blue Dragon Motors Staging\""
    echo ""
    echo "This script will:"
    echo "  - Create Firebase project (if it doesn't exist)"
    echo "  - Initialize Firebase services"
    echo "  - Setup Firestore and Storage security rules"
    echo "  - Create environment configuration files"
}

# Main setup logic
main() {
    local project_id=$1
    local display_name=${2:-"Blue Dragon Motors"}

    if [ -z "$project_id" ]; then
        print_error "Project ID is required"
        show_usage
        exit 1
    fi

    print_status "Starting infrastructure setup for project: $project_id..."

    # Run setup steps
    check_dependencies
    authenticate_firebase
    create_firebase_project "$project_id" "$display_name"
    setup_firebase_services "$project_id"
    setup_firestore_rules
    setup_storage_rules
    deploy_security_rules "$project_id"
    setup_environments

    print_success "Infrastructure setup completed successfully! 🎉"
    print_status "Next steps:"
    echo "  1. Update environment files with your actual configuration values"
    echo "  2. Run './scripts/deploy-frontend.sh production $project_id' to deploy frontend"
    echo "  3. Run './scripts/deploy-functions.sh production $project_id' to deploy functions"
}

# Run main function with all arguments
main "$@"