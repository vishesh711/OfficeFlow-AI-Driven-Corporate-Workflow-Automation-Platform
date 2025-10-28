# OfficeFlow Observability Guide

This document provides comprehensive information about the observability infrastructure implemented for the OfficeFlow platform.

## Overview

The OfficeFlow platform implements a complete observability stack including:

- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Distributed Tracing**: OpenTelemetry-based tracing with Jaeger
- **Metrics Collection**: Prometheus metrics with custom dashboards
- **Health Checks**: Kubernetes-native health monitoring
- **Alerting**: PagerDuty and Slack integration for critical alerts
- **Log Aggregation**: Centralized logging with Elasticsearch and Fluentd

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │   Observability │    │    Storage      │
│    Services     │    │   Components    │    │   & Backends    │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Workflow Eng. │───▶│ • Prometheus    │───▶│ • Time Series   │
│ • Identity Svc  │    │ • Jaeger        │    │ • Elasticsearch │
│ • AI Service    │    │ • Fluentd       │    │ • Object Store  │
│ • Email Service │    │ • Grafana       │    │                 │
│ • Document Svc  │    │ • Alertmanager  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Components

### 1. Structured Logging

#### Features

- JSON-formatted logs with consistent schema
- Correlation ID tracking across service boundaries
- Contextual information (organization, workflow, user IDs)
- Log level filtering and routing
- Error stack trace capture

#### Usage

```typescript
import { initializeObservability } from '@officeflow/observability';

const { logger } = initializeObservability({
  serviceName: 'workflow-engine',
  serviceVersion: '1.0.0',
  logLevel: 'info',
});

// Basic logging
logger.info('Workflow started', {
  workflowId: 'wf-123',
  organizationId: 'org-456',
});

// Error logging with context
logger.error('Workflow execution failed', error, {
  workflowId: 'wf-123',
  nodeId: 'node-789',
});
```

#### Log Schema

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "service": "workflow-engine",
  "message": "Workflow started",
  "correlationId": "req-abc123",
  "workflowId": "wf-123",
  "organizationId": "org-456",
  "version": "1.0.0",
  "environment": "production",
  "hostname": "workflow-engine-pod-xyz"
}
```

### 2. Health Checks

#### Kubernetes Integration

- **Liveness Probe**: `/health/live` - Basic service availability
- **Readiness Probe**: `/health/ready` - Service ready to handle traffic
- **Startup Probe**: `/health/ready` - Service initialization complete

#### Custom Health Checks

```typescript
import { commonHealthChecks } from '@officeflow/observability';

