/**
 * Exponential backoff retry mechanism with jitter
 */

import { UUID } from '@officeflow/types';
import { RedisStateManager } from '../state/redis-state-manager';
import { NodeState } from '../types/workflow-state';

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  jitter: boolean;
}

export interface RetryContext {
  runId: UUID;
  nodeId: UUID;
  attempt: number;
  lastError: any;
  retryPolicy: RetryPolicy;
  nodeType: string;
}

export class RetryManager {
  constructor(private stateManager: RedisStateManager) {}

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  calculateRetryDelay(policy: RetryPolicy, attempt: number): number {
    const baseDelay = policy.backoffMs;
    const multiplier = policy.backoffMultiplier;
    const maxDelay = policy.maxBackoffMs;
    
    // Calculate exponential backoff
    let delay = baseDelay * Math.pow(multiplier, attempt - 1);
    
    // Apply maximum delay cap
    delay = Math.min(delay, maxDelay);
    
    // Add jitter to prevent thundering herd
    if (policy.jitter) {
      const jitterRange = delay * 0.1; // 10% jitter
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay = Math.max(0, delay + jitter);
    }
    
    return Math.floor(delay);
  }

  /**
   * Determine if retry should be attempted
   */
  shouldRetry(context: RetryContext, error: any): boolean {
    // Check if we've exceeded max retries
    if (context.attempt >= context.retryPolicy.maxRetries) {
      return false;
    }

    // Check if error is retryable
    return this.isRetryableError(error);
  }

  /**
   * Check if error is retryable based on error type and characteristics
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;

    // Network and timeout errors are retryable
    const retryablePatterns = [
      /ECONNRESET/,
      /ETIMEDOUT/,
      /ENOTFOUND/,
      /ECONNREFUSED/,
      /socket hang up/i,
      /network timeout/i,
      /service unavailable/i,
      /internal server error/i,
      /bad gateway/i,
      /gateway timeout/i,
    ];

    const errorMessage = error.message || error.toString();
    if (retryablePatterns.some(pattern => pattern.test(errorMessage))) {
      return true;
    }

    // HTTP status codes that are retryable
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    if (error.statusCode && retryableStatusCodes.includes(error.statusCode)) {
      return true;
    }

    // Specific error codes that are retryable
    const retryableErrorCodes = [
      'EXTERNAL_SERVICE_ERROR',
      'DATABASE_ERROR',
      'REDIS_ERROR',
      'KAFKA_ERROR',
      'RATE_LIMIT_EXCEEDED',
    ];

    if (error.code && retryableErrorCodes.includes(error.code)) {
      return true;
    }

    return false;
  }

  /**
   * Schedule a retry for a failed node
   */
  async scheduleRetry(context: RetryContext): Promise<Date> {
    const retryDelay = this.calculateRetryDelay(context.retryPolicy, context.attempt);
    const retryAt = new Date(Date.now() + retryDelay);

    // Update node state to RETRYING
    const nodeState: NodeState = {
      nodeId: context.nodeId,
      runId: context.runId,
      status: 'RETRYING',
      attempt: context.attempt + 1,
      nextRetryAt: retryAt,
      errorDetails: {
        lastError: context.lastError,
        retryCount: context.attempt,
        nextRetryAt: retryAt,
      },
    };

    await this.stateManager.setNodeState(nodeState);
    await this.stateManager.scheduleRetry(context.runId, context.nodeId, retryAt);

    console.log(`Retry scheduled for node ${context.nodeId}:`, {
      runId: context.runId,
      attempt: context.attempt + 1,
      retryAt: retryAt.toISOString(),
      delayMs: retryDelay,
      nodeType: context.nodeType,
    });

    return retryAt;
  }

  /**
   * Get default retry policy with overrides
   */
  getRetryPolicy(overrides?: Partial<RetryPolicy>): RetryPolicy {
    const DEFAULT_RETRY_POLICY = {
      maxRetries: 3,
      backoffMs: 1000,
      backoffMultiplier: 2,
      maxBackoffMs: 300000, // 5 minutes
      jitter: true,
    };
    
    return {
      ...DEFAULT_RETRY_POLICY,
      ...overrides,
    };
  }

  /**
   * Get node-specific retry policy
   */
  getNodeRetryPolicy(nodeType: string, nodeParams?: any): RetryPolicy {
    const basePolicy = this.getRetryPolicy();

    // Node-specific retry policies
    const nodeSpecificPolicies: Record<string, Partial<RetryPolicy>> = {
      'identity.provision': {
        maxRetries: 5,
        backoffMs: 2000,
        maxBackoffMs: 60000, // 1 minute max for identity operations
      },
      'email.send': {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000, // 30 seconds max for email
      },
      'webhook.call': {
        maxRetries: 3,
        backoffMs: 500,
        maxBackoffMs: 15000, // 15 seconds max for webhooks
      },
      'ai.generate_content': {
        maxRetries: 2,
        backoffMs: 5000,
        maxBackoffMs: 120000, // 2 minutes max for AI operations
      },
      'calendar.schedule': {
        maxRetries: 4,
        backoffMs: 1500,
        maxBackoffMs: 45000, // 45 seconds max for calendar operations
      },
    };

    const nodePolicy = nodeSpecificPolicies[nodeType] || {};
    
    // Allow node parameters to override retry policy
    const paramOverrides = nodeParams?.retryPolicy || {};

    return {
      ...basePolicy,
      ...nodePolicy,
      ...paramOverrides,
    };
  }

  /**
   * Create retry context from node execution failure
   */
  createRetryContext(
    runId: UUID,
    nodeId: UUID,
    nodeType: string,
    attempt: number,
    error: any,
    nodeParams?: any
  ): RetryContext {
    return {
      runId,
      nodeId,
      attempt,
      lastError: error,
      retryPolicy: this.getNodeRetryPolicy(nodeType, nodeParams),
      nodeType,
    };
  }

  /**
   * Get retry statistics for monitoring
   */
  async getRetryStatistics(organizationId?: UUID): Promise<{
    totalScheduledRetries: number;
    readyForRetry: number;
    retrysByNodeType: Record<string, number>;
    avgRetryDelay: number;
  }> {
    try {
      const retryNodes = await this.stateManager.getNodesReadyForRetry(1000);
      const scheduledRetries = await this.stateManager.getScheduledRetryCount();

      // Group retries by node type (would need additional state tracking)
      const retrysByNodeType: Record<string, number> = {};
      
      // Calculate average retry delay (simplified)
      const avgRetryDelay = 5000; // Would calculate from actual retry schedules

      return {
        totalScheduledRetries: scheduledRetries,
        readyForRetry: retryNodes.length,
        retrysByNodeType,
        avgRetryDelay,
      };
    } catch (error) {
      console.error('Failed to get retry statistics:', error);
      return {
        totalScheduledRetries: 0,
        readyForRetry: 0,
        retrysByNodeType: {},
        avgRetryDelay: 0,
      };
    }
  }
}