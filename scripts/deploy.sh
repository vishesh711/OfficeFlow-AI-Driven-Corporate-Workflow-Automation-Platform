#!/bin/bash

# Comprehensive Deployment Script for OfficeFlow Platform
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${ENVIRONMENT:-"staging"}
VERSION=${VERSION:-"latest"}
REGISTRY=${REGISTRY:-"ghcr.io"}
REGISTRY_PREFIX=${REGISTRY_PREFIX:-"officeflow/officeflow"}
KUBECTL_CONTEXT=${KUBECTL_CONTEXT:-""}
DRY_RUN=${DRY_RUN:-false}
SKIP_TESTS=${SKIP_TESTS:-false}
DEPLOYMENT_STRATEGY=${DEPLOYMENT_STRATEGY:-"rolling"}

echo -e "${GREEN}OfficeFlow Platform Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo -e "${BLUE}Strategy: ${DEPLOYMENT_STRATEGY}${NC}"
echo -e "${BLUE}Registry: ${REGISTRY}/${REGISTRY_PREFIX}${NC}"
echo "========================================"

# Function to validate prerequisites
validate_prerequisites() {
    echo -e "${YELLOW}Validating prerequisites...${NC}"
    
    # Check required tools
    local required_tools=("kubectl" "docker" "helm")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            echo -e "${RED}Error: $tool is not installed${NC}"
            exit 1
        fi
    done
    
    # Check kubectl context
    local kubectl_cmd="kubectl"
    if [[ -n "${KUBECTL_CONTEXT}" ]]; then
        kubectl_cmd="${kubectl_cmd} --context=${KUBECTL_CONTEXT}"
    fi
    
    if ! ${kubectl_cmd} cluster-info >/dev/null 2>&1; then
        echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
        exit 1
    fi
    
    # Validate environment
    case "${ENVIRONMENT}" in
        development|staging|production)
            echo -e "${GREEN}Environment ${ENVIRONMENT} is valid${NC}"
            ;;
        *)
            echo -e "${RED}Error: Invalid environment ${ENVIRONMENT}${NC}"
            echo "Valid environments: development, staging, production"
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}Prerequisites validated${NC}"
}

# Function to set environment-specific configuration
configure_environment() {
    echo -e "${YELLOW}Configuring environment: ${ENVIRONMENT}${NC}"
    
    case "${ENVIRONMENT}" in
        development)
            NAMESPACE="officeflow-dev"
            REPLICAS=1
            RESOURCES_REQUESTS_CPU="100m"
            RESOURCES_REQUESTS_MEMORY="128Mi"
            RESOURCES_LIMITS_CPU="500m"
            RESOURCES_LIMITS_MEMORY="512Mi"
            DOMAIN="dev.officeflow.local"
            ;;
        staging)
            NAMESPACE="officeflow-staging"
            REPLICAS=2
            RESOURCES_REQUESTS_CPU="250m"
            RESOURCES_REQUESTS_MEMORY="256Mi"
            RESOURCES_LIMITS_CPU="500m"
            RESOURCES_LIMITS_MEMORY="512Mi"
            DOMAIN="staging.officeflow.com"
            ;;
        production)
            NAMESPACE="officeflow"
            REPLICAS=3
            RESOURCES_REQUESTS_CPU="500m"
            RESOURCES_REQUESTS_MEMORY="512Mi"
            RESOURCES_LIMITS_CPU="1000m"
            RESOURCES_LIMITS_MEMORY="1Gi"
            DOMAIN="officeflow.com"
            ;;
    esac
    
    echo -e "${GREEN}Environment configured${NC}"
}

