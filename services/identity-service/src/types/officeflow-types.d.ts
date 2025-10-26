// Local type definitions for @officeflow packages

declare module '@officeflow/types' {
  export type UUID = string;

  export interface BaseEntity {
    id: UUID;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface ErrorDetails {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: Date;
  }

  export interface ValidationResult {
    isValid: boolean;
    errors: Array<{ field?: string; message: string }> | string[];
  }

  export interface ExecutionMetadata {
    executionId: UUID;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    retryCount: number;
    correlationId: string;
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

  export interface NodeSchema {
    type: string;
    name: string;
    description: string;
    category: string;
    parameters: NodeParameter[];
    outputs: NodeOutput[];
    examples?: NodeExample[];
  }

  export interface NodeExecutor {
    execute(input: NodeInput): Promise<NodeResult>;
    validate(params: Record<string, any>): ValidationResult;
    getSchema(): NodeSchema;
  }

  export interface IdentityNodeParams {
    provider: 'okta' | 'google_workspace' | 'office365' | 'active_directory';
    action: 'provision' | 'deprovision' | 'update' | 'assign_groups';
    userEmail: string;
    groups?: string[];
    permissions?: string[];
    licenses?: string[];
  }
}

declare module '@officeflow/shared' {
  // Placeholder for shared utilities
  export const utils: any;
}

declare module '@officeflow/config' {
  // Placeholder for config utilities
  export const config: any;
}

declare module '@officeflow/kafka' {
  export interface Producer {
    publish(topic: string, message: any, options?: any): Promise<void>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
  }

  export interface Consumer {
    subscribe(topics: string[]): Promise<void>;
    run(options: { eachMessage: (params: any) => Promise<void> }): Promise<void>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
  }
}