// Database health check
healthService.addCheck(
  commonHealthChecks.database(async () => {
    try {
      await db.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  })
);

// Memory usage check
healthService.addCheck(commonHealthChecks.memory(500)); // 500MB threshold

// Custom health check
healthService.addCheck({
  name: 'kafka-connectivity',
  check: async () => {
    try {
      await kafka.admin().listTopics();
      return { status: 'healthy', message: 'Kafka connection healthy' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  },
});
```

### 3. Metrics Collection

#### Available Metrics

- `officeflow_requests_total` - Total HTTP requests
- `officeflow_request_duration_seconds` - Request duration histogram
- `officeflow_workflow_executions_total` - Workflow execution counter
- `officeflow_workflow_duration_seconds` - Workflow duration histogram
- `officeflow_node_executions_total` - Node execution counter
- `officeflow_node_duration_seconds` - Node execution duration
- `officeflow_active_workflows` - Currently active workflows
- `officeflow_errors_total` - Error counter
- `officeflow_queue_size` - Queue size gauge

#### Custom Metrics

```typescript
import { metricsService } from '@officeflow/observability';

// Increment counters
metricsService.incrementWorkflowExecutions({
  organizationId: 'org-123',
  workflowId: 'wf-456',
  status: 'success',
});

// Record durations
const timer = metricsService.createTimer();
// ... perform operation
metricsService.recordWorkflowDuration(timer(), {
  organizationId: 'org-123',
  workflowId: 'wf-456',
});

// Set gauge values
metricsService.setQueueSize(42, {
  service: 'workflow-engine',
  queue: 'node-execution',
});
```

### 4. Distributed Tracing

#### OpenTelemetry Integration

- Automatic instrumentation for HTTP, database, and Kafka operations
- Custom span creation for business logic
- Correlation with logs and metrics
- Jaeger backend for trace visualization

#### Usage

```typescript
import { tracingService } from '@officeflow/observability';

// Automatic tracing with middleware
app.use(...middleware); // Includes tracing middleware

// Manual span creation
await tracingService.executeWithSpan(
  'process-workflow',
  async () => {
    // Business logic here
    return await processWorkflow(workflowId);
  },
  {
    workflowId: 'wf-123',
    organizationId: 'org-456',
    operation: 'workflow-processing',
  }
);
```

### 5. Alerting

#### Alert Rules

- **High Error Rate**: >5% error rate for 2 minutes
- **Critical Error Rate**: >20% error rate for 1 minute
- **High Response Time**: 95th percentile >2s for 5 minutes
- **Service Down**: Service unavailable for 1 minute
- **High Memory Usage**: >85% heap usage for 5 minutes
- **Workflow Failures**: >0.1 failures/second for 2 minutes
- **Queue Backlog**: >1000 items in queue for 5 minutes

#### PagerDuty Integration

```yaml
# Update routing key in k8s/monitoring/alerting-rules.yaml
pagerduty_configs:
  - routing_key: 'YOUR_PAGERDUTY_ROUTING_KEY'
    description: 'OfficeFlow Critical Alert'
    severity: 'critical'
```

#### Slack Integration

```yaml
# Update webhook URL in k8s/monitoring/alertmanager.yaml
slack_configs:
  - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
    channel: '#officeflow-alerts'
    title: 'OfficeFlow Alert'
```

## Deployment

### Prerequisites

- Kubernetes cluster with RBAC enabled
- kubectl configured and connected
- Sufficient cluster resources (4 CPU, 8GB RAM minimum)

### Local Development

The monitoring stack is included in the Docker Compose setup:

```bash
# Start with monitoring enabled
docker-compose up -d

# Access monitoring tools
# - Grafana: http://localhost:3001
# - Prometheus: http://localhost:9090
# - Jaeger: http://localhost:16686
```

### Production Deployment

```bash
# Deploy monitoring infrastructure
./scripts/deploy-monitoring.sh

# Or as part of full platform deployment
./scripts/k8s-deploy.sh --namespace officeflow

# Deploy application with observability
kubectl apply -f k8s/workflow-engine/
```

### CI/CD Integration

The platform includes automated monitoring deployment:

- **Performance Testing**: Automated load and stress testing with Artillery and k6
- **Security Monitoring**: Continuous vulnerability scanning with Trivy and Snyk
- **Health Checks**: Automated service health verification in deployment pipelines
- **Alerting**: Slack/email notifications for deployment issues and performance regressions

### Manual Deployment

```bash
# Create namespaces
kubectl apply -f k8s/namespace.yaml

# Deploy monitoring stack
kubectl apply -f k8s/monitoring/prometheus.yaml
kubectl apply -f k8s/monitoring/grafana.yaml
kubectl apply -f k8s/monitoring/jaeger.yaml
kubectl apply -f k8s/monitoring/alertmanager.yaml

# Deploy configuration
kubectl apply -f k8s/monitoring/servicemonitor.yaml
kubectl apply -f k8s/monitoring/alerting-rules.yaml
kubectl apply -f k8s/monitoring/grafana-dashboard.yaml

# Deploy logging
kubectl apply -f k8s/logging/fluentd-config.yaml
```

### Access Services

```bash
# Grafana Dashboard
kubectl port-forward -n monitoring svc/grafana 3000:3000
# Access: http://localhost:3000 (admin/admin123)

# Prometheus
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Access: http://localhost:9090

# Jaeger
kubectl port-forward -n monitoring svc/jaeger-query 16686:16686
# Access: http://localhost:16686

# Alertmanager
kubectl port-forward -n monitoring svc/alertmanager 9093:9093
# Access: http://localhost:9093
```

## Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=info                    # trace, debug, info, warn, error, fatal
SERVICE_VERSION=1.0.0            # Service version for tracing

# Tracing
JAEGER_ENDPOINT=http://jaeger-collector:14268/api/traces
PROMETHEUS_PORT=9090             # Metrics export port

# Health Checks
HEALTH_CHECK_TIMEOUT=5000        # Health check timeout in ms
```

### Service Configuration

```typescript
// Initialize observability in each service
const { logger, healthService, middleware } = initializeObservability({
  serviceName: 'your-service-name',
  serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
});

// Add service-specific health checks
healthService.addCheck(commonHealthChecks.database(dbHealthCheck));
healthService.addCheck(commonHealthChecks.redis(redisHealthCheck));
healthService.addCheck(commonHealthChecks.kafka(kafkaHealthCheck));

// Apply middleware
app.use(...middleware);
app.use(errorHandlingMiddleware(logger));

// Add health endpoints
app.get('/health', healthService.healthHandler());
app.get('/health/live', healthService.livenessHandler());
app.get('/health/ready', healthService.readinessHandler());
```

## Monitoring Dashboards

### Grafana Dashboards

1. **OfficeFlow Platform Overview**
   - Request rate and error rate
   - Response time percentiles
   - Active workflows and execution rates
   - Memory and CPU usage

2. **Service-Specific Dashboards**
   - Individual service metrics
   - Database connection pools
   - Queue sizes and processing rates
   - Error breakdown by type

3. **Infrastructure Dashboards**
   - Kubernetes cluster metrics
   - Node resource utilization
   - Pod status and restarts
   - Network traffic

### Key Metrics to Monitor

- **Golden Signals**: Latency, Traffic, Errors, Saturation
- **Business Metrics**: Workflow success rate, processing time
- **Infrastructure**: CPU, Memory, Disk, Network
- **Application**: Queue depth, connection pools, cache hit rates

## Troubleshooting

### Common Issues

#### High Memory Usage

```bash
# Check memory metrics
kubectl top pods -n officeflow

# Review memory-related alerts
kubectl get prometheusrules -n officeflow

# Check application logs for memory leaks
kubectl logs -n officeflow deployment/workflow-engine --tail=100
```

#### Service Discovery Issues

```bash
# Check ServiceMonitor configuration
kubectl get servicemonitor -n officeflow -o yaml

# Verify service labels match ServiceMonitor selector
kubectl get svc -n officeflow --show-labels

# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Visit http://localhost:9090/targets
```

#### Missing Traces

```bash
# Check Jaeger collector logs
kubectl logs -n monitoring deployment/jaeger-collector

# Verify OpenTelemetry configuration
kubectl get configmap -n officeflow observability-config -o yaml

# Check application tracing initialization
kubectl logs -n officeflow deployment/workflow-engine | grep -i "tracing\|telemetry"
```

### Log Analysis

```bash
# Search logs by correlation ID
kubectl logs -n officeflow -l app=workflow-engine | grep "correlation-id-123"

# Filter error logs
kubectl logs -n officeflow -l app=workflow-engine | grep '"level":"ERROR"'

# Monitor real-time logs
kubectl logs -n officeflow -l app=workflow-engine -f
```

## Best Practices

### Logging

- Use structured logging with consistent field names
- Include correlation IDs in all log entries
- Log at appropriate levels (avoid debug in production)
- Include contextual information (user, organization, workflow IDs)
- Use log sampling for high-volume operations

### Metrics

- Follow Prometheus naming conventions
- Use labels judiciously (avoid high cardinality)
- Implement SLI/SLO monitoring
- Monitor both technical and business metrics
- Set up proper retention policies

### Tracing

- Trace critical user journeys end-to-end
- Add custom spans for important business operations
- Include relevant attributes in spans
- Use sampling to control overhead
- Correlate traces with logs and metrics

### Alerting

- Alert on symptoms, not causes
- Use appropriate thresholds and time windows
- Implement alert fatigue prevention
- Include runbook links in alert descriptions
- Test alert delivery regularly

## Security Considerations

### Access Control

- Use RBAC for Kubernetes resources
- Implement authentication for monitoring tools
- Restrict access to sensitive logs and metrics
- Use network policies to isolate monitoring components

### Data Privacy

- Avoid logging sensitive information (passwords, tokens)
- Implement log retention policies
- Use encryption for data in transit and at rest
- Comply with data protection regulations

### Monitoring Security

- Monitor for security events and anomalies
- Set up alerts for suspicious activities
- Implement audit logging for administrative actions
- Regular security reviews of monitoring infrastructure

## Performance Impact

### Resource Usage

- Observability overhead: ~5-10% CPU, ~10-15% memory
- Network overhead: ~1-2% for metrics and traces
- Storage requirements: ~100GB/month for medium workload

### Optimization

- Use appropriate sampling rates for tracing
- Implement metric aggregation and downsampling
- Configure log retention based on compliance needs
- Monitor observability infrastructure itself

## Support and Maintenance

### Regular Tasks

- Review and update alert thresholds
- Clean up old metrics and logs
- Update dashboards based on new requirements
- Test disaster recovery procedures
- Review and rotate credentials

### Monitoring the Monitors

- Set up alerts for monitoring infrastructure
- Monitor resource usage of observability components
- Implement backup and recovery procedures
- Document operational procedures

For additional support, refer to the [OfficeFlow Documentation](https://docs.officeflow.com) or contact the platform team.
