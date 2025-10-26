/**
 * Database entity types that match the PostgreSQL schema
 */

import { BaseEntity, UUID, ExecutionMetadata, ErrorDetails } from './common';
import { WorkflowDAG, RetryPolicy } from './workflow';
import { WorkflowRunStatus, NodeRunStatus } from './execution';

// Database entities matching the schema

export interface OrganizationEntity {
  org_id: UUID;
  name: string;
  domain: string;
  plan: string;
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface UserEntity {
  user_id: UUID;
  org_id: UUID;
  email: string;
  password_hash?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  is_active: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface EmployeeEntity {
  employee_id: UUID;
  org_id: UUID;
  employee_number?: string;
  email: string;
  first_name: string;
  last_name: string;
  department?: string;
  job_title?: string;
  manager_id?: UUID;
  hire_date?: Date;
  termination_date?: Date;
  status: string;
  profile_data: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface WorkflowEntity {
  workflow_id: UUID;
  org_id: UUID;
  name: string;
  description?: string;
  event_trigger: string;
  version: number;
  is_active: boolean;
  definition: WorkflowDAG;
  created_by?: UUID;
  created_at: Date;
  updated_at: Date;
}

export interface CreateWorkflowEntity extends Omit<WorkflowEntity, 'workflow_id' | 'created_at' | 'updated_at'> {
  workflow_id?: UUID;
}

export interface WorkflowNodeEntity {
  node_id: UUID;
  workflow_id: UUID;
  type: string;
  name: string;
  description?: string;
  params: Record<string, any>;
  retry_policy: RetryPolicy;
  timeout_ms: number;
  position: Record<string, any>;
  created_at: Date;
}

export interface WorkflowEdgeEntity {
  edge_id: UUID;
  workflow_id: UUID;
  from_node_id?: UUID;
  to_node_id: UUID;
  condition_expr?: string;
  label?: string;
  created_at: Date;
}

export interface WorkflowRunEntity {
  run_id: UUID;
  org_id: UUID;
  workflow_id: UUID;
  employee_id?: UUID;
  trigger_event: string;
  status: WorkflowRunStatus;
  context: Record<string, any>;
  error_details?: ErrorDetails;
  started_at: Date;
  ended_at?: Date;
  created_at: Date;
}

export interface NodeRunEntity {
  node_run_id: UUID;
  run_id: UUID;
  node_id: UUID;
  attempt: number;
  status: NodeRunStatus;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error_details?: ErrorDetails;
  idempotency_key?: string;
  started_at?: Date;
  ended_at?: Date;
  created_at: Date;
}

export interface AuditLogEntity {
  audit_id: UUID;
  org_id: UUID;
  entity_type: string;
  entity_id: UUID;
  action: string;
  actor_id?: UUID;
  actor_type: string;
  changes?: Record<string, any>;
  metadata: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface CreateAuditLogEntity extends Omit<AuditLogEntity, 'audit_id' | 'created_at'> {
  audit_id?: UUID;
}

export interface IntegrationAccountEntity {
  account_id: UUID;
  org_id: UUID;
  provider: string;
  account_name: string;
  credentials: Record<string, any>; // Encrypted
  config: Record<string, any>;
  is_active: boolean;
  last_used_at?: Date;
  expires_at?: Date;
  created_by?: UUID;
  created_at: Date;
  updated_at: Date;
}

// Note: WorkflowRunStatus and NodeRunStatus are imported from './execution'

// Repository interfaces
export interface Repository<T> {
  findById(id: UUID): Promise<T | null>;
  findAll(filters?: Record<string, any>): Promise<T[]>;
  create(entity: Omit<T, 'created_at' | 'updated_at'>): Promise<T>;
  update(id: UUID, updates: Partial<T>): Promise<T | null>;
  delete(id: UUID): Promise<boolean>;
}

export interface OrganizationRepository extends Repository<OrganizationEntity> {
  findByDomain(domain: string): Promise<OrganizationEntity | null>;
}

export interface UserRepository extends Repository<UserEntity> {
  findByEmail(email: string): Promise<UserEntity | null>;
  findByOrganization(orgId: UUID): Promise<UserEntity[]>;
}

export interface EmployeeRepository extends Repository<EmployeeEntity> {
  findByEmail(email: string): Promise<EmployeeEntity | null>;
  findByOrganization(orgId: UUID): Promise<EmployeeEntity[]>;
  findByManager(managerId: UUID): Promise<EmployeeEntity[]>;
  findByStatus(status: string): Promise<EmployeeEntity[]>;
}

export interface WorkflowRepository extends Repository<WorkflowEntity> {
  findByOrganization(orgId: UUID): Promise<WorkflowEntity[]>;
  findByEventTrigger(eventTrigger: string): Promise<WorkflowEntity[]>;
  findActiveByTrigger(orgId: UUID, eventTrigger: string): Promise<WorkflowEntity[]>;
}

export interface WorkflowRunRepository extends Repository<WorkflowRunEntity> {
  findByOrganization(orgId: UUID): Promise<WorkflowRunEntity[]>;
  findByWorkflow(workflowId: UUID): Promise<WorkflowRunEntity[]>;
  findByEmployee(employeeId: UUID): Promise<WorkflowRunEntity[]>;
  findByStatus(status: WorkflowRunStatus): Promise<WorkflowRunEntity[]>;
  findActiveRuns(): Promise<WorkflowRunEntity[]>;
  updateStatus(runId: UUID, status: WorkflowRunStatus, errorDetails?: any): Promise<WorkflowRunEntity | null>;
}

export interface NodeRunRepository extends Repository<NodeRunEntity> {
  findByWorkflowRun(runId: UUID): Promise<NodeRunEntity[]>;
  findByStatus(status: NodeRunStatus): Promise<NodeRunEntity[]>;
  findByIdempotencyKey(key: string): Promise<NodeRunEntity | null>;
}

export interface AuditLogRepository extends Repository<AuditLogEntity> {
  findByOrganization(orgId: UUID): Promise<AuditLogEntity[]>;
  findByEntity(entityType: string, entityId: UUID): Promise<AuditLogEntity[]>;
  findByActor(actorId: UUID): Promise<AuditLogEntity[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<AuditLogEntity[]>;
}

export interface IntegrationAccountRepository extends Repository<IntegrationAccountEntity> {
  findByOrganization(orgId: UUID): Promise<IntegrationAccountEntity[]>;
  findByProvider(orgId: UUID, provider: string): Promise<IntegrationAccountEntity[]>;
  findActiveByProvider(orgId: UUID, provider: string): Promise<IntegrationAccountEntity[]>;
}