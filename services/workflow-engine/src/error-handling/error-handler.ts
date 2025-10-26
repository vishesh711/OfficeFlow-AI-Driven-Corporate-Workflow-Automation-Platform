/**
 * Enhanced error handling manager that integrates retry, circuit breaker, compensation, and logging
 */

import { UUID, WorkflowNode } from '@officeflow/types';
import { RetryManager, RetryContext } from './retry-manager';
import { CircuitBreakerManager } from './circuit-breaker';
import { CompensationManager } from './compensation-manager';
import { ErrorLogger } from './error-logger';
import { RedisStateManager } from '../state/redis-state-manager';
import { NodeDispatcher } from '../execution/node-dispatcher';
import { ExecutionContextManager } from '../execution/context-manager';
import { OfficeFlowProducer } from '@officeflow/kafka';
import { WorkflowState } from '../types/workflow-state';
import { ParsedWorkflow } from '../orchestrator/workflow-parser';

export interface ErrorHandlingConfig {
  enableRetry: boolean;
  enableCircuitBreaker: boolean;
  enableCompensation: boolean;
  enableAlerting: boolean;
  maxRetryAttempts: number;
  circuitBreakerThreshold: number;
  alertCooldownMs: number;
}

export interface NodeExecutionError {
  runId: UUID;
  nodeId: UUID;
  nodeType: string;
  error: any;
  attempt: number;
  context: Record<string, any>;
  executionTimeMs?: number;
}

export interface WorkflowExecutionError {
  runId: UUID;
  workflowId: UUID;
  error: any;
  failedNodes: Set<UUID>;
  completedNodes: Set<UUID>;
  context: Record<string, any>;
}

export class ErrorHandler {
  private retryManager: RetryManager;
  private circuitBreakerManager: CircuitBreakerManager;
  private compensationManager: CompensationManager;
  private errorLogger: ErrorLogger;

  constructor(
    private config: ErrorHandlingConfig,
    private stateManager: RedisStateManager,
    private nodeDispatcher: NodeDispatcher,
    private contextManager: ExecutionContextManager,
    private producer: OfficeFlowProducer
  ) {
    this.retryManager = new RetryManager(stateManager);
    this.circuitBreakerManager = new CircuitBreakerManager(stateManager);
    this.compensationManager = new CompensationManager(
      stateManager,
      nodeDispatcher,
      contextManager
    );
    this.errorLogger = new ErrorLogger(producer, stateManager);
  }

  /**
   * Handle node execution error with comprehensive error handling
   */
  async handleNodeExecutionError(
    nodeExecutionError: NodeExecutionError,
    node: WorkflowNode
  ): Promise<{
    shouldRetry: boolean;
    retryAt?: Date;
    shouldFailWorkflow: boolean;
    compensationRequired: boolean;
  }> {
    const { runId, nodeId, nodeType, error, attempt, context } = nodeExecutionError;

    // Log the error
    await this.errorLogger.logNodeError(
      runId,
      nodeId,
      nodeType,
      error,
      attempt,
      {
        organizationId: context.organizationId,
        employeeId: context.employeeId,
        correlationId: context.correlationId,
        executionTimeMs: nodeExecutionError.executionTimeMs,
      }
    );

    let shouldRetry = false;
    let retryAt: Date | undefined;
    let shouldFailWorkflow = false;
    let compensationRequired = false;

    try {
      // Check if retry should be attempted
      if (this.config.enableRetry) {
        const retryContext = this.retryManager.createRetryContext(
          runId,
          nodeId,
          nodeType,
          attempt,
          error,
          node.params
        );

        shouldRetry = this.retryManager.shouldRetry(retryContext, error);

        if (shouldRetry) {
          retryAt = await this.retryManager.scheduleRetry(retryContext);
          console.log(`Node ${nodeId} scheduled for retry at ${retryAt.toISOString()}`);
        } else {
          console.log(`Node ${nodeId} will not be retried (attempt ${attempt})`);
          shouldFailWorkflow = true;
        }
      } else {
        shouldFailWorkflow = true;
      }

      // Update circuit breaker for external service calls
      if (this.config.enableCircuitBreaker && this.isExternalServiceNode(nodeType)) {
        const serviceName = this.getServiceNameFromNodeType(nodeType);
        const circuitBreaker = this.circuitBreakerManager.getCircuitBreaker(serviceName);
        
        // The circuit breaker will be updated when the actual service call is made
        // This is just for logging purposes
        console.log(`Circuit breaker failure recorded for service: ${serviceName}`);
      }

      // Determine if compensation is required
      if (this.config.enableCompensation && shouldFailWorkflow) {
        compensationRequired = this.shouldTriggerCompensation(nodeType, error);
      }

    } catch (handlingError) {
      console.error('Error in error handling:', handlingError);
      await this.errorLogger.logSystemError('error-handler', handlingError);
      
      // Fallback to safe defaults
      shouldRetry = false;
      shouldFailWorkflow = true;
      compensationRequired = false;
    }

    return {
      shouldRetry,
      retryAt,
      shouldFailWorkflow,
      compensationRequired,
    };
  }

