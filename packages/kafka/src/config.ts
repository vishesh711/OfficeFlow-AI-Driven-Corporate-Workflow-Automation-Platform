import { KafkaConfig, ProducerConfig, ConsumerConfig } from 'kafkajs';

export interface KafkaClusterConfig {
  brokers: string[];
  clientId: string;
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: {
    initialRetryTime?: number;
    retries?: number;
  };
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain';
    username: string;
    password: string;
  } | {
    mechanism: 'scram-sha-256';
    username: string;
    password: string;
  } | {
    mechanism: 'scram-sha-512';
    username: string;
    password: string;
  };
}

export interface TopicConfig {
  topic: string;
  numPartitions: number;
  replicationFactor: number;
  configEntries?: Array<{
    name: string;
    value: string;
  }>;
}

export interface ConsumerGroupConfig {
  groupId: string;
  sessionTimeout?: number;
  rebalanceTimeout?: number;
  heartbeatInterval?: number;
  maxBytesPerPartition?: number;
  minBytes?: number;
  maxBytes?: number;
  maxWaitTimeInMs?: number;
  retry?: {
    initialRetryTime?: number;
    retries?: number;
  };
  readUncommitted?: boolean;
}

export const defaultKafkaConfig: KafkaConfig = {
  clientId: 'officeflow-platform',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
  connectionTimeout: 3000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
};

export const defaultProducerConfig: ProducerConfig = {
  maxInFlightRequests: 1,
  idempotent: true,
  transactionTimeout: 30000,
  retry: {
    initialRetryTime: 100,
    retries: 5,
  },
};

export const defaultConsumerConfig: Omit<ConsumerConfig, 'groupId'> = {
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
};