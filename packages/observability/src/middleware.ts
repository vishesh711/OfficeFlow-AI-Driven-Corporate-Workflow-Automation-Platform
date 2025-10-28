import { Request, Response, NextFunction } from 'express';
import { generateCorrelationId, extractCorrelationId, Logger } from './logger';
import { tracingService, SpanContext } from './tracing';
import { metricsService } from './metrics';
import { SpanKind } from '@opentelemetry/api';

export interface ObservabilityRequest extends Request {
  correlationId: string;
  logger: Logger;
  startTime: number;
}

export function correlationMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const observabilityReq = req as ObservabilityRequest;

    // Extract or generate correlation ID
    const correlationId = extractCorrelationId(req.headers) || generateCorrelationId();
    observabilityReq.correlationId = correlationId;
    observabilityReq.startTime = Date.now();

    // Set correlation ID in response headers
    res.setHeader('X-Correlation-ID', correlationId);

    // Create child logger with correlation context
    observabilityReq.logger = logger.child({
      correlationId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    // Log incoming request
    observabilityReq.logger.info('Incoming request', {
      method: req.method,
      url: req.url,
      headers: req.headers,
    });

    next();
  };
}

export function tracingMiddleware(serviceName: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const observabilityReq = req as ObservabilityRequest;
    const spanName = `${req.method} ${req.route?.path || req.path}`;

    const spanContext: SpanContext = {
      correlationId: observabilityReq.correlationId,
      operation: `${req.method} ${req.path}`,
      service: serviceName,
      'http.method': req.method,
      'http.url': req.url,
      'http.user_agent': req.get('User-Agent') || '',
      'http.remote_addr': req.ip,
    };

    try {
      await tracingService.executeWithSpan(
        spanName,
        async () => {
          return new Promise<void>((resolve, reject) => {
            res.on('finish', () => {
              tracingService.addSpanAttributes({
                'http.status_code': res.statusCode,
                'http.response_size': res.get('Content-Length') || '0',
              });
              resolve();
            });

            res.on('error', (error) => {
              tracingService.recordException(error);
              reject(error);
            });

            next();
          });
        },
        spanContext,
        SpanKind.SERVER
      );
    } catch (error) {
      next(error);
    }
  };
}

export function metricsMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const observabilityReq = req as ObservabilityRequest;
    const timer = metricsService.createTimer();

    // Increment request counter
    metricsService.incrementRequests({
      service: serviceName,
      method: req.method,
      route: req.route?.path || req.path,
    });

    res.on('finish', () => {
      const duration = timer();
      const status = res.statusCode >= 400 ? 'error' : 'success';

      // Record request duration
      metricsService.recordRequestDuration(duration, {
        service: serviceName,
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode.toString(),
        status,
      });

      // Log response
      observabilityReq.logger.info('Request completed', {
        statusCode: res.statusCode,
        duration,
        responseSize: res.get('Content-Length'),
      });

      // Increment error counter if needed
      if (res.statusCode >= 400) {
        metricsService.incrementErrors({
          service: serviceName,
          method: req.method,
          route: req.route?.path || req.path,
          status_code: res.statusCode.toString(),
        });
      }
    });

    next();
  };
}

export function errorHandlingMiddleware(logger: Logger) {
  return (error: Error, req: Request, res: Response, next: NextFunction): void => {
    const observabilityReq = req as ObservabilityRequest;
    const requestLogger = observabilityReq.logger || logger;

    // Log error with full context
    requestLogger.error('Request error', error, {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      stack: error.stack,
    });

    // Record exception in tracing
    tracingService.recordException(error);

    // Increment error metrics
    metricsService.incrementErrors({
      service: 'unknown',
      method: req.method,
      route: req.route?.path || req.path,
      error_type: error.name,
    });

    // Send error response if not already sent
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        correlationId: observabilityReq.correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    next(error);
  };
}

export function createObservabilityMiddleware(serviceName: string, logger: Logger) {
  return [
    correlationMiddleware(logger),
    tracingMiddleware(serviceName),
    metricsMiddleware(serviceName),
  ];
}