  /**
   * Handle workflow execution error
   */
  async handleWorkflowExecutionError(
    workflowError: WorkflowExecutionError,
    parsedWorkflow: ParsedWorkflow,
    workflowState: WorkflowState
  ): Promise<{
    compensationPlan?: any;
    shouldExecuteCompensation: boolean;
  }> {
    const { runId, workflowId, error } = workflowError;

    // Log workflow error
    await this.errorLogger.logWorkflowError(
      runId,
      workflowId,
      error,
      {
        organizationId: workflowState.organizationId,
        employeeId: workflowState.employeeId,
      }
    );

    let compensationPlan;
    let shouldExecuteCompensation = false;

    try {
      // Create compensation plan if enabled
      if (this.config.enableCompensation) {
        compensationPlan = await this.compensationManager.createCompensationPlan(
          parsedWorkflow,
          workflowState
        );

        shouldExecuteCompensation = compensationPlan !== null;

        if (shouldExecuteCompensation) {
          console.log(`Compensation plan created for workflow ${runId}`);
        }
      }

    } catch (compensationError) {
      console.error('Error creating compensation plan:', compensationError);
      await this.errorLogger.logSystemError('compensation-manager', compensationError);
    }

    return {
      compensationPlan,
      shouldExecuteCompensation,
    };
  }

  /**
   * Execute compensation flow
   */
  async executeCompensation(
    compensationPlan: any,
    workflowState: WorkflowState
  ): Promise<void> {
    try {
      await this.compensationManager.executeCompensationPlan(
        compensationPlan,
        workflowState
      );

      console.log(`Compensation executed successfully for workflow ${workflowState.runId}`);

    } catch (compensationError) {
      console.error(`Compensation execution failed for workflow ${workflowState.runId}:`, compensationError);
      
      const errorMessage = compensationError instanceof Error ? compensationError.message : String(compensationError);
      await this.errorLogger.logError(
        'ERROR',
        'WORKFLOW',
        'COMPENSATION_FAILED',
        `Compensation execution failed: ${errorMessage}`,
        compensationError,
        {
          runId: workflowState.runId,
          workflowId: workflowState.workflowId,
          organizationId: workflowState.organizationId,
        },
        ['compensation', 'failure']
      );

      throw compensationError;
    }
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    serviceName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.config.enableCircuitBreaker) {
      return operation();
    }

