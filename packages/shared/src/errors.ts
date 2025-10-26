import { ErrorDetails } from '@officeflow/types';
import { ERROR_CODES, HTTP_STATUS } from './constants';

/**
 * Base error class for OfficeFlow platform
 */
export abstract class OfficeFlowError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly timestamp: Date;
  readonly details?: Record<string, any>;

  constructor(message: string, details?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toErrorDetails(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Validation error
 */
export class ValidationError extends OfficeFlowError {
  readonly code = ERROR_CODES.VALIDATION_ERROR;
  readonly statusCode = HTTP_STATUS.BAD_REQUEST;

  constructor(message: string, validationErrors?: string[]) {
    super(message, { validationErrors });
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends OfficeFlowError {
  readonly code = ERROR_CODES.UNAUTHORIZED;
  readonly statusCode = HTTP_STATUS.UNAUTHORIZED;
}

/**
 * Authorization error
 */
export class AuthorizationError extends OfficeFlowError {
  readonly code = ERROR_CODES.FORBIDDEN;
  readonly statusCode = HTTP_STATUS.FORBIDDEN;
}

/**
 * Resource not found error
 */
export class NotFoundError extends OfficeFlowError {
  readonly code = ERROR_CODES.RESOURCE_NOT_FOUND;
  readonly statusCode = HTTP_STATUS.NOT_FOUND;

  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, { resource, id });
  }
}

/**
 * Resource conflict error
 */
export class ConflictError extends OfficeFlowError {
  readonly code = ERROR_CODES.RESOURCE_CONFLICT;
  readonly statusCode = HTTP_STATUS.CONFLICT;

  constructor(resource: string, conflictReason?: string) {
    const message = conflictReason 
      ? `${resource} conflict: ${conflictReason}`
      : `${resource} already exists`;
    super(message, { resource, conflictReason });
  }
}

/**
 * Workflow execution error
 */
export class WorkflowExecutionError extends OfficeFlowError {
  readonly code = ERROR_CODES.WORKFLOW_EXECUTION_FAILED;
  readonly statusCode = HTTP_STATUS.UNPROCESSABLE_ENTITY;

  constructor(workflowId: string, runId: string, reason: string) {
    super(`Workflow execution failed: ${reason}`, { workflowId, runId, reason });
  }
}

/**
 * Node execution error
 */
export class NodeExecutionError extends OfficeFlowError {
  readonly code = ERROR_CODES.NODE_EXECUTION_FAILED;
  readonly statusCode = HTTP_STATUS.UNPROCESSABLE_ENTITY;

  constructor(nodeId: string, nodeType: string, reason: string) {
    super(`Node execution failed: ${reason}`, { nodeId, nodeType, reason });
  }
}

/**
 * External service error
 */
export class ExternalServiceError extends OfficeFlowError {
  readonly code = ERROR_CODES.EXTERNAL_SERVICE_ERROR;
  readonly statusCode = HTTP_STATUS.BAD_GATEWAY;

  constructor(service: string, operation: string, reason: string) {
    super(`External service error: ${service}.${operation} - ${reason}`, {
      service,
      operation,
      reason,
    });
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends OfficeFlowError {
  readonly code = ERROR_CODES.RATE_LIMIT_EXCEEDED;
  readonly statusCode = HTTP_STATUS.TOO_MANY_REQUESTS;

  constructor(limit: number, windowMs: number) {
    super(`Rate limit exceeded: ${limit} requests per ${windowMs}ms`, { limit, windowMs });
  }
}

/**
 * Database error
 */
export class DatabaseError extends OfficeFlowError {
  readonly code = ERROR_CODES.DATABASE_ERROR;
  readonly statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;

  constructor(operation: string, reason: string) {
    super(`Database error during ${operation}: ${reason}`, { operation, reason });
  }
}

/**
 * Redis error
 */
export class RedisError extends OfficeFlowError {
  readonly code = ERROR_CODES.REDIS_ERROR;
  readonly statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;

  constructor(operation: string, reason: string) {
    super(`Redis error during ${operation}: ${reason}`, { operation, reason });
  }
}

/**
 * Kafka error
 */
export class KafkaError extends OfficeFlowError {
  readonly code = ERROR_CODES.KAFKA_ERROR;
  readonly statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;

  constructor(operation: string, reason: string) {
    super(`Kafka error during ${operation}: ${reason}`, { operation, reason });
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof OfficeFlowError) {
    return [
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      ERROR_CODES.DATABASE_ERROR,
      ERROR_CODES.REDIS_ERROR,
      ERROR_CODES.KAFKA_ERROR,
    ].includes(error.code as any);
  }
  
  // Network errors are generally retryable
  return error.message.includes('ECONNRESET') ||
         error.message.includes('ETIMEDOUT') ||
         error.message.includes('ENOTFOUND');
}