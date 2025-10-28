import { v4 as uuidv4 } from 'uuid';

export interface CorrelationContext {
  correlationId: string;
  parentId?: string;
  traceId: string;
  spanId: string;
  organizationId?: string;
  employeeId?: string;
  workflowRunId?: string;
  nodeRunId?: string;
}

export interface TraceEvent {
  timestamp: Date;
  service: string;
  operation: string;
  status: 'started' | 'completed' | 'failed';
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * Correlation ID tracker for distributed tracing across Kafka messages
 */
export class CorrelationTracker {
  private static instance: CorrelationTracker;
  private contextStore: Map<string, CorrelationContext> = new Map();
  private traceEvents: Map<string, TraceEvent[]> = new Map();

  static getInstance(): CorrelationTracker {
    if (!CorrelationTracker.instance) {
      CorrelationTracker.instance = new CorrelationTracker();
    }
    return CorrelationTracker.instance;
  }

  /**
   * Create a new correlation context
   */
  createContext(
    options: {
      parentId?: string;
      organizationId?: string;
      employeeId?: string;
      workflowRunId?: string;
      nodeRunId?: string;
    } = {}
  ): CorrelationContext {
    const correlationId = uuidv4();
    const traceId = options.parentId ? this.getTraceId(options.parentId) : uuidv4();
    const spanId = uuidv4();

    const context: CorrelationContext = {
      correlationId,
      parentId: options.parentId,
      traceId,
      spanId,
      organizationId: options.organizationId,
      employeeId: options.employeeId,
      workflowRunId: options.workflowRunId,
      nodeRunId: options.nodeRunId,
    };

    this.contextStore.set(correlationId, context);
    return context;
  }

  /**
   * Get correlation context by ID
   */
  getContext(correlationId: string): CorrelationContext | undefined {
    return this.contextStore.get(correlationId);
  }

  /**
   * Update correlation context
   */
  updateContext(correlationId: string, updates: Partial<CorrelationContext>): void {
    const existing = this.contextStore.get(correlationId);
    if (existing) {
      this.contextStore.set(correlationId, { ...existing, ...updates });
    }
  }

  /**
   * Create child context for nested operations
   */
  createChildContext(
    parentCorrelationId: string,
    options: {
      organizationId?: string;
      employeeId?: string;
      workflowRunId?: string;
      nodeRunId?: string;
    } = {}
  ): CorrelationContext {
    const parentContext = this.getContext(parentCorrelationId);

    return this.createContext({
      parentId: parentCorrelationId,
      organizationId: options.organizationId || parentContext?.organizationId,
      employeeId: options.employeeId || parentContext?.employeeId,
      workflowRunId: options.workflowRunId || parentContext?.workflowRunId,
      nodeRunId: options.nodeRunId || parentContext?.nodeRunId,
    });
  }

  /**
   * Record a trace event
   */
  recordEvent(
    correlationId: string,
    service: string,
    operation: string,
    status: 'started' | 'completed' | 'failed',
    metadata?: Record<string, any>
  ): void {
    const context = this.getContext(correlationId);
    if (!context) {
      console.warn(`No context found for correlation ID: ${correlationId}`);
      return;
    }

    const event: TraceEvent = {
      timestamp: new Date(),
      service,
      operation,
      status,
      metadata,
    };

    // Calculate duration for completed/failed events
    if (status !== 'started') {
      const events = this.traceEvents.get(correlationId) || [];
      const startEvent = events
        .reverse()
        .find((e) => e.service === service && e.operation === operation && e.status === 'started');

      if (startEvent) {
        event.duration = event.timestamp.getTime() - startEvent.timestamp.getTime();
      }
    }

    const existingEvents = this.traceEvents.get(correlationId) || [];
    existingEvents.push(event);
    this.traceEvents.set(correlationId, existingEvents);
  }

  /**
   * Get trace events for a correlation ID
   */
  getTraceEvents(correlationId: string): TraceEvent[] {
    return this.traceEvents.get(correlationId) || [];
  }

  /**
   * Get full trace including parent and child contexts
   */
  getFullTrace(correlationId: string): {
    context: CorrelationContext;
    events: TraceEvent[];
    children: Array<{ context: CorrelationContext; events: TraceEvent[] }>;
  } | null {
    const context = this.getContext(correlationId);
    if (!context) {
      return null;
    }

    const events = this.getTraceEvents(correlationId);

    // Find child contexts
    const children: Array<{ context: CorrelationContext; events: TraceEvent[] }> = [];
    for (const [childId, childContext] of this.contextStore.entries()) {
      if (childContext.parentId === correlationId) {
        children.push({
          context: childContext,
          events: this.getTraceEvents(childId),
        });
      }
    }

    return { context, events, children };
  }

  /**
   * Clean up old contexts and events (call periodically)
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    // Default: 24 hours
    const cutoffTime = Date.now() - maxAgeMs;

    // Clean up contexts
    for (const [correlationId, context] of this.contextStore.entries()) {
      const events = this.traceEvents.get(correlationId);
      if (events && events.length > 0) {
        const lastEventTime = Math.max(...events.map((e) => e.timestamp.getTime()));
        if (lastEventTime < cutoffTime) {
          this.contextStore.delete(correlationId);
          this.traceEvents.delete(correlationId);
        }
      }
    }
  }

  /**
   * Export trace data for external systems (e.g., Jaeger, Zipkin)
   */
  exportTrace(correlationId: string): any {
    const trace = this.getFullTrace(correlationId);
    if (!trace) {
      return null;
    }

    // Convert to OpenTelemetry-compatible format
    return {
      traceId: trace.context.traceId,
      spans: [
        {
          spanId: trace.context.spanId,
          parentSpanId: trace.context.parentId,
          operationName: 'kafka-message-flow',
          startTime: trace.events[0]?.timestamp,
          finishTime: trace.events[trace.events.length - 1]?.timestamp,
          tags: {
            'correlation.id': correlationId,
            'organization.id': trace.context.organizationId,
            'employee.id': trace.context.employeeId,
            'workflow.run.id': trace.context.workflowRunId,
            'node.run.id': trace.context.nodeRunId,
          },
          logs: trace.events.map((event) => ({
            timestamp: event.timestamp,
            fields: {
              level: event.status === 'failed' ? 'error' : 'info',
              service: event.service,
              operation: event.operation,
              status: event.status,
              ...event.metadata,
            },
          })),
        },
        // Add child spans
        ...trace.children.map((child) => ({
          spanId: child.context.spanId,
          parentSpanId: trace.context.spanId,
          operationName: 'child-operation',
          startTime: child.events[0]?.timestamp,
          finishTime: child.events[child.events.length - 1]?.timestamp,
          tags: {
            'correlation.id': child.context.correlationId,
            'organization.id': child.context.organizationId,
            'employee.id': child.context.employeeId,
            'workflow.run.id': child.context.workflowRunId,
            'node.run.id': child.context.nodeRunId,
          },
          logs: child.events.map((event) => ({
            timestamp: event.timestamp,
            fields: {
              level: event.status === 'failed' ? 'error' : 'info',
              service: event.service,
              operation: event.operation,
              status: event.status,
              ...event.metadata,
            },
          })),
        })),
      ],
    };
  }

  private getTraceId(correlationId: string): string {
    const context = this.getContext(correlationId);
    return context?.traceId || uuidv4();
  }
}
