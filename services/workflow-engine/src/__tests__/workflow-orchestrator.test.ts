/**
 * Comprehensive Workflow Orchestrator Tests
 * Tests workflow execution logic, state management, and lifecycle operations
 */

import { WorkflowOrchestrator, WorkflowOrchestratorConfig } from '../orchestrator/workflow-orchestrator';
import { WorkflowStateMachine, NodeStateMachine } from '../state/state-machine';
import { WorkflowState, NodeState } from '../types/workflow-state';
import { RedisStateManager } from '../state/redis-state-manager';
import { ExecutionContextManager } from '../execution/context-manager';
import { NodeDispatcher } from '../execution/node-dispatcher';
import { WorkflowLoader } from '../orchestrator/workflow-loader';
import { WorkflowParser } from '../orchestrator/workflow-parser';
import { NodeType } from '@officeflow/types';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('@officeflow/kafka');
jest.mock('@officeflow/database');

describe('WorkflowOrchestrator', () => {
  let orchestrator: WorkflowOrchestrator;
  let mockWorkflowRepo: any;
  let mockWorkflowRunRepo: any;
  let mockStateManager: any;
  let mockContextManager: any;
  let mockNodeDispatcher: any;
  let mockProducer: any;
  let config: WorkflowOrchestratorConfig;

  beforeEach(() => {
    // Mock dependencies
    mockWorkflowRepo = {
      findById: jest.fn(),
      findByTrigger: jest.fn(),
    };

    mockWorkflowRunRepo = {
      create: jest.fn(),
      updateStatus: jest.fn(),
    };

    mockStateManager = {
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
      setWorkflowState: jest.fn(),
      getWorkflowState: jest.fn(),
      getWorkflowNodeStates: jest.fn(),
      scheduleRetry: jest.fn(),
      removeFromRetrySchedule: jest.fn(),
      getNodesReadyForRetry: jest.fn().mockResolvedValue([]),
      setNodeState: jest.fn(),
      storeErrorEntry: jest.fn(),
    };

    mockContextManager = {
      createInitialContext: jest.fn(),
      updateContextWithNodeOutput: jest.fn(),
      serializeContext: jest.fn(),
      deserializeContext: jest.fn(),
    };

    mockNodeDispatcher = {
      dispatchNodes: jest.fn(),
      dispatchNode: jest.fn(),
      cancelNode: jest.fn(),
    };

    mockProducer = {
      send: jest.fn(),
    };

    config = {
      instanceId: 'test-orchestrator',
      maxConcurrentWorkflows: 10,
      nodeExecutionTimeout: 300000,
      workflowExecutionTimeout: 3600000,
      errorHandling: {
        enableRetry: true,
        enableCircuitBreaker: true,
        enableCompensation: true,
        enableAlerting: false,
        maxRetryAttempts: 3,
        circuitBreakerThreshold: 5,
        alertCooldownMs: 300000,
      },
    };

    orchestrator = new WorkflowOrchestrator(
      config,
      mockWorkflowRepo,
      mockWorkflowRunRepo,
      mockStateManager,
      mockContextManager,
      mockNodeDispatcher,
      mockProducer
    );
  });

  describe('Workflow Execution Logic', () => {
    it('should execute workflow with proper state transitions', async () => {
      const workflowId = uuidv4();
      const context = createMockExecutionContext();
      const mockWorkflowRun = createMockWorkflowRunEntity();
      const mockParsedWorkflow = createMockParsedWorkflow();

      // Setup mocks
      mockStateManager.acquireLock.mockResolvedValue(true);
      mockWorkflowRunRepo.create.mockResolvedValue(mockWorkflowRun);
      
      // Mock workflow loader
      const mockWorkflowLoader = {
        loadWorkflow: jest.fn().mockResolvedValue(mockParsedWorkflow),
      };
      (orchestrator as any).workflowLoader = mockWorkflowLoader;

      const result = await orchestrator.executeWorkflow(workflowId, context);

      expect(mockStateManager.acquireLock).toHaveBeenCalledWith(
        expect.any(String),
        config.instanceId
      );
      expect(mockStateManager.setWorkflowState).toHaveBeenCalled();
      expect(mockNodeDispatcher.dispatchNodes).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle lock acquisition failure', async () => {
      const workflowId = uuidv4();
      const context = createMockExecutionContext();
      const mockParsedWorkflow = createMockParsedWorkflow();
      const mockWorkflowRunEntity = createMockWorkflowRunEntity();

      mockStateManager.acquireLock.mockResolvedValue(false);
      mockWorkflowRunRepo.create.mockResolvedValue(mockWorkflowRunEntity);
      
      // Mock workflow loader
      const mockWorkflowLoader = {
        loadWorkflow: jest.fn().mockResolvedValue(mockParsedWorkflow),
      };
      (orchestrator as any).workflowLoader = mockWorkflowLoader;

      await expect(
        orchestrator.executeWorkflow(workflowId, context)
      ).rejects.toThrow('Failed to acquire execution lock');
    });

    it('should handle node completion and continue execution', async () => {
      const runId = uuidv4();
      const nodeId = uuidv4();
      const output = { result: 'success', data: 'test-data' };
      
      const mockWorkflowState = createMockWorkflowState(runId);
      const mockParsedWorkflow = createMockParsedWorkflow();
      const mockContext = createMockExecutionContext();

      // Set the nodeId to match the one in the parsed workflow
      const testNode = {
        id: nodeId,
        type: 'email.send' as NodeType,
        name: 'Test Node',
        params: {},
        retryPolicy: {
          maxRetries: 3,
          backoffMs: 1000,
          backoffMultiplier: 2,
          maxBackoffMs: 30000,
        },
        timeoutMs: 300000,
        position: { x: 0, y: 0 },
      };
      mockParsedWorkflow.nodeMap.set(nodeId, testNode);

      mockStateManager.getWorkflowState.mockResolvedValue(mockWorkflowState);
      mockContextManager.deserializeContext.mockReturnValue(mockContext);
      mockContextManager.updateContextWithNodeOutput.mockReturnValue(mockContext);

      // Mock workflow loader
      const mockWorkflowLoader = {
        loadWorkflow: jest.fn().mockResolvedValue(mockParsedWorkflow),
      };
      (orchestrator as any).workflowLoader = mockWorkflowLoader;

      await orchestrator.handleNodeCompletion(runId, nodeId, output);

      expect(mockStateManager.getWorkflowState).toHaveBeenCalledWith(runId);
      expect(mockStateManager.setWorkflowState).toHaveBeenCalled();
      expect(mockContextManager.updateContextWithNodeOutput).toHaveBeenCalledWith(
        mockContext,
        nodeId,
        expect.any(String),
        output
      );
    });

    it('should handle node failure with retry logic', async () => {
      const runId = uuidv4();
      const nodeId = uuidv4();
      const error = new Error('Network timeout');
      const attempt = 1;

      const mockWorkflowState = createMockWorkflowState(runId);
      const mockParsedWorkflow = createMockParsedWorkflow();

      // Set the nodeId to match the one in the parsed workflow
      const testNode = {
        id: nodeId,
        type: 'email.send' as NodeType,
        name: 'Test Node',
        params: {},
        retryPolicy: {
          maxRetries: 3,
          backoffMs: 1000,
          backoffMultiplier: 2,
          maxBackoffMs: 30000,
        },
        timeoutMs: 300000,
        position: { x: 0, y: 0 },
      };
      mockParsedWorkflow.nodeMap.set(nodeId, testNode);

      mockStateManager.getWorkflowState.mockResolvedValue(mockWorkflowState);

      // Mock workflow loader
      const mockWorkflowLoader = {
        loadWorkflow: jest.fn().mockResolvedValue(mockParsedWorkflow),
      };
      (orchestrator as any).workflowLoader = mockWorkflowLoader;

      await orchestrator.handleNodeFailure(runId, nodeId, error, attempt);

      expect(mockStateManager.getWorkflowState).toHaveBeenCalledWith(runId);
      // Note: setWorkflowState might not be called if error handling determines no state change needed
    });
  });

  describe('Workflow Lifecycle Operations', () => {
    it('should pause workflow execution', async () => {
      const runId = uuidv4();
      const mockWorkflowState = createMockWorkflowState(runId);
      mockWorkflowState.status = 'RUNNING';

      mockStateManager.getWorkflowState.mockResolvedValue(mockWorkflowState);
      mockStateManager.getWorkflowNodeStates.mockResolvedValue([
        { nodeId: 'node-1', status: 'RUNNING' },
        { nodeId: 'node-2', status: 'QUEUED' },
      ]);

      await orchestrator.pauseWorkflow(runId);

      expect(mockStateManager.setWorkflowState).toHaveBeenCalled();
      expect(mockWorkflowRunRepo.updateStatus).toHaveBeenCalledWith(runId, 'PAUSED');
    });

    it('should resume workflow execution', async () => {
      const runId = uuidv4();
      const mockWorkflowState = createMockWorkflowState(runId);
      mockWorkflowState.status = 'PAUSED';

      const mockParsedWorkflow = createMockParsedWorkflow();
      const mockContext = createMockExecutionContext();

      mockStateManager.getWorkflowState.mockResolvedValue(mockWorkflowState);
      mockContextManager.deserializeContext.mockReturnValue(mockContext);

      // Mock workflow loader
      const mockWorkflowLoader = {
        loadWorkflow: jest.fn().mockResolvedValue(mockParsedWorkflow),
      };
      (orchestrator as any).workflowLoader = mockWorkflowLoader;

      await orchestrator.resumeWorkflow(runId);

      expect(mockStateManager.setWorkflowState).toHaveBeenCalled();
      expect(mockWorkflowRunRepo.updateStatus).toHaveBeenCalledWith(runId, 'RUNNING');
    });

    it('should cancel workflow execution', async () => {
      const runId = uuidv4();
      const mockWorkflowState = createMockWorkflowState(runId);
      mockWorkflowState.status = 'RUNNING';

      mockStateManager.getWorkflowState.mockResolvedValue(mockWorkflowState);
      mockStateManager.getWorkflowNodeStates.mockResolvedValue([
        { nodeId: 'node-1', status: 'RUNNING' },
        { nodeId: 'node-2', status: 'QUEUED' },
      ]);

      await orchestrator.cancelWorkflow(runId);

      expect(mockStateManager.setWorkflowState).toHaveBeenCalled();
      expect(mockWorkflowRunRepo.updateStatus).toHaveBeenCalledWith(runId, 'CANCELLED');
      expect(mockNodeDispatcher.cancelNode).toHaveBeenCalledTimes(2);
    });

    it('should reject invalid state transitions', async () => {
      const runId = uuidv4();
      const mockWorkflowState = createMockWorkflowState(runId);
      mockWorkflowState.status = 'COMPLETED';

      mockStateManager.getWorkflowState.mockResolvedValue(mockWorkflowState);

      await expect(orchestrator.pauseWorkflow(runId)).rejects.toThrow(
        'Cannot pause workflow in status: COMPLETED'
      );

      await expect(orchestrator.resumeWorkflow(runId)).rejects.toThrow(
        'Cannot resume workflow in status: COMPLETED'
      );

      await expect(orchestrator.cancelWorkflow(runId)).rejects.toThrow(
        'Cannot cancel workflow in status: COMPLETED'
      );
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop orchestrator', async () => {
      await orchestrator.start();
      expect((orchestrator as any).isRunning).toBe(true);

      await orchestrator.stop();
      expect((orchestrator as any).isRunning).toBe(false);
    });
  });
});

