import { ConsumerGroupConfig } from './config';

/**
 * Consumer group configurations for each microservice
 * Each service has its own consumer group for independent scaling
 */

export const CONSUMER_GROUP_CONFIGS: Record<string, ConsumerGroupConfig> = {
  'workflow-engine': {
    groupId: 'workflow-engine',
    sessionTimeout: 30000,
    rebalanceTimeout: 60000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 1048576, // 1MB
    minBytes: 1,
    maxBytes: 10485760, // 10MB
    maxWaitTimeInMs: 5000,
    retry: {
      initialRetryTime: 100,
      retries: 8,
    },
    readUncommitted: false,
  },

  'identity-service': {
    groupId: 'identity-service',
    sessionTimeout: 30000,
    rebalanceTimeout: 60000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 524288, // 512KB
    minBytes: 1,
    maxBytes: 5242880, // 5MB
    maxWaitTimeInMs: 3000,
    retry: {
      initialRetryTime: 100,
      retries: 5,
    },
    readUncommitted: false,
  },

  'email-service': {
    groupId: 'email-service',
    sessionTimeout: 30000,
    rebalanceTimeout: 60000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 524288, // 512KB
    minBytes: 1,
    maxBytes: 5242880, // 5MB
    maxWaitTimeInMs: 3000,
    retry: {
      initialRetryTime: 100,
      retries: 5,
    },
    readUncommitted: false,
  },

  'calendar-service': {
    groupId: 'calendar-service',
    sessionTimeout: 30000,
    rebalanceTimeout: 60000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 524288, // 512KB
    minBytes: 1,
    maxBytes: 5242880, // 5MB
    maxWaitTimeInMs: 3000,
    retry: {
      initialRetryTime: 100,
      retries: 5,
    },
    readUncommitted: false,
  },

  'slack-service': {
    groupId: 'slack-service',
    sessionTimeout: 30000,
    rebalanceTimeout: 60000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 524288, // 512KB
    minBytes: 1,
    maxBytes: 5242880, // 5MB
    maxWaitTimeInMs: 3000,
    retry: {
      initialRetryTime: 100,
      retries: 5,
    },
    readUncommitted: false,
  },

  'document-service': {
    groupId: 'document-service',
    sessionTimeout: 30000,
    rebalanceTimeout: 60000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 2097152, // 2MB (larger for document handling)
    minBytes: 1,
    maxBytes: 20971520, // 20MB
    maxWaitTimeInMs: 5000,
    retry: {
      initialRetryTime: 100,
      retries: 5,
    },
    readUncommitted: false,
  },

  'ai-service': {
    groupId: 'ai-service',
    sessionTimeout: 45000, // Longer timeout for AI processing
    rebalanceTimeout: 90000,
    heartbeatInterval: 5000,
    maxBytesPerPartition: 1048576, // 1MB
    minBytes: 1,
    maxBytes: 10485760, // 10MB
    maxWaitTimeInMs: 10000, // Longer wait for AI processing
    retry: {
      initialRetryTime: 200,
      retries: 3, // Fewer retries for expensive AI calls
    },
    readUncommitted: false,
  },

  'audit-service': {
    groupId: 'audit-service',
    sessionTimeout: 30000,
    rebalanceTimeout: 60000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 1048576, // 1MB
    minBytes: 1,
    maxBytes: 10485760, // 10MB
    maxWaitTimeInMs: 5000,
    retry: {
      initialRetryTime: 100,
      retries: 8, // High reliability for audit logs
    },
    readUncommitted: false,
  },

  'webhook-gateway': {
    groupId: 'webhook-gateway',
    sessionTimeout: 30000,
    rebalanceTimeout: 60000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 524288, // 512KB
    minBytes: 1,
    maxBytes: 5242880, // 5MB
    maxWaitTimeInMs: 2000, // Fast processing for webhooks
    retry: {
      initialRetryTime: 50,
      retries: 5,
    },
    readUncommitted: false,
  },

  'scheduler-service': {
    groupId: 'scheduler-service',
    sessionTimeout: 30000,
    rebalanceTimeout: 60000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 524288, // 512KB
    minBytes: 1,
    maxBytes: 5242880, // 5MB
    maxWaitTimeInMs: 5000,
    retry: {
      initialRetryTime: 100,
      retries: 8,
    },
    readUncommitted: false,
  },
};

/**
 * Topic subscription patterns for each consumer group
 */
export const CONSUMER_SUBSCRIPTIONS: Record<string, string[]> = {
  'workflow-engine': [
    'employee.onboard.*',
    'employee.exit.*',
    'employee.transfer.*',
    'employee.update.*',
    'workflow.run.pause',
    'workflow.run.resume',
    'workflow.run.cancel',
    'node.execute.result',
  ],

  'identity-service': ['identity.provision.request', 'node.execute.request'],

  'email-service': ['email.send.request', 'node.execute.request'],

  'calendar-service': ['calendar.schedule.request', 'node.execute.request'],

  'slack-service': ['node.execute.request'],

  'document-service': ['node.execute.request'],

  'ai-service': ['node.execute.request'],

  'audit-service': [
    'audit.events',
    'employee.onboard.*',
    'employee.exit.*',
    'identity.provision.result',
    'workflow.run.request',
    'node.execute.result',
  ],

  'webhook-gateway': [
    // No subscriptions - this service produces events
  ],

  'scheduler-service': [
    // No subscriptions - this service produces scheduled events
  ],
};
