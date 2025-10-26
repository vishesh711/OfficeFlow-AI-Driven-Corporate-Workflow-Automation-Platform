/**
 * Workflow engine configuration
 */

import { WorkflowEngineConfig } from '../services/workflow-engine-service';
import { getErrorHandlingConfig } from './error-handling-config';

export function createWorkflowEngineConfig(): WorkflowEngineConfig {
  return {
    instanceId: process.env.INSTANCE_ID || `workflow-engine-${Date.now()}`,
    
    orchestrator: {
      instanceId: process.env.INSTANCE_ID || `orchestrator-${Date.now()}`,
      maxConcurrentWorkflows: parseInt(process.env.MAX_CONCURRENT_WORKFLOWS || '100'),
      nodeExecutionTimeout: parseInt(process.env.NODE_EXECUTION_TIMEOUT || '300000'), // 5 minutes
      workflowExecutionTimeout: parseInt(process.env.WORKFLOW_EXECUTION_TIMEOUT || '3600000'), // 1 hour
      errorHandling: getErrorHandlingConfig(process.env.NODE_ENV || 'development'),
    },

    stateManager: {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'officeflow:',
        cluster: {
          enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
          nodes: process.env.REDIS_CLUSTER_NODES 
            ? process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
                const [host, port] = node.split(':');
                return { host, port: parseInt(port) };
              })
            : undefined,
          options: {
            enableReadyCheck: process.env.REDIS_CLUSTER_READY_CHECK !== 'false',
            redisOptions: {
              password: process.env.REDIS_PASSWORD,
            },
          },
        },
        sentinel: {
          enabled: process.env.REDIS_SENTINEL_ENABLED === 'true',
          sentinels: process.env.REDIS_SENTINEL_NODES
            ? process.env.REDIS_SENTINEL_NODES.split(',').map(node => {
                const [host, port] = node.split(':');
                return { host, port: parseInt(port) };
              })
            : undefined,
          name: process.env.REDIS_SENTINEL_NAME || 'mymaster',
        },
      },
      ttl: {
        workflowState: parseInt(process.env.WORKFLOW_STATE_TTL || '86400'), // 24 hours
        nodeState: parseInt(process.env.NODE_STATE_TTL || '86400'), // 24 hours
        lockTimeout: parseInt(process.env.LOCK_TIMEOUT || '300'), // 5 minutes
        retrySchedule: parseInt(process.env.RETRY_SCHEDULE_TTL || '604800'), // 7 days
      },
      monitoring: {
        enableMetrics: process.env.REDIS_METRICS_ENABLED !== 'false',
        metricsPrefix: process.env.REDIS_METRICS_PREFIX || 'officeflow_redis',
      },
    },

    kafka: {
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      clientId: process.env.KAFKA_CLIENT_ID || 'workflow-engine',
      groupId: process.env.KAFKA_GROUP_ID || 'workflow-engine-group',
    },
  };
}

export const config = createWorkflowEngineConfig();