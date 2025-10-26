/**
 * Main workflow engine service implementation
 */

import {
  UUID,
  WorkflowEngine,
  WorkflowRun,
  ExecutionContext
} from '@officeflow/types';
import {
  WorkflowRepository,
  WorkflowRunRepository,
  EmployeeRepository
} from '@officeflow/types';
import { OfficeFlowProducer, OfficeFlowConsumer } from '@officeflow/kafka';
import { WorkflowOrchestrator, WorkflowOrchestratorConfig } from '../orchestrator/workflow-orchestrator';
import { RedisStateManager, StateManagerConfig } from '../state/redis-state-manager';
import { RedisClusterManager } from '../state/redis-cluster-manager';
import { ExecutionContextManager } from '../execution/context-manager';
import { NodeDispatcher, NodeExecutionResult } from '../execution/node-dispatcher';
import { WorkflowLoader } from '../orchestrator/workflow-loader';
import { mapWorkflowRunEntityToRun } from '../utils/entity-mappers';

export interface WorkflowEngineConfig {
  instanceId?: string;
  orchestrator: WorkflowOrchestratorConfig;
  stateManager: StateManagerConfig;
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
  };
}

export class WorkflowEngineService implements WorkflowEngine {
  private orchestrator!: WorkflowOrchestrator;
  private stateManager!: RedisStateManager;
  private clusterManager!: RedisClusterManager;
  private contextManager!: ExecutionContextManager;
  private nodeDispatcher!: NodeDispatcher;
  private workflowLoader!: WorkflowLoader;
  private producer!: OfficeFlowProducer;
  private consumer!: OfficeFlowConsumer;
  private isRunning: boolean = false;

  constructor(
    private config: WorkflowEngineConfig,
    private workflowRepo: WorkflowRepository,
    private workflowRunRepo: WorkflowRunRepository,
    private _employeeRepo: EmployeeRepository
  ) {
    this.initializeComponents();
  }

  /**
   * Initialize all components
   */
  private initializeComponents(): void {
    // Initialize state manager
    this.stateManager = new RedisStateManager(this.config.stateManager);

    // Initialize cluster manager
    this.clusterManager = new RedisClusterManager(this.stateManager);

    // Initialize context manager
    this.contextManager = new ExecutionContextManager(this.stateManager);

    // Initialize workflow loader
    this.workflowLoader = new WorkflowLoader(this.workflowRepo);

    // Initialize Kafka producer
    this.producer = new OfficeFlowProducer({
      clientId: this.config.kafka.clientId,
      brokers: this.config.kafka.brokers,
    });

    // Initialize node dispatcher
    this.nodeDispatcher = new NodeDispatcher(
      this.producer,
      this.contextManager,
      this.stateManager
    );

    // Initialize orchestrator
    this.orchestrator = new WorkflowOrchestrator(
      this.config.orchestrator,
      this.workflowRepo,
      this.workflowRunRepo,
      this.stateManager,
      this.contextManager,
      this.nodeDispatcher,
      this.producer
    );

    // Initialize Kafka consumer
    this.consumer = new OfficeFlowConsumer(
      {
        clientId: this.config.kafka.clientId,
        brokers: this.config.kafka.brokers,
      },
      {
        groupId: this.config.kafka.groupId,
      }
    );

    this.setupMessageHandlers();
  }

