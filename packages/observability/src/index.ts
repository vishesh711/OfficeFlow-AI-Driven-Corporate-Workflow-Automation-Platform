// Logger exports
export {
  Logger,
  LogContext,
  createLogger,
  generateCorrelationId,
  extractCorrelationId,
} from './logger';

// Tracing exports
export {
  TracingConfig,
  SpanContext,
  TracingService,
  tracingService,
  initializeTracing,
  shutdownTracing,
} from './tracing';

// Metrics exports
export {
  MetricLabels,
  MetricsService,
  metricsService,
} from './metrics';

// Middleware exports
export {
  ObservabilityRequest,
  correlationMiddleware,
  tracingMiddleware,
  metricsMiddleware,
  errorHandlingMiddleware,
  createObservabilityMiddleware,
} from './middleware';

// Health check exports
export {
  HealthCheck,
  HealthCheckResult,
  HealthStatus,
  HealthService,
  commonHealthChecks,
} from './health';

import { HealthService } from './health';

// Convenience function to initialize all observability features
export function initializeObservability(config: {
  serviceName: string;
  serviceVersion?: string;
  logLevel?: string;
  prettyLogs?: boolean;
  jaegerEndpoint?: string;
  prometheusPort?: number;
  environment?: string;
}) {
  // Initialize tracing first
  initializeTracing({
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
    jaegerEndpoint: config.jaegerEndpoint,
    prometheusPort: config.prometheusPort,
    environment: config.environment,
  });

  // Create logger
  const logger = createLogger(config.serviceName, {
    level: config.logLevel,
    pretty: config.prettyLogs,
  });

  // Create health service
  const healthService = new HealthService(
    config.serviceName,
    config.serviceVersion || '1.0.0',
    logger
  );

  logger.info('Observability initialized', {
    service: config.serviceName,
    version: config.serviceVersion || '1.0.0',
    environment: config.environment || process.env.NODE_ENV || 'development',
  });

  return {
    logger,
    healthService,
    middleware: createObservabilityMiddleware(config.serviceName, logger),
  };
}