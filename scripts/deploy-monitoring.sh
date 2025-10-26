#!/bin/bash

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

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if we can connect to the cluster
if ! kubectl cluster-info &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster"
    exit 1
fi

print_status "Starting OfficeFlow monitoring infrastructure deployment..."

# Create namespaces
print_status "Creating namespaces..."
kubectl apply -f k8s/namespace.yaml
print_success "Namespaces created"

# Wait for namespaces to be ready
print_status "Waiting for namespaces to be ready..."
kubectl wait --for=condition=Active namespace/officeflow --timeout=60s
kubectl wait --for=condition=Active namespace/monitoring --timeout=60s

# Deploy Prometheus
print_status "Deploying Prometheus..."
kubectl apply -f k8s/monitoring/prometheus.yaml
print_success "Prometheus deployed"

# Deploy Alertmanager
print_status "Deploying Alertmanager..."
kubectl apply -f k8s/monitoring/alertmanager.yaml
print_success "Alertmanager deployed"

# Deploy Grafana
print_status "Deploying Grafana..."
kubectl apply -f k8s/monitoring/grafana.yaml
print_success "Grafana deployed"

# Deploy Jaeger
print_status "Deploying Jaeger..."
kubectl apply -f k8s/monitoring/jaeger.yaml
print_success "Jaeger deployed"

# Deploy ServiceMonitor and alerting rules
print_status "Deploying monitoring configuration..."
kubectl apply -f k8s/monitoring/servicemonitor.yaml
kubectl apply -f k8s/monitoring/alerting-rules.yaml
print_success "Monitoring configuration deployed"

# Deploy Grafana dashboards
print_status "Deploying Grafana dashboards..."
kubectl apply -f k8s/monitoring/grafana-dashboard.yaml
print_success "Grafana dashboards deployed"

# Deploy logging infrastructure
print_status "Deploying logging infrastructure..."
kubectl apply -f k8s/logging/fluentd-config.yaml
print_success "Logging infrastructure deployed"

# Wait for deployments to be ready
print_status "Waiting for deployments to be ready..."

deployments=(
    "monitoring/prometheus"
    "monitoring/alertmanager"
    "monitoring/grafana"
    "monitoring/jaeger-collector"
    "monitoring/jaeger-query"
)

for deployment in "${deployments[@]}"; do
    print_status "Waiting for deployment $deployment..."
    kubectl wait --for=condition=Available deployment/$deployment --timeout=300s
    print_success "Deployment $deployment is ready"
done

# Check pod status
print_status "Checking pod status..."
kubectl get pods -n monitoring
kubectl get pods -n officeflow

# Display access information
print_success "OfficeFlow monitoring infrastructure deployed successfully!"
echo ""
print_status "Access Information:"
echo "==================="

# Get service information
GRAFANA_PORT=$(kubectl get svc grafana -n monitoring -o jsonpath='{.spec.ports[0].port}')
PROMETHEUS_PORT=$(kubectl get svc prometheus -n monitoring -o jsonpath='{.spec.ports[0].port}')
JAEGER_PORT=$(kubectl get svc jaeger-query -n monitoring -o jsonpath='{.spec.ports[0].port}')
ALERTMANAGER_PORT=$(kubectl get svc alertmanager -n monitoring -o jsonpath='{.spec.ports[0].port}')

echo "Grafana Dashboard:"
echo "  kubectl port-forward -n monitoring svc/grafana $GRAFANA_PORT:$GRAFANA_PORT"
echo "  Then access: http://localhost:$GRAFANA_PORT"
echo "  Default credentials: admin/admin123"
echo ""

echo "Prometheus:"
echo "  kubectl port-forward -n monitoring svc/prometheus $PROMETHEUS_PORT:$PROMETHEUS_PORT"
echo "  Then access: http://localhost:$PROMETHEUS_PORT"
echo ""

echo "Jaeger Tracing:"
echo "  kubectl port-forward -n monitoring svc/jaeger-query $JAEGER_PORT:$JAEGER_PORT"
echo "  Then access: http://localhost:$JAEGER_PORT"
echo ""

echo "Alertmanager:"
echo "  kubectl port-forward -n monitoring svc/alertmanager $ALERTMANAGER_PORT:$ALERTMANAGER_PORT"
echo "  Then access: http://localhost:$ALERTMANAGER_PORT"
echo ""

print_warning "Remember to:"
print_warning "1. Update PagerDuty routing keys in k8s/monitoring/alerting-rules.yaml"
print_warning "2. Update Slack webhook URLs in k8s/monitoring/alertmanager.yaml"
print_warning "3. Configure proper TLS certificates for production"
print_warning "4. Update default passwords and secrets"
print_warning "5. Configure persistent storage for production workloads"

print_success "Deployment completed successfully!"