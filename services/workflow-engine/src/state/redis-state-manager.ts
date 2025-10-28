/**
 * Redis-based workflow state management
 */

import Redis, { Cluster } from 'ioredis';
import { UUID } from '@officeflow/types';
import { WorkflowState, NodeState } from '../types/workflow-state';
// Local RedisError class to avoid import issues
class RedisError extends Error {
  constructor(operation: string, reason: string) {
    super(`Redis error during ${operation}: ${reason}`);
    this.name = 'RedisError';
  }
}

export interface StateManagerConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    cluster?: {
      enabled: boolean;
      nodes?: Array<{ host: string; port: number }>;
      options?: {
        enableReadyCheck?: boolean;
        redisOptions?: {
          password?: string;
        };
      };
    };
    sentinel?: {
      enabled: boolean;
      sentinels?: Array<{ host: string; port: number }>;
      name?: string;
    };
  };
  ttl: {
    workflowState: number; // seconds
    nodeState: number; // seconds
    lockTimeout: number; // seconds
    retrySchedule: number; // seconds
  };
  monitoring: {
    enableMetrics: boolean;
    metricsPrefix: string;
  };
}

export class RedisStateManager {
  private redis: Redis | Cluster;
  private keyPrefix: string;
  private ttl: StateManagerConfig['ttl'];
  private monitoring: StateManagerConfig['monitoring'];

  constructor(config: StateManagerConfig) {
    this.keyPrefix = config.redis.keyPrefix || 'officeflow:';
    this.ttl = config.ttl;
    this.monitoring = config.monitoring;

    // Initialize Redis connection based on configuration
    if (config.redis.cluster?.enabled) {
      this.redis = new Cluster(
        config.redis.cluster.nodes || [{ host: config.redis.host, port: config.redis.port }],
        {
          enableReadyCheck: config.redis.cluster.options?.enableReadyCheck ?? true,
          redisOptions: {
            password: config.redis.password,
            keyPrefix: this.keyPrefix,
            maxRetriesPerRequest: 3,
            ...config.redis.cluster.options?.redisOptions,
          },
        }
      );
    } else if (config.redis.sentinel?.enabled) {
      this.redis = new Redis({
        sentinels: config.redis.sentinel.sentinels || [
          { host: config.redis.host, port: config.redis.port },
        ],
        name: config.redis.sentinel.name || 'mymaster',
        password: config.redis.password,
        db: config.redis.db || 0,
        keyPrefix: this.keyPrefix,
        maxRetriesPerRequest: 3,
      });
    } else {
      this.redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db || 0,
        keyPrefix: this.keyPrefix,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
    }

    // Set up connection event handlers
    this.setupConnectionHandlers();
  }

  /**
   * Get workflow state from Redis
   */
  async getWorkflowState(runId: UUID): Promise<WorkflowState | null> {
    try {
      const key = this.getWorkflowStateKey(runId);
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      return {
        ...parsed,
        currentNodes: new Set(parsed.currentNodes),
        completedNodes: new Set(parsed.completedNodes),
        failedNodes: new Set(parsed.failedNodes),
        skippedNodes: new Set(parsed.skippedNodes),
        startedAt: new Date(parsed.startedAt),
        lastUpdatedAt: new Date(parsed.lastUpdatedAt),
      };
    } catch (error) {
      console.error('Failed to get workflow state:', error);
      return null;
    }
  }

  /**
   * Set workflow state in Redis
   */
  async setWorkflowState(state: WorkflowState): Promise<void> {
    try {
      const key = this.getWorkflowStateKey(state.runId);
      const serializable = {
        ...state,
        currentNodes: Array.from(state.currentNodes),
        completedNodes: Array.from(state.completedNodes),
        failedNodes: Array.from(state.failedNodes),
        skippedNodes: Array.from(state.skippedNodes),
      };

      await this.redis.setex(key, this.ttl.workflowState, JSON.stringify(serializable));
    } catch (error) {
      console.error('Failed to set workflow state:', error);
      throw error;
    }
  }

  /**
   * Get node state from Redis
   */
  async getNodeState(runId: UUID, nodeId: UUID): Promise<NodeState | null> {
    try {
      const key = this.getNodeStateKey(runId, nodeId);
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      return {
        ...parsed,
        startedAt: parsed.startedAt ? new Date(parsed.startedAt) : undefined,
        endedAt: parsed.endedAt ? new Date(parsed.endedAt) : undefined,
        nextRetryAt: parsed.nextRetryAt ? new Date(parsed.nextRetryAt) : undefined,
      };
    } catch (error) {
      console.error('Failed to get node state:', error);
      return null;
    }
  }

