import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

export interface TracingConfig {
  serviceName: string;
  serviceVersion?: string;
  jaegerEndpoint?: string;
  prometheusPort?: number;
  environment?: string;
}

export interface SpanContext {
  correlationId?: string;
  organizationId?: string;
  employeeId?: string;
  workflowId?: string;
  runId?: string;
  nodeId?: string;
  userId?: string;
  operation?: string;
  [key: string]: any;
}

let sdk: NodeSDK | null = null;

export function initializeTracing(config: TracingConfig): void {
  if (sdk) {
    console.warn('Tracing already initialized');
    return;
  }

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
      config.environment || process.env.NODE_ENV || 'development',
  });

  const traceExporter = new JaegerExporter({
    endpoint:
      config.jaegerEndpoint || process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  });

  const metricsExporter = new PrometheusExporter({
    port: config.prometheusPort || parseInt(process.env.PROMETHEUS_PORT || '9090'),
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: metricsExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable file system instrumentation to reduce noise
        },
      }),
    ],
  });

  sdk.start();
  console.log(`Tracing initialized for service: ${config.serviceName}`);
}

export function shutdownTracing(): Promise<void> {
  if (!sdk) {
    return Promise.resolve();
  }
  return sdk.shutdown();
}

export class TracingService {
  private tracer = trace.getTracer('officeflow-platform');

  async executeWithSpan<T>(
    name: string,
    operation: () => Promise<T>,
    spanContext?: SpanContext,
    kind: SpanKind = SpanKind.INTERNAL
  ): Promise<T> {
    const span = this.tracer.startSpan(name, {
      kind,
      attributes: spanContext ? this.flattenAttributes(spanContext) : {},
    });

    try {
      const result = await context.with(trace.setSpan(context.active(), span), operation);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof Error) {
        span.recordException(error);
      }

      throw error;
    } finally {
      span.end();
    }
  }

  executeWithSpanSync<T>(
    name: string,
    operation: () => T,
    spanContext?: SpanContext,
    kind: SpanKind = SpanKind.INTERNAL
  ): T {
    const span = this.tracer.startSpan(name, {
      kind,
      attributes: spanContext ? this.flattenAttributes(spanContext) : {},
    });

    try {
      const result = context.with(trace.setSpan(context.active(), span), operation);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof Error) {
        span.recordException(error);
      }

      throw error;
    } finally {
      span.end();
    }
  }

  addSpanAttributes(attributes: SpanContext): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes(this.flattenAttributes(attributes));
    }
  }

  recordException(error: Error): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
    }
  }

  private flattenAttributes(obj: SpanContext): Record<string, string | number | boolean> {
    const flattened: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          flattened[key] = value;
        } else {
          flattened[key] = JSON.stringify(value);
        }
      }
    }

    return flattened;
  }
}

export const tracingService = new TracingService();
