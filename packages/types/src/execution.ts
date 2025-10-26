/**
 * Workflow execution and runtime types
 */

import { BaseEntity, UUID, ErrorDetails, ExecutionMetadata } from './common';
import { LifecycleEventType } from './events';

export type WorkflowRunStatus = 
  | 'PENDING'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'COMPENSATING';

export type NodeRunStatus = 
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'
  | 'TIMEOUT'
  | 'RETRYING'
  | 'CANCELLED';

export interface WorkflowRun extends BaseEntity {
  organizationId: UUID;
  workflowId: UUID;
  employeeId: UUID;
  triggerEvent: LifecycleEventType;
  status: WorkflowRunStatus;
  context: ExecutionContext;
  startedAt: Date;
  endedAt?: Date;
  errorDetails?: ErrorDetails;
  correlationId: UUID;
  parentRunId?: UUID;
}

export interface NodeRun extends BaseEntity {
  runId: UUID;
  nodeId: UUID;
  attempt: number;
  status: NodeRunStatus;
  input?: Record<string, any>;
  output?: Record<string, any>;
  errorDetails?: ErrorDetails;
  idempotencyKey: string;
  startedAt?: Date;
  endedAt?: Date;
  metadata: ExecutionMetadata;
}

export interface ExecutionContext {
  organizationId: UUID;
  employeeId: UUID;
  triggerEvent: any;
  variables: Record<string, any>;
  secrets: Record<string, string>;
  correlationId: UUID;
  parentContext?: ExecutionContext;
}

export interface WorkflowEngine {
  processLifecycleEvent(event: any): Promise<WorkflowRun>;
  executeWorkflow(workflowId: UUID, context: ExecutionContext): Promise<WorkflowRun>;
  pauseWorkflow(runId: UUID): Promise<void>;
  resumeWorkflow(runId: UUID): Promise<void>;
  cancelWorkflow(runId: UUID): Promise<void>;
  getWorkflowRun(runId: UUID): Promise<WorkflowRun | null>;
  getWorkflowRunHistory(workflowId: UUID, limit?: number): Promise<WorkflowRun[]>;
}

export interface WorkflowScheduler {
  scheduleWorkflow(workflowId: UUID, cronExpression: string, context: ExecutionContext): Promise<void>;
  unscheduleWorkflow(workflowId: UUID): Promise<void>;
  getScheduledWorkflows(organizationId: UUID): Promise<ScheduledWorkflow[]>;
}

export interface ScheduledWorkflow {
  id: UUID;
  workflowId: UUID;
  organizationId: UUID;
  cronExpression: string;
  nextRunTime: Date;
  isActive: boolean;
  context: ExecutionContext;
}