/**
 * Node executor interfaces and types
 */

import { UUID, ValidationResult, ExecutionMetadata, ErrorDetails } from './common';
import { ExecutionContext } from './execution';

export interface NodeInput {
  nodeId: UUID;
  runId: UUID;
  organizationId: UUID;
  employeeId: UUID;
  params: Record<string, any>;
  context: ExecutionContext;
  idempotencyKey: string;
  attempt: number;
}

export interface NodeResult {
  status: 'success' | 'failed' | 'retry';
  output: Record<string, any>;
  error?: ErrorDetails;
  metadata: ExecutionMetadata;
}

export interface NodeSchema {
  type: string;
  name: string;
  description: string;
  category: string;
  parameters: NodeParameter[];
  outputs: NodeOutput[];
  examples?: NodeExample[];
}

export interface NodeParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: ParameterValidation;
}

export interface NodeOutput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
}

export interface ParameterValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: any[];
  min?: number;
  max?: number;
}

export interface NodeExample {
  name: string;
  description: string;
  input: Record<string, any>;
  expectedOutput: Record<string, any>;
}

export interface NodeExecutor {
  execute(input: NodeInput): Promise<NodeResult>;
  validate(params: Record<string, any>): ValidationResult;
  getSchema(): NodeSchema;
}

// Specific node type interfaces
export interface IdentityNodeParams {
  provider: 'okta' | 'google_workspace' | 'office365' | 'active_directory';
  action: 'provision' | 'deprovision' | 'update' | 'assign_groups';
  userEmail: string;
  groups?: string[];
  permissions?: string[];
  licenses?: string[];
}

export interface EmailNodeParams {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  template: string;
  templateData?: Record<string, any>;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
}

export interface CalendarNodeParams {
  provider: 'google_calendar' | 'office365_calendar';
  action: 'create_event' | 'update_event' | 'delete_event';
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  location?: string;
  timezone?: string;
}

export interface SlackNodeParams {
  action: 'send_message' | 'invite_to_channel' | 'create_channel';
  channel?: string;
  userId?: string;
  message?: string;
  channelName?: string;
  isPrivate?: boolean;
}

export interface AINodeParams {
  provider: 'openai' | 'anthropic' | 'azure_openai';
  model: string;
  prompt: string;
  templateData?: Record<string, any>;
  maxTokens?: number;
  temperature?: number;
  outputFormat?: 'text' | 'json' | 'markdown';
}

export interface DocumentNodeParams {
  action: 'upload' | 'distribute' | 'generate_link';
  documentId?: UUID;
  recipients: string[];
  accessLevel: 'read' | 'write' | 'admin';
  expirationDate?: Date;
  notifyRecipients?: boolean;
}