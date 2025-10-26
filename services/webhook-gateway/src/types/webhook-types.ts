export interface WebhookPayload {
  source: 'workday' | 'successfactors' | 'bamboohr' | 'generic';
  eventType: string;
  timestamp: Date;
  organizationId: string;
  employeeId?: string;
  data: Record<string, any>;
  signature?: string;
  headers: Record<string, string>;
}

export interface NormalizedLifecycleEvent {
  type: 'employee.onboard' | 'employee.exit' | 'employee.transfer' | 'employee.update';
  organizationId: string;
  employeeId: string;
  payload: {
    employee: EmployeeData;
    metadata: EventMetadata;
  };
  timestamp: Date;
  source: string;
  correlationId: string;
}

export interface EmployeeData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  department?: string;
  jobTitle?: string;
  managerId?: string;
  startDate?: Date;
  endDate?: Date;
  location?: string;
  employeeType?: string;
  status: 'active' | 'inactive' | 'terminated';
}

export interface EventMetadata {
  source: string;
  sourceEventId?: string;
  sourceEventType: string;
  processedAt: Date;
  version: string;
}

export interface WebhookConfig {
  organizationId: string;
  source: string;
  endpoint: string;
  secretKey: string;
  isActive: boolean;
  retryPolicy: RetryPolicy;
  transformationRules?: TransformationRule[];
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  maxBackoffMs: number;
  retryableStatusCodes: number[];
}

export interface TransformationRule {
  sourceField: string;
  targetField: string;
  transformation?: 'uppercase' | 'lowercase' | 'date' | 'boolean';
  defaultValue?: any;
}

export interface HRMSAdapter {
  source: string;
  poll(): Promise<NormalizedLifecycleEvent[]>;
  processWebhook(payload: WebhookPayload): Promise<NormalizedLifecycleEvent[]>;
  validateSignature(payload: string, signature: string, secret: string): boolean;
}

export interface PollingConfig {
  source: string;
  organizationId: string;
  isEnabled: boolean;
  intervalMs: number;
  lastPolledAt?: Date;
  credentials: Record<string, string>;
}

export interface WebhookDeliveryAttempt {
  id: string;
  webhookId: string;
  organizationId: string;
  payload: WebhookPayload;
  attempt: number;
  status: 'pending' | 'success' | 'failed' | 'retry';
  responseCode?: number;
  responseBody?: string;
  error?: string;
  scheduledAt: Date;
  processedAt?: Date;
  nextRetryAt?: Date;
}