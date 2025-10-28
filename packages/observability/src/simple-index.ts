// Simple logger exports
export {
  Logger,
  LogContext,
  createSimpleLogger as createLogger,
  generateCorrelationId,
  extractCorrelationId,
} from './simple-logger';

// Simple health check exports
export {
  HealthCheck,
  HealthCheckResult,
  HealthStatus,
  SimpleHealthService as HealthService,
  commonHealthChecks,
} from './simple-health';

// Simple middleware exports
export {
  ObservabilityRequest,
  correlationMiddleware,
  metricsMiddleware,
  errorHandlingMiddleware,
  createObservabilityMiddleware,
} from './simple-middleware';

import { SimpleHealthService } from './simple-health';
import { createSimpleLogger } from './simple-logger';
import { createObservabilityMiddleware } from './simple-middleware';

// Convenience function to initialize basic observability features
export function initializeObservability(config: {
  serviceName: string;
  serviceVersion?: string;
  logLevel?: string;
}) {
  // Create logger
  const logger = createSimpleLogger(config.serviceName, {
    level: config.logLevel,
  });

  // Create health service
  const healthService = new SimpleHealthService(
    config.serviceName,
    config.serviceVersion || '1.0.0',
    logger
  );

  logger.info('Basic observability initialized', {
    service: config.serviceName,
    version: config.serviceVersion || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });

  return {
    logger,
    healthService,
    middleware: createObservabilityMiddleware(config.serviceName, logger),
  };
}
