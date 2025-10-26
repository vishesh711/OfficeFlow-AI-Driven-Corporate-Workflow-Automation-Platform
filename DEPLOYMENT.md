# OfficeFlow Platform Deployment Guide

This document provides comprehensive instructions for deploying the OfficeFlow Platform using Docker, Kubernetes, and CI/CD pipelines.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Environment Configuration](#environment-configuration)
- [Monitoring and Observability](#monitoring-and-observability)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Docker** (v20.10+)
- **Docker Compose** (v2.0+)
- **Kubernetes** (v1.25+)
- **kubectl** (v1.25+)
- **Helm** (v3.10+)
- **Node.js** (v18+)
- **pnpm** (v8+)

### Optional Tools

- **k9s** - Kubernetes cluster management
- **Lens** - Kubernetes IDE
- **Trivy** - Container security scanning
- **Artillery** - Load testing

## Local Development

### Using Docker Compose

1. **Start the development environment:**
   ```bash
   docker-compose up -d
   ```

2. **View logs:**
   ```bash
   docker-compose logs -f [service-name]
   ```

3. **Stop the environment:**
   ```bash
   docker-compose down
   ```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
POSTGRES_URL=postgresql://officeflow:officeflow_dev@postgres:5432/officeflow
REDIS_URL=redis://redis:6379

# Kafka
KAFKA_BROKERS=kafka:29092

# External APIs
OPENAI_API_KEY=your_openai_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_SIGNING_SECRET=your_slack_signing_secret

# MinIO
MINIO_ACCESS_KEY=officeflow
MINIO_SECRET_KEY=officeflow_dev
```

## Docker Deployment

### Building Images

1. **Build all images:**
   ```bash
   ./scripts/docker-build-push.sh --local-only
   ```

2. **Build specific service:**
   ```bash
   docker build -t officeflow/workflow-engine:latest services/workflow-engine/
   ```

3. **Multi-architecture build:**
   ```bash
   ./scripts/docker-build-push.sh --multi-arch
   ```

### Security Scanning

Run security scans on all images:

```bash
./scripts/docker-security-scan.sh
```

### Image Registry

Push images to registry:

```bash
./scripts/docker-build-push.sh \
  --registry ghcr.io \
  --prefix your-org/officeflow \
  --version v1.0.0
```

## Kubernetes Deployment

### Quick Start

1. **Deploy to staging:**
   ```bash
   ./scripts/k8s-deploy.sh --namespace officeflow-staging
   ```

2. **Deploy to production:**
   ```bash
   ./scripts/k8s-deploy.sh --namespace officeflow --context production
   ```

### Manual Deployment

1. **Create namespace:**
   ```bash
   kubectl apply -f k8s/namespace.yaml
   ```

2. **Deploy infrastructure:**
   ```bash
   kubectl apply -f k8s/infrastructure/
   ```

3. **Deploy services:**
   ```bash
   kubectl apply -f k8s/services/
   ```

4. **Deploy frontend:**
   ```bash
   kubectl apply -f k8s/apps/
   ```

5. **Configure ingress:**
   ```bash
   kubectl apply -f k8s/ingress/
   ```

### Deployment Strategies

#### Rolling Update (Default)
```bash
./scripts/deploy.sh --strategy rolling --environment staging
```

#### Blue-Green Deployment
```bash
./scripts/deploy.sh --strategy blue-green --environment production
```

#### Canary Deployment
```bash
./scripts/deploy.sh --strategy canary --environment production
```

### Scaling

#### Manual Scaling
```bash
kubectl scale deployment workflow-engine --replicas=5 -n officeflow
```

#### Auto Scaling
HPA (Horizontal Pod Autoscaler) is configured for all services:
- CPU threshold: 70%
- Memory threshold: 80%
- Min replicas: 2-3 (depending on service)
- Max replicas: 6-10 (depending on service)

## CI/CD Pipeline

### GitHub Actions Workflows

The platform includes several automated workflows:

#### Continuous Integration (`ci.yml`)
- **Triggers:** Push to main/develop, Pull requests
- **Jobs:**
  - Lint and type checking
  - Unit tests (per service)
  - Integration tests
  - Security scanning
  - Docker image building
  - Kubernetes manifest validation

#### Continuous Deployment (`cd.yml`)
- **Triggers:** Push to main, Tags, Manual dispatch
- **Jobs:**
  - Build and push Docker images
  - Security scan images
  - Deploy to staging (automatic)
  - Deploy to production (on tags)
  - Blue-green deployment for production
  - Post-deployment testing

#### Security Scanning (`security.yml`)
- **Triggers:** Daily schedule, Push to main
- **Jobs:**
  - Dependency vulnerability scanning
  - SAST (Static Application Security Testing)
  - Secret scanning
  - Container image scanning
  - Infrastructure as Code scanning
  - License compliance

#### Performance Testing (`performance.yml`)
- **Triggers:** Daily schedule, Push to main
- **Jobs:**
  - Load testing
  - Stress testing
  - Database performance testing
  - Frontend performance testing

### Required Secrets

Configure these secrets in your GitHub repository:

```yaml
# Container Registry
GITHUB_TOKEN: # GitHub token for GHCR access

# Kubernetes
STAGING_KUBECONFIG: # Base64 encoded kubeconfig for staging
PRODUCTION_KUBECONFIG: # Base64 encoded kubeconfig for production

# External Services
SNYK_TOKEN: # Snyk security scanning
LHCI_GITHUB_APP_TOKEN: # Lighthouse CI
TEST_AUTH_TOKEN: # Test authentication token

# Notifications
SLACK_WEBHOOK_URL: # General notifications
SECURITY_SLACK_WEBHOOK_URL: # Security alerts
PERFORMANCE_SLACK_WEBHOOK_URL: # Performance alerts
```

## Environment Configuration

### Development
- **Namespace:** `officeflow-dev`
- **Replicas:** 1 per service
- **Resources:** Minimal (100m CPU, 128Mi RAM)
- **Domain:** `dev.officeflow.local`

### Staging
- **Namespace:** `officeflow-staging`
- **Replicas:** 2 per service
- **Resources:** Medium (250m CPU, 256Mi RAM)
- **Domain:** `staging.officeflow.com`

### Production
- **Namespace:** `officeflow`
- **Replicas:** 3+ per service
- **Resources:** High (500m+ CPU, 512Mi+ RAM)
- **Domain:** `officeflow.com`

### Configuration Management

Environment-specific configurations are managed through:

1. **Kubernetes ConfigMaps** - Application configuration
2. **Kubernetes Secrets** - Sensitive data
3. **Environment Variables** - Runtime configuration
4. **Helm Values** - Deployment parameters (if using Helm)

## Monitoring and Observability

### Metrics and Monitoring

The platform includes comprehensive monitoring:

- **Prometheus** - Metrics collection
- **Grafana** - Metrics visualization
- **Jaeger** - Distributed tracing
- **Fluentd** - Log aggregation
- **AlertManager** - Alert management

### Health Checks

All services expose health check endpoints:

- `/health/live` - Liveness probe
- `/health/ready` - Readiness probe
- `/metrics` - Prometheus metrics

### Logging

Structured JSON logging with correlation IDs:

```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "level": "info",
  "service": "workflow-engine",
  "correlationId": "req-123",
  "message": "Workflow executed successfully",
  "metadata": {
    "workflowId": "wf-456",
    "duration": 1500
  }
}
```

## Troubleshooting

### Common Issues

#### Pod Startup Issues
```bash
# Check pod status
kubectl get pods -n officeflow

# View pod logs
kubectl logs -f deployment/workflow-engine -n officeflow

# Describe pod for events
kubectl describe pod <pod-name> -n officeflow
```

#### Database Connection Issues
```bash
# Test database connectivity
kubectl exec -it deployment/postgres -n officeflow -- psql -U officeflow -d officeflow -c "SELECT 1;"

# Check database logs
kubectl logs -f deployment/postgres -n officeflow
```

#### Service Discovery Issues
```bash
# Check service endpoints
kubectl get endpoints -n officeflow

# Test service connectivity
kubectl exec -it deployment/workflow-engine -n officeflow -- curl http://auth-service/health
```

### Rollback Procedures

#### Kubernetes Rollback
```bash
# Rollback specific deployment
kubectl rollout undo deployment/workflow-engine -n officeflow

# Rollback to specific revision
kubectl rollout undo deployment/workflow-engine --to-revision=2 -n officeflow

# Check rollout status
kubectl rollout status deployment/workflow-engine -n officeflow
```

#### Using Deployment Script
```bash
./scripts/deploy.sh --rollback --environment production
```

### Performance Issues

#### Resource Monitoring
```bash
# Check resource usage
kubectl top pods -n officeflow
kubectl top nodes

# Check HPA status
kubectl get hpa -n officeflow
```

#### Database Performance
```bash
# Check database performance
kubectl exec -it deployment/postgres -n officeflow -- \
  psql -U officeflow -d officeflow -c "
    SELECT query, calls, total_time, mean_time 
    FROM pg_stat_statements 
    ORDER BY total_time DESC 
    LIMIT 10;"
```

### Security Issues

#### Check Security Policies
```bash
# Check network policies
kubectl get networkpolicy -n officeflow

# Check pod security policies
kubectl get psp

# Check RBAC
kubectl get rolebindings -n officeflow
```

#### Scan for Vulnerabilities
```bash
# Scan running containers
./scripts/docker-security-scan.sh --scan-only

# Check for secrets in logs
kubectl logs deployment/workflow-engine -n officeflow | grep -i "password\|secret\|key"
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Update dependencies** (weekly)
2. **Security patches** (as needed)
3. **Database maintenance** (monthly)
4. **Log rotation** (automated)
5. **Backup verification** (weekly)
6. **Performance review** (monthly)

### Backup and Recovery

#### Database Backup
```bash
# Manual backup
kubectl exec deployment/postgres -n officeflow -- \
  pg_dump -U officeflow officeflow > backup-$(date +%Y%m%d).sql

# Restore from backup
kubectl exec -i deployment/postgres -n officeflow -- \
  psql -U officeflow officeflow < backup-20240101.sql
```

#### Configuration Backup
```bash
# Backup all configurations
kubectl get all,configmap,secret,pvc -n officeflow -o yaml > officeflow-backup.yaml
```

### Contact Information

- **Development Team:** dev@officeflow.com
- **DevOps Team:** devops@officeflow.com
- **Security Team:** security@officeflow.com
- **On-call:** +1-555-OFFICE-1

For urgent production issues, use the on-call number or Slack channel `#incident-response`.