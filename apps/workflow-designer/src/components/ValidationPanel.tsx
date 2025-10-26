import { useMemo } from 'react'
import { AlertTriangle, AlertCircle, CheckCircle, X } from 'lucide-react'
import { useWorkflowStore } from '@/store/workflow'
import { validateWorkflow, ValidationError } from '@/lib/validation'

interface ValidationPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function ValidationPanel({ isOpen, onClose }: ValidationPanelProps) {
  const { nodes, edges, selectNode } = useWorkflowStore()

  const validationResult = useMemo(() => {
    return validateWorkflow(nodes, edges)
  }, [nodes, edges])

  const handleErrorClick = (error: ValidationError) => {
    if (error.nodeId) {
      selectNode(error.nodeId)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-40 max-h-96 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          {validationResult.isValid ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          )}
          <h3 className="font-medium text-gray-900">
            Workflow Validation
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-y-auto max-h-80">
        {validationResult.isValid && validationResult.warnings.length === 0 ? (
          <div className="p-4 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              Workflow is valid with no issues detected.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Errors */}
            {validationResult.errors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Errors ({validationResult.errors.length})
                </h4>
                <div className="space-y-2">
                  {validationResult.errors.map((error) => (
                    <div
                      key={error.id}
                      className={`p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800 ${
                        error.nodeId ? 'cursor-pointer hover:bg-red-100' : ''
                      }`}
                      onClick={() => handleErrorClick(error)}
                    >
                      <div className="flex items-start">
                        <AlertCircle className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{error.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {validationResult.warnings.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-yellow-800 mb-2 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Warnings ({validationResult.warnings.length})
                </h4>
                <div className="space-y-2">
                  {validationResult.warnings.map((warning) => (
                    <div
                      key={warning.id}
                      className={`p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 ${
                        warning.nodeId ? 'cursor-pointer hover:bg-yellow-100' : ''
                      }`}
                      onClick={() => handleErrorClick(warning)}
                    >
                      <div className="flex items-start">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{warning.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>
            {nodes.length} nodes, {edges.length} connections
          </span>
          <span>
            {validationResult.errors.length} errors, {validationResult.warnings.length} warnings
          </span>
        </div>
      </div>
    </div>
  )
}