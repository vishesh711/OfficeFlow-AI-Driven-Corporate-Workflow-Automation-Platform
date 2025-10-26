import { Request, Response, NextFunction } from 'express';
import { generateCorrelationId, extractCorrelationId, Logger } from './simple-logger';

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

export function metricsMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const observabilityReq = req as ObservabilityRequest;
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000;
      const status = res.statusCode >= 400 ? 'error' : 'success';
      
      // Log response
      observabilityReq.logger.info('Request completed', {
        statusCode: res.statusCode,
        duration,
        responseSize: res.get('Content-Length'),
        service: serviceName,
        method: req.method,
        route: req.route?.path || req.path,
        status,
      });
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
    metricsMiddleware(serviceName),
  ];
}