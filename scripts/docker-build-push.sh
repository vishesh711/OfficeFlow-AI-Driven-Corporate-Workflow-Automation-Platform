#!/bin/bash

# Docker Build and Push Script for OfficeFlow Platform
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY=${REGISTRY:-"docker.io"}
REGISTRY_PREFIX=${REGISTRY_PREFIX:-"officeflow"}
VERSION=${VERSION:-$(git describe --tags --always --dirty 2>/dev/null || echo "latest")}
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Services and apps to build
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

echo -e "${GREEN}Building and pushing OfficeFlow Platform images${NC}"
echo -e "${BLUE}Registry: ${REGISTRY}${NC}"
echo -e "${BLUE}Prefix: ${REGISTRY_PREFIX}${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo -e "${BLUE}Build Date: ${BUILD_DATE}${NC}"
echo -e "${BLUE}Git Commit: ${GIT_COMMIT}${NC}"
echo "========================================"

# Function to build and push image
build_and_push() {
    local service_name=$1
    local service_path=$2
    local image_name="${REGISTRY}/${REGISTRY_PREFIX}/${service_name}"
    
    echo -e "${YELLOW}Building ${service_name}...${NC}"
    
    # Build image with multiple tags
    docker build \
        --build-arg BUILD_DATE="${BUILD_DATE}" \
        --build-arg GIT_COMMIT="${GIT_COMMIT}" \
        --build-arg VERSION="${VERSION}" \
        -t "${image_name}:${VERSION}" \
        -t "${image_name}:latest" \
        "${service_path}"
    
    # Show image size
    local size=$(docker image inspect "${image_name}:${VERSION}" --format='{{.Size}}')
    echo -e "${GREEN}Built ${service_name} ($(numfmt --to=iec ${size}))${NC}"
    
    # Push images if not in local mode
    if [[ "${LOCAL_ONLY:-false}" != "true" ]]; then
        echo -e "${YELLOW}Pushing ${service_name}...${NC}"
        docker push "${image_name}:${VERSION}"
        docker push "${image_name}:latest"
        echo -e "${GREEN}Pushed ${service_name}${NC}"
    else
        echo -e "${BLUE}Skipping push (LOCAL_ONLY=true)${NC}"
    fi
    
    echo "----------------------------------------"
}

# Function to create multi-arch manifest
create_manifest() {
    local service_name=$1
    local image_name="${REGISTRY}/${REGISTRY_PREFIX}/${service_name}"
    
    if [[ "${LOCAL_ONLY:-false}" != "true" && "${MULTI_ARCH:-false}" == "true" ]]; then
        echo -e "${YELLOW}Creating multi-arch manifest for ${service_name}...${NC}"
        
        # Create and push manifest
        docker manifest create "${image_name}:${VERSION}" \
            "${image_name}:${VERSION}-amd64" \
            "${image_name}:${VERSION}-arm64"
        
        docker manifest push "${image_name}:${VERSION}"
        
        echo -e "${GREEN}Multi-arch manifest created for ${service_name}${NC}"
    fi
}

# Function to build for multiple architectures
build_multi_arch() {
    local service_name=$1
    local service_path=$2
    local image_name="${REGISTRY}/${REGISTRY_PREFIX}/${service_name}"
    
    if [[ "${MULTI_ARCH:-false}" == "true" ]]; then
        echo -e "${YELLOW}Building multi-arch ${service_name}...${NC}"
        
        # Build for AMD64
        docker buildx build \
            --platform linux/amd64 \
            --build-arg BUILD_DATE="${BUILD_DATE}" \
            --build-arg GIT_COMMIT="${GIT_COMMIT}" \
            --build-arg VERSION="${VERSION}" \
            -t "${image_name}:${VERSION}-amd64" \
            --push \
            "${service_path}"
        
        # Build for ARM64
        docker buildx build \
            --platform linux/arm64 \
            --build-arg BUILD_DATE="${BUILD_DATE}" \
            --build-arg GIT_COMMIT="${GIT_COMMIT}" \
            --build-arg VERSION="${VERSION}" \
            -t "${image_name}:${VERSION}-arm64" \
            --push \
            "${service_path}"
        
        create_manifest "${service_name}"
    else
        build_and_push "${service_name}" "${service_path}"
    fi
}

# Function to login to registry
registry_login() {
    if [[ "${LOCAL_ONLY:-false}" != "true" ]]; then
        echo -e "${YELLOW}Logging into registry...${NC}"
        
        if [[ -n "${REGISTRY_USERNAME}" && -n "${REGISTRY_PASSWORD}" ]]; then
            echo "${REGISTRY_PASSWORD}" | docker login "${REGISTRY}" -u "${REGISTRY_USERNAME}" --password-stdin
        elif [[ -n "${DOCKER_CONFIG}" ]]; then
            echo "Using Docker config from ${DOCKER_CONFIG}"
        else
            echo -e "${RED}No registry credentials provided. Set REGISTRY_USERNAME and REGISTRY_PASSWORD${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}Registry login successful${NC}"
    fi
}

# Function to setup buildx for multi-arch
setup_buildx() {
    if [[ "${MULTI_ARCH:-false}" == "true" ]]; then
        echo -e "${YELLOW}Setting up Docker Buildx...${NC}"
        
        # Create buildx instance if it doesn't exist
        if ! docker buildx inspect officeflow-builder >/dev/null 2>&1; then
            docker buildx create --name officeflow-builder --use
        else
            docker buildx use officeflow-builder
        fi
        
        # Bootstrap the builder
        docker buildx inspect --bootstrap
        
        echo -e "${GREEN}Buildx setup complete${NC}"
    fi
}

# Function to generate image manifest
generate_manifest() {
    local manifest_file="image-manifest.json"
    
    echo -e "${YELLOW}Generating image manifest...${NC}"
    
    cat > "${manifest_file}" << EOF
{
  "version": "${VERSION}",
  "buildDate": "${BUILD_DATE}",
  "gitCommit": "${GIT_COMMIT}",
  "registry": "${REGISTRY}",
  "prefix": "${REGISTRY_PREFIX}",
  "images": {
EOF

    local first=true
    for service in "${SERVICES[@]}" "${APPS[@]}"; do
        if [[ "${first}" != true ]]; then
            echo "," >> "${manifest_file}"
        fi
        echo -n "    \"${service}\": \"${REGISTRY}/${REGISTRY_PREFIX}/${service}:${VERSION}\"" >> "${manifest_file}"
        first=false
    done

    cat >> "${manifest_file}" << EOF

  }
}
EOF

    echo -e "${GREEN}Image manifest generated: ${manifest_file}${NC}"
}

# Main execution
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --local-only)
                LOCAL_ONLY=true
                shift
                ;;
            --multi-arch)
                MULTI_ARCH=true
                shift
                ;;
            --version)
                VERSION="$2"
                shift 2
                ;;
            --registry)
                REGISTRY="$2"
                shift 2
                ;;
            --prefix)
                REGISTRY_PREFIX="$2"
                shift 2
                ;;
            *)
                echo "Unknown option $1"
                echo "Usage: $0 [--local-only] [--multi-arch] [--version VERSION] [--registry REGISTRY] [--prefix PREFIX]"
                exit 1
                ;;
        esac
    done
    
    # Setup
    if [[ "${LOCAL_ONLY:-false}" != "true" ]]; then
        registry_login
    fi
    
    if [[ "${MULTI_ARCH:-false}" == "true" ]]; then
        setup_buildx
    fi
    
    # Build services
    for service in "${SERVICES[@]}"; do
        build_multi_arch "$service" "services/$service"
    done
    
    # Build apps
    for app in "${APPS[@]}"; do
        build_multi_arch "$app" "apps/$app"
    done
    
    # Generate manifest
    generate_manifest
    
    echo -e "${GREEN}All images built and pushed successfully!${NC}"
    echo -e "${BLUE}Total images: $((${#SERVICES[@]} + ${#APPS[@]}))${NC}"
}

# Run main function
main "$@"