  /**
   * Start the workflow engine service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    console.log('Starting Workflow Engine Service...');

    try {
      // Connect to Kafka
      await this.producer.connect();
      await this.consumer.connect();

      // Subscribe to topics
      await this.consumer.subscribe({
        topics: [
          /^employee\.(onboard|exit|transfer|update)\..+$/,
          'workflow.run.pause',
          'workflow.run.resume',
          'workflow.run.cancel',
          'node.execute.result',
        ],
      });

      // Start consumer
      await this.consumer.run();

      // Start orchestrator
      await this.orchestrator.start();

      // Start workflow loader cache cleanup
      this.workflowLoader.startCacheCleanup();

      this.isRunning = true;
      console.log('Workflow Engine Service started successfully');

    } catch (error) {
      console.error('Failed to start Workflow Engine Service:', error);
      throw error;
    }
  }

  /**
   * Stop the workflow engine service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping Workflow Engine Service...');

    try {
      // Stop orchestrator
      await this.orchestrator.stop();

      // Disconnect from Kafka
      await this.consumer.disconnect();
      await this.producer.disconnect();

      // Disconnect from Redis
      await this.stateManager.disconnect();

      this.isRunning = false;
      console.log('Workflow Engine Service stopped successfully');

    } catch (error) {
      console.error('Error stopping Workflow Engine Service:', error);
      throw error;
    }
  }

  /**
   * Process lifecycle event and trigger workflows
   */
  async processLifecycleEvent(event: any): Promise<WorkflowRun> {
    console.log('Processing lifecycle event:', {
      type: event.type,
      organizationId: event.organizationId,
      employeeId: event.employeeId,
    });

    // Find workflows triggered by this event type using the loader
    const parsedWorkflows = await this.workflowLoader.loadWorkflowsByTrigger(
      event.type,
      event.organizationId
    );

    if (parsedWorkflows.length === 0) {
      throw new Error(`No active workflows found for event type: ${event.type}`);
    }

    // For now, execute the first workflow
    // In production, you might want to execute all matching workflows
    const workflow = parsedWorkflows[0].definition;

    // Create execution context
    const context = this.contextManager.createInitialContext(
      event.organizationId,
      event.employeeId,
      event,
      {} // Additional workflow variables
    );

    // Execute workflow
    return this.executeWorkflow(workflow.id, context);
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: UUID, context: ExecutionContext): Promise<WorkflowRun> {
    console.log('Executing workflow:', {
      workflowId,
      organizationId: context.organizationId,
      employeeId: context.employeeId,
    });

    return this.orchestrator.executeWorkflow(workflowId, context);
  }

  /**
   * Pause workflow execution
   */
  async pauseWorkflow(runId: UUID): Promise<void> {
    console.log('Pausing workflow:', runId);
    return this.orchestrator.pauseWorkflow(runId);
  }

