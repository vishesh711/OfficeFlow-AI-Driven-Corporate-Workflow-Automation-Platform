/**
 * Node run repository implementation
 */

import { NodeRunEntity, NodeRunRepository, UUID, NodeRunStatus } from '@officeflow/types';
import { BaseRepository } from './base';
import { nodeRunSchema, createNodeRunSchema, updateNodeRunSchema } from '../validation/schemas';

export class NodeRunRepositoryImpl
  extends BaseRepository<NodeRunEntity>
  implements NodeRunRepository
{
  constructor() {
    super('node_runs', 'node_run_id', createNodeRunSchema, updateNodeRunSchema);
  }

  /**
   * Find node runs by workflow run
   */
  async findByWorkflowRun(runId: UUID): Promise<NodeRunEntity[]> {
    return this.findAll(
      { run_id: runId },
      {
        orderBy: 'created_at',
        orderDirection: 'ASC',
      }
    );
  }

  /**
   * Find node runs by status
   */
  async findByStatus(status: NodeRunStatus): Promise<NodeRunEntity[]> {
    return this.findAll(
      { status },
      {
        orderBy: 'created_at',
        orderDirection: 'ASC',
      }
    );
  }

  /**
   * Find node run by idempotency key
   */
  async findByIdempotencyKey(key: string): Promise<NodeRunEntity | null> {
    const query = 'SELECT * FROM node_runs WHERE idempotency_key = $1';
    const result = await this.pool.query(query, [key]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find queued node runs ready for execution
   */
  async findQueuedRuns(limit: number = 100): Promise<NodeRunEntity[]> {
    return this.findAll(
      { status: 'QUEUED' },
      {
        orderBy: 'created_at',
        orderDirection: 'ASC',
        limit,
      }
    );
  }

  /**
   * Find running node runs that may have timed out
   */
  async findTimedOutRuns(timeoutMinutes: number = 30): Promise<NodeRunEntity[]> {
    const query = `
      SELECT nr.*, wn.timeout_ms
      FROM node_runs nr
      JOIN workflow_nodes wn ON nr.node_id = wn.node_id
      WHERE nr.status = 'RUNNING' 
        AND nr.started_at < NOW() - INTERVAL '${timeoutMinutes} minutes'
      ORDER BY nr.started_at ASC
    `;

    const result = await this.pool.query(query);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Update node run status with timing
   */
  async updateStatus(
    nodeRunId: UUID,
    status: NodeRunStatus,
    output?: any,
    errorDetails?: any
  ): Promise<NodeRunEntity | null> {
    const updates: any = { status };

    // Set start time when starting
    if (status === 'RUNNING' && !updates.started_at) {
      updates.started_at = new Date();
    }

    // Set end time for terminal states
    if (['COMPLETED', 'FAILED', 'SKIPPED', 'TIMEOUT', 'CANCELLED'].includes(status)) {
      updates.ended_at = new Date();
    }

    if (output !== undefined) {
      updates.output = output;
    }

    if (errorDetails) {
      updates.error_details = errorDetails;
    }

    return this.update(nodeRunId, updates);
  }

  /**
   * Increment attempt count for retry
   */
  async incrementAttempt(nodeRunId: UUID): Promise<NodeRunEntity | null> {
    const query = `
      UPDATE node_runs 
      SET attempt = attempt + 1, updated_at = NOW()
      WHERE node_run_id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, [nodeRunId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Get node execution statistics
   */
  async getNodeStats(
    nodeId: UUID,
    days: number = 30
  ): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDurationMs: number;
    averageAttempts: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_executions,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_executions,
        AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000) as avg_duration_ms,
        AVG(attempt) as avg_attempts
      FROM node_runs 
      WHERE node_id = $1 
        AND created_at >= NOW() - INTERVAL '${days} days'
    `;

    const result = await this.pool.query(query, [nodeId]);
    const row = result.rows[0];

    return {
      totalExecutions: parseInt(row.total_executions, 10),
      successfulExecutions: parseInt(row.successful_executions, 10),
      failedExecutions: parseInt(row.failed_executions, 10),
      averageDurationMs: row.avg_duration_ms ? parseFloat(row.avg_duration_ms) : 0,
      averageAttempts: row.avg_attempts ? parseFloat(row.avg_attempts) : 0,
    };
  }

  /**
   * Find failed node runs that can be retried
   */
  async findRetryableRuns(maxAttempts: number = 3): Promise<NodeRunEntity[]> {
    const query = `
      SELECT nr.*, wn.retry_policy
      FROM node_runs nr
      JOIN workflow_nodes wn ON nr.node_id = wn.node_id
      WHERE nr.status = 'FAILED' 
        AND nr.attempt < $1
        AND (wn.retry_policy->>'maxRetries')::int > nr.attempt
      ORDER BY nr.ended_at ASC
    `;

    const result = await this.pool.query(query, [maxAttempts]);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Get execution timeline for workflow run
   */
  async getExecutionTimeline(runId: UUID): Promise<
    Array<{
      nodeRunId: UUID;
      nodeName: string;
      nodeType: string;
      status: NodeRunStatus;
      attempt: number;
      startedAt?: Date;
      endedAt?: Date;
      durationMs?: number;
    }>
  > {
    const query = `
      SELECT 
        nr.node_run_id,
        wn.name as node_name,
        wn.type as node_type,
        nr.status,
        nr.attempt,
        nr.started_at,
        nr.ended_at,
        EXTRACT(EPOCH FROM (nr.ended_at - nr.started_at)) * 1000 as duration_ms
      FROM node_runs nr
      JOIN workflow_nodes wn ON nr.node_id = wn.node_id
      WHERE nr.run_id = $1
      ORDER BY nr.created_at
    `;

    const result = await this.pool.query(query, [runId]);
    return result.rows.map((row) => ({
      nodeRunId: row.node_run_id,
      nodeName: row.node_name,
      nodeType: row.node_type,
      status: row.status,
      attempt: row.attempt,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationMs: row.duration_ms ? parseFloat(row.duration_ms) : undefined,
    }));
  }
}
