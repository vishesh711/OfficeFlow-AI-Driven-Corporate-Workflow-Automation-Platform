/**
 * Compensation flow execution for failed workflows
 */

import { UUID, WorkflowNode } from '@officeflow/types';
import { WorkflowParser, ParsedWorkflow } from '../orchestrator/workflow-parser';
import { WorkflowState, NodeState } from '../types/workflow-state';
import { RedisStateManager } from '../state/redis-state-manager';
import { NodeDispatcher } from '../execution/node-dispatcher';
import { ExecutionContextManager } from '../execution/context-manager';

export interface CompensationNode extends WorkflowNode {
  compensatesFor: UUID[]; // Array of node IDs this compensates for
  compensationType: 'rollback' | 'cleanup' | 'notification' | 'custom';
  compensationOrder: number; // Execution order for compensation (higher = later)
}

export interface CompensationPlan {
  workflowId: UUID;
  runId: UUID;
  compensationNodes: CompensationNode[];
  executionOrder: UUID[]; // Ordered list of compensation node IDs
  failedNodes: Set<UUID>;
  completedNodes: Set<UUID>;
}

export class CompensationManager {
  constructor(
    private stateManager: RedisStateManager,
    private nodeDispatcher: NodeDispatcher,
    private contextManager: ExecutionContextManager
  ) {}

  /**
   * Create compensation plan for failed workflow
   */
  async createCompensationPlan(
    parsedWorkflow: ParsedWorkflow,
    workflowState: WorkflowState
  ): Promise<CompensationPlan | null> {
    const compensationNodes = this.findCompensationNodes(
      parsedWorkflow,
      workflowState.completedNodes,
      workflowState.failedNodes
    );

    if (compensationNodes.length === 0) {
      console.log(`No compensation nodes found for workflow: ${workflowState.runId}`);
      return null;
    }

    // Order compensation nodes by compensation order (reverse execution order)
    const orderedNodes = this.orderCompensationNodes(compensationNodes);

    const plan: CompensationPlan = {
      workflowId: workflowState.workflowId,
      runId: workflowState.runId,
      compensationNodes,
      executionOrder: orderedNodes.map(node => node.id),
      failedNodes: workflowState.failedNodes,
      completedNodes: workflowState.completedNodes,
    };

    console.log(`Created compensation plan for workflow ${workflowState.runId}:`, {
      compensationNodeCount: compensationNodes.length,
      executionOrder: plan.executionOrder,
    });

    return plan;
  }

  /**
   * Execute compensation plan
   */
  async executeCompensationPlan(
    plan: CompensationPlan,
    workflowState: WorkflowState
  ): Promise<void> {
    console.log(`Starting compensation execution for workflow: ${plan.runId}`);

    // Update workflow state to COMPENSATING
    const compensatingState: WorkflowState = {
      ...workflowState,
      status: 'COMPENSATING',
      lastUpdatedAt: new Date(),
    };

    await this.stateManager.setWorkflowState(compensatingState);

    try {
      // Execute compensation nodes in order
      for (const nodeId of plan.executionOrder) {
        const compensationNode = plan.compensationNodes.find(n => n.id === nodeId);
        if (!compensationNode) {
          continue;
        }

        await this.executeCompensationNode(
          compensationNode,
          plan,
          compensatingState
        );
      }

      console.log(`Compensation execution completed for workflow: ${plan.runId}`);

    } catch (error) {
      console.error(`Compensation execution failed for workflow ${plan.runId}:`, error);
      throw error;
    }
  }

