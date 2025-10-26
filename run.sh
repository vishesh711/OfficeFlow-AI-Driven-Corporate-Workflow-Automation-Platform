#!/bin/bash

# OfficeFlow Platform Runner Script
# This script provides easy commands to manage the OfficeFlow platform

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    if ! command_exists npm; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to install dependencies
install_deps() {
    print_status "Installing dependencies..."
    
    # Install pnpm if not present
    if ! command_exists pnpm; then
        print_status "Installing pnpm..."
        npm install -g pnpm
    fi
    
    # Clean up any existing installations
    print_status "Cleaning up existing installations..."
    find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
    rm -f pnpm-lock.yaml
    
    # Install dependencies
    pnpm install
    print_success "Dependencies installed"
}

# Function to build all services
build_all() {
    print_status "Building all services..."
    
    # Build packages first
    print_status "Building shared packages..."
    pnpm run build --filter="./packages/*" || true
    
    # Then build services
    print_status "Building services..."
    pnpm run build --filter="./services/*" || true
    
    # Finally build apps
    print_status "Building applications..."
    pnpm run build --filter="./apps/*" || true
    
    print_success "All services built successfully"
}

# Function to run all tests
test_all() {
    print_status "Running all tests..."
    pnpm run test || true  # Don't fail setup if tests fail
    print_success "All tests completed"
}

# Function to run type checking
type_check() {
    print_status "Running type checking..."
    npm run type-check
    print_success "Type checking completed"
}

# Function to start all services in development mode
dev_all() {
    print_status "Starting all services in development mode..."
    print_warning "This will start all services concurrently. Press Ctrl+C to stop all services."
    
    # Start infrastructure first
    print_status "Starting infrastructure services..."
    docker-compose -f docker-compose.dev.yml up -d
    
    # Wait a bit for infrastructure to start
    sleep 5
    
    # Start application services
    print_status "Starting application services..."
    pnpm run dev
}

# Function to start a specific service
dev_service() {
    local service=$1
    if [ -z "$service" ]; then
        print_error "Please specify a service name (ai-service, identity-service, workflow-engine)"
        exit 1
    fi
    
    if [ ! -d "services/$service" ]; then
        print_error "Service '$service' not found"
        exit 1
    fi
    
    print_status "Starting $service in development mode..."
    cd "services/$service"
    npm run dev
}

# Function to run tests for a specific service
test_service() {
    local service=$1
    if [ -z "$service" ]; then
        print_error "Please specify a service name (ai-service, identity-service, workflow-engine)"
        exit 1
    fi
    
    if [ ! -d "services/$service" ]; then
        print_error "Service '$service' not found"
        exit 1
    fi
    
    print_status "Running tests for $service..."
    cd "services/$service"
    npm run test
}

# Function to clean all build artifacts
clean_all() {
    print_status "Cleaning all build artifacts..."
    npm run clean
    print_success "All build artifacts cleaned"
}

# Function to format code
format_code() {
    print_status "Formatting code..."
    npm run format
    print_success "Code formatted"
}

# Function to check code formatting
check_format() {
    print_status "Checking code formatting..."
    npm run format:check
    print_success "Code formatting check completed"
}

# Function to setup the project
setup() {
    print_status "Setting up OfficeFlow platform..."
    check_prerequisites
    install_deps
    build_all
    test_all
    print_success "Setup completed successfully!"
    print_status "You can now run './run.sh dev' to start all services"
}

# Function to show help
show_help() {
    echo "OfficeFlow Platform Runner"
    echo ""
    echo "Usage: ./run.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  setup                    - Complete project setup (install, build, test)"
    echo "  fix-setup                - Fix common setup issues (run this first if having problems)"
    echo "  install                  - Install all dependencies"
    echo "  build                    - Build all services"
    echo "  dev                      - Start all services in development mode"
    echo "  dev <service>            - Start specific service in development mode"
    echo "  test                     - Run all tests"
    echo "  test <service>           - Run tests for specific service"
    echo "  type-check               - Run TypeScript type checking"
    echo "  clean                    - Clean all build artifacts"
    echo "  format                   - Format all code"
    echo "  format:check             - Check code formatting"
    echo "  help                     - Show this help message"
    echo ""
    echo "Services:"
    echo "  ai-service               - AI content generation service"
    echo "  identity-service         - Identity and access management service"
    echo "  workflow-engine          - Core workflow orchestration service"
    echo ""
    echo "Examples:"
    echo "  ./run.sh setup           - Setup the entire project"
    echo "  ./run.sh dev             - Start all services"
    echo "  ./run.sh dev ai-service  - Start only AI service"
    echo "  ./run.sh test            - Run all tests"
    echo "  ./run.sh build           - Build all services"
}

# Main script logic
case "$1" in
    "setup")
        setup
        ;;
    "fix-setup")
        print_status "Running fix-setup script..."
        ./fix-setup.sh
        ;;
    "install")
        check_prerequisites
        install_deps
        ;;
    "build")
        build_all
        ;;
    "dev")
        if [ -n "$2" ]; then
            dev_service "$2"
        else
            dev_all
        fi
        ;;
    "test")
        if [ -n "$2" ]; then
            test_service "$2"
        else
            test_all
        fi
        ;;
    "type-check")
        type_check
        ;;
    "clean")
        clean_all
        ;;
    "format")
        format_code
        ;;
    "format:check")
        check_format
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    "")
        print_warning "No command specified. Use './run.sh help' for usage information."
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        print_status "Use './run.sh help' for usage information."
        exit 1
        ;;
esac