  /**
   * Resume workflow execution
   */
  async resumeWorkflow(runId: UUID): Promise<void> {
    console.log('Resuming workflow:', runId);
    return this.orchestrator.resumeWorkflow(runId);
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflow(runId: UUID): Promise<void> {
    console.log('Cancelling workflow:', runId);
    return this.orchestrator.cancelWorkflow(runId);
  }

  /**
   * Get workflow run details
   */
  async getWorkflowRun(runId: UUID): Promise<WorkflowRun | null> {
    const entity = await this.workflowRunRepo.findById(runId);
    return entity ? mapWorkflowRunEntityToRun(entity) : null;
  }

  /**
   * Get workflow run history
   */
  async getWorkflowRunHistory(workflowId: UUID, _limit?: number): Promise<WorkflowRun[]> {
    const entities = await this.workflowRunRepo.findByWorkflow(workflowId);
    return entities.map(mapWorkflowRunEntityToRun);
  }

  /**
   * Setup Kafka message handlers
   */
  private setupMessageHandlers(): void {
    // Handle lifecycle events
    this.consumer.registerHandler('employee.onboard', async (message, _context) => {
      try {
        await this.processLifecycleEvent(message.payload);
      } catch (error) {
        console.error('Failed to process onboard event:', error);
        throw error;
      }
    });

    this.consumer.registerHandler('employee.exit', async (message, _context) => {
      try {
        await this.processLifecycleEvent(message.payload);
      } catch (error) {
        console.error('Failed to process exit event:', error);
        throw error;
      }
    });

    this.consumer.registerHandler('employee.transfer', async (message, _context) => {
      try {
        await this.processLifecycleEvent(message.payload);
      } catch (error) {
        console.error('Failed to process transfer event:', error);
        throw error;
      }
    });

    this.consumer.registerHandler('employee.update', async (message, _context) => {
      try {
        await this.processLifecycleEvent(message.payload);
      } catch (error) {
        console.error('Failed to process update event:', error);
        throw error;
      }
    });

    // Handle workflow control messages
    this.consumer.registerHandler('workflow.pause', async (message, _context) => {
      try {
        const payload = message.payload as { runId: string };
        await this.pauseWorkflow(payload.runId);
      } catch (error) {
        console.error('Failed to pause workflow:', error);
        throw error;
      }
    });

    this.consumer.registerHandler('workflow.resume', async (message, _context) => {
      try {
        const payload = message.payload as { runId: string };
        await this.resumeWorkflow(payload.runId);
      } catch (error) {
        console.error('Failed to resume workflow:', error);
        throw error;
      }
    });

    this.consumer.registerHandler('workflow.cancel', async (message, _context) => {
      try {
        const payload = message.payload as { runId: string };
        await this.cancelWorkflow(payload.runId);
      } catch (error) {
        console.error('Failed to cancel workflow:', error);
        throw error;
      }
    });

    // Handle node execution results
    this.consumer.registerHandler('node.execute.result', async (message, _context) => {
      try {
        const result = message.payload as NodeExecutionResult;

        // Handle result based on status
        if (result.status === 'success') {
          await this.orchestrator.handleNodeCompletion(
            result.runId,
            result.nodeId,
            result.output || {}
          );
        } else {
          await this.orchestrator.handleNodeFailure(
            result.runId,
            result.nodeId,
            result.error,
            result.metadata.attempt
          );
        }

        // Update node dispatcher with result
        await this.nodeDispatcher.handleNodeResult(result);

      } catch (error) {
        console.error('Failed to handle node execution result:', error);
        throw error;
      }
    });
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    components: Record<string, 'up' | 'down'>;
    metrics: Record<string, number>;
    redis?: {
      latencyMs?: number;
      memoryUsage?: string;
      connectedClients?: number;
    };
  }> {
    const components: Record<string, 'up' | 'down'> = {};
    const metrics: Record<string, number> = {};
    let redisHealth;

    try {
      // Check Redis connection health
      const connectionHealth = await this.stateManager.getConnectionHealth();
      components.redis = connectionHealth.status === 'connected' ? 'up' : 'down';
      
      redisHealth = {
        latencyMs: connectionHealth.latencyMs,
        memoryUsage: connectionHealth.memoryUsage,
        connectedClients: connectionHealth.connectedClients,
      };

      // Get workflow metrics
      const workflowStats = await this.stateManager.getWorkflowStats();
      metrics.activeWorkflows = workflowStats.totalActiveWorkflows;
      metrics.scheduledRetries = workflowStats.totalScheduledRetries;
      metrics.queuedNodes = Object.values(workflowStats.nodeStatusCounts).reduce((sum, count) => sum + count, 0);
    } catch (error) {
      console.error('Failed to get Redis health:', error);
      components.redis = 'down';
    }

    // Check if service is running
    components.orchestrator = this.isRunning ? 'up' : 'down';
    components.kafka = this.isRunning ? 'up' : 'down';

    const allUp = Object.values(components).every(status => status === 'up');

    return {
      status: allUp ? 'healthy' : 'unhealthy',
      components,
      metrics,
      redis: redisHealth,
    };
  }

  /**
   * Get detailed workflow statistics
   */
  async getWorkflowStatistics(organizationId?: UUID): Promise<{
    totalWorkflows: number;
    activeWorkflows: number;
    completedWorkflows: number;
    failedWorkflows: number;
    nodeStatusBreakdown: Record<string, number>;
    avgExecutionTime?: number;
    retryStatistics: {
      totalScheduled: number;
      readyForRetry: number;
    };
  }> {
    try {
      const stats = await this.stateManager.getWorkflowStats(organizationId);
      const retryNodes = await this.stateManager.getNodesReadyForRetry(1000);

      return {
        totalWorkflows: stats.totalActiveWorkflows,
        activeWorkflows: stats.totalActiveWorkflows,
        completedWorkflows: 0, // Would need database query
        failedWorkflows: 0, // Would need database query
        nodeStatusBreakdown: stats.nodeStatusCounts,
        retryStatistics: {
          totalScheduled: stats.totalScheduledRetries,
          readyForRetry: retryNodes.length,
        },
      };
    } catch (error) {
      console.error('Failed to get workflow statistics:', error);
      return {
        totalWorkflows: 0,
        activeWorkflows: 0,
        completedWorkflows: 0,
        failedWorkflows: 0,
        nodeStatusBreakdown: {},
        retryStatistics: {
          totalScheduled: 0,
          readyForRetry: 0,
        },
      };
    }
  }

  /**
   * Get Redis cluster health
   */
  async getClusterHealth() {
    return this.clusterManager.getClusterHealth();
  }

  /**
   * Get cluster performance metrics
   */
  async getClusterMetrics() {
    return this.clusterManager.getPerformanceMetrics();
  }

  /**
   * Perform maintenance operations
   */
  async performMaintenance(): Promise<{
    cleanedRetries: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let cleanedRetries = 0;

    try {
      const maintenanceResult = await this.clusterManager.performMaintenance();
      cleanedRetries = maintenanceResult.cleanedRetries;
    } catch (error) {
      errors.push(`Failed to perform cluster maintenance: ${error}`);
    }

    return {
      cleanedRetries,
      errors,
    };
  }
}