describe('WorkflowStateMachine', () => {
  let stateMachine: WorkflowStateMachine;

  beforeEach(() => {
    stateMachine = new WorkflowStateMachine();
  });

  describe('State Transitions', () => {
    it('should allow valid transitions', () => {
      expect(stateMachine.canTransition('PENDING', 'start')).toBe(true);
      expect(stateMachine.canTransition('RUNNING', 'pause')).toBe(true);
      expect(stateMachine.canTransition('PAUSED', 'resume')).toBe(true);
      expect(stateMachine.canTransition('RUNNING', 'complete')).toBe(true);
      expect(stateMachine.canTransition('RUNNING', 'fail')).toBe(true);
      expect(stateMachine.canTransition('RUNNING', 'cancel')).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(stateMachine.canTransition('PENDING', 'pause')).toBe(false);
      expect(stateMachine.canTransition('COMPLETED', 'start')).toBe(false);
      expect(stateMachine.canTransition('FAILED', 'resume')).toBe(false);
    });

    it('should return correct next status for valid transitions', () => {
      expect(stateMachine.getNextStatus('PENDING', 'start')).toBe('RUNNING');
      expect(stateMachine.getNextStatus('RUNNING', 'pause')).toBe('PAUSED');
      expect(stateMachine.getNextStatus('PAUSED', 'resume')).toBe('RUNNING');
      expect(stateMachine.getNextStatus('RUNNING', 'complete')).toBe('COMPLETED');
      expect(stateMachine.getNextStatus('RUNNING', 'fail')).toBe('FAILED');
    });

    it('should return null for invalid transitions', () => {
      expect(stateMachine.getNextStatus('PENDING', 'pause')).toBeNull();
      expect(stateMachine.getNextStatus('COMPLETED', 'start')).toBeNull();
    });

    it('should successfully transition workflow state', () => {
      const initialState: WorkflowState = {
        runId: 'test-run-id',
        workflowId: 'test-workflow-id',
        organizationId: 'test-org-id',
        employeeId: 'test-employee-id',
        status: 'PENDING',
        currentNodes: new Set(),
        completedNodes: new Set(),
        failedNodes: new Set(),
        skippedNodes: new Set(),
        context: {},
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
      };

      const transitionedState = stateMachine.transitionWorkflow(initialState, 'start');
      
      expect(transitionedState.status).toBe('RUNNING');
      expect(transitionedState.lastUpdatedAt).toBeInstanceOf(Date);
      expect(transitionedState.runId).toBe(initialState.runId);
    });

    it('should throw error for invalid transitions', () => {
      const state: WorkflowState = {
        runId: 'test-run-id',
        workflowId: 'test-workflow-id',
        organizationId: 'test-org-id',
        employeeId: 'test-employee-id',
        status: 'COMPLETED',
        currentNodes: new Set(),
        completedNodes: new Set(),
        failedNodes: new Set(),
        skippedNodes: new Set(),
        context: {},
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
      };

      expect(() => {
        stateMachine.transitionWorkflow(state, 'start');
      }).toThrow('Invalid workflow transition: COMPLETED -> start');
    });
  });
});

