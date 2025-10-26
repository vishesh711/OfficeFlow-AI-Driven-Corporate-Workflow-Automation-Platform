/**
 * Node execution dispatcher with Kafka message publishing
 */

import { UUID, WorkflowNode, NodeType } from '@officeflow/types';
import { OfficeFlowProducer } from '@officeflow/kafka';
import { ExecutionContextManager } from './context-manager';
import { RedisStateManager } from '../state/redis-state-manager';
import { NodeState } from '../types/workflow-state';

export interface NodeExecutionRequest {
  runId: UUID;
  nodeId: UUID;
  organizationId: UUID;
  employeeId: UUID;
  nodeType: NodeType;
  input: Record<string, any>;
  context: Record<string, any>;
  idempotencyKey: string;
  retryAttempt: number;
  timeoutMs: number;
}

export interface NodeExecutionResult {
  runId: UUID;
  nodeId: UUID;
  status: 'success' | 'failed' | 'retry';
  output?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    executionTimeMs: number;
    nodeType: NodeType;
    attempt: number;
    timestamp: Date;
  };
}

export class NodeDispatcher {
  private readonly topicMapping: Map<NodeType, string> = new Map([
    ['identity.provision', 'identity.provision.request'],
    ['identity.deprovision', 'identity.provision.request'],
    ['email.send', 'email.send.request'],
    ['calendar.schedule', 'calendar.schedule.request'],
    ['slack.message', 'slack.message.request'],
    ['slack.channel_invite', 'slack.channel.request'],
    ['document.distribute', 'document.distribute.request'],
    ['ai.generate_content', 'ai.generate.request'],
    ['webhook.call', 'webhook.call.request'],
  ]);

  constructor(
    private producer: OfficeFlowProducer,
    private contextManager: ExecutionContextManager,
    private stateManager: RedisStateManager
  ) {}

  /**
   * Dispatch node for execution
   */
  async dispatchNode(
    runId: UUID,
    node: WorkflowNode,
    input: Record<string, any>,
    context: Record<string, any>,
    attempt: number = 1
  ): Promise<void> {
    const idempotencyKey = this.generateIdempotencyKey(runId, node.id, attempt);
    
    // Create node execution request
    const executionRequest: NodeExecutionRequest = {
      runId,
      nodeId: node.id,
      organizationId: context.organizationId,
      employeeId: context.employeeId,
      nodeType: node.type,
      input,
      context,
      idempotencyKey,
      retryAttempt: attempt,
      timeoutMs: node.timeoutMs,
    };

    // Update node state to RUNNING
    const nodeState: NodeState = {
      nodeId: node.id,
      runId,
      status: 'RUNNING',
      attempt,
      input,
      startedAt: new Date(),
    };

    await this.stateManager.setNodeState(nodeState);

    // Determine target topic based on node type
    const topic = this.getTopicForNodeType(node.type);
    
    try {
      // Send execution request to Kafka
      await this.producer.sendMessage(
        topic,
        {
          type: 'node.execute.request',
          payload: executionRequest,
          metadata: {
            correlationId: context.correlationId,
            organizationId: context.organizationId,
            employeeId: context.employeeId,
            source: 'workflow-engine',
            version: '1.0',
          },
        },
        undefined,
        idempotencyKey
      );

      console.log(`Node dispatched for execution:`, {
        runId,
        nodeId: node.id,
        nodeType: node.type,
        topic,
        attempt,
        idempotencyKey,
      });

    } catch (error) {
      console.error('Failed to dispatch node:', error);
      
      // Update node state to FAILED
      const failedState: NodeState = {
        ...nodeState,
        status: 'FAILED',
        errorDetails: {
          code: 'DISPATCH_FAILED',
          message: 'Failed to send execution request to Kafka',
          details: error,
        },
        endedAt: new Date(),
      };

      await this.stateManager.setNodeState(failedState);
      throw error;
    }
  }

  /**
   * Dispatch multiple nodes in parallel
   */
  async dispatchNodes(
    runId: UUID,
    nodes: WorkflowNode[],
    nodeInputs: Map<UUID, Record<string, any>>,
    context: Record<string, any>
  ): Promise<void> {
    const dispatchPromises = nodes.map(node => {
      const input = nodeInputs.get(node.id) || {};
      return this.dispatchNode(runId, node, input, context);
    });

    try {
      await Promise.all(dispatchPromises);
      console.log(`Successfully dispatched ${nodes.length} nodes for execution`);
    } catch (error) {
      console.error('Failed to dispatch some nodes:', error);
      throw error;
    }
  }

