import { useCallback, useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Connection,
  Node,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { workflowApi, Workflow } from '@/lib/api'
import { useWorkflowStore } from '@/store/workflow'
import { WorkflowToolbar } from '@/components/WorkflowToolbar'
import { NodeSidebar } from '@/components/NodeSidebar'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { nodeTypes } from '@/components/nodes'
import { Save, Play, ArrowLeft, FileText, AlertTriangle, CheckCircle } from 'lucide-react'
import { TemplateGallery } from '@/components/TemplateGallery'
import { ValidationPanel } from '@/components/ValidationPanel'
import { WorkflowTemplate } from '@/lib/templates'
import { validateWorkflow } from '@/lib/validation'

export function WorkflowDesigner() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = Boolean(id)

  const {
    currentWorkflow,
    nodes,
    edges,
    selectedNodeId,
    isDirty,
    isLoading,
    setCurrentWorkflow,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    setLoading,
    reset,
    loadWorkflowDefinition,
    getWorkflowDefinition,
    setDirty,
  } = useWorkflowStore()

  const [showTemplateGallery, setShowTemplateGallery] = useState(false)
  const [showValidationPanel, setShowValidationPanel] = useState(false)

  // Real-time validation
  const validationResult = useMemo(() => {
    return validateWorkflow(nodes, edges)
  }, [nodes, edges])

  // Load workflow if editing
  const { data: workflow } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowApi.getWorkflow(id!).then(res => res.data),
    enabled: isEditing,
  })

  // Save workflow mutation
  const saveWorkflowMutation = useMutation({
    mutationFn: async (workflowData: Partial<Workflow>) => {
      if (isEditing && currentWorkflow) {
        return workflowApi.updateWorkflow(currentWorkflow.id, workflowData)
      } else {
        return workflowApi.createWorkflow(workflowData as Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>)
      }
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      if (!isEditing) {
        navigate(`/workflows/${response.data.id}`)
      }
      setCurrentWorkflow(response.data)
    },
  })

  // Load workflow data when editing
  useEffect(() => {
    if (workflow) {
      setCurrentWorkflow(workflow)
    }
  }, [workflow, setCurrentWorkflow])

  // Reset store when component unmounts
  useEffect(() => {
    return () => reset()
  }, [reset])

  const handleSave = useCallback(async () => {
    if (!currentWorkflow && !nodes.length) return

    // Validate workflow before saving
    if (!validationResult.isValid) {
      const errorMessages = validationResult.errors.map(e => e.message)
      alert(`Workflow validation failed:\n${errorMessages.join('\n')}`)
      setShowValidationPanel(true)
      return
    }

    const workflowData = {
      name: currentWorkflow?.name || 'Untitled Workflow',
      description: currentWorkflow?.description || '',
      eventTrigger: currentWorkflow?.eventTrigger || 'employee.onboard',
      version: currentWorkflow?.version || 1,
      isActive: currentWorkflow?.isActive || false,
      definition: getWorkflowDefinition(),
    }

    try {
      setLoading(true)
      await saveWorkflowMutation.mutateAsync(workflowData)
      setDirty(false)
    } catch (error) {
      console.error('Failed to save workflow:', error)
      alert('Failed to save workflow. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [currentWorkflow, nodes, validationResult, getWorkflowDefinition, saveWorkflowMutation, setLoading, setDirty])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Save workflow (Ctrl/Cmd + S)
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        handleSave()
      }
      
      // Delete selected node (Delete key)
      if (event.key === 'Delete' && selectedNodeId) {
        const { deleteNode } = useWorkflowStore.getState()
        deleteNode(selectedNodeId)
      }
      
      // Deselect node (Escape key)
      if (event.key === 'Escape') {
        selectNode(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, selectedNodeId, selectNode])

  const handleSelectTemplate = useCallback((template: WorkflowTemplate) => {
    // Create a new workflow from template
    const newWorkflow = {
      name: template.name,
      description: template.description,
      eventTrigger: 'employee.onboard',
      version: 1,
      isActive: false,
      definition: template.definition,
    }
    
    setCurrentWorkflow(newWorkflow as any)
    loadWorkflowDefinition(template.definition)
  }, [setCurrentWorkflow, loadWorkflowDefinition])

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    selectNode(node.id)
  }, [selectNode])

  const handlePaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  const isValidConnection = useCallback((connection: Connection) => {
    const { source, target } = connection
    
    // Prevent self-connections
    if (source === target) {
      return false
    }

    // Check for circular dependencies
    const wouldCreateCycle = (sourceId: string, targetId: string): boolean => {
      const visited = new Set<string>()
      
      const dfs = (nodeId: string): boolean => {
        if (nodeId === sourceId) return true
        if (visited.has(nodeId)) return false
        
        visited.add(nodeId)
        
        const outgoingEdges = edges.filter(edge => edge.source === nodeId)
        return outgoingEdges.some(edge => dfs(edge.target))
      }
      
      return dfs(targetId)
    }

    if (wouldCreateCycle(source!, target!)) {
      return false
    }

    // Validate node type connections
    const sourceNode = nodes.find(n => n.id === source)
    const targetNode = nodes.find(n => n.id === target)
    
    if (!sourceNode || !targetNode) return false

    // Trigger nodes can only be source nodes
    if (targetNode.type === 'trigger' || targetNode.type === 'schedule') {
      return false
    }

    return true
  }, [nodes, edges])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow')
      const label = event.dataTransfer.getData('application/nodelabel')

      if (typeof type === 'undefined' || !type) {
        return
      }

      // Calculate position relative to the React Flow pane
      const reactFlowBounds = (event.target as Element).getBoundingClientRect()
      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      }

      const getDefaultParams = (nodeType: string): Record<string, any> => {
        switch (nodeType) {
          case 'trigger':
            return { eventType: 'employee.onboard' }
          case 'identity':
            return { action: 'provision', provider: 'google' }
          case 'email':
            return { template: 'welcome', recipients: '{{employee.email}}' }
          case 'ai':
            return { contentType: 'welcome_message' }
          case 'condition':
            return { expression: '{{employee.department}} === "Engineering"' }
          case 'delay':
            return { duration: 1, unit: 'hours' }
          case 'calendar':
            return { action: 'schedule_meeting' }
          case 'slack':
            return { action: 'send_message', channel: '#general' }
          case 'document':
            return { action: 'distribute', documentType: 'handbook' }
          case 'schedule':
            return { schedule: '0 9 * * 1' }
          default:
            return {}
        }
      }

      const newNode = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label,
          params: getDefaultParams(type),
          retryPolicy: {
            maxRetries: 3,
            backoffMs: 1000,
          },
          timeoutMs: 300000,
        },
      }

      const { addNode } = useWorkflowStore.getState()
      addNode(newNode)
    },
    []
  )

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/workflows')}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-medium text-gray-900">
              {currentWorkflow?.name || 'New Workflow'}
            </h1>
            {currentWorkflow?.description && (
              <p className="text-sm text-gray-500">{currentWorkflow.description}</p>
            )}
          </div>
          {isDirty && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              Unsaved changes
            </span>
          )}
          <button
            onClick={() => setShowValidationPanel(!showValidationPanel)}
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              validationResult.isValid
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {validationResult.isValid ? (
              <CheckCircle className="h-3 w-3 mr-1" />
            ) : (
              <AlertTriangle className="h-3 w-3 mr-1" />
            )}
            {validationResult.errors.length > 0
              ? `${validationResult.errors.length} errors`
              : validationResult.warnings.length > 0
              ? `${validationResult.warnings.length} warnings`
              : 'Valid'
            }
          </button>
        </div>
        <div className="flex items-center space-x-2">
          {!isEditing && (
            <button
              onClick={() => setShowTemplateGallery(true)}
              className="btn btn-outline"
            >
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isLoading || saveWorkflowMutation.isPending}
            className="btn btn-primary"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveWorkflowMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            disabled={!currentWorkflow?.isActive}
            className="btn btn-secondary"
          >
            <Play className="h-4 w-4 mr-2" />
            Test Run
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Node Sidebar */}
        <NodeSidebar />

        {/* Main Canvas */}
        <div className="flex-1 relative">
          <WorkflowToolbar />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            isValidConnection={isValidConnection}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
            snapToGrid
            snapGrid={[15, 15]}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* Properties Panel */}
        {selectedNodeId && <PropertiesPanel />}
      </div>

      {/* Template Gallery */}
      <TemplateGallery
        isOpen={showTemplateGallery}
        onClose={() => setShowTemplateGallery(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Validation Panel */}
      <ValidationPanel
        isOpen={showValidationPanel}
        onClose={() => setShowValidationPanel(false)}
      />
    </div>
  )
}