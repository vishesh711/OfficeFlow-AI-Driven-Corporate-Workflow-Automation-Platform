import { TopicConfig } from './config';

/**
 * Topic naming convention: {category}.{action}.{org_id}
 * Partitioning strategy: By organization_id for tenant isolation
 */

export const LIFECYCLE_EVENT_TOPICS: Record<string, Omit<TopicConfig, 'topic'>> = {
  'employee.onboard': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 days
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'employee.exit': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '2592000000' }, // 30 days (compliance)
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'employee.transfer': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 days
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'employee.update': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '259200000' }, // 3 days
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
};

export const WORKFLOW_CONTROL_TOPICS: Record<string, Omit<TopicConfig, 'topic'>> = {
  'workflow.run.request': {
    numPartitions: 24,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '86400000' }, // 1 day
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'workflow.run.pause': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '86400000' }, // 1 day
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'workflow.run.resume': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '86400000' }, // 1 day
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'workflow.run.cancel': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '86400000' }, // 1 day
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
};

export const NODE_EXECUTION_TOPICS: Record<string, Omit<TopicConfig, 'topic'>> = {
  'node.execute.request': {
    numPartitions: 24,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '86400000' }, // 1 day
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'node.execute.result': {
    numPartitions: 24,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '259200000' }, // 3 days
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'node.execute.retry': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '86400000' }, // 1 day
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
};

export const INTEGRATION_EVENT_TOPICS: Record<string, Omit<TopicConfig, 'topic'>> = {
  'identity.provision.request': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '86400000' }, // 1 day
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'identity.provision.result': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 days
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'email.send.request': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '86400000' }, // 1 day
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'email.send.result': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '259200000' }, // 3 days
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'calendar.schedule.request': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '86400000' }, // 1 day
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'calendar.schedule.result': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '259200000' }, // 3 days
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
};

export const OBSERVABILITY_TOPICS: Record<string, Omit<TopicConfig, 'topic'>> = {
  'audit.events': {
    numPartitions: 12,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '7776000000' }, // 90 days (compliance)
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'gzip' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'metrics.events': {
    numPartitions: 6,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 days
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
};

// Dead Letter Queue topics - one per main topic
export const DLQ_TOPICS: Record<string, Omit<TopicConfig, 'topic'>> = {
  'dlq.employee.onboard': {
    numPartitions: 3,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '2592000000' }, // 30 days
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'gzip' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'dlq.employee.exit': {
    numPartitions: 3,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '2592000000' }, // 30 days
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'gzip' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
  'dlq.node.execute': {
    numPartitions: 6,
    replicationFactor: 3,
    configEntries: [
      { name: 'retention.ms', value: '2592000000' }, // 30 days
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'gzip' },
      { name: 'min.insync.replicas', value: '2' },
    ],
  },
};

export const ALL_TOPIC_CONFIGS = {
  ...LIFECYCLE_EVENT_TOPICS,
  ...WORKFLOW_CONTROL_TOPICS,
  ...NODE_EXECUTION_TOPICS,
  ...INTEGRATION_EVENT_TOPICS,
  ...OBSERVABILITY_TOPICS,
  ...DLQ_TOPICS,
};