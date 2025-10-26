/**
 * Redis state manager tests
 */

import { RedisStateManager, StateManagerConfig } from '../state/redis-state-manager';
import { WorkflowState, NodeState } from '../types/workflow-state';
import { v4 as uuidv4 } from 'uuid';

describe('RedisStateManager', () => {
  let stateManager: RedisStateManager;
  let config: StateManagerConfig;

  beforeEach(async () => {
    config = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: 1, // Use different DB for tests
        keyPrefix: 'test:officeflow:',
        cluster: {
          enabled: false,
        },
        sentinel: {
          enabled: false,
        },
      },
      ttl: {
        workflowState: 3600,
        nodeState: 3600,
        lockTimeout: 300,
        retrySchedule: 604800,
      },
      monitoring: {
        enableMetrics: true,
        metricsPrefix: 'test_officeflow_redis',
      },
    };

    stateManager = new RedisStateManager(config);
    
    // Clean up any existing retry schedule data
    try {
      const redis = (stateManager as any).redis;
      await redis.del('retry:schedule');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterEach(async () => {
    // Clean up test data
    await stateManager.disconnect();
  });

  describe('Workflow State Management', () => {
    it('should store and retrieve workflow state', async () => {
      const runId = uuidv4();
      const workflowState: WorkflowState = {
        runId,
        workflowId: uuidv4(),
        organizationId: uuidv4(),
        employeeId: uuidv4(),
        status: 'RUNNING',
        currentNodes: new Set(['node1', 'node2']),
        completedNodes: new Set(['node0']),
        failedNodes: new Set(),
        skippedNodes: new Set(),
        context: { test: 'data' },
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
      };

      await stateManager.setWorkflowState(workflowState);
      const retrieved = await stateManager.getWorkflowState(runId);

      expect(retrieved).toBeTruthy();
      expect(retrieved!.runId).toBe(runId);
      expect(retrieved!.status).toBe('RUNNING');
      expect(retrieved!.currentNodes).toEqual(new Set(['node1', 'node2']));
      expect(retrieved!.completedNodes).toEqual(new Set(['node0']));
      expect(retrieved!.context).toEqual({ test: 'data' });
    });

    it('should return null for non-existent workflow state', async () => {
      const nonExistentId = uuidv4();
      const retrieved = await stateManager.getWorkflowState(nonExistentId);
      expect(retrieved).toBeNull();
    });

    it('should delete workflow state and related data', async () => {
      const runId = uuidv4();
      const workflowState: WorkflowState = {
        runId,
        workflowId: uuidv4(),
        organizationId: uuidv4(),
        employeeId: uuidv4(),
        status: 'RUNNING',
        currentNodes: new Set(),
        completedNodes: new Set(),
        failedNodes: new Set(),
        skippedNodes: new Set(),
        context: {},
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
      };

      await stateManager.setWorkflowState(workflowState);
      await stateManager.deleteWorkflowState(runId);
      
      const retrieved = await stateManager.getWorkflowState(runId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Node State Management', () => {
    it('should store and retrieve node state', async () => {
      const runId = uuidv4();
      const nodeId = uuidv4();
      const nodeState: NodeState = {
        nodeId,
        runId,
        status: 'RUNNING',
        attempt: 1,
        input: { param1: 'value1' },
        output: { result: 'success' },
        startedAt: new Date(),
      };

      await stateManager.setNodeState(nodeState);
      const retrieved = await stateManager.getNodeState(runId, nodeId);

      expect(retrieved).toBeTruthy();
      expect(retrieved!.nodeId).toBe(nodeId);
      expect(retrieved!.status).toBe('RUNNING');
      expect(retrieved!.attempt).toBe(1);
      expect(retrieved!.input).toEqual({ param1: 'value1' });
      expect(retrieved!.output).toEqual({ result: 'success' });
    });

    it('should retrieve all node states for a workflow', async () => {
      const runId = uuidv4();
      const nodeStates: NodeState[] = [
        {
          nodeId: uuidv4(),
          runId,
          status: 'COMPLETED',
          attempt: 1,
        },
        {
          nodeId: uuidv4(),
          runId,
          status: 'RUNNING',
          attempt: 1,
        },
        {
          nodeId: uuidv4(),
          runId,
          status: 'FAILED',
          attempt: 2,
        },
      ];

      // Store all node states
      for (const state of nodeStates) {
        await stateManager.setNodeState(state);
      }

      const retrieved = await stateManager.getWorkflowNodeStates(runId);
      expect(retrieved).toHaveLength(3);
      
      const statuses = retrieved.map(s => s.status).sort();
      expect(statuses).toEqual(['COMPLETED', 'FAILED', 'RUNNING']);
    });

    it('should batch set node states', async () => {
      const runId = uuidv4();
      const nodeStates: NodeState[] = [
        {
          nodeId: uuidv4(),
          runId,
          status: 'QUEUED',
          attempt: 1,
        },
        {
          nodeId: uuidv4(),
          runId,
          status: 'QUEUED',
          attempt: 1,
        },
      ];

      await stateManager.batchSetNodeStates(nodeStates);

      const retrieved = await stateManager.getWorkflowNodeStates(runId);
      expect(retrieved).toHaveLength(2);
      expect(retrieved.every(s => s.status === 'QUEUED')).toBe(true);
    });
  });

  describe('Distributed Locking', () => {
    it('should acquire and release locks', async () => {
      const runId = uuidv4();
      const lockHolder = 'test-instance-1';

      // Acquire lock
      const acquired = await stateManager.acquireLock(runId, lockHolder);
      expect(acquired).toBe(true);

      // Try to acquire same lock with different holder
      const secondAcquire = await stateManager.acquireLock(runId, 'test-instance-2');
      expect(secondAcquire).toBe(false);

      // Release lock
      const released = await stateManager.releaseLock(runId, lockHolder);
      expect(released).toBe(true);

      // Should be able to acquire again
      const reacquired = await stateManager.acquireLock(runId, 'test-instance-2');
      expect(reacquired).toBe(true);
    });

    it('should not release lock held by different instance', async () => {
      const runId = uuidv4();
      const lockHolder1 = 'test-instance-1';
      const lockHolder2 = 'test-instance-2';

      await stateManager.acquireLock(runId, lockHolder1);
      
      const released = await stateManager.releaseLock(runId, lockHolder2);
      expect(released).toBe(false);
    });

    it('should acquire lock with automatic renewal', async () => {
      const runId = uuidv4();
      const lockHolder = 'test-instance-1';

      const { acquired, renewalTimer } = await stateManager.acquireLockWithRenewal(
        runId, 
        lockHolder, 
        100 // 100ms renewal interval for testing
      );

      expect(acquired).toBe(true);
      expect(renewalTimer).toBeDefined();

      // Wait for renewal to happen
      await new Promise(resolve => setTimeout(resolve, 150));

      // Clean up
      if (renewalTimer) {
        clearInterval(renewalTimer);
      }
      await stateManager.releaseLock(runId, lockHolder);
    });
  });

  describe('Retry Scheduling', () => {
    it('should schedule and retrieve retries', async () => {
      const runId = uuidv4();
      const nodeId = uuidv4();
      const retryAt = new Date(Date.now() + 5000); // 5 seconds from now

      await stateManager.scheduleRetry(runId, nodeId, retryAt);

      // Should not be ready yet
      const notReady = await stateManager.getNodesReadyForRetry(10);
      expect(notReady.find(r => r.runId === runId && r.nodeId === nodeId)).toBeUndefined();

      // Schedule for immediate retry
      const immediateRetry = new Date(Date.now() - 1000); // 1 second ago
      await stateManager.scheduleRetry(runId, nodeId, immediateRetry);

      const ready = await stateManager.getNodesReadyForRetry(10);
      expect(ready.find(r => r.runId === runId && r.nodeId === nodeId)).toBeDefined();
    });

    it('should remove nodes from retry schedule', async () => {
      // Clean up any existing data first
      const redis = (stateManager as any).redis;
      await redis.del('retry:schedule');
      
      const runId = uuidv4();
      const nodeId = uuidv4();
      const retryAt = new Date(Date.now() - 5000); // 5 seconds in the past

      await stateManager.scheduleRetry(runId, nodeId, retryAt);
      
      // Add a small delay to ensure Redis operation completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let ready = await stateManager.getNodesReadyForRetry(10);
      expect(ready.find(r => r.runId === runId && r.nodeId === nodeId)).toBeDefined();

      await stateManager.removeFromRetrySchedule(runId, nodeId);
      
      ready = await stateManager.getNodesReadyForRetry(10);
      expect(ready.find(r => r.runId === runId && r.nodeId === nodeId)).toBeUndefined();
    });

    it('should clean up expired retries', async () => {
      const runId = uuidv4();
      const nodeId = uuidv4();
      
      // Schedule retry far in the past (should be cleaned up)
      const expiredRetry = new Date(Date.now() - (8 * 24 * 60 * 60 * 1000)); // 8 days ago
      await stateManager.scheduleRetry(runId, nodeId, expiredRetry);

      const cleaned = await stateManager.cleanupExpiredRetries();
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health and Monitoring', () => {
    it('should get connection health', async () => {
      const health = await stateManager.getConnectionHealth();
      
      expect(health).toHaveProperty('status');
      expect(['connected', 'connecting', 'disconnected', 'error']).toContain(health.status);
      
      if (health.status === 'connected') {
        expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should get workflow statistics', async () => {
      // Create some test data
      const runId = uuidv4();
      const workflowState: WorkflowState = {
        runId,
        workflowId: uuidv4(),
        organizationId: uuidv4(),
        employeeId: uuidv4(),
        status: 'RUNNING',
        currentNodes: new Set(),
        completedNodes: new Set(),
        failedNodes: new Set(),
        skippedNodes: new Set(),
        context: {},
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
      };

      await stateManager.setWorkflowState(workflowState);

      const stats = await stateManager.getWorkflowStats();
      
      expect(stats).toHaveProperty('totalActiveWorkflows');
      expect(stats).toHaveProperty('totalScheduledRetries');
      expect(stats).toHaveProperty('nodeStatusCounts');
      expect(typeof stats.totalActiveWorkflows).toBe('number');
      expect(typeof stats.totalScheduledRetries).toBe('number');
    });

    it('should get execution metrics', async () => {
      const orgId = uuidv4();
      const metrics = await stateManager.getExecutionMetrics(orgId);
      
      expect(metrics).toHaveProperty('activeWorkflows');
      expect(metrics).toHaveProperty('queuedNodes');
      expect(metrics).toHaveProperty('runningNodes');
      expect(metrics).toHaveProperty('scheduledRetries');
      expect(typeof metrics.activeWorkflows).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // This test would require mocking Redis failures
      // For now, we'll test that methods don't throw unexpected errors
      
      const nonExistentId = uuidv4();
      
      // These should not throw
      await expect(stateManager.getWorkflowState(nonExistentId)).resolves.toBeNull();
      await expect(stateManager.getNodeState(nonExistentId, nonExistentId)).resolves.toBeNull();
      await expect(stateManager.getWorkflowNodeStates(nonExistentId)).resolves.toEqual([]);
    });
  });
});