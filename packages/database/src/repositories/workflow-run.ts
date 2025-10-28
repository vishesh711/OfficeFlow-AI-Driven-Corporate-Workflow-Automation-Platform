/**
 * Workflow run repository implementation
 */

import {
  WorkflowRunEntity,
  WorkflowRunRepository,
  UUID,
  WorkflowRunStatus,
} from '@officeflow/types';
import { BaseRepository } from './base';
import {
  workflowRunSchema,
  createWorkflowRunSchema,
  updateWorkflowRunSchema,
} from '../validation/schemas';

export class WorkflowRunRepositoryImpl
  extends BaseRepository<WorkflowRunEntity>
  implements WorkflowRunRepository
{
  constructor() {
    super('workflow_runs', 'run_id', createWorkflowRunSchema, updateWorkflowRunSchema);
  }

  /**
   * Find workflow runs by organization
   */
  async findByOrganization(orgId: UUID): Promise<WorkflowRunEntity[]> {
    return this.findAll(
      { org_id: orgId },
      {
        orderBy: 'started_at',
        orderDirection: 'DESC',
      }
    );
  }

  /**
   * Find workflow runs by workflow
   */
  async findByWorkflow(workflowId: UUID): Promise<WorkflowRunEntity[]> {
    return this.findAll(
      { workflow_id: workflowId },
      {
        orderBy: 'started_at',
        orderDirection: 'DESC',
      }
    );
  }

  /**
   * Find workflow runs by employee
   */
  async findByEmployee(employeeId: UUID): Promise<WorkflowRunEntity[]> {
    return this.findAll(
      { employee_id: employeeId },
      {
        orderBy: 'started_at',
        orderDirection: 'DESC',
      }
    );
  }

  /**
   * Find workflow runs by status
   */
  async findByStatus(status: WorkflowRunStatus): Promise<WorkflowRunEntity[]> {
    return this.findAll(
      { status },
      {
        orderBy: 'started_at',
        orderDirection: 'DESC',
      }
    );
  }

  /**
   * Find active workflow runs (PENDING or RUNNING)
   */
  async findActiveRuns(): Promise<WorkflowRunEntity[]> {
    const query = `
      SELECT * FROM workflow_runs 
      WHERE status IN ('PENDING', 'RUNNING')
      ORDER BY started_at ASC
    `;

    const result = await this.pool.query(query);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Find stalled workflow runs (running for too long)
   */
  async findStalledRuns(timeoutMinutes: number = 60): Promise<WorkflowRunEntity[]> {
    const query = `
      SELECT * FROM workflow_runs 
      WHERE status = 'RUNNING' 
        AND started_at < NOW() - INTERVAL '${timeoutMinutes} minutes'
      ORDER BY started_at ASC
    `;

    const result = await this.pool.query(query);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Get workflow run with node runs
   */
  async findWithNodeRuns(runId: UUID): Promise<{
    workflowRun: WorkflowRunEntity;
    nodeRuns: any[];
  } | null> {
    const workflowRun = await this.findById(runId);
    if (!workflowRun) {
      return null;
    }

    const nodeRunsQuery = `
      SELECT nr.*, wn.name as node_name, wn.type as node_type
      FROM node_runs nr
      JOIN workflow_nodes wn ON nr.node_id = wn.node_id
      WHERE nr.run_id = $1
      ORDER BY nr.created_at
    `;

    const result = await this.pool.query(nodeRunsQuery, [runId]);

    return {
      workflowRun,
      nodeRuns: result.rows,
    };
  }

  /**
   * Update workflow run status and end time
   */
  async updateStatus(
    runId: UUID,
    status: WorkflowRunStatus,
    errorDetails?: any
  ): Promise<WorkflowRunEntity | null> {
    const updates: any = { status };

    // Set end time for terminal states
    if (['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(status)) {
      updates.ended_at = new Date();
    }

    if (errorDetails) {
      updates.error_details = errorDetails;
    }

    return this.update(runId, updates);
  }

  /**
   * Get execution statistics for date range
   */
  async getExecutionStats(
    orgId: UUID,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    averageDurationMs: number;
    runsByDay: Array<{ date: string; count: number }>;
  }> {
    // Get overall stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_runs,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_runs,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_runs,
        AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000) as avg_duration_ms
      FROM workflow_runs 
      WHERE org_id = $1 
        AND started_at >= $2 
        AND started_at <= $3
    `;

    const statsResult = await this.pool.query(statsQuery, [orgId, startDate, endDate]);
    const stats = statsResult.rows[0];

    // Get runs by day
    const dailyQuery = `
      SELECT 
        DATE(started_at) as date,
        COUNT(*) as count
      FROM workflow_runs 
      WHERE org_id = $1 
        AND started_at >= $2 
        AND started_at <= $3
      GROUP BY DATE(started_at)
      ORDER BY date
    `;

    const dailyResult = await this.pool.query(dailyQuery, [orgId, startDate, endDate]);

    return {
      totalRuns: parseInt(stats.total_runs, 10),
      completedRuns: parseInt(stats.completed_runs, 10),
      failedRuns: parseInt(stats.failed_runs, 10),
      averageDurationMs: stats.avg_duration_ms ? parseFloat(stats.avg_duration_ms) : 0,
      runsByDay: dailyResult.rows.map((row) => ({
        date: row.date,
        count: parseInt(row.count, 10),
      })),
    };
  }

  /**
   * Find recent runs for dashboard
   */
  async findRecentRuns(orgId: UUID, limit: number = 10): Promise<WorkflowRunEntity[]> {
    const query = `
      SELECT wr.*, w.name as workflow_name, e.first_name, e.last_name
      FROM workflow_runs wr
      JOIN workflows w ON wr.workflow_id = w.workflow_id
      LEFT JOIN employees e ON wr.employee_id = e.employee_id
      WHERE wr.org_id = $1
      ORDER BY wr.started_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [orgId, limit]);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Cancel workflow run
   */
  async cancel(runId: UUID, reason?: string): Promise<WorkflowRunEntity | null> {
    const errorDetails = reason ? { reason, cancelledAt: new Date() } : undefined;
    return this.updateStatus(runId, 'CANCELLED', errorDetails);
  }

  /**
   * Pause workflow run
   */
  async pause(runId: UUID): Promise<WorkflowRunEntity | null> {
    return this.updateStatus(runId, 'PAUSED');
  }

  /**
   * Resume workflow run
   */
  async resume(runId: UUID): Promise<WorkflowRunEntity | null> {
    return this.updateStatus(runId, 'RUNNING');
  }
}
