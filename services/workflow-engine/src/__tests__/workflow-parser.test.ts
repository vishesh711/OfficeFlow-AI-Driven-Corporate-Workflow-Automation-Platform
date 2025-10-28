/**
 * Workflow parser tests
 */

import { WorkflowParser } from '../orchestrator/workflow-parser';
import { WorkflowDefinition, WorkflowDAG, WorkflowNode, WorkflowEdge } from '@officeflow/types';

describe('WorkflowParser', () => {
  const createTestWorkflow = (
    nodes: WorkflowNode[],
    edges: WorkflowEdge[] = []
  ): WorkflowDefinition => ({
    id: 'test-workflow-id',
    organizationId: 'test-org-id',
    name: 'Test Workflow',
    eventTrigger: 'employee.onboard',
    version: 1,
    isActive: true,
    definition: {
      nodes,
      edges,
      metadata: {
        version: '1.0.0',
      },
    },
    createdBy: 'test-user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createTestNode = (id: string, type: any = 'email.send'): WorkflowNode => ({
    id,
    type,
    name: `Node ${id}`,
    params: {},
    retryPolicy: {
      maxRetries: 3,
      backoffMs: 1000,
      backoffMultiplier: 2,
      maxBackoffMs: 30000,
    },
    timeoutMs: 300000,
    position: { x: 0, y: 0 },
  });

  const createTestEdge = (id: string, fromNodeId: string, toNodeId: string): WorkflowEdge => ({
    id,
    fromNodeId,
    toNodeId,
  });

  describe('validateWorkflowDefinition', () => {
    it('should validate a simple workflow with one node', () => {
      const nodes = [createTestNode('node1')];
      const workflow = createTestWorkflow(nodes);

      const errors = WorkflowParser.validateWorkflowDefinition(workflow);
      expect(errors).toHaveLength(0);
    });

    it('should validate a workflow with multiple connected nodes', () => {
      const nodes = [createTestNode('node1'), createTestNode('node2'), createTestNode('node3')];
      const edges = [
        createTestEdge('edge1', 'node1', 'node2'),
        createTestEdge('edge2', 'node2', 'node3'),
      ];
      const workflow = createTestWorkflow(nodes, edges);

      const errors = WorkflowParser.validateWorkflowDefinition(workflow);
      expect(errors).toHaveLength(0);
    });

    it('should reject workflow with no nodes', () => {
      const workflow = createTestWorkflow([]);

      const errors = WorkflowParser.validateWorkflowDefinition(workflow);
      expect(errors).toContainEqual(
        expect.objectContaining({
          code: 'NO_NODES',
          message: 'Workflow must contain at least one node',
        })
      );
    });

    it('should reject node with invalid type', () => {
      const nodes = [createTestNode('node1', 'invalid.type')];
      const workflow = createTestWorkflow(nodes);

      const errors = WorkflowParser.validateWorkflowDefinition(workflow);
      expect(errors).toContainEqual(
        expect.objectContaining({
          code: 'UNSUPPORTED_NODE_TYPE',
          message: 'Unsupported node type: invalid.type',
        })
      );
    });

    it('should reject edge with invalid node reference', () => {
      const nodes = [createTestNode('node1')];
      const edges = [createTestEdge('edge1', 'node1', 'nonexistent')];
      const workflow = createTestWorkflow(nodes, edges);

      const errors = WorkflowParser.validateWorkflowDefinition(workflow);
      expect(errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_TO_NODE',
          message: 'Edge toNodeId must reference a valid node',
        })
      );
    });

    it('should reject self-referencing edge', () => {
      const nodes = [createTestNode('node1')];
      const edges = [createTestEdge('edge1', 'node1', 'node1')];
      const workflow = createTestWorkflow(nodes, edges);

      const errors = WorkflowParser.validateWorkflowDefinition(workflow);
      expect(errors).toContainEqual(
        expect.objectContaining({
          code: 'SELF_REFERENCING_EDGE',
          message: 'Edge cannot reference the same node as source and target',
        })
      );
    });
  });

  describe('detectCycles', () => {
    it('should not detect cycles in linear workflow', () => {
      const nodes = [createTestNode('node1'), createTestNode('node2'), createTestNode('node3')];
      const edges = [
        createTestEdge('edge1', 'node1', 'node2'),
        createTestEdge('edge2', 'node2', 'node3'),
      ];

      expect(() => {
        WorkflowParser.detectCycles(nodes, edges);
      }).not.toThrow();
    });

    it('should detect simple cycle', () => {
      const nodes = [createTestNode('node1'), createTestNode('node2')];
      const edges = [
        createTestEdge('edge1', 'node1', 'node2'),
        createTestEdge('edge2', 'node2', 'node1'),
      ];

      expect(() => {
        WorkflowParser.detectCycles(nodes, edges);
      }).toThrow('Cycle detected in workflow');
    });

    it('should detect complex cycle', () => {
      const nodes = [createTestNode('node1'), createTestNode('node2'), createTestNode('node3')];
      const edges = [
        createTestEdge('edge1', 'node1', 'node2'),
        createTestEdge('edge2', 'node2', 'node3'),
        createTestEdge('edge3', 'node3', 'node1'),
      ];

      expect(() => {
        WorkflowParser.detectCycles(nodes, edges);
      }).toThrow('Cycle detected in workflow');
    });
  });

  describe('topologicalSort', () => {
    it('should sort linear workflow correctly', () => {
      const nodes = [createTestNode('node3'), createTestNode('node1'), createTestNode('node2')];
      const edges = [
        createTestEdge('edge1', 'node1', 'node2'),
        createTestEdge('edge2', 'node2', 'node3'),
      ];

      const sorted = WorkflowParser.topologicalSort(nodes, edges);
      const sortedIds = sorted.map((n) => n.id);

      expect(sortedIds).toEqual(['node1', 'node2', 'node3']);
    });

    it('should handle parallel branches', () => {
      const nodes = [
        createTestNode('node1'),
        createTestNode('node2'),
        createTestNode('node3'),
        createTestNode('node4'),
      ];
      const edges = [
        createTestEdge('edge1', 'node1', 'node2'),
        createTestEdge('edge2', 'node1', 'node3'),
        createTestEdge('edge3', 'node2', 'node4'),
        createTestEdge('edge4', 'node3', 'node4'),
      ];

      const sorted = WorkflowParser.topologicalSort(nodes, edges);
      const sortedIds = sorted.map((n) => n.id);

      expect(sortedIds[0]).toBe('node1');
      expect(sortedIds[3]).toBe('node4');
      expect(sortedIds.slice(1, 3)).toContain('node2');
      expect(sortedIds.slice(1, 3)).toContain('node3');
    });
  });

  describe('findEntryNodes', () => {
    it('should find single entry node', () => {
      const nodes = [createTestNode('node1'), createTestNode('node2'), createTestNode('node3')];
      const edges = [
        createTestEdge('edge1', 'node1', 'node2'),
        createTestEdge('edge2', 'node2', 'node3'),
      ];

      const entryNodes = WorkflowParser.findEntryNodes(nodes, edges);
      expect(entryNodes).toHaveLength(1);
      expect(entryNodes[0].id).toBe('node1');
    });

    it('should find multiple entry nodes', () => {
      const nodes = [createTestNode('node1'), createTestNode('node2'), createTestNode('node3')];
      const edges = [
        createTestEdge('edge1', 'node1', 'node3'),
        createTestEdge('edge2', 'node2', 'node3'),
      ];

      const entryNodes = WorkflowParser.findEntryNodes(nodes, edges);
      expect(entryNodes).toHaveLength(2);
      expect(entryNodes.map((n) => n.id)).toContain('node1');
      expect(entryNodes.map((n) => n.id)).toContain('node2');
    });
  });

  describe('findExitNodes', () => {
    it('should find single exit node', () => {
      const nodes = [createTestNode('node1'), createTestNode('node2'), createTestNode('node3')];
      const edges = [
        createTestEdge('edge1', 'node1', 'node2'),
        createTestEdge('edge2', 'node2', 'node3'),
      ];

      const exitNodes = WorkflowParser.findExitNodes(nodes, edges);
      expect(exitNodes).toHaveLength(1);
      expect(exitNodes[0].id).toBe('node3');
    });

    it('should find multiple exit nodes', () => {
      const nodes = [createTestNode('node1'), createTestNode('node2'), createTestNode('node3')];
      const edges = [
        createTestEdge('edge1', 'node1', 'node2'),
        createTestEdge('edge2', 'node1', 'node3'),
      ];

      const exitNodes = WorkflowParser.findExitNodes(nodes, edges);
      expect(exitNodes).toHaveLength(2);
      expect(exitNodes.map((n) => n.id)).toContain('node2');
      expect(exitNodes.map((n) => n.id)).toContain('node3');
    });
  });

  describe('parseWorkflow', () => {
    it('should successfully parse valid workflow', () => {
      const nodes = [createTestNode('node1'), createTestNode('node2'), createTestNode('node3')];
      const edges = [
        createTestEdge('edge1', 'node1', 'node2'),
        createTestEdge('edge2', 'node2', 'node3'),
      ];
      const workflow = createTestWorkflow(nodes, edges);

      const parsed = WorkflowParser.parseWorkflow(workflow);

      expect(parsed.definition).toBe(workflow);
      expect(parsed.executionOrder).toHaveLength(3);
      expect(parsed.entryNodes).toHaveLength(1);
      expect(parsed.exitNodes).toHaveLength(1);
      expect(parsed.nodeMap.size).toBe(3);
      expect(parsed.edgeMap.size).toBe(2);
      expect(parsed.dependencyMap.size).toBe(2);
    });

    it('should throw error for invalid workflow', () => {
      const workflow = createTestWorkflow([]);

      expect(() => {
        WorkflowParser.parseWorkflow(workflow);
      }).toThrow('Workflow validation failed');
    });
  });

  describe('getEligibleNodes', () => {
    it('should return entry nodes when no nodes completed', () => {
      const nodes = [createTestNode('node1'), createTestNode('node2'), createTestNode('node3')];
      const edges = [
        createTestEdge('edge1', 'node1', 'node2'),
        createTestEdge('edge2', 'node2', 'node3'),
      ];
      const workflow = createTestWorkflow(nodes, edges);
      const parsed = WorkflowParser.parseWorkflow(workflow);

      const eligible = WorkflowParser.getEligibleNodes(parsed, new Set(), new Set(), new Set());

      expect(eligible).toHaveLength(1);
      expect(eligible[0].id).toBe('node1');
    });

    it('should return next nodes after completion', () => {
      const nodes = [createTestNode('node1'), createTestNode('node2'), createTestNode('node3')];
      const edges = [
        createTestEdge('edge1', 'node1', 'node2'),
        createTestEdge('edge2', 'node2', 'node3'),
      ];
      const workflow = createTestWorkflow(nodes, edges);
      const parsed = WorkflowParser.parseWorkflow(workflow);

      const eligible = WorkflowParser.getEligibleNodes(
        parsed,
        new Set(['node1']),
        new Set(),
        new Set()
      );

      expect(eligible).toHaveLength(1);
      expect(eligible[0].id).toBe('node2');
    });
  });

  describe('isWorkflowComplete', () => {
    it('should return complete when all nodes processed successfully', () => {
      const nodes = [createTestNode('node1'), createTestNode('node2')];
      const workflow = createTestWorkflow(nodes);
      const parsed = WorkflowParser.parseWorkflow(workflow);

      const result = WorkflowParser.isWorkflowComplete(
        parsed,
        new Set(['node1', 'node2']),
        new Set(),
        new Set()
      );

      expect(result.isComplete).toBe(true);
      expect(result.status).toBe('COMPLETED');
    });

    it('should return failed when some nodes failed', () => {
      const nodes = [createTestNode('node1'), createTestNode('node2')];
      const workflow = createTestWorkflow(nodes);
      const parsed = WorkflowParser.parseWorkflow(workflow);

      const result = WorkflowParser.isWorkflowComplete(
        parsed,
        new Set(['node1']),
        new Set(['node2']),
        new Set()
      );

      expect(result.isComplete).toBe(true);
      expect(result.status).toBe('FAILED');
    });

    it('should return running when nodes still processing', () => {
      const nodes = [createTestNode('node1'), createTestNode('node2')];
      const workflow = createTestWorkflow(nodes);
      const parsed = WorkflowParser.parseWorkflow(workflow);

      const result = WorkflowParser.isWorkflowComplete(
        parsed,
        new Set(['node1']),
        new Set(),
        new Set()
      );

      expect(result.isComplete).toBe(false);
      expect(result.status).toBe('RUNNING');
    });
  });
});
