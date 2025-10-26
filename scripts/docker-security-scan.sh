#!/bin/bash

# Docker Security Scanning Script for OfficeFlow Platform
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGISTRY_PREFIX=${REGISTRY_PREFIX:-"officeflow"}
SCAN_TOOL=${SCAN_TOOL:-"trivy"}

# Services to scan
SERVICES=(
    "workflow-engine"
    "auth-service"
    "identity-service"
    "ai-service"
    "email-service"
    "document-service"
    "calendar-service"
    "slack-service"
    "webhook-gateway"
)

APPS=(
    "workflow-designer"
)

echo -e "${GREEN}Starting Docker security scan for OfficeFlow Platform${NC}"

# Function to scan image
scan_image() {
    local image_name=$1
    local service_path=$2
    
    echo -e "${YELLOW}Scanning ${image_name}...${NC}"
    
    # Build image if it doesn't exist
    if ! docker image inspect "${REGISTRY_PREFIX}/${image_name}:latest" >/dev/null 2>&1; then
        echo "Building ${image_name}..."
        docker build -t "${REGISTRY_PREFIX}/${image_name}:latest" "${service_path}"
    fi
    
    # Run security scan based on available tool
    if command -v trivy >/dev/null 2>&1; then
        echo "Running Trivy scan..."
        trivy image --severity HIGH,CRITICAL "${REGISTRY_PREFIX}/${image_name}:latest"
    elif command -v docker >/dev/null 2>&1 && docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest --version >/dev/null 2>&1; then
        echo "Running Trivy scan via Docker..."
        docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
            aquasec/trivy:latest image --severity HIGH,CRITICAL "${REGISTRY_PREFIX}/${image_name}:latest"
    else
        echo -e "${RED}No security scanning tool available. Please install Trivy.${NC}"
        return 1
    fi
    
    echo -e "${GREEN}Scan completed for ${image_name}${NC}"
    echo "----------------------------------------"
}

# Function to optimize image
optimize_image() {
    local image_name=$1
    
    echo -e "${YELLOW}Optimizing ${image_name}...${NC}"
    
    # Get image size before optimization
    local size_before=$(docker image inspect "${REGISTRY_PREFIX}/${image_name}:latest" --format='{{.Size}}')
    
    # Create optimized version using dive if available
    if command -v dive >/dev/null 2>&1; then
        echo "Analyzing image layers with dive..."
        dive "${REGISTRY_PREFIX}/${image_name}:latest" --ci
    fi
    
    # Show image history
    echo "Image layer history:"
    docker history "${REGISTRY_PREFIX}/${image_name}:latest"
    
    echo -e "${GREEN}Image analysis completed for ${image_name}${NC}"
    echo "Size: $(numfmt --to=iec ${size_before})"
    echo "----------------------------------------"
}

# Install security scanning tools if not present
install_tools() {
    echo -e "${YELLOW}Checking for security scanning tools...${NC}"
    
    if ! command -v trivy >/dev/null 2>&1; then
        echo "Installing Trivy..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            if command -v brew >/dev/null 2>&1; then
                brew install aquasecurity/trivy/trivy
            else
                echo -e "${RED}Please install Homebrew or manually install Trivy${NC}"
                exit 1
            fi
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
        else
            echo -e "${RED}Unsupported OS. Please manually install Trivy${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}Security tools ready${NC}"
}

# Main execution
main() {
    # Parse command line arguments
    SCAN_ONLY=false
    OPTIMIZE_ONLY=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --scan-only)
                SCAN_ONLY=true
                shift
                ;;
            --optimize-only)
                OPTIMIZE_ONLY=true
                shift
                ;;
            --install-tools)
                install_tools
                exit 0
                ;;
            *)
                echo "Unknown option $1"
                echo "Usage: $0 [--scan-only] [--optimize-only] [--install-tools]"
                exit 1
                ;;
        esac
    done
    
    # Install tools if needed
    if ! command -v trivy >/dev/null 2>&1; then
        install_tools
    fi
    
    # Scan services
    for service in "${SERVICES[@]}"; do
        if [[ "$OPTIMIZE_ONLY" != true ]]; then
            scan_image "$service" "services/$service"
        fi
        
        if [[ "$SCAN_ONLY" != true ]]; then
            optimize_image "$service"
        fi
    done
    
    # Scan apps
    for app in "${APPS[@]}"; do
        if [[ "$OPTIMIZE_ONLY" != true ]]; then
            scan_image "$app" "apps/$app"
        fi
        
        if [[ "$SCAN_ONLY" != true ]]; then
            optimize_image "$app"
        fi
    done
    
    echo -e "${GREEN}All security scans and optimizations completed!${NC}"
}

# Run main function
main "$@"