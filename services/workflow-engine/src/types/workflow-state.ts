/**
 * Workflow execution state management types
 */

import { UUID, WorkflowRunStatus, NodeRunStatus } from '@officeflow/types';

export interface WorkflowState {
  runId: UUID;
  workflowId: UUID;
  organizationId: UUID;
  employeeId: UUID;
  status: WorkflowRunStatus;
  currentNodes: Set<UUID>;
  completedNodes: Set<UUID>;
  failedNodes: Set<UUID>;
  skippedNodes: Set<UUID>;
  context: Record<string, any>;
  startedAt: Date;
  lastUpdatedAt: Date;
  errorDetails?: any;
}

export interface NodeState {
  nodeId: UUID;
  runId: UUID;
  status: NodeRunStatus;
  attempt: number;
  input?: Record<string, any>;
  output?: Record<string, any>;
  errorDetails?: any;
  startedAt?: Date;
  endedAt?: Date;
  nextRetryAt?: Date;
}

export interface WorkflowTransition {
  fromStatus: WorkflowRunStatus;
  toStatus: WorkflowRunStatus;
  trigger: 'start' | 'pause' | 'resume' | 'cancel' | 'complete' | 'fail' | 'timeout';
  conditions?: (state: WorkflowState) => boolean;
}

export interface NodeTransition {
  fromStatus: NodeRunStatus;
  toStatus: NodeRunStatus;
  trigger: 'queue' | 'start' | 'complete' | 'fail' | 'retry' | 'skip' | 'cancel' | 'timeout';
  conditions?: (state: NodeState) => boolean;
}

export const WORKFLOW_TRANSITIONS: WorkflowTransition[] = [
  { fromStatus: 'PENDING', toStatus: 'RUNNING', trigger: 'start' },
  { fromStatus: 'RUNNING', toStatus: 'PAUSED', trigger: 'pause' },
  { fromStatus: 'PAUSED', toStatus: 'RUNNING', trigger: 'resume' },
  { fromStatus: 'RUNNING', toStatus: 'COMPLETED', trigger: 'complete' },
  { fromStatus: 'RUNNING', toStatus: 'FAILED', trigger: 'fail' },
  { fromStatus: 'RUNNING', toStatus: 'CANCELLED', trigger: 'cancel' },
  { fromStatus: 'PAUSED', toStatus: 'CANCELLED', trigger: 'cancel' },
  { fromStatus: 'RUNNING', toStatus: 'TIMEOUT', trigger: 'timeout' },
  { fromStatus: 'FAILED', toStatus: 'COMPENSATING', trigger: 'start' },
  { fromStatus: 'COMPENSATING', toStatus: 'FAILED', trigger: 'complete' },
];

export const NODE_TRANSITIONS: NodeTransition[] = [
  { fromStatus: 'QUEUED', toStatus: 'RUNNING', trigger: 'start' },
  { fromStatus: 'RUNNING', toStatus: 'COMPLETED', trigger: 'complete' },
  { fromStatus: 'RUNNING', toStatus: 'FAILED', trigger: 'fail' },
  { fromStatus: 'FAILED', toStatus: 'RETRYING', trigger: 'retry' },
  { fromStatus: 'RETRYING', toStatus: 'QUEUED', trigger: 'queue' },
  { fromStatus: 'QUEUED', toStatus: 'SKIPPED', trigger: 'skip' },
  { fromStatus: 'RUNNING', toStatus: 'CANCELLED', trigger: 'cancel' },
  { fromStatus: 'QUEUED', toStatus: 'CANCELLED', trigger: 'cancel' },
  { fromStatus: 'RUNNING', toStatus: 'TIMEOUT', trigger: 'timeout' },
];