  /**
   * Set node state in Redis
   */
  async setNodeState(state: NodeState): Promise<void> {
    try {
      const key = this.getNodeStateKey(state.runId, state.nodeId);

      await this.redis.setex(key, this.ttl.nodeState, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to set node state:', error);
      throw error;
    }
  }

  /**
   * Get all node states for a workflow run
   */
  async getWorkflowNodeStates(runId: UUID): Promise<NodeState[]> {
    try {
      // Use the full pattern including prefix
      const pattern = `${this.keyPrefix}node:${runId}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        return [];
      }

      // Remove the prefix from keys for mget since ioredis adds it automatically
      const keysWithoutPrefix = keys.map((key) => key.replace(this.keyPrefix, ''));
      const values = await this.redis.mget(...keysWithoutPrefix);

      return values
        .filter((value) => value !== null)
        .map((value) => {
          const parsed = JSON.parse(value!);
          return {
            ...parsed,
            startedAt: parsed.startedAt ? new Date(parsed.startedAt) : undefined,
            endedAt: parsed.endedAt ? new Date(parsed.endedAt) : undefined,
            nextRetryAt: parsed.nextRetryAt ? new Date(parsed.nextRetryAt) : undefined,
          };
        });
    } catch (error) {
      console.error('Failed to get workflow node states:', error);
      return [];
    }
  }

  /**
   * Acquire distributed lock for workflow execution
   */
  async acquireLock(runId: UUID, lockHolder: string): Promise<boolean> {
    try {
      const key = this.getLockKey(runId);
      const result = await this.redis.set(key, lockHolder, 'EX', this.ttl.lockTimeout, 'NX');

      return result === 'OK';
    } catch (error) {
      console.error('Failed to acquire lock:', error);
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  async releaseLock(runId: UUID, lockHolder: string): Promise<boolean> {
    try {
      const key = this.getLockKey(runId);

      // Use Lua script to ensure atomic check-and-delete
      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(script, 1, key, lockHolder);
      return result === 1;
    } catch (error) {
      console.error('Failed to release lock:', error);
      return false;
    }
  }

  /**
   * Schedule node retry using Redis sorted set
   */
  async scheduleRetry(runId: UUID, nodeId: UUID, retryAt: Date): Promise<void> {
    try {
      const key = this.getRetryScheduleKey();
      const member = `${runId}:${nodeId}`;
      const score = retryAt.getTime();

      await this.redis.zadd(key, score, member);
    } catch (error) {
      console.error('Failed to schedule retry:', error);
      throw error;
    }
  }

  /**
   * Get nodes ready for retry
   */
  async getNodesReadyForRetry(limit: number = 100): Promise<Array<{ runId: UUID; nodeId: UUID }>> {
    try {
      const key = this.getRetryScheduleKey();
      const now = Date.now();

      const results = await this.redis.zrangebyscore(key, '-inf', now, 'LIMIT', 0, limit);

      return results.map((result) => {
        const [runId, nodeId] = result.split(':');
        return { runId, nodeId };
      });
    } catch (error) {
      console.error('Failed to get nodes ready for retry:', error);
      return [];
    }
  }

  /**
   * Remove node from retry schedule
   */
  async removeFromRetrySchedule(runId: UUID, nodeId: UUID): Promise<void> {
    try {
      const key = this.getRetryScheduleKey();
      const member = `${runId}:${nodeId}`;

      await this.redis.zrem(key, member);
    } catch (error) {
      console.error('Failed to remove from retry schedule:', error);
    }
  }

  /**
   * Delete all state for a workflow run
   */
  async deleteWorkflowState(runId: UUID): Promise<void> {
    try {
      const workflowKey = this.getWorkflowStateKey(runId);
      const nodePattern = this.getNodeStateKey(runId, '*');
      const lockKey = this.getLockKey(runId);

      // Get all node state keys
      const nodeKeys = await this.redis.keys(nodePattern);

      // Delete all keys
      const keysToDelete = [workflowKey, lockKey, ...nodeKeys];
      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
      }
    } catch (error) {
      console.error('Failed to delete workflow state:', error);
    }
  }

  /**
   * Get workflow execution metrics
   */
  async getExecutionMetrics(organizationId: UUID): Promise<{
    activeWorkflows: number;
    queuedNodes: number;
    runningNodes: number;
    scheduledRetries: number;
  }> {
    try {
      // This is a simplified implementation
      // In production, you'd want more sophisticated metrics tracking
      const activePattern = `${this.keyPrefix}workflow:*`;
      const retryKey = this.getRetryScheduleKey();

      const activeKeys = await this.redis.keys(activePattern);
      const scheduledRetries = await this.redis.zcard(retryKey);

      return {
        activeWorkflows: activeKeys.length,
        queuedNodes: 0, // Would need separate tracking
        runningNodes: 0, // Would need separate tracking
        scheduledRetries,
      };
    } catch (error) {
      console.error('Failed to get execution metrics:', error);
      return {
        activeWorkflows: 0,
        queuedNodes: 0,
        runningNodes: 0,
        scheduledRetries: 0,
      };
    }
  }

  /**
   * Setup Redis connection event handlers
   */
  private setupConnectionHandlers(): void {
    const isTest = process.env.NODE_ENV === 'test';

    this.redis.on('connect', () => {
      if (!isTest) console.log('Redis connection established');
    });

    this.redis.on('ready', () => {
      if (!isTest) console.log('Redis connection ready');
    });

    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    this.redis.on('close', () => {
      if (!isTest) console.log('Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      if (!isTest) console.log('Redis reconnecting...');
    });

    this.redis.on('end', () => {
      if (!isTest) console.log('Redis connection ended');
    });
  }

  /**
   * Acquire distributed lock with automatic renewal
   */
  async acquireLockWithRenewal(
    runId: UUID,
    lockHolder: string,
    renewalIntervalMs: number = 60000
  ): Promise<{ acquired: boolean; renewalTimer?: NodeJS.Timeout }> {
    const acquired = await this.acquireLock(runId, lockHolder);

    if (!acquired) {
      return { acquired: false };
    }

    // Set up automatic renewal
    const renewalTimer = setInterval(async () => {
      try {
        const key = this.getLockKey(runId);
        const currentHolder = await this.redis.get(key);

        if (currentHolder === lockHolder) {
          await this.redis.expire(key, this.ttl.lockTimeout);
        } else {
          // Lock was lost, clear the timer
          clearInterval(renewalTimer);
        }
      } catch (error) {
        console.error('Failed to renew lock:', error);
        clearInterval(renewalTimer);
      }
    }, renewalIntervalMs);

    return { acquired: true, renewalTimer };
  }

  /**
   * Batch operations for better performance
   */
  async batchSetNodeStates(states: NodeState[]): Promise<void> {
    if (states.length === 0) return;

    const pipeline = this.redis.pipeline();

    states.forEach((state) => {
      const key = this.getNodeStateKey(state.runId, state.nodeId);
      pipeline.setex(key, this.ttl.nodeState, JSON.stringify(state));
    });

    try {
      await pipeline.exec();
    } catch (error) {
      console.error('Failed to batch set node states:', error);
      throw error;
    }
  }

  /**
   * Batch delete operations
   */
  async batchDeleteKeys(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      await this.redis.del(...keys);
    } catch (error) {
      console.error('Failed to batch delete keys:', error);
      throw error;
    }
  }

  /**
   * Get Redis connection health
   */
  async getConnectionHealth(): Promise<{
    status: 'connected' | 'connecting' | 'disconnected' | 'error';
    latencyMs?: number;
    memoryUsage?: string;
    connectedClients?: number;
  }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latencyMs = Date.now() - start;

      // Get Redis info if available
      let memoryUsage: string | undefined;
      let connectedClients: number | undefined;

      try {
        const info = await this.redis.info('memory');
        const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
        memoryUsage = memoryMatch ? memoryMatch[1] : undefined;

        const clientsInfo = await this.redis.info('clients');
        const clientsMatch = clientsInfo.match(/connected_clients:(\d+)/);
        connectedClients = clientsMatch ? parseInt(clientsMatch[1]) : undefined;
      } catch {
        // Ignore info command errors (might not be available in all Redis setups)
      }

      return {
        status: 'connected',
        latencyMs,
        memoryUsage,
        connectedClients,
      };
    } catch (error) {
      return {
        status: 'error',
      };
    }
  }

  /**
   * Clean up expired retry schedules
   */
  async cleanupExpiredRetries(): Promise<number> {
    try {
      const key = this.getRetryScheduleKey();
      const now = Date.now();

      // Remove entries older than TTL
      const expiredBefore = now - this.ttl.retrySchedule * 1000;
      const removed = await this.redis.zremrangebyscore(key, '-inf', expiredBefore);

      return removed;
    } catch (error) {
      console.error('Failed to cleanup expired retries:', error);
      return 0;
    }
  }

  /**
   * Get workflow execution statistics
   */
  async getWorkflowStats(organizationId?: UUID): Promise<{
    totalActiveWorkflows: number;
    totalScheduledRetries: number;
    nodeStatusCounts: Record<string, number>;
    avgExecutionTime?: number;
  }> {
    try {
      const stats = {
        totalActiveWorkflows: 0,
        totalScheduledRetries: 0,
        nodeStatusCounts: {} as Record<string, number>,
      };

      // Count active workflows
      const workflowPattern = organizationId
        ? `${this.keyPrefix}workflow:*:${organizationId}:*`
        : `${this.keyPrefix}workflow:*`;

      const workflowKeys = await this.redis.keys(workflowPattern);
      stats.totalActiveWorkflows = workflowKeys.length;

      // Count scheduled retries
      const retryKey = this.getRetryScheduleKey();
      stats.totalScheduledRetries = await this.redis.zcard(retryKey);

      // Count node statuses (simplified - would need better indexing in production)
      const nodePattern = organizationId
        ? `${this.keyPrefix}node:*:${organizationId}:*`
        : `${this.keyPrefix}node:*`;

      const nodeKeys = await this.redis.keys(nodePattern);

      if (nodeKeys.length > 0) {
        // Remove prefix from keys for mget
        const keysWithoutPrefix = nodeKeys.map((key) => key.replace(this.keyPrefix, ''));
        const nodeStates = await this.redis.mget(...keysWithoutPrefix);

        nodeStates.forEach((stateJson) => {
          if (stateJson) {
            try {
              const state = JSON.parse(stateJson);
              const status = state.status || 'UNKNOWN';
              stats.nodeStatusCounts[status] = (stats.nodeStatusCounts[status] || 0) + 1;
            } catch {
              // Ignore parse errors
            }
          }
        });
      }

      return stats;
    } catch (error) {
      console.error('Failed to get workflow stats:', error);
      return {
        totalActiveWorkflows: 0,
        totalScheduledRetries: 0,
        nodeStatusCounts: {},
      };
    }
  }

  /**
   * Implement circuit breaker pattern for Redis operations
   */
  private async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    fallback?: () => T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error('Redis operation failed:', error);

      if (fallback) {
        return fallback();
      }

      throw error;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
      // Force disconnect if quit fails
      this.redis.disconnect();
    }
  }

  private getWorkflowStateKey(runId: UUID): string {
    return `workflow:${runId}`;
  }

  private getNodeStateKey(runId: UUID, nodeId: UUID | string): string {
    return `node:${runId}:${nodeId}`;
  }

  private getLockKey(runId: UUID): string {
    return `lock:workflow:${runId}`;
  }

  private getRetryScheduleKey(): string {
    return 'retry:schedule';
  }

  /**
   * Circuit breaker operations
   */
  async getCircuitBreakerStats(serviceName: string): Promise<any> {
    try {
      const key = `circuit_breaker:${serviceName}`;
      const data = await this.redis.hgetall(key);

      if (Object.keys(data).length === 0) {
        return null;
      }

      return {
        state: data.state || 'CLOSED',
        failureCount: parseInt(data.failureCount || '0'),
        successCount: parseInt(data.successCount || '0'),
        totalRequests: parseInt(data.totalRequests || '0'),
        lastFailureTime: data.lastFailureTime ? parseInt(data.lastFailureTime) : null,
        nextRetryTime: data.nextRetryTime ? parseInt(data.nextRetryTime) : null,
      };
    } catch (error) {
      console.error(`Failed to get circuit breaker stats for ${serviceName}:`, error);
      throw new RedisError(
        'getCircuitBreakerStats',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async recordCircuitBreakerSuccess(serviceName: string, timestamp: number): Promise<void> {
    try {
      const key = `circuit_breaker:${serviceName}`;
      const pipeline = this.redis.pipeline();

      pipeline.hincrby(key, 'successCount', 1);
      pipeline.hincrby(key, 'totalRequests', 1);
      pipeline.hset(key, 'lastSuccessTime', timestamp);
      pipeline.expire(key, 3600); // 1 hour TTL

      await pipeline.exec();
    } catch (error) {
      console.error(`Failed to record circuit breaker success for ${serviceName}:`, error);
      throw new RedisError(
        'recordCircuitBreakerSuccess',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async recordCircuitBreakerFailure(serviceName: string, timestamp: number): Promise<void> {
    try {
      const key = `circuit_breaker:${serviceName}`;
      const pipeline = this.redis.pipeline();

      pipeline.hincrby(key, 'failureCount', 1);
      pipeline.hincrby(key, 'totalRequests', 1);
      pipeline.hset(key, 'lastFailureTime', timestamp);
      pipeline.expire(key, 3600); // 1 hour TTL

      await pipeline.exec();
    } catch (error) {
      console.error(`Failed to record circuit breaker failure for ${serviceName}:`, error);
      throw new RedisError(
        'recordCircuitBreakerFailure',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async setCircuitBreakerState(
    serviceName: string,
    state: string,
    nextRetryTime?: number
  ): Promise<void> {
    try {
      const key = `circuit_breaker:${serviceName}`;
      const pipeline = this.redis.pipeline();

      pipeline.hset(key, 'state', state);
      if (nextRetryTime) {
        pipeline.hset(key, 'nextRetryTime', nextRetryTime);
      } else {
        pipeline.hdel(key, 'nextRetryTime');
      }
      pipeline.expire(key, 3600); // 1 hour TTL

      await pipeline.exec();
    } catch (error) {
      console.error(`Failed to set circuit breaker state for ${serviceName}:`, error);
      throw new RedisError(
        'setCircuitBreakerState',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async resetCircuitBreakerStats(serviceName: string): Promise<void> {
    try {
      const key = `circuit_breaker:${serviceName}`;
      await this.redis.del(key);
    } catch (error) {
      console.error(`Failed to reset circuit breaker stats for ${serviceName}:`, error);
      throw new RedisError(
        'resetCircuitBreakerStats',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async resetCircuitBreakerFailures(serviceName: string): Promise<void> {
    try {
      const key = `circuit_breaker:${serviceName}`;
      const pipeline = this.redis.pipeline();

      pipeline.hset(key, 'failureCount', 0);
      pipeline.hdel(key, 'lastFailureTime');
      pipeline.expire(key, 3600);

      await pipeline.exec();
    } catch (error) {
      console.error(`Failed to reset circuit breaker failures for ${serviceName}:`, error);
      throw new RedisError(
        'resetCircuitBreakerFailures',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Error logging operations
   */
  async storeErrorEntry(key: string, entry: any, ttl: number): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(entry));

      // Also add to sorted set for time-based queries
      const scoreKey = `error_log:by_time`;
      await this.redis.zadd(scoreKey, entry.timestamp.getTime(), key);
      await this.redis.expire(scoreKey, ttl);
    } catch (error) {
      console.error('Failed to store error entry:', error);
      throw new RedisError(
        'storeErrorEntry',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async storeAlert(alert: any): Promise<void> {
    try {
      const key = `alert:${alert.id}`;
      await this.redis.setex(key, 7 * 24 * 60 * 60, JSON.stringify(alert)); // 7 days TTL

      // Add to sorted set for time-based queries
      const scoreKey = `alerts:by_time`;
      await this.redis.zadd(scoreKey, alert.timestamp.getTime(), key);
      await this.redis.expire(scoreKey, 7 * 24 * 60 * 60);
    } catch (error) {
      console.error('Failed to store alert:', error);
      throw new RedisError('storeAlert', error instanceof Error ? error.message : String(error));
    }
  }

  async getRecentAlerts(limit: number): Promise<any[]> {
    try {
      const scoreKey = `alerts:by_time`;
      const alertKeys = await this.redis.zrevrange(scoreKey, 0, limit - 1);

      if (alertKeys.length === 0) {
        return [];
      }

      const alerts = await this.redis.mget(...alertKeys);
      return alerts.filter((alert) => alert !== null).map((alert) => JSON.parse(alert!));
    } catch (error) {
      console.error('Failed to get recent alerts:', error);
      return [];
    }
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    try {
      const key = `alert:${alertId}`;
      const alertData = await this.redis.get(key);

      if (alertData) {
        const alert = JSON.parse(alertData);
        alert.acknowledged = true;
        alert.acknowledgedBy = acknowledgedBy;
        alert.acknowledgedAt = new Date().toISOString();

        await this.redis.setex(key, 7 * 24 * 60 * 60, JSON.stringify(alert));
      }
    } catch (error) {
      console.error(`Failed to acknowledge alert ${alertId}:`, error);
      throw new RedisError(
        'acknowledgeAlert',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Get scheduled retry count
   */
  async getScheduledRetryCount(): Promise<number> {
    try {
      return await this.redis.zcard('retry:schedule');
    } catch (error) {
      console.error('Failed to get scheduled retry count:', error);
      return 0;
    }
  }
}
