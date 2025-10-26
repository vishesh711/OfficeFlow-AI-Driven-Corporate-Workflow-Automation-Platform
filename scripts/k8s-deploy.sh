#!/bin/bash

# Kubernetes Deployment Script for OfficeFlow Platform
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE=${NAMESPACE:-"officeflow"}
KUBECTL_CONTEXT=${KUBECTL_CONTEXT:-""}
DRY_RUN=${DRY_RUN:-false}
WAIT_TIMEOUT=${WAIT_TIMEOUT:-300}

echo -e "${GREEN}Deploying OfficeFlow Platform to Kubernetes${NC}"
echo -e "${BLUE}Namespace: ${NAMESPACE}${NC}"
echo -e "${BLUE}Context: ${KUBECTL_CONTEXT:-"current"}${NC}"
echo -e "${BLUE}Dry Run: ${DRY_RUN}${NC}"
echo "========================================"

# Function to apply Kubernetes manifests
apply_manifests() {
    local manifest_dir=$1
    local description=$2
    
    echo -e "${YELLOW}Deploying ${description}...${NC}"
    
    local kubectl_cmd="kubectl"
    if [[ -n "${KUBECTL_CONTEXT}" ]]; then
        kubectl_cmd="${kubectl_cmd} --context=${KUBECTL_CONTEXT}"
    fi
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        kubectl_cmd="${kubectl_cmd} --dry-run=client"
    fi
    
    # Apply all YAML files in the directory
    for file in ${manifest_dir}/*.yaml; do
        if [[ -f "$file" ]]; then
            echo "Applying $(basename "$file")..."
            ${kubectl_cmd} apply -f "$file"
        fi
    done
    
    echo -e "${GREEN}${description} deployed successfully${NC}"
    echo "----------------------------------------"
}

# Function to wait for deployments
wait_for_deployments() {
    local namespace=$1
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        echo -e "${BLUE}Skipping wait (dry run mode)${NC}"
        return
    fi
    
    echo -e "${YELLOW}Waiting for deployments to be ready...${NC}"
    
    local kubectl_cmd="kubectl"
    if [[ -n "${KUBECTL_CONTEXT}" ]]; then
        kubectl_cmd="${kubectl_cmd} --context=${KUBECTL_CONTEXT}"
    fi
    
    # Wait for all deployments in the namespace
    ${kubectl_cmd} wait --for=condition=available --timeout=${WAIT_TIMEOUT}s \
        deployment --all -n ${namespace}
    
    # Wait for all statefulsets in the namespace
    ${kubectl_cmd} wait --for=condition=ready --timeout=${WAIT_TIMEOUT}s \
        statefulset --all -n ${namespace}
    
    echo -e "${GREEN}All deployments are ready${NC}"
}

# Function to check cluster prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check if kubectl is installed
    if ! command -v kubectl >/dev/null 2>&1; then
        echo -e "${RED}kubectl is not installed${NC}"
        exit 1
    fi
    
    # Check if cluster is accessible
    local kubectl_cmd="kubectl"
    if [[ -n "${KUBECTL_CONTEXT}" ]]; then
        kubectl_cmd="${kubectl_cmd} --context=${KUBECTL_CONTEXT}"
    fi
    
    if ! ${kubectl_cmd} cluster-info >/dev/null 2>&1; then
        echo -e "${RED}Cannot connect to Kubernetes cluster${NC}"
        exit 1
    fi
    
    # Check if namespace exists, create if it doesn't
    if ! ${kubectl_cmd} get namespace ${NAMESPACE} >/dev/null 2>&1; then
        echo "Creating namespace ${NAMESPACE}..."
        ${kubectl_cmd} create namespace ${NAMESPACE}
    fi
    
    echo -e "${GREEN}Prerequisites check passed${NC}"
}

# Function to create storage classes if needed
create_storage_classes() {
    echo -e "${YELLOW}Creating storage classes...${NC}"
    
    local kubectl_cmd="kubectl"
    if [[ -n "${KUBECTL_CONTEXT}" ]]; then
        kubectl_cmd="${kubectl_cmd} --context=${KUBECTL_CONTEXT}"
    fi
    
    # Check if fast-ssd storage class exists
    if ! ${kubectl_cmd} get storageclass fast-ssd >/dev/null 2>&1; then
        cat <<EOF | ${kubectl_cmd} apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd
  replication-type: none
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
EOF
        echo "Created fast-ssd storage class"
    fi
    
    echo -e "${GREEN}Storage classes ready${NC}"
}

# Function to display deployment status
show_status() {
    local namespace=$1
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        echo -e "${BLUE}Skipping status (dry run mode)${NC}"
        return
    fi
    
    echo -e "${YELLOW}Deployment Status:${NC}"
    
    local kubectl_cmd="kubectl"
    if [[ -n "${KUBECTL_CONTEXT}" ]]; then
        kubectl_cmd="${kubectl_cmd} --context=${KUBECTL_CONTEXT}"
    fi
    
    echo -e "${BLUE}Pods:${NC}"
    ${kubectl_cmd} get pods -n ${namespace} -o wide
    
    echo -e "${BLUE}Services:${NC}"
    ${kubectl_cmd} get services -n ${namespace}
    
    echo -e "${BLUE}Ingress:${NC}"
    ${kubectl_cmd} get ingress -n ${namespace}
    
    echo -e "${BLUE}PVCs:${NC}"
    ${kubectl_cmd} get pvc -n ${namespace}
}

# Function to generate deployment summary
generate_summary() {
    local namespace=$1
    
    echo -e "${GREEN}Deployment Summary:${NC}"
    echo "==================="
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        echo -e "${BLUE}Dry run completed successfully${NC}"
        echo "No resources were actually created"
        return
    fi
    
    local kubectl_cmd="kubectl"
    if [[ -n "${KUBECTL_CONTEXT}" ]]; then
        kubectl_cmd="${kubectl_cmd} --context=${KUBECTL_CONTEXT}"
    fi
    
    # Count resources
    local pods=$(${kubectl_cmd} get pods -n ${namespace} --no-headers | wc -l)
    local services=$(${kubectl_cmd} get services -n ${namespace} --no-headers | wc -l)
    local deployments=$(${kubectl_cmd} get deployments -n ${namespace} --no-headers | wc -l)
    local statefulsets=$(${kubectl_cmd} get statefulsets -n ${namespace} --no-headers | wc -l)
    
    echo "Pods: ${pods}"
    echo "Services: ${services}"
    echo "Deployments: ${deployments}"
    echo "StatefulSets: ${statefulsets}"
    
    echo ""
    echo -e "${GREEN}Access URLs:${NC}"
    echo "Frontend: https://app.officeflow.local"
    echo "API: https://api.officeflow.local"
    echo "Auth: https://auth.officeflow.local"
    
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Update DNS records to point to your ingress controller"
    echo "2. Configure SSL certificates"
    echo "3. Update external API credentials in secrets"
    echo "4. Run database migrations"
    echo "5. Configure monitoring and alerting"
}

# Main execution
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --namespace)
                NAMESPACE="$2"
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
            --wait-timeout)
                WAIT_TIMEOUT="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [--namespace NAMESPACE] [--context CONTEXT] [--dry-run] [--wait-timeout SECONDS]"
                echo ""
                echo "Options:"
                echo "  --namespace     Kubernetes namespace (default: officeflow)"
                echo "  --context       Kubectl context to use"
                echo "  --dry-run       Perform a dry run without creating resources"
                echo "  --wait-timeout  Timeout for waiting for deployments (default: 300s)"
                echo "  --help          Show this help message"
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
    check_prerequisites
    create_storage_classes
    
    # Deploy in order
    apply_manifests "k8s" "Namespace and base configuration"
    apply_manifests "k8s/infrastructure" "Infrastructure services"
    apply_manifests "k8s/services" "Application services"
    apply_manifests "k8s/apps" "Frontend applications"
    apply_manifests "k8s/ingress" "Ingress configuration"
    
    # Wait for deployments and show status
    wait_for_deployments "${NAMESPACE}"
    show_status "${NAMESPACE}"
    generate_summary "${NAMESPACE}"
    
    echo -e "${GREEN}OfficeFlow Platform deployment completed successfully!${NC}"
}

# Run main function
main "$@"