  /**
   * Execute a single compensation node
   */
  private async executeCompensationNode(
    compensationNode: CompensationNode,
    plan: CompensationPlan,
    workflowState: WorkflowState
  ): Promise<void> {
    console.log(`Executing compensation node: ${compensationNode.id} (${compensationNode.compensationType})`);

    // Prepare compensation context
    const context = this.contextManager.deserializeContext(
      JSON.stringify(workflowState.context)
    );

    // Add compensation-specific context
    const compensationContext = {
      ...context.variables,
      compensation: {
        type: compensationNode.compensationType,
        compensatesFor: compensationNode.compensatesFor,
        failedNodes: Array.from(plan.failedNodes),
        completedNodes: Array.from(plan.completedNodes),
      },
    };

    // Prepare node input
    const nodeInput = {
      ...compensationNode.params,
      context: compensationContext,
      organizationId: workflowState.organizationId,
      employeeId: workflowState.employeeId,
    };

    try {
      // Dispatch compensation node
      await this.nodeDispatcher.dispatchNode(
        plan.runId,
        compensationNode,
        nodeInput,
        { ...context, variables: compensationContext },
        1 // First attempt
      );

      // Wait for completion (simplified - in practice, this would be event-driven)
      await this.waitForCompensationNodeCompletion(
        plan.runId,
        compensationNode.id,
        30000 // 30 second timeout
      );

    } catch (error) {
      console.error(`Compensation node ${compensationNode.id} failed:`, error);
      
      // Decide whether to continue or abort compensation
      if (this.shouldContinueCompensationOnFailure(compensationNode)) {
        console.warn(`Continuing compensation despite node failure: ${compensationNode.id}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Find compensation nodes for completed nodes
   */
  private findCompensationNodes(
    parsedWorkflow: ParsedWorkflow,
    completedNodes: Set<UUID>,
    failedNodes: Set<UUID>
  ): CompensationNode[] {
    const compensationNodes: CompensationNode[] = [];

    // Look for nodes that have compensation type
    for (const node of parsedWorkflow.definition.definition.nodes) {
      if (this.isCompensationNode(node)) {
        const compensationNode = node as CompensationNode;
        
        // Check if this compensation node should be executed
        if (this.shouldExecuteCompensation(compensationNode, completedNodes, failedNodes)) {
          compensationNodes.push(compensationNode);
        }
      }
    }

    return compensationNodes;
  }

  /**
   * Check if a node is a compensation node
   */
  private isCompensationNode(node: WorkflowNode): boolean {
    return node.type === 'compensation' || 
           (node.params && node.params.compensationType) ||
           (node.params && node.params.compensatesFor);
  }

  /**
   * Check if compensation should be executed
   */
  private shouldExecuteCompensation(
    compensationNode: CompensationNode,
    completedNodes: Set<UUID>,
    failedNodes: Set<UUID>
  ): boolean {
    // Execute if any of the nodes it compensates for were completed
    return compensationNode.compensatesFor.some(nodeId => 
      completedNodes.has(nodeId) || failedNodes.has(nodeId)
    );
  }

  /**
   * Order compensation nodes by execution order
   */
  private orderCompensationNodes(compensationNodes: CompensationNode[]): CompensationNode[] {
    return compensationNodes.sort((a, b) => {
      // Sort by compensation order (higher order executes later)
      const orderA = a.compensationOrder || 0;
      const orderB = b.compensationOrder || 0;
      return orderB - orderA; // Reverse order for compensation
    });
  }

  /**
   * Wait for compensation node completion
   */
  private async waitForCompensationNodeCompletion(
    runId: UUID,
    nodeId: UUID,
    timeoutMs: number
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const nodeState = await this.stateManager.getNodeState(runId, nodeId);
      
      if (nodeState) {
        if (nodeState.status === 'COMPLETED') {
          return;
        } else if (nodeState.status === 'FAILED') {
          throw new Error(`Compensation node ${nodeId} failed`);
        }
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Compensation node ${nodeId} timed out`);
  }

  /**
   * Determine if compensation should continue on node failure
   */
  private shouldContinueCompensationOnFailure(compensationNode: CompensationNode): boolean {
    // Continue for cleanup and notification types, but not for rollback
    return compensationNode.compensationType === 'cleanup' || 
           compensationNode.compensationType === 'notification';
  }

  /**
   * Create automatic compensation nodes for standard operations
   */
  createAutomaticCompensationNodes(
    completedNodes: WorkflowNode[],
    workflowId: UUID
  ): CompensationNode[] {
    const compensationNodes: CompensationNode[] = [];

    for (const node of completedNodes) {
      const compensationNode = this.createCompensationForNode(node, workflowId);
      if (compensationNode) {
        compensationNodes.push(compensationNode);
      }
    }

    return compensationNodes;
  }

  /**
   * Create compensation node for a specific node type
   */
  private createCompensationForNode(
    node: WorkflowNode,
    workflowId: UUID
  ): CompensationNode | null {
    const compensationId = `${node.id}_compensation`;

    switch (node.type) {
      case 'identity.provision':
        return {
          id: compensationId,
          type: 'identity.deprovision',
          name: `Compensation for ${node.name}`,
          description: `Compensation for ${node.name}`,
          params: {
            ...node.params,
            compensationType: 'rollback',
          },
          retryPolicy: node.retryPolicy,
          timeoutMs: node.timeoutMs,
          position: { x: 0, y: 0 },
          compensatesFor: [node.id],
          compensationType: 'rollback',
          compensationOrder: 100,
        };

      case 'email.send':
        return {
          id: compensationId,
          type: 'email.send',
          name: `Notification for ${node.name} rollback`,
          description: `Notification for ${node.name} rollback`,
          params: {
            template: 'workflow_rollback_notification',
            compensationType: 'notification',
          },
          retryPolicy: node.retryPolicy,
          timeoutMs: node.timeoutMs,
          position: { x: 0, y: 0 },
          compensatesFor: [node.id],
          compensationType: 'notification',
          compensationOrder: 10,
        };

      case 'document.distribute':
        return {
          id: compensationId,
          type: 'compensation',
          name: `Cleanup for ${node.name}`,
          description: `Cleanup for ${node.name}`,
          params: {
            ...node.params,
            compensationType: 'cleanup',
            originalNodeType: 'document.distribute',
          },
          retryPolicy: node.retryPolicy,
          timeoutMs: node.timeoutMs,
          position: { x: 0, y: 0 },
          compensatesFor: [node.id],
          compensationType: 'cleanup',
          compensationOrder: 50,
        };

      default:
        // No automatic compensation for other node types
        return null;
    }
  }

  /**
   * Get compensation statistics
   */
  async getCompensationStatistics(organizationId?: UUID): Promise<{
    totalCompensationExecutions: number;
    successfulCompensations: number;
    failedCompensations: number;
    compensationsByType: Record<string, number>;
  }> {
    // This would require additional tracking in Redis
    // For now, return placeholder data
    return {
      totalCompensationExecutions: 0,
      successfulCompensations: 0,
      failedCompensations: 0,
      compensationsByType: {},
    };
  }
}