import { useState, useEffect } from 'react'
import { X, Clock, CheckCircle, XCircle, Play, Pause, AlertTriangle } from 'lucide-react'
import { WorkflowRun, monitoringApi } from '../lib/api'

interface WorkflowRunTimelineProps {
  run: WorkflowRun
  onClose: () => void
}

export function WorkflowRunTimeline({ run, onClose }: WorkflowRunTimelineProps) {
  const [detailedRun, setDetailedRun] = useState<WorkflowRun | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDetailedRun()
  }, [run.id])

  const loadDetailedRun = async () => {
    try {
      const response = await monitoringApi.getWorkflowRun(run.id)
      setDetailedRun(response.data)
    } catch (error) {
      console.error('Failed to load detailed run:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return <Play className="h-4 w-4 text-blue-500" />
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'QUEUED':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'RETRYING':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      default:
        return <Pause className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      case 'QUEUED':
        return 'bg-yellow-100 text-yellow-800'
      case 'RETRYING':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return 'Not started'
    if (!endTime) return 'Running...'
    
    const start = new Date(startTime)
    const end = new Date(endTime)
    const duration = end.getTime() - start.getTime()
    
    if (duration < 1000) return `${duration}ms`
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`
    return `${(duration / 60000).toFixed(1)}m`
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            Workflow Run Timeline
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : detailedRun ? (
          <div className="space-y-6">
            {/* Run Overview */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(detailedRun.status)}`}>
                    {getStatusIcon(detailedRun.status)}
                    <span className="ml-1">{detailedRun.status}</span>
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Duration</p>
                  <p className="text-sm text-gray-900">
                    {formatDuration(detailedRun.startedAt, detailedRun.endedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Started</p>
                  <p className="text-sm text-gray-900">
                    {new Date(detailedRun.startedAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Employee</p>
                  <p className="text-sm text-gray-900">
                    {detailedRun.context.employeeName || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Node Timeline */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">Node Execution Timeline</h4>
              <div className="flow-root">
                <ul className="-mb-8">
                  {detailedRun.nodeRuns.map((nodeRun, nodeIdx) => (
                    <li key={nodeRun.id}>
                      <div className="relative pb-8">
                        {nodeIdx !== detailedRun.nodeRuns.length - 1 ? (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-white flex items-center justify-center ring-8 ring-white">
                              {getStatusIcon(nodeRun.status)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  Node {nodeRun.nodeId}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Attempt {nodeRun.attempt} • {formatDuration(nodeRun.startedAt, nodeRun.endedAt)}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(nodeRun.status)}`}>
                                  {nodeRun.status}
                                </span>
                              </div>
                            </div>
                            
                            {nodeRun.error && (
                              <div className="mt-2 p-3 bg-red-50 rounded-md">
                                <p className="text-sm text-red-800">{nodeRun.error}</p>
                              </div>
                            )}
                            
                            {nodeRun.output && Object.keys(nodeRun.output).length > 0 && (
                              <div className="mt-2">
                                <details className="group">
                                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                    View output
                                  </summary>
                                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                    {JSON.stringify(nodeRun.output, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Failed to load workflow run details</p>
          </div>
        )}
      </div>
    </div>
  )
}