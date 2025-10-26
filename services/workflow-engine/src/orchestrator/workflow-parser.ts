/**
 * Workflow definition parser and DAG validation
 */

import { 
  WorkflowDefinition, 
  WorkflowDAG, 
  WorkflowNode, 
  WorkflowEdge, 
  NodeType,
  UUID 
} from '@officeflow/types';
import { ValidationResult } from '@officeflow/types';

export interface ParsedWorkflow {
  definition: WorkflowDefinition;
  executionOrder: WorkflowNode[];
  entryNodes: WorkflowNode[];
  exitNodes: WorkflowNode[];
  nodeMap: Map<UUID, WorkflowNode>;
  edgeMap: Map<UUID, WorkflowEdge[]>; // fromNodeId -> edges
  dependencyMap: Map<UUID, UUID[]>; // nodeId -> dependencies
}

export interface WorkflowValidationError {
  code: string;
  message: string;
  nodeId?: UUID;
  edgeId?: UUID;
  details?: any;
}

export class WorkflowParser {
  private static readonly SUPPORTED_NODE_TYPES: NodeType[] = [
    'identity.provision',
    'identity.deprovision',
    'email.send',
    'calendar.schedule',
    'slack.message',
    'slack.channel_invite',
    'document.distribute',
    'ai.generate_content',
    'webhook.call',
    'delay',
    'condition',
    'parallel',
    'compensation'
  ];

