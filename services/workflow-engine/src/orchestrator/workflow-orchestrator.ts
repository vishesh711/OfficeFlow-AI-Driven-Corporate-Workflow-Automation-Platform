/**
 * Main workflow orchestration engine
 */

import {
  UUID,
  WorkflowRun,
  ExecutionContext,
  WorkflowNode,
  WorkflowRepository,
  WorkflowRunRepository,
} from '@officeflow/types';
import { mapWorkflowRunEntityToRun, mapWorkflowRunToEntity } from '../utils/entity-mappers';
import { OfficeFlowProducer } from '@officeflow/kafka';
import { WorkflowStateMachine } from '../state/state-machine';
import { RedisStateManager } from '../state/redis-state-manager';
import { ExecutionContextManager } from '../execution/context-manager';
import { NodeDispatcher } from '../execution/node-dispatcher';
import { WorkflowState } from '../types/workflow-state';
import { WorkflowLoader } from './workflow-loader';
import { WorkflowParser, ParsedWorkflow } from './workflow-parser';
import { ErrorHandler, ErrorHandlingConfig } from '../error-handling';
import { v4 as uuidv4 } from 'uuid';

export interface WorkflowOrchestratorConfig {
  instanceId: string;
  maxConcurrentWorkflows: number;
  nodeExecutionTimeout: number;
  workflowExecutionTimeout: number;
  errorHandling: ErrorHandlingConfig;
}

export class WorkflowOrchestrator {
  private stateMachine: WorkflowStateMachine;
  private workflowLoader: WorkflowLoader;
  private errorHandler: ErrorHandler;
  private isRunning: boolean = false;
  private activeWorkflows: Map<UUID, WorkflowState> = new Map();

  constructor(
    private config: WorkflowOrchestratorConfig,
    private workflowRepo: WorkflowRepository,
    private workflowRunRepo: WorkflowRunRepository,
    private stateManager: RedisStateManager,
    private contextManager: ExecutionContextManager,
    private nodeDispatcher: NodeDispatcher,
    private producer: OfficeFlowProducer
  ) {
    this.stateMachine = new WorkflowStateMachine();
    this.workflowLoader = new WorkflowLoader(workflowRepo);
    this.errorHandler = new ErrorHandler(
      config.errorHandling,
      stateManager,
      nodeDispatcher,
      contextManager,
      producer
    );
  }

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log(`Workflow orchestrator started: ${this.config.instanceId}`);

