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

class SimpleLogger implements Logger {
  private serviceName: string;
  private level: string;
  private context: LogContext;

  constructor(serviceName: string, level: string = 'info', context: LogContext = {}) {
    this.serviceName = serviceName;
    this.level = level;
    this.context = context;
  }

  private shouldLog(level: string): boolean {
    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private log(level: string, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      service: this.serviceName,
      message,
      ...this.context,
      ...context,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    const output = JSON.stringify(logEntry);
    
    if (level === 'error' || level === 'fatal') {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  trace(message: string, context?: LogContext): void {
    this.log('trace', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log('error', message, context, error);
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    this.log('fatal', message, context, error);
  }

  child(context: LogContext): Logger {
    return new SimpleLogger(this.serviceName, this.level, { ...this.context, ...context });
  }
}

export function createSimpleLogger(serviceName: string, options?: {
  level?: string;
}): Logger {
  return new SimpleLogger(serviceName, options?.level || process.env.LOG_LEVEL || 'info');
}

export function generateCorrelationId(): string {
  return uuidv4();
}

export function extractCorrelationId(headers: Record<string, string | string[] | undefined>): string | undefined {
  const correlationId = headers['x-correlation-id'] || headers['X-Correlation-ID'];
  return Array.isArray(correlationId) ? correlationId[0] : correlationId;
}