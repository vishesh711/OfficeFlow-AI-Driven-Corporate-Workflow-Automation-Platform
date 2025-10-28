/**
 * Entity mapping utilities to convert between database entities and domain types
 */

import {
  WorkflowEntity,
  WorkflowRunEntity,
  WorkflowDefinition,
  WorkflowRun,
} from '@officeflow/types';

/**
 * Map WorkflowEntity to WorkflowDefinition
 */
export function mapWorkflowEntityToDefinition(entity: WorkflowEntity): WorkflowDefinition {
  return {
    id: entity.workflow_id,
    organizationId: entity.org_id,
    name: entity.name,
    description: entity.description,
    eventTrigger: entity.event_trigger as any,
    version: entity.version,
    isActive: entity.is_active,
    definition: entity.definition,
    createdBy: entity.created_by || '',
    tags: [],
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}

/**
 * Map WorkflowRunEntity to WorkflowRun
 */
export function mapWorkflowRunEntityToRun(entity: WorkflowRunEntity): WorkflowRun {
  return {
    id: entity.run_id,
    organizationId: entity.org_id,
    workflowId: entity.workflow_id,
    employeeId: entity.employee_id || '',
    triggerEvent: entity.trigger_event as any,
    status: entity.status,
    context: {
      organizationId: entity.org_id,
      employeeId: entity.employee_id || '',
      triggerEvent: entity.trigger_event,
      variables: entity.context,
      secrets: {},
      correlationId: `${entity.run_id}`,
    },
    startedAt: entity.started_at,
    endedAt: entity.ended_at,
    errorDetails: entity.error_details,
    correlationId: `${entity.run_id}`,
    createdAt: entity.created_at,
    updatedAt: entity.created_at, // Use created_at as fallback
  };
}

/**
 * Map WorkflowRun to WorkflowRunEntity for creation
 */
export function mapWorkflowRunToEntity(
  run: Partial<WorkflowRun>
): Omit<WorkflowRunEntity, 'created_at'> {
  return {
    run_id: run.id || '',
    org_id: run.organizationId || '',
    workflow_id: run.workflowId || '',
    employee_id: run.employeeId,
    trigger_event: (run.triggerEvent as string) || 'manual',
    status: run.status || 'PENDING',
    context: run.context?.variables || {},
    error_details: run.errorDetails,
    started_at: run.startedAt || new Date(),
    ended_at: run.endedAt,
  };
}
