import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import type { NodeChange, EdgeChange } from 'reactflow';
import { Workflow, WorkflowDefinition } from '@/lib/api';

export interface WorkflowStore {
  // Current workflow being edited
  currentWorkflow: Workflow | null;

  // React Flow state
  nodes: Node[];
  edges: Edge[];

  // UI state
  selectedNodeId: string | null;
  isLoading: boolean;
  isDirty: boolean;

  // Actions
  setCurrentWorkflow: (workflow: Workflow | null) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, data: any) => void;
  deleteNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  loadWorkflowDefinition: (definition: WorkflowDefinition) => void;
  getWorkflowDefinition: () => WorkflowDefinition;
  setLoading: (loading: boolean) => void;
  setDirty: (dirty: boolean) => void;
  reset: () => void;
}

const initialState = {
  currentWorkflow: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isLoading: false,
  isDirty: false,
};

export const useWorkflowStore = create<WorkflowStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setCurrentWorkflow: (workflow) => {
        set({ currentWorkflow: workflow });
        if (workflow?.definition) {
          get().loadWorkflowDefinition(workflow.definition);
        }
      },

      setNodes: (nodes) => set({ nodes, isDirty: true }),

      setEdges: (edges) => set({ edges, isDirty: true }),

      onNodesChange: (changes) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes),
          isDirty: true,
        });
      },

      onEdgesChange: (changes) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
          isDirty: true,
        });
      },

      onConnect: (connection) => {
        set({
          edges: addEdge(connection, get().edges),
          isDirty: true,
        });
      },

      addNode: (node) => {
        set({
          nodes: [...get().nodes, node],
          isDirty: true,
        });
      },

      updateNode: (nodeId, data) => {
        set({
          nodes: get().nodes.map((node) =>
            node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
          ),
          isDirty: true,
        });
      },

      deleteNode: (nodeId) => {
        set({
          nodes: get().nodes.filter((node) => node.id !== nodeId),
          edges: get().edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
          selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
          isDirty: true,
        });
      },

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

      loadWorkflowDefinition: (definition) => {
        const nodes = definition.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
        }));

        const edges = definition.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          data: edge.data,
        }));

        set({ nodes, edges, isDirty: false });
      },

      getWorkflowDefinition: (): WorkflowDefinition => {
        const { nodes, edges } = get();
        return {
          nodes: nodes.map((node) => ({
            id: node.id,
            type: node.type || 'default',
            position: node.position,
            data: node.data,
          })),
          edges: edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle || undefined,
            targetHandle: edge.targetHandle || undefined,
            data: edge.data,
          })),
        };
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setDirty: (dirty) => set({ isDirty: dirty }),

      reset: () => set(initialState),
    }),
    {
      name: 'workflow-store',
    }
  )
);
