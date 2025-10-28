import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

export interface LogContext {
  correlationId?: string;
  organizationId?: string;
  employeeId?: string;
  workflowId?: string;
  runId?: string;
  nodeId?: string;
  userId?: string;
  service?: string;
  operation?: string;
  [key: string]: any;
}

export interface Logger {
  trace(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  fatal(message: string, error?: Error, context?: LogContext): void;
  child(context: LogContext): Logger;
}

class PinoLogger implements Logger {
  private pino: pino.Logger;

  constructor(pinoInstance: pino.Logger) {
    this.pino = pinoInstance;
  }

  trace(message: string, context?: LogContext): void {
    this.pino.trace(context, message);
  }

  debug(message: string, context?: LogContext): void {
    this.pino.debug(context, message);
  }

  info(message: string, context?: LogContext): void {
    this.pino.info(context, message);
  }

  warn(message: string, context?: LogContext): void {
    this.pino.warn(context, message);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const logContext = {
      ...context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };
    this.pino.error(logContext, message);
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    const logContext = {
      ...context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };
    this.pino.fatal(logContext, message);
  }

  child(context: LogContext): Logger {
    return new PinoLogger(this.pino.child(context));
  }
}

export function createLogger(
  serviceName: string,
  options?: {
    level?: string;
    pretty?: boolean;
  }
): Logger {
  const pinoOptions: pino.LoggerOptions = {
    name: serviceName,
    level: options?.level || process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      service: serviceName,
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      hostname: process.env.HOSTNAME || require('os').hostname(),
    },
  };

  if (options?.pretty && process.env.NODE_ENV === 'development') {
    pinoOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  const pinoInstance = pino(pinoOptions);
  return new PinoLogger(pinoInstance);
}

export function generateCorrelationId(): string {
  return uuidv4();
}

export function extractCorrelationId(
  headers: Record<string, string | string[] | undefined>
): string | undefined {
  const correlationId = headers['x-correlation-id'] || headers['X-Correlation-ID'];
  return Array.isArray(correlationId) ? correlationId[0] : correlationId;
}