    return this.circuitBreakerManager.execute(serviceName, operation);
  }

  /**
   * Get comprehensive error statistics
   */
  async getErrorStatistics(organizationId?: UUID): Promise<{
    errorStats: any;
    retryStats: any;
    circuitBreakerStats: any;
    compensationStats: any;
  }> {
    const [errorStats, retryStats, circuitBreakerStats, compensationStats] = await Promise.all([
      this.errorLogger.getErrorStatistics(organizationId),
      this.retryManager.getRetryStatistics(organizationId),
      this.circuitBreakerManager.getAllStats(),
      this.compensationManager.getCompensationStatistics(organizationId),
    ]);

    return {
      errorStats,
      retryStats,
      circuitBreakerStats,
      compensationStats,
    };
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, 'up' | 'down' | 'degraded'>;
    details: Record<string, any>;
  }> {
    const components: Record<string, 'up' | 'down' | 'degraded'> = {};
    const details: Record<string, any> = {};

    try {
      // Check circuit breaker states
      const circuitBreakerStats = await this.circuitBreakerManager.getAllStats();
      const openCircuits = Object.entries(circuitBreakerStats)
        .filter(([_, stats]) => stats.state === 'OPEN').length;

      components.circuitBreakers = openCircuits > 0 ? 'degraded' : 'up';
      details.openCircuits = openCircuits;

      // Check error rates
      const errorStats = await this.errorLogger.getErrorStatistics();
      const highErrorRate = errorStats.errorRate > 10; // More than 10 errors per minute

      components.errorRate = highErrorRate ? 'degraded' : 'up';
      details.errorRate = errorStats.errorRate;

      // Check retry queue
      const retryStats = await this.retryManager.getRetryStatistics();
      const highRetryCount = retryStats.readyForRetry > 100;

      components.retryQueue = highRetryCount ? 'degraded' : 'up';
      details.retryQueueSize = retryStats.readyForRetry;

      // Determine overall status
      const componentStatuses = Object.values(components);
      const hasDown = componentStatuses.includes('down');
      const hasDegraded = componentStatuses.includes('degraded');

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (hasDown) {
        status = 'unhealthy';
      } else if (hasDegraded) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return { status, components, details };

    } catch (error) {
      console.error('Failed to get health status:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: 'unhealthy',
        components: { errorHandler: 'down' },
        details: { error: errorMessage },
      };
    }
  }

  /**
   * Perform maintenance operations
   */
  async performMaintenance(): Promise<{
    cleanedRetries: number;
    resetCircuitBreakers: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let cleanedRetries = 0;
    let resetCircuitBreakers = 0;

    try {
      // Clean up expired retries
      cleanedRetries = await this.stateManager.cleanupExpiredRetries();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to clean retries: ${errorMessage}`);
    }

    try {
      // Reset circuit breakers that have been open too long
      const circuitBreakerStats = await this.circuitBreakerManager.getAllStats();
      const staleCircuits = Object.entries(circuitBreakerStats)
        .filter(([_, stats]) => {
          return stats.state === 'OPEN' && 
                 stats.nextRetryTime && 
                 Date.now() > stats.nextRetryTime.getTime() + 3600000; // 1 hour past retry time
        });

      for (const [serviceName] of staleCircuits) {
        try {
          const circuitBreaker = this.circuitBreakerManager.getCircuitBreaker(serviceName);
          await circuitBreaker.reset();
          resetCircuitBreakers++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to reset circuit breaker ${serviceName}: ${errorMessage}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to reset circuit breakers: ${errorMessage}`);
    }

    return {
      cleanedRetries,
      resetCircuitBreakers,
      errors,
    };
  }

  /**
   * Check if node type represents an external service call
   */
  private isExternalServiceNode(nodeType: string): boolean {
    const externalServiceTypes = [
      'identity.provision',
      'identity.deprovision',
      'email.send',
      'calendar.schedule',
      'slack.message',
      'slack.channel_invite',
      'webhook.call',
      'ai.generate_content',
    ];

    return externalServiceTypes.includes(nodeType);
  }

  /**
   * Get service name from node type for circuit breaker
   */
  private getServiceNameFromNodeType(nodeType: string): string {
    const serviceMapping: Record<string, string> = {
      'identity.provision': 'identity-service',
      'identity.deprovision': 'identity-service',
      'email.send': 'email-service',
      'calendar.schedule': 'calendar-service',
      'slack.message': 'slack-service',
      'slack.channel_invite': 'slack-service',
      'webhook.call': 'webhook-service',
      'ai.generate_content': 'ai-service',
    };

    return serviceMapping[nodeType] || nodeType;
  }

  /**
   * Log system error (public method for external access)
   */
  async logSystemError(component: string, error: any): Promise<void> {
    await this.errorLogger.logSystemError(component, error);
  }

  /**
   * Determine if compensation should be triggered for this error
   */
  private shouldTriggerCompensation(nodeType: string, error: any): boolean {
    // Don't trigger compensation for validation errors or user errors
    const nonCompensatableErrors = [
      'VALIDATION_ERROR',
      'INVALID_INPUT',
      'UNAUTHORIZED',
      'FORBIDDEN',
    ];

    if (error.code && nonCompensatableErrors.includes(error.code)) {
      return false;
    }

    // Trigger compensation for nodes that have side effects
    const compensatableNodeTypes = [
      'identity.provision',
      'email.send',
      'document.distribute',
      'calendar.schedule',
      'slack.channel_invite',
    ];

    return compensatableNodeTypes.includes(nodeType);
  }
}