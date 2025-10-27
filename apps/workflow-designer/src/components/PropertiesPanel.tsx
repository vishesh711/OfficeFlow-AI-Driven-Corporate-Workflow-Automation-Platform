import { useCallback } from 'react'
import { X, Trash2, AlertTriangle } from 'lucide-react'
import { useWorkflowStore } from '@/store/workflow'

export function PropertiesPanel() {
  const { 
    nodes, 
    selectedNodeId, 
    selectNode, 
    updateNode, 
    deleteNode 
  } = useWorkflowStore()

  const selectedNode = nodes.find(node => node.id === selectedNodeId)

  const handleClose = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  const handleDelete = useCallback(() => {
    if (selectedNodeId) {
      deleteNode(selectedNodeId)
      selectNode(null)
    }
  }, [selectedNodeId, deleteNode, selectNode])

  const handleLabelChange = useCallback((label: string) => {
    if (selectedNodeId) {
      updateNode(selectedNodeId, { label })
    }
  }, [selectedNodeId, updateNode])

  const handleParamChange = useCallback((key: string, value: any) => {
    if (selectedNodeId) {
      const currentParams = selectedNode?.data.params || {}
      updateNode(selectedNodeId, {
        params: {
          ...currentParams,
          [key]: value,
        },
      })
    }
  }, [selectedNodeId, selectedNode, updateNode])

  const handleRetryPolicyChange = useCallback((field: string, value: number) => {
    if (selectedNodeId) {
      const currentRetryPolicy = selectedNode?.data.retryPolicy || { maxRetries: 3, backoffMs: 1000 }
      updateNode(selectedNodeId, {
        retryPolicy: {
          ...currentRetryPolicy,
          [field]: value,
        },
      })
    }
  }, [selectedNodeId, selectedNode, updateNode])

  const validateNodeConfiguration = useCallback(() => {
    if (!selectedNode) return []
    
    const errors: string[] = []
    const { type, data } = selectedNode
    
    switch (type) {
      case 'email':
        if (!data.params.recipients) {
          errors.push('Recipients field is required')
        }
        break
      case 'condition':
        if (!data.params.expression) {
          errors.push('Condition expression is required')
        }
        break
      case 'delay':
        if (!data.params.duration || data.params.duration < 1) {
          errors.push('Delay duration must be at least 1')
        }
        break
    }
    
    return errors
  }, [selectedNode])

  if (!selectedNode) return null

  const renderNodeProperties = () => {
    switch (selectedNode.type) {
      case 'trigger':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Event Type
              </label>
              <select
                value={selectedNode.data.params.eventType || 'employee.onboard'}
                onChange={(e) => handleParamChange('eventType', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
              >
                <option value="employee.onboard">Employee Onboard</option>
                <option value="employee.exit">Employee Exit</option>
                <option value="employee.transfer">Employee Transfer</option>
                <option value="employee.update">Employee Update</option>
              </select>
            </div>
          </div>
        )

      case 'identity':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Action
              </label>
              <select
                value={selectedNode.data.params.action || 'provision'}
                onChange={(e) => handleParamChange('action', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
              >
                <option value="provision">Provision Account</option>
                <option value="deprovision">Deprovision Account</option>
                <option value="update">Update Account</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Provider
              </label>
              <select
                value={selectedNode.data.params.provider || 'google'}
                onChange={(e) => handleParamChange('provider', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
              >
                <option value="google">Google Workspace</option>
                <option value="office365">Office 365</option>
                <option value="okta">Okta</option>
              </select>
            </div>
          </div>
        )

      case 'email':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Template
              </label>
              <select
                value={selectedNode.data.params.template || 'welcome'}
                onChange={(e) => handleParamChange('template', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
              >
                <option value="welcome">Welcome Email</option>
                <option value="onboarding">Onboarding Instructions</option>
                <option value="access_granted">Access Granted</option>
                <option value="custom">Custom Template</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Recipients
              </label>
              <input
                type="text"
                value={selectedNode.data.params.recipients || '{{employee.email}}'}
                onChange={(e) => handleParamChange('recipients', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="{{employee.email}}"
              />
            </div>
          </div>
        )

      case 'ai':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Content Type
              </label>
              <select
                value={selectedNode.data.params.contentType || 'welcome_message'}
                onChange={(e) => handleParamChange('contentType', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
              >
                <option value="welcome_message">Welcome Message</option>
                <option value="role_description">Role Description</option>
                <option value="team_introduction">Team Introduction</option>
                <option value="custom">Custom Prompt</option>
              </select>
            </div>
            {selectedNode.data.params.contentType === 'custom' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Custom Prompt
                </label>
                <textarea
                  value={selectedNode.data.params.prompt || ''}
                  onChange={(e) => handleParamChange('prompt', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none h-24"
                  placeholder="Enter your custom prompt..."
                />
              </div>
            )}
          </div>
        )

      case 'condition':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Condition Expression
              </label>
              <input
                type="text"
                value={selectedNode.data.params.expression || ''}
                onChange={(e) => handleParamChange('expression', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="e.g., {{employee.department}} === 'Engineering'"
              />
            </div>
          </div>
        )

      case 'delay':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Delay Duration
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  value={selectedNode.data.params.duration || 1}
                  onChange={(e) => handleParamChange('duration', parseInt(e.target.value))}
                  className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  min="1"
                />
                <select
                  value={selectedNode.data.params.unit || 'hours'}
                  onChange={(e) => handleParamChange('unit', e.target.value)}
                  className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="text-sm text-gray-500 text-center py-4">
            No configuration options available for this node type.
          </div>
        )
    }
  }

  return (
    <div className="w-80 bg-gradient-to-b from-white to-gray-50 border-l-2 border-gray-200 overflow-y-auto shadow-lg">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Properties</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDelete}
              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all"
              title="Delete Node"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Node Label
            </label>
            <input
              type="text"
              value={selectedNode.data.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Node Type
            </label>
            <div className="text-sm font-medium text-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-2.5 rounded-xl border border-blue-200">
              {selectedNode.type}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Configuration
            </label>
            <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
              {renderNodeProperties()}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Retry Policy
            </label>
            <div className="bg-white p-4 rounded-xl border-2 border-gray-200 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Max Retries
                </label>
                <input
                  type="number"
                  value={selectedNode.data.retryPolicy?.maxRetries || 3}
                  onChange={(e) => handleRetryPolicyChange('maxRetries', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  min="0"
                  max="10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Backoff (ms)
                </label>
                <input
                  type="number"
                  value={selectedNode.data.retryPolicy?.backoffMs || 1000}
                  onChange={(e) => handleRetryPolicyChange('backoffMs', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  min="100"
                  step="100"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Timeout (ms)
            </label>
            <input
              type="number"
              value={selectedNode.data.timeoutMs || 300000}
              onChange={(e) => updateNode(selectedNodeId!, { timeoutMs: parseInt(e.target.value) })}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              min="1000"
              step="1000"
            />
            <p className="text-xs text-gray-500 mt-2">
              Maximum execution time for this node
            </p>
          </div>

          {/* Validation Errors */}
          {validateNodeConfiguration().length > 0 && (
            <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Configuration Errors:
              </h4>
              <ul className="text-sm text-red-700 space-y-2">
                {validateNodeConfiguration().map((error, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-red-500 mr-2 font-bold">•</span>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}