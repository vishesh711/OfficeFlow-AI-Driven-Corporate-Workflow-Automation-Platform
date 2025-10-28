/**
 * Workflow repository implementation
 */

import { WorkflowEntity, WorkflowRepository, UUID } from '@officeflow/types';
import { BaseRepository } from './base';
import { workflowSchema, createWorkflowSchema, updateWorkflowSchema } from '../validation/schemas';

export class WorkflowRepositoryImpl
  extends BaseRepository<WorkflowEntity>
  implements WorkflowRepository
{
  constructor() {
    super('workflows', 'workflow_id', createWorkflowSchema, updateWorkflowSchema);
  }

  /**
   * Find workflows by organization
   */
  async findByOrganization(orgId: UUID): Promise<WorkflowEntity[]> {
    return this.findAll({ org_id: orgId });
  }

  /**
   * Find workflows by event trigger
   */
  async findByEventTrigger(eventTrigger: string): Promise<WorkflowEntity[]>;
  async findByEventTrigger(orgId: UUID, eventTrigger: string): Promise<WorkflowEntity[]>;
  async findByEventTrigger(
    eventTriggerOrOrgId: string | UUID,
    eventTrigger?: string
  ): Promise<WorkflowEntity[]> {
    if (eventTrigger) {
      // Two parameter version: findByEventTrigger(orgId, eventTrigger)
      return this.findAll({
        org_id: eventTriggerOrOrgId,
        event_trigger: eventTrigger,
      });
    } else {
      // One parameter version: findByEventTrigger(eventTrigger)
      return this.findAll({ event_trigger: eventTriggerOrOrgId });
    }
  }

  /**
   * Find active workflows by trigger for organization
   */
  async findActiveByTrigger(orgId: UUID, eventTrigger: string): Promise<WorkflowEntity[]> {
    return this.findAll({
      org_id: orgId,
      event_trigger: eventTrigger,
      is_active: true,
    });
  }

  /**
   * Find workflows by creator
   */
  async findByCreator(createdBy: UUID): Promise<WorkflowEntity[]> {
    return this.findAll({ created_by: createdBy });
  }

  /**
   * Get workflow with nodes and edges
   */
  async findWithNodesAndEdges(workflowId: UUID): Promise<{
    workflow: WorkflowEntity;
    nodes: any[];
    edges: any[];
  } | null> {
    const workflow = await this.findById(workflowId);
    if (!workflow) {
      return null;
    }

    // Get nodes
    const nodesQuery = `
      SELECT * FROM workflow_nodes 
      WHERE workflow_id = $1 
      ORDER BY created_at
    `;
    const nodesResult = await this.pool.query(nodesQuery, [workflowId]);

    // Get edges
    const edgesQuery = `
      SELECT * FROM workflow_edges 
      WHERE workflow_id = $1 
      ORDER BY created_at
    `;
    const edgesResult = await this.pool.query(edgesQuery, [workflowId]);

    return {
      workflow,
      nodes: nodesResult.rows,
      edges: edgesResult.rows,
    };
  }

  /**
   * Clone workflow with new name and version
   */
  async clone(workflowId: UUID, newName: string, createdBy: UUID): Promise<WorkflowEntity | null> {
    const workflowData = await this.findWithNodesAndEdges(workflowId);
    if (!workflowData) {
      return null;
    }

    return this.transaction(async (client) => {
      // Create new workflow
      const newWorkflow = await this.create({
        org_id: workflowData.workflow.org_id,
        name: newName,
        description: `Cloned from ${workflowData.workflow.name}`,
        event_trigger: workflowData.workflow.event_trigger,
        version: 1,
        is_active: false,
        definition: workflowData.workflow.definition,
        created_by: createdBy,
      } as any);

      // Clone nodes
      for (const node of workflowData.nodes) {
        await client.query(
          `
          INSERT INTO workflow_nodes (
            workflow_id, type, name, description, params, 
            retry_policy, timeout_ms, position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
          [
            newWorkflow.workflow_id,
            node.type,
            node.name,
            node.description,
            node.params,
            node.retry_policy,
            node.timeout_ms,
            node.position,
          ]
        );
      }

      // Clone edges
      for (const edge of workflowData.edges) {
        await client.query(
          `
          INSERT INTO workflow_edges (
            workflow_id, from_node_id, to_node_id, 
            condition_expr, label
          ) VALUES ($1, $2, $3, $4, $5)
        `,
          [
            newWorkflow.workflow_id,
            edge.from_node_id,
            edge.to_node_id,
            edge.condition_expr,
            edge.label,
          ]
        );
      }

      return newWorkflow;
    });
  }

  /**
   * Get workflow execution statistics
   */
  async getExecutionStats(
    workflowId: UUID,
    days: number = 30
  ): Promise<{
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    averageDurationMs: number;
    lastExecuted?: Date;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_runs,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as successful_runs,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_runs,
        AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000) as avg_duration_ms,
        MAX(started_at) as last_executed
      FROM workflow_runs 
      WHERE workflow_id = $1 
        AND started_at >= NOW() - INTERVAL '${days} days'
    `;

    const result = await this.pool.query(query, [workflowId]);
    const row = result.rows[0];

    return {
      totalRuns: parseInt(row.total_runs, 10),
      successfulRuns: parseInt(row.successful_runs, 10),
      failedRuns: parseInt(row.failed_runs, 10),
      averageDurationMs: row.avg_duration_ms ? parseFloat(row.avg_duration_ms) : 0,
      lastExecuted: row.last_executed,
    };
  }

  /**
   * Activate/deactivate workflow
   */
  async setActive(workflowId: UUID, isActive: boolean): Promise<WorkflowEntity | null> {
    return this.update(workflowId, { is_active: isActive });
  }

  /**
   * Search workflows by name or description
   */
  async search(orgId: UUID, searchTerm: string, limit: number = 50): Promise<WorkflowEntity[]> {
    const query = `
      SELECT * FROM workflows 
      WHERE org_id = $1 
        AND (
          LOWER(name) LIKE LOWER($2) OR
          LOWER(description) LIKE LOWER($2)
        )
      ORDER BY name
      LIMIT $3
    `;

    const searchPattern = `%${searchTerm}%`;
    const result = await this.pool.query(query, [orgId, searchPattern, limit]);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }
}