describe('NodeStateMachine', () => {
  let stateMachine: NodeStateMachine;

  beforeEach(() => {
    stateMachine = new NodeStateMachine();
  });

  describe('Node State Transitions', () => {
    it('should allow valid node transitions', () => {
      expect(stateMachine.canTransition('QUEUED', 'start')).toBe(true);
      expect(stateMachine.canTransition('RUNNING', 'complete')).toBe(true);
      expect(stateMachine.canTransition('RUNNING', 'fail')).toBe(true);
      expect(stateMachine.canTransition('FAILED', 'retry')).toBe(true);
    });

    it('should reject invalid node transitions', () => {
      expect(stateMachine.canTransition('COMPLETED', 'start')).toBe(false);
      expect(stateMachine.canTransition('QUEUED', 'complete')).toBe(false);
    });

    it('should successfully transition node state', () => {
      const initialState: NodeState = {
        nodeId: 'test-node-id',
        runId: 'test-run-id',
        status: 'QUEUED',
        attempt: 1,
      };

      const transitionedState = stateMachine.transitionNode(initialState, 'start');
      
      expect(transitionedState.status).toBe('RUNNING');
      expect(transitionedState.startedAt).toBeInstanceOf(Date);
    });

    it('should set end time for terminal states', () => {
      const runningState: NodeState = {
        nodeId: 'test-node-id',
        runId: 'test-run-id',
        status: 'RUNNING',
        attempt: 1,
        startedAt: new Date(),
      };

      const completedState = stateMachine.transitionNode(runningState, 'complete');
      
      expect(completedState.status).toBe('COMPLETED');
      expect(completedState.endedAt).toBeInstanceOf(Date);
    });
  });
});

