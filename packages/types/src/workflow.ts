/**
 * Workflow definition and management types
 */

import { BaseEntity, UUID, ValidationResult } from './common';
import { LifecycleEventType } from './events';

export interface WorkflowDefinition extends BaseEntity {
  organizationId: UUID;
  name: string;
  description?: string;
  eventTrigger: LifecycleEventType;
  version: number;
  isActive: boolean;
  definition: WorkflowDAG;
  createdBy: UUID;
  tags?: string[];
}

export interface WorkflowDAG {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata: {
    version: string;
    description?: string;
    timeout?: number;
  };
}

export interface WorkflowNode {
  id: UUID;
  type: NodeType;
  name: string;
  description?: string;
  params: Record<string, any>;
  retryPolicy: RetryPolicy;
  timeoutMs: number;
  position: NodePosition;
  conditions?: ExecutionCondition[];
}

export interface WorkflowEdge {
  id: UUID;
  fromNodeId: UUID;
  toNodeId: UUID;
  conditionExpression?: string;
  label?: string;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  retryableErrors?: string[];
}

export interface ExecutionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export type NodeType = 
  | 'identity.provision'
  | 'identity.deprovision'
  | 'email.send'
  | 'calendar.schedule'
  | 'slack.message'
  | 'slack.channel_invite'
  | 'document.distribute'
  | 'ai.generate_content'
  | 'webhook.call'
  | 'delay'
  | 'condition'
  | 'parallel'
  | 'compensation';

export interface WorkflowTemplate extends BaseEntity {
  name: string;
  description: string;
  category: string;
  definition: WorkflowDAG;
  isPublic: boolean;
  usageCount: number;
  rating?: number;
}