    // Start background processes
    this.startRetryProcessor();
    this.startTimeoutMonitor();
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    console.log(`Workflow orchestrator stopped: ${this.config.instanceId}`);
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: UUID, context: ExecutionContext): Promise<WorkflowRun> {
    // Load and parse workflow definition
    const parsedWorkflow = await this.workflowLoader.loadWorkflow(workflowId);

    // Create workflow run record
    const runId = uuidv4();
    const workflowRunEntity = mapWorkflowRunToEntity({
      id: runId,
      organizationId: context.organizationId,
      workflowId,
      employeeId: context.employeeId,
      triggerEvent: context.triggerEvent?.type || 'manual',
      status: 'PENDING',
      context,
      startedAt: new Date(),
      correlationId: context.correlationId,
    });

    const createdRunEntity = await this.workflowRunRepo.create(workflowRunEntity);
    const createdRun = mapWorkflowRunEntityToRun(createdRunEntity);

    // Initialize workflow state
    const workflowState: WorkflowState = {
      runId,
      workflowId,
      organizationId: context.organizationId,
      employeeId: context.employeeId,
      status: 'PENDING',
      currentNodes: new Set(),
      completedNodes: new Set(),
      failedNodes: new Set(),
      skippedNodes: new Set(),
      context: context.variables,
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
    };

    // Acquire execution lock
    const lockAcquired = await this.stateManager.acquireLock(runId, this.config.instanceId);

    if (!lockAcquired) {
      throw new Error(`Failed to acquire execution lock for workflow: ${runId}`);
    }

    try {
      // Save initial state
      await this.stateManager.setWorkflowState(workflowState);
      this.activeWorkflows.set(runId, workflowState);

      // Start workflow execution
      await this.startWorkflowExecution(parsedWorkflow, workflowState, context);

      return createdRun;
    } catch (error) {
      // Release lock on error
      await this.stateManager.releaseLock(runId, this.config.instanceId);
      throw error;
    }
  }

  /**
   * Pause workflow execution
   */
  async pauseWorkflow(runId: UUID): Promise<void> {
    const state = await this.getWorkflowState(runId);
    if (!state) {
      throw new Error(`Workflow state not found: ${runId}`);
    }

    if (!this.stateMachine.canTransition(state.status, 'pause', state)) {
      throw new Error(`Cannot pause workflow in status: ${state.status}`);
    }

    const pausedState = this.stateMachine.transitionWorkflow(state, 'pause');
    await this.stateManager.setWorkflowState(pausedState);
    await this.workflowRunRepo.updateStatus(runId, 'PAUSED');

    // Send pause messages to running nodes
    await this.pauseRunningNodes(runId);

    console.log(`Workflow paused: ${runId}`);
  }

  /**
   * Resume workflow execution
   */
  async resumeWorkflow(runId: UUID): Promise<void> {
    const state = await this.getWorkflowState(runId);
    if (!state) {
      throw new Error(`Workflow state not found: ${runId}`);
    }

    if (!this.stateMachine.canTransition(state.status, 'resume', state)) {
      throw new Error(`Cannot resume workflow in status: ${state.status}`);
    }

    const resumedState = this.stateMachine.transitionWorkflow(state, 'resume');
    await this.stateManager.setWorkflowState(resumedState);
    await this.workflowRunRepo.updateStatus(runId, 'RUNNING');

    // Continue execution from current state
    try {
      const parsedWorkflow = await this.workflowLoader.loadWorkflow(state.workflowId);
      const context = this.contextManager.deserializeContext(JSON.stringify(state.context));
      await this.continueWorkflowExecution(parsedWorkflow, resumedState, context);
    } catch (error) {
      console.error(`Failed to resume workflow ${runId}:`, error);
      throw error;
    }

    console.log(`Workflow resumed: ${runId}`);
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflow(runId: UUID): Promise<void> {
    const state = await this.getWorkflowState(runId);
    if (!state) {
      throw new Error(`Workflow state not found: ${runId}`);
    }

    if (!this.stateMachine.canTransition(state.status, 'cancel', state)) {
      throw new Error(`Cannot cancel workflow in status: ${state.status}`);
    }

    const cancelledState = this.stateMachine.transitionWorkflow(state, 'cancel');
    await this.stateManager.setWorkflowState(cancelledState);
    await this.workflowRunRepo.updateStatus(runId, 'CANCELLED');

    // Cancel all running nodes
    await this.cancelRunningNodes(runId);

    // Clean up state
    await this.cleanupWorkflowState(runId);

    console.log(`Workflow cancelled: ${runId}`);
  }

  /**
   * Handle node execution completion
   */
  async handleNodeCompletion(
    runId: UUID,
    nodeId: UUID,
    output: Record<string, any>
  ): Promise<void> {
    const state = await this.getWorkflowState(runId);
    if (!state) {
      console.warn(`Workflow state not found for node completion: ${runId}`);
      return;
    }

    // Update workflow state
    state.completedNodes.add(nodeId);
    state.currentNodes.delete(nodeId);
    state.lastUpdatedAt = new Date();

    await this.stateManager.setWorkflowState(state);

    // Update context with node output
    try {
      const parsedWorkflow = await this.workflowLoader.loadWorkflow(state.workflowId);
      const node = parsedWorkflow.nodeMap.get(nodeId);
      if (node) {
        const context = this.contextManager.deserializeContext(JSON.stringify(state.context));

        const updatedContext = this.contextManager.updateContextWithNodeOutput(
          context,
          nodeId,
          node.name,
          output
        );

        state.context = updatedContext.variables;
        await this.stateManager.setWorkflowState(state);

        // Continue workflow execution
        await this.continueWorkflowExecution(parsedWorkflow, state, updatedContext);
      }
    } catch (error) {
      console.error(`Failed to handle node completion for ${runId}:`, error);
    }
  }

  /**
   * Handle node execution failure
   */
  async handleNodeFailure(runId: UUID, nodeId: UUID, error: any, attempt: number): Promise<void> {
    const state = await this.getWorkflowState(runId);
    if (!state) {
      console.warn(`Workflow state not found for node failure: ${runId}`);
      return;
    }

    try {
      const parsedWorkflow = await this.workflowLoader.loadWorkflow(state.workflowId);
      const node = parsedWorkflow.nodeMap.get(nodeId);
      if (!node) {
        return;
      }

      // Use enhanced error handling
      const errorHandlingResult = await this.errorHandler.handleNodeExecutionError(
        {
          runId,
          nodeId,
          nodeType: node.type,
          error,
          attempt,
          context: {
            organizationId: state.organizationId,
            employeeId: state.employeeId,
            correlationId: state.context.correlationId,
          },
        },
        node
      );

      if (errorHandlingResult.shouldRetry) {
        console.log(
          `Node ${nodeId} will be retried at ${errorHandlingResult.retryAt?.toISOString()}`
        );
        return;
      }

      // Mark node as failed
      state.failedNodes.add(nodeId);
      state.currentNodes.delete(nodeId);
      state.lastUpdatedAt = new Date();

      await this.stateManager.setWorkflowState(state);

      // Check if workflow should fail or continue
      if (errorHandlingResult.shouldFailWorkflow) {
        await this.handleWorkflowFailure(parsedWorkflow, state, error);
      } else {
        await this.evaluateWorkflowContinuation(parsedWorkflow, state);
      }
    } catch (handlingError) {
      console.error(`Failed to handle node failure for ${runId}:`, handlingError);
      // Log system error through error handler
      await this.logSystemError('workflow-orchestrator', handlingError);
    }
  }

  /**
   * Start workflow execution
   */
  private async startWorkflowExecution(
    parsedWorkflow: ParsedWorkflow,
    state: WorkflowState,
    context: ExecutionContext
  ): Promise<void> {
    // Transition to RUNNING
    const runningState = this.stateMachine.transitionWorkflow(state, 'start');
    await this.stateManager.setWorkflowState(runningState);
    await this.workflowRunRepo.updateStatus(state.runId, 'RUNNING');

    // Get entry nodes from parsed workflow
    const entryNodes = parsedWorkflow.entryNodes;

    if (entryNodes.length === 0) {
      throw new Error('No entry nodes found in workflow');
    }

    // Dispatch entry nodes
    await this.dispatchEligibleNodes(parsedWorkflow, runningState, context, entryNodes);
  }

  /**
   * Continue workflow execution after node completion
   */
  private async continueWorkflowExecution(
    parsedWorkflow: ParsedWorkflow,
    state: WorkflowState,
    context: ExecutionContext
  ): Promise<void> {
    if (state.status !== 'RUNNING') {
      return;
    }

    // Find next eligible nodes using parsed workflow
    const eligibleNodes = WorkflowParser.getEligibleNodes(
      parsedWorkflow,
      state.completedNodes,
      state.failedNodes,
      state.currentNodes
    );

    if (eligibleNodes.length > 0) {
      await this.dispatchEligibleNodes(parsedWorkflow, state, context, eligibleNodes);
    } else if (state.currentNodes.size === 0) {
      // No more nodes to execute, check if workflow is complete
      await this.checkWorkflowCompletion(parsedWorkflow, state);
    }
  }

  /**
   * Dispatch eligible nodes for execution
   */
  private async dispatchEligibleNodes(
    parsedWorkflow: ParsedWorkflow,
    state: WorkflowState,
    context: ExecutionContext,
    nodes: WorkflowNode[]
  ): Promise<void> {
    const nodeInputs = new Map<UUID, Record<string, any>>();

    // Prepare input for each node
    for (const node of nodes) {
      const input = this.prepareNodeInput(node, context, state);
      nodeInputs.set(node.id, input);

      // Add to current nodes
      state.currentNodes.add(node.id);
    }

    // Update state
    state.lastUpdatedAt = new Date();
    await this.stateManager.setWorkflowState(state);

    // Dispatch nodes
    await this.nodeDispatcher.dispatchNodes(state.runId, nodes, nodeInputs, context);
  }

  /**
   * Prepare input for node execution
   */
  private prepareNodeInput(
    node: WorkflowNode,
    context: ExecutionContext,
    state: WorkflowState
  ): Record<string, any> {
    // This is a simplified implementation
    // In practice, you'd resolve parameter mappings from the node configuration
    return {
      ...node.params,
      context: context.variables,
      organizationId: context.organizationId,
      employeeId: context.employeeId,
    };
  }

  /**
   * Check if workflow execution is complete
   */
  private async checkWorkflowCompletion(
    parsedWorkflow: ParsedWorkflow,
    state: WorkflowState
  ): Promise<void> {
    const completionStatus = WorkflowParser.isWorkflowComplete(
      parsedWorkflow,
      state.completedNodes,
      state.failedNodes,
      state.skippedNodes
    );

    if (completionStatus.isComplete) {
      const completedState = this.stateMachine.transitionWorkflow(
        state,
        completionStatus.status === 'COMPLETED' ? 'complete' : 'fail'
      );

      await this.stateManager.setWorkflowState(completedState);
      await this.workflowRunRepo.updateStatus(state.runId, completionStatus.status);

      // Clean up state
      await this.cleanupWorkflowState(state.runId);

      console.log(`Workflow ${completionStatus.status.toLowerCase()}: ${state.runId}`);
    }
  }

  /**
   * Get workflow state (from cache or Redis)
   */
  private async getWorkflowState(runId: UUID): Promise<WorkflowState | null> {
    let state = this.activeWorkflows.get(runId);

    if (!state) {
      const redisState = await this.stateManager.getWorkflowState(runId);
      if (redisState) {
        this.activeWorkflows.set(runId, redisState);
        state = redisState;
      }
    }

    return state || null;
  }

  /**
   * Pause running nodes
   */
  private async pauseRunningNodes(runId: UUID): Promise<void> {
    const nodeStates = await this.stateManager.getWorkflowNodeStates(runId);
    const runningNodes = nodeStates.filter((node) => node.status === 'RUNNING');

    for (const nodeState of runningNodes) {
      // Send pause message (implementation depends on node executor capabilities)
      console.log(`Pausing node: ${nodeState.nodeId}`);
    }
  }

  /**
   * Cancel running nodes
   */
  private async cancelRunningNodes(runId: UUID): Promise<void> {
    const nodeStates = await this.stateManager.getWorkflowNodeStates(runId);
    const activeNodes = nodeStates.filter((node) =>
      ['RUNNING', 'QUEUED', 'RETRYING'].includes(node.status)
    );

    for (const nodeState of activeNodes) {
      await this.nodeDispatcher.cancelNode(runId, nodeState.nodeId);
    }
  }

  /**
   * Clean up workflow state after completion
   */
  private async cleanupWorkflowState(runId: UUID): Promise<void> {
    this.activeWorkflows.delete(runId);
    await this.stateManager.releaseLock(runId, this.config.instanceId);

    // Optionally delete state from Redis after some time
    // await this.stateManager.deleteWorkflowState(runId);
  }

  /**
   * Handle workflow failure with compensation
   */
  private async handleWorkflowFailure(
    parsedWorkflow: ParsedWorkflow,
    state: WorkflowState,
    error: any
  ): Promise<void> {
    try {
      // Use enhanced error handling for workflow failure
      const workflowErrorResult = await this.errorHandler.handleWorkflowExecutionError(
        {
          runId: state.runId,
          workflowId: state.workflowId,
          error,
          failedNodes: state.failedNodes,
          completedNodes: state.completedNodes,
          context: state.context,
        },
        parsedWorkflow,
        state
      );

      if (workflowErrorResult.shouldExecuteCompensation && workflowErrorResult.compensationPlan) {
        // Execute compensation flow
        await this.errorHandler.executeCompensation(workflowErrorResult.compensationPlan, state);
      }

      // Mark workflow as failed
      const failedState = this.stateMachine.transitionWorkflow(state, 'fail');
      await this.stateManager.setWorkflowState(failedState);
      await this.workflowRunRepo.updateStatus(state.runId, 'FAILED');

      await this.cleanupWorkflowState(state.runId);
    } catch (compensationError) {
      console.error(`Compensation failed for workflow ${state.runId}:`, compensationError);

      // Still mark workflow as failed even if compensation fails
      const failedState = this.stateMachine.transitionWorkflow(state, 'fail');
      await this.stateManager.setWorkflowState(failedState);
      await this.workflowRunRepo.updateStatus(state.runId, 'FAILED');

      await this.cleanupWorkflowState(state.runId);
    }
  }

  /**
   * Evaluate if workflow should continue after node failure
   */
  private async evaluateWorkflowContinuation(
    parsedWorkflow: ParsedWorkflow,
    state: WorkflowState
  ): Promise<void> {
    if (state.currentNodes.size === 0) {
      // No more nodes running, check if workflow can continue
      const eligibleNodes = WorkflowParser.getEligibleNodes(
        parsedWorkflow,
        state.completedNodes,
        state.failedNodes,
        state.currentNodes
      );

      if (eligibleNodes.length === 0) {
        // No more nodes to execute, workflow failed
        await this.handleWorkflowFailure(
          parsedWorkflow,
          state,
          new Error('No more executable nodes')
        );
      } else {
        // Continue with remaining nodes
        const context = this.contextManager.deserializeContext(JSON.stringify(state.context));
        await this.dispatchEligibleNodes(parsedWorkflow, state, context, eligibleNodes);
      }
    }
  }

  /**
   * Start retry processor (background task)
   */
  private startRetryProcessor(): void {
    const processRetries = async () => {
      if (!this.isRunning) return;

      try {
        const retryNodes = await this.stateManager.getNodesReadyForRetry(50);

        for (const { runId, nodeId } of retryNodes) {
          const nodeState = await this.stateManager.getNodeState(runId, nodeId);
          if (nodeState && nodeState.status === 'RETRYING') {
            // Re-dispatch node
            const workflowState = await this.getWorkflowState(runId);
            if (workflowState) {
              try {
                const parsedWorkflow = await this.workflowLoader.loadWorkflow(
                  workflowState.workflowId
                );
                const node = parsedWorkflow.nodeMap.get(nodeId);

                if (node) {
                  const context = this.contextManager.deserializeContext(
                    JSON.stringify(workflowState.context)
                  );

                  const input = this.prepareNodeInput(node, context, workflowState);
                  await this.nodeDispatcher.dispatchNode(
                    runId,
                    node,
                    input,
                    context,
                    nodeState.attempt
                  );
                }
              } catch (error) {
                console.error(`Failed to retry node ${nodeId} for workflow ${runId}:`, error);
              }
            }
          }

          // Remove from retry schedule
          await this.stateManager.removeFromRetrySchedule(runId, nodeId);
        }
      } catch (error) {
        console.error('Error processing retries:', error);
      }

      // Schedule next run
      setTimeout(processRetries, 5000); // Check every 5 seconds
    };

    processRetries();
  }

  /**
   * Start timeout monitor (background task)
   */
  private startTimeoutMonitor(): void {
    const checkTimeouts = async () => {
      if (!this.isRunning) return;

      try {
        // Check for timed out workflows and nodes
        // This is a simplified implementation
        console.log('Checking for timeouts...');
      } catch (error) {
        console.error('Error checking timeouts:', error);
      }

      // Schedule next run
      setTimeout(checkTimeouts, 30000); // Check every 30 seconds
    };

    checkTimeouts();
  }

  /**
   * Log system error through error handler
   */
  private async logSystemError(component: string, error: any): Promise<void> {
    try {
      await this.errorHandler.logSystemError(component, error);
    } catch (logError) {
      console.error('Failed to log system error:', logError);
    }
  }
}