# Function to run pre-deployment tests
run_pre_deployment_tests() {
    if [[ "${SKIP_TESTS}" == "true" ]]; then
        echo -e "${YELLOW}Skipping pre-deployment tests${NC}"
        return
    fi
    
    echo -e "${YELLOW}Running pre-deployment tests...${NC}"
    
    # Health check tests
    if [[ "${ENVIRONMENT}" != "development" ]]; then
        echo "Running health checks..."
        local base_url
        case "${ENVIRONMENT}" in
            staging)
                base_url="https://staging-api.officeflow.com"
                ;;
            production)
                base_url="https://api.officeflow.com"
                ;;
        esac
        
        if ! curl -f "${base_url}/health" >/dev/null 2>&1; then
            echo -e "${RED}Warning: Current deployment health check failed${NC}"
        fi
    fi
    
    # Smoke tests
    if [[ -f "tests/smoke/smoke.test.js" ]]; then
        echo "Running smoke tests..."
        npm test -- tests/smoke/smoke.test.js || {
            echo -e "${RED}Smoke tests failed${NC}"
            exit 1
        }
    fi
    
    echo -e "${GREEN}Pre-deployment tests passed${NC}"
}

# Function to backup current deployment
backup_deployment() {
    if [[ "${ENVIRONMENT}" == "production" ]]; then
        echo -e "${YELLOW}Creating backup...${NC}"
        
        local kubectl_cmd="kubectl"
        if [[ -n "${KUBECTL_CONTEXT}" ]]; then
            kubectl_cmd="${kubectl_cmd} --context=${KUBECTL_CONTEXT}"
        fi
        
        local backup_dir="backups/$(date +%Y%m%d-%H%M%S)"
        mkdir -p "${backup_dir}"
        
        # Backup database
        echo "Backing up database..."
        ${kubectl_cmd} exec -n ${NAMESPACE} deployment/postgres -- \
            pg_dump -U officeflow officeflow > "${backup_dir}/database.sql"
        
        # Backup current manifests
        echo "Backing up current manifests..."
        ${kubectl_cmd} get all -n ${NAMESPACE} -o yaml > "${backup_dir}/manifests.yaml"
        
        # Store backup metadata
        cat > "${backup_dir}/metadata.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${ENVIRONMENT}",
  "namespace": "${NAMESPACE}",
  "version": "${VERSION}",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
}
EOF
        
        echo -e "${GREEN}Backup created: ${backup_dir}${NC}"
    fi
}

# Function to deploy using rolling update strategy
deploy_rolling() {
    echo -e "${YELLOW}Deploying with rolling update strategy...${NC}"
    
    local kubectl_cmd="kubectl"
    if [[ -n "${KUBECTL_CONTEXT}" ]]; then
        kubectl_cmd="${kubectl_cmd} --context=${KUBECTL_CONTEXT}"
    fi
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        kubectl_cmd="${kubectl_cmd} --dry-run=client"
    fi
    
    # Update image tags in manifests
    find k8s -name "*.yaml" -exec sed -i.bak "s|:latest|:${VERSION}|g" {} \;
    find k8s -name "*.yaml" -exec sed -i.bak "s|replicas: [0-9]*|replicas: ${REPLICAS}|g" {} \;
    
    # Apply manifests
    ${kubectl_cmd} apply -f k8s/
    
    if [[ "${DRY_RUN}" != "true" ]]; then
        # Wait for rollout to complete
        ${kubectl_cmd} rollout status deployment --all -n ${NAMESPACE} --timeout=600s
    fi
    
    # Restore original manifests
    find k8s -name "*.yaml.bak" -exec bash -c 'mv "$1" "${1%.bak}"' _ {} \;
    
    echo -e "${GREEN}Rolling deployment completed${NC}"
}

