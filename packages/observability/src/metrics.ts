import { metrics } from '@opentelemetry/api';

export interface MetricLabels {
  service?: string;
  operation?: string;
  status?: string;
  organizationId?: string;
  workflowId?: string;
  nodeType?: string;
  [key: string]: string | undefined;
}

export class MetricsService {
  private meter = metrics.getMeter('officeflow-platform');

  // Counters
  private requestCounter = this.meter.createCounter('officeflow_requests_total', {
    description: 'Total number of requests processed',
  });

  private workflowExecutionCounter = this.meter.createCounter(
    'officeflow_workflow_executions_total',
    {
      description: 'Total number of workflow executions',
    }
  );

  private nodeExecutionCounter = this.meter.createCounter('officeflow_node_executions_total', {
    description: 'Total number of node executions',
  });

  private errorCounter = this.meter.createCounter('officeflow_errors_total', {
    description: 'Total number of errors',
  });

  // Histograms
  private requestDuration = this.meter.createHistogram('officeflow_request_duration_seconds', {
    description: 'Request duration in seconds',
    boundaries: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  });

  private workflowDuration = this.meter.createHistogram('officeflow_workflow_duration_seconds', {
    description: 'Workflow execution duration in seconds',
    boundaries: [1, 5, 10, 30, 60, 300, 600, 1800, 3600],
  });

  private nodeDuration = this.meter.createHistogram('officeflow_node_duration_seconds', {
    description: 'Node execution duration in seconds',
    boundaries: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  });

  // Gauges
  private activeWorkflows = this.meter.createUpDownCounter('officeflow_active_workflows', {
    description: 'Number of currently active workflows',
  });

  private queueSize = this.meter.createUpDownCounter('officeflow_queue_size', {
    description: 'Number of items in processing queues',
  });

  // Request metrics
  incrementRequests(labels: MetricLabels = {}): void {
    this.requestCounter.add(1, this.sanitizeLabels(labels));
  }

  recordRequestDuration(duration: number, labels: MetricLabels = {}): void {
    this.requestDuration.record(duration, this.sanitizeLabels(labels));
  }

  // Workflow metrics
  incrementWorkflowExecutions(labels: MetricLabels = {}): void {
    this.workflowExecutionCounter.add(1, this.sanitizeLabels(labels));
  }

  recordWorkflowDuration(duration: number, labels: MetricLabels = {}): void {
    this.workflowDuration.record(duration, this.sanitizeLabels(labels));
  }

  incrementActiveWorkflows(delta: number = 1, labels: MetricLabels = {}): void {
    this.activeWorkflows.add(delta, this.sanitizeLabels(labels));
  }

  decrementActiveWorkflows(delta: number = 1, labels: MetricLabels = {}): void {
    this.activeWorkflows.add(-delta, this.sanitizeLabels(labels));
  }

  // Node metrics
  incrementNodeExecutions(labels: MetricLabels = {}): void {
    this.nodeExecutionCounter.add(1, this.sanitizeLabels(labels));
  }

  recordNodeDuration(duration: number, labels: MetricLabels = {}): void {
    this.nodeDuration.record(duration, this.sanitizeLabels(labels));
  }

  // Error metrics
  incrementErrors(labels: MetricLabels = {}): void {
    this.errorCounter.add(1, this.sanitizeLabels(labels));
  }

  // Queue metrics
  setQueueSize(size: number, labels: MetricLabels = {}): void {
    // Reset and set new value
    this.queueSize.add(-this.queueSize as any, this.sanitizeLabels(labels));
    this.queueSize.add(size, this.sanitizeLabels(labels));
  }

  // Utility methods
  createTimer(): () => number {
    const start = Date.now();
    return () => (Date.now() - start) / 1000;
  }

  private sanitizeLabels(labels: MetricLabels): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(labels)) {
      if (value !== undefined && value !== null) {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }
}

export const metricsService = new MetricsService();
