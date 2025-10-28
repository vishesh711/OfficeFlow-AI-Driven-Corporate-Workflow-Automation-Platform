/**
 * Platform-wide constants
 */

// Kafka topic names
export const KAFKA_TOPICS = {
  // Lifecycle events
  EMPLOYEE_ONBOARD: 'employee.onboard',
  EMPLOYEE_EXIT: 'employee.exit',
  EMPLOYEE_TRANSFER: 'employee.transfer',
  EMPLOYEE_UPDATE: 'employee.update',

  // Workflow control
  WORKFLOW_RUN_REQUEST: 'workflow.run.request',
  WORKFLOW_RUN_PAUSE: 'workflow.run.pause',
  WORKFLOW_RUN_RESUME: 'workflow.run.resume',
  WORKFLOW_RUN_CANCEL: 'workflow.run.cancel',

  // Node execution
  NODE_EXECUTE_REQUEST: 'node.execute.request',
  NODE_EXECUTE_RESULT: 'node.execute.result',
  NODE_EXECUTE_RETRY: 'node.execute.retry',

  // Integration events
  IDENTITY_PROVISION_REQUEST: 'identity.provision.request',
  IDENTITY_PROVISION_RESULT: 'identity.provision.result',
  EMAIL_SEND_REQUEST: 'email.send.request',
  EMAIL_SEND_RESULT: 'email.send.result',
  CALENDAR_SCHEDULE_REQUEST: 'calendar.schedule.request',
  CALENDAR_SCHEDULE_RESULT: 'calendar.schedule.result',

  // Observability
  AUDIT_EVENTS: 'audit.events',
  METRICS_EVENTS: 'metrics.events',
} as const;

// Redis key prefixes
export const REDIS_KEYS = {
  WORKFLOW_RUNS: 'workflow:runs',
  NODE_QUEUES: 'node:queue',
  RETRY_SCHEDULE: 'retry:schedule',
  RATE_LIMITS: 'rate_limit',
  LOCKS: 'lock',
  SESSIONS: 'session',
  CACHE: 'cache',
} as const;

// Default retry policy
export const DEFAULT_RETRY_POLICY = {
  maxRetries: 3,
  backoffMs: 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 300000, // 5 minutes
  jitter: true,
} as const;

// Default timeouts
export const TIMEOUTS = {
  NODE_EXECUTION: 300000, // 5 minutes
  WORKFLOW_EXECUTION: 3600000, // 1 hour
  HTTP_REQUEST: 30000, // 30 seconds
  DATABASE_QUERY: 10000, // 10 seconds
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Error codes
export const ERROR_CODES = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Authentication/Authorization errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',

  // Workflow errors
  WORKFLOW_NOT_FOUND: 'WORKFLOW_NOT_FOUND',
  WORKFLOW_EXECUTION_FAILED: 'WORKFLOW_EXECUTION_FAILED',
  WORKFLOW_ALREADY_RUNNING: 'WORKFLOW_ALREADY_RUNNING',
  INVALID_WORKFLOW_DEFINITION: 'INVALID_WORKFLOW_DEFINITION',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',

  // Node execution errors
  NODE_EXECUTION_FAILED: 'NODE_EXECUTION_FAILED',
  NODE_TIMEOUT: 'NODE_TIMEOUT',
  INVALID_NODE_PARAMS: 'INVALID_NODE_PARAMS',
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',

  // Integration errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  INTEGRATION_NOT_CONFIGURED: 'INTEGRATION_NOT_CONFIGURED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // System errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  REDIS_ERROR: 'REDIS_ERROR',
  KAFKA_ERROR: 'KAFKA_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// Node types
export const NODE_TYPES = {
  IDENTITY_PROVISION: 'identity.provision',
  IDENTITY_DEPROVISION: 'identity.deprovision',
  EMAIL_SEND: 'email.send',
  CALENDAR_SCHEDULE: 'calendar.schedule',
  SLACK_MESSAGE: 'slack.message',
  SLACK_CHANNEL_INVITE: 'slack.channel_invite',
  DOCUMENT_DISTRIBUTE: 'document.distribute',
  AI_GENERATE_CONTENT: 'ai.generate_content',
  WEBHOOK_CALL: 'webhook.call',
  DELAY: 'delay',
  CONDITION: 'condition',
  PARALLEL: 'parallel',
  COMPENSATION: 'compensation',
} as const;

// Workflow run statuses
export const WORKFLOW_RUN_STATUS = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  COMPENSATING: 'COMPENSATING',
} as const;

// Node run statuses
export const NODE_RUN_STATUS = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
  RETRYING: 'RETRYING',
  CANCELLED: 'CANCELLED',
} as const;
