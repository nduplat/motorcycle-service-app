#!/bin/bash

# Blue Dragon Motors Deployment Script
# This script builds and deploys the application with AI proxy server

set -e  # Exit on any error

echo "🚀 Starting Blue Dragon Motors deployment..."

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

    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed. Docker deployment will not be available."
        DOCKER_AVAILABLE=false
    else
        DOCKER_AVAILABLE=true
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
    if ! grep -q "GROQ_API_KEY=your_groq_api_key_here" .env; then
        print_warning "GROQ_API_KEY appears to be configured"
    else
        print_warning "GROQ_API_KEY is not configured. AI features will be limited."
    fi

    print_success "Environment check completed"
}

# Build the application
build_application() {
    print_status "Building Angular application..."

    # Install dependencies
    npm ci

    # Build for production
    npm run build

    if [ $? -eq 0 ]; then
        print_success "Angular application built successfully"
    else
        print_error "Failed to build Angular application"
        exit 1
    fi
}

# Build AI proxy server
build_ai_proxy() {
    print_status "Building AI proxy server..."

    cd server
    npm ci --only=production

    if [ $? -eq 0 ]; then
        print_success "AI proxy server dependencies installed"
        cd ..
    else
        print_error "Failed to install AI proxy dependencies"
        exit 1
    fi
}

# Build Docker image
build_docker() {
    if [ "$DOCKER_AVAILABLE" = false ]; then
        print_warning "Skipping Docker build - Docker not available"
        return
    fi

    print_status "Building Docker image..."

    # Build Docker image
    docker build -t blue-dragon-motors:latest .

    if [ $? -eq 0 ]; then
        print_success "Docker image built successfully"
    else
        print_error "Failed to build Docker image"
        exit 1
    fi
}

# Deploy locally (for development/testing)
deploy_local() {
    print_status "Starting local deployment..."

    # Start AI proxy server in background
    print_status "Starting AI proxy server..."
    npm run ai-proxy:dev &
    AI_PROXY_PID=$!

    # Wait a moment for the server to start
    sleep 3

    # Test the deployment
    print_status "Testing deployment..."

    # Test health endpoint
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        print_success "AI proxy server is running"
    else
        print_error "AI proxy server failed to start"
        kill $AI_PROXY_PID 2>/dev/null || true
        exit 1
    fi

    # Start frontend development server
    print_status "Starting frontend development server..."
    npm run dev &
    FRONTEND_PID=$!

    print_success "Local deployment completed!"
    print_status "Frontend: http://localhost:4200"
    print_status "AI Proxy: http://localhost:3001"
    print_status "Health Check: http://localhost:3001/health"

    # Wait for user input to stop
    echo ""
    print_status "Press Ctrl+C to stop all services"

    # Wait for processes
    wait $FRONTEND_PID $AI_PROXY_PID
}

# Deploy with Docker
deploy_docker() {
    if [ "$DOCKER_AVAILABLE" = false ]; then
        print_error "Docker is not available. Cannot deploy with Docker."
        exit 1
    fi

    print_status "Starting Docker deployment..."

    # Stop any existing containers
    docker stop blue-dragon-motors 2>/dev/null || true
    docker rm blue-dragon-motors 2>/dev/null || true

    # Run the container
    docker run -d \
        --name blue-dragon-motors \
        -p 80:80 \
        -p 3001:3001 \
        --env-file .env \
        blue-dragon-motors:latest

    if [ $? -eq 0 ]; then
        print_success "Docker container started successfully"

        # Wait for services to start
        sleep 5

        # Test the deployment
        if curl -f http://localhost/health > /dev/null 2>&1; then
            print_success "Application is running!"
            print_status "Frontend: http://localhost"
            print_status "AI Proxy: http://localhost:3001"
            print_status "Health Check: http://localhost/health"
        else
            print_error "Application health check failed"
            docker logs blue-dragon-motors
            exit 1
        fi
    else
        print_error "Failed to start Docker container"
        exit 1
    fi
}

# Show usage information
show_usage() {
    echo "Blue Dragon Motors Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  build     Build the application and AI proxy server"
    echo "  docker    Build Docker image"
    echo "  local     Deploy locally for development/testing"
    echo "  prod      Deploy with Docker for production (legacy)"
    echo "  complete  Run complete deployment pipeline (recommended)"
    echo "  stop      Stop running services"
    echo "  test      Run deployment tests"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 build        # Build everything"
    echo "  $0 local        # Deploy locally"
    echo "  $0 prod         # Deploy with Docker (legacy)"
    echo "  $0 complete staging    # Complete deployment to staging"
    echo ""
    echo "For production deployments, use the new deployment scripts:"
    echo "  ./scripts/deploy-complete.sh production [project_id]"
}

# Stop running services
stop_services() {
    print_status "Stopping running services..."

    # Stop Docker container
    if [ "$DOCKER_AVAILABLE" = true ]; then
        docker stop blue-dragon-motors 2>/dev/null || true
        docker rm blue-dragon-motors 2>/dev/null || true
        print_success "Docker container stopped"
    fi

    # Kill any running Node processes
    pkill -f "ng serve" 2>/dev/null || true
    pkill -f "node.*index.js" 2>/dev/null || true
    pkill -f "nodemon" 2>/dev/null || true

    print_success "Services stopped"
}

# Run tests
run_tests() {
    print_status "Running deployment tests..."

    # Test AI proxy
    npm run test:ai-proxy

    if [ $? -eq 0 ]; then
        print_success "All tests passed!"
    else
        print_error "Some tests failed"
        exit 1
    fi
}

# Main deployment logic
main() {
    local command=${1:-"help"}

    case $command in
        "build")
            check_dependencies
            check_environment
            build_application
            build_ai_proxy
            ;;
        "docker")
            check_dependencies
            build_docker
            ;;
        "local")
            check_dependencies
            check_environment
            build_application
            build_ai_proxy
            deploy_local
            ;;
        "prod")
            print_warning "Legacy 'prod' command. Use './scripts/deploy-complete.sh production' for full deployment"
            check_dependencies
            check_environment
            build_application
            build_ai_proxy
            build_docker
            deploy_docker
            ;;
        "complete")
            print_status "Redirecting to complete deployment script..."
            ./scripts/deploy-complete.sh "${@:2}"
            ;;
        "stop")
            stop_services
            ;;
        "test")
            run_tests
            ;;
        "help"|*)
            show_usage
            ;;
    esac
}

# Run main function with all arguments
main "$@"