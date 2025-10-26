/**
 * Zod validation schemas for database entities
 */

import { z } from 'zod';

// Base schemas
export const uuidSchema = z.string().uuid();
export const timestampSchema = z.date();
export const jsonSchema = z.record(z.any());

// Organization schemas
export const organizationSchema = z.object({
  org_id: uuidSchema,
  name: z.string().min(1).max(255),
  domain: z.string().min(1).max(255),
  plan: z.string().min(1).max(50),
  settings: jsonSchema.default({}),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const createOrganizationSchema = organizationSchema.omit({
  org_id: true,
  created_at: true,
  updated_at: true,
});

export const updateOrganizationSchema = organizationSchema.partial().omit({
  org_id: true,
  created_at: true,
  updated_at: true,
});

// User schemas
export const userSchema = z.object({
  user_id: uuidSchema,
  org_id: uuidSchema,
  email: z.string().email().max(255),
  password_hash: z.string().optional(),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  role: z.string().max(50).default('user'),
  is_active: z.boolean().default(true),
  last_login_at: timestampSchema.optional(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const createUserSchema = userSchema.omit({
  user_id: true,
  created_at: true,
  updated_at: true,
});

export const updateUserSchema = userSchema.partial().omit({
  user_id: true,
  created_at: true,
  updated_at: true,
});

// Employee schemas
export const employeeSchema = z.object({
  employee_id: uuidSchema,
  org_id: uuidSchema,
  employee_number: z.string().max(50).optional(),
  email: z.string().email().max(255),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  department: z.string().max(100).optional(),
  job_title: z.string().max(100).optional(),
  manager_id: uuidSchema.optional(),
  hire_date: z.date().optional(),
  termination_date: z.date().optional(),
  status: z.string().max(50).default('active'),
  profile_data: jsonSchema.default({}),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const createEmployeeSchema = employeeSchema.omit({
  employee_id: true,
  created_at: true,
  updated_at: true,
});

export const updateEmployeeSchema = employeeSchema.partial().omit({
  employee_id: true,
  created_at: true,
  updated_at: true,
});

// Workflow schemas
export const retryPolicySchema = z.object({
  maxRetries: z.number().min(0).default(3),
  backoffMs: z.number().min(0).default(1000),
  backoffMultiplier: z.number().min(1).default(2),
  maxBackoffMs: z.number().min(0).default(300000),
  retryableErrors: z.array(z.string()).optional(),
});

export const workflowSchema = z.object({
  workflow_id: uuidSchema,
  org_id: uuidSchema,
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  event_trigger: z.string().min(1).max(100),
  version: z.number().int().min(1).default(1),
  is_active: z.boolean().default(true),
  definition: jsonSchema,
  created_by: uuidSchema.optional(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const createWorkflowSchema = workflowSchema.omit({
  workflow_id: true,
  created_at: true,
  updated_at: true,
});

export const updateWorkflowSchema = workflowSchema.partial().omit({
  workflow_id: true,
  created_at: true,
  updated_at: true,
});

// Workflow node schemas
export const workflowNodeSchema = z.object({
  node_id: uuidSchema,
  workflow_id: uuidSchema,
  type: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  params: jsonSchema.default({}),
  retry_policy: retryPolicySchema.default({
    maxRetries: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
    maxBackoffMs: 300000,
  }),
  timeout_ms: z.number().int().min(1000).default(300000),
  position: jsonSchema.default({}),
  created_at: timestampSchema,
});

export const createWorkflowNodeSchema = workflowNodeSchema.omit({
  node_id: true,
  created_at: true,
});

// Workflow edge schemas
export const workflowEdgeSchema = z.object({
  edge_id: uuidSchema,
  workflow_id: uuidSchema,
  from_node_id: uuidSchema.optional(),
  to_node_id: uuidSchema,
  condition_expr: z.string().optional(),
  label: z.string().max(255).optional(),
  created_at: timestampSchema,
});

export const createWorkflowEdgeSchema = workflowEdgeSchema.omit({
  edge_id: true,
  created_at: true,
});

// Workflow run schemas
export const workflowRunStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'TIMEOUT',
]);

export const workflowRunSchema = z.object({
  run_id: uuidSchema,
  org_id: uuidSchema,
  workflow_id: uuidSchema,
  employee_id: uuidSchema.optional(),
  trigger_event: z.string().min(1).max(100),
  status: workflowRunStatusSchema.default('PENDING'),
  context: jsonSchema.default({}),
  error_details: jsonSchema.optional(),
  started_at: timestampSchema,
  ended_at: timestampSchema.optional(),
  created_at: timestampSchema,
});

export const createWorkflowRunSchema = workflowRunSchema.omit({
  run_id: true,
  created_at: true,
});

export const updateWorkflowRunSchema = workflowRunSchema.partial().omit({
  run_id: true,
  created_at: true,
});

// Node run schemas
export const nodeRunStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
  'TIMEOUT',
  'CANCELLED',
]);

export const nodeRunSchema = z.object({
  node_run_id: uuidSchema,
  run_id: uuidSchema,
  node_id: uuidSchema,
  attempt: z.number().int().min(1).default(1),
  status: nodeRunStatusSchema.default('QUEUED'),
  input: jsonSchema.optional(),
  output: jsonSchema.optional(),
  error_details: jsonSchema.optional(),
  idempotency_key: z.string().max(255).optional(),
  started_at: timestampSchema.optional(),
  ended_at: timestampSchema.optional(),
  created_at: timestampSchema,
});

export const createNodeRunSchema = nodeRunSchema.omit({
  node_run_id: true,
  created_at: true,
});

export const updateNodeRunSchema = nodeRunSchema.partial().omit({
  node_run_id: true,
  created_at: true,
});

// Audit log schemas
export const auditLogSchema = z.object({
  audit_id: uuidSchema,
  org_id: uuidSchema,
  entity_type: z.string().min(1).max(50),
  entity_id: uuidSchema,
  action: z.string().min(1).max(50),
  actor_id: uuidSchema.optional(),
  actor_type: z.string().max(50).default('user'),
  changes: jsonSchema.optional(),
  metadata: jsonSchema.default({}),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
  created_at: timestampSchema,
});

export const createAuditLogSchema = auditLogSchema.omit({
  audit_id: true,
  created_at: true,
});

// Integration account schemas
export const integrationAccountSchema = z.object({
  account_id: uuidSchema,
  org_id: uuidSchema,
  provider: z.string().min(1).max(50),
  account_name: z.string().min(1).max(255),
  credentials: jsonSchema, // Encrypted
  config: jsonSchema.default({}),
  is_active: z.boolean().default(true),
  last_used_at: timestampSchema.optional(),
  expires_at: timestampSchema.optional(),
  created_by: uuidSchema.optional(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const createIntegrationAccountSchema = integrationAccountSchema.omit({
  account_id: true,
  created_at: true,
  updated_at: true,
});

export const updateIntegrationAccountSchema = integrationAccountSchema.partial().omit({
  account_id: true,
  created_at: true,
  updated_at: true,
});