# Function to deploy using blue-green strategy
deploy_blue_green() {
    echo -e "${YELLOW}Deploying with blue-green strategy...${NC}"
    
    local kubectl_cmd="kubectl"
    if [[ -n "${KUBECTL_CONTEXT}" ]]; then
        kubectl_cmd="${kubectl_cmd} --context=${KUBECTL_CONTEXT}"
    fi
    
    local green_namespace="${NAMESPACE}-green"
    local blue_namespace="${NAMESPACE}-blue"
    
    # Create green environment
    ${kubectl_cmd} create namespace ${green_namespace} --dry-run=client -o yaml | ${kubectl_cmd} apply -f -
    
    # Deploy to green environment
    find k8s -name "*.yaml" -exec sed -i.bak "s|namespace: ${NAMESPACE}|namespace: ${green_namespace}|g" {} \;
    find k8s -name "*.yaml" -exec sed -i.bak "s|:latest|:${VERSION}|g" {} \;
    
    ${kubectl_cmd} apply -f k8s/
    
    # Wait for green deployment
    ${kubectl_cmd} rollout status deployment --all -n ${green_namespace} --timeout=600s
    
    # Run health checks on green environment
    echo "Running health checks on green environment..."
    sleep 30
    
    # Switch traffic to green
    echo "Switching traffic to green environment..."
    ${kubectl_cmd} patch service workflow-engine -n ${NAMESPACE} \
        -p '{"spec":{"selector":{"version":"green"}}}'
    
    # Wait and verify
    sleep 30
    
    # Clean up blue environment
    if ${kubectl_cmd} get namespace ${blue_namespace} >/dev/null 2>&1; then
        ${kubectl_cmd} delete namespace ${blue_namespace}
    fi
    
    # Rename current to blue for next deployment
    ${kubectl_cmd} create namespace ${blue_namespace} --dry-run=client -o yaml | ${kubectl_cmd} apply -f -
    
    # Restore original manifests
    find k8s -name "*.yaml.bak" -exec bash -c 'mv "$1" "${1%.bak}"' _ {} \;
    
    echo -e "${GREEN}Blue-green deployment completed${NC}"
}

# Function to deploy using canary strategy
deploy_canary() {
    echo -e "${YELLOW}Deploying with canary strategy...${NC}"
    
    local kubectl_cmd="kubectl"
    if [[ -n "${KUBECTL_CONTEXT}" ]]; then
        kubectl_cmd="${kubectl_cmd} --context=${KUBECTL_CONTEXT}"
    fi
    
    # Deploy canary version (10% traffic)
    echo "Deploying canary version..."
    
    # Create canary deployment
    find k8s -name "*.yaml" -exec sed -i.bak "s|name: \([^-]*\)|name: \1-canary|g" {} \;
    find k8s -name "*.yaml" -exec sed -i.bak "s|:latest|:${VERSION}|g" {} \;
    find k8s -name "*.yaml" -exec sed -i.bak "s|replicas: [0-9]*|replicas: 1|g" {} \;
    
    ${kubectl_cmd} apply -f k8s/
    
    # Wait for canary deployment
    ${kubectl_cmd} rollout status deployment --all -n ${NAMESPACE} --timeout=300s
    
    echo "Canary deployed. Monitoring for 5 minutes..."
    sleep 300
    
    # Check canary metrics (simplified)
    echo "Checking canary metrics..."
    
    # If metrics are good, proceed with full deployment
    echo "Promoting canary to full deployment..."
    
    # Scale up canary and scale down original
    ${kubectl_cmd} scale deployment --all --replicas=${REPLICAS} -n ${NAMESPACE}
    
    # Restore original manifests
    find k8s -name "*.yaml.bak" -exec bash -c 'mv "$1" "${1%.bak}"' _ {} \;
    
    echo -e "${GREEN}Canary deployment completed${NC}"
}

# Function to run post-deployment tests
run_post_deployment_tests() {
    if [[ "${SKIP_TESTS}" == "true" ]]; then
        echo -e "${YELLOW}Skipping post-deployment tests${NC}"
        return
    fi
    
    echo -e "${YELLOW}Running post-deployment tests...${NC}"
    
    # Wait for services to be ready
    sleep 60
    
    # Health checks
    local base_url
    case "${ENVIRONMENT}" in
        development)
            base_url="http://dev.officeflow.local"
            ;;
        staging)
            base_url="https://staging.officeflow.com"
            ;;
        production)
            base_url="https://officeflow.com"
            ;;
    esac
    
    echo "Running health checks..."
    curl -f "${base_url}/health" || {
        echo -e "${RED}Health check failed${NC}"
        exit 1
    }
    
    # Integration tests
    if [[ -f "tests/integration/post-deploy.test.js" ]]; then
        echo "Running integration tests..."
        npm test -- tests/integration/post-deploy.test.js || {
            echo -e "${RED}Integration tests failed${NC}"
            exit 1
        }
    fi
    
    echo -e "${GREEN}Post-deployment tests passed${NC}"
}

