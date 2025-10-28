import { v4 as uuidv4 } from 'uuid';
import { UUID } from '@officeflow/types';

/**
 * Generate a new UUID
 */
export function generateId(): UUID {
  return uuidv4();
}

/**
 * Generate a correlation ID for tracing
 */
export function generateCorrelationId(): string {
  return `corr_${uuidv4()}`;
}

/**
 * Generate an idempotency key
 */
export function generateIdempotencyKey(prefix?: string): string {
  const key = uuidv4();
  return prefix ? `${prefix}_${key}` : key;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    jitter: boolean;
  }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === options.maxRetries) {
        break;
      }

      const delay = Math.min(
        options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt),
        options.maxDelayMs
      );

      const jitteredDelay = options.jitter ? delay + Math.random() * delay * 0.1 : delay;

      await sleep(jitteredDelay);
    }
  }

  throw lastError!;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  return false;
}

/**
 * Sanitize string for use in identifiers
 */
export function sanitizeIdentifier(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/**
 * Parse cron expression to get next execution time
 */
export function getNextCronExecution(cronExpression: string, fromDate: Date = new Date()): Date {
  // This is a simplified implementation - in production, use a proper cron parser library
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) {
    throw new Error('Invalid cron expression format');
  }

  // For now, return next hour as placeholder
  const nextExecution = new Date(fromDate);
  nextExecution.setHours(nextExecution.getHours() + 1);
  nextExecution.setMinutes(0);
  nextExecution.setSeconds(0);
  nextExecution.setMilliseconds(0);

  return nextExecution;
}
