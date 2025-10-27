import { useCallback, useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Connection,
  Node,
  ReactFlowProvider,
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
  const [showMetadataEditor, setShowMetadataEditor] = useState(!isEditing) // Show on new workflow
  const [workflowMetadata, setWorkflowMetadata] = useState({
    name: '',
    description: '',
    eventTrigger: 'employee.onboard',
  })

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
      setWorkflowMetadata({
        name: workflow.name,
        description: workflow.description || '',
        eventTrigger: workflow.eventTrigger,
      })
    }
  }, [workflow, setCurrentWorkflow])

  // Update current workflow when metadata changes
  useEffect(() => {
    if (workflowMetadata.name) {
      setCurrentWorkflow({
        ...currentWorkflow,
        name: workflowMetadata.name,
        description: workflowMetadata.description,
        eventTrigger: workflowMetadata.eventTrigger,
      } as Workflow)
    }
  }, [workflowMetadata])

  // Reset store when component unmounts
  useEffect(() => {
    return () => reset()
  }, [reset])

  const handleSave = useCallback(async () => {
    // Check if workflow has a name
    if (!workflowMetadata.name.trim()) {
      alert('Please enter a workflow name before saving.')
      setShowMetadataEditor(true)
      return
    }

    // Check if workflow has nodes
    if (!nodes.length) {
      alert('Please add at least one node to the workflow before saving.')
      return
    }

    // Validate workflow before saving
    if (!validationResult.isValid) {
      const errorMessages = validationResult.errors.map(e => e.message)
      alert(`Workflow validation failed:\n${errorMessages.join('\n')}`)
      setShowValidationPanel(true)
      return
    }

    const workflowData = {
      name: workflowMetadata.name,
      description: workflowMetadata.description,
      eventTrigger: workflowMetadata.eventTrigger,
      version: currentWorkflow?.version || 1,
      isActive: currentWorkflow?.isActive || false,
      definition: getWorkflowDefinition(),
    }

    try {
      setLoading(true)
      await saveWorkflowMutation.mutateAsync(workflowData)
      setDirty(false)
      alert('Workflow saved successfully!')
    } catch (error) {
      console.error('Failed to save workflow:', error)
      alert('Failed to save workflow. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [workflowMetadata, nodes, validationResult, getWorkflowDefinition, saveWorkflowMutation, setLoading, setDirty, currentWorkflow])

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
    <ReactFlowProvider>
      <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b-2 border-gray-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/workflows')}
            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <button
              onClick={() => setShowMetadataEditor(true)}
              className="text-left hover:bg-blue-50 rounded-lg px-3 py-2 transition-all"
            >
              <h1 className="text-xl font-bold text-gray-900">
                {currentWorkflow?.name || workflowMetadata.name || 'New Workflow'}
              </h1>
              {(currentWorkflow?.description || workflowMetadata.description) && (
                <p className="text-sm text-gray-600">{currentWorkflow?.description || workflowMetadata.description}</p>
              )}
            </button>
          </div>
          {isDirty && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-800 border border-orange-200">
              Unsaved changes
            </span>
          )}
          <button
            onClick={() => setShowValidationPanel(!showValidationPanel)}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
              validationResult.isValid
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border-green-200 hover:border-green-300'
                : 'bg-gradient-to-r from-red-50 to-rose-50 text-red-800 border-red-200 hover:border-red-300'
            }`}
          >
            {validationResult.isValid ? (
              <CheckCircle className="h-4 w-4 mr-1.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 mr-1.5" />
            )}
            {validationResult.errors.length > 0
              ? `${validationResult.errors.length} errors`
              : validationResult.warnings.length > 0
              ? `${validationResult.warnings.length} warnings`
              : 'Valid'
            }
          </button>
        </div>
        <div className="flex items-center space-x-3">
          {!isEditing && (
            <button
              onClick={() => setShowTemplateGallery(true)}
              className="inline-flex items-center px-4 py-2 border-2 border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
            >
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isLoading || saveWorkflowMutation.isPending}
            className="inline-flex items-center px-5 py-2 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200 transform hover:scale-105"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveWorkflowMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            disabled={!currentWorkflow?.isActive}
            className="inline-flex items-center px-4 py-2 border-2 border-green-300 rounded-xl text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
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
            className="bg-gradient-to-br from-gray-50 to-gray-100"
            snapToGrid
            snapGrid={[15, 15]}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#3b82f6', strokeWidth: 2 },
              markerEnd: {
                type: 'arrowclosed',
                color: '#3b82f6',
              },
            }}
            connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2 }}
            connectionLineType="smoothstep"
          >
            <Background
              gap={16}
              size={1}
              color="#e5e7eb"
              style={{ backgroundColor: 'transparent' }}
            />
            <Controls
              className="bg-white shadow-lg rounded-lg border border-gray-200"
              showInteractive={false}
            />
            <MiniMap
              className="bg-white shadow-lg rounded-lg border border-gray-200"
              nodeColor={(node) => {
                if (node.selected) return '#3b82f6'
                return '#9ca3af'
              }}
              maskColor="rgba(0, 0, 0, 0.05)"
            />
            <WorkflowToolbar />
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

      {/* Workflow Metadata Editor */}
      {showMetadataEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg border-2 border-gray-200 transform transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Workflow Details</h2>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Workflow Name *
                </label>
                <input
                  type="text"
                  value={workflowMetadata.name}
                  onChange={(e) => setWorkflowMetadata({ ...workflowMetadata, name: e.target.value })}
                  placeholder="e.g., Employee Onboarding"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={workflowMetadata.description}
                  onChange={(e) => setWorkflowMetadata({ ...workflowMetadata, description: e.target.value })}
                  placeholder="Describe what this workflow does..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Event Trigger *
                </label>
                <select
                  value={workflowMetadata.eventTrigger}
                  onChange={(e) => setWorkflowMetadata({ ...workflowMetadata, eventTrigger: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="employee.onboard">Employee Onboarding</option>
                  <option value="employee.offboard">Employee Offboarding</option>
                  <option value="employee.role_change">Role Change</option>
                  <option value="employee.department_change">Department Change</option>
                  <option value="document.created">Document Created</option>
                  <option value="document.updated">Document Updated</option>
                  <option value="meeting.scheduled">Meeting Scheduled</option>
                  <option value="project.created">Project Created</option>
                  <option value="task.assigned">Task Assigned</option>
                  <option value="manual">Manual Trigger</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => {
                  if (!isEditing) {
                    navigate('/workflows')
                  } else {
                    setShowMetadataEditor(false)
                  }
                }}
                className="px-6 py-2.5 text-gray-700 font-medium hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!workflowMetadata.name.trim()) {
                    alert('Please enter a workflow name')
                    return
                  }
                  setShowMetadataEditor(false)
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 shadow-lg transition-all transform hover:scale-105"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ReactFlowProvider>
  )
}