  /**
   * Parse and validate workflow definition
   */
  static parseWorkflow(workflow: WorkflowDefinition): ParsedWorkflow {
    const errors = this.validateWorkflowDefinition(workflow);
    if (errors.length > 0) {
      throw new Error(`Workflow validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    const dag = workflow.definition;
    const nodeMap = this.createNodeMap(dag.nodes);
    const edgeMap = this.createEdgeMap(dag.edges);
    const dependencyMap = this.createDependencyMap(dag.edges);

    // Detect cycles
    this.detectCycles(dag.nodes, dag.edges);

    // Calculate topological order
    const executionOrder = this.topologicalSort(dag.nodes, dag.edges);

    // Find entry and exit nodes
    const entryNodes = this.findEntryNodes(dag.nodes, dag.edges);
    const exitNodes = this.findExitNodes(dag.nodes, dag.edges);

    return {
      definition: workflow,
      executionOrder,
      entryNodes,
      exitNodes,
      nodeMap,
      edgeMap,
      dependencyMap
    };
  }

  /**
   * Validate workflow definition structure and constraints
   */
  static validateWorkflowDefinition(workflow: WorkflowDefinition): WorkflowValidationError[] {
    const errors: WorkflowValidationError[] = [];

    // Basic structure validation
    if (!workflow.definition) {
      errors.push({
        code: 'MISSING_DEFINITION',
        message: 'Workflow definition is required'
      });
      return errors;
    }

    const dag = workflow.definition;

    // Validate nodes
    if (!dag.nodes || dag.nodes.length === 0) {
      errors.push({
        code: 'NO_NODES',
        message: 'Workflow must contain at least one node'
      });
      return errors;
    }

    // Validate each node
    for (const node of dag.nodes) {
      errors.push(...this.validateNode(node));
    }

    // Validate edges
    if (dag.edges) {
      for (const edge of dag.edges) {
        errors.push(...this.validateEdge(edge, dag.nodes));
      }
    }

    // Validate DAG structure
    errors.push(...this.validateDAGStructure(dag.nodes, dag.edges || []));

    return errors;
  }

  /**
   * Validate individual node
   */
  private static validateNode(node: WorkflowNode): WorkflowValidationError[] {
    const errors: WorkflowValidationError[] = [];

    if (!node.id) {
      errors.push({
        code: 'MISSING_NODE_ID',
        message: 'Node ID is required',
        nodeId: node.id
      });
    }

    if (!node.name || node.name.trim().length === 0) {
      errors.push({
        code: 'MISSING_NODE_NAME',
        message: 'Node name is required',
        nodeId: node.id
      });
    }

    if (!node.type) {
      errors.push({
        code: 'MISSING_NODE_TYPE',
        message: 'Node type is required',
        nodeId: node.id
      });
    } else if (!this.SUPPORTED_NODE_TYPES.includes(node.type)) {
      errors.push({
        code: 'UNSUPPORTED_NODE_TYPE',
        message: `Unsupported node type: ${node.type}`,
        nodeId: node.id
      });
    }

    // Validate retry policy
    if (node.retryPolicy) {
      if (node.retryPolicy.maxRetries < 0 || node.retryPolicy.maxRetries > 10) {
        errors.push({
          code: 'INVALID_RETRY_POLICY',
          message: 'Max retries must be between 0 and 10',
          nodeId: node.id
        });
      }

      if (node.retryPolicy.backoffMs < 100 || node.retryPolicy.backoffMs > 300000) {
        errors.push({
          code: 'INVALID_BACKOFF',
          message: 'Backoff must be between 100ms and 5 minutes',
          nodeId: node.id
        });
      }
    }

    // Validate timeout
    if (node.timeoutMs && (node.timeoutMs < 1000 || node.timeoutMs > 3600000)) {
      errors.push({
        code: 'INVALID_TIMEOUT',
        message: 'Timeout must be between 1 second and 1 hour',
        nodeId: node.id
      });
    }

    return errors;
  }

  /**
   * Validate individual edge
   */
  private static validateEdge(edge: WorkflowEdge, nodes: WorkflowNode[]): WorkflowValidationError[] {
    const errors: WorkflowValidationError[] = [];
    const nodeIds = new Set(nodes.map(n => n.id));

    if (!edge.id) {
      errors.push({
        code: 'MISSING_EDGE_ID',
        message: 'Edge ID is required',
        edgeId: edge.id
      });
    }

    if (!edge.fromNodeId || !nodeIds.has(edge.fromNodeId)) {
      errors.push({
        code: 'INVALID_FROM_NODE',
        message: 'Edge fromNodeId must reference a valid node',
        edgeId: edge.id
      });
    }

    if (!edge.toNodeId || !nodeIds.has(edge.toNodeId)) {
      errors.push({
        code: 'INVALID_TO_NODE',
        message: 'Edge toNodeId must reference a valid node',
        edgeId: edge.id
      });
    }

    if (edge.fromNodeId === edge.toNodeId) {
      errors.push({
        code: 'SELF_REFERENCING_EDGE',
        message: 'Edge cannot reference the same node as source and target',
        edgeId: edge.id
      });
    }

    return errors;
  }

  /**
   * Validate DAG structure constraints
   */
  private static validateDAGStructure(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowValidationError[] {
    const errors: WorkflowValidationError[] = [];

    // Check for duplicate node IDs
    const nodeIds = nodes.map(n => n.id);
    const duplicateNodeIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);
    if (duplicateNodeIds.length > 0) {
      errors.push({
        code: 'DUPLICATE_NODE_IDS',
        message: `Duplicate node IDs found: ${duplicateNodeIds.join(', ')}`
      });
    }

    // Check for duplicate edge IDs
    const edgeIds = edges.map(e => e.id);
    const duplicateEdgeIds = edgeIds.filter((id, index) => edgeIds.indexOf(id) !== index);
    if (duplicateEdgeIds.length > 0) {
      errors.push({
        code: 'DUPLICATE_EDGE_IDS',
        message: `Duplicate edge IDs found: ${duplicateEdgeIds.join(', ')}`
      });
    }

    // Check for multiple edges between same nodes
    const edgeKeys = new Set<string>();
    for (const edge of edges) {
      const key = `${edge.fromNodeId}->${edge.toNodeId}`;
      if (edgeKeys.has(key)) {
        errors.push({
          code: 'DUPLICATE_EDGES',
          message: `Multiple edges found between nodes: ${edge.fromNodeId} -> ${edge.toNodeId}`,
          edgeId: edge.id
        });
      }
      edgeKeys.add(key);
    }

    // Ensure there's at least one entry node
    const entryNodes = this.findEntryNodes(nodes, edges);
    if (entryNodes.length === 0) {
      errors.push({
        code: 'NO_ENTRY_NODES',
        message: 'Workflow must have at least one entry node (node with no incoming edges)'
      });
    }

    return errors;
  }

  /**
   * Detect cycles in the DAG using DFS
   */
  static detectCycles(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    const nodeIds = new Set(nodes.map(n => n.id));
    const adjacencyList = new Map<UUID, UUID[]>();
    
    // Build adjacency list
    for (const nodeId of nodeIds) {
      adjacencyList.set(nodeId, []);
    }
    
    for (const edge of edges) {
      const neighbors = adjacencyList.get(edge.fromNodeId) || [];
      neighbors.push(edge.toNodeId);
      adjacencyList.set(edge.fromNodeId, neighbors);
    }

    const visited = new Set<UUID>();
    const recursionStack = new Set<UUID>();
    const path: UUID[] = [];

    const dfs = (nodeId: UUID): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart).concat([neighbor]);
          throw new Error(`Cycle detected in workflow: ${cycle.join(' -> ')}`);
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
      return false;
    };

    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }
  }

  /**
   * Perform topological sort to determine execution order
   */
  static topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const inDegree = new Map<UUID, number>();
    const adjacencyList = new Map<UUID, UUID[]>();

    // Initialize in-degree and adjacency list
    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjacencyList.set(node.id, []);
    }

    // Build graph and calculate in-degrees
    for (const edge of edges) {
      const currentInDegree = inDegree.get(edge.toNodeId) || 0;
      inDegree.set(edge.toNodeId, currentInDegree + 1);
      
      const neighbors = adjacencyList.get(edge.fromNodeId) || [];
      neighbors.push(edge.toNodeId);
      adjacencyList.set(edge.fromNodeId, neighbors);
    }

    // Kahn's algorithm
    const queue: UUID[] = [];
    const result: WorkflowNode[] = [];

    // Add all nodes with in-degree 0 to queue
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;
      const currentNode = nodeMap.get(currentNodeId)!;
      result.push(currentNode);

      // Process all neighbors
      const neighbors = adjacencyList.get(currentNodeId) || [];
      for (const neighborId of neighbors) {
        const newInDegree = (inDegree.get(neighborId) || 0) - 1;
        inDegree.set(neighborId, newInDegree);
        
        if (newInDegree === 0) {
          queue.push(neighborId);
        }
      }
    }

    // Check if all nodes were processed (no cycles)
    if (result.length !== nodes.length) {
      throw new Error('Topological sort failed - cycle detected in workflow');
    }

    return result;
  }

  /**
   * Find entry nodes (nodes with no incoming edges)
   */
  static findEntryNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const nodesWithIncoming = new Set(edges.map(edge => edge.toNodeId));
    return nodes.filter(node => !nodesWithIncoming.has(node.id));
  }

  /**
   * Find exit nodes (nodes with no outgoing edges)
   */
  static findExitNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const nodesWithOutgoing = new Set(edges.map(edge => edge.fromNodeId));
    return nodes.filter(node => !nodesWithOutgoing.has(node.id));
  }

  /**
   * Create node lookup map
   */
  private static createNodeMap(nodes: WorkflowNode[]): Map<UUID, WorkflowNode> {
    return new Map(nodes.map(node => [node.id, node]));
  }

  /**
   * Create edge lookup map (fromNodeId -> edges)
   */
  private static createEdgeMap(edges: WorkflowEdge[]): Map<UUID, WorkflowEdge[]> {
    const edgeMap = new Map<UUID, WorkflowEdge[]>();
    
    for (const edge of edges) {
      const existing = edgeMap.get(edge.fromNodeId) || [];
      existing.push(edge);
      edgeMap.set(edge.fromNodeId, existing);
    }
    
    return edgeMap;
  }

  /**
   * Create dependency map (nodeId -> dependencies)
   */
  private static createDependencyMap(edges: WorkflowEdge[]): Map<UUID, UUID[]> {
    const dependencyMap = new Map<UUID, UUID[]>();
    
    for (const edge of edges) {
      const existing = dependencyMap.get(edge.toNodeId) || [];
      existing.push(edge.fromNodeId);
      dependencyMap.set(edge.toNodeId, existing);
    }
    
    return dependencyMap;
  }

  /**
   * Get nodes that are eligible for execution based on completed dependencies
   */
  static getEligibleNodes(
    parsedWorkflow: ParsedWorkflow,
    completedNodes: Set<UUID>,
    failedNodes: Set<UUID>,
    currentNodes: Set<UUID>
  ): WorkflowNode[] {
    const eligible: WorkflowNode[] = [];

    for (const node of parsedWorkflow.definition.definition.nodes) {
      // Skip if already processed or currently running
      if (completedNodes.has(node.id) || 
          failedNodes.has(node.id) || 
          currentNodes.has(node.id)) {
        continue;
      }

      // Check if all dependencies are satisfied
      const dependencies = parsedWorkflow.dependencyMap.get(node.id) || [];
      const allDependenciesMet = dependencies.every(depId => completedNodes.has(depId));

      if (allDependenciesMet) {
        eligible.push(node);
      }
    }

    return eligible;
  }

  /**
   * Check if workflow execution is complete
   */
  static isWorkflowComplete(
    parsedWorkflow: ParsedWorkflow,
    completedNodes: Set<UUID>,
    failedNodes: Set<UUID>,
    skippedNodes: Set<UUID>
  ): { isComplete: boolean; status: 'COMPLETED' | 'FAILED' | 'RUNNING' } {
    const totalNodes = parsedWorkflow.definition.definition.nodes.length;
    const processedNodes = completedNodes.size + failedNodes.size + skippedNodes.size;

    if (processedNodes === totalNodes) {
      return {
        isComplete: true,
        status: failedNodes.size > 0 ? 'FAILED' : 'COMPLETED'
      };
    }

    return {
      isComplete: false,
      status: 'RUNNING'
    };
  }
}