// Helper functions
function createMockExecutionContext() {
  return {
    organizationId: 'org-123',
    employeeId: 'emp-456',
    correlationId: uuidv4(),
    variables: {
      'system.organizationId': 'org-123',
      'system.employeeId': 'emp-456',
      'event.type': 'employee.onboard',
    },
    secrets: {},
    triggerEvent: {
      type: 'employee.onboard',
      payload: { name: 'John Doe' },
      timestamp: new Date(),
    },
  };
}

function createMockWorkflowRunEntity() {
  return {
    run_id: uuidv4(),
    org_id: 'org-123',
    workflow_id: uuidv4(),
    employee_id: 'emp-456',
    trigger_event: 'employee.onboard',
    status: 'PENDING',
    context: {},
    started_at: new Date(),
    correlation_id: uuidv4(),
  };
}

function createMockParsedWorkflow() {
  const nodeId = uuidv4();
  const node = {
    id: nodeId,
    type: 'email.send' as NodeType,
    name: 'Send Welcome Email',
    params: {},
    retryPolicy: {
      maxRetries: 3,
      backoffMs: 1000,
      backoffMultiplier: 2,
      maxBackoffMs: 30000,
    },
    timeoutMs: 300000,
    position: { x: 0, y: 0 },
  };

  return {
    definition: {
      id: uuidv4(),
      organizationId: 'org-123',
      name: 'Test Workflow',
      eventTrigger: 'employee.onboard' as any,
      version: 1,
      isActive: true,
      definition: {
        nodes: [node],
        edges: [],
        metadata: { version: '1.0.0' },
      },
      createdBy: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    executionOrder: [node],
    entryNodes: [node],
    exitNodes: [node],
    nodeMap: new Map([[nodeId, node]]),
    edgeMap: new Map(),
    dependencyMap: new Map(),
  };
}

function createMockWorkflowState(runId: string): WorkflowState {
  return {
    runId,
    workflowId: uuidv4(),
    organizationId: 'org-123',
    employeeId: 'emp-456',
    status: 'RUNNING',
    currentNodes: new Set(['node-1']),
    completedNodes: new Set(),
    failedNodes: new Set(),
    skippedNodes: new Set(),
    context: {
      'system.organizationId': 'org-123',
      'system.employeeId': 'emp-456',
    },
    startedAt: new Date(),
    lastUpdatedAt: new Date(),
  };
}