  /**
   * Handle node execution result
   */
  async handleNodeResult(result: NodeExecutionResult): Promise<void> {
    const { runId, nodeId, status, output, error } = result;

    try {
      // Get current node state
      const currentState = await this.stateManager.getNodeState(runId, nodeId);
      if (!currentState) {
        console.warn(`Node state not found for result: ${runId}:${nodeId}`);
        return;
      }

      // Update node state based on result
      const updatedState: NodeState = {
        ...currentState,
        status: this.mapResultStatusToNodeStatus(status),
        output,
        errorDetails: error,
        endedAt: new Date(),
      };

      await this.stateManager.setNodeState(updatedState);

      console.log(`Node execution result processed:`, {
        runId,
        nodeId,
        status,
        executionTimeMs: result.metadata.executionTimeMs,
      });

    } catch (error) {
      console.error('Failed to handle node result:', error);
      throw error;
    }
  }

  /**
   * Schedule node retry
   */
  async scheduleNodeRetry(
    runId: UUID,
    nodeId: UUID,
    retryAttempt: number,
    retryDelayMs: number
  ): Promise<void> {
    const retryAt = new Date(Date.now() + retryDelayMs);
    
    // Update node state to RETRYING
    const currentState = await this.stateManager.getNodeState(runId, nodeId);
    if (currentState) {
      const retryState: NodeState = {
        ...currentState,
        status: 'RETRYING',
        attempt: retryAttempt,
        nextRetryAt: retryAt,
      };

      await this.stateManager.setNodeState(retryState);
    }

    // Schedule retry in Redis
    await this.stateManager.scheduleRetry(runId, nodeId, retryAt);

    console.log(`Node retry scheduled:`, {
      runId,
      nodeId,
      retryAttempt,
      retryAt: retryAt.toISOString(),
    });
  }

  /**
   * Cancel node execution
   */
  async cancelNode(runId: UUID, nodeId: UUID): Promise<void> {
    // Update node state to CANCELLED
    const currentState = await this.stateManager.getNodeState(runId, nodeId);
    if (currentState) {
      const cancelledState: NodeState = {
        ...currentState,
        status: 'CANCELLED',
        endedAt: new Date(),
      };

      await this.stateManager.setNodeState(cancelledState);
    }

    // Send cancellation message
    try {
      await this.producer.sendMessage(
        'node.execute.cancel',
        {
          type: 'node.execute.cancel',
          payload: {
            runId,
            nodeId,
            reason: 'Workflow cancelled',
          },
        }
      );
    } catch (error) {
      console.error('Failed to send node cancellation message:', error);
    }

    console.log(`Node execution cancelled: ${runId}:${nodeId}`);
  }

  /**
   * Get topic name for node type
   */
  private getTopicForNodeType(nodeType: NodeType): string {
    const topic = this.topicMapping.get(nodeType);
    if (!topic) {
      throw new Error(`No topic mapping found for node type: ${nodeType}`);
    }
    return topic;
  }

  /**
   * Map execution result status to node status
   */
  private mapResultStatusToNodeStatus(resultStatus: string): NodeState['status'] {
    switch (resultStatus) {
      case 'success':
        return 'COMPLETED';
      case 'failed':
        return 'FAILED';
      case 'retry':
        return 'RETRYING';
      default:
        return 'FAILED';
    }
  }

  /**
   * Generate idempotency key for node execution
   */
  private generateIdempotencyKey(runId: UUID, nodeId: UUID, attempt: number): string {
    return `${runId}:${nodeId}:${attempt}`;
  }

  /**
   * Check if node type supports cancellation
   */
  private supportsCancellation(nodeType: NodeType): boolean {
    // Some node types might not support cancellation
    const nonCancellableTypes: NodeType[] = ['delay'];
    return !nonCancellableTypes.includes(nodeType);
  }

  /**
   * Get execution timeout for node type
   */
  private getExecutionTimeout(nodeType: NodeType, defaultTimeout: number): number {
    // Different node types might have different default timeouts
    const timeoutMap: Partial<Record<NodeType, number>> = {
      'ai.generate_content': 60000, // 1 minute for AI operations
      'email.send': 30000, // 30 seconds for email
      'webhook.call': 15000, // 15 seconds for webhooks
    };

    return timeoutMap[nodeType] || defaultTimeout;
  }
}