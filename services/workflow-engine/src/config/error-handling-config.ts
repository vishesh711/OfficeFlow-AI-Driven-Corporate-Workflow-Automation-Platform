/**
 * Default error handling configuration
 */

import { ErrorHandlingConfig } from '../error-handling';

export const DEFAULT_ERROR_HANDLING_CONFIG: ErrorHandlingConfig = {
  enableRetry: true,
  enableCircuitBreaker: true,
  enableCompensation: true,
  enableAlerting: true,
  maxRetryAttempts: 3,
  circuitBreakerThreshold: 5,
  alertCooldownMs: 300000, // 5 minutes
};

export const PRODUCTION_ERROR_HANDLING_CONFIG: ErrorHandlingConfig = {
  enableRetry: true,
  enableCircuitBreaker: true,
  enableCompensation: true,
  enableAlerting: true,
  maxRetryAttempts: 5,
  circuitBreakerThreshold: 10,
  alertCooldownMs: 600000, // 10 minutes
};

export const DEVELOPMENT_ERROR_HANDLING_CONFIG: ErrorHandlingConfig = {
  enableRetry: true,
  enableCircuitBreaker: false, // Disabled for easier debugging
  enableCompensation: false, // Disabled for easier debugging
  enableAlerting: false, // Disabled to reduce noise
  maxRetryAttempts: 2,
  circuitBreakerThreshold: 3,
  alertCooldownMs: 60000, // 1 minute
};

export function getErrorHandlingConfig(environment: string = 'development'): ErrorHandlingConfig {
  switch (environment.toLowerCase()) {
    case 'production':
      return PRODUCTION_ERROR_HANDLING_CONFIG;
    case 'development':
    case 'dev':
      return DEVELOPMENT_ERROR_HANDLING_CONFIG;
    default:
      return DEFAULT_ERROR_HANDLING_CONFIG;
  }
}