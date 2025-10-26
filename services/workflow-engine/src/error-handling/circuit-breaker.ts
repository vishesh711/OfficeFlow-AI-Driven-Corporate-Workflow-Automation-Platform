/**
 * Circuit breaker pattern for external service calls
 */

import { RedisStateManager } from '../state/redis-state-manager';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  minimumThroughput: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  failureRate: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

export class CircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private readonly serviceName: string;
  private readonly redisKey: string;

  constructor(
    serviceName: string,
    config: Partial<CircuitBreakerConfig> = {},
    private stateManager: RedisStateManager
  ) {
    this.serviceName = serviceName;
    this.redisKey = `circuit_breaker:${serviceName}`;
    this.config = {
      failureThreshold: 5, // Open circuit after 5 failures
      recoveryTimeout: 60000, // 1 minute recovery timeout
      monitoringPeriod: 300000, // 5 minute monitoring window
      minimumThroughput: 10, // Minimum requests before considering failure rate
      ...config,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const stats = await this.getStats();

    // Check if circuit is open
    if (stats.state === 'OPEN') {
      if (this.shouldAttemptReset(stats)) {
        await this.transitionToHalfOpen();
      } else {
        throw new CircuitBreakerOpenError(
          this.serviceName,
          stats.nextRetryTime || new Date(Date.now() + this.config.recoveryTimeout)
        );
      }
    }

    try {
      // Execute the operation
      const result = await operation();
      
      // Record success
      await this.recordSuccess();
      
      // If we were in HALF_OPEN state, transition to CLOSED
      if (stats.state === 'HALF_OPEN') {
        await this.transitionToClosed();
      }

      return result;

    } catch (error) {
      // Record failure
      await this.recordFailure();

      // Check if we should open the circuit
      const updatedStats = await this.getStats();
      if (this.shouldOpenCircuit(updatedStats)) {
        await this.transitionToOpen();
      }

      throw error;
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  async getStats(): Promise<CircuitBreakerStats> {
    try {
      const data = await this.stateManager.getCircuitBreakerStats(this.serviceName);
      
      if (!data) {
        return this.getDefaultStats();
      }

      const failureRate = data.totalRequests > 0 
        ? (data.failureCount / data.totalRequests) * 100 
        : 0;

      return {
        state: data.state || 'CLOSED',
        failureCount: data.failureCount || 0,
        successCount: data.successCount || 0,
        totalRequests: data.totalRequests || 0,
        failureRate,
        lastFailureTime: data.lastFailureTime ? new Date(data.lastFailureTime) : undefined,
        nextRetryTime: data.nextRetryTime ? new Date(data.nextRetryTime) : undefined,
      };
    } catch (error) {
      console.error(`Failed to get circuit breaker stats for ${this.serviceName}:`, error);
      return this.getDefaultStats();
    }
  }

  /**
   * Manually open the circuit breaker
   */
  async open(): Promise<void> {
    await this.transitionToOpen();
  }

  /**
   * Manually close the circuit breaker
   */
  async close(): Promise<void> {
    await this.transitionToClosed();
  }

  /**
   * Reset circuit breaker statistics
   */
  async reset(): Promise<void> {
    await this.stateManager.resetCircuitBreakerStats(this.serviceName);
    console.log(`Circuit breaker reset for service: ${this.serviceName}`);
  }

  /**
   * Record a successful operation
   */
  private async recordSuccess(): Promise<void> {
    const now = Date.now();
    await this.stateManager.recordCircuitBreakerSuccess(this.serviceName, now);
  }

  /**
   * Record a failed operation
   */
  private async recordFailure(): Promise<void> {
    const now = Date.now();
    await this.stateManager.recordCircuitBreakerFailure(this.serviceName, now);
  }

  /**
   * Check if circuit should be opened
   */
  private shouldOpenCircuit(stats: CircuitBreakerStats): boolean {
    // Don't open if we don't have enough throughput
    if (stats.totalRequests < this.config.minimumThroughput) {
      return false;
    }

    // Open if failure count exceeds threshold
    if (stats.failureCount >= this.config.failureThreshold) {
      return true;
    }

    // Open if failure rate is too high (above 50%)
    if (stats.failureRate > 50) {
      return true;
    }

    return false;
  }

  /**
   * Check if we should attempt to reset from OPEN to HALF_OPEN
   */
  private shouldAttemptReset(stats: CircuitBreakerStats): boolean {
    if (!stats.nextRetryTime) {
      return true;
    }
    return Date.now() >= stats.nextRetryTime.getTime();
  }

  /**
   * Transition circuit to OPEN state
   */
  private async transitionToOpen(): Promise<void> {
    const nextRetryTime = Date.now() + this.config.recoveryTimeout;
    await this.stateManager.setCircuitBreakerState(
      this.serviceName,
      'OPEN',
      nextRetryTime
    );
    
    console.warn(`Circuit breaker OPENED for service: ${this.serviceName}, next retry at: ${new Date(nextRetryTime).toISOString()}`);
  }

  /**
   * Transition circuit to HALF_OPEN state
   */
  private async transitionToHalfOpen(): Promise<void> {
    await this.stateManager.setCircuitBreakerState(this.serviceName, 'HALF_OPEN');
    console.log(`Circuit breaker HALF_OPEN for service: ${this.serviceName}`);
  }

  /**
   * Transition circuit to CLOSED state
   */
  private async transitionToClosed(): Promise<void> {
    await this.stateManager.setCircuitBreakerState(this.serviceName, 'CLOSED');
    // Reset failure count when closing
    await this.stateManager.resetCircuitBreakerFailures(this.serviceName);
    console.log(`Circuit breaker CLOSED for service: ${this.serviceName}`);
  }

  /**
   * Get default statistics
   */
  private getDefaultStats(): CircuitBreakerStats {
    return {
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      totalRequests: 0,
      failureRate: 0,
    };
  }
}

/**
 * Circuit breaker open error
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly serviceName: string,
    public readonly nextRetryTime: Date
  ) {
    super(`Circuit breaker is OPEN for service: ${serviceName}. Next retry at: ${nextRetryTime.toISOString()}`);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Circuit breaker manager for multiple services
 */
export class CircuitBreakerManager {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(private stateManager: RedisStateManager) {}

  /**
   * Get or create circuit breaker for a service
   */
  getCircuitBreaker(
    serviceName: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      const circuitBreaker = new CircuitBreaker(serviceName, config, this.stateManager);
      this.circuitBreakers.set(serviceName, circuitBreaker);
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(serviceName, config);
    return circuitBreaker.execute(operation);
  }

  /**
   * Get statistics for all circuit breakers
   */
  async getAllStats(): Promise<Record<string, CircuitBreakerStats>> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
      try {
        stats[serviceName] = await circuitBreaker.getStats();
      } catch (error) {
        console.error(`Failed to get stats for circuit breaker ${serviceName}:`, error);
      }
    }

    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  async resetAll(): Promise<void> {
    const resetPromises = Array.from(this.circuitBreakers.values()).map(cb => cb.reset());
    await Promise.all(resetPromises);
  }
}