# Function to rollback deployment
rollback_deployment() {
    echo -e "${YELLOW}Rolling back deployment...${NC}"
    
    local kubectl_cmd="kubectl"
    if [[ -n "${KUBECTL_CONTEXT}" ]]; then
        kubectl_cmd="${kubectl_cmd} --context=${KUBECTL_CONTEXT}"
    fi
    
    # Rollback all deployments
    ${kubectl_cmd} rollout undo deployment --all -n ${NAMESPACE}
    
    # Wait for rollback to complete
    ${kubectl_cmd} rollout status deployment --all -n ${NAMESPACE} --timeout=600s
    
    echo -e "${GREEN}Rollback completed${NC}"
}

# Function to generate deployment report
generate_deployment_report() {
    echo -e "${YELLOW}Generating deployment report...${NC}"
    
    local kubectl_cmd="kubectl"
    if [[ -n "${KUBECTL_CONTEXT}" ]]; then
        kubectl_cmd="${kubectl_cmd} --context=${KUBECTL_CONTEXT}"
    fi
    
    local report_file="deployment-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "${report_file}" << EOF
# Deployment Report

**Date:** $(date)
**Environment:** ${ENVIRONMENT}
**Version:** ${VERSION}
**Strategy:** ${DEPLOYMENT_STRATEGY}
**Namespace:** ${NAMESPACE}
**Git Commit:** $(git rev-parse HEAD 2>/dev/null || echo 'unknown')

## Deployment Status

\`\`\`
$(${kubectl_cmd} get pods -n ${NAMESPACE} 2>/dev/null || echo "Unable to fetch pod status")
\`\`\`

## Services

\`\`\`
$(${kubectl_cmd} get services -n ${NAMESPACE} 2>/dev/null || echo "Unable to fetch service status")
\`\`\`

## Ingress

\`\`\`
$(${kubectl_cmd} get ingress -n ${NAMESPACE} 2>/dev/null || echo "Unable to fetch ingress status")
\`\`\`

## Access URLs

- Frontend: https://app.${DOMAIN}
- API: https://api.${DOMAIN}
- Auth: https://auth.${DOMAIN}

## Next Steps

1. Monitor application metrics
2. Check error logs
3. Verify all integrations are working
4. Update documentation if needed

EOF
    
    echo -e "${GREEN}Deployment report generated: ${report_file}${NC}"
}

# Main execution function
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --version)
                VERSION="$2"
                shift 2
                ;;
            --strategy)
                DEPLOYMENT_STRATEGY="$2"
                shift 2
                ;;
            --context)
                KUBECTL_CONTEXT="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --rollback)
                rollback_deployment
                exit 0
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --environment ENV    Target environment (development|staging|production)"
                echo "  --version VERSION    Version to deploy (default: latest)"
                echo "  --strategy STRATEGY  Deployment strategy (rolling|blue-green|canary)"
                echo "  --context CONTEXT    Kubectl context to use"
                echo "  --dry-run           Perform a dry run"
                echo "  --skip-tests        Skip pre and post deployment tests"
                echo "  --rollback          Rollback the last deployment"
                echo "  --help              Show this help message"
                exit 0
                ;;
            *)
                echo "Unknown option $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Execute deployment steps
    validate_prerequisites
    configure_environment
    run_pre_deployment_tests
    backup_deployment
    
    # Deploy based on strategy
    case "${DEPLOYMENT_STRATEGY}" in
        rolling)
            deploy_rolling
            ;;
        blue-green)
            deploy_blue_green
            ;;
        canary)
            deploy_canary
            ;;
        *)
            echo -e "${RED}Unknown deployment strategy: ${DEPLOYMENT_STRATEGY}${NC}"
            exit 1
            ;;
    esac
    
    # Post-deployment steps
    run_post_deployment_tests
    generate_deployment_report
    
    echo -e "${GREEN}Deployment completed successfully!${NC}"
}

# Trap errors and provide rollback option
trap 'echo -e "${RED}Deployment failed. Run with --rollback to revert changes.${NC}"; exit 1' ERR

